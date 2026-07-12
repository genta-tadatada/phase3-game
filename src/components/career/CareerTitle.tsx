import { useState, type CSSProperties } from 'react'
import { useCareer } from '../../store/careerStore'
import { useAuth } from '../../store/authStore'
import { PREFECTURES } from '../../data/prefectures'
import { asset } from '../../ui/asset'
import { JapanMap } from './JapanMap'
import { HowToPlay } from './HowToPlay'
import { FullscreenButton } from '../../ui/FullscreenButton'

// 難易度3段階（県のサッカー強度→色）
function diffTier(strength: number): { label: string; color: string; bg: string } {
  if (strength >= 64) return { label: 'むずかしい', color: '#c0392b', bg: '#ffe2dd' }
  if (strength >= 54) return { label: 'ふつう', color: '#b8860b', bg: '#fff2cf' }
  return { label: 'やさしい', color: '#2f8a52', bg: '#d9f5e3' }
}

// 県の特徴（気候・季節の影響＝天候システムと連動 ＋ 競技レベル）
function prefFlavor(p: { name: string; region: string; strength: number }): string {
  const r = p.region
  let climate: string
  if (p.name === '沖縄県') climate = '南国の常夏。夏の暑さは厳しいが冬も暖かく、一年中グラウンドが使える。'
  else if (r === '北海道') climate = '冬は雪と厳しい寒さで屋外練習が止まりがち。体育館（追加設備）の有無が冬場の育成を左右する。'
  else if (r === '東北') climate = '冬の寒さと雪が練習を妨げることも。体育館があれば冬場も安定して鍛えられる。'
  else if (r === '九州') climate = '夏は蒸し暑く体力の消耗が激しい。夏場のスタミナ管理がカギになる。'
  else if (r === '中部') climate = '気候は比較的穏やか。腰を据えてじっくり選手を育てやすい土地。'
  else if (r === '関東' || r === '近畿') climate = '都市部で気候も穏やか。一年を通して練習しやすい環境。'
  else climate = '温暖で過ごしやすく、一年を通して練習に打ち込める気候。'

  let comp: string
  if (p.strength >= 64) comp = '全国屈指の激戦区で、県を勝ち抜くだけでも至難。だが勝てば一気に名が上がる。'
  else if (p.strength >= 54) comp = '実力校がそろう県。県大会も気が抜けない。'
  else comp = 'サッカー強豪は多くなく、県を勝ち抜く好機がある。'

  return `${climate}${comp}`
}

export function CareerTitle() {
  const newCareer = useCareer((s) => s.newCareer)
  const continueCareer = useCareer((s) => s.continueCareer)
  const hasSaveFile = useCareer((s) => s.hasSaveFile)
  const [step, setStep] = useState<'menu' | 'name' | 'location'>('menu')
  const [name, setName] = useState('')
  const [manager, setManager] = useState('')
  const [tutorial, setTutorial] = useState<'beginner' | 'expert'>('beginner')
  const [pref, setPref] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showAccount, setShowAccount] = useState(false) // #54 アカウント（ログイン・クラウド同期）

  // アカウント状態（store/authStore.ts）。ログインは任意＝未ログインでもそのまま遊べる
  const authStatus = useAuth((s) => s.status)
  const authNickname = useAuth((s) => s.nickname)
  const authConflict = useAuth((s) => s.conflict)
  const authBusy = useAuth((s) => s.busy)
  const [nickInput, setNickInput] = useState('')
  const [nickError, setNickError] = useState(false)
  const [editingNick, setEditingNick] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const closeAccount = () => {
    setShowAccount(false)
    setEditingNick(false)
    setConfirmDelete(false)
    setNickError(false)
  }
  const submitNickname = async () => {
    const ok = await useAuth.getState().setNickname(nickInput)
    if (ok) {
      setEditingNick(false)
      setNickError(false)
      setNickInput('')
    } else {
      setNickError(true)
    }
  }
  // モーダル内の控えめなテキストリンク風ボタン
  const linkStyle: CSSProperties = {
    background: 'none', border: 'none', padding: '4px 8px', fontSize: 12, fontWeight: 700,
    color: 'var(--ink-soft)', textDecoration: 'underline', cursor: 'pointer',
  }

  const [logoOk, setLogoOk] = useState(true)

  // ===== タイトルメニュー（全画面ヒーロー） =====
  if (step === 'menu') {
    return (
      <div className="screen title-hero">
        <FullscreenButton />
        <div className="hero-bg" />
        <div className="hero-bg" style={{ backgroundColor: 'transparent', backgroundImage: `url("${asset('bg/title.webp')}")` }} />
        <div className="hero-scrim" />
        <div className="hero-content">
          {/* 上半分：ロゴ＋キャッチ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(8px,1.6vh,16px)', minHeight: 0 }}>
            {logoOk ? (
              <img className="hero-logo" src={asset('title-logo.webp')} alt="高校サッカー部 ただタダ games"
                style={{ filter: 'drop-shadow(0 8px 22px rgba(0,0,0,0.5))', animation: 'float-logo 4.5s ease-in-out infinite' }}
                onError={() => setLogoOk(false)} />
            ) : (
              <div className="center">
                <h1 style={{ fontFamily: 'var(--font-pop)', fontSize: 'clamp(34px,8vw,60px)', lineHeight: 1.05, margin: 0, color: '#fff', textShadow: '0 3px 0 rgba(0,0,0,0.25), 0 6px 18px rgba(0,0,0,0.5)' }}>
                  <span style={{ color: '#aef0c4' }}>高校</span><span style={{ color: '#ffd08a' }}>サッカー部</span>
                </h1>
              </div>
            )}
            <div className="title-tagline">― 創部から、全国の頂点へ ―</div>
          </div>

          {/* 下半分：ボタン。ゲーム内容の3つ（つづき/創部/遊び方）を主役に。 */}
          <div className="hero-buttons" style={{ display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 400, width: '100%', margin: '0 auto' }}>
            {hasSaveFile && <button className="btn lg secondary" onClick={continueCareer}>▶ つづきから</button>}
            <button className="btn lg" onClick={() => setStep('name')}>⚽ あたらしく創部する</button>
            <button className="btn lg ghost" onClick={() => setShowHelp(true)} style={{ background: 'rgba(255,255,255,0.92)' }}>❔ 遊び方</button>
            {/* ゲーム外導線（ホーム・お問い合わせ）は小さく控えめに・縁寄りで主役を邪魔しない */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 6 }}>
              <a href="https://tadatada.net" target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11.5, fontWeight: 700, textDecoration: 'none', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>🏠 ただタダ games ホーム</a>
              <a href="https://tadatada.net/contact" target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11.5, fontWeight: 700, textDecoration: 'none', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>🛠 不具合・お問い合わせ</a>
            </div>
            {/* #54 アカウント/同期（Googleログイン＝任意。クラウドセーブ＝別端末への引き継ぎ） */}
            <button type="button" onClick={() => setShowAccount(true)} aria-label="アカウント・同期"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '4px auto 0', padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.22)', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 800, cursor: 'pointer', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
              {authStatus === 'loading' && <>👤 …</>}
              {authStatus === 'guest' && <>👤 ログインしていません<span style={{ opacity: 0.6 }}>·</span>☁️ ログインで同期</>}
              {authStatus === 'needsNickname' && <>👤 名前を決めてください</>}
              {authStatus === 'member' && <>👤 {authNickname}<span style={{ opacity: 0.6 }}>·</span>☁️ 同期中</>}
            </button>
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: 700, marginTop: 6, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>ただタダ games</div>
          </div>
        </div>
        {showAccount && (
          <div className="event-overlay" style={{ background: 'rgba(38,54,40,0.8)' }} onClick={closeAccount}>
            <div className="event-card pop-in" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
              <div className="event-title" style={{ textAlign: 'center' }}>アカウント・データ同期</div>

              {authStatus === 'loading' && (
                <p className="dim" style={{ fontSize: 13, lineHeight: 1.7, marginTop: 6 }}>アカウントを確認しています…</p>
              )}

              {authStatus === 'guest' && (
                <>
                  <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 6 }}>
                    Googleでログインすると、セーブデータと殿堂を<b>別の端末に引き継げます</b>。無料・登録不要。<br />
                    <span className="dim" style={{ fontSize: 12 }}>氏名やメールは受け取りません。</span>
                  </p>
                  <button className="btn" style={{ marginTop: 8 }} onClick={() => useAuth.getState().login()}>Googleでログイン</button>
                </>
              )}

              {(authStatus === 'needsNickname' || (authStatus === 'member' && editingNick)) && (
                <>
                  <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 6 }}>
                    ただタダ games で表示する名前を決めてください。<span className="dim" style={{ fontSize: 12 }}>（あとで変更できます。）</span>
                  </p>
                  <input className="input" value={nickInput} maxLength={20} placeholder="例: げんた"
                    onChange={(e) => { setNickInput(e.target.value); setNickError(false) }} />
                  {nickError && (
                    <div style={{ color: '#c0392b', fontSize: 12, fontWeight: 700 }}>その名前は使えません。1〜20文字で入力してください。</div>
                  )}
                  <button className="btn" style={{ marginTop: 8 }} disabled={!nickInput.trim() || authBusy}
                    onClick={() => { void submitNickname() }}>決定</button>
                  {authStatus === 'needsNickname' ? (
                    <button type="button" style={linkStyle} disabled={authBusy}
                      onClick={() => { void useAuth.getState().logout() }}>ログアウトする</button>
                  ) : (
                    <button type="button" style={linkStyle}
                      onClick={() => { setEditingNick(false); setNickError(false) }}>やめる</button>
                  )}
                </>
              )}

              {authStatus === 'member' && !editingNick && (
                <>
                  <p style={{ fontSize: 14.5, fontWeight: 800, marginTop: 6, marginBottom: 0 }}>
                    👤 {authNickname}
                    <button type="button" style={{ ...linkStyle, marginLeft: 6, fontSize: 11.5 }}
                      onClick={() => { setNickInput(authNickname ?? ''); setNickError(false); setEditingNick(true) }}>変更</button>
                  </p>
                  <p className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>☁️ セーブデータをこの端末と同期しています</p>
                  <button className="btn ghost" style={{ marginTop: 6 }} disabled={authBusy}
                    onClick={() => { void useAuth.getState().logout() }}>ログアウト</button>
                  {confirmDelete ? (
                    <>
                      <p style={{ color: '#c0392b', fontSize: 12.5, fontWeight: 700, lineHeight: 1.6, marginTop: 8 }}>
                        アカウントとクラウドのセーブが消えます。この端末のローカルセーブは残ります。
                      </p>
                      <button className="btn" disabled={authBusy}
                        style={{ background: 'linear-gradient(180deg, #e2574a, #c0392b)', color: '#fff', boxShadow: '0 4px 0 #8e2a1f, 0 8px 16px rgba(192,57,43,0.3)' }}
                        onClick={() => { void useAuth.getState().deleteAccount() }}>本当に削除する</button>
                      <button type="button" style={linkStyle} onClick={() => setConfirmDelete(false)}>やめる</button>
                    </>
                  ) : (
                    <button type="button" style={{ ...linkStyle, color: '#c0392b' }} onClick={() => setConfirmDelete(true)}>アカウントを削除</button>
                  )}
                </>
              )}

              <button className="btn ghost" style={{ marginTop: 8 }} onClick={closeAccount}>とじる</button>
            </div>
          </div>
        )}
        {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
        {/* クラウド同期の競合（別端末により新しいセーブ）: 明示的にどちらかを選ぶまで閉じない */}
        {authConflict && (
          <div className="event-overlay" style={{ background: 'rgba(38,54,40,0.85)' }}>
            <div className="event-card pop-in" style={{ maxWidth: 340 }}>
              <div className="event-title" style={{ textAlign: 'center' }}>☁️ どちらのセーブを使う？</div>
              <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 6 }}>
                別の端末に、より新しいセーブがあります。どちらを使いますか？
              </p>
              <button className="btn" style={{ marginTop: 8 }} onClick={() => useAuth.getState().resolveConflict('import')}>☁️ クラウドのデータを取り込む</button>
              <button className="btn ghost" onClick={() => useAuth.getState().resolveConflict('keepLocal')}>📱 この端末のデータを使う</button>
              <p className="dim" style={{ fontSize: 11.5, lineHeight: 1.6, marginTop: 4 }}>
                「取り込む」を選ぶと、この端末のセーブ・殿堂・通算成績がクラウドの内容に置き換わります。
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ===== 高校名入力 =====
  if (step === 'name') {
    return (
      <div className="screen title-hero">
        <div className="hero-bg" />
        <div className="hero-bg" style={{ backgroundColor: 'transparent', backgroundImage: `url("${asset('bg/title.webp')}")` }} />
        <div className="hero-scrim" />
        <div className="hero-content" style={{ justifyContent: 'space-between' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 400, width: '100%', margin: '0 auto', minHeight: 0 }}>
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: 12, letterSpacing: '0.2em', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>STEP 1 / 2</div>
            <h1 className="h1 center" style={{ marginTop: 4, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.55)' }}>部の名前を決めよう</h1>
            <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: '16px', boxShadow: '0 14px 40px rgba(0,0,0,0.35)' }}>
              <label className="label">高校の名前</label>
              <input className="input" value={name} maxLength={12} autoFocus
                onChange={(e) => setName(e.target.value)} placeholder="例: 青空高校" />
              <div className="gap-sm" />
              <label className="label">監督名（あなた）</label>
              <input className="input" value={manager} maxLength={8}
                onChange={(e) => setManager(e.target.value)} placeholder="例: 山田" />
              <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>あなたが、この部の創設者であり監督です。あとから変わりません。</div>

              {/* チュートリアル量の選択（#13）。サッカー/ゲームに慣れているかで解説量を変える。 */}
              <div className="gap-sm" />
              <label className="label">ガイドの種類</label>
              <div className="row" style={{ gap: 8 }}>
                {([['beginner', '🔰 初心者', 'サッカーの基礎用語＋ゲーム操作を丁寧に解説。新機能も物語付きで案内。'],
                   ['expert', '⚡ 経験者', 'サッカーの基礎用語は省略。ゲーム操作と新機能は簡潔に説明。サクサク進めたい人向け。']] as const).map(([v, t, d]) => (
                  <button key={v} type="button" className={`chip ${tutorial === v ? 'active' : ''}`}
                    style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', padding: '8px 10px', height: 'auto', textAlign: 'left', whiteSpace: 'normal' }}
                    onClick={() => setTutorial(v)}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{t}</span>
                    <span className="dim" style={{ fontSize: 10.5, lineHeight: 1.4, marginTop: 2 }}>{d}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="row" style={{ maxWidth: 400, width: '100%', margin: '10px auto 0' }}>
            <button className="btn ghost" style={{ flex: '0 0 30%', background: 'rgba(255,255,255,0.92)' }} onClick={() => setStep('menu')}>◀ 戻る</button>
            <button className="btn" disabled={!name.trim()} onClick={() => setStep('location')}>つぎへ ▶</button>
          </div>
        </div>
      </div>
    )
  }

  // ===== 所在地選択（日本地図・難易度カラー） =====
  const shownName = hover ?? pref
  const shown = shownName ? PREFECTURES.find((p) => p.name === shownName) : null
  const shownDiff = shown ? diffTier(shown.strength) : null
  return (
    <div className="screen" style={{ position: 'relative' }}>
      <div className="app-title">STEP 2 / 2</div>
      <h1 className="h1 center" style={{ marginTop: 2 }}>所在地を選ぼう</h1>
      <p className="dim center" style={{ fontSize: 12.5, marginTop: -2 }}>日本地図から選ぶ。色が濃い県ほどサッカーが強い激戦区（難しい）。</p>

      {/* 大きな日本地図＋余白（日本海側）に凡例と説明を重ねる */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 600, margin: '0 auto', aspectRatio: '352 / 400' }}>
        <JapanMap selected={pref} onSelect={setPref} onPreview={setHover} />

        {/* 凡例（左上） */}
        <div style={{ position: 'absolute', top: 4, left: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[['やさしい', '#a9e6c0', '#2f8a52'], ['ふつう', '#ffe39a', '#a9760a'], ['むずかしい', '#f6b6ab', '#c0392b']].map(([l, bg, c]) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: c as string }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: bg as string, border: `2px solid ${c}` }} />{l}
            </span>
          ))}
        </div>

        {/* 説明（左の余白に重ねる） */}
        <div className="pop-in" style={{
          position: 'absolute', top: '22%', left: '0%', width: '46%',
          background: 'rgba(255,255,255,0.94)', borderRadius: 12, padding: '8px 10px',
          boxShadow: 'var(--shadow-soft)', border: `2px solid ${shownDiff?.color ?? 'rgba(74,64,54,0.12)'}`,
        }}>
          {shown && shownDiff ? (
            <>
              <b style={{ fontSize: 15 }}>{shown.name}</b>
              <div style={{ color: shownDiff.color, fontWeight: 800, fontSize: 12.5, marginTop: 1 }}>難易度: {shownDiff.label}</div>
              <div className="dim" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>{prefFlavor(shown)}</div>
            </>
          ) : (
            <div className="dim" style={{ fontSize: 12, lineHeight: 1.6 }}>地図をタップして所在地を選ぼう。<br />PCはカーソルでも説明が出ます。</div>
          )}
        </div>
      </div>

      <div className="footer-cta">
        <div className="row">
          <button className="btn ghost" style={{ flex: '0 0 30%' }} onClick={() => setStep('name')}>◀ 戻る</button>
          <button className="btn" disabled={!pref || !name.trim()} onClick={() => pref && name.trim() && newCareer(name.trim(), pref, manager, tutorial)}>⚽ 創部する ▶</button>
        </div>
      </div>
    </div>
  )
}


