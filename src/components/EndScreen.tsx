import { useEffect, useRef, useState } from 'react'
import { useGame } from '../store/gameStore'
import { TeamBadge } from './shared'
import { recordResult, stageLabel, type PlayerStats } from '../save/stats'

const SITE_URL = 'https://tadatada.net'

export function EndScreen() {
  const tour = useGame((s) => s.tournament)
  const playerTeam = useGame((s) => s.playerTeam)
  const championId = useGame((s) => s.championId)
  const eliminated = useGame((s) => s.eliminated)
  const reset = useGame((s) => s.reset)
  const recorded = useRef(false)
  const [stats, setStats] = useState<PlayerStats | null>(null)

  const isChampion = championId === playerTeam?.id
  // 到達ステージ: 優勝=3 / 決勝敗退=2 / 準決勝敗退=1 / 準々決勝敗退=0
  const stage = isChampion ? 3 : (tour?.roundIndex ?? 0)

  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    setStats(recordResult(stage))
  }, [stage])

  if (!tour || !playerTeam) return null

  const champion = championId ? tour.teams[championId] : null

  return (
    <div className="screen">
      <div className="app-title">{tour && '全国高校サッカー選抜大会'}</div>

      {isChampion ? (
        <div className="center" style={{ marginTop: 20 }}>
          <div className="trophy">🏆</div>
          <h1 className="h1" style={{ color: 'var(--accent)' }}>全国制覇！</h1>
          <p style={{ fontSize: 15, lineHeight: 1.7 }}>
            <strong>{playerTeam.name}</strong><br />
            創部からの快挙、日本一の頂点に立った。
          </p>
        </div>
      ) : (
        <div className="center" style={{ marginTop: 20 }}>
          <div className="trophy">⚽</div>
          <h1 className="h1">大会終了</h1>
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>
            <strong>{playerTeam.name}</strong> の挑戦は{eliminated ? 'ここで終わった' : '幕を閉じた'}。<br />
            だが、創部の物語はまだ始まったばかりだ。
          </p>
        </div>
      )}

      <div className="gap" />

      {champion && (
        <div className="panel">
          <div className="dim center" style={{ fontSize: 12, marginBottom: 8 }}>大会優勝校</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TeamBadge team={champion} big />
          </div>
        </div>
      )}

      {stats && (
        <>
          <div className="gap" />
          <div className="panel">
            <div className="dim center" style={{ fontSize: 12, marginBottom: 8 }}>あなたの通算成績</div>
            <div className="row center">
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.plays}</div>
                <div className="dim" style={{ fontSize: 11 }}>挑戦</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{stats.championships}</div>
                <div className="dim" style={{ fontSize: 11 }}>優勝</div>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{stageLabel(stats.bestStage)}</div>
                <div className="dim" style={{ fontSize: 11 }}>自己最高</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="gap" />

      <div className="panel">
        <h2 className="h2" style={{ color: 'var(--accent)' }}>フル版、開発中</h2>
        <p className="dim" style={{ fontSize: 13, lineHeight: 1.8 }}>
          このゲームはお試し版（大会編）です。フル版では——<br />
          ・選手の<strong>育成と成長</strong>（性格・スキル・3年間）<br />
          ・<strong>スカウト</strong>で有望な新入生を勧誘<br />
          ・<strong>設備投資と経営</strong>、卒業生のプロ入り<br />
          ・何十年も続く監督キャリア<br />
          を実装予定。続報は「ただタダgames」公式サイトで。
        </p>
        <div className="gap-sm" />
        <a className="btn secondary" href={SITE_URL} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}>
          ただタダgames 公式サイトへ →
        </a>
      </div>

      <div className="footer-cta">
        <button className="btn" onClick={reset}>もう一度挑戦する ↻</button>
      </div>
    </div>
  )
}
