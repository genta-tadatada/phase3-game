// ============================================================
// career/graduation.ts — 卒業と進路（補完R-2・情緒/リテンションの核）
// 3年生の最終能力から進路を決定。稀にプロ入り＝育成の最大の報酬。
// 出身プロは評判を恒久的に押し上げる（評判4要素の1つ）。
// ============================================================

import type { Player } from '../engine/types'
import type { RNG } from '../engine/rng'
import { playerOverallSum } from '../engine/match/teamQuality'
import { type Destiny, type GraduateResult, isProDestiny } from './types'

const GENERAL_PATHS = ['地元企業に就職', '消防士を目指す', '体育教員を志す', '公務員試験へ', '家業を継ぐ', '一般大学へ進学']

/**
 * #53 進路ラダー（能力値が第一決定要因・運は微補正・全名称架空）。
 *  海外プロ→プロ1部→プロ2部→プロ3部→社会人/大学強豪→一般大学→競技引退。
 *  proBonus＝今季の全国大会実績／代表歴＝早期シグナル。両者でプロ確率と階層が上振れる。
 *  高卒直接プロは現実でも稀＝代表候補レベル(tier8 ≥630)が主戦場、全国上位(tier7 ≥583)が稀に滑り込む。
 */
function destinyFor(player: Player, rng: RNG, proBonus: number): { destiny: Destiny; label: string } {
  const sum = playerOverallSum(player)
  const ach = proBonus + (player.nationalRep ? 0.12 : 0) // 全国実績＋代表歴の上振れ（0〜0.26）

  // --- プロの道（tier7以上が挑戦圏・能力が主／実績で確率と階層が上がる） ---
  if (sum >= 583) {
    const base = sum >= 640 ? 0.72 : sum >= 613 ? 0.42 : sum >= 600 ? 0.16 : 0.06
    const proChance = Math.min(0.93, base + ach)
    if (rng.next() < proChance) {
      // どの階層か：能力＋実績で決定（運は±10の微補正）。
      const grade = sum + ach * 90 + (rng.next() - 0.5) * 20
      if (grade >= 672) return { destiny: 'pro-overseas', label: '海外プロ内定' }
      if (grade >= 642) return { destiny: 'pro-d1', label: 'プロ内定（1部）' }
      if (grade >= 614) return { destiny: 'pro-d2', label: 'プロ内定（2部）' }
      return { destiny: 'pro-d3', label: 'プロ内定（3部）' }
    }
    // プロを掴めなかった代表候補/全国上位は強豪の社会人・大学へ（下の分岐へ流れる）。
  }
  // --- 非プロの道（能力で決定的・運の余地は小） ---
  if (sum >= 513) return { destiny: 'semi-pro', label: rng.chance(0.5) ? '社会人サッカー（強豪）' : '大学サッカー（強豪・推薦）' } // 全国〜全国上位
  if (sum >= 350) return { destiny: 'univ-soccer', label: '大学サッカー（一般）' } // 県上位〜都道府県
  return { destiny: 'retire', label: `競技引退（${rng.pick(GENERAL_PATHS)}）` } // 市区町村以下
}

export interface GraduationOutcome {
  results: GraduateResult[]
  proCount: number
  repGain: number
  proNames: string[]
}

/** 卒業生の進路を決定し、評判への寄与を算出。proBonus=今季の全国大会実績によるプロ化ボーナス。 */
export function processGraduation(graduating: Player[], rng: RNG, proBonus = 0): GraduationOutcome {
  const results: GraduateResult[] = []
  let proCount = 0
  const proNames: string[] = []

  for (const p of graduating) {
    const { destiny, label } = destinyFor(p, rng, proBonus)
    results.push({ name: p.name, position: p.position, destiny, destinyLabel: label, overall: playerOverallSum(p) })
    if (isProDestiny(destiny)) { proCount++; proNames.push(p.name) }
  }
  // プロ輩出は評判を恒久的に押し上げる（出身プロ数＝評判要素）
  const repGain = proCount * 8
  return { results, proCount, repGain, proNames }
}

/** 卒業式のナラティブ文を生成 */
export function graduationNarrative(out: GraduationOutcome, schoolName: string): string {
  if (out.results.length === 0) return ''
  const proLine = out.proCount > 0
    ? `そして——${out.proNames.join('、')}がプロの世界へ。${schoolName}から、夢を掴む者が出た。`
    : '全員がそれぞれの道へ進んでいった。'
  return `${out.results.length}人の3年生が卒業。${proLine}`
}
