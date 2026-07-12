// ============================================================
// data/combos.ts — コンボ（組み合わせ上位スキル・最上位レアリティUR=rarity4）
// 素材スキルを2つ揃えると自動発現する創発スキル。直接付与はしない（スカウト/ストーリーは素材を配るだけ）。
// 効果は「素材2つの合算 ＜ コンボ」＝必ずシナジー上乗せぶん強い。
//   - ability系コンボ: abilityBonus を実効能力に加算（applyMatchSkillBonuses）。
//   - logic系コンボ: possession.ts / atmosphere 側で combo id を参照して上乗せ。
// 素材にストーリー限定スキル（captaincy/big-game等）を含むコンボはスカウトでは発現しない
//   （スカウトは非ストーリー素材しか配らないため自動的に満たされる）。
// ============================================================

import type { Player } from '../engine/types'
import type { AbilityBonus } from './skills'

const has = (p: Player, id: string) => !!p.skills?.includes(id)

export interface ComboDef {
  id: string
  name: string
  desc: string
  components: string[]          // 構成（表示用）
  skillComponents: string[]      // 必要な素材スキルid（コンボ完成バイアス用。性格/能力条件は別途requires）
  requires: (p: Player) => boolean
  abilityBonus?: AbilityBonus    // ability系コンボのシナジー（実効能力へ加算）
}

export const COMBOS: ComboDef[] = [
  { id: 'setpiece-master', name: 'セットプレーマスター', desc: 'FKもCKも自在。セットプレーの精度がさらに跳ね上がる。', components: ['直接FK', 'CKキッカー'], skillComponents: ['free-kick', 'ck'], requires: (p) => has(p, 'free-kick') && has(p, 'ck') },
  { id: 'duel-king', name: 'デュエル王', desc: '球際で絶対に負けない。奪取とデュエルがさらに強い。', components: ['タックラー', 'スタミナ60↑'], skillComponents: ['tackler'], requires: (p) => has(p, 'tackler') && p.abilities.stamina >= 60, abilityBonus: { defense: 6, stamina: 4 } },
  { id: 'captain-spirit', name: '闘将', desc: '言葉と背中でチームを束ねる。雰囲気を大きく引き上げ、大一番で全員が伸びる。', components: ['キャプテンシー', '性格・リーダー'], skillComponents: ['captaincy'], requires: (p) => has(p, 'captaincy') && p.personality === 'leader' },
  { id: 'goal-poacher', name: '点取り屋', desc: '足でも頭でも決めきる。あらゆる形から得点を奪う。', components: ['決定力', 'ヘッダーの名手'], skillComponents: ['finisher', 'header'], requires: (p) => has(p, 'finisher') && has(p, 'header'), abilityBonus: { kick: 6, power: 4 } },
  { id: 'game-maker', name: 'ゲームメーカー', desc: '運ぶ・配る・創る。中盤を完全に支配する。', components: ['司令塔', 'ドリブラー'], skillComponents: ['playmaker', 'dribbler'], requires: (p) => has(p, 'playmaker') && has(p, 'dribbler'), abilityBonus: { iq: 5, technique: 5 } },
  { id: 'iron-wall', name: '鉄壁', desc: '最終ラインに鍵をかける。奪って・止めて・統率する。', components: ['守備の要', '球際の鬼'], skillComponents: ['anchor', 'press-master'], requires: (p) => has(p, 'anchor') && has(p, 'press-master'), abilityBonus: { defense: 6, iq: 4 } },
  { id: 'swift-wing', name: '快速の翼', desc: 'サイドを切り裂き、正確なクロスを供給する。', components: ['韋駄天', 'クロサー'], skillComponents: ['counter-ace', 'crosser'], requires: (p) => has(p, 'counter-ace') && has(p, 'crosser') },
  { id: 'tireless-engine', name: '不屈の機関車', desc: '90分間止まらない。終盤も走り負けず、過酷な練習にも耐える。', components: ['鉄人', 'スタミナお化け'], skillComponents: ['iron-body', 'stamina-king'], requires: (p) => has(p, 'iron-body') && has(p, 'stamina-king') },
  { id: 'great-keeper', name: '大守護神', desc: '枠内シュートもPKも立ちはだかる、最後の砦。', components: ['守護神', 'PKストッパー'], skillComponents: ['shot-stopper', 'pk-stopper'], requires: (p) => has(p, 'shot-stopper') && has(p, 'pk-stopper'), abilityBonus: { saving: 6, gkIq: 4 } },
  { id: 'clutch-master', name: '修羅場の支配者', desc: '負けられない一戦でこそ、チーム全員を覚醒させる。', components: ['大舞台の男', 'キャプテンシー'], skillComponents: ['big-game', 'captaincy'], requires: (p) => has(p, 'big-game') && has(p, 'captaincy') },
]

/**
 * 既存スキル集合から「あと1つで完成するコンボ」の不足素材スキルidを返す（複数あればランダム性のため全部）。
 * grantBiasable=trueなら、付与可能(grantable)な不足素材だけに絞る用途で呼び出し側がフィルタする。
 */
export function comboCompletionSkills(owned: Set<string>): string[] {
  const out: string[] = []
  for (const c of COMBOS) {
    const missing = c.skillComponents.filter((s) => !owned.has(s))
    const have = c.skillComponents.filter((s) => owned.has(s))
    if (missing.length === 1 && have.length >= 1) out.push(missing[0])
  }
  return out
}

export function activeCombos(p: Player): ComboDef[] {
  return COMBOS.filter((c) => c.requires(p))
}
export function hasCombo(p: Player, id: string): boolean {
  return COMBOS.find((c) => c.id === id)?.requires(p) ?? false
}
export function comboById(id: string): ComboDef | undefined {
  return COMBOS.find((c) => c.id === id)
}
/** チーム内にこのコンボ保持者がいるか（logic系コンボの試合判定用） */
export function teamHasCombo(starters: Player[], comboId: string): boolean {
  return starters.some((p) => hasCombo(p, comboId))
}
