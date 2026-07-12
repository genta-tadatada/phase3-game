// ============================================================
// career/manager.ts — #42 マネージャー（3年目あたりに加入・チームを支える存在）
// 効果は受動（疲労回復+・雰囲気底上げ・マンネリ緩和）。立ち絵は将来素材で差し替え（現状はマスコット代用）。
// ============================================================

import type { RNG } from '../engine/rng'
import { generateName } from '../data/names'

export type ManagerTrait = 'caring' | 'organized' | 'cheerful' | 'analytical'

export interface Manager {
  name: string
  trait: ManagerTrait
  joinedYear: number
  // G-32: マネージャー恋愛。dating=現在交際中の選手ID＋開始年。HoF用には終了状況も記録（将来拡張）
  dating?: { playerId: string; startYear: number }
}

export const MANAGER_TRAIT: Record<ManagerTrait, { label: string; desc: string }> = {
  caring: { label: '面倒見がいい', desc: '選手の疲れをよく察し、コンディション管理に長ける。' },
  organized: { label: 'しっかり者', desc: '練習の段取りが良く、チームに規律と落ち着きをもたらす。' },
  cheerful: { label: 'ムードメーカー', desc: '明るく場を和ませ、チームの空気を底上げする。' },
  analytical: { label: '分析好き', desc: '相手や試合をよく見ていて、的確な助言をくれる。' },
}

const TRAITS: ManagerTrait[] = ['caring', 'organized', 'cheerful', 'analytical']

/** マネージャーを生成（架空の氏名＋個性）。 */
export function generateManager(rng: RNG, joinedYear: number): Manager {
  return { name: generateName(rng), trait: rng.pick(TRAITS), joinedYear }
}

// 受動効果の係数（コア＝全マネージャー共通。個性別の増減は将来の調整余地）。
export const MANAGER_FATIGUE_RELIEF = 3   // 毎週の追加疲労回復
export const MANAGER_ATMO_BONUS = 2       // 雰囲気の平衡点を恒常的に底上げ

// ============================================================
// マネージャー専用ミニイベント（年間プラン）
//   trait ごとの専用イベント（cheerful/organized/analytical）は、
//   年初にサイコロを振り「今年は何回起きるか」を確率分布で決め、
//   さらに発生週を年内からランダム抽選する＝シーズンで発生数が偏らない。
//   caring trait（疲労気付き）と共通イベント2種は週次の確率発火なのでここでは扱わない。
// ============================================================
export interface ManagerEventPlan {
  cheerful: number[]    // お菓子差し入れの発火週リスト
  organized: number[]   // 用具整理・修復の発火週リスト
  analytical: number[]  // カメラで3人撮影の発火週リスト
}

export interface ManagerEventState {
  year: number          // このプランが何年目用か（年が進めば再生成）
  plan: ManagerEventPlan
  caringFired: number   // 今年「○○くんの体調に気付く」が何回発火したか（上限4）
  coldUsed: boolean     // 今年「マネージャーが風邪で欠席」を消費したか
  absentWeek?: number   // 風邪欠席週（受動効果オフ＋練習効率-15%）。0=未予定
}

// 累積分布からサイコロを引く（0.0..1.0 の rng値に対し配列のしきい値で n を返す）
function rollFromTable(r: number, table: number[]): number {
  let acc = 0
  for (let n = 0; n < table.length; n++) {
    acc += table[n]
    if (r < acc) return n
  }
  return table.length - 1
}

// 週リストから重複しないようランダムに count 個選ぶ
function pickWeeks(rng: RNG, count: number, weeks: number[]): number[] {
  if (count <= 0) return []
  const pool = weeks.slice()
  const out: number[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng.next() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out.sort((a, b) => a - b)
}

/**
 * 年初に「trait専用イベント」の発火週を抽選してプランを作る。
 * caring トレイトの専用イベントは週次確率発火のため、ここでは空配列のままになる。
 * 確率分布（caring と総数で平準化）:
 *   cheerful: 0/1/2/3/4 = 10/25/35/25/5%   期待値 ≈ 1.90
 *   organized: 0/1/2/3   = 20/40/30/10%    期待値 ≈ 1.30 ×1週効果が強いので回数は少なめ
 *   analytical: 0/1/2/3/4 = 5/20/35/30/10%  期待値 ≈ 2.20
 */
export function makeManagerEventPlan(rng: RNG, trait: ManagerTrait): ManagerEventPlan {
  const allWeeks: number[] = []
  for (let w = 1; w <= 48; w++) allWeeks.push(w)
  const plan: ManagerEventPlan = { cheerful: [], organized: [], analytical: [] }
  if (trait === 'cheerful') {
    const n = rollFromTable(rng.next(), [0.10, 0.25, 0.35, 0.25, 0.05])
    plan.cheerful = pickWeeks(rng, n, allWeeks)
  } else if (trait === 'organized') {
    const n = rollFromTable(rng.next(), [0.20, 0.40, 0.30, 0.10])
    plan.organized = pickWeeks(rng, n, allWeeks)
  } else if (trait === 'analytical') {
    const n = rollFromTable(rng.next(), [0.05, 0.20, 0.35, 0.30, 0.10])
    plan.analytical = pickWeeks(rng, n, allWeeks)
  }
  return plan
}

/**
 * 年初の「風邪で欠席」抽選。
 * 50% の確率で発生し、発生する場合は秋〜冬（週36-48）から1週ランダム選択。
 */
export function rollColdAbsence(rng: RNG): number | undefined {
  if (rng.next() >= 0.50) return undefined
  // 秋冬範囲（週36..48 = 9月〜2月相当）
  const lo = 36, hi = 48
  return lo + Math.floor(rng.next() * (hi - lo + 1))
}

/** マネージャー専用イベント状態の初期化（マネ加入時／年度切替時に呼ぶ）。 */
export function initManagerEventState(rng: RNG, trait: ManagerTrait, year: number): ManagerEventState {
  const plan = makeManagerEventPlan(rng, trait)
  const absentWeek = rollColdAbsence(rng)
  return { year, plan, caringFired: 0, coldUsed: false, absentWeek }
}
