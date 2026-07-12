import { useEffect, useState } from 'react'

/**
 * 全画面表示トグル。スマホのブラウザURLバー等を隠して表示領域を最大化する。
 * - Fullscreen API 対応端末（Android Chrome等）: タップで全画面トグル。
 * - iOS Safari（Fullscreen API非対応）: 「ホーム画面に追加」で standalone 起動＝全画面になる案内を出す(#14)。
 *   既に standalone（追加済み）なら全画面なのでボタン自体を出さない。
 */
export function FullscreenButton({ style }: { style?: React.CSSProperties }) {
  const [fs, setFs] = useState(false)
  const [guide, setGuide] = useState(false)

  const fsApiSupported = typeof document !== 'undefined'
    && (document.documentElement.requestFullscreen != null
      // @ts-expect-error ベンダープレフィックス
      || document.documentElement.webkitRequestFullscreen != null)

  const isIOS = typeof navigator !== 'undefined'
    && (/iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)))
  const isStandalone = typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)')?.matches
      // @ts-expect-error iOS Safari 独自プロパティ
      || navigator.standalone === true)

  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // 既に全画面(standalone)＝ボタン不要。Fullscreen API非対応かつiOSでもない＝出しても無意味。
  if (isStandalone) return null
  if (!fsApiSupported && !isIOS) return null

  const toggle = async () => {
    if (!fsApiSupported && isIOS) { setGuide(true); return } // iOS: 案内を出す
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
      } else {
        await document.exitFullscreen?.()
      }
    } catch { /* 端末が拒否したら何もしない */ }
  }

  return (
    <>
      <button onClick={toggle} aria-label="全画面表示"
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 30,
          width: 40, height: 40, borderRadius: 11, border: 'none', cursor: 'pointer',
          background: 'rgba(0,0,0,0.42)', color: '#fff', fontSize: 19, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
          ...style,
        }}>
        {fsApiSupported ? (fs ? '🗗' : '⛶') : '📱'}
      </button>

      {/* iOS向け：ホーム画面に追加で全画面化する手順案内 */}
      {guide && (
        <div onClick={() => setGuide(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(20,28,22,0.82)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#fffdf8', borderRadius: 16, padding: '20px 18px', maxWidth: 320, boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 8 }}>📱 全画面で遊ぶには</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.8, margin: 0, color: '#3a342c' }}>
              iPhone/iPadのSafariでは、下の<b>共有ボタン</b>
              <span style={{ display: 'inline-block', padding: '0 5px' }}>⬆️</span>
              から<br />
              <b>「ホーム画面に追加」</b>を選ぶと、<br />
              アプリのように<b>全画面</b>で起動できます。
            </p>
            <button onClick={() => setGuide(false)}
              style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: 'var(--accent, #f4a261)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              とじる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
