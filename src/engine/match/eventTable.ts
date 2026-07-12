// ============================================================
// engine/match/eventTable.ts — ステップ抽選とゴール判定
// GDD 補完A-4（d100テーブル）/ A-5（ゴール判定）。
// バランス調整用の係数はすべてここに集約（balanceハーネスで検証）。
// ============================================================

import type { MatchEventKind } from '../types'
import type { RNG } from '../rng'

// --- 調整レバー（balanceハーネスで「互角→片チーム1.2〜1.5点」に合わせる） ---
export const TUNING = {
  GOAL_BASE: 0.12,    // A-5: 互角時のベース得点率
  GOAL_SPREAD: 0.30,  // A-5: 能力差による振れ幅
  GOAL_DIV: 12,       // A-5: σ((attackQ-defendQ)/DIV)
  GOAL_MIN: 0.05,
  GOAL_MAX: 0.55,
  GOAL_SCALE: 2.15,   // 全体スケール（平均得点を1.5付近へ・検証で確定）
  HALF_CHANCE_MULT: 0.45, // ハーフチャンスの決定率係数
  SET_PIECE_MULT: 0.60,   // セットプレーの決定率係数
  SET_PIECE_TACTIC_BONUS: 1.30, // セットプレー重視戦術時の上乗せ
}

/** ロジスティックσ */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/** 支配率 p = myMidQ^1.5 / (myMidQ^1.5 + oppMidQ^1.5)（A-5） */
export function possession(myMidQ: number, oppMidQ: number): number {
  const a = Math.pow(Math.max(1, myMidQ), 1.5)
  const b = Math.pow(Math.max(1, oppMidQ), 1.5)
  return a / (a + b)
}

/** チャンスの基本得点率（A-5・GOAL_SCALE適用前にクランプ） */
export function baseGoalProb(attackQ: number, defendQ: number): number {
  const raw = TUNING.GOAL_BASE + TUNING.GOAL_SPREAD * sigmoid((attackQ - defendQ) / TUNING.GOAL_DIV)
  const clamped = Math.max(TUNING.GOAL_MIN, Math.min(TUNING.GOAL_MAX, raw))
  return clamped * TUNING.GOAL_SCALE
}

/** イベント種別ごとの最終得点率 */
export function goalProbForEvent(
  kind: MatchEventKind,
  attackQ: number,
  defendQ: number,
  attackerSetPieceTactic: boolean,
): number {
  const base = baseGoalProb(attackQ, defendQ)
  switch (kind) {
    case 'chance': return Math.min(0.95, base)
    case 'half-chance': return Math.min(0.95, base * TUNING.HALF_CHANCE_MULT)
    case 'set-piece': {
      const m = TUNING.SET_PIECE_MULT * (attackerSetPieceTactic ? TUNING.SET_PIECE_TACTIC_BONUS : 1)
      return Math.min(0.95, base * m)
    }
    default: return 0
  }
}

/**
 * d100ステップ抽選（A-4）。problemRatio = 攻撃側の問題児比率（ファウル重み×2用）。
 */
export function rollStepEvent(rng: RNG): MatchEventKind {
  const r = rng.int(1, 101) // 1〜100
  if (r <= 40) return 'midfield'
  if (r <= 60) return 'chance'
  if (r <= 72) return 'half-chance'
  if (r <= 80) return 'set-piece'
  if (r <= 88) return 'foul'        // 詳細はstepMatchで黄/赤/無を判定
  if (r <= 92) return 'injury'
  return 'flavor'                   // 93〜100 性格イベント（MVPはフレーバー）
}

/** ファウルの内訳（A-4: イエロー55%/なし40%/レッド5%・問題児重み×2） */
export function rollFoulKind(rng: RNG, troublemakerRatio: number): MatchEventKind {
  // 問題児が多いほどカード率が上がる
  const cardBoost = Math.min(0.30, troublemakerRatio * 0.5)
  const red = 0.05 + cardBoost * 0.3
  const yellow = 0.55 + cardBoost
  const r = rng.next()
  if (r < red) return 'foul-red'
  if (r < red + yellow) return 'foul-yellow'
  return 'foul-none'
}
