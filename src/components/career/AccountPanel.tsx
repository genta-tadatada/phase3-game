// ============================================================
// components/career/AccountPanel.tsx — ただただアカウント（ログイン・クラウド同期）UI
//
// 2026-08-17: もともと CareerTitle.tsx にベタ書きだったモーダルを切り出した。
//   タイトル画面と記録画面の両方から同じUIを出すため（記録画面からの導線＝C群）。
//   ログインは任意。未ログインでも全機能そのまま遊べる（同期だけの付加価値）。
//   画面に出すのはニックネームだけ（サーバが返すのも loggedIn / nickname のみ）。
// ============================================================

import { useState, type CSSProperties } from 'react'
import { useAuth } from '../../store/authStore'

/** モーダル内の控えめなテキストリンク風ボタン */
const linkStyle: CSSProperties = {
  background: 'none', border: 'none', padding: '4px 8px', fontSize: 12, fontWeight: 700,
  color: 'var(--ink-soft)', textDecoration: 'underline', cursor: 'pointer',
}

/** アカウント・データ同期モーダル。呼び出し側は開閉だけ管理する。 */
export function AccountModal({ onClose }: { onClose: () => void }) {
  const status = useAuth((s) => s.status)
  const nickname = useAuth((s) => s.nickname)
  const busy = useAuth((s) => s.busy)
  const [nickInput, setNickInput] = useState('')
  const [nickError, setNickError] = useState(false)
  const [editingNick, setEditingNick] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  return (
    <div className="event-overlay" style={{ background: 'rgba(38,54,40,0.8)' }} onClick={onClose}>
      <div className="event-card pop-in" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
        <div className="event-title" style={{ textAlign: 'center' }}>アカウント・データ同期</div>

        {status === 'loading' && (
          <p className="dim" style={{ fontSize: 13, lineHeight: 1.7, marginTop: 6 }}>アカウントを確認しています…</p>
        )}

        {status === 'guest' && (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 6 }}>
              Googleでログインすると、セーブデータと殿堂を<b>別の端末に引き継げます</b>。無料・登録不要。<br />
              <span className="dim" style={{ fontSize: 12 }}>氏名やメールは受け取りません。</span>
            </p>
            <button className="btn" style={{ marginTop: 8 }} onClick={() => useAuth.getState().login()}>Googleでログイン</button>
          </>
        )}

        {(status === 'needsNickname' || (status === 'member' && editingNick)) && (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 6 }}>
              ただタダ games で表示する名前を決めてください。<span className="dim" style={{ fontSize: 12 }}>（あとで変更できます。）</span>
            </p>
            <input className="input" value={nickInput} maxLength={20} placeholder="例: げんた"
              onChange={(e) => { setNickInput(e.target.value); setNickError(false) }} />
            {nickError && (
              <div style={{ color: '#c0392b', fontSize: 12, fontWeight: 700 }}>その名前は使えません。1〜20文字で入力してください。</div>
            )}
            <button className="btn" style={{ marginTop: 8 }} disabled={!nickInput.trim() || busy}
              onClick={() => { void submitNickname() }}>決定</button>
            {status === 'needsNickname' ? (
              <button type="button" style={linkStyle} disabled={busy}
                onClick={() => { void useAuth.getState().logout() }}>ログアウトする</button>
            ) : (
              <button type="button" style={linkStyle}
                onClick={() => { setEditingNick(false); setNickError(false) }}>やめる</button>
            )}
          </>
        )}

        {status === 'member' && !editingNick && (
          <>
            <p style={{ fontSize: 14.5, fontWeight: 800, marginTop: 6, marginBottom: 0 }}>
              👤 {nickname}
              <button type="button" style={{ ...linkStyle, marginLeft: 6, fontSize: 11.5 }}
                onClick={() => { setNickInput(nickname ?? ''); setNickError(false); setEditingNick(true) }}>変更</button>
            </p>
            <p className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>☁️ セーブデータをこの端末と同期しています</p>
            <button className="btn ghost" style={{ marginTop: 6 }} disabled={busy}
              onClick={() => { void useAuth.getState().logout() }}>ログアウト</button>
            {confirmDelete ? (
              <>
                <p style={{ color: '#c0392b', fontSize: 12.5, fontWeight: 700, lineHeight: 1.6, marginTop: 8 }}>
                  アカウントとクラウドのセーブが消えます。この端末のローカルセーブは残ります。
                </p>
                <button className="btn" disabled={busy}
                  style={{ background: 'linear-gradient(180deg, #e2574a, #c0392b)', color: '#fff', boxShadow: '0 4px 0 #8e2a1f, 0 8px 16px rgba(192,57,43,0.3)' }}
                  onClick={() => { void useAuth.getState().deleteAccount() }}>本当に削除する</button>
                <button type="button" style={linkStyle} onClick={() => setConfirmDelete(false)}>やめる</button>
              </>
            ) : (
              <button type="button" style={{ ...linkStyle, color: '#c0392b' }} onClick={() => setConfirmDelete(true)}>アカウントを削除</button>
            )}
          </>
        )}

        <button className="btn ghost" style={{ marginTop: 8 }} onClick={onClose}>とじる</button>
      </div>
    </div>
  )
}

/** 記録画面に置くアカウントカード（C群）。
 *  「この記録はどこに保存されているか」を先に伝えてから、アカウントを作る理由を示す。 */
export function AccountRecordsCard() {
  const status = useAuth((s) => s.status)
  const nickname = useAuth((s) => s.nickname)
  const [open, setOpen] = useState(false)

  return (
    <>
      {status === 'member' ? (
        <div className="panel" style={{ marginBottom: 12, padding: '10px 12px' }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>☁️ この記録はアカウントに保存されています</div>
          <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.6, marginTop: 3 }}>
            👤 {nickname}　—　ブラウザの履歴を消しても、別の端末でログインすれば続きから遊べます。
          </div>
          <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>アカウント設定</button>
        </div>
      ) : (
        <div className="panel tint-orange" style={{ marginBottom: 12, padding: '10px 12px' }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>📱 この記録はこの端末にだけ残っています</div>
          <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.6, marginTop: 3 }}>
            ブラウザの履歴を消すと、部の歩みも殿堂も消えてしまいます。<br />
            ただただのアカウントを作れば記録がクラウドに残り、スマホでもパソコンでも同じ続きから遊べます。無料・登録不要。
          </div>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
            {status === 'needsNickname' ? '名前を決めて記録を残す' : 'アカウントを作って記録を残す'}
          </button>
        </div>
      )}
      {open && <AccountModal onClose={() => setOpen(false)} />}
    </>
  )
}
