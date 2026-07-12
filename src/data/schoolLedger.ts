// ============================================================
// data/schoolLedger.ts — 県別固有スクール台帳（#30 全国/県構造再設計の土台）
// 各都道府県に「固有名・固有の強さ・特色タグ」を持つ高校を事前定義する。
// 動的ランダム生成をやめ、prefシード固定で“常に同じ顔ぶれ”を作る＝固有台帳。
//
// 🚨 校名は完全に架空（schools.ts の合成語幹×接尾辞）。実在校と一致しないよう設計。
// ✅ 強さ・特色は現実の強豪県/プレースタイルを「架空名で再現」。迷ったら気候を源にする
//    （寒冷=フィジカル堅守／猛暑=スタミナ／都市部=技巧派）＝事実ベースで権利的に安全。
// ============================================================

import { createRNG, hashSeed } from '../engine/rng'
import { PREFECTURES, findPrefecture } from './prefectures'
import { generateUniqueSchoolNames, shortenSchoolName } from './schools'

// 特色タグ（#45 相手の特徴表示に流用）。気候・地方から導けるようにする。
export type SchoolFeature = '堅守速攻' | '大型FW' | '技巧派' | 'フィジカル堅守' | 'スタミナ自慢' | '総合力'
export const SCHOOL_FEATURES: SchoolFeature[] = ['堅守速攻', '大型FW', '技巧派', 'フィジカル堅守', 'スタミナ自慢', '総合力']

export interface LedgerSchool {
  name: string
  shortName: string
  prefecture: string
  strength: number      // チーム強度（generateTeam用・概ね28〜96）
  feature: SchoolFeature
  rank: number          // 県内序列（0=県最強）
}

// --- 強豪13県（固有の強さ上位13）。spec: 「難しい県の数＝13」は固定（全国60の整合）。---
// 現実の強さ再現の結果で振り分けが変わってよいが、数は13で固定。top-13 by (strength desc, index asc)。
export const STRONG_PREF_COUNT = 13
const STRONG_SET: Set<string> = new Set(
  [...PREFECTURES]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.strength - a.p.strength || a.i - b.i)
    .slice(0, STRONG_PREF_COUNT)
    .map((x) => x.p.name),
)
export function isStrongPref(name: string): boolean { return STRONG_SET.has(name) }
/** #30: 全国出場枠。強豪13県＝2枠／他34県＝1枠。13×2 + 34×1 = 60。 */
export function prefBerthsLedger(name: string): number { return STRONG_SET.has(name) ? 2 : 1 }

/** 県の難易度ランク（#30 所在地難易度連動の表示用）。 */
export function prefDifficulty(name: string): 'hard' | 'normal' | 'easy' {
  if (STRONG_SET.has(name)) return 'hard'
  return findPrefecture(name).strength >= 54 ? 'normal' : 'easy'
}

// 気候・地方→特色の重み付き候補（先頭ほど出やすい）。実在名は使わず「らしさ」だけ再現。
function featurePoolFor(prefName: string): SchoolFeature[] {
  const pref = findPrefecture(prefName)
  const r = pref.region
  // 寒冷・雪国（北海道/東北/中部日本海側）＝フィジカル堅守・スタミナ系
  const snowy = r === '北海道' || r === '東北' || ['新潟県', '富山県', '石川県', '福井県', '長野県'].includes(prefName)
  // 南国・猛暑（南九州・沖縄）＝スタミナ・運動量
  const hot = ['宮崎県', '鹿児島県', '沖縄県', '高知県'].includes(prefName)
  // 都市部（強豪都市圏）＝技巧派・総合力
  const urban = ['東京都', '神奈川県', '大阪府', '埼玉県', '千葉県', '愛知県', '京都府', '兵庫県', '福岡県'].includes(prefName)
  if (snowy) return ['フィジカル堅守', 'スタミナ自慢', '堅守速攻', '大型FW', '総合力', '技巧派']
  if (hot) return ['スタミナ自慢', '堅守速攻', '技巧派', '大型FW', '総合力', 'フィジカル堅守']
  if (urban) return ['技巧派', '総合力', '堅守速攻', '大型FW', 'スタミナ自慢', 'フィジカル堅守']
  // 標準＝バランス（地方の個性は弱め）
  return ['総合力', '堅守速攻', '技巧派', '大型FW', 'フィジカル堅守', 'スタミナ自慢']
}

// --- 県ごとの台帳キャッシュ（同一プロセス内で安定） ---
const LEDGER_CACHE = new Map<string, LedgerSchool[]>()

/**
 * 県の固有スクール台帳を返す（決定的・キャッシュ）。
 * 強豪県=32校／他=16校。県最強の強さは pref.strength から導出し、序列で逓減。
 * 特色は気候プール＋pref固定シードで安定割当。
 */
export function prefectureSchools(prefName: string): LedgerSchool[] {
  const cached = LEDGER_CACHE.get(prefName)
  if (cached) return cached

  const pref = findPrefecture(prefName)
  const strong = STRONG_SET.has(prefName)
  const count = strong ? 32 : 16
  // 県最強校の強さ。難易度の開きを広げる（係数0.66・上限90）＝難県の決勝/準決勝級を強くし、
  //   「最初の全国出場/優勝が難県ほど遅い」を成立させる（げんた様方針）。やさしい≈73/普通≈77/強豪≈86-90。
  // Z-2: 上限 87→85 にさらに微緩和。Z-1 で 87 にしたが 強good=20.5年 / 最強good=20.5年 と
  //   +0.5年オーバー（goalは全国20年以内）。85 cap は 最強帯(strength≥70) を主に -2 し、
  //   強帯(strength 60-69) は s=69 prefs(ceiling=86) のみ -1 影響。弱/中帯(strength≤59) は
  //   ceiling≤79 で無関係＝局所緩和に近い効果になる。
  const ceiling = Math.max(71, Math.min(85, Math.round(40 + pref.strength * 0.66)))
  // 序列最下位の強さ（県の裾野）。#53「序盤=初勝利保証」のため最弱校は新チーム(~28)が勝てる帯に下げる。
  //   旧floor(易県43)は創部直後が初戦すら勝てず＝離脱要因だった（year1-winnability実測）。
  //   裾野を広げても全国出場は上位校のみ＝全国難度は不変。やさしい県の最弱≈27/普通≈33/強豪≈39。
  // ceiling引き上げ後も最弱校(初戦相手)は新チームが勝てる帯に保つ（#53「初戦は勝てる」維持）。
  //   ＝裾野を広げる（強豪ほど大きく引く）。強豪最弱≈38/普通≈31/やさしい≈27。
  const floor = Math.max(24, ceiling - (strong ? 52 : 46))

  const rng = createRNG(hashSeed(`ledger-${prefName}`))
  const names = generateUniqueSchoolNames(rng, count)
  const pool = featurePoolFor(prefName)

  const schools: LedgerSchool[] = names.map((name, rank) => {
    // 序列0(最強)→count-1(最弱)で ceiling→floor へ。やや上に密度（決勝級の壁）。
    const t = count <= 1 ? 0 : rank / (count - 1)
    const curved = Math.pow(t, 1.15) // 上位を僅かに離す（県最強の格）
    const base = ceiling - (ceiling - floor) * curved
    const jitter = (rng.next() - 0.5) * 4 // ±2の個体差
    const strength = Math.max(28, Math.min(96, Math.round(base + jitter)))
    // 特色：上位校は気候プール先頭寄り（県の“らしさ”を体現）、下位はばらける。
    const idx = rank < 4 ? rng.pick([0, 0, 1]) : Math.floor(rng.next() * pool.length)
    return { name, shortName: shortenSchoolName(name), prefecture: prefName, strength, feature: pool[idx], rank }
  })

  // 強度降順で序列を確定（rank0＝県最強）。jitterによる順位逆転をならす。
  schools.sort((a, b) => b.strength - a.strength)
  schools.forEach((s, i) => { s.rank = i })

  LEDGER_CACHE.set(prefName, schools)
  return schools
}

/** 県の全国出場校（固有の強さ上位 berths 校）を返す。 */
export function nationalQualifiers(prefName: string): LedgerSchool[] {
  return prefectureSchools(prefName).slice(0, prefBerthsLedger(prefName))
}
