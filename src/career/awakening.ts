// ============================================================
// career/awakening.ts — 下位チーム選手の覚醒（隠れた力の開花）
// B/C所属で腐らず努力する性格ほど開花しやすい。まだ伸びしろがある選手が
// 良い下位チーム環境で稀に覚醒し、能力が一気に伸びる。育成への報酬＝
// 「才能(潜在)」が無くても、努力と環境と運で誰でもプロを狙える道。
// ============================================================

import type { Personality, Player } from '../engine/types'
import type { RNG } from '../engine/rng'

export interface Awakening { name: string; gain: number }

// 性格別の覚醒しやすさ（怠け者は腐る＝ほぼ0・努力家/闘志家は高い）
const PERSONALITY_FACTOR: Record<Personality, number> = {
  hardworker: 1.0,  // 腐らず努力
  fighter: 0.95,    // 見返してやる
  genius: 0.8,      // 眠れる力
  hotblood: 0.55,
  leader: 0.5, shy: 0.45, moodmaker: 0.4, egoist: 0.4,
  timid: 0.35, mypace: 0.3, troublemaker: 0.3, // 問題児は稀に番狂わせ的
  lazy: 0.05,       // 腐る
}

function maxAbility(p: Player): number {
  return Math.max(
    p.abilities.kick, p.abilities.power, p.abilities.speed, p.abilities.technique,
    p.abilities.stamina, p.abilities.iq, p.abilities.defense,
    p.gk?.saving ?? 0, p.gk?.gkIq ?? 0,
  )
}

/**
 * B/Cチームの選手を対象に覚醒を判定（年度末）。
 * @param atmosphereB B/Cチームの雰囲気
 */
export function evaluateAwakening(
  roster: Player[], atmosphereB: number, rng: RNG,
): { roster: Player[]; awakenings: Awakening[] } {
  const awakenings: Awakening[] = []
  const atmoFactor = Math.max(0.4, Math.min(1.4, atmosphereB / 55))

  const next = roster.map((orig) => {
    const sq = orig.squad ?? 'A'
    if (sq === 'A' || orig.awakened) return orig            // A定着済・覚醒済は対象外
    const pf = PERSONALITY_FACTOR[orig.personality]
    // まだ伸びしろがある（現能力が低め）ほど開花が劇的に起こりやすい
    const headroom = Math.max(0, 80 - maxAbility(orig))
    const headFactor = Math.max(0.5, Math.min(1.8, headroom / 22))
    const prob = Math.min(0.30, 0.15 * pf * headFactor * atmoFactor)
    if (rng.next() >= prob) return orig

    // 覚醒！ 数能力が一気にジャンプ（育成への報酬・運でプロを狙える）
    const p: Player = {
      ...orig,
      abilities: { ...orig.abilities },
      gk: orig.gk ? { ...orig.gk } : null,
      awakened: true,
    }
    const keys: (keyof Player['abilities'])[] = ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense']
    let gain = 0
    for (let i = 0; i < 4; i++) {
      const k = rng.pick(keys)
      const before = p.abilities[k]
      p.abilities[k] = Math.min(99, before + rng.int(4, 11))
      gain += p.abilities[k] - before
    }
    if (p.gk) {
      const before = p.gk.saving
      p.gk.saving = Math.min(99, before + rng.int(3, 9))
      gain += p.gk.saving - before
    }
    awakenings.push({ name: p.name, gain: Math.round(gain) })
    return p
  })

  return { roster: next, awakenings }
}
