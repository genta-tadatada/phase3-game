// ============================================================
// career/skillGrant.ts — 初期スキル付与・あたり性格抽選（#scout改修 Phase 2）
// スカウト/自然入部の選手に「素材スキル」を付与する。コンボ上位スキルは直接付与しない
//   （素材を2つ引き当てると別途自動発現する）。ストーリー限定スキルも付与対象外。
// ============================================================

import type { Personality, Player } from '../engine/types'
import type { RNG } from '../engine/rng'
import { SKILLS, SCOUT_GRANTABLE_SKILLS } from '../data/skills'
import { comboCompletionSkills } from '../data/combos'

const GRANTABLE_DEFS = SKILLS.filter((s) => SCOUT_GRANTABLE_SKILLS.includes(s.id))

export type SkillTier = 'elite' | 'scout' | 'intake'
// 各枠の連続確率（前の枠が当たらなければ以降の枠もなし）。
//   elite(トレセンバッジ等): 1個≈60% / 2個≈60×35≈21% / 3個≈21×20≈4%＝コンボの土台
//   scout(バッジ無し候補): 1個≈6%
//   intake(自然入部): 1個≈1.5%（最も低い）
const TIER_SLOTS: Record<SkillTier, number[]> = {
  elite: [0.60, 0.35, 0.20],
  scout: [0.06],
  intake: [0.015],
}

/** 既存スキルとコンボを組める付与可能・eligibleな素材を優先して1つ選ぶ（無ければランダム）。 */
function pickSkill(p: Player, owned: Set<string>, rng: RNG): string | null {
  const pool = GRANTABLE_DEFS.filter((s) => !owned.has(s.id) && s.eligible(p))
  if (pool.length === 0) return null
  // コンボ完成バイアス：あと1つでコンボになる素材があれば6割でそれを選ぶ（最上位報酬を出やすく）
  const completions = comboCompletionSkills(owned).filter((id) => pool.some((s) => s.id === id))
  if (completions.length > 0 && rng.chance(0.6)) return completions[Math.floor(rng.next() * completions.length)]
  return pool[Math.floor(rng.next() * pool.length)].id
}

/** 初期スキルを付与（p.skills を更新）。コンボは直接付与せず素材スキルから抽選。eligible・上限3。 */
export function grantStartingSkills(p: Player, rng: RNG, tier: SkillTier): void {
  const owned = new Set(p.skills ?? [])
  for (const chance of TIER_SLOTS[tier]) {
    if (owned.size >= 3) break
    if (!rng.chance(chance)) break
    const id = pickSkill(p, owned, rng)
    if (!id) break
    owned.add(id)
  }
  p.skills = [...owned]
}

const ATARI: Personality[] = ['leader', 'genius', 'fighter', 'hardworker']
const FUTSU: Personality[] = ['moodmaker', 'shy', 'hotblood', 'mypace']
const HAZURE: Personality[] = ['troublemaker', 'timid', 'egoist', 'lazy']

/** 優秀候補(バッジ持ち)専用の性格抽選＝あたり60% / ふつう10% / ハズレ30%。 */
export function pickBiasedPersonality(rng: RNG): Personality {
  const r = rng.next()
  const group = r < 0.6 ? ATARI : r < 0.7 ? FUTSU : HAZURE
  return group[Math.floor(rng.next() * group.length)]
}
