// ============================================================
// career/economy.ts — 部活動の年間収支（高校サッカー部としてリアルな経営）
//
// 設計の科学的根拠（リサーチ反映）:
//  ・「意味のある選択」= 限られた資源をどこに使うかの緊張感（部員数↔運営費／設備↔貯蓄）。
//  ・「変動報酬」= 後援会・OB寄付に±変動を入れ、年度更新のたびに小さな期待と驚きを生む。
//  ・「進捗と長期目標」= 評判→寄付→賞金→設備→強化→評判 のフライホイール。出身プロが恒久収入に。
//  ・「収支(taps↔sinks)の均衡」= 収入源を分散し、部員数に比例する運営費というsinkで肥大を防ぐ。
//
// すべて高校サッカー部として現実的な費目（学校予算配分・部費・後援会/OB寄付・大会補助金 /
// 設備維持費・部員運営費）。固有名詞や実在制度の文言は使わず一般的な仕組みのみ採用＝権利問題なし。
// ============================================================

import type { CareerState, SeasonState } from './types'
import type { RNG } from '../engine/rng'
import { annualUpkeep, annualSalaries } from './facilities'
import { activeSponsorMonthly } from './sponsor'

export interface IncomeBreakdown {
  allocation: number  // 学校予算配分（評判で微増）
  fees: number        // 部費収入（部員数×・部員が多いほど増える）
  donations: number   // 後援会・OB寄付（評判＋出身プロ数＋変動）
  subsidy: number     // 大会出場補助金（県大会突破・全国出場・優勝で加算）
  sponsor: number     // G-44: スポンサー年間収入（active契約の月額合計×12）
  total: number
}

export interface ExpenseBreakdown {
  upkeep: number      // 設備維持費（設備Lvが上がるほど増える）
  operating: number   // 部員運営費（部員数×・用具/遠征/食費）
  salaries: number    // 専属スタッフの年俸（設備が上がり切っても続くお金の使い道）
  recruiting: number  // 勧誘費（特待・学費支援＋遠方の宿泊/寮費）
  total: number
}

export interface AnnualBudget {
  income: IncomeBreakdown
  expense: ExpenseBreakdown
  net: number              // 収入 − 支出
  deficit: boolean         // 支出が収入＋繰越を上回った（財政難）
}

/** 大会成績に応じた補助金（直近シーズン）。県突破・全国出場・優勝で段階加算。 */
export function seasonSubsidy(season: SeasonState): number {
  let s = 0
  const summerNational = season.summerBest != null     // 県予選突破＝全国出場
  const summerChamp = season.summerBest === 3
  if (summerNational) s += 50
  if (summerChamp) s += 60
  if (season.winterReachedNational) s += 90
  if (season.winterLabel === '全国優勝') s += 140
  return s
}

/** 年間収入の内訳を算出（donations は rng で±15%変動＝変動報酬）。 */
export function computeIncome(state: CareerState, rng: RNG): IncomeBreakdown {
  const roster = state.roster.length
  const rep = state.reputation
  const proAlumni = state.records.proAlumni.length

  const allocation = Math.round(150 + rep * 1.6)
  const fees = roster * 5
  // 後援会・OB寄付：評判と出身プロ数で増える長期報酬。±15%の変動で年ごとに揺らぐ。
  // 出身プロは逓減（13人目以降は寄与小）＋総額に上限を設け、終盤の青天井インフレを防ぐ。
  const proContrib = Math.min(proAlumni, 12) * 26 + Math.max(0, proAlumni - 12) * 7
  const donationBase = Math.min(rep * 2.2 + proContrib, 640)
  const variance = 0.85 + rng.next() * 0.30
  const donations = Math.round(donationBase * variance)
  // 大会補助金は大会終了時に「即時」支給するようにしたため、年度末はゼロ（二重払い防止）。
  const subsidy = 0
  // G-44: スポンサー年間収入＝アクティブ月額合計×12
  const sponsor = activeSponsorMonthly(state) * 12

  return { allocation, fees, donations, subsidy, sponsor, total: allocation + fees + donations + subsidy + sponsor }
}

/** 年間支出の内訳を算出（recruiting=今年度の勧誘費）。 */
export function computeExpense(state: CareerState, recruiting = 0): ExpenseBreakdown {
  const upkeep = annualUpkeep(state.facilities)
  // 部員運営費：用具・遠征・食費など。部員数が多いほど増える＝大所帯はコスト高（意味のある選択）。
  const operating = state.roster.length * 6
  const salaries = annualSalaries(state.staff)
  return { upkeep, operating, salaries, recruiting, total: upkeep + operating + salaries + recruiting }
}

/**
 * 年度の収支を確定し、新しい budget を返す。
 * 繰越＋収入−支出。マイナスなら 0 止まり＋財政難フラグ（呼び出し側で雰囲気ペナルティ）。
 */
export function settleAnnualBudget(state: CareerState, rng: RNG, recruiting = 0): { budget: number; report: AnnualBudget } {
  const income = computeIncome(state, rng)
  const expense = computeExpense(state, recruiting)
  const net = income.total - expense.total
  const raw = state.budget + net
  const deficit = raw < 0
  const budget = Math.max(0, raw)
  return { budget, report: { income, expense, net, deficit } }
}
