// ============================================================
// ui/ManagerAvatar.tsx — マネージャー専用の似顔絵（PlayerAvatar 派生）
//   PlayerAvatar のパーツ（顔/髪/眉/目/口/メガネ）を再利用しつつ、
//   ・seed = name + joinedYear（決定論）
//   ・髪型は女性寄りに偏向（ロン毛・ふんわり寄り。坊主/丸刈り/スキンヘッド/ヤンキーは除外）
//   ・服はジャージではなくセーラー風の制服＋trait カラーのリボン
//   ・表情は常に穏やか（口は笑み）
//   ・GK色/キャプテンマーク/疲労の汗は不要
//   ManagerAvatar.tsx は PlayerAvatar の export を import するだけで重複ロジックを持たない。
// ============================================================

import type { Manager, ManagerTrait } from '../career/manager'
import {
  SKIN, NATURAL_HAIR, DYED_HAIR, LINE,
  hash, faceShape, hairPath, backHair, brows, eyes, glasses, mouth,
  FACE_COUNT, HAIR_COUNT,
} from './PlayerAvatar'

// trait → アクセントカラー（リボン色）。固定画像 manager.webp を使わない方針なので、ここで個性を出す。
const TRAIT_ACCENT: Record<ManagerTrait, string> = {
  caring: '#f29ab1',      // 桜ピンク（面倒見）
  organized: '#7aa8e0',   // 空色（しっかり者）
  cheerful: '#f4cf57',    // 山吹（ムードメーカー）
  analytical: '#7fc285',  // 若草（分析好き）
}

// 女性寄りの髪型インデックス（ロン毛・ふんわり前髪寄り）。
// 除外: 7=坊主・8=丸刈り・11=スキンヘッド・12=ヤンキー
const FEMININE_HAIR = [9, 1, 2, 5, 3, 0, 4, 6, 10]

export function ManagerAvatar({ manager, size = 44 }: { manager: Manager; size?: number }) {
  // 同じマネージャーが常に同じ顔になるよう、name+joinedYear をシードに固定。
  const base = manager.name + '|' + manager.joinedYear
  const seed = (salt: string) => hash(base + '|' + salt)

  const skin = SKIN[seed('skin') % SKIN.length]
  const faceIdx = seed('face') % FACE_COUNT
  // 髪型は女性寄りに偏向。約8%だけ染め髪（毛先カラー的な軽い差別化）。
  const hairIdx = FEMININE_HAIR[seed('hair') % FEMININE_HAIR.length] % HAIR_COUNT
  const dyed = (seed('dye') % 100) < 8
  const hairColor = dyed ? DYED_HAIR[seed('dyecol') % DYED_HAIR.length] : NATURAL_HAIR[seed('haircol') % NATURAL_HAIR.length]
  const browColor = dyed ? '#2a221d' : hairColor
  // 眉はやや女性寄り（細い・カーブ気味）の 0 or 2 を採用。
  const browIdx = (seed('brow') % 2) === 0 ? 0 : 2
  // 目は「キラキラ多め」に寄せる：sparkly(2) を約半分、それ以外は 0/1/3。
  const eyeIdx = (seed('eye') % 100) < 50 ? 2 : (seed('eye2') % 3)
  const hasFreckles = (seed('freckle') % 12) === 0   // 約8%
  const hasGlasses = (seed('glass') % 6) === 0       // 約16%

  const accent = TRAIT_ACCENT[manager.trait]

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${manager.name}の似顔絵`}
      style={{ display: 'block', borderRadius: '50%', background: '#fef5e7' }}>
      {/* セーラー風の制服（白ブラウス＋trait カラーのリボン・襟） */}
      <path d="M18 100 Q18 82 34 78 L50 86 L66 78 Q82 82 82 100 Z" fill="#ffffff" stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      {/* セーラー襟（trait アクセント） */}
      <path d="M38 80 L50 88 L62 80 L60 78 L50 86 L40 78 Z" fill={accent} opacity="0.95" stroke={LINE} strokeWidth="0.9" strokeLinejoin="round" />
      {/* 胸元のリボン */}
      <path d="M46 88 L50 92 L54 88 L57 92 L50 95 L43 92 Z" fill={accent} stroke={LINE} strokeWidth="0.7" strokeLinejoin="round" />
      <circle cx="50" cy="90.5" r="1.4" fill="#ffffff" opacity="0.85" />

      {/* 後ろ髪（ロン毛・アフロ。顔より背面） */}
      {backHair(hairIdx, hairColor)}
      {/* 耳 */}
      <circle cx="22" cy="56" r="5" fill={skin} stroke={LINE} strokeWidth="1.1" />
      <circle cx="78" cy="56" r="5" fill={skin} stroke={LINE} strokeWidth="1.1" />
      {/* 顔（輪郭4種） */}
      {faceShape(faceIdx, skin)}
      {/* 頬の赤み（常時・控えめ＝親しみやすさ） */}
      <g fill="#ff9a9a" opacity="0.45"><circle cx="33" cy="63" r="4" /><circle cx="67" cy="63" r="4" /></g>
      {/* そばかす */}
      {hasFreckles && (
        <g fill="#c98b6a" opacity="0.7">
          <circle cx="36" cy="61" r="0.9" /><circle cx="39" cy="63" r="0.9" /><circle cx="42" cy="61.5" r="0.9" />
          <circle cx="64" cy="61" r="0.9" /><circle cx="61" cy="63" r="0.9" /><circle cx="58" cy="61.5" r="0.9" />
        </g>
      )}
      {/* 髪（前髪/頭頂） */}
      {hairPath(hairIdx, hairColor)}
      {/* 髪飾り（trait アクセント・約25%で出現）＝ヘアピン風 */}
      {(seed('hairpin') % 4) === 0 && (
        <g>
          <circle cx="30" cy="32" r="3.2" fill={accent} stroke={LINE} strokeWidth="0.9" />
          <circle cx="30" cy="32" r="1.2" fill="#ffffff" opacity="0.9" />
        </g>
      )}
      {/* 眉・目・口 */}
      {brows(browIdx, browColor)}
      {eyes(eyeIdx)}
      {hasGlasses && glasses()}
      {/* 表情は常に穏やか（condition=4 相当・口角だけ上がる） */}
      {mouth(4)}
    </svg>
  )
}
