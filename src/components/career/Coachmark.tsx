// ============================================================
// components/career/Coachmark.tsx — 操作式チュートリアル（スポットライト）
//   実際のボタンを光らせ、タップ（操作）で進む。案内役はコーチで固定。
//   data-tut="..." 属性の要素を狙う。advanceScreen の画面に遷移すると自動で次へ。
//   manual ステップ（advanceScreenなし）は「次へ」で進む。常時スキップ可。
// ============================================================

import { useEffect, useState } from 'react'
import { useCareer, type CareerScreen } from '../../store/careerStore'
import { useTutorial } from '../../store/tutorialStore'
import { asset } from '../../ui/asset'

interface TStep {
  screen: CareerScreen          // この画面のときに表示
  target?: string               // 光らせる要素の data-tut 値（無ければ画面下部に案内）
  title: string
  text: string
  advanceScreen?: CareerScreen  // この画面へ遷移したら自動で次へ（=実際に操作させる）
}

// 創部直後(年1の最初)に使えるのは「練習」と「週送り」だけ。それ以外（戦術・スタメン・
// 設備…）は #29 の段階的解放で週ごとに解放され、そのつど物語＋解説イベントで案内される。
// よってこの初回コーチマークは“いま画面にある操作”だけを実際にスポットして教える。
const STEPS: TStep[] = [
  { screen: 'weekly', title: 'ようこそ、監督！', text: '創部おめでとう。この部を、君の手で育てていこう。まずは基本の流れを覚えよう。' },
  { screen: 'weekly', target: 'train-slots', title: '① 練習を選ぶ', text: '今週の練習メニューを選ぶ。選手はここで「武器」を伸ばす。疲労と「伸びる能力」を見て決めよう。' },
  { screen: 'weekly', target: 'advance-btn', title: '② 1週間すすめる', text: '準備ができたら「1週間すすめる」。練習で選手を育て、大会で全国を目指そう！' },
]

export function Coachmark() {
  const step = useTutorial((s) => s.step)
  const next = useTutorial((s) => s.next)
  const skip = useTutorial((s) => s.skip)
  const finish = useTutorial((s) => s.finish)
  const screen = useCareer((s) => s.screen)
  const week = useCareer((s) => s.career?.week ?? 1)
  const hasEvent = useCareer((s) => (s.career?.pendingEvents.length ?? 0) > 0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // チュートリアルは創部直後（1週目）専用。週が進んだら自動終了（実ボタンを押して週送りした等で残らないように）。
  useEffect(() => { if (step >= 0 && week > 1) finish() }, [step, week, finish])

  const cur: TStep | undefined = step >= 0 ? STEPS[step] : undefined
  const onScreen = !!cur && cur.screen === screen

  // 操作（画面遷移）を検知して自動で次へ
  useEffect(() => {
    if (!cur?.advanceScreen) return
    if (screen === cur.advanceScreen) {
      if (step + 1 >= STEPS.length) finish(); else next()
    }
  }, [screen, step, cur, next, finish])

  // ターゲット要素の位置を追従（レイアウト確定・スクロール・リサイズに追従）
  useEffect(() => {
    if (!onScreen || !cur?.target) { setRect(null); return }
    // まず対象を画面内に入れる（下に隠れているとスポットがずれて見える対策）
    const target = document.querySelector(`[data-tut="${cur.target}"]`)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const upd = () => {
      const el = document.querySelector(`[data-tut="${cur.target}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    upd()
    const raf = requestAnimationFrame(upd)
    const iv = window.setInterval(upd, 300)
    window.addEventListener('resize', upd)
    window.addEventListener('scroll', upd, true)
    return () => {
      cancelAnimationFrame(raf); clearInterval(iv)
      window.removeEventListener('resize', upd)
      window.removeEventListener('scroll', upd, true)
    }
  }, [onScreen, cur, step])

  if (step < 0 || !cur) return null
  // イベント吹き出し（解放イベント等）が出ている間は重ねない＝スポットが残って見える混乱を防ぐ
  if (hasEvent) return null

  // 別画面に迷い込んだら、案内は隠してスキップだけ出す（操作の邪魔をしない）
  if (!onScreen) {
    return (
      <button className="btn ghost sm" onClick={skip}
        style={{ position: 'fixed', right: 12, bottom: 76, zIndex: 90, width: 'auto', padding: '6px 12px', boxShadow: 'var(--shadow-card)' }}>
        チュートリアルをやめる
      </button>
    )
  }

  const isLast = step >= STEPS.length - 1
  const manual = !cur.advanceScreen
  const hasSpot = !!cur.target && !!rect
  const vh = window.innerHeight
  const navH = 64 // 下タブ＋セーフエリアぶん。吹き出し・スポットがタブに潜らないように避ける
  // 吹き出しは対象の反対側へ：対象が画面上半分なら下（タブの上）、下半分なら上（HUDの下）に置く＝常に見える＆重ならない
  const targetCenter = rect ? rect.top + rect.height / 2 : vh
  const bubbleAtBottom = !rect || targetCenter < vh * 0.5
  // 左右0＋paddingのflex中央寄せ＝幅をいくら取っても画面から切れない（中央寄せのtransform干渉を回避）
  const bubblePos: React.CSSProperties = bubbleAtBottom
    ? { position: 'fixed', left: 0, right: 0, bottom: navH + 12 }
    : { position: 'fixed', left: 0, right: 0, top: 58 }

  // スポット枠はビューポート内にクランプ（HUDの下〜タブの上）。縦に長い対象でも画面を食い尽くさない。
  const spotTop = rect ? Math.max(54, rect.top - 6) : 0
  const spotBottom = rect ? Math.min(vh - navH - 2, rect.bottom + 6) : 0
  const spotLeft = rect ? Math.max(4, rect.left - 6) : 0
  const spotRight = rect ? Math.min(window.innerWidth - 4, rect.right + 6) : 0

  return (
    <>
      {/* スポットライト: 対象だけ明るく残し、周囲を暗くする（クリックは下の本物のボタンへ通す） */}
      {hasSpot && rect && (
        <div style={{
          position: 'fixed', top: spotTop, left: spotLeft,
          width: Math.max(40, spotRight - spotLeft), height: Math.max(36, spotBottom - spotTop), borderRadius: 14,
          boxShadow: '0 0 0 9999px rgba(28,22,16,0.6)', border: '2.5px solid #fff',
          pointerEvents: 'none', zIndex: 85, transition: 'all 0.2s ease',
          animation: 'tut-pulse 1.4s ease-in-out infinite',
        }} />
      )}
      {/* ターゲットが無い案内では薄い暗幕（画面操作は妨げない＝pointer-events none） */}
      {!hasSpot && <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,22,16,0.28)', zIndex: 84, pointerEvents: 'none' }} />}

      <div style={{ ...bubblePos, zIndex: 90, display: 'flex', justifyContent: 'center', padding: '0 10px', pointerEvents: 'none' }}>
        <div className="panel pop-in" style={{
          width: 'min(360px, 100%)', padding: '12px 14px', pointerEvents: 'auto',
          boxShadow: 'var(--shadow-card), 0 14px 40px rgba(70,50,30,0.3)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <img src={asset('mascot/coach.webp')} alt="" style={{ width: 46, height: 46, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--orange-deep)' }}>{cur.title} <span className="dim" style={{ fontSize: 11, fontWeight: 700 }}>{step + 1}/{STEPS.length}</span></div>
              <div style={{ fontSize: 13, lineHeight: 1.7, marginTop: 3, color: 'var(--ink)' }}>{cur.text}</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn ghost sm" style={{ flex: '0 0 38%' }} onClick={skip}>スキップ</button>
            {manual
              ? <button className="btn sm" onClick={() => { if (isLast) finish(); else next() }}>{isLast ? 'はじめる ▶' : 'つぎ ▶'}</button>
              : <div className="dim center" style={{ flex: 1, fontSize: 11.5, fontWeight: 700, alignSelf: 'center' }}>↑ 操作して進もう</div>}
          </div>
        </div>
      </div>
    </>
  )
}
