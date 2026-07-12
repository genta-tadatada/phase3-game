// ============================================================
// data/skills.ts — 特殊能力（スキル・補完2.11）
// 取得は年度末に関連能力の閾値で低確率付与（簡易版）。
// 試合効果はエッジケース（PK・セットプレー・雰囲気）に限定し、
// 基本スコアバランス（1.2〜1.5）に影響しない設計。
// ============================================================

import type { Abilities, Player } from '../engine/types'

export interface SkillDef {
  id: string
  name: string
  desc: string
  /** レア度 1=コモン / 2=アンコモン / 3=レア（複数能力の組合せ条件＝出にくい・効果が大きい） */
  rarity: 1 | 2 | 3
  /** この選手がこのスキルの取得条件を満たすか */
  eligible: (p: Player) => boolean
}

const isAttacker = (p: Player) => !p.isGK && (p.position === 'CF' || p.position === 'WF' || p.position === 'AM')

// レア度の運用方針（#34）：
//   コモン(1) … 単一能力が一定以上で習得しうる。出やすい。
//   アンコモン(2) … やや高い能力 or 限定ポジション。
//   レア(3) … 「複数能力の組合せ」が条件＝持つ選手が稀。効果も大きい。
// #scout改修: 取得条件を従来の約半分に大幅緩和（スキルを広く行き渡らせる＝スカウト初期付与/ストーリー付与の土台）。
// ポジション/GK/学年の条件は維持し、能力しきい値のみ半減。
export const SKILLS: SkillDef[] = [
  { id: 'ck', name: 'CKキッカー', desc: 'コーナーキックの精度UP', rarity: 1, eligible: (p) => !p.isGK && p.abilities.kick >= 35 },
  { id: 'tackler', name: 'タックラー', desc: 'デュエルの勝率UP', rarity: 1, eligible: (p) => !p.isGK && p.abilities.defense >= 36 },
  { id: 'free-kick', name: '直接FK', desc: 'FK時の得点率が上がる', rarity: 2, eligible: (p) => isAttacker(p) && p.abilities.kick >= 36 },
  { id: 'pk-stopper', name: 'PKストッパー', desc: 'PK阻止率UP（GK）', rarity: 2, eligible: (p) => p.isGK && (p.gk?.saving ?? 0) >= 35 },
  { id: 'crosser', name: 'クロサー', desc: 'サイドからのクロス精度UP', rarity: 2, eligible: (p) => !p.isGK && p.abilities.kick >= 34 && p.abilities.speed >= 34 },
  { id: 'pk', name: 'PKキッカー', desc: 'PK成功率UP', rarity: 3, eligible: (p) => !p.isGK && p.abilities.kick >= 37 && p.abilities.technique >= 33 },
  { id: 'captaincy', name: 'キャプテンシー', desc: 'チームの雰囲気を底上げ', rarity: 3, eligible: (p) => p.abilities.iq >= 36 && p.abilities.stamina >= 30 },

  // --- 育成・チーム運営系（試合スコアバランスに影響しない＝安全に種類を増やせる）。#34 ---
  // 効果は growth.ts / engine.ts / possession(live) で配線。多くは取得条件が低め＝合宿序盤から開花しうる。
  { id: 'spark', name: '闘志', desc: '試合で得るものが大きい（実戦成長UP）', rarity: 1, eligible: (p) => p.abilities.power >= 28 },
  { id: 'quick-heal', name: '回復体質', desc: '毎週、疲労が余分に抜ける', rarity: 1, eligible: (p) => p.abilities.stamina >= 29 },
  { id: 'hard-trainer', name: '練習の鬼', desc: '練習での成長が伸びやすい', rarity: 2, eligible: (p) => p.abilities.iq >= 25 && p.abilities.stamina >= 28 },
  { id: 'iron-body', name: '鉄人', desc: '練習で疲れにくい（タフ）', rarity: 2, eligible: (p) => p.abilities.stamina >= 35 && p.abilities.power >= 29 },
  { id: 'mood-maker', name: 'ムードメーカー', desc: '在籍するとチームの雰囲気が上向きやすい', rarity: 2, eligible: (p) => p.abilities.iq >= 27 },
  { id: 'early-bird', name: '早熟', desc: '低学年のうちに大きく伸びる', rarity: 2, eligible: (p) => p.abilities.technique >= 26 && p.abilities.speed >= 28 },
  { id: 'stamina-king', name: 'スタミナお化け', desc: '試合終盤も運動量が落ちない', rarity: 2, eligible: (p) => p.abilities.stamina >= 40 },
  { id: 'late-bloomer', name: '大器晩成', desc: '最終学年で一気に伸びる', rarity: 3, eligible: (p) => p.abilities.technique >= 29 && p.abilities.iq >= 29 },
  { id: 'mentor', name: '兄貴肌', desc: '最上級生として、チーム全体の雰囲気を支える', rarity: 3, eligible: (p) => p.grade >= 3 && p.abilities.iq >= 32 },

  // --- 試合（オープンプレー）系（#9）。効果は小さめ＝持っていると局面で少し有利。
  // バランス基準テストはスキル無しチームなので互角1.2-1.5は不変。配線は possession.ts。 ---
  { id: 'finisher', name: '決定力', desc: 'シュートの精度が上がり、決めきる', rarity: 2, eligible: (p) => isAttacker(p) && p.abilities.kick >= 35 },
  { id: 'dribbler', name: 'ドリブラー', desc: '仕掛けて相手を抜き、前進しやすい', rarity: 2, eligible: (p) => !p.isGK && p.abilities.technique >= 36 && p.abilities.speed >= 32 },
  { id: 'counter-ace', name: '韋駄天', desc: 'カウンター（速攻）で違いを生む', rarity: 2, eligible: (p) => !p.isGK && p.abilities.speed >= 39 },
  { id: 'header', name: 'ヘッダーの名手', desc: 'セットプレーの空中戦に強い', rarity: 2, eligible: (p) => !p.isGK && p.abilities.power >= 36 },
  { id: 'press-master', name: '球際の鬼', desc: '高い位置でボールを奪い返す', rarity: 2, eligible: (p) => !p.isGK && p.abilities.defense >= 34 && p.abilities.stamina >= 35 },
  { id: 'playmaker', name: '司令塔', desc: '中盤を支配し好機を演出する', rarity: 3, eligible: (p) => !p.isGK && p.abilities.iq >= 37 && p.abilities.technique >= 35 },
  { id: 'anchor', name: '守備の要', desc: '最終ラインを統率し、守備を安定させる', rarity: 3, eligible: (p) => !p.isGK && p.abilities.defense >= 37 && p.abilities.iq >= 32 },
  { id: 'shot-stopper', name: '守護神', desc: 'シュートを止める力が際立つ（GK）', rarity: 3, eligible: (p) => p.isGK && (p.gk?.saving ?? 0) >= 36 && (p.gk?.gkIq ?? 0) >= 32 },
  { id: 'big-game', name: '大舞台の男', desc: '大一番（全国の大舞台）でこそ力を発揮', rarity: 3, eligible: (p) => p.abilities.iq >= 35 && p.abilities.stamina >= 30 },
]

export function skillName(id: string): string {
  return SKILLS.find((s) => s.id === id)?.name ?? id
}

export function skillById(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id)
}

// === スキル分類（#scout改修） ===
// ストーリー限定＝スカウト/自然入部の初期付与では付かない（試合経験・就任・覚醒など物語で得る）。
export const STORY_ONLY_SKILLS: readonly string[] = ['spark', 'hard-trainer', 'late-bloomer', 'mood-maker', 'mentor', 'big-game', 'captaincy']
export function isStorySkill(id: string): boolean { return STORY_ONLY_SKILLS.includes(id) }
/** スカウト/初期で付与してよいスキル（ストーリー限定を除く全て） */
export const SCOUT_GRANTABLE_SKILLS: string[] = SKILLS.map((s) => s.id).filter((id) => !isStorySkill(id))

// === Phase 3: 能力値化スキル（常時効果＝試合計算時に実効能力へ加算して再現） ===
// プレースキック系/時間帯系/雰囲気系/成長系は「状況依存」なので possession.ts にロジックのまま残す。
// ここに載るスキルは possession.ts の個別倍率を撤去し、実効能力へ加算（上限 EFFECTIVE_CAP）して再現する。
export type AbilityBonus = Partial<Record<keyof Abilities | 'saving' | 'gkIq', number>>
export const EFFECTIVE_CAP = 150 // 基礎能力は表示max99／試合計算の実効値はここまで許容（スキルボーナスの頭打ち回避）
// 各スキルの能力ボーナス合計＝そのスキルのレア度レベル換算値(C8/R14/SR20)に一致させる
//   ＝レベル表示と試合での実強さが食い違わない（バランス調整もレア度の数字で管理できる）。
//   finisher(R)=14 / dribbler(R)=14 / tackler(C)=8 / anchor(SR)=20 / playmaker(SR)=20 /
//   press-master(R)=14 / shot-stopper(SR)=20。
export const SKILL_ABILITY_BONUS: Record<string, AbilityBonus> = {
  finisher: { kick: 14 },
  dribbler: { technique: 7, speed: 7 },
  tackler: { defense: 8 },
  anchor: { defense: 12, iq: 8 },
  playmaker: { iq: 11, technique: 9 },
  'press-master': { defense: 7, stamina: 7 },
  'shot-stopper': { saving: 13, gkIq: 7 },
}
/** 能力値化されたスキル（possession.ts の個別倍率を撤去済み＝実効能力で再現） */
export function isAbilitySkill(id: string): boolean { return id in SKILL_ABILITY_BONUS }

// レア度の表示色（1=コモン緑 / 2=アンコモン青 / 3=レア金 / 4=コンボ＝虹色グラデ＝一目で別格）。
export const RARITY_COLOR: Record<number, string> = { 1: '#5a9a4a', 2: '#3f7bd0', 3: '#d99a1f', 4: '#c026d3' }
/** コンボ(rarity4)のUI背景＝虹色グラデーション（明らかに良いと分かる） */
export const COMBO_GRADIENT = 'linear-gradient(135deg, #f59e0b 0%, #ec4899 45%, #8b5cf6 100%)'
export const RARITY_LABEL: Record<number, string> = { 1: 'C', 2: 'R', 3: 'SR', 4: 'UR' }

// === レベル換算値（#scout改修）===
// 選手の「実力レベル段階」を、基礎7能力合計＋スキル/コンボの換算値で表示する。
// 換算値はレア度で統一＝個別調整不要・バランスもこの4数字で管理できる（表示上のものさし。試合の実効果は別途）。
export const SKILL_LEVEL_VALUE: Record<number, number> = { 1: 8, 2: 14, 3: 20 }
export const COMBO_LEVEL_VALUE = 10 // UR(組み合わせ)のシナジー上乗せ＝素材2つの加算とは別に加わる。能力ボーナス合計もこの値に一致。

export function teamHasSkill(starters: Player[], skillId: string): boolean {
  return starters.some((p) => p.skills?.includes(skillId))
}
