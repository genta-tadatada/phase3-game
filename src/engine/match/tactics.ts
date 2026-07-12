// ============================================================
// engine/match/tactics.ts — 戦術補正（GDD 補完A-3 / Section 3.2）
// 最終attackQ = attackQ × 戦術適合度 × 戦術相性補正 × 実行度
// 戦術相性は1項目±5%・合計±15%クランプ。
// ============================================================

import type { Tactics } from '../types'
import type { TeamQuality } from './teamQuality'

export interface TacticalOutcome {
  attackQ: number
  midQ: number
  defendQ: number
  staminaDrainMult: number // この戦術でのスタミナ消耗倍率（A-6プレス係数）
}

// メンタリティによる攻守の振り分け（攻撃↑なら守備↓のトレードオフ）
const MENTALITY: Record<Tactics['mentality'], { atk: number; def: number }> = {
  'ultra-attack':  { atk: 1.12, def: 0.88 },
  'attack':        { atk: 1.06, def: 0.94 },
  'balance':       { atk: 1.00, def: 1.00 },
  'defense':       { atk: 0.94, def: 1.06 },
  'ultra-defense': { atk: 0.88, def: 1.12 },
}

// プレス強度 → 中盤の競り合い・スタミナ消耗（A-6）
const PRESS: Record<Tactics['press'], { mid: number; drain: number }> = {
  high: { mid: 1.05, drain: 1.30 },
  mid:  { mid: 1.00, drain: 1.00 },
  low:  { mid: 0.96, drain: 0.80 },
}

/** メンタリティのスタミナ係数（A-6） */
const MENTALITY_DRAIN: Record<Tactics['mentality'], number> = {
  'ultra-attack': 1.15, 'attack': 1.07, 'balance': 1.0,
  'defense': 0.95, 'ultra-defense': 0.90,
}

/**
 * 戦術適合度: チームの戦術がその能力傾向に合っているかの近似（0.95〜1.05）。
 * MVP簡略 — フル版では選手個々の適性で精密化する。
 */
function tacticalFit(t: Tactics, q: TeamQuality): number {
  let fit = 1.0
  // カウンター（速いビルドアップ）は素早い攻撃陣で機能
  if (t.buildUp === 'fast' && q.attackQ >= q.midQ) fit += 0.03
  // ポゼッション（遅いビルドアップ）は中盤の質が要る
  if (t.buildUp === 'slow' && q.midQ >= q.attackQ) fit += 0.03
  // 超攻撃なのに守備偏重チーム等のミスマッチは微減
  if (t.mentality === 'ultra-attack' && q.attackQ < q.defendQ - 8) fit -= 0.04
  return Math.max(0.92, Math.min(1.06, fit))
}

/**
 * 戦術相性のエッジ（自分視点の符号付き%・±18%クランプ）。
 * GDD A-3の相性表を土台に、相手戦術を「読んで対応する」価値が出るよう
 * カバー範囲を拡張（攻撃的アグレッサーを受けてカウンター 等）。
 * 戻り値は % 値（applyTacticsで攻撃・守備の両方に効かせる）。
 */
export function matchupEdgePct(me: Tactics, opp: Tactics): number {
  let pct = 0
  // --- 自分が有利（相手を読んで当てると取れる） ---
  if (me.buildUp === 'fast' && opp.defenseLine === 'high') pct += 6   // 高いラインの裏をカウンターで突く
  if (me.press === 'high' && opp.buildUp === 'slow') pct += 6         // 遅いビルドUPをハイプレスで潰す
  if (me.width === 'wide' && opp.defenseLine === 'low') pct += 5      // 引いた相手を幅で揺さぶる
  if (me.width === 'central' && opp.formation.startsWith('3-')) pct += 5 // 3バックの中央を突く
  if (me.defenseLine !== 'high' && opp.buildUp === 'fast') pct += 5   // 深く構えて速攻の背後を消す
  if ((me.mentality === 'defense' || me.mentality === 'ultra-defense')
      && (opp.mentality === 'attack' || opp.mentality === 'ultra-attack')) pct += 4 // 受けてカウンター
  // --- 相手が有利（自分のミスマッチ） ---
  if (me.buildUp === 'slow' && opp.press === 'high') pct -= 6         // ポゼッションを高プレスに刈られる
  if (me.defenseLine === 'high' && opp.buildUp === 'fast') pct -= 6   // 高いラインの裏を取られる
  if (me.mentality === 'ultra-attack' && opp.mentality === 'ultra-defense') pct -= 3 // 引いた相手を崩せず手詰まり
  return Math.max(-18, Math.min(18, pct))
}

/** 実行度（A-3: IQ平均が低いと戦術が機能しない） */
export function executionRate(iqAvg: number): number {
  return 0.85 + (iqAvg / 99) * 0.15
}

/**
 * 生のTeamQualityに戦術補正を適用して最終強度を返す。
 */
export function applyTactics(
  q: TeamQuality,
  me: Tactics,
  opp: Tactics,
  iqAvg: number,
): TacticalOutcome {
  const ment = MENTALITY[me.mentality]
  const press = PRESS[me.press]
  const fit = tacticalFit(me, q)
  const edge = matchupEdgePct(me, opp)
  // 相性で上回ると「試合を支配」→ 攻撃に全幅・守備にも半分効かせる
  const atkMatchup = 1 + edge / 100
  const defMatchup = 1 + edge / 200
  const exec = executionRate(iqAvg)

  const attackQ = q.attackQ * ment.atk * fit * atkMatchup * exec
  const midQ = q.midQ * press.mid * (1 + edge / 300) * (0.9 + exec * 0.1)
  const defendQ = q.defendQ * ment.def * defMatchup * (0.9 + exec * 0.1)
  const staminaDrainMult = press.drain * MENTALITY_DRAIN[me.mentality]

  return { attackQ, midQ, defendQ, staminaDrainMult }
}
