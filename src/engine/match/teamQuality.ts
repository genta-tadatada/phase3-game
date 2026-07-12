// ============================================================
// engine/match/teamQuality.ts — チーム強度算出（GDD 補完A-2）
// 出場中11人の実効能力から attackQ / midQ / defendQ を加重平均で求める。
//
// 実効能力 = 基礎能力 × 身長補正 × スタミナ係数 × 性格試合補正
//            × 雰囲気係数 × 調子係数
// （MVP簡略: 身長補正はパワー/セービングのみ・性格は文脈依存の軽量版）
// ============================================================

import type {
  Abilities, Condition, Player, PositionType,
} from '../types'
import { skillById, SKILL_LEVEL_VALUE, COMBO_LEVEL_VALUE } from '../../data/skills'
import { activeCombos } from '../../data/combos'
import { ATTACK_POSITIONS, DEF_POSITIONS, MID_POSITIONS } from './formations'

export interface TeamQuality {
  attackQ: number
  midQ: number
  defendQ: number
}

// 試合中の文脈（性格補正の判定に使う）
export interface MatchContext {
  isBehind: boolean // ビハインド中か（闘志家ボーナス用）
  isBigMatch: boolean // 大一番か（ビビり減衰用）
}

// --- 調子係数（GDD 2.12） ---
const CONDITION_COEF: Record<Condition, number> = {
  1: 0.85, 2: 0.93, 3: 1.0, 4: 1.07, 5: 1.15,
}

// --- 身長によるフィジカルデュエル補正（GDD 2.3.1・パワーに乗算） ---
const HEIGHT_DUEL_MULT = [
  0,    // index0 未使用
  0.88, // tier1
  0.93, // tier2
  0.97, // tier3
  0.99, // tier4
  1.00, // tier5（基準）
  1.02, // tier6
  1.05, // tier7
  1.09, // tier8
  1.13, // tier9
]

// --- 身長によるGKセービング補正（GDD 2.3.1） ---
const HEIGHT_SAVE_MULT = [
  0,
  0.82, 0.87, 0.92, 0.96, 1.00, 1.04, 1.08, 1.14, 1.18,
]

/** 雰囲気係数（50=中立1.0・下限0.92・上限1.08。下限クランプP-1-7考慮） */
export function atmosphereCoef(atmosphere: number): number {
  const a = Math.max(0, Math.min(100, atmosphere))
  return 0.92 + (a / 100) * 0.16
}

/** スタミナ係数（残スタミナ100→1.0・0→0.80の線形） */
export function staminaCoef(liveStamina: number): number {
  const s = Math.max(0, Math.min(100, liveStamina))
  return 0.80 + (s / 100) * 0.20
}

/** 性格による試合補正（MVP軽量版・乗算係数を返す） */
function personalityMatchMult(p: Player, ctx: MatchContext): number {
  switch (p.personality) {
    case 'fighter': return ctx.isBehind ? 1.08 : 1.0 // 闘志家: ビハインドで奮起
    case 'timid':   return ctx.isBigMatch ? 0.92 : 0.97 // ビビり: 大舞台で能力ダウン
    case 'genius':  return ctx.isBigMatch ? 1.05 : 1.0 // 天才肌: 大一番で輝く
    case 'hotblood': return ctx.isBehind ? 1.04 : 1.0
    default: return 1.0
  }
}

/** 選手のポジション別スコア（A-2の重み・身長補正込み） */
function positionScore(p: Player, pos: PositionType, mult: number): number {
  const a = p.abilities
  // パワーに身長デュエル補正を乗算（空中戦・競り合いの近似）
  const power = a.power * HEIGHT_DUEL_MULT[p.heightTier]
  let raw = 0
  switch (pos) {
    case 'CF':
      raw = a.kick * 0.30 + power * 0.25 + a.iq * 0.20 + a.technique * 0.15 + a.stamina * 0.10
      break
    case 'WF':
      raw = a.speed * 0.35 + a.technique * 0.30 + a.kick * 0.20 + a.stamina * 0.15
      break
    case 'WB':
      raw = a.stamina * 0.30 + a.speed * 0.25 + a.defense * 0.20 + a.technique * 0.15 + a.kick * 0.10
      break
    case 'AM':
      raw = a.technique * 0.30 + a.iq * 0.25 + a.kick * 0.25 + a.stamina * 0.20
      break
    case 'CM':
      raw = a.iq * 0.25 + a.stamina * 0.25 + a.defense * 0.25 + a.kick * 0.15 + a.speed * 0.10
      break
    case 'DM':
      raw = a.defense * 0.30 + a.iq * 0.28 + a.stamina * 0.20 + power * 0.12 + a.technique * 0.10
      break
    case 'CB':
      raw = a.defense * 0.35 + a.iq * 0.25 + power * 0.20 + a.speed * 0.20
      break
    case 'SB':
      raw = a.speed * 0.30 + a.defense * 0.25 + a.stamina * 0.25 + a.kick * 0.15 + a.iq * 0.05
      break
    case 'GK':
      raw = 0 // GKは別系統（gkScore）で処理
      break
  }
  return raw * mult
}

/** 基礎能力ベースのポジション適性スコア（編成・表示用・補正なし） */
export function rawPositionScore(p: Player, pos: PositionType): number {
  if (pos === 'GK') return gkSaveScore(p, 1)
  return positionScore(p, pos, 1)
}

const FIELD_POS_LIST: PositionType[] = ['CB', 'SB', 'WB', 'DM', 'CM', 'AM', 'WF', 'CF']
/** 能力から最適なフィールドポジション（希望ポジ・おすすめ・初期配属用） */
export function bestFieldPosition(p: Player): PositionType {
  let best: PositionType = 'CM'
  let s = -1
  for (const pos of FIELD_POS_LIST) {
    const sc = rawPositionScore(p, pos)
    if (sc > s) { s = sc; best = pos }
  }
  return best
}

/** GK失点阻止スコア（A-2） */
function gkSaveScore(p: Player, mult: number): number {
  if (!p.gk) return 30 * mult
  const a = p.abilities
  const saving = p.gk.saving * HEIGHT_SAVE_MULT[p.heightTier]
  const raw = saving * 0.50 + p.gk.gkIq * 0.30 + a.speed * 0.10 + a.power * 0.10
  return raw * mult
}

/** GKビルドアップ係数（補完P-1-5・キック精度0.6+技術0.4） */
function gkBuildScore(p: Player): number {
  const a = p.abilities
  return a.kick * 0.6 + a.technique * 0.4
}

/**
 * 出場中11人の実効能力から attackQ / midQ / defendQ を算出。
 * @param starters 先発11人（position が割当済み）
 * @param liveStamina player.id -> 残スタミナ
 * @param atmosphere チーム雰囲気 0〜100
 * @param ctx 試合文脈
 */
export function computeTeamQuality(
  starters: Player[],
  liveStamina: Record<string, number>,
  atmosphere: number,
  ctx: MatchContext,
): TeamQuality {
  const atmoC = atmosphereCoef(atmosphere)

  let attackSum = 0, attackN = 0
  let midSum = 0, midN = 0
  let defSum = 0, defN = 0
  let gkSave = 30
  let gkBuild = 50

  for (const p of starters) {
    const stamC = staminaCoef(liveStamina[p.id] ?? 100)
    const condC = CONDITION_COEF[p.condition]
    const persC = personalityMatchMult(p, ctx)
    const mult = stamC * condC * atmoC * persC

    // 採点は「配置スロット」基準（slot優先・未指定なら生来position）。
    // → 鈍足DFをWFに置けば機能せず、能力が枠に合えば輝く＝創発ポジション。
    const slot = p.slot ?? p.position
    if (slot === 'GK') {
      gkSave = gkSaveScore(p, stamC * condC * atmoC) // GKは性格補正を控えめに
      gkBuild = gkBuildScore(p)
      continue
    }
    const score = positionScore(p, slot, mult)
    if (ATTACK_POSITIONS.includes(slot)) { attackSum += score; attackN++ }
    else if (MID_POSITIONS.includes(slot)) { midSum += score; midN++ }
    else if (DEF_POSITIONS.includes(slot)) { defSum += score; defN++ }
  }

  const attackQ = attackN > 0 ? attackSum / attackN : 35
  const defAvg = defN > 0 ? defSum / defN : 35
  // ビルドアップの上手いGKは中盤の数値を底上げ（A-2 defendQ→midQ繋ぎ・軽量）
  const midBase = midN > 0 ? midSum / midN : 35
  const midQ = midBase + (gkBuild - 50) * 0.04
  const defendQ = defAvg * 0.70 + gkSave * 0.30

  return { attackQ, midQ, defendQ }
}

/** チームのIQ平均（戦術実行度の算出に使う） */
export function teamIqAverage(starters: Player[]): number {
  if (starters.length === 0) return 50
  const sum = starters.reduce((s, p) => s + p.abilities.iq, 0)
  return sum / starters.length
}

/** 能力合計（総合力レベル表示・E-2/P-1-4: 7能力基準） */
export function abilitySum(a: Abilities): number {
  return a.kick + a.power + a.speed + a.technique + a.stamina + a.iq + a.defense
}

/**
 * 表示・進路・ベストプレイヤー判定用の総合力（7値）。
 * GKはスタミナ/守備の代わりにセービング/GK-IQを用いて公平に評価する。
 */
export function playerOverallSum(p: Player): number {
  if (p.isGK && p.gk) {
    const a = p.abilities
    return p.gk.saving + p.gk.gkIq + a.speed + a.iq + a.kick + a.technique + a.power
  }
  return abilitySum(p.abilities)
}

/** スキル/コンボのレベル換算値の合計（レア度ベース＋コンボ上乗せ）。 */
export function playerSkillLevelBonus(p: Player): number {
  let bonus = 0
  for (const id of p.skills ?? []) {
    const def = skillById(id)
    if (def) bonus += SKILL_LEVEL_VALUE[def.rarity] ?? 0
  }
  bonus += activeCombos(p).length * COMBO_LEVEL_VALUE
  return bonus
}

/** 実力レベル段階の判定に使う「スキル込み総合値」＝基礎7能力合計 ＋ スキル/コンボ換算値。 */
export function playerLevelSum(p: Player): number {
  return playerOverallSum(p) + playerSkillLevelBonus(p)
}
