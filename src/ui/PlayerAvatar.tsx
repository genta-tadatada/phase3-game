// ============================================================
// ui/PlayerAvatar.tsx — デフォルメ可愛キャラの顔を自動生成（栄冠ナイン風）
//   player.id をシードにパーツ（肌/顔型/髪型/髪色/目/眉/メガネ/そばかす）を決定的に組合せ。
//   輪郭線＋大きな目で「手描き感」を出し、表情は condition / fatigue に連動。
//   純SVG・軽量・設定機能なし。差別化のため顔型4・髪型11・メガネ/そばかす等を用意。
// ============================================================

import type { Player } from '../engine/types'
import { POSITION_COLOR } from '../lib/labels'

export const SKIN = ['#ffe0bd', '#f7caa0', '#ecb084', '#d29a6b', '#fff0db', '#c08552']
// 髪色は日本人の自然色（黒〜濃茶）を主流に。黒・近黒を厚めに重み付け。
export const NATURAL_HAIR = ['#1f1a17', '#1f1a17', '#1f1a17', '#211b17', '#211b17', '#2a221d', '#3b2f2a', '#3b2f2a', '#4a3526', '#5a3a22']
// 染め色（派手）は問題児系のみ稀に出る。紫・赤・金・明るい茶・ピンク。
export const DYED_HAIR = ['#6b4f8a', '#a23b2e', '#d9a441', '#caa472', '#b5546f']
export const LINE = '#4a3b2e' // 共通の輪郭線色（手描き感）

export function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const FACE_COUNT = 4
// --- 顔の輪郭4種（上部は揃え、アゴ/輪郭で差別化＝全員丸顔にしない） ---
export function faceShape(idx: number, skin: string) {
  const s = { fill: skin, stroke: LINE, strokeWidth: 1.4, strokeLinejoin: 'round' as const }
  switch (idx % FACE_COUNT) {
    case 0: // 丸顔（標準）
      return <circle cx="50" cy="53" r="30" {...s} />
    case 1: // 卵型（やや面長・アゴ細め）
      return <path d="M20 50 Q20 23 50 23 Q80 23 80 50 Q80 76 50 85 Q20 76 20 50 Z" {...s} />
    case 2: // エラ張り（角ばった四角顔）
      return <path d="M21 48 Q21 24 50 24 Q79 24 79 48 L78 64 Q73 80 50 81 Q27 80 22 64 Z" {...s} />
    default: // 細面（シャープ・アゴ尖り）
      return <path d="M23 50 Q22 25 50 24 Q78 25 77 50 Q73 73 50 84 Q27 73 23 50 Z" {...s} />
  }
}

export const HAIR_COUNT = 13
// --- 後ろ髪（顔より先に描画＝背面）。ロン毛・アフロ用 ---
export function backHair(idx: number, color: string) {
  const s = { fill: color, stroke: LINE, strokeWidth: 1.2, strokeLinejoin: 'round' as const }
  if (idx % HAIR_COUNT === 9) // ロン毛：両サイドに長い毛束
    return <g {...s}><path d="M15 84 Q12 38 24 34 L28 64 L25 84 Z" /><path d="M85 84 Q88 38 76 34 L72 64 L75 84 Z" /></g>
  if (idx % HAIR_COUNT === 10) // アフロ：頭の後ろに大きな丸い毛量（雲状の丸でモコモコ感）
    return (
      <g {...s}>
        <circle cx="50" cy="30" r="33" />
        <circle cx="24" cy="40" r="13" /><circle cx="76" cy="40" r="13" />
        <circle cx="32" cy="20" r="13" /><circle cx="68" cy="20" r="13" /><circle cx="50" cy="14" r="14" />
      </g>
    )
  return null
}

// --- 前髪/頭頂の髪 11種（頭: 中心(50,52) を覆う・輪郭線付き） ---
export function hairPath(idx: number, color: string) {
  const s = { fill: color, stroke: LINE, strokeWidth: 1.3, strokeLinejoin: 'round' as const }
  switch (idx % HAIR_COUNT) {
    case 0: return <path d="M21 50 Q20 22 50 20 Q80 22 79 50 L72 40 L66 50 L58 38 L50 50 L42 38 L34 50 L28 40 Z" {...s} />
    case 1: return <path d="M19 54 Q19 19 50 19 Q81 19 81 54 Q70 40 50 42 Q30 40 19 54 Z" {...s} />
    case 2: return <path d="M20 52 Q20 20 50 21 Q80 20 80 52 Q66 39 50 41 Q34 39 20 52 Z M50 21 L50 41" {...s} />
    case 3: return <path d="M20 50 Q18 20 52 20 Q82 21 80 48 Q74 38 56 40 Q60 30 44 30 Q30 32 30 46 Z" {...s} />
    case 4: return <path d="M23 46 Q24 24 50 23 Q76 24 77 46 Q66 36 50 37 Q34 36 23 46 Z" {...s} />
    case 5: return <path d="M19 52 Q16 24 30 22 Q34 14 50 18 Q66 14 70 22 Q84 24 81 52 Q74 42 66 48 Q62 40 54 44 Q50 36 46 44 Q38 40 34 48 Q26 42 19 52 Z" {...s} />
    case 6: return <path d="M20 48 Q22 18 50 19 Q78 18 80 48 Q72 36 62 39 L58 28 Q50 33 42 28 L38 39 Q28 36 20 48 Z" {...s} />
    case 7: return <path d="M24 44 Q24 22 50 22 Q76 22 76 44 Q64 34 50 35 Q36 34 24 44 Z" {...s} />  // 坊主（短い）
    case 8: return <path d="M28 41 Q30 26 50 26 Q70 26 72 41 Q62 36 50 36.5 Q38 36 28 41 Z" {...s} />  // 丸刈り（ごく短い）
    case 9: return <path d="M19 56 Q18 20 50 19 Q82 20 81 56 Q74 42 64 44 Q60 30 50 32 Q40 30 36 44 Q26 42 19 56 Z" {...s} /> // ロン毛（前髪・後ろはbackHair）
    case 10: return <path d="M22 40 Q20 14 50 13 Q80 14 78 40 Q64 30 50 31 Q36 30 22 40 Z" {...s} /> // アフロ前面の盛り
    case 11: return <ellipse cx="44" cy="33" rx="11" ry="5.5" fill="#fff" opacity="0.16" /> // スキンヘッド（地肌＋艶のみ）
    case 12: return <path d="M22 52 Q18 28 30 24 Q30 8 50 12 Q72 8 74 26 Q82 30 80 52 Q72 40 60 42 Q64 22 48 22 Q34 24 36 40 Q28 44 22 52 Z" {...s} /> // ヤンキー（リーゼント風の盛り）
    default: return <path d="M21 50 Q20 22 50 20 Q80 22 79 50 L72 40 L66 50 L58 38 L50 50 L42 38 L34 50 L28 40 Z" {...s} />
  }
}

// --- 眉3種 ---
export function brows(idx: number, color: string) {
  const s = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, fill: 'none' }
  switch (idx % 3) {
    case 0: return <g {...s}><path d="M34 47 q5 -2 9 0" /><path d="M57 47 q4 -2 9 0" /></g>
    case 1: return <g {...s}><path d="M34 46 h9" /><path d="M57 46 h9" /></g>
    default: return <g {...s}><path d="M34 48 q5 -3 9 -1" /><path d="M57 47 q4 -2 9 1" /></g>
  }
}

// --- 目4種（大きめ・ハイライト付きで可愛く） ---
export function eyes(idx: number) {
  const c = '#2c2622'
  switch (idx % 4) {
    case 0: return <g><circle cx="40" cy="56" r="4.4" fill={c} /><circle cx="60" cy="56" r="4.4" fill={c} /><circle cx="41.6" cy="54.3" r="1.5" fill="#fff" /><circle cx="61.6" cy="54.3" r="1.5" fill="#fff" /></g>
    case 1: return <g><ellipse cx="40" cy="56" rx="3.4" ry="4.6" fill={c} /><ellipse cx="60" cy="56" rx="3.4" ry="4.6" fill={c} /><circle cx="41.4" cy="54.2" r="1.3" fill="#fff" /><circle cx="61.4" cy="54.2" r="1.3" fill="#fff" /></g>
    case 2: return <g><circle cx="40" cy="56" r="4.6" fill={c} /><circle cx="60" cy="56" r="4.6" fill={c} /><circle cx="38.6" cy="54.4" r="1.6" fill="#fff" /><circle cx="58.6" cy="54.4" r="1.6" fill="#fff" /><circle cx="41.4" cy="57.6" r="0.9" fill="#fff" opacity="0.6" /><circle cx="61.4" cy="57.6" r="0.9" fill="#fff" opacity="0.6" /></g>
    default: return <g fill={c}><circle cx="40" cy="55" r="3.8" /><circle cx="60" cy="55" r="3.8" /><circle cx="41.2" cy="53.5" r="1.3" fill="#fff" /><circle cx="61.2" cy="53.5" r="1.3" fill="#fff" /></g>
  }
}

// --- メガネ（一部の選手） ---
export function glasses() {
  return (
    <g stroke={LINE} strokeWidth="1.6" fill="none">
      <circle cx="40" cy="56" r="6.2" fill="#fff" fillOpacity="0.18" />
      <circle cx="60" cy="56" r="6.2" fill="#fff" fillOpacity="0.18" />
      <path d="M46.2 55 h7.6" />
      <path d="M33.8 54.5 l-5 -1.6" />
      <path d="M66.2 54.5 l5 -1.6" />
    </g>
  )
}

// --- 表情（口）: condition 1〜5 ---
export function mouth(condition: number) {
  const c = '#9a5440'
  if (condition >= 5) return <path d="M42 65 Q50 75 58 65 Q50 70 42 65 Z" fill="#c0604a" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
  if (condition === 4) return <path d="M44 66 Q50 72 56 66" stroke={c} strokeWidth="2.4" fill="none" strokeLinecap="round" />
  if (condition === 3) return <path d="M45 67 q5 1.5 10 0" stroke={c} strokeWidth="2.4" fill="none" strokeLinecap="round" />
  if (condition === 2) return <path d="M44 69 Q50 65 56 69" stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round" />
  return <path d="M44 70 Q50 64 56 70" stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round" />
}

export function PlayerAvatar({ player, size = 44 }: { player: Player; size?: number }) {
  // 特徴ごとに独立したハッシュ（ビットシフト流用だと相関して「似た髪」が出やすいので塩を変える）
  const base = player.id || player.name
  const seed = (salt: string) => hash(base + '|' + salt)
  const skin = SKIN[seed('skin') % SKIN.length]
  const eyeIdx = seed('eye') % 4
  const browIdx = seed('brow') % 3
  const faceIdx = seed('face') % FACE_COUNT
  const hasFreckles = (seed('freckle') % 7) === 0      // 約14%がそばかす

  // 髪型・メガネは性格傾向を反映（決定論的）。
  const pers = player.personality
  const WILD = pers === 'troublemaker' || pers === 'egoist' || pers === 'hotblood' // 問題児・エゴ・熱血＝派手髪寄り
  const NEAT = pers === 'leader' || pers === 'hardworker' || pers === 'shy' || pers === 'timid' // 真面目寄り＝整った髪
  // 髪色：基本は自然色。問題児系の約35%だけ染めている（＝紫など派手色は全体の数%に収まる）。
  const dyed = WILD && (seed('dye') % 100) < 35
  const hairColor = dyed ? DYED_HAIR[seed('dyecol') % DYED_HAIR.length] : NATURAL_HAIR[seed('haircol') % NATURAL_HAIR.length]
  const FLASHY = [12, 9, 10, 7, 11] // ヤンキー/ロン毛/アフロ/坊主/スキンヘッド
  let hairIdx = seed('hair') % HAIR_COUNT
  if (WILD && seed('wild') % 100 < 50) hairIdx = FLASHY[seed('flashy') % FLASHY.length] // 5割で派手髪
  else if (NEAT && hairIdx > 6) hairIdx = seed('neat') % 7 // 真面目はおとなしい0-6へ寄せる
  // メガネ率：天才肌/内気/努力家は高め(1/3)、問題児/エゴは低め(1/12)、他は1/5
  const glassDenom = (pers === 'genius' || pers === 'shy' || pers === 'hardworker') ? 3
    : (pers === 'troublemaker' || pers === 'egoist') ? 12 : 5
  const hasGlasses = (seed('glass') % glassDenom) === 0
  const browColor = dyed ? '#2a221d' : hairColor // 染めていても眉は暗いまま（自然）
  const jersey = player.isGK ? '#f4a261' : POSITION_COLOR[player.slot ?? player.position]
  const cond = player.condition ?? 3
  const tired = (player.fatigue ?? 0) >= 70
  const happy = cond >= 4

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${player.name}の似顔絵`}
      style={{ display: 'block', borderRadius: '50%', background: '#fef5e7' }}>
      {/* ジャージ（肩・襟） */}
      <path d="M18 100 Q18 82 34 78 L50 86 L66 78 Q82 82 82 100 Z" fill={jersey} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M40 80 L50 88 L60 80 L56 78 L50 83 L44 78 Z" fill="#ffffff" opacity="0.92" />
      {/* 後ろ髪（ロン毛・アフロ。顔より背面） */}
      {backHair(hairIdx, hairColor)}
      {/* 耳 */}
      <circle cx="22" cy="56" r="5" fill={skin} stroke={LINE} strokeWidth="1.1" />
      <circle cx="78" cy="56" r="5" fill={skin} stroke={LINE} strokeWidth="1.1" />
      {/* 顔（輪郭4種） */}
      {faceShape(faceIdx, skin)}
      {/* 頬の赤み（好調時） */}
      {happy && <g fill="#ff9a9a" opacity="0.55"><circle cx="33" cy="63" r="4.5" /><circle cx="67" cy="63" r="4.5" /></g>}
      {/* そばかす（一部） */}
      {hasFreckles && <g fill="#c98b6a" opacity="0.7"><circle cx="36" cy="61" r="0.9" /><circle cx="39" cy="63" r="0.9" /><circle cx="42" cy="61.5" r="0.9" /><circle cx="64" cy="61" r="0.9" /><circle cx="61" cy="63" r="0.9" /><circle cx="58" cy="61.5" r="0.9" /></g>}
      {/* 髪（前髪/頭頂） */}
      {hairPath(hairIdx, hairColor)}
      {/* 眉・目・口 */}
      {brows(browIdx, browColor)}
      {eyes(eyeIdx)}
      {hasGlasses && glasses()}
      {mouth(cond)}
      {/* 疲労の汗 */}
      {tired && <path d="M76 44 q-4 6 0 9 q4 -3 0 -9 Z" fill="#7fd0f5" stroke="#5bb6e0" strokeWidth="0.7" />}
      {/* キャプテンマーク */}
      {player.isCaptain && <g><rect x="30" y="74" width="14" height="7" rx="2" fill="#ffd23f" stroke={LINE} strokeWidth="0.7" /><text x="37" y="80" fontSize="6" fontWeight="700" fill="#7a5a00" textAnchor="middle">C</text></g>}
    </svg>
  )
}
