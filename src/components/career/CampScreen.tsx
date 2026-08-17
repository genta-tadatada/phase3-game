// ============================================================
// components/career/CampScreen.tsx — 夏合宿（7日サブモード・#34）
// 1タップ=1日進行。これまでの出来事はスクロールでさかのぼれる（合宿終了まで）。
// 「監督の判断」イベントでは選択肢を選ぶ＝あなたは監督。
// ============================================================

import { useEffect, useRef } from 'react'
import { useCareer } from '../../store/careerStore'
import { campDayLabel, CAMP_TOTAL_DAYS } from '../../career/camp'
import type { CampEventTag, CampShownEvent } from '../../career/types'

const TAG_ICON: Record<CampEventTag, string> = {
  skill: '✨', boost: '💪', bond: '🔥', personality: '💬', match: '⚽', flavor: '🌅', choice: '🧭',
}
const TAG_TINT: Record<CampEventTag, string> = {
  skill: '#ffcaa6', boost: '#bfe3b0', bond: '#ffd089', personality: '#cdd6f5', match: '#a8d8e8', flavor: '#f0d9b8', choice: '#ffb38a',
}

function DayTracker({ resolved }: { resolved: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', margin: '2px 0 8px' }}>
      {Array.from({ length: CAMP_TOTAL_DAYS }, (_, i) => {
        const n = i + 1
        const done = n <= resolved
        const current = n === resolved + 1
        return (
          <div key={n} style={{
            minWidth: 28, height: 22, borderRadius: 7, fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: done ? 'var(--orange-deep)' : current ? '#fff' : 'rgba(120,100,80,0.14)',
            color: done ? '#fff' : current ? 'var(--orange-deep)' : 'var(--ink-dim)',
            border: current ? '2px solid var(--orange-deep)' : '2px solid transparent',
          }}>{n === 6 ? '⚽' : n === 7 ? '🏠' : n}</div>
        )
      })}
    </div>
  )
}

function EventCard({ ev, pending, onChoose }: { ev: CampShownEvent; pending: boolean; onChoose: (id: string) => void }) {
  return (
    <div className="pop-in" style={{
      background: '#fffdf8', borderRadius: 13, padding: '11px 13px', marginBottom: 8,
      borderLeft: `5px solid ${TAG_TINT[ev.tag]}`, boxShadow: '0 2px 8px rgba(80,60,40,0.07)',
    }}>
      <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink)', marginBottom: 3 }}>{TAG_ICON[ev.tag]} {ev.title}</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.8, fontWeight: 600, color: 'var(--ink)', margin: 0, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{ev.body || '——その日、特筆すべき出来事は起きなかった。'}</p>
      {ev.detail && (
        <div style={{ marginTop: 7, padding: '5px 9px', borderRadius: 8, background: ev.tag === 'skill' ? 'rgba(255,150,90,0.16)' : 'rgba(120,160,90,0.12)', fontSize: 13, fontWeight: 800, color: ev.tag === 'skill' ? 'var(--orange-deep)' : '#4a7a3a' }}>
          {ev.tag === 'skill' ? '🎉 ' : '▶ '}{ev.detail}
        </div>
      )}
      {pending && ev.choice && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9 }}>
          {ev.choice.options.map((o, i) => (
            <button key={i} className="btn secondary sm" style={{ width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 13.5 }} onClick={() => onChoose(o.effectId)}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CampScreen() {
  const career = useCareer((s) => s.career)
  const stage = useCareer((s) => s.campStage)
  const next = useCareer((s) => s.nextCampStep)
  const choose = useCareer((s) => s.resolveCampChoice)
  const camp = career?.activeCamp
  const logRef = useRef<HTMLDivElement | null>(null)

  // 新しい日・選択結果が出たら最新までスクロール
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [camp?.shown.length, stage, camp?.shown[camp.shown.length - 1]?.events.length])

  if (!camp) return null
  const resolved = stage === 'summary' ? CAMP_TOTAL_DAYS : Math.max(0, camp.day - 1)
  const lastDayIdx = camp.shown.length - 1
  const atMakeSummary = camp.day >= CAMP_TOTAL_DAYS && camp.queue.length === 0
  const allEvents = camp.shown.flatMap((d) => d.events)
  const skillLines = allEvents.filter((e) => e.tag === 'skill').map((e) => e.detail!).filter(Boolean)
  const boostCount = allEvents.filter((e) => e.tag === 'boost').length
  const bondCount = allEvents.filter((e) => e.tag === 'bond' || e.tag === 'personality').length

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 12px 16px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', letterSpacing: 1 }}>🏕 夏合宿</div>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', fontWeight: 700, marginBottom: 6 }}>{camp.year}年目・一週間の集中強化</div>
      </div>
      <DayTracker resolved={resolved} />

      <div ref={logRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingRight: 2 }}>
        {stage === 'intro' && (
          <div className="pop-in" style={{ background: '#fffdf8', borderRadius: 14, padding: '18px 16px', textAlign: 'center', boxShadow: '0 2px 10px rgba(80,60,40,0.08)' }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>🚌</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.95, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              いよいよ夏合宿。<br />1日ごとに、いろんな出来事が起きる一週間。<br />監督として判断を下しながら、チームの物語を見守ろう。
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-dim)', fontWeight: 700, marginTop: 12 }}>※この一週間のどこかで、選手が何かのコツを掴むことがある</p>
          </div>
        )}

        {(stage === 'day' || stage === 'choice') && camp.shown.map((d, di) => (
          <div key={di} style={{ marginBottom: 6, opacity: di === lastDayIdx ? 1 : 0.92 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--orange-deep)', margin: '4px 0 6px' }}>📅 {campDayLabel(d.day)}</div>
            {d.events.map((ev, ei) => {
              const isLastEvent = di === lastDayIdx && ei === d.events.length - 1
              return <EventCard key={ei} ev={ev} pending={stage === 'choice' && isLastEvent} onChoose={choose} />
            })}
          </div>
        ))}

        {stage === 'summary' && (
          <div className="pop-in" style={{ background: '#fffdf8', borderRadius: 14, padding: '18px 16px', boxShadow: '0 2px 10px rgba(80,60,40,0.08)' }}>
            <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>🏕 合宿、終了！</div>
            <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-dim)', fontWeight: 700, marginTop: 0 }}>一週間、本当によく頑張った。</p>
            {skillLines.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--orange-deep)', marginBottom: 6 }}>✨ この合宿で掴んだもの（{skillLines.length}）</div>
                {skillLines.map((s, i) => (<div key={i} style={{ padding: '7px 11px', borderRadius: 9, background: 'rgba(255,150,90,0.14)', fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>🎉 {s}</div>))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>新しい武器こそ掴めなかったが、チームの結束は確かに深まった。</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: 'rgba(120,160,90,0.13)' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#4a7a3a' }}>💪 {boostCount}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-dim)' }}>能力アップ</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: 'rgba(255,180,90,0.16)' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#c8841a' }}>🔥 {bondCount}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-dim)' }}>絆・成長の芽</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 選択待ちのときはボタンを出さない（上の選択肢で進む） */}
      {stage !== 'choice' && (
        <button className="btn" style={{ marginTop: 10, fontSize: 16, padding: '13px' }} onClick={next}>
          {stage === 'intro' ? '合宿スタート ▶'
            : stage === 'summary' ? 'メニューに戻る ▶'
            : atMakeSummary ? '合宿のまとめへ ▶'
            : 'つぎ ▶'}
        </button>
      )}
      {stage === 'choice' && <div className="dim" style={{ textAlign: 'center', fontSize: 12, marginTop: 8, fontWeight: 700 }}>監督として、どうする？（上の選択肢から選ぶ）</div>}
    </div>
  )
}
