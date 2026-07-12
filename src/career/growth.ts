// ============================================================
// career/growth.ts — 成長式（補完E-4）の適用
// 成長量 = base × 設備係数 × 性格係数 × 雰囲気係数 × 疲労係数
//          × 天井減衰 × 学年係数 × rand(性格別幅)
// ============================================================

import type { Player } from '../engine/types'
import type { RNG } from '../engine/rng'
import type { Facilities, WeeklyPlan, PracticeGroup } from './types'
import { getMenu } from './trainingMenus'
import { atmosphereBand, teamChemistry } from './atmosphere'
import { personalityGrowthCoef, personalityRandWidth, personalityGrowthFlavor } from './personality'
import { weatherAbilityMult, type Weather } from './weather'
import { squadCategoryOf, type SquadCategory } from './squad'

type AbKey = 'kick' | 'power' | 'speed' | 'technique' | 'stamina' | 'iq' | 'defense' | 'saving' | 'gkIq'

const clamp99 = (v: number) => Math.max(1, Math.min(99, v))

function getAb(p: Player, key: AbKey): number {
  if (key === 'saving') return p.gk?.saving ?? 0
  if (key === 'gkIq') return p.gk?.gkIq ?? 0
  return p.abilities[key]
}
function addAb(p: Player, key: AbKey, delta: number): void {
  if (delta <= 0) return
  if (key === 'saving') { if (p.gk) p.gk.saving = clamp99(p.gk.saving + delta); return }
  if (key === 'gkIq') { if (p.gk) p.gk.gkIq = clamp99(p.gk.gkIq + delta); return }
  p.abilities[key] = clamp99(p.abilities[key] + delta)
}

/** 設備係数（上限値は設けず「伸びる数値」を設備で大きく変える）。高Lvほど育成が速い＝設備投資が報われる。
 *  再調整(#7)：最適育成での全国優勝を約10年へ。3年間の在籍で到達できる強さを引き上げる。 */
// 設備＝成長効率（速度）。上限撤廃後はこれが設備の主役＝低設備だと「育たない」ほど遅く＝投資必須(経営要素)。
// 高設備ほど強く加速＝投資が報われる。差を広げ「設備なしで育ちすぎ」を防ぐ（げんた様方針）。
export function facilityCoef(level: number): number {
  return [0.35, 0.35, 0.6, 1.0, 1.6, 2.3][Math.max(1, Math.min(5, level))]
}

/** 設備による能力上限は撤廃（育成ゲームで「設備＝能力の壁」は悲しい・不自然＝げんた様方針）。
 *  設備は facilityCoef（成長効率＝速度）のみで効く。能力上限は decay(1-(cur/99)^2.5) と99だけが担う
 *  ＝誰でも年数をかければ高能力に届き、効率(設備/育成の質)が高いほど速く＝結果として高く到達する。 */
export function facilitySoftCapMult(_cur: number, _groundLv: number): number {
  return 1
}

/** スタミナによる疲労軽減係数（現実：体力がある選手は疲れにくい）。
 *  stamina 0→1.0倍 / 99→0.78倍（最大22%軽減）。強くなりすぎないようスタミナ練習は雰囲気を下げて相殺。 */
export function staminaFatigueMult(stamina: number): number {
  return 1 - Math.max(0, Math.min(99, stamina)) / 99 * 0.22
}

/** 疲労係数（E-4・線形補間で崖を緩和） */
export function fatigueCoef(f: number): number {
  if (f <= 49) return 1.0
  if (f <= 69) return 1.0 + (f - 49) * (0.85 - 1.0) / 20
  if (f <= 89) return 0.85 + (f - 69) * (0.6 - 0.85) / 20
  return Math.max(0.45, 0.6 + (f - 89) * (0.45 - 0.6) / 11)
}

function gradeCoef(grade: number): number {
  return grade === 1 ? 1.2 : grade === 2 ? 1.0 : 0.8
}

function clonePlayer(p: Player): Player {
  return { ...p, abilities: { ...p.abilities }, gk: p.gk ? { ...p.gk } : null }
}

const hasSkill = (p: Player, id: string): boolean => !!p.skills?.includes(id)
/** 練習成長に効く特殊能力の係数（#34・育成系スキル）。試合スコアには影響しない。 */
function trainingSkillMult(p: Player): number {
  let m = 1
  if (hasSkill(p, 'hard-trainer')) m *= 1.12              // 練習の鬼
  if (p.grade === 1 && hasSkill(p, 'early-bird')) m *= 1.25 // 早熟＝低学年で伸びる
  if (p.grade === 3 && hasSkill(p, 'late-bloomer')) m *= 1.35 // 大器晩成＝最終学年で伸びる
  return m
}

/** 練習グループに選手が含まれるか（FW=CF/WF, MF=AM/CM/WB, DF=CB/SB, GK=GK） */
export function playerInGroup(p: Player, group: 'all' | 'gk' | 'fw' | 'mf' | 'df'): boolean {
  if (group === 'all') return true
  if (group === 'gk') return p.isGK
  if (p.isGK) return false
  const pos = p.position
  if (group === 'fw') return pos === 'CF' || pos === 'WF'
  if (group === 'mf') return pos === 'AM' || pos === 'CM' || pos === 'WB' || pos === 'DM'
  return pos === 'CB' || pos === 'SB' // df
}

/** 週末の練習試合の結果（成長画面で結果・得点者を表示・#22c） */
export interface WeekendMatchResult {
  label: string      // 「練習試合（互角）」など
  score: string      // 「2-1」
  mark: '○' | '●' | '△'
  scorers: string[]  // 得点者名
  skillGains?: string[] // 実戦で掴んだ特殊能力（試合ならではの効果）
}

export interface GrowthSummary {
  // 最も伸びた選手（UIフィードバック用）
  topGrowers: { name: string; total: number; mainAbility: string }[]
  // 今週伸びた選手の主成長（1週進めた直後の表示用）。pos=配置ポジション（成長画面で誰か分かるように）
  // G-41 §10: squad 情報も保持し、結果UIでA/B/C/招集外切替可能に
  gains: { name: string; ability: string; amount: number; group: PracticeGroup; pos: string; grade: number; squad?: 'A' | 'B' | 'C' | 'orphan'; note?: string }[]
  restedCount: number   // 完全休養した人数
  weekend?: WeekendMatchResult | null // 週末の練習試合結果（あれば）
  // #75: 今週新たに発生した怪我（初回怪我チュートリアル表示判定にも使用）
  injuries?: { name: string; weeks: number }[]
}

// 練習＝メニューで特化（その能力が大きく伸びる）。不足能力は試合で伸ばす設計。
// 長期プレイだが「最適育成で全国優勝≈10年」を狙う(#7)。低設備で適当に育てても高能力には届かない。
const TRAIN_FOCUS = 2.5
// 全体成長率（#scout改修・げんた様方針）: 能力成長を緩やかにし「育成は時間がかかる／特殊能力で戦う」設計へ。
// CPUは名門止まり(スキル無し)・プレイヤーはスキル/コンボで逸材→至宝→伝説へ＝長期プレイの連覇。
// 全国初優勝の目安を~7年→~9年へ。練習成長に一律で掛ける（実測でtitlecheckを見ながら調整）。
const GROWTH_RATE = 0.59

function practiceGroupOf(p: Player): PracticeGroup {
  if (p.isGK) return 'gk'
  const pos = p.position
  if (pos === 'CF' || pos === 'WF') return 'fw'
  if (pos === 'CB' || pos === 'SB') return 'df'
  return 'mf'
}

const AB_LABEL: Record<AbKey, string> = {
  kick: 'キック', power: 'パワー', speed: 'スピード', technique: '技術',
  stamina: 'スタミナ', iq: 'IQ', defense: '守備', saving: 'セービング', gkIq: 'GK-IQ',
}

/**
 * 週次練習を適用。各選手は割り当てられた1メニューだけ実施し、その主能力は
 * 最低 +1 伸びる（ただし潜在=天井に達したら頭打ち＝育ちすぎを防ぐ）。
 * 未割当の選手は「完全休養」（疲労回復のみ・成長なし）。
 * 週末枠・試合経験は呼び出し側で別途処理する。
 */
export function applyWeeklyTraining(
  roster: Player[],
  plan: WeeklyPlan,
  facilities: Facilities,
  atmosphere: number,
  rng: RNG,
  weatherMult = 1.0,
  atmosphereB = atmosphere,
  weather?: Weather,
  growthScale = 1, // 追加練習など「軽い追加セッション」は<1で渡す
  weatherMitigated = false, // #32: 体育館 or 地域適応＝能力別の天候マイナスを軽減
  mannerismMult: Record<string, number> = {}, // #28: メニューIDごとの成長倍率（マンネリ減衰）
  staff?: string[], // B/C/招集外 判定に使う（Bコーチ・Cコーチの雇用状況）
): { roster: Player[]; summary: GrowthSummary } {
  // B/C/招集外 のカテゴリ判定用コンテキスト（roster.length と facilities.dorm と staff から導出）
  const unlockCtx = { roster: { length: roster.length }, facilities: { dorm: facilities.dorm }, staff }
  // B/C/招集外 用 万能成長の能力ごと基礎値。
  // facilityCoef を効かせて「設備への投資が全員に効く・ただしA特化練習を絶対に超えない」設計。
  // ・B: 0.28 × facilityCoef × 7 ≒ A総成長の95%（特化練習に微妙に届かない）
  // ・C: 0.20 × facilityCoef × 7 ≒ Bの70%
  // ・招集外: 0.10 × facilityCoef × 7 ≒ Cの50%（B未解放時の最低限・部活管理が回り始めれば即昇格）
  // 「週末選択(練習試合・休養)はB/Cに直接影響しない」を補うため、Aの95%相当を上限に微増。
  // 性格(怠け0.7/努力1.2)・高疲労(80以上=0.6倍)・99天井減衰で個性と上限を残す。
  const SQUAD_UNI_GROW: Record<Exclude<SquadCategory, 'A'>, number> = { B: 0.28, C: 0.20, orphan: 0.10 }
  const squadFacilityCoef = facilityCoef(facilities.ground)
  const NON_GK_KEYS: AbKey[] = ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense']
  const GK_KEYS: AbKey[] = ['stamina', 'iq', 'saving', 'gkIq']
  const growers: { name: string; total: number; mainAbility: string }[] = []
  const gains: GrowthSummary['gains'] = []
  const injuries: { name: string; weeks: number }[] = []
  let restedCount = 0
  // #34: 怠け者4人以上＝緩い空気でチーム全体の疲労蓄積がやや減る（だらけた良さ）
  const looseAir = teamChemistry(roster).looseAir

  const next = roster.map((orig) => {
    const p = clonePlayer(orig)
    // 引退した3年(#33)は練習に出ない（成長なし・疲労も動かさない）
    if (p.retired) return p
    // #31: 赤点の補習中は練習に出られない（成長なし・疲労は少し回復）。残り週を1減らす。
    if ((p.cramWeeks ?? 0) > 0) {
      p.fatigue = Math.max(0, p.fatigue - 10)
      p.cramWeeks = (p.cramWeeks ?? 0) - 1
      restedCount++
      return p
    }
    // G-24: 怪我の回復中は練習に出ない（疲労は強く回復）。残り週を1減らす。
    if ((p.injuryWeeks ?? 0) > 0) {
      p.fatigue = Math.max(0, p.fatigue - 18)
      p.injuryWeeks = (p.injuryWeeks ?? 0) - 1
      restedCount++
      return p
    }
    // B/C/招集外 の万能成長（レーン非依存・全能力に少しずつ）。
    // PracticePlannerはAのみ表示するため、B/C/招集外はユーザーが個別に練習を指定できない。
    // 「Aより少し育ちづらく・全能力均等」で B→C→招集外 の順に伸びが鈍くなる。
    // G-25 (旧: 招集外 +0.3〜0.6 弱点のみ) はこのシステムに統合され撤去。
    const cat: SquadCategory = squadCategoryOf(p, unlockCtx)
    if (cat !== 'A') {
      const baseInc = SQUAD_UNI_GROW[cat]
      const persMult = p.personality === 'lazy' ? 0.7 : p.personality === 'hardworker' ? 1.2 : 1.0
      const fatMult = p.fatigue >= 80 ? 0.6 : 1.0
      const keys = p.isGK ? GK_KEYS : NON_GK_KEYS
      let bestKey: AbKey = keys[0]
      let bestAmt = 0
      let totalGrown = 0
      for (const k of keys) {
        const cur = getAb(p, k)
        if (cur <= 0 || cur >= 99) continue
        const decay = Math.max(0.05, 1 - Math.pow(cur / 99, 2.5))
        const inc = baseInc * squadFacilityCoef * persMult * fatMult * decay * (0.85 + rng.next() * 0.3)
        if (inc <= 0) continue
        addAb(p, k, inc)
        totalGrown += inc
        if (inc > bestAmt) { bestAmt = inc; bestKey = k }
      }
      // 試合練習に出ないので疲労は緩く減る（週末完全休養-25よりは控えめ）。
      p.fatigue = Math.max(0, p.fatigue - 5)
      if (totalGrown > 0.05) {
        growers.push({ name: p.name, total: totalGrown, mainAbility: AB_LABEL[bestKey] })
        gains.push({ name: p.name, ability: AB_LABEL[bestKey], amount: bestAmt, group: practiceGroupOf(p), pos: p.slot ?? p.position, grade: p.grade, squad: cat, note: cat === 'orphan' ? '招集外' : undefined })
      }
      restedCount++
      return p
    }

    const laneIdx = plan.assign[p.id]
    const lane = laneIdx != null ? plan.lanes[laneIdx] : undefined
    if (!lane) {
      // A メンバーのレーン未割当＝完全休養（疲労回復のみ・成長なし）。
      p.fatigue = Math.max(0, p.fatigue - 15)
      restedCount++
      return p
    }

    // 所属チーム（A or B/C）の雰囲気で成長効率が変わる
    const band = atmosphereBand((p.squad ?? 'A') === 'A' ? atmosphere : atmosphereB)
    const skillMult = trainingSkillMult(p) // 育成系スキル（練習の鬼・早熟・大器晩成）
    let totalGrown = 0
    let bestKey: AbKey = 'iq'
    let bestAmt = 0

    // #17/#32: このメニューが屋内/座学なら天候非依存。それ以外は天候補正が効く。
    // 体育館 or 地域適応(weatherMitigated)のときは能力別マイナスのみ軽減（プラスは残す）。
    const menu = getMenu(lane.menuId)
    const proof = !!menu.weatherProof
    const laneWeatherMult = proof ? 1 : weatherMult           // 屋内は全体効率の天候デバフを受けない
    const effWeather = proof ? undefined : weather            // 屋内は能力別の天候シェイプも無し
    // #36: 設備解放メニューの効率係数（quality）。明示が無ければ必要設備Lvから導出（基本1.00）。
    const menuQuality = menu.quality ?? (menu.requiresTraining ? Math.min(1.15, 1 + (menu.requiresTraining - 1) * 0.05) : 1.0)
    // 練習設備Lvの全体倍率: Lv1=1.00 / Lv2=1.04 / Lv3=1.08 / Lv4=1.12（低Lvメニューも施設で底上げ）
    const trainingFacilityMult = 1 + (facilities.training - 1) * 0.04
    // #28: マンネリ減衰（同一メニュー5週超で成長↓）。エンジンから渡る倍率。
    const mannerism = mannerismMult[menu.id] ?? 1
    // focus別の主/副重み: 特化=0.65/0.15 / 標準=0.50/0.20 / 万能=0.35/0.25
    const focus = menu.focus ?? 'standard'
    const mainWeight = focus === 'specialized' ? 0.65 : focus === 'broad' ? 0.35 : 0.50
    const subWeight  = focus === 'specialized' ? 0.15 : focus === 'broad' ? 0.25 : 0.20

    // 2026-06-26: 下級生キャプテンは重圧で大きく成長。1年=×1.20 / 2年=×1.10 / 3年=×1.0。
    const captainGrowthMult = p.isCaptain ? (p.grade === 1 ? 1.20 : p.grade === 2 ? 1.10 : 1.0) : 1.0

    const grow = (key: AbKey, base: number) => {
      const cur = getAb(p, key)
      if (cur <= 0) return // その能力を持たない（FPのGK能力等）
      const room = 99 - cur
      if (room <= 0.02) return // 99がハード上限
      // 99に近いほど鈍化。潜在(才能)の概念は廃止＝誰でも育成次第で伸びる。
      const decay = Math.max(0.05, 1 - Math.pow(cur / 99, 2.5))
      const pers = personalityGrowthCoef(p.personality, key)
      const fat = fatigueCoef(p.fatigue)
      const grade = gradeCoef(p.grade)
      const w = personalityRandWidth(p.personality)
      const r = w.lo + rng.next() * (w.hi - w.lo)
      // 天候で「伸びる能力」が変わる（晴れ=全体小ボーナス／雨=技術IQ／猛暑寒波雪=フィジカル系 等）。
      // 体育館/地域適応ならマイナスのみ軽減（weatherMitigated）。屋内メニューはeffWeather=undefinedで天候無効。
      const amount = GROWTH_RATE * base * facilityCoef(facilities.ground) * laneWeatherMult * pers * band.trainingMult * fat * decay * grade * r * weatherAbilityMult(effWeather, key, weatherMitigated) * facilitySoftCapMult(cur, facilities.ground) * menuQuality * trainingFacilityMult * mannerism * skillMult * captainGrowthMult
      addAb(p, key, amount)
      totalGrown += amount
      if (amount > bestAmt) { bestAmt = amount; bestKey = key }
    }

    // 練習はメニューの能力を focus 別の重みで伸ばす（特化/標準/万能）。
    for (const k of menu.main) grow(k as AbKey, TRAIN_FOCUS * mainWeight * growthScale)
    for (const k of menu.sub) grow(k as AbKey, TRAIN_FOCUS * subWeight * growthScale)

    // #56: GK育成のクロスオーバー（小さく伸ばす）。
    //  ・GKがFP系練習をしても固有能力(saving/gkIq)が少し伸びる
    //  ・GK練習中もFP共通能力(stamina/iq)が少し伸びる
    //  専門特化（GK練習がGK能力に最も効く）は維持しつつ、断絶を解消。
    if (p.isGK) {
      const cross = TRAIN_FOCUS * 0.2 * 0.25 * growthScale // 副成長の約25%＝小
      const gkMenu = [...menu.main, ...menu.sub].some((k) => k === 'saving' || k === 'gkIq')
      if (gkMenu) { grow('stamina', cross); grow('iq', cross) }
      else { grow('saving', cross); grow('gkIq', cross) }
    }
    // G-27: 紅白戦・シュート練習は「シュートを止める/打たれる練習」＝GK部員も
    //   saving/gkIq が追加で伸びる（純粋プラス・係数30%）。#56 cross の上乗せ。
    //   セットプレー練習が将来追加された場合は menuId をここに足す。
    if (p.isGK && (lane.menuId === 'scrimmage' || lane.menuId === 'shoot')) {
      const gkBoost = TRAIN_FOCUS * 0.30 * growthScale
      grow('saving', gkBoost)
      grow('gkIq', gkBoost)
    }

    let fatigueAdd = menu.fatigue
    if (p.personality === 'lazy') fatigueAdd *= 0.8
    if (looseAir && fatigueAdd > 0) fatigueAdd *= 0.88 // #34: 怠け者多数の緩い空気＝チーム疲労蓄積↓
    if (fatigueAdd > 0) fatigueAdd *= staminaFatigueMult(p.abilities.stamina) // スタミナが高いほど疲れにくい（現実）
    if (fatigueAdd > 0 && hasSkill(p, 'iron-body')) fatigueAdd *= 0.8 // 鉄人＝練習で疲れにくい
    p.fatigue = Math.max(0, Math.min(100, p.fatigue + fatigueAdd))
    // G-24/#75: 疲労85以上でオーバーワーク怪我（三次曲線・100で約15%・努力家は半減・鉄人は1/3）。
    //   85=0.3%・90=0.8%・95=4.7%・100=15%。100付近で急増する設計。
    //   発生時は1〜4週間の完全ランダム離脱（練習・試合ともに不可）。
    if (p.fatigue >= 85) {
      const t = (p.fatigue - 85) / 15 // 0 at 85, 1 at 100
      let injRate = 0.003 + 0.147 * t * t * t
      if (p.personality === 'hardworker') injRate *= 0.5
      if (hasSkill(p, 'iron-body')) injRate *= 0.33
      if (rng.next() < injRate) {
        const weeks = 1 + Math.floor(rng.next() * 4) // 1〜4週間 完全ランダム
        p.injuryWeeks = (p.injuryWeeks ?? 0) + weeks
        injuries.push({ name: p.name, weeks })
        // 怪我発生時は疲労を一気に抜く（試合に出るために無理しない設計＝以後の回復は早い）
        p.fatigue = Math.max(0, p.fatigue - 25)
      }
    }

    if (totalGrown > 0.05) {
      // #33: 性格が成長に効いた瞬間を一言で（毎回ではなく噛み合ったときだけ）。
      const note = personalityGrowthFlavor(p.personality, bestKey) ?? undefined
      growers.push({ name: p.name, total: totalGrown, mainAbility: AB_LABEL[bestKey] })
      gains.push({ name: p.name, ability: AB_LABEL[bestKey], amount: bestAmt, group: practiceGroupOf(p), pos: p.slot ?? p.position, grade: p.grade, squad: p.squad ?? 'A', note })
    }
    return p
  })

  growers.sort((a, b) => b.total - a.total)
  gains.sort((a, b) => b.amount - a.amount)
  return { roster: next, summary: { topGrowers: growers.slice(0, 3), gains, restedCount, injuries: injuries.length > 0 ? injuries : undefined } }
}

/** 完全休養（週末枠）: 全員疲労-25 */
export function applyRest(roster: Player[], amount = 25): Player[] {
  return roster.map((p) => ({ ...p, fatigue: Math.max(0, p.fatigue - amount) }))
}

// 試合は「全体的に」能力を伸ばす（実戦経験）。99基準の減衰で低い能力ほど伸びやすく、
// 自然に穴が埋まって選手が丸くなる。一方ピーク（武器）は練習の特化が作る＝育成が本質。
const MATCH_BROAD = 1.2

/**
 * 試合経験による成長。出場者(starterIds)の全能力を「全体的に」伸ばす（実戦経験）。
 * 99基準の減衰で低い能力ほど伸びやすいため、自然に穴が埋まって選手が丸くなる。
 * ただし減衰により伸びは中盤で頭打ち＝高み(武器)は練習の特化でしか作れない＝育成が本質。
 */
export function applyMatchExperience(
  roster: Player[], starterIds: Set<string>, facilities: Facilities, atmosphere: number, rng: RNG, scale = 1,
): Player[] {
  const band = atmosphereBand(atmosphere)
  const facCoef = facilityCoef(facilities.ground)
  return roster.map((orig) => {
    if (!starterIds.has(orig.id)) return orig
    const p = clonePlayer(orig)
    // 試合は全能力を「全体的に」伸ばす。99基準の減衰で低い能力ほど伸びやすく、自然に丸くなる。
    const pool: AbKey[] = p.isGK
      ? ['power', 'speed', 'stamina', 'iq', 'saving', 'gkIq']
      : ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense']
    const fighterBonus = p.personality === 'fighter' ? 1.3 : 1.0
    const sparkBonus = hasSkill(p, 'spark') ? 1.18 : 1.0 // 闘志＝実戦で得るものが大きい
    const grade = gradeCoef(p.grade)
    for (const key of pool) {
      const cur = getAb(p, key)
      if (cur <= 0 || cur >= 99) continue
      const decay = Math.max(0.05, 1 - Math.pow(cur / 99, 2.2)) // 低い能力ほど伸びやすい＝自然に穴が埋まる
      const r = 0.7 + rng.next() * 0.6
      addAb(p, key, MATCH_BROAD * scale * facCoef * band.trainingMult * decay * grade * fighterBonus * sparkBonus * r * facilitySoftCapMult(cur, facilities.ground))
    }
    return p
  })
}
