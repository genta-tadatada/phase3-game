import { useGame } from '../store/gameStore'
import {
  playerMatchIndex, playerOpponent, roundName, type Tournament,
} from '../lib/tournament'
import { teamOverall, TeamBadge } from './shared'
import { MENTALITY_LABEL } from '../lib/labels'
import { matchupEdgePct } from '../engine/match/tactics'

function BracketColumn({ t, roundIdx }: { t: Tournament; roundIdx: number }) {
  const round = t.rounds[roundIdx]
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 8 }}>
      <div className="dim center" style={{ fontSize: 10, marginBottom: 2 }}>{roundName(roundIdx)}</div>
      {round.map((m, i) => {
        const home = m.homeId ? t.teams[m.homeId] : null
        const away = m.awayId ? t.teams[m.awayId] : null
        const done = m.winnerId !== null
        const teamLine = (id: string | null, score: number | null) => {
          if (!id) return <div className="bracket-team dim">未定</div>
          const team = t.teams[id]
          const isYou = id === t.playerId
          const cls = done ? (m.winnerId === id ? 'win' : 'lose') : ''
          return (
            <div className={`bracket-team ${cls}`}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isYou && <span className="you-tag">自</span>} {team.shortName}
              </span>
              <span>{score ?? ''}</span>
            </div>
          )
        }
        return (
          <div className="bracket-match" key={i}>
            {teamLine(m.homeId, m.homeScore)}
            {teamLine(m.awayId, m.awayScore)}
            {m.decidedByPK && m.pk && (
              <div className="dim" style={{ fontSize: 10 }}>PK {m.pk[0]}-{m.pk[1]}</div>
            )}
            {!home && !away && <div className="dim" style={{ fontSize: 10 }}>　</div>}
          </div>
        )
      })}
    </div>
  )
}

export function BracketScreen() {
  const tour = useGame((s) => s.tournament)
  const playerTeam = useGame((s) => s.playerTeam)
  const go = useGame((s) => s.go)
  const startPlayerMatch = useGame((s) => s.startPlayerMatch)
  if (!tour || !playerTeam) return null

  const idx = playerMatchIndex(tour)
  const opp = playerOpponent(tour)
  const ov = teamOverall(playerTeam)

  // 戦術相性（プレイヤー視点）— 読んでカウンターする動機を可視化
  const edge = opp ? matchupEdgePct(playerTeam.tactics, opp.tactics) : 0
  const matchup = edge >= 6
    ? { label: '相性 有利', color: 'var(--good)' }
    : edge <= -6
      ? { label: '相性 不利', color: 'var(--bad)' }
      : { label: '相性 互角', color: 'var(--text-dim)' }

  return (
    <div className="screen">
      <div className="app-title">全国高校サッカー選抜大会</div>
      <h1 className="h1">{roundName(tour.roundIndex)}</h1>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, minWidth: 340 }}>
            <BracketColumn t={tour} roundIdx={0} />
            <BracketColumn t={tour} roundIdx={1} />
            <BracketColumn t={tour} roundIdx={2} />
          </div>
        </div>
      </div>

      {opp && idx >= 0 ? (
        <>
          <h2 className="h2">次の対戦相手</h2>
          <div className="panel">
            <div className="row" style={{ alignItems: 'center' }}>
              <div>
                <div className="dim" style={{ fontSize: 11 }}>自チーム</div>
                <TeamBadge team={playerTeam} />
                <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                  戦術: {MENTALITY_LABEL[playerTeam.tactics.mentality]}・{playerTeam.tactics.formation}
                </div>
              </div>
              <div className="center" style={{ flex: '0 0 36px', fontWeight: 800, color: 'var(--accent)' }}>VS</div>
              <div>
                <div className="dim" style={{ fontSize: 11 }}>相手</div>
                <TeamBadge team={opp} />
                <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                  戦術: {MENTALITY_LABEL[opp.tactics.mentality]}・{opp.tactics.formation}
                </div>
              </div>
            </div>
          </div>

          <div className="gap-sm" />
          <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
            <div>
              <div style={{ fontWeight: 800, color: matchup.color }}>{matchup.label}</div>
              <div className="dim" style={{ fontSize: 11 }}>相手の戦術を読んで「戦術変更」で相性を上げよう</div>
            </div>
            <div className="center">
              <div className="dim" style={{ fontSize: 10 }}>相性値</div>
              <div style={{ fontWeight: 800, color: matchup.color }}>{edge > 0 ? '+' : ''}{edge}</div>
            </div>
          </div>
          <div className="gap-sm" />
          <p className="dim center" style={{ fontSize: 11 }}>
            自チーム総合力: {ov.label}　／　相手: {teamOverall(opp).label}
          </p>

          <div className="footer-cta">
            <div className="row">
              <button className="btn ghost" style={{ flex: '0 0 40%' }} onClick={() => go('tactics')}>戦術変更</button>
              <button className="btn" onClick={startPlayerMatch}>試合開始 ▶</button>
            </div>
          </div>
        </>
      ) : (
        <p className="dim center">大会は進行中…</p>
      )}
    </div>
  )
}
