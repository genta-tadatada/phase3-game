// ============================================================
// lib/labels.ts — 日本語ラベル・色・総合力表示
// ============================================================

import type {
  Abilities, Formation, Mentality, Personality, PositionType,
} from '../engine/types'

export const POSITION_LABEL: Record<PositionType, string> = {
  GK: 'GK', CB: 'CB', SB: 'SB', WB: 'WB', DM: 'DM', CM: 'CM', AM: 'AM', WF: 'WF', CF: 'CF',
}

export const POSITION_COLOR: Record<PositionType, string> = {
  GK: '#f4a261', CB: '#457b9d', SB: '#52b788', WB: '#40916c',
  DM: '#1f8a8a', CM: '#2a9d8f', AM: '#9b5de5', WF: '#e76f51', CF: '#e63946',
}

// 身長段階(1〜9) → 目安cm
export const HEIGHT_CM = [0, 158, 162, 165, 168, 171, 174, 178, 182, 187]
export function heightCm(tier: number): number { return HEIGHT_CM[tier] ?? 172 }
/** 選手ごとの表示身長(cm)。tier基準値＋IDから決定的なジッター(-2〜+2)で「全く同じ身長」を散らす(#43)。
 *  tier制（試合計算用）は維持し、見た目のcmだけ個体差を出す。同一選手は常に同じ値。 */
export function heightCmOf(p: { id: string; heightTier: number }): number {
  const base = HEIGHT_CM[p.heightTier] ?? 172
  let h = 0
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0
  return base + ((h % 5) - 2) // -2〜+2cm
}

export const PERSONALITY_LABEL: Record<Personality, string> = {
  leader: 'リーダー', moodmaker: 'ムードメーカー', troublemaker: '問題児',
  genius: '天才肌', shy: '内気', timid: 'ビビり',
  fighter: '闘志家', hotblood: '熱血漢', egoist: 'エゴイスト',
  hardworker: '努力家', mypace: 'マイペース', lazy: '怠け者',
}

export const ABILITY_LABEL: Record<keyof Abilities, string> = {
  kick: 'キック', power: 'パワー', speed: 'スピード', technique: '技術',
  stamina: 'スタミナ', iq: 'IQ', defense: '守備',
}

// 能力アイコン（GPT Image生成・かわいい統一アイコン）。asset()でパス解決。選手カード・入部式等で使用。
export const ABILITY_ICON: Record<keyof Abilities, string> = {
  kick: 'ui/ab-kick.webp', power: 'ui/ab-power.webp', speed: 'ui/ab-speed.webp', technique: 'ui/ab-technique.webp',
  stamina: 'ui/ab-stamina.webp', iq: 'ui/ab-iq.webp', defense: 'ui/ab-defense.webp',
}
// GK固有能力アイコン（同シリーズ・グローブ単体/脳+グローブバッジ）。selector key は GK Abilities フィールド名。
export const GK_ABILITY_ICON: Record<'saving' | 'gkIq', string> = {
  saving: 'ui/ab-saving.webp',
  gkIq: 'ui/ab-gkiq.webp',
}

export const MENTALITY_LABEL: Record<Mentality, string> = {
  'ultra-attack': '超攻撃的', attack: '攻撃的', balance: 'バランス',
  defense: '守備的', 'ultra-defense': '超守備的',
}

export const FORMATION_DESC: Record<Formation, string> = {
  '4-4-2': 'バランス型・守備4枚',
  '4-3-3': '攻撃的・前線3枚',
  '4-2-3-1': '中盤の創造性重視',
  '3-5-2': '中盤を厚く支配',
  '5-3-2': '堅守速攻',
  '3-4-3': '超攻撃的・3バック',
}

/** 総合値 → ティア番号。9=逸材/10=日本の至宝 は基礎能力(最大~693)を超える＝スキル/コンボ持ちのみ到達。 */
function overallTier(sum: number): number {
  if (sum >= 760) return 10
  if (sum >= 700) return 9
  if (sum >= 630) return 8
  if (sum >= 583) return 7
  if (sum >= 513) return 6
  if (sum >= 432) return 5
  if (sum >= 350) return 4
  if (sum >= 257) return 3
  if (sum >= 175) return 2
  return 1
}

// 選手のティア名（正式名称＝label／バッジ短縮＝short）
const PLAYER_TIER: Record<number, { label: string; short: string }> = {
  10: { label: '日本の至宝', short: '至宝' },
  9: { label: '逸材', short: '逸材' }, // prefecture指定時は「○○県の逸材」へ（overallLabel内で差し替え）
  8: { label: '代表候補レベル', short: '代表候補' },
  7: { label: '全国上位レベル', short: '全国上位' },
  6: { label: '全国レベル', short: '全国' },
  5: { label: '都道府県上位レベル', short: '県上位' },
  4: { label: '都道府県レベル', short: '都道府県' },
  3: { label: '市区町村上位レベル', short: '市区上位' },
  2: { label: '市区町村レベル', short: '市区町村' },
  1: { label: '中学生レベル', short: '中学生' },
}
// 高校（チーム）は選手と別の「格」名：7=強豪 / 8=名門 / 9=歴史に残る世代 / 10=伝説の世代
const SCHOOL_OVERRIDE: Record<number, { label: string; short: string }> = {
  10: { label: '伝説の世代', short: '伝説' },
  9: { label: '歴史に残る世代', short: '歴史的' },
  8: { label: '名門', short: '名門' },
  7: { label: '強豪', short: '強豪' },
}

/** 総合値（スキル込み）→ レベル名。kind='school'で高校用の格名（強豪/名門/超名門）。
 *  prefecture指定時、選手のtier9は「○○県の逸材」になる（県の星→日本の至宝へとスコープが上がる）。 */
export function overallLabel(sum: number, kind: 'player' | 'school' = 'player', prefecture?: string): { label: string; short: string; tier: number } {
  const tier = overallTier(sum)
  if (kind === 'player' && tier === 9 && prefecture) {
    return { label: `${prefecture}の逸材`, short: '逸材', tier }
  }
  const name = (kind === 'school' && SCHOOL_OVERRIDE[tier]) ? SCHOOL_OVERRIDE[tier] : PLAYER_TIER[tier]
  return { ...name, tier }
}

export function conditionLabel(c: number): string {
  return ['', '絶不調', '不調', '普通', '好調', '絶好調'][c] ?? '普通'
}

// #53 学校の評判ティア（0-100→6段階）。昇格時に達成感の通知を出す（マイルストーン可視化）。
//   閾値は既存の評判ゲート（スカウトLv30/50/70・マネージャー40・多チーム制）と整合。
const REP_TIER_NAME = ['無名校', '地区で名の知れた校', '県内の強化校', '県を代表する強豪校', '全国に知られる名門校', '全国屈指の名門校']
export function reputationTier(rep: number): number {
  if (rep >= 90) return 5
  if (rep >= 70) return 4
  if (rep >= 50) return 3
  if (rep >= 30) return 2
  if (rep >= 15) return 1
  return 0
}
export function reputationTierName(rep: number): string { return REP_TIER_NAME[reputationTier(rep)] }
/** ティア昇格時の祝福メッセージ（達成感）。到達ティア番号で引く。 */
export function reputationTierUpMessage(tier: number): string {
  return [
    '',
    '部の評判が地区に広まってきた。練習試合の誘いも増えてきたようだ。',
    '県内で「強化校」として注目され始めた。良い入部希望者が集まりやすくなる。',
    '県を代表する強豪校の仲間入りだ。スカウトの範囲も広がり、逸材が振り向く。',
    '全国に名が知られる名門校になった。この看板が、未来の選手たちを呼ぶ。',
    '全国屈指の名門——その名は尊敬を込めて語られる。ここまで来たか、監督。',
  ][tier] ?? ''
}

export function gradeLabel(g: number): string {
  return `${g}年`
}

/** 「2年 FW 田中」形式。能力アップ・スキル開花の通知で誰か一目で分かるように（#11）。 */
export function playerTag(grade: number, pos: PositionType | string, name: string): string {
  const p = POSITION_LABEL[pos as PositionType] ?? pos
  return `${grade}年 ${p} ${name}`
}
