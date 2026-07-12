// ============================================================
// data/schools.ts — 架空高校名の生成 + 大会名
// 全て創作の合成名。実在校名と一致しないよう生成パターンを設計。
// 権利: 実在校名NG（rights-ledger）→ 抽象語幹×汎用接尾辞で合成。
// ============================================================

import type { RNG } from '../engine/rng'

// 抽象的な語幹（実在の地名ではなく、創作の雰囲気語）。
// 🚨 権利: rights-ledger(2026-06-11)「実在校リストと照合して一致を除外」に基づき、
//    特徴的な実在校に酷似する語幹（星稜/麗澤/暁星/嶺南/泉ヶ丘/錦城/春日丘/海星/武蔵野東/相模原北 等）を除去済。
//    残る一般的な語幹（桜丘/光陵/向陽/清和/金剛 等＝多数の実在校が共有する一般名）と接尾辞の組合せは
//    在席時に research-compliance の WebSearch で全照合する（worklog/rights-ledger起票）。
const STEMS: string[] = [
  '青嵐', '蒼空', '桜丘', '北星', '海王', '緑風', '白鷺', '紅陵', '光陵',
  '聖陵', '東雲', '飛鳥', '玄武', '朱雀', '黎明', '常磐', '若葉', '碧波', '颯雅',
  '天馬', '蹴鷹', '湘嶺', '武陽', '城南台', '翔陽', '陽明', '清和',
  '鳳凰', '神威', '大空', '蒼穹', '黒潮', '銀嶺', '羽衣',
  '向陽', '陽光台', '緑ヶ丘', '青藍', '白虎', '麒麟', '天龍', '北辰',
  '南雲', '東嶺', '西陽', '紫雲', '金剛', '常陸野', '比叡', '阿蘇野',
  '日向灘', '若狭', '越前', '信濃', '出雲崎',
]

// 汎用接尾辞（学校種別・方角など。実在校が完全一致しにくい組み合わせ）
const SUFFIXES: string[] = [
  '学院', '学園', '高校', '工業高校', '実業高校', '第一高校', '総合高校',
  '学院高等部', '附属高校', 'FC高校', '東高校', '西高校', '南高校', '北高校',
  '中央高校', '商業高校', '国際高校', '農業高校',
]

// 🚨 実在校との一致を除外するブロックリスト（rights-ledger 2026-06-11「実在校リストと照合して
//    一致を除外する」の構造実装）。特徴的な実在校・サッカー強豪校の名称断片。生成名がこれを部分的にでも
//    含めば棄却＝**境界アーティファクト**（例「銀嶺＋南高校＝銀嶺南」が実在"嶺南"を含む）も捕捉する。
//    暫定リスト。research-compliance部がWebSearchで随時拡張する（worklog/rights-ledger参照）。
const REAL_SCHOOL_BLOCK: string[] = [
  '嶺南', '星稜', '麗澤', '暁星', '錦城', '泉ヶ丘', '武蔵野', '春日丘', '相模原', '海星',
  '青森山田', '前橋育英', '船橋', '流経', '静岡学園', '東福岡', '国見', '帝京', '桐光', '桐蔭',
  '山梨学院', '尚志', '昌平', '神村', '矢板', '米子北', '富山第一', '丸岡', '鵬学園',
]
/** 生成名が実在校の特徴的名称を含むか（含めば棄却する）。 */
export function isRealSchoolCollision(name: string): boolean {
  return REAL_SCHOOL_BLOCK.some((b) => name.includes(b))
}

/** ランダムな架空高校名を生成（実在校との一致は棄却して再生成）。 */
export function generateSchoolName(rng: RNG): string {
  for (let i = 0; i < 24; i++) {
    const name = rng.pick(STEMS) + rng.pick(SUFFIXES)
    if (!isRealSchoolCollision(name)) return name
  }
  return rng.pick(STEMS) + rng.pick(SUFFIXES) // 万一の保険（通常到達しない）
}

/**
 * 重複しない架空校名を n 校生成（実在校一致も除外）。
 */
export function generateUniqueSchoolNames(rng: RNG, n: number, exclude: string[] = []): string[] {
  const used = new Set(exclude)
  const out: string[] = []
  let guard = 0
  while (out.length < n && guard < n * 40) {
    const name = generateSchoolName(rng)
    if (!used.has(name) && !isRealSchoolCollision(name)) {
      used.add(name)
      out.push(name)
    }
    guard++
  }
  return out
}

/** 校名から略称（ブラケット表示用・先頭2〜3文字 + 識別） */
export function shortenSchoolName(name: string): string {
  // 接尾辞を除いた語幹を略称に
  for (const s of SUFFIXES) {
    if (name.endsWith(s)) return name.slice(0, name.length - s.length)
  }
  return name.slice(0, 3)
}

// 架空の全国大会名（夏季=インハイ相当 / 冬季=選手権相当）
export const TOURNAMENT_NAMES = {
  summer: '全国高校サッカー夏季選手権',
  winter: '全国高校サッカー選抜大会',
} as const
