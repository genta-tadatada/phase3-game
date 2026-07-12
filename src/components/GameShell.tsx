// ============================================================
// components/GameShell.tsx — 横長(landscape)ゲームフレーム
//   ・画面ごとのシーン背景（グラウンド/体育館/ロッカー等）を敷く
//   ・上部に常時ステータスHUD（校名/年度週/予算/評判/雰囲気）
//   ・スマホ縦持ち時は「横向きにしてね」案内（横長固定の意図）
//   ・中身（各画面）はかわいいクリーム色のフレーム内に表示
// ============================================================

import type { ReactNode } from 'react'
import { useCareer } from '../store/careerStore'
import { sceneForScreen, sceneUrl, sceneBaseUrl } from '../ui/scenes'
import { atmosphereBand } from '../career/atmosphere'
import { weekLabel, PHASE_LABEL } from '../career/calendar'
import { FullscreenButton } from '../ui/FullscreenButton'
import { BottomNav, useBottomNavVisible } from './career/BottomNav'
import { Coachmark } from './career/Coachmark'

function Hud() {
  const c = useCareer((s) => s.career)!
  const band = atmosphereBand(c.atmosphere)
  return (
    <div className="hud">
      <div className="hud-crest" style={{ background: `linear-gradient(180deg, ${c.color}, ${c.color})` }}>
        {c.schoolName?.[0] ?? '⚽'}
      </div>
      <div className="hud-id">
        <div className="hud-school">{c.schoolName}</div>
        <div className="hud-sub">{c.year}年目・{weekLabel(c.week)}・{PHASE_LABEL[c.phase]}</div>
      </div>
      <div className="hud-stats">
        <div className="hud-pill"><b>{c.reputation}</b><span>評判</span></div>
        <div className="hud-pill"><b>{c.budget}</b><span>予算(万)</span></div>
        <div className="hud-pill"><b>{c.roster.length}</b><span>部員</span></div>
        <div className="hud-pill"><b style={{ color: band.color }}>{band.label}</b><span>雰囲気</span></div>
      </div>
    </div>
  )
}

export function GameShell({ children }: { children: ReactNode }) {
  const screen = useCareer((s) => s.screen)
  const hasCareer = useCareer((s) => !!s.career)
  const weather = useCareer((s) => s.career?.weather)
  const hasGym = useCareer((s) => s.career?.facilities.extras.includes('gym') ?? false)
  const compStage = useCareer((s) => s.comp?.stage)
  // 県予選＝高校の会場（modest）/ 全国＝壮大なスタジアム（grand・大舞台の演出）
  const baseScene = sceneForScreen(screen, weather, hasGym)
  const scene = (screen.startsWith('comp-') && compStage === 'national') ? 'stadium-grand' : baseScene
  const url = sceneUrl(scene, weather)
  const baseUrl = sceneBaseUrl(scene)
  const showHud = hasCareer && screen !== 'title'
  // 下タブがある画面では全画面ボタンを「タブの上」に逃がす（記録タブとの被り防止）。
  const navVisible = useBottomNavVisible(screen)

  return (
    <div className="stage">
      {/* 背景シーン（天候別。バリエーション画像が無ければベース背景にフォールバック） */}
      <img className="stage-bg" key={url} src={url} alt="" aria-hidden
        onError={(e) => { const img = e.currentTarget; if (!img.dataset.fb && img.src !== baseUrl) { img.dataset.fb = '1'; img.src = baseUrl } }} />
      <div className="stage-veil" />

      {/* ゲーム本体フレーム */}
      <div className="frame">
        {showHud && <Hud />}
        {children}
        {/* 下タブは枠内の最下段に置く＝PCの中央ウィンドウでも枠に密着（宙に浮かない） */}
        <BottomNav />
      </div>

      {/* 天候は「背景画像＋天候アイコン」で表現する方針（雨/雪のストライプFXは見えづらいので廃止）。 */}

      {/* 全画面切り替え（web・対応端末のみ表示）。下タブがある画面ではタブの上へ逃がす（被り防止）。 */}
      {showHud && <FullscreenButton style={{ top: 'auto', bottom: navVisible ? 'calc(env(safe-area-inset-bottom) + 64px)' : 'calc(env(safe-area-inset-bottom) + 12px)', right: 12, width: 36, height: 36, fontSize: 17 }} />}

      {/* チュートリアルのスポット/吹き出しは枠の外(.stage直下)に置く＝backdrop-filterの包含ブロックを避け、
          position:fixed が確実にビューポート基準になる（スポット位置ズレ・吹き出し切れを根本回避） */}
      {showHud && <Coachmark />}
    </div>
  )
}
