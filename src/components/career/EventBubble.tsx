// ============================================================
// components/career/EventBubble.tsx — イベントを前面の吹き出しで表示
// 文章は端的・大きく。長いものはページ分割して1画面ずつ見せる。
// イベントに合うイラスト（events/*.webp）。無ければ監督マスコット。
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WeekEvent } from '../../career/types'
import { asset } from '../../ui/asset'

const EVENT_IMG: Record<string, string> = {
  founding: 'events/founding.webp',
}
// id接頭辞での画像割り当て（年度ごとにidが変わるイベント）
function eventImage(ev: WeekEvent): string {
  if (EVENT_IMG[ev.id]) return EVENT_IMG[ev.id]
  if (ev.id.startsWith('retire-')) return 'events/retire.webp'     // 3年生引退（#33・透過）
  if (ev.id.startsWith('intake-')) return 'events/teammates.webp'  // 新入生入部（既存teammates絵）
  // Z-2 画像バッチ受け入れ枠（外部AI生成画像が配置されたら自動反映・未配置時はonErrorでcoach.webpへフォールバック）
  if (ev.id.startsWith('scout-result-ok-')) return 'events/scout-success.webp'  // G-43 スカウト成功
  if (ev.id.startsWith('scout-result-ng-')) return 'events/scout-fail.webp'    // G-43 スカウト失敗
  // G-32 マネージャー系: 立ち絵は手続き生成（ManagerAvatar 流用予定）方針に変更。固定画像は不使用＝coach.webp フォールバック。
  if (ev.id.startsWith('inherit-')) return 'events/inherit.webp'   // 卒業＝先輩からスキル継承（#34）
  if (ev.id.startsWith('captaincy-')) return 'events/captaincy.webp' // 新キャプテン覚醒（#34）
  if (ev.id.startsWith('compskill-') || ev.id.startsWith('selskill-')) return 'events/skill-bloom.webp' // 山場で特殊能力開花（#34）
  if (ev.id.startsWith('fl-camp') || ev.id.startsWith('fl-run') || ev.id.includes('practice')) return 'events/practice.webp'
  if (ev.id.startsWith('fl-exam')) return 'events/meeting.webp'
  if (ev.id.startsWith('news') || ev.kind === 'news') return 'events/tournament.webp'
  // 選択イベント・部活の一コマ（仲間との場面）はチームメイトのイラストで
  if (ev.kind === 'choice' || ev.id.startsWith('fl-gen') || ev.id.startsWith('ch-')) return 'events/teammates.webp'
  return 'mascot/coach.webp'
}

// 本文をページに分割。改行(\n)があれば著者が指定した意味の切れ目で分ける。
// 無ければ1文ずつ（短い隣接文のみ結合）＝ページ内で話が飛ばないようにする。
function paginate(body: string): string[] {
  if (body.includes('\n')) {
    const lines = body.split('\n').map((s) => s.trim()).filter(Boolean)
    if (lines.length) return lines
  }
  const sentences = body.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean)
  const pages: string[] = []
  let cur = ''
  for (const s of sentences) {
    // ごく短い文だけ前のページに足す（24字未満）。それ以外は1文1ページ。
    if (cur && (cur + s).length <= 24) cur += s
    else { if (cur) pages.push(cur); cur = s }
  }
  if (cur) pages.push(cur)
  return pages.length ? pages : [body]
}

export function EventBubble({ ev, onResolve }: { ev: WeekEvent; onResolve: (effectId: string) => void }) {
  const [img, setImg] = useState(eventImage(ev))
  const [page, setPage] = useState(0)
  const pages = useMemo(() => paginate(ev.body), [ev.body])
  // G-44: 連続イベントで page/img の state が次のイベントへ持ち越され、
  //   「2ページ目から表示」「タイトルだけで本文空白」になっていたバグの修正。ev.id が変わったら必ず初期化。
  useEffect(() => {
    setPage(0)
    setImg(eventImage(ev))
  }, [ev.id])
  const isChoice = ev.kind === 'choice' && ev.options && ev.options.length > 0
  const lastPage = page >= pages.length - 1
  const touchX = useRef<number | null>(null)
  // スワイプ：左で次・右で戻る（理想形）。ボタンでも可。
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (dx < -45 && !lastPage) setPage((p) => p + 1)
    else if (dx > 45 && page > 0) setPage((p) => p - 1)
  }

  return (
    <div className="event-overlay">
      {/* F1.5: PC前面パネルの横幅活用（週次イベントは最頻出のオーバーレイ）。 */}
      <div className="event-card pop-in" style={{ maxWidth: 'min(94vw, 620px)' }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX }} onTouchEnd={onTouchEnd}>
        <div className="event-illust-wrap">
          <img className="event-illust" src={asset(img)} alt=""
            onError={() => { if (img !== 'mascot/coach.webp') setImg('mascot/coach.webp') }} />
        </div>
        <div className="event-body-wrap">
          <div className="event-title">📣 {ev.title}</div>
          <p style={{ fontSize: 16.5, lineHeight: 1.95, fontWeight: 600, color: 'var(--ink)', marginTop: 8, minHeight: 64, wordBreak: 'keep-all', lineBreak: 'strict', overflowWrap: 'anywhere' }}>
            {pages[page]}
          </p>

          {/* ページ表示（複数ページ時） */}
          {pages.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, margin: '2px 0 8px' }}>
              {pages.map((_, i) => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === page ? 'var(--orange-deep)' : 'rgba(74,64,54,0.2)' }} />
              ))}
            </div>
          )}

          {/* イベントの影響（フレーバー/ニュースで雰囲気・評判が動いた場合に明示） */}
          {lastPage && ev.effect && ((ev.effect.atmo ?? 0) !== 0 || (ev.effect.rep ?? 0) !== 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4, marginBottom: 6 }}>
              {ev.effect.atmo !== undefined && ev.effect.atmo !== 0 && (
                <span style={{ background: ev.effect.atmo > 0 ? '#dff0e6' : '#fce8e0', color: ev.effect.atmo > 0 ? '#1f7a4d' : '#a8512a', fontSize: 12, fontWeight: 800, borderRadius: 8, padding: '3px 9px' }}>
                  🎈 雰囲気 {ev.effect.atmo > 0 ? '+' : ''}{ev.effect.atmo}
                </span>
              )}
              {ev.effect.rep !== undefined && ev.effect.rep !== 0 && (
                <span style={{ background: ev.effect.rep > 0 ? '#dff0e6' : '#fce8e0', color: ev.effect.rep > 0 ? '#1f7a4d' : '#a8512a', fontSize: 12, fontWeight: 800, borderRadius: 8, padding: '3px 9px' }}>
                  🏆 評判 {ev.effect.rep > 0 ? '+' : ''}{ev.effect.rep}
                </span>
              )}
            </div>
          )}

          <div className="row" style={{ gap: 8 }}>
            {page > 0 && <button className="btn ghost sm" style={{ flex: '0 0 32%' }} onClick={() => setPage((p) => p - 1)}>◀ もどる</button>}
            {!lastPage ? (
              <button className="btn" onClick={() => setPage((p) => p + 1)}>つぎ ▶</button>
            ) : isChoice ? (
              <div className="event-actions" style={{ flex: 1 }}>
                {ev.options!.map((o, i) => (
                  <button key={i} className="btn secondary sm" onClick={() => onResolve(o.effectId)}>{o.label}</button>
                ))}
              </div>
            ) : (
              <button className="btn" onClick={() => onResolve('')}>はじめる ▶</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
