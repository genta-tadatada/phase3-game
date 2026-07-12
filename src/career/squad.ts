// ============================================================
// career/squad.ts — A/B/Cチーム編成 と 下位チームの軽量試合シミュレート
// ・A=公式戦招集 / B・C=育成。能力＋性格＋スキルで選考価値を算出。
// ・B/C練習試合は18ステップを回さず、強度差から得点を直接サンプリング（軽量）。
// ============================================================

import type { Player } from '../engine/types'
import type { RNG } from '../engine/rng'
import { playerOverallSum } from '../engine/match/teamQuality'

export type Squad = 'A' | 'B' | 'C'

const ATARI = ['leader', 'genius', 'fighter', 'hardworker']

/** 選考価値＝能力＋あたり性格＋スキル（純粋な能力だけで決めない） */
export function selectionValue(p: Player): number {
  let v = playerOverallSum(p)
  if (ATARI.includes(p.personality)) v += 18      // あたり性格は士気・伸びしろで加点
  v += (p.skills?.length ?? 0) * 12               // スキル保持で加点
  if (p.isCaptain) v += 10
  return v
}

// G-41 §3: B/Cの解放条件を「Bチームコーチ/Cチームコーチ雇用」ベースに変更（旧: 評判50+部員25）
//   B: 部員25人 + 寮Lv2以上 + Bチームコーチ
//   C: 部員45人 + 寮Lv4以上 + Cチームコーチ + Bチームコーチ
// 評判は撤廃（そもそも入部数増加に評判が必要なので二重条件）。
export interface AbcUnlockState {
  roster: { length: number }
  facilities: { dorm: number }
  staff?: string[]
}
export function bSquadUnlocked(s: AbcUnlockState): boolean {
  return s.roster.length >= 25 && s.facilities.dorm >= 2 && (s.staff ?? []).includes('bcoach')
}
export function cSquadUnlocked(s: AbcUnlockState): boolean {
  return s.roster.length >= 45 && s.facilities.dorm >= 4 &&
    (s.staff ?? []).includes('ccoach') && (s.staff ?? []).includes('bcoach')
}
/** A/B/Cいずれかの multi-team 制が解放されているか（旧 abcUnlocked 互換）。 */
export function abcUnlocked(s: AbcUnlockState): boolean {
  return bSquadUnlocked(s) || cSquadUnlocked(s)
}

/**
 * 成長・育成上の所属カテゴリ。
 * - 'A' = Aチーム招集メンバー
 * - 'B' = Bチーム所属（Bチーム解放済み）
 * - 'C' = Cチーム所属（Cチーム解放済み）
 * - 'orphan' = squad='B' or 'C' だがその枠が未解放＝「招集外」
 *
 * 例：B未解放で部員25人→上位20人=A・残り5人=orphan（招集外）。
 *     B解放済C未解放で部員45人→上位20=A・21-40=B・41-45=orphan。
 *
 * 育成成長(growth.tsの万能成長)・PracticePlanner表示・UIヒント等で利用する。
 */
export type SquadCategory = 'A' | 'B' | 'C' | 'orphan'
export function squadCategoryOf(p: Player, ctx: AbcUnlockState): SquadCategory {
  const s = p.squad ?? 'A'
  if (s === 'A') return 'A'
  if (s === 'B' && bSquadUnlocked(ctx)) return 'B'
  if (s === 'C' && cSquadUnlocked(ctx)) return 'C'
  return 'orphan'
}

/** A定員（試合招集枠）。全国選手権ルール準拠で先発11＋ベンチ9＝20。 */
export function squadCapacities(rosterSize: number): { a: number; b: number } {
  const a = Math.min(rosterSize, 20)              // 招集メンバー＝先発11＋ベンチ9
  const b = Math.min(Math.max(0, rosterSize - a), 20)
  return { a, b }                                  // 残りは C（解禁時のみ意味を持つ）
}

/** 自動でA/B/Cを割り当てる（プレイヤーはUIで上書き可能） */
export function autoAssignSquads(roster: Player[]): Player[] {
  const sorted = [...roster].sort((x, y) => selectionValue(y) - selectionValue(x))
  const { a, b } = squadCapacities(roster.length)
  const squadOf = new Map<string, Squad>()
  sorted.forEach((p, i) => {
    squadOf.set(p.id, i < a ? 'A' : i < a + b ? 'B' : 'C')
  })
  return roster.map((p) => ({ ...p, squad: squadOf.get(p.id) ?? 'A' }))
}

export function squadMembers(roster: Player[], squad: Squad): Player[] {
  return roster.filter((p) => (p.squad ?? 'A') === squad)
}

/** チームの平均総合力（軽量試合・表示用） */
export function squadStrength(members: Player[]): number {
  if (members.length === 0) return 30
  // 上位11人の平均（試合に出る選手で評価）
  const top = [...members].sort((x, y) => playerOverallSum(y) - playerOverallSum(x)).slice(0, 11)
  return top.reduce((s, p) => s + playerOverallSum(p), 0) / top.length / 7
}

function poisson(lambda: number, rng: RNG): number {
  const L = Math.exp(-Math.max(0.05, lambda))
  let k = 0, p = 1
  do { k++; p *= rng.next() } while (p > L)
  return Math.min(8, k - 1)
}

/** 下位チームの軽量試合結果（18ステップを回さない・結果のみ） */
export function quickMatchResult(strA: number, strB: number, rng: RNG): { a: number; b: number } {
  const eg = (att: number, def: number) => Math.max(0.15, Math.min(5, 1.25 * Math.exp((att - def) / 22)))
  return { a: poisson(eg(strA, strB), rng), b: poisson(eg(strB, strA), rng) }
}
