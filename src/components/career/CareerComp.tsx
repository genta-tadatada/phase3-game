import { useMemo, useState } from 'react'
import { useCareer } from '../../store/careerStore'
import { MatchView, type HalfTimeControls } from '../MatchView'
import type { MatchResult } from '../../engine/types'
import { teamOverall, rankColor } from '../shared'
import { matchupEdgePct } from '../../engine/match/tactics'
import {
  playerMatchIndex, playerOpponent, roundName, playerPath, type Tournament,
} from '../../lib/tournament'
import { MENTALITY_LABEL, POSITION_LABEL, FORMATION_DESC, overallLabel } from '../../lib/labels'
import { playerOverallSum } from '../../engine/match/teamQuality'
import { climateMattersFor, climateMatchCoef, WEATHER_ICON, type Weather } from '../../career/weather'
import { prefBerths } from '../../career/competition'
import { prefDifficulty } from '../../data/schoolLedger'
import { featureUnlocked } from '../../career/unlocks'
import { Confetti, CountUp } from '../../ui/celebrate'
import { asset } from '../../ui/asset'

function BracketCol({ t, r }: { t: Tournament; r: number }) {
  const round = t.rounds[r]
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 6 }}>
      <div className="dim center" style={{ fontSize: 10 }}>{roundName(r, t.rounds.length)}</div>
      {round.map((m, i) => {
        const done = m.winnerId !== null
        const line = (id: string | null, score: number | null) => {
          if (!id) return <div className="bracket-team dim">未定</div>
          const team = t.teams[id]
          const you = id === t.playerId
          const win = done && m.winnerId === id
          const cls = done ? (win ? 'win' : 'lose') : ''
          // 強さレベルタグ（現実にはないがゲーム的に楽しい＝相手の格が一目で分かる）
          const s11 = team.players.slice(0, 11)
          const lv = s11.length ? overallLabel(s11.reduce((a, p) => a + playerOverallSum(p), 0) / s11.length, 'school') : null
          return (
            <div className={`bracket-team ${cls}`}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: team.color, flexShrink: 0, opacity: cls === 'lose' ? 0.4 : 1 }} />
                {you && <span className="you-tag">自</span>}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.shortName}</span>
                {lv && <span style={{ flexShrink: 0, fontSize: 8.5, fontWeight: 900, color: '#fff', background: rankColor(lv.tier), borderRadius: 4, padding: '0 3px' }}>{lv.short}</span>}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>{win && <span style={{ color: 'var(--green-deep)' }}>✓</span>}{score ?? ''}</span>
            </div>
          )
        }
        const mine = m.homeId === t.playerId || m.awayId === t.playerId
        return (
          <div className="bracket-match" key={i} style={mine ? { border: '2px solid var(--orange)', boxShadow: '0 0 0 3px var(--orange-pastel)' } : undefined}>
            {line(m.homeId, m.homeScore)}
            {line(m.awayId, m.awayScore)}
            {m.decidedByPK && m.pk && <div className="dim" style={{ fontSize: 10 }}>PK {m.pk[0]}-{m.pk[1]}</div>}
          </div>
        )
      })}
    </div>
  )
}

export function CareerBracket() {
  const comp = useCareer((s) => s.comp)
  const career = useCareer((s) => s.career)
  const startCompMatch = useCareer((s) => s.startCompMatch)
  const [showFull, setShowFull] = useState(false)
  if (!comp || !career) return null
  const t = comp.tournament
  const player = t.teams[t.playerId]
  const idx = playerMatchIndex(t)
  const opp = playerOpponent(t)
  // #25: 戦術相性は「大会突入時のスナップショット(player.tactics)」ではなく、
  // 試合の合間に変更できるライブ戦術(career.tactics)で計算する＝表示と実試合を一致させる。
  const edge = opp ? matchupEdgePct(career.tactics, opp.tactics) : 0
  // #25: チーム力差を主役に。先発11人の総合平均差で勝敗の見込みを示す（戦術相性は補助）。
  const starterAvg = (tm: Tournament['teams'][string]) => {
    const s = tm.players.slice(0, 11)
    return s.length ? s.reduce((a, p) => a + playerOverallSum(p), 0) / s.length : 0
  }
  // G-31: 自校の戦力は LIVE 状態（編成変更・スタメン変更が即時反映）から算出する。
  //   旧実装はスナップショット tm.players.slice(0, 11) のため、スタメン変更後も数値が古いまま。
  //   案(b)採用：スタメンの平均総合力をリアルタイム表示。
  const liveStarterAvg = () => {
    const active = career.roster.filter((p) => !p.retired && (p.squad ?? 'A') === 'A')
    const top = [...active].sort((a, b) => playerOverallSum(b) - playerOverallSum(a)).slice(0, 11)
    return top.length ? top.reduce((s, p) => s + playerOverallSum(p), 0) / top.length : 0
  }
  const strDiff = opp ? liveStarterAvg() - starterAvg(opp) : 0
  const strVerdict = strDiff >= 8 ? { l: '戦力で上回る', c: 'var(--good)' }
    : strDiff <= -8 ? { l: '戦力で劣る', c: 'var(--bad)' }
    : { l: '戦力は互角', c: 'var(--text-dim)' }
  const matchup = edge >= 6 ? { l: '有利', c: 'var(--good)' } : edge <= -6 ? { l: '不利', c: 'var(--bad)' } : { l: '互角', c: 'var(--text-dim)' }
  const stageLabel = comp.stage === 'qualify' ? `${comp.kind === 'summer' ? '夏季' : '冬季'}大会 県予選` : `${comp.kind === 'summer' ? '夏季' : '冬季'}大会 全国`

  return (
    <div className="screen">
      <div className="app-title">{stageLabel}</div>
      {comp.transitionMsg && (
        <div className="panel center" style={{ marginBottom: 10, borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 800 }}>
          🎉 {comp.transitionMsg}
        </div>
      )}
      <h1 className="h1">{roundName(t.roundIndex, t.rounds.length)}
        {idx >= 0 && <span className="dim" style={{ fontSize: 13, fontWeight: 700, marginLeft: 8 }}>優勝まであと{t.rounds.length - t.roundIndex}勝</span>}
      </h1>
      {/* 大会モードの案内（#11）：大会期間は練習なし・暦は2試合で約1週すすむ */}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', marginTop: -2, marginBottom: 6 }}>
        🏟 大会モード — 試合の合間に戦術・スタメンを調整できる。大会中は練習はお休み（2試合で約1週すすむ）。
      </div>

      {comp.stage === 'qualify' && (() => {
        const berths = prefBerths(career.prefecture)
        const diff = prefDifficulty(career.prefecture)
        const diffInfo = diff === 'hard' ? { l: '激戦区', c: 'var(--bad)' } : diff === 'normal' ? { l: '標準', c: 'var(--ink-soft)' } : { l: 'やさしい', c: 'var(--good)' }
        return (
          <div className="dim" style={{ fontSize: 11.5, marginBottom: 8, lineHeight: 1.5 }}>
            <span style={{ color: diffInfo.c, fontWeight: 800 }}>難易度 {diffInfo.l}</span>
            <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
            🎟 全国出場枠 <b>{berths}</b>{berths >= 2 ? '（激戦区＝準優勝でも全国へ）' : '（優勝で全国）'}
          </div>
        )
      })()}

      {comp.stage === 'national' && (() => {
        // 🎲 抽選会＋pot表示。全国はpot制（強さ帯ごとに抽選）＝毎回違う組み合わせ。
        // 自分が何potかで成長を可視化（pot番号が小さいほど格上）。
        const avg = (tm: Tournament['teams'][string]) => { const s = tm.players.slice(0, 11); return s.length ? s.reduce((a, p) => a + playerOverallSum(p), 0) / s.length : 0 }
        const all = Object.values(t.teams)
        const sorted = [...all].sort((a, b) => avg(b) - avg(a))
        const rank = sorted.findIndex((tm) => tm.id === t.playerId)
        const pot = Math.floor(Math.max(0, rank) / 4) + 1
        const totalPots = Math.ceil(all.length / 4)
        const prev = career.lastNatPot // 前回の全国でのpot（立ち位置の変化＝やりがい）
        const trend = prev != null && prev !== pot
          ? <span style={{ color: pot < prev ? 'var(--good)' : 'var(--bad)', fontWeight: 800 }}>（前回 Pot {prev} → {pot < prev ? '↑上昇' : '↓後退'}）</span>
          : null
        return (
          <div style={{ fontSize: 11.5, marginBottom: 8, lineHeight: 1.6, background: 'var(--orange-pastel)', borderRadius: 9, padding: '7px 10px' }}>
            🎲 <b>組み合わせ抽選</b>：全国大会は、出場校を強さごとのグループ（ポット）に分けてから抽選する。だから毎年ちがう顔ぶれと当たる。
            あなたは <b style={{ color: 'var(--orange-deep)', fontFamily: 'var(--font-num)' }}>Pot {pot}</b> <span className="dim">/ {totalPots}</span>（数字が小さいグループほど格上。<b>全国での今の立ち位置</b>だ）{trend}。
            <span className="dim"> 各校の強さタグで格が分かる。下の「全体を見る」でトーナメント表を全部見られる。</span>
          </div>
        )
      })()}

      {/* スマホでは全ブラケットが潰れるので「自分の勝ち上がり」を大きく表示。全表は折りたたみ。 */}
      <div className="panel" style={{ marginBottom: 10, padding: '8px 10px' }}>
        <div className="section-label" style={{ marginBottom: 6 }}>🛤 あなたの勝ち上がり</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {t.rounds.map((round, r) => {
            const m = round.find((x) => x.homeId === t.playerId || x.awayId === t.playerId)
            const rn = roundName(r, t.rounds.length)
            if (!m) {
              return (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, background: 'rgba(120,100,80,0.06)', color: 'var(--ink-dim)', fontSize: 12.5 }}>
                  <b style={{ minWidth: 60 }}>{rn}</b><span>{r <= t.roundIndex ? '—' : '勝ち上がると相手が決まる'}</span>
                </div>
              )
            }
            const oppId = m.homeId === t.playerId ? m.awayId : m.homeId
            const oppTeam = oppId ? t.teams[oppId] : null
            const done = m.winnerId !== null
            const win = done && m.winnerId === t.playerId
            const myScore = m.homeId === t.playerId ? m.homeScore : m.awayScore
            const opScore = m.homeId === t.playerId ? m.awayScore : m.homeScore
            const cur = r === t.roundIndex && !done
            const pkStr = m.decidedByPK && m.pk ? ` (PK ${m.homeId === t.playerId ? m.pk[0] : m.pk[1]}-${m.homeId === t.playerId ? m.pk[1] : m.pk[0]})` : ''
            return (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
                background: cur ? 'rgba(255,150,90,0.14)' : '#fffdf8',
                borderLeft: `5px solid ${done ? (win ? 'var(--green-deep)' : '#d24a3a') : cur ? 'var(--orange)' : 'var(--card-edge)'}` }}>
                <b style={{ minWidth: 58, fontSize: 12, color: 'var(--ink-dim)' }}>{rn}</b>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {oppTeam && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 3, background: oppTeam.color, marginRight: 5 }} />}
                  vs {oppTeam ? oppTeam.shortName : '？？？'}
                </span>
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 900, color: done ? (win ? 'var(--green-deep)' : '#d24a3a') : 'var(--accent)' }}>
                  {done ? `${win ? '○' : '●'} ${myScore}-${opScore}${pkStr}` : cur ? 'これから' : '—'}
                </span>
              </div>
            )
          })}
        </div>
        <button className="btn ghost sm" style={{ marginTop: 8, width: '100%' }} onClick={() => setShowFull((v) => !v)}>
          {showFull ? '▲ 全トーナメント表を隠す' : '▼ 全トーナメント表を見る'}
        </button>
        {showFull && (() => {
          // #30 全国60校等の大ブラケットは1回戦が多すぎて縦に潰れる→読める上位ラウンド(≤8試合)のみ表示。
          const startR = Math.max(0, t.rounds.findIndex((round) => round.length <= 8))
          const shown = t.rounds.map((_, r) => r).filter((r) => r >= startR)
          return (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              {startR > 0 && <div className="dim" style={{ fontSize: 10.5, marginBottom: 4 }}>※ 校数が多いため上位ラウンド（ベスト{2 ** (t.rounds.length - startR)}〜）のみ表示</div>}
              <div style={{ display: 'flex', gap: 10, minWidth: shown.length * 150 }}>
                {shown.map((r) => <BracketCol key={r} t={t} r={r} />)}
              </div>
            </div>
          )
        })()}
      </div>

      {opp && idx >= 0 ? (
        <>
          <h2 className="h2">次の対戦</h2>
          <div className="panel">
            <div className="row" style={{ alignItems: 'center' }}>
              <div><div className="dim" style={{ fontSize: 11 }}>自校</div><b>{player.shortName}</b><div className="dim" style={{ fontSize: 11 }}>{teamOverall(player).label}</div></div>
              <div className="center" style={{ flex: '0 0 30px', color: 'var(--accent)', fontWeight: 800 }}>VS</div>
              <div><div className="dim" style={{ fontSize: 11 }}>{opp.prefecture}</div><b>{opp.shortName}</b><div className="dim" style={{ fontSize: 11 }}>{teamOverall(opp).label}・{MENTALITY_LABEL[opp.tactics.mentality]}</div></div>
            </div>
            {/* #25: チーム力差を大きく主役に／戦術相性は小さく補助に */}
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <div style={{ color: strVerdict.c, fontWeight: 900, fontSize: 16 }}>{strVerdict.l}</div>
              <div className="dim" style={{ fontSize: 11, marginTop: 3 }}>
                戦力差 {strDiff > 0 ? '+' : ''}{Math.round(strDiff)}
                <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                戦術相性 <span style={{ color: matchup.c, fontWeight: 700 }}>{matchup.l}（{edge > 0 ? '+' : ''}{edge}）</span>
              </div>
            </div>
          </div>

          {/* 試合前スカウティング（相手分析）＝采配のヒント */}
          {(() => {
            const danger = [...opp.players.slice(0, 11)].sort((a, b) => playerOverallSum(b) - playerOverallSum(a)).slice(0, 3)
            const m = opp.tactics.mentality
            const tendency = m === 'ultra-attack' || m === 'attack' ? '攻撃的に来る。守備の準備を。'
              : m === 'defense' || m === 'ultra-defense' ? '守備的に引いてくる。崩す工夫を。'
              : 'バランス型。互角の展開になりやすい。'
            return (
              <div className="panel" style={{ marginTop: 8, padding: '10px 12px' }}>
                <div className="section-label" style={{ marginBottom: 6 }}>🔍 相手スカウティング</div>
                {(() => {
                  const w = career.weather as Weather | undefined
                  if (!w || !climateMattersFor(w)) return null
                  const me = climateMatchCoef(player.prefecture, w)
                  const op = climateMatchCoef(opp.prefecture, w)
                  const verdict = me > op ? `${w}は自校に有利！` : op > me ? `${w}は相手に有利…` : `${w}：両校とも影響あり`
                  const col = me > op ? 'var(--good)' : op > me ? 'var(--bad)' : 'var(--ink-soft)'
                  return <div style={{ fontSize: 12, fontWeight: 800, color: col, marginBottom: 6 }}>{WEATHER_ICON[w]} {verdict}<span className="dim" style={{ fontWeight: 600 }}>（出身地域の気候適性）</span></div>
                })()}
                {opp.feature && (
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>
                    🏷 特色：{opp.feature}
                  </div>
                )}
                <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>
                  布陣 <b style={{ color: 'var(--ink)' }}>{opp.tactics.formation}</b>・{FORMATION_DESC[opp.tactics.formation]}／{tendency}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 3 }}>警戒すべき選手</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {danger.map((p) => (
                    <span key={p.id} className="tag" style={{ background: 'var(--orange-pastel)', color: 'var(--orange-edge)', fontSize: 11.5, padding: '3px 9px' }}>
                      {POSITION_LABEL[p.slot ?? p.position]} {p.name}（{Math.round(playerOverallSum(p) / 7)}）
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}

          <div className="footer-cta">
            <div className="row">
              <button className="btn ghost" style={{ flex: '0 0 42%' }} onClick={() => useCareer.getState().go('lineup')}>⚙ 戦術・スタメン</button>
              <button className="btn" onClick={startCompMatch}>試合開始 ▶</button>
            </div>
          </div>
        </>
      ) : (
        <p className="dim center">大会進行中…</p>
      )}
    </div>
  )
}

export function CareerMatch() {
  const comp = useCareer((s) => s.comp)
  const c = useCareer((s) => s.career)
  const finishCompMatch = useCareer((s) => s.finishCompMatch)
  const halfTimeSub = useCareer((s) => s.halfTimeSub)
  const halfTimeTactics = useCareer((s) => s.halfTimeTactics)
  const continueCompMatch = useCareer((s) => s.continueCompMatch)
  if (!comp) return null
  const half = comp.matchHalf
  // 後半確定後は完成版resultを再生。未確定なら前半までのbeatsで暫定resultを合成。
  // F7注意: result はレンダーごとに新オブジェクトリテラルにすると、子(MatchView)で
  // 「result識別子の変化 = 試合切替」と誤検知される。深い依存(beats参照・スコア・
  // セグメントindex)が変わったときだけ新オブジェクトを返すよう useMemo で安定化する。
  // これにより、advance時に store が `set({ comp: { ...comp } })` で comp 識別子を
  // 変えても、half の中身が変わっていなければ result は同一オブジェクトのまま。
  const result = useMemo<MatchResult | null>(() => {
    if (comp.matchResult) return comp.matchResult
    if (!half) return null
    return {
      homeTeamId: half.sim.home.id, awayTeamId: half.sim.away.id,
      homeScore: half.homeScore, awayScore: half.awayScore,
      beats: half.beats, steps: [], winnerId: null, scorers: [], decidedByPK: false,
      stats: { possessionHome: 50, shots: { home: 0, away: 0 }, sot: { home: 0, away: 0 }, corners: { home: 0, away: 0 }, fouls: { home: 0, away: 0 } },
    } as MatchResult
  }, [comp.matchResult, half, half?.beats, half?.homeScore, half?.awayScore, half?.segmentIndex])
  if (!result) return null
  // 交代を反映した「現在ピッチ上の11人」を先頭に並べる（Pitch2Dが players[0..10] を先発として描画するため）
  const withStarters = (team: typeof comp.tournament.teams[string], starters: typeof team.players) => {
    const sIds = new Set(starters.map((p) => p.id))
    return { ...team, players: [...starters, ...team.players.filter((p) => !sIds.has(p.id))] }
  }
  const home = half ? withStarters(half.sim.home, half.sim.H.starters) : comp.tournament.teams[result.homeTeamId]
  const away = half ? withStarters(half.sim.away, half.sim.A.starters) : comp.tournament.teams[result.awayTeamId]
  const awaiting = !comp.matchResult && !!half

  let ht: HalfTimeControls | undefined
  if (half) {
    const mySide = half.sim.home.isPlayer ? 'home' : 'away'
    const myStart = mySide === 'home' ? half.homeStart : half.awayStart
    const myTeam = mySide === 'home' ? half.sim.home : half.sim.away
    const liveTeam = mySide === 'home' ? half.sim.H.team : half.sim.A.team
    const startIds = new Set(myStart.map((p) => p.id))
    const bench = myTeam.players.filter((p) => !startIds.has(p.id))
    ht = {
      mySide, onPitch: myStart, bench,
      tactics: liveTeam.tactics,
      onSub: halfTimeSub,
      onTactics: (t) => halfTimeTactics(t),
      onResume: continueCompMatch,
      // B-5: 「フォーメーション解放」前は試合中の采配でも 4-4-2 のみ（画面ごとに解放状態がズレないように）
      formations: c && featureUnlocked('formations', c.year, c.week) ? undefined : (['4-4-2'] as const),
    }
  }

  return (
    <MatchView result={result} home={home} away={away} onDone={finishCompMatch}
      title={comp.stage === 'qualify' ? '県予選' : '全国大会'}
      awaitingSecondHalf={awaiting} ht={ht} />
  )
}

export function CompResult() {
  const comp = useCareer((s) => s.comp)
  const cont = useCareer((s) => s.continueAfterComp)
  if (!comp || !comp.lastOutcome) return null
  const o = comp.lastOutcome
  const path = comp.tournament ? playerPath(comp.tournament) : [] // #26: この大会の道のり
  return (
    <div className="screen" style={{ justifyContent: 'center', position: 'relative' }}>
      {o.championNational && <Confetti />}
      <div className="app-title">大会終了</div>
      <div className="center" style={{ marginTop: 6 }}>
        {o.championNational
          ? <img src={asset('events/champion.webp')} alt="" className="pop-in" style={{ width: 220, maxWidth: '72%', margin: '0 auto', display: 'block', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.22))' }} />
          : <div className="trophy pop-in" style={{ fontSize: 60 }}>⚽</div>}
        <h1 className="h1 pop-in" style={{ color: o.championNational ? 'var(--orange-deep)' : undefined, marginTop: 4 }}>{o.label}</h1>
        {o.qualifiedNational && (
          <div className="pop-in" style={{ marginTop: 6, display: 'inline-block', background: 'var(--orange-pastel, #ffe7cf)', color: 'var(--orange-deep)', fontWeight: 800, fontSize: 14, borderRadius: 999, padding: '5px 16px' }}>
            🎉 全国大会へ進出！（後日開催）
          </div>
        )}
      </div>
      <div className="panel pop-in" style={{ marginTop: 12, maxWidth: 360, marginInline: 'auto', width: '100%' }}>
        <div className="row center">
          <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--good)', fontFamily: 'var(--font-num)' }}><CountUp value={o.reputationDelta} prefix="+" /></div><div className="dim" style={{ fontSize: 11 }}>評判</div></div>
          {o.prize > 0 && <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--orange-deep)', fontFamily: 'var(--font-num)' }}><CountUp value={o.prize} prefix="+" /></div><div className="dim" style={{ fontSize: 11 }}>賞金(万)</div></div>}
        </div>
      </div>

      {/* #26 この大会の道のり（勝ち上がり〜結果の振り返り） */}
      {path.length > 0 && (
        <div className="panel pop-in" style={{ marginTop: 12, maxWidth: 360, marginInline: 'auto', width: '100%' }}>
          <div className="section-label" style={{ marginBottom: 6 }}>🛤 ここまでの道のり</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {path.map((leg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0', borderBottom: i < path.length - 1 ? '1px dashed rgba(74,64,54,0.12)' : 'none' }}>
                <span className="dim" style={{ fontSize: 11, width: 56, flexShrink: 0 }}>{leg.round}</span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>vs {leg.oppShort}</span>
                <span style={{ fontWeight: 800, fontFamily: 'var(--font-num)', color: leg.won ? 'var(--good)' : 'var(--bad)' }}>{leg.myScore}-{leg.oppScore}</span>
                <span style={{ flexShrink: 0, fontWeight: 800, fontSize: 12, color: leg.won ? 'var(--good)' : 'var(--bad)' }}>{leg.won ? '○' : '●'}{leg.pk ? <span className="dim" style={{ fontSize: 10, marginLeft: 2 }}>{leg.pk}</span> : null}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* コーチの反応 */}
      <div className="mascot-row" style={{ maxWidth: 420, marginInline: 'auto', width: '100%', marginTop: 12 }}>
        <img className="mascot-img" src={asset(`mascot/${o.championNational ? 'coach-happy' : o.reputationDelta >= 8 ? 'coach' : 'coach-sad'}.webp`)} alt="" />
        <div className="bubble">
          {o.championNational
            ? '全国制覇だ……！この景色を見るために、ずっとやってきたんだ。よくやった、監督。'
            : o.qualifiedNational
              ? '県を勝ち抜いた！全国までしばらく時間がある。疲れを抜いて、戦術を練り直して本番に備えよう。'
              : o.reputationDelta >= 8
                ? 'よく戦った。手応えは確かにあった。次はもっと上へ行こう。'
                : '悔しいな……。だがこの経験は、必ず次の試合で生きてくる。下を向くな。'}
        </div>
      </div>
      <div className="footer-cta">
        <button className="btn" onClick={cont}>{o.qualifiedNational ? '全国へ向けて準備する ▶' : 'シーズンへ戻る ▶'}</button>
      </div>
    </div>
  )
}
