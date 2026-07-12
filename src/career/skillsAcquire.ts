// ============================================================
// career/skillsAcquire.ts — スキルの年度末取得（簡易版）
// 条件を満たす選手が低確率でスキルを習得。設備・性格で確率補正。
// ============================================================

import type { Player } from '../engine/types'
import type { RNG } from '../engine/rng'
import { SKILLS } from '../data/skills'
import { comboCompletionSkills } from '../data/combos'

export interface SkillGain { name: string; skill: string; id: string; grade: number; pos: string }

/** スキル取得を判定。新ロスターと取得リストを返す。probMult で合宿(高)・通常(低)を調整。
 *  特殊能力は主に「夏合宿」で習得する＝合宿の意味（#29/#34）。 */
export function acquireSkills(
  roster: Player[], trainingLv: number, rng: RNG, probMult = 1,
): { roster: Player[]; gains: SkillGain[] } {
  const gains: SkillGain[] = []
  const next = roster.map((orig) => {
    const owned = orig.skills ?? []
    // 1人が習得できるスキルは最大3つまで（盛りすぎ防止）
    if (owned.length >= 3) return orig
    // 努力家・天才肌は習得しやすい / 設備が高いと習得しやすい
    const persBonus = orig.personality === 'hardworker' || orig.personality === 'genius' ? 1.6 : 1.0
    const facBonus = 1 + (trainingLv - 1) * 0.25
    const completions = comboCompletionSkills(new Set(owned)) // あと1つでコンボになる素材
    let added: string | null = null
    for (const sk of SKILLS) {
      if (owned.includes(sk.id)) continue
      if (!sk.eligible(orig)) continue
      // コンボ完成素材は習得確率を大きく上げる（最上位報酬を出やすく）
      const comboMult = completions.includes(sk.id) ? 3.5 : 1
      const prob = 0.06 * persBonus * facBonus * probMult * comboMult
      if (rng.next() < prob) { added = sk.id; break }
    }
    if (!added) return orig
    gains.push({ name: orig.name, skill: SKILLS.find((s) => s.id === added)!.name, id: added, grade: orig.grade, pos: orig.slot ?? orig.position })
    return { ...orig, skills: [...owned, added] }
  })
  return { roster: next, gains }
}

// ============================================================
// 合宿のスキル取得（#34）— 「運による習得数」をまず決め、その目標数まで付与する。
//   1個   = 最低保証（不作の年）
//   2〜3個 = 平均的な年（最も多い）
//   4個   = 運のいい年
//   5個   = 約5年に1回
//   6〜7個 = 10年に1回を超える稀少（上限7）
// 実際の付与は適性(eligible)・1人上限3で頭打ちになるため、これは「運の上限」。
// ============================================================
const CAMP_COUNT_CUM: { n: number; p: number }[] = [
  { n: 1, p: 0.10 }, // 最低保証
  { n: 2, p: 0.38 }, // 平均
  { n: 3, p: 0.62 }, // 平均
  { n: 4, p: 0.79 }, // 運のいい年
  { n: 5, p: 0.95 }, // ≈5年に1回
  { n: 6, p: 0.99 }, // 10年に1回超
  { n: 7, p: 1.00 }, // 上限
]

/** その年の合宿で「狙える」スキル習得数を運で決める（1〜7）。 */
export function campSkillCount(rng: RNG): number {
  const r = rng.next()
  for (const c of CAMP_COUNT_CUM) if (r < c.p) return c.n
  return 7
}

// レア度ごとの抽選重み（コモンほど出やすい）。
const RARITY_WEIGHT: Record<number, number> = { 1: 6, 2: 3, 3: 1 }

/** 合宿で target 個を目標にスキルを付与する。適性者・上限3で頭打ち。
 *  レア度の低いものが出やすく、レアは稀。誰がどのスキルを得たかを gains で返す。 */
export function grantCampSkills(
  roster: Player[], target: number, rng: RNG,
): { roster: Player[]; gains: SkillGain[] } {
  const owned = new Map<string, string[]>() // playerId -> skills(可変)
  for (const p of roster) owned.set(p.id, [...(p.skills ?? [])])
  const gains: SkillGain[] = []

  for (let i = 0; i < target; i++) {
    // (player, skill) の付与候補を全列挙し、レア度の重みで1つ抽選する。
    const cands: { pid: string; sid: string; name: string; skill: string; id: string; grade: number; pos: string; w: number }[] = []
    for (const p of roster) {
      const have = owned.get(p.id)!
      if (have.length >= 3) continue
      const completions = comboCompletionSkills(new Set(have)) // あと1つでコンボになる素材
      for (const sk of SKILLS) {
        if (have.includes(sk.id)) continue
        if (!sk.eligible(p)) continue
        // コンボ完成素材は重みを上げて、コンボが自然に発現しやすくする
        const w = (RARITY_WEIGHT[sk.rarity] ?? 1) * (completions.includes(sk.id) ? 4 : 1)
        cands.push({ pid: p.id, sid: sk.id, name: p.name, skill: sk.name, id: sk.id, grade: p.grade, pos: p.slot ?? p.position, w })
      }
    }
    if (cands.length === 0) break // これ以上付与できる相手がいない＝運の上限に達せず打ち切り
    const totalW = cands.reduce((s, c) => s + c.w, 0)
    let r = rng.next() * totalW
    let pick = cands[cands.length - 1]
    for (const c of cands) { if (r < c.w) { pick = c; break } r -= c.w }
    owned.get(pick.pid)!.push(pick.sid)
    gains.push({ name: pick.name, skill: pick.skill, id: pick.id, grade: pick.grade, pos: pick.pos })
  }

  const next = roster.map((p) => {
    const sk = owned.get(p.id)!
    return sk.length === (p.skills?.length ?? 0) ? p : { ...p, skills: sk }
  })
  return { roster: next, gains }
}
