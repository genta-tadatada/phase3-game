import { useState } from 'react'
import { useGame } from '../store/gameStore'
import { PREFECTURES } from '../data/prefectures'
import { loadStats, stageLabel } from '../save/stats'

export function TitleScreen() {
  const startGame = useGame((s) => s.startGame)
  const [name, setName] = useState('')
  const [pref, setPref] = useState('東京都')
  const [stats] = useState(loadStats)

  return (
    <div className="screen">
      <div className="app-title">ただタダ games</div>
      <div className="center" style={{ marginTop: 24 }}>
        <div className="trophy">⚽</div>
        <h1 className="h1">育成！経営！高校サッカー部！！</h1>
        <p className="dim" style={{ fontSize: 13, lineHeight: 1.7 }}>
          新設高校にサッカー部を創部。<br />
          戦術と采配だけで、全国制覇を目指せ。
        </p>
      </div>

      <div className="gap" />

      <div className="panel">
        <label className="label">高校名（自由に命名）</label>
        <input
          className="input"
          value={name}
          maxLength={12}
          placeholder="例: 蒼空学院"
          onChange={(e) => setName(e.target.value)}
        />

        <div className="gap-sm" />
        <label className="label">所在地（都道府県）</label>
        <select className="input" value={pref} onChange={(e) => setPref(e.target.value)}>
          {PREFECTURES.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      {stats.plays > 0 && (
        <>
          <div className="gap-sm" />
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', padding: '10px 12px' }}>
            <div>
              <div style={{ fontWeight: 800 }}>{stats.plays}</div>
              <div className="dim" style={{ fontSize: 10 }}>挑戦</div>
            </div>
            <div>
              <div style={{ fontWeight: 800, color: 'var(--accent)' }}>{stats.championships}</div>
              <div className="dim" style={{ fontSize: 10 }}>優勝</div>
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>{stageLabel(stats.bestStage)}</div>
              <div className="dim" style={{ fontSize: 10 }}>自己最高</div>
            </div>
          </div>
        </>
      )}

      <div className="gap" />
      <p className="dim center" style={{ fontSize: 11, lineHeight: 1.6 }}>
        無料・登録不要。ブラウザでそのまま遊べます。<br />
        選手・高校・大会はすべて架空です。
      </p>

      <div className="footer-cta">
        <button className="btn" onClick={() => startGame(name, pref)}>
          創部して全国大会へ ▶
        </button>
      </div>
    </div>
  )
}
