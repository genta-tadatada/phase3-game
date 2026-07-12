// ============================================================
// career/sponsor.ts — G-44 スポンサー詳細仕様
// 2枠（main/uniform）に契約。評判で候補解放・特殊2種は評判100/全国優勝で解放。
// 月額収入は economy.ts で年計算に組み込む。
// ============================================================

import type { CareerState } from './types'

export type SponsorSlot = 'main' | 'uniform'

/** 通常スポンサーの段階別月額表（万円・仮置き・Z-1で再点検）
 *  #72: 解放しきい値を緩めた（30→25, 50→45, 75→70）。最大tier100は据え置き。
 *  月額は据え置き（解放が早まる分だけ収益カーブも前倒し＝難易度緩和） */
const MONTHLY_TABLE: Record<number, [number, number, number]> = {
  10: [4, 6, 8],
  25: [7, 10, 13],
  45: [12, 16, 20],
  70: [17, 23, 29],
}

export type SponsorSpecialEffect =
  | { kind: 'growth' }       // 練習効率+5%
  | { kind: 'fatigue' }      // 疲労回復速度+10%
  | { kind: 'scoutRep' }     // スカウト評判補正+10
  | { kind: 'upgradeDisc' }  // 設備upgradeCost 15%割引

export interface SponsorDef {
  id: string
  name: string
  // 必要評判閾値（通常：10/25/45/70 / 特殊評判：100 / 優勝特殊：-1 で「全国優勝後解放」）
  // #72: 通常tierを30→25, 50→45, 75→70 に緩和。tier10は「大会初勝利後」でも解放（sponsorUnlocked参照）。
  tier: 10 | 25 | 45 | 70 | 100 | -1
  monthly: number   // 月額（万）
  months: 6 | 12 | 24 // 契約期間
  // 特殊スポンサーのみ持つ恩恵
  special?: SponsorSpecialEffect
}

export const SPONSORS: SponsorDef[] = [
  // 評判10（または大会初勝利）
  { id: 'sponsor-10-h', name: '地元商店連合（半年契約）', tier: 10, monthly: MONTHLY_TABLE[10][0], months: 6 },
  { id: 'sponsor-10-y', name: '町内会後援会（1年契約）', tier: 10, monthly: MONTHLY_TABLE[10][1], months: 12 },
  { id: 'sponsor-10-l', name: '保護者会連名（2年契約）', tier: 10, monthly: MONTHLY_TABLE[10][2], months: 24 },
  // 評判25
  { id: 'sponsor-30-h', name: '地元紙の広告枠（半年契約）', tier: 25, monthly: MONTHLY_TABLE[25][0], months: 6 },
  { id: 'sponsor-30-y', name: '地方銀行（1年契約）', tier: 25, monthly: MONTHLY_TABLE[25][1], months: 12 },
  { id: 'sponsor-30-l', name: '地元放送局（2年契約）', tier: 25, monthly: MONTHLY_TABLE[25][2], months: 24 },
  // 評判45
  { id: 'sponsor-50-h', name: '中堅製造メーカー（半年契約）', tier: 45, monthly: MONTHLY_TABLE[45][0], months: 6 },
  { id: 'sponsor-50-y', name: '広域スーパー（1年契約）', tier: 45, monthly: MONTHLY_TABLE[45][1], months: 12 },
  { id: 'sponsor-50-l', name: '地方自動車販社（2年契約）', tier: 45, monthly: MONTHLY_TABLE[45][2], months: 24 },
  // 評判70
  { id: 'sponsor-75-h', name: '広告代理店（半年契約）', tier: 70, monthly: MONTHLY_TABLE[70][0], months: 6 },
  { id: 'sponsor-75-y', name: '全国チェーン外食（1年契約）', tier: 70, monthly: MONTHLY_TABLE[70][1], months: 12 },
  { id: 'sponsor-75-l', name: '大手通信業者（2年契約）', tier: 70, monthly: MONTHLY_TABLE[70][2], months: 24 },
  // 特殊：評判100 (各1年契約)
  // Z-2: 月15→22 に引き上げ。旧設定だと tier75 通常(月29) より評判100特殊が低額になり、評判MAXで
  //   月収が下がる「逆インセンティブ」が発生していた。月22なら tier75-middle と tier75-long の間で
  //   通常スポンサーと並ぶ収入＋特殊効果の付加価値が両立。
  { id: 'sponsor-100-a', name: 'スポーツ用品メーカー', tier: 100, monthly: 22, months: 12, special: { kind: 'growth' } },
  { id: 'sponsor-100-b', name: '健康食品ブランド', tier: 100, monthly: 22, months: 12, special: { kind: 'fatigue' } },
  // 特殊：全国優勝 (各1年契約・tier=-1 で「優勝記録あり」判定)
  // Z-2: 建設会社は割引効果がメインのため月15のまま据え置き。全国放送ネット局は月20→25 に引き上げ
  //   （優勝後の到達報酬として tier75-long を上回る価値感を担保）。
  { id: 'sponsor-champ-a', name: '全国放送ネット局', tier: -1, monthly: 25, months: 12, special: { kind: 'scoutRep' } },
  { id: 'sponsor-champ-b', name: '建設会社', tier: -1, monthly: 15, months: 12, special: { kind: 'upgradeDisc' } },
]

/** スポンサー候補が解放されているか
 *  #72: tier10は「評判10 または 大会初勝利あり」のいずれかで解放（初心者ブースト）。 */
export function sponsorUnlocked(state: CareerState, def: SponsorDef): boolean {
  if (def.tier === -1) return (state.records.winterTitles + state.records.summerTitles) > 0
  if (def.tier === 100) return state.reputation >= 100
  if (def.tier === 10) return state.reputation >= 10 || (state.records.firstCompWinYear ?? 0) > 0
  return state.reputation >= def.tier
}

export interface SponsorContract {
  slot: SponsorSlot
  defId: string
  signedYear: number
  signedWeek: number
  // weeks 単位の残期間（months ×4 で換算）。0以下で自動解約。
  weeksLeft: number
}

/** 現在の契約から月額合計（万） */
export function activeSponsorMonthly(state: CareerState): number {
  const contracts = state.sponsorContracts ?? []
  return contracts.reduce((sum, c) => {
    const def = SPONSORS.find((s) => s.id === c.defId)
    return sum + (def?.monthly ?? 0)
  }, 0)
}

/** 設備割引が有効か（建設会社スポンサー在席時） */
export function sponsorUpgradeDiscount(state: CareerState): number {
  const contracts = state.sponsorContracts ?? []
  for (const c of contracts) {
    const def = SPONSORS.find((s) => s.id === c.defId)
    if (def?.special?.kind === 'upgradeDisc') return 0.15
  }
  return 0
}

/** スカウト評判補正（全国放送スポンサー） */
export function sponsorScoutRepBonus(state: CareerState): number {
  const contracts = state.sponsorContracts ?? []
  for (const c of contracts) {
    const def = SPONSORS.find((s) => s.id === c.defId)
    if (def?.special?.kind === 'scoutRep') return 10
  }
  return 0
}

/** 練習効率補正（スポーツ用品メーカー） */
export function sponsorGrowthBonus(state: CareerState): number {
  const contracts = state.sponsorContracts ?? []
  for (const c of contracts) {
    const def = SPONSORS.find((s) => s.id === c.defId)
    if (def?.special?.kind === 'growth') return 0.05
  }
  return 0
}

/** 疲労回復速度補正（健康食品） */
export function sponsorFatigueBonus(state: CareerState): number {
  const contracts = state.sponsorContracts ?? []
  for (const c of contracts) {
    const def = SPONSORS.find((s) => s.id === c.defId)
    if (def?.special?.kind === 'fatigue') return 0.10
  }
  return 0
}

/** 契約締結（スロット指定）。期間中変更不可＝既契約スロットへの締結は拒否（UI文言と一致させる） */
export function signSponsor(state: CareerState, slot: SponsorSlot, defId: string): CareerState {
  const def = SPONSORS.find((s) => s.id === defId)
  if (!def || !sponsorUnlocked(state, def)) return state
  const contracts = state.sponsorContracts ?? []
  if (contracts.some((c) => c.slot === slot)) return state
  const newContract: SponsorContract = {
    slot, defId, signedYear: state.year, signedWeek: state.week, weeksLeft: def.months * 4,
  }
  const slotName = slot === 'main' ? 'メイン' : 'ユニフォーム'
  return {
    ...state,
    sponsorContracts: [...contracts, newContract],
    log: [`${def.name}と契約（${slotName}枠・月${def.monthly}万・${def.months}ヶ月）`, ...state.log].slice(0, 40),
  }
}

/** 週進行: 残期間-1。期間切れは自動解約 */
export function tickSponsors(state: CareerState): CareerState {
  if (!state.sponsorContracts || state.sponsorContracts.length === 0) return state
  const next = state.sponsorContracts
    .map((c) => ({ ...c, weeksLeft: c.weeksLeft - 1 }))
    .filter((c) => c.weeksLeft > 0)
  return { ...state, sponsorContracts: next }
}
