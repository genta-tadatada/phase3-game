import { Component, type ErrorInfo, type ReactNode } from 'react'

// アプリ全体をラップする最後の受け皿。想定外の例外で画面が真っ白になるのを防ぎ、
// 「再読み込み」で復帰できる優しいエラー画面を出す。復帰しない場合はセーブ初期化の逃げ道も用意する。
// index.css が読めていない可能性も考え、レイアウトは inline style で自己完結させる。
const CAREER_KEYS = ['tadatada_career_v1', 'tadatada_career_v1_bak']

type Props = { children: ReactNode }
type State = { hasError: boolean; confirmReset: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, confirmReset: false }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 復帰の手掛かりとしてコンソールに残す（ユーザー画面には出さない）
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const reload = () => window.location.reload()
    const doReset = () => {
      try {
        for (const k of CAREER_KEYS) localStorage.removeItem(k)
      } catch {
        /* localStorage が使えない環境でもそのまま再読み込みへ進む */
      }
      window.location.reload()
    }

    return (
      <div
        style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box',
          background: '#fbf2e3', color: '#4a4036', textAlign: 'center',
          fontFamily: '"Zen Maru Gothic","M PLUS Rounded 1c",system-ui,sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 360, width: '100%', background: '#fff', borderRadius: 20,
            padding: '28px 22px', boxShadow: '0 18px 50px rgba(74,64,54,0.18)', boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1 }}>⚽</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: '12px 0 0' }}>エラーが発生しました</h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.8, color: '#8a7f70', margin: '10px 0 0' }}>
            うまく表示できませんでした。まずは再読み込みをお試しください。<br />
            セーブデータは残っています。
          </p>
          <button
            onClick={reload}
            style={{
              marginTop: 18, width: '100%', padding: '13px 16px', border: 'none', borderRadius: 14,
              background: 'linear-gradient(180deg,#fb7185,#e11d6b)', color: '#fff',
              fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 5px 0 #b3155a',
            }}
          >
            🔄 再読み込み
          </button>

          {!this.state.confirmReset ? (
            <button
              onClick={() => this.setState({ confirmReset: true })}
              style={{
                marginTop: 12, background: 'none', border: 'none', color: '#8a7f70',
                fontSize: 12, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer',
              }}
            >
              それでも直らないとき：セーブを初期化
            </button>
          ) : (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12.5, lineHeight: 1.7, color: '#c0392b', fontWeight: 700, margin: 0 }}>
                この端末のセーブデータを消して最初からにします。よろしいですか？
              </p>
              <button
                onClick={doReset}
                style={{
                  marginTop: 10, width: '100%', padding: '11px 16px', border: 'none', borderRadius: 12,
                  background: '#c0392b', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}
              >
                セーブを消して再起動
              </button>
              <button
                onClick={() => this.setState({ confirmReset: false })}
                style={{
                  marginTop: 8, background: 'none', border: 'none', color: '#8a7f70',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                やめる
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
}
