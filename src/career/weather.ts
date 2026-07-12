// ============================================================
// career/weather.ts — 天候システム（補完L・週次・地域/季節差）
// 試合バランスには影響させず、練習効率にのみ作用（年間で平均すると中立）。
// 体育館（追加設備）があれば悪天候のデバフを無効化できる。
// ============================================================

import type { RNG } from '../engine/rng'
import { weekToMonth } from './calendar'

export type Weather = '晴れ' | '曇り' | '雨' | '猛暑' | '寒波' | '雪'

export const WEATHER_ICON: Record<Weather, string> = {
  晴れ: '☀️', 曇り: '☁️', 雨: '🌧', 猛暑: '🔥', 寒波: '❄️', 雪: '⛄',
}

// GPT Image生成のかわいい天候アイコン（透過PNG・顔なし）。6種すべて専用アイコン。asset()でパス解決。
export const WEATHER_ICON_IMG: Record<Weather, string> = {
  晴れ: 'ui/weather-sunny.webp', 曇り: 'ui/weather-cloudy.webp', 雨: 'ui/weather-rain.webp',
  猛暑: 'ui/weather-heat.webp', 寒波: 'ui/weather-coldwave.webp', 雪: 'ui/weather-snow.webp',
}

function isNorthern(pref: string): boolean {
  return ['北海道', '青森県', '岩手県', '秋田県', '山形県', '宮城県', '福島県', '新潟県', '富山県', '石川県', '福井県', '長野県'].includes(pref)
}
function isSouthern(pref: string): boolean {
  return ['沖縄県', '鹿児島県', '宮崎県', '熊本県', '高知県', '和歌山県'].includes(pref)
}

/** 週・地域から天候を抽選 */
export function generateWeather(week: number, prefecture: string, rng: RNG): Weather {
  const m = weekToMonth(week)
  const north = isNorthern(prefecture)
  const south = isSouthern(prefecture)
  const r = rng.next()

  // 夏（6〜8月）
  if (m >= 6 && m <= 8) {
    if (south && r < 0.45) return '猛暑'
    if (r < 0.30) return '猛暑'
    if (r < 0.55) return '晴れ'
    if (r < 0.80) return '曇り'
    return '雨'
  }
  // 冬（12〜2月）
  if (m === 12 || m === 1 || m === 2) {
    if (north && r < 0.35) return '雪'
    if (north && r < 0.55) return '寒波'
    if (r < 0.15) return '寒波'
    if (r < 0.55) return '晴れ'
    return '曇り'
  }
  // 春・秋（穏やか・雨多め）
  if (r < 0.40) return '晴れ'
  if (r < 0.70) return '曇り'
  return '雨'
}

// 気候の適応プロファイル（-2〜+2）。地域(4〜6県ごと)で細かく分ける。
//   cold=雪/寒波への強さ・heat=猛暑への強さ・rain=雨/曇り（多湿）への強さ。
//   晴れは全地域メリットもデメリットも無し（中立）。それ以外は各地域に得意・不得意がある。
export interface ClimateAdapt { cold: number; heat: number; rain: number; label: string }
const NEUTRAL: ClimateAdapt = { cold: 0, heat: 0, rain: 0, label: '温暖' }
// 各グループ＝近い気候の県のまとまり。
const CLIMATE_GROUPS: { adapt: ClimateAdapt; prefs: string[] }[] = [
  { adapt: { cold: 2, heat: -2, rain: 0, label: '極寒・冷涼' }, prefs: ['北海道'] },
  { adapt: { cold: 2, heat: -1, rain: 1, label: '北東北' }, prefs: ['青森県', '岩手県', '秋田県'] },
  { adapt: { cold: 1, heat: -1, rain: 0, label: '南東北' }, prefs: ['宮城県', '山形県', '福島県'] },
  { adapt: { cold: 2, heat: -1, rain: 2, label: '北陸（豪雪・多雨）' }, prefs: ['新潟県', '富山県', '石川県', '福井県'] },
  { adapt: { cold: 1, heat: 0, rain: -1, label: '内陸高地（寒暖差・乾燥）' }, prefs: ['山梨県', '長野県', '岐阜県'] },
  { adapt: { cold: 0, heat: 1, rain: -1, label: '北関東（内陸・酷暑・乾燥）' }, prefs: ['茨城県', '栃木県', '群馬県'] },
  { adapt: { cold: 0, heat: 0, rain: 0, label: '南関東（温暖）' }, prefs: ['埼玉県', '千葉県', '東京都', '神奈川県'] },
  { adapt: { cold: -1, heat: 1, rain: 1, label: '東海（温暖・夏暑い・多雨）' }, prefs: ['静岡県', '愛知県', '三重県'] },
  { adapt: { cold: 0, heat: 1, rain: 0, label: '近畿（盆地は猛暑）' }, prefs: ['滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'] },
  { adapt: { cold: 0, heat: 1, rain: 0, label: '中国' }, prefs: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'] },
  { adapt: { cold: -1, heat: 1, rain: 1, label: '四国（温暖・多雨）' }, prefs: ['徳島県', '香川県', '愛媛県', '高知県'] },
  { adapt: { cold: -1, heat: 2, rain: 1, label: '九州（酷暑・梅雨台風）' }, prefs: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県'] },
  { adapt: { cold: -2, heat: 2, rain: 1, label: '南国・常夏（多雨）' }, prefs: ['沖縄県'] },
]
const PREF_ADAPT: Record<string, ClimateAdapt> = (() => {
  const m: Record<string, ClimateAdapt> = {}
  for (const g of CLIMATE_GROUPS) for (const p of g.prefs) m[p] = g.adapt
  return m
})()
/** 出身県の気候適応プロファイル */
export function climateAdapt(prefecture: string): ClimateAdapt {
  return PREF_ADAPT[prefecture] ?? NEUTRAL
}
/**
 * 試合時の気候適性係数（天候×出身県）。1.0=中立・±0.025/段階（±2で±5%）。
 * 雪/寒波=cold・猛暑=heat・雨=rain（曇りはrainの半分）。晴れは全地域中立（デメリットなし）。
 * → 冬は寒冷地、夏は酷暑地、雨天は多雨地域が輝く＝どの地域にも得意な天気がある。
 */
export function climateMatchCoef(prefecture: string, weather: Weather): number {
  const a = climateAdapt(prefecture)
  // 「得意な天候」は 猛暑・寒波・雨・雪 のみ（晴れ・曇りは地域差なし）
  switch (weather) {
    case '雪': case '寒波': return 1 + a.cold * 0.025
    case '猛暑': return 1 + a.heat * 0.025
    case '雨': return 1 + a.rain * 0.025
    default: return 1.0
  }
}
/** 気候が試合に明確に効くか（晴れ・曇りの微差は除く） */
export function climateMattersFor(weather: Weather): boolean {
  return weather === '雪' || weather === '寒波' || weather === '猛暑' || weather === '雨'
}

/** その出身県は、この天候を得意とするか（悪天候デバフを受けず、むしろ好調に練習できる） */
export function climateAdaptedTo(prefecture: string, weather: Weather): boolean {
  const a = climateAdapt(prefecture)
  if (weather === '雪' || weather === '寒波') return a.cold >= 1
  if (weather === '猛暑') return a.heat >= 1
  if (weather === '雨') return a.rain >= 1
  return false
}

// 天候ごとに「伸びやすい能力／伸びにくい能力」が変わる（練習内容の差）。
// 各能力に "得意天候 1〜2個 + 苦手天候 1〜2個" を割り当てる。晴れは全能力 +4%（中立で安定）。
//   speed   : 得意=曇り / 苦手=猛暑・雪
//   stamina : 得意=猛暑・雪 / 苦手=雨
//   power   : 得意=寒波・雪 / 苦手=猛暑
//   technique: 得意=雨 / 苦手=寒波・雪
//   kick    : 得意=曇り / 苦手=雨・雪
//   defense : 得意=寒波 / 苦手=猛暑
//   saving  : 得意=雨 / 苦手=寒波
//   iq      : 得意=曇り・雨 / 苦手=猛暑
// G-44: IQと連動するべき GK-IQ も同じ倍率を付ける（GKもIQ伸びやすい日に伸びる）
const WEATHER_ABILITY: Record<Weather, Record<string, number>> = {
  晴れ: {}, // 全能力 +4%（default 1.04）。万能で安定の練習日和
  曇り: { speed: 1.18, kick: 1.14, iq: 1.08, gkIq: 1.08, technique: 1.06, stamina: 1.05 },
  雨:   { technique: 1.18, saving: 1.18, iq: 1.04, gkIq: 1.04, kick: 0.88, stamina: 0.95 },
  猛暑: { stamina: 1.35, power: 0.90, speed: 0.85, defense: 0.96, iq: 0.95, gkIq: 0.95 },
  寒波: { power: 1.40, defense: 1.25, stamina: 1.08, technique: 0.85, saving: 0.95 },
  雪:   { power: 1.30, defense: 1.18, stamina: 1.10, technique: 0.85, speed: 0.85, kick: 0.92 },
}
/** 天候×能力 の練習成長倍率（晴れ=全能力 +4% / 曇り以下は得意能力にブースト）。
 *  #32: mitigated（体育館 or 地域適応）のときは「マイナスのみ」軽減（ペナルティを40%に圧縮）。
 *  プラス（雨の技術+28%等）はそのまま残す＝得意天候のボーナスは活かしつつ理不尽な大減を緩和。 */
export function weatherAbilityMult(weather: Weather | undefined, key: string, mitigated = false): number {
  if (!weather) return 1
  if (weather === '晴れ') return 1.04
  const raw = WEATHER_ABILITY[weather]?.[key] ?? 1
  if (mitigated && raw < 1) return 1 - (1 - raw) * 0.4 // 例: 雨キック0.88→0.952
  return raw
}

/** 天候による練習効率倍率（体育館 or 地域適応で悪天候デバフを無効化、得意天候はむしろ好調） */
export function weatherTrainingMult(weather: Weather, hasGym: boolean, adapted = false): number {
  let m = 1.0
  switch (weather) {
    case '晴れ': m = 1.02; break
    case '曇り': m = 1.0; break
    case '雨': m = 0.90; break
    case '猛暑': m = 0.92; break
    case '寒波': m = 0.92; break
    case '雪': m = 0.88; break  // G-05: 雪のみ -15% は重すぎたため -12% に圧縮（雨/猛暑/寒波と同帯に揃える）
  }
  // 体育館 or 地域がその天候に適応 → 悪天候デバフを打ち消す
  if ((hasGym || adapted) && m < 1.0) m = 1.0
  // 得意な天候の地域は、その気候下でむしろ好調に練習できる
  if (adapted && weather !== '晴れ' && weather !== '曇り') m = Math.max(m, 1.05)
  return m
}
