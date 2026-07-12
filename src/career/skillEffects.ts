// ============================================================
// career/skillEffects.ts — スキル/コンボの「能力値化」適用（Phase 3）
// 能力値化スキル(SKILL_ABILITY_BONUS)と ability系コンボのシナジーを、試合計算用の実効能力へ加算する。
// 基礎能力は表示max99のまま／実効値は EFFECTIVE_CAP(150) まで許容＝ボーナスが頭打ちにならない。
// ============================================================

import type { Player } from '../engine/types'
import { SKILL_ABILITY_BONUS, EFFECTIVE_CAP, type AbilityBonus } from '../data/skills'
import { activeCombos } from '../data/combos'

const ABILITY_KEYS = ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense'] as const

/** 試合用：能力値化スキル＋ability系コンボのシナジーを実効能力に加算（上限150）。スキル無しならそのまま返す。 */
export function applyMatchSkillBonuses(p: Player): Player {
  const bonus: Record<string, number> = {}
  const add = (b: AbilityBonus) => { for (const k in b) bonus[k] = (bonus[k] ?? 0) + (b as Record<string, number>)[k] }
  for (const id of p.skills ?? []) { if (SKILL_ABILITY_BONUS[id]) add(SKILL_ABILITY_BONUS[id]) }
  for (const c of activeCombos(p)) { if (c.abilityBonus) add(c.abilityBonus) }
  if (Object.keys(bonus).length === 0) return p
  const cap = (v: number) => Math.min(EFFECTIVE_CAP, v)
  const abilities = { ...p.abilities }
  for (const k of ABILITY_KEYS) { if (bonus[k]) abilities[k] = cap(abilities[k] + bonus[k]) }
  let gk = p.gk
  if (gk && (bonus.saving || bonus.gkIq)) {
    gk = { ...gk, saving: cap(gk.saving + (bonus.saving ?? 0)), gkIq: cap(gk.gkIq + (bonus.gkIq ?? 0)) }
  }
  return { ...p, abilities, gk }
}
