// ============================================================
// components/career/JapanMap.tsx — 本物の日本地図（所在地選択）
// 地図データ: @svg-maps/japan（県の地理的パス・CC BY 4.0 / Victor Cazanave）
// 各県を難易度カラーで塗り、ホバー(PC)/タップ(スマホ)で選択・説明表示。
// ============================================================

import japanMap from '@svg-maps/japan'
import { PREFECTURES } from '../../data/prefectures'

// @svg-maps/japan の英語id → 日本語県名
const EN_TO_JP: Record<string, string> = {
  hokkaido: '北海道', aomori: '青森県', iwate: '岩手県', akita: '秋田県', miyagi: '宮城県',
  yamagata: '山形県', fukushima: '福島県', ibaraki: '茨城県', tochigi: '栃木県', gunma: '群馬県',
  saitama: '埼玉県', chiba: '千葉県', tokyo: '東京都', kanagawa: '神奈川県', niigata: '新潟県',
  toyama: '富山県', ishikawa: '石川県', fukui: '福井県', yamanashi: '山梨県', nagano: '長野県',
  gifu: '岐阜県', shizuoka: '静岡県', aichi: '愛知県', mie: '三重県', shiga: '滋賀県',
  kyoto: '京都府', osaka: '大阪府', hyogo: '兵庫県', nara: '奈良県', wakayama: '和歌山県',
  tottori: '鳥取県', shimane: '島根県', okayama: '岡山県', hiroshima: '広島県', yamaguchi: '山口県',
  tokushima: '徳島県', kagawa: '香川県', ehime: '愛媛県', kochi: '高知県', fukuoka: '福岡県',
  saga: '佐賀県', nagasaki: '長崎県', kumamoto: '熊本県', oita: '大分県', miyazaki: '宮崎県',
  kagoshima: '鹿児島県', okinawa: '沖縄県',
}

function diff(strength: number): { color: string; bg: string } {
  if (strength >= 64) return { color: '#d24a3a', bg: '#f6b6ab' }
  if (strength >= 54) return { color: '#c79014', bg: '#ffe39a' }
  return { color: '#3a9e63', bg: '#a9e6c0' }
}

const BY_JP = Object.fromEntries(PREFECTURES.map((p) => [p.name, p]))

export function JapanMap({
  selected, onSelect, onPreview,
}: {
  selected: string | null
  onSelect: (name: string) => void
  onPreview?: (name: string | null) => void
}) {
  // 選択中の県を最後に描画して前面に出す
  const locs = [...japanMap.locations].sort((a, b) => {
    const aSel = EN_TO_JP[a.id] === selected ? 1 : 0
    const bSel = EN_TO_JP[b.id] === selected ? 1 : 0
    return aSel - bSel
  })
  // 本土の範囲に合わせてviewBoxをcrop（本土が大きく表示される）。
  // 沖縄は遠いので右下に小さなインセットでずらして表示（よくある形）。
  const VIEWBOX = '94 -6 352 400'
  const OKI_TRANSFORM = 'translate(325 -121.5) scale(1)'
  return (
    <svg viewBox={VIEWBOX} style={{ width: '100%', height: '100%', display: 'block', filter: 'drop-shadow(0 4px 8px rgba(70,50,30,0.2))' }}>
      <defs><clipPath id="okiClip"><rect x={334} y={300} width={108} height={92} rx={7} /></clipPath></defs>
      {/* 沖縄インセット（海色背景＋枠・島を拡大して見やすく） */}
      <rect x={334} y={300} width={108} height={92} rx={7} fill="none" stroke="rgba(120,96,60,0.4)" strokeWidth={1} strokeDasharray="4 2.5" />
      {locs.map((loc) => {
        const jp = EN_TO_JP[loc.id]
        const pref = jp ? BY_JP[jp] : null
        if (!pref) return null
        const d = diff(pref.strength)
        const on = selected === jp
        const pathEl = (
          <path d={loc.path} aria-label={jp}
            fill={on ? d.color : d.bg}
            stroke={on ? '#ffffff' : 'rgba(255,255,255,0.7)'}
            strokeWidth={on ? 2 : 0.5}
            style={{ cursor: 'pointer', transition: 'fill 0.12s ease' }}
            onClick={() => onSelect(jp)}
            onMouseEnter={() => onPreview?.(jp)}
            onMouseLeave={() => onPreview?.(null)}>
            <title>{jp}</title>
          </path>
        )
        return loc.id === 'okinawa'
          ? <g key={loc.id} clipPath="url(#okiClip)"><g transform={OKI_TRANSFORM}>{pathEl}</g></g>
          : <g key={loc.id}>{pathEl}</g>
      })}
    </svg>
  )
}
