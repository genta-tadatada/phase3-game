import { useState } from 'react'
import { useGame } from '../store/gameStore'
import { AbilityBars, PlayerRow, teamOverall } from './shared'
import type { Player } from '../engine/types'
import { PERSONALITY_LABEL, conditionLabel, gradeLabel } from '../lib/labels'
import { abilityFillGradient } from './career/RosterScreen'

export function SquadScreen() {
  const team = useGame((s) => s.playerTeam)
  const go = useGame((s) => s.go)
  const [selected, setSelected] = useState<Player | null>(null)
  if (!team) return null
  const ov = teamOverall(team)
  const starters = team.players.slice(0, 11)
  const subs = team.players.slice(11)

  return (
    <div className="screen">
      <div className="app-title">創部完了</div>
      <h1 className="h1">{team.name}</h1>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="dim" style={{ fontSize: 12 }}>{team.prefecture}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{ov.label}</div>
          </div>
          <div className="center">
            <div className="dim" style={{ fontSize: 11 }}>監督能力</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{team.managerSkill}</div>
          </div>
        </div>
        <p className="dim" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
          一般入部で集まった選手たち。能力・性格・体格はそれぞれ違う。
          選手をタップすると能力値が見られる。
        </p>
      </div>

      <h2 className="h2">スターティングメンバー</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {starters.map((p) => (
          <PlayerRow key={p.id} player={p} onClick={() => setSelected(p)} />
        ))}
      </div>

      <div className="gap-sm" />
      <h2 className="h2 dim">控え</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {subs.map((p) => (
          <PlayerRow key={p.id} player={p} onClick={() => setSelected(p)} />
        ))}
      </div>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'grid', placeItems: 'center', zIndex: 50, padding: 20,
          }}
        >
          <div className="panel" style={{ width: '100%', maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 18 }}>{selected.name}</strong>
              <span className="dim" style={{ fontSize: 12 }}>
                {gradeLabel(selected.grade)}・{selected.position}
              </span>
            </div>
            <div className="dim" style={{ fontSize: 12, margin: '4px 0 10px' }}>
              性格: {PERSONALITY_LABEL[selected.personality]}　調子: {conditionLabel(selected.condition)}
              　身長帯: {selected.heightTier}/9
            </div>
            <AbilityBars abilities={selected.abilities} />
            {selected.gk && (
              <div style={{ marginTop: 8 }}>
                <div className="stat-row">
                  <span className="stat-name">セービング</span>
                  <span className="stat-track"><span className="stat-fill" style={{ width: `${selected.gk.saving}%`, background: abilityFillGradient(selected.gk.saving) }} /></span>
                  <span className="stat-val">{Math.round(selected.gk.saving)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-name">GK-IQ</span>
                  <span className="stat-track"><span className="stat-fill" style={{ width: `${selected.gk.gkIq}%`, background: abilityFillGradient(selected.gk.gkIq) }} /></span>
                  <span className="stat-val">{Math.round(selected.gk.gkIq)}</span>
                </div>
              </div>
            )}
            <div className="gap-sm" />
            <button className="btn ghost" onClick={() => setSelected(null)}>閉じる</button>
          </div>
        </div>
      )}

      <div className="footer-cta">
        <button className="btn" onClick={() => go('tactics')}>戦術を決める ▶</button>
      </div>
    </div>
  )
}
