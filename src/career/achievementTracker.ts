// ============================================================
// career/achievementTracker.ts — 実績の判定と解禁（account永続へ）
// finishCompMatch から呼ぶ。大会結果＋ロスターの育成到達度をスキャンして解禁する。
// ============================================================

import type { CareerState } from './types'
import { unlockAchievement } from '../lib/account'
import { playerLevelSum } from '../engine/match/teamQuality'
import { overallLabel } from '../lib/labels'
import { activeCombos } from '../data/combos'
import { prefDifficulty } from '../data/schoolLedger'

export interface CompAchInput {
  stage: 'qualify' | 'national'
  kind: 'summer' | 'winter'
  placement: number // 0..3（3=優勝/準優勝=2/ベスト4=1）
  qualifiedNational: boolean
  prevQualifyChampYear?: number // この大会(kind)の前回県制覇年（連覇判定用）
}

/** 大会結果＋育成到達度から実績を解禁。新規解禁した実績idの配列を返す（通知用）。 */
export function checkAchievements(career: CareerState, comp: CompAchInput): string[] {
  const got: string[] = []
  const u = (id: string) => { if (unlockAchievement(id)) got.push(id) }

  // --- 大会 ---
  if (comp.qualifiedNational) u('national-entry')
  if (comp.stage === 'qualify' && comp.placement === 3) {
    u('pref-champ')
    if (prefDifficulty(career.prefecture) === 'hard') u('hard-pref-champ')
    // G-11: prevQualifyChampYear は未制覇だと 0（sentinel）。1年目は year-1=0 となり 0===0 で誤発火していた。
    //       0/undefined を falsy で弾き、実際に前年(=year-1)制覇したときだけ2連覇を認定する。
    if (comp.prevQualifyChampYear && comp.prevQualifyChampYear === career.year - 1) u('pref-2peat') // 県予選2連覇
  }
  if (comp.stage === 'national') {
    if (comp.placement >= 1) u('national-best4')
    if (comp.placement >= 2) u('national-runnerup')
    if (comp.placement === 3) {
      u('national-champ')
      // 連覇の厳密判定: natTitleYears に当年が加算済＝前年/前々年も優勝なら連覇。
      const years = career.natTitleYears ?? []
      if (years.includes(career.year - 1)) u('national-2peat') // 2連覇
      if (years.includes(career.year - 1) && years.includes(career.year - 2)) u('national-3peat') // 3連覇
    }
  }

  // --- 人材（教え子） ---
  const active = career.roster.filter((p) => !p.retired)
  if (active.some((p) => p.nationalRep)) u('national-rep')
  if ((career.records.proAlumni?.length ?? 0) >= 1) u('pro-1')
  if ((career.records.proAlumni?.length ?? 0) >= 10) u('pro-10')

  // --- 育成到達度（レベル段階・UR） ---
  if (active.some((p) => activeCombos(p).length > 0)) u('ur-skill')
  for (const p of active) {
    const tier = overallLabel(playerLevelSum(p), 'player').tier
    if (tier >= 9) u('gem')
    if (tier >= 10) u('treasure')
  }
  // チーム（先発11のレベル平均）の格
  const a11 = active.filter((p) => (p.squad ?? 'A') === 'A').slice(0, 11)
  if (a11.length >= 11) {
    const teamSum = a11.reduce((s, p) => s + playerLevelSum(p), 0) / a11.length
    const teamTier = overallLabel(teamSum, 'school').tier
    if (teamTier >= 9) u('gen-historic')
    if (teamTier >= 10) u('gen-legend')
  }

  return got
}
