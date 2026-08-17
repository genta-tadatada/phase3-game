// ============================================================
// career/climaxSkills.ts — 物語の山場で掴む特殊能力（#34）
// 合宿がメイン源だが、卒業・大会・セレクションの節目でも「1個ずつ誰かに」開花する。
//   ・卒業：引退する先輩のスキルを後輩が継承／新キャプテンがキャプテンシーに目覚める
//   ・大会：優勝/全国の手応えで、立役者が新しい武器を掴む
//   ・セレクション：入部後の特訓で「コツを掴んだ」
// ============================================================

import type { Player } from '../engine/types'
import type { RNG } from '../engine/rng'
import { SKILLS } from '../data/skills'
import { comboCompletionSkills } from '../data/combos'

const RARITY_WEIGHT: Record<number, number> = { 1: 6, 2: 3, 3: 1 }

function addSkill(roster: Player[], id: string, skillId: string): Player[] {
  return roster.map((p) => p.id === id ? { ...p, skills: [...(p.skills ?? []), skillId] } : p)
}

/** 卒業時の継承：引退する先輩が持つスキルを、残る後輩1人へ伝授（同ポジ優先・継承はeligible不問・上限3）。 */
export function inheritFromGraduates(roster: Player[], graduating: Player[], rng: RNG): { roster: Player[]; text: string | null } {
  const mentors = graduating.filter((p) => (p.skills?.length ?? 0) > 0)
  if (mentors.length === 0) return { roster, text: null }
  const mentor = mentors[Math.floor(rng.next() * mentors.length)]
  const skillId = mentor.skills![Math.floor(rng.next() * mentor.skills!.length)]
  const cands = roster.filter((p) => !p.retired && (p.skills?.length ?? 0) < 3 && !(p.skills ?? []).includes(skillId))
  if (cands.length === 0) return { roster, text: null }
  const samePos = cands.filter((p) => p.position === mentor.position)
  const pool = samePos.length > 0 ? samePos : cands
  const heir = pool[Math.floor(rng.next() * pool.length)]
  const skillName = SKILLS.find((s) => s.id === skillId)?.name ?? skillId
  return { roster: addSkill(roster, heir.id, skillId), text: `卒業までの最後の数日、${mentor.name}は${heir.name}を居残りに付き合わせた。毎日、暗くなるまで二人きりで。\n「${skillName}」は、そのまま${heir.name}のものになった。` }
}

/**
 * #47: 新キャプテン就任イベント。毎年50%でキャプテンシー固定だったのを「重み付き抽選」に。
 * isCaptain優先、無ければ最上級生で最もIQの高い者が腕章を巻き、就任の物語が必ず1つ起きる。
 *   👑キャプテンシー(低) / 🧑‍🏫兄貴肌(低中) / 🔥本人成長(中) / 😊雰囲気↑(中) / 📖物語のみ(中)
 * atmoDelta を返すことがある（engine側で雰囲気に反映）。
 */
export function newCaptainGainsCaptaincy(roster: Player[], rng: RNG): { roster: Player[]; text: string | null; atmoDelta?: number } {
  const active = roster.filter((p) => !p.retired)
  const captain = active.find((p) => p.isCaptain)
    ?? active.filter((p) => p.grade >= 2).sort((a, b) => b.abilities.iq - a.abilities.iq)[0]
  if (!captain) return { roster, text: null }

  const has = (id: string) => (captain.skills ?? []).includes(id)
  const slotFree = (captain.skills?.length ?? 0) < 3
  const skillEligible = (id: string) => { const s = SKILLS.find((sk) => sk.id === id); return !!s && s.eligible(captain) }

  type Opt = { w: number; apply: () => { roster: Player[]; text: string; atmoDelta?: number } }
  const opts: Opt[] = []
  if (slotFree && !has('captaincy') && skillEligible('captaincy')) {
    opts.push({ w: 2, apply: () => ({ roster: addSkill(roster, captain.id, 'captaincy'), text: `新たに主将となった${captain.name}が、チームを背負う覚悟を決めた。「キャプテンシー」が芽生えた！` }) })
  }
  if (slotFree && !has('mentor') && skillEligible('mentor')) {
    opts.push({ w: 3, apply: () => ({ roster: addSkill(roster, captain.id, 'mentor'), text: `主将になった${captain.name}が、後輩の面倒をよく見るようになった。最上級生らしい「兄貴肌」が芽生えた。` }) })
  }
  // 🔥 本人成長（重圧が人を大きくする）
  opts.push({ w: 4, apply: () => ({
    roster: roster.map((p) => p.id === captain.id
      ? { ...p, abilities: { ...p.abilities, iq: Math.min(99, p.abilities.iq + 3), stamina: Math.min(99, p.abilities.stamina + 2) } }
      : p),
    text: `主将の重圧が${captain.name}を一回り大きくした。視野と粘り強さが増している。`,
  }) })
  // 😊 雰囲気↑
  opts.push({ w: 4, apply: () => ({ roster, text: `${captain.name}を中心に、新チームがひとつにまとまり始めた。練習の空気が引き締まる。`, atmoDelta: 4 }) })
  // 📖 物語のみ
  opts.push({ w: 4, apply: () => ({ roster, text: `${captain.name}が静かに腕章を巻いた。新チームの船出だ。` }) })

  const tot = opts.reduce((s, o) => s + o.w, 0)
  let r = rng.next() * tot
  let pick = opts[opts.length - 1]
  for (const o of opts) { if (r < o.w) { pick = o; break } r -= o.w }
  return pick.apply()
}

/** 山場で1個付与（大会/セレクション）。rarity重み・eligible・上限3。preferIdがいればその選手を優先。 */
export function grantClimaxSkill(roster: Player[], rng: RNG, preferId?: string): { roster: Player[]; name: string; skill: string } | null {
  const build = (p: Player | undefined) => {
    if (!p || p.retired) return []
    const completions = comboCompletionSkills(new Set(p.skills ?? [])) // あと1つでコンボになる素材
    return SKILLS.filter((sk) => !(p.skills ?? []).includes(sk.id) && (p.skills?.length ?? 0) < 3 && sk.eligible(p))
      .map((sk) => ({ p, sk, w: (RARITY_WEIGHT[sk.rarity] ?? 1) * (completions.includes(sk.id) ? 4 : 1) }))
  }
  let cands = preferId ? build(roster.find((p) => p.id === preferId)) : []
  if (cands.length === 0) cands = roster.filter((p) => !p.retired).flatMap((p) => build(p))
  if (cands.length === 0) return null
  const tot = cands.reduce((s, c) => s + c.w, 0)
  let r = rng.next() * tot
  let pick = cands[cands.length - 1]
  for (const c of cands) { if (r < c.w) { pick = c; break } r -= c.w }
  return { roster: addSkill(roster, pick.p.id, pick.sk.id), name: pick.p.name, skill: pick.sk.name }
}
