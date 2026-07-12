import { useEffect, useRef, useState } from 'react'
import { useGame } from '../store/gameStore'
import { Pitch2D } from './Pitch2D'

export function MatchScreen() {
  const result = useGame((s) => s.currentResult)
  const tour = useGame((s) => s.tournament)
  const finishMatch = useGame((s) => s.finishMatch)

  const [idx, setIdx] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const timer = useRef<number | null>(null)

  const steps = result?.steps ?? []
  const last = steps.length - 1
  const atEnd = idx >= last

  useEffect(() => {
    if (!playing || atEnd) return
    const delay = 620 / speed
    timer.current = window.setTimeout(() => setIdx((i) => Math.min(last, i + 1)), delay)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [idx, playing, speed, atEnd, last])

  if (!result || !tour) return null
  const home = tour.teams[result.homeTeamId]
  const away = tour.teams[result.awayTeamId]
  const cur = steps[idx] ?? steps[0]

  // 直近の実況（最大4行）
  const feed = steps.slice(Math.max(0, idx - 3), idx + 1).reverse()

  const skip = () => { setPlaying(false); setIdx(last) }

  return (
    <div className="screen" style={{ paddingBottom: 96 }}>
      {/* スコアボード */}
      <div className="panel" style={{ marginBottom: 10 }}>
        <div className="scoreboard">
          <div className="center" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {home.shortName}
            </div>
            <div style={{ width: 8, height: 8, borderRadius: 3, background: home.color, margin: '4px auto 0' }} />
          </div>
          <div className="score-num">{cur.homeScore}</div>
          <div className="center">
            <div className="clock">{atEnd ? '終了' : `${cur.minute}'`}</div>
            <div className="dim" style={{ fontSize: 10 }}>-</div>
          </div>
          <div className="score-num">{cur.awayScore}</div>
          <div className="center" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {away.shortName}
            </div>
            <div style={{ width: 8, height: 8, borderRadius: 3, background: away.color, margin: '4px auto 0' }} />
          </div>
        </div>
      </div>

      <Pitch2D beat={{ i: cur.step, minute: cur.minute, side: cur.side, zone: 2, lane: 'C', ballX: cur.ballX, ballY: cur.ballY, action: cur.scored ? 'shot-goal' : 'flavor', text: cur.text, homeScore: cur.homeScore, awayScore: cur.awayScore }} home={home} away={away} />

      {/* 進行バー */}
      <div style={{ height: 5, background: 'rgba(0,0,0,0.3)', borderRadius: 3, margin: '10px 0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(idx / last) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s ease' }} />
      </div>

      {/* 実況フィード */}
      <div className="feed">
        {feed.map((s, i) => (
          <div className={`feed-line ${s.scored ? 'goal' : ''}`} key={`${s.step}_${i}`}>{s.text}</div>
        ))}
      </div>

      {result.decidedByPK && atEnd && (
        <div className="panel center" style={{ marginTop: 10 }}>
          PK戦　{home.shortName} {result.homePK} - {result.awayPK} {away.shortName}
        </div>
      )}

      <div className="footer-cta">
        {atEnd ? (
          <button className="btn" onClick={finishMatch}>結果を確定 ▶</button>
        ) : (
          <div className="row">
            <button className="btn ghost" style={{ flex: '0 0 28%' }} onClick={() => setSpeed(speed === 1 ? 2 : 1)}>
              {speed === 1 ? '倍速' : '等速'}
            </button>
            <button className="btn ghost" style={{ flex: '0 0 28%' }} onClick={() => setPlaying((p) => !p)}>
              {playing ? '⏸' : '▶'}
            </button>
            <button className="btn secondary" onClick={skip}>スキップ ⏩</button>
          </div>
        )}
      </div>
    </div>
  )
}
