// ============================================================
// components/career/PositionScreen.tsx — ポジション配属
// 選手は能力から「希望ポジション」を1つ伝えてくる（★）。
// フィールド選手は好きなポジションへ自由配属（後からいつでも変更可）。
// GKは使う能力が異なるため固定（入部時の転向はしない）。
// ============================================================

import { useState } from 'react'
import { useCareer } from '../../store/careerStore'
import { playerOverallSum, bestFieldPosition } from '../../engine/match/teamQuality'
import { POSITION_LABEL, POSITION_COLOR, gradeLabel, heightCmOf } from '../../lib/labels'
import { PlayerAvatar } from '../../ui/PlayerAvatar'
import { abilityColor } from './RosterScreen'
import type { PositionType, Abilities } from '../../engine/types'

const FIELD_POS: PositionType[] = ['CB', 'SB', 'WB', 'DM', 'CM', 'AM', 'WF', 'CF']
const AB_ORDER: (keyof Abilities)[] = ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense']
const AB_LABEL: Record<string, string> = {
  kick: 'キック', power: 'パワー', speed: 'スピード', technique: '技術', stamina: 'スタミナ', iq: 'IQ', defense: '守備',
}
// 初心者向け・各ポジションの簡単な説明
const POS_DESC: [PositionType, string][] = [
  ['GK', 'ゴールキーパー。ゴールを守る最後の砦。'],
  ['CB', 'センターバック。中央の守備の中心。競り合いの強さも必要。'],
  ['SB', 'サイドバック。サイドを守り、攻撃にも上がる。'],
  ['WB', 'ウイングバック。サイドを上下に走り回る。運動量が要る。'],
  ['DM', '守備的MF（ボランチ）。中盤の底でボールを奪い、攻撃の起点に。'],
  ['CM', 'セントラルMF。中盤の中心。攻守をつなぐ。'],
  ['AM', '攻撃的MF（トップ下）。中盤の高い位置からチャンスを作る。'],
  ['WF', 'ウイング。サイドからスピードとドリブルで突破。'],
  ['CF', 'センターフォワード。最前線の点取り屋。'],
]

export function PositionScreen() {
  const c = useCareer((s) => s.career)
  const go = useCareer((s) => s.go)
  const setPos = useCareer((s) => s.setPlayerPosition)
  const recommend = useCareer((s) => s.recommendPositions)
  const [showGuide, setShowGuide] = useState(false)
  if (!c) return null
  const players = [...c.roster].sort((a, b) => b.grade - a.grade || playerOverallSum(b) - playerOverallSum(a))

  return (
    <div className="screen">
      <div className="app-title">ポジション設定</div>
      <h1 className="h1">ポジション</h1>
      <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
        選手は能力から<b>希望ポジション（★）</b>を伝えてくる。フィールドの選手は好きなポジションを選べる（<b>後からいつでも変更可</b>）。GKは使う能力が違うため、現在は変更できません。
      </p>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn ghost" onClick={recommend}>⚡ 全員を希望どおりに自動配置</button>
        <button className="btn ghost" style={{ flex: '0 0 38%' }} onClick={() => setShowGuide((v) => !v)}>❔ ポジション解説</button>
      </div>
      {showGuide && (
        <div className="panel float-up" style={{ marginBottom: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {POS_DESC.map(([pos, desc]) => (
              <div key={pos} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
                <span className="pos-badge" style={{ background: POSITION_COLOR[pos], width: 30, height: 20, fontSize: 11, flexShrink: 0 }}>{POSITION_LABEL[pos]}</span>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {players.map((p) => {
          const w = bestFieldPosition(p)
          const cur: PositionType = p.isGK ? 'GK' : p.position
          const cells: [string, number][] = AB_ORDER.map((k) => [AB_LABEL[k], p.abilities[k]])
          if (p.isGK && p.gk) { cells.push(['セービング', p.gk.saving], ['GK-IQ', p.gk.gkIq]) }
          return (
            <div key={p.id} className="panel" style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <PlayerAvatar player={p} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}{p.isCaptain && <span className="tag captain" style={{ marginLeft: 4, padding: '0 5px' }}>C</span>}</div>
                  <div className="dim" style={{ fontSize: 11.5 }}>
                    {gradeLabel(p.grade)}・身長{heightCmOf(p)}cm{!p.isGK && <>・希望 <b style={{ color: 'var(--orange-deep)' }}>{POSITION_LABEL[w]}</b></>}
                  </div>
                </div>
              </div>
              {/* 能力（升目：1行・ラベル上/数値下で対応を明確に・色分け） */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 3, margin: '7px 0' }}>
                {cells.map(([lab, val], i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#faf6ee', border: '1px solid var(--card-edge)', borderRadius: 6, padding: '3px 1px', lineHeight: 1.1 }}>
                    <span style={{ fontSize: 9.5, color: 'var(--ink-dim)', fontWeight: 700, whiteSpace: 'nowrap' }}>{lab}</span>
                    <span style={{ fontSize: 15.5, fontWeight: 800, fontFamily: 'var(--font-num)', color: abilityColor(val) }}>{Math.round(val)}</span>
                  </div>
                ))}
              </div>
              {p.isGK ? (
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--green-deep)' }}>GK（現在は変更不可）</div>
              ) : (
                // 8ポジションを1行に均等配置（chip-row の flex-wrap だと2段になるためここだけ grid に上書き）
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
                  {FIELD_POS.map((pos) => {
                    const on = cur === pos
                    return (
                      <button key={pos} className={`chip ${on ? 'active' : ''}`} style={{ padding: '4px 0', fontSize: 12, minHeight: 38 }} onClick={() => setPos(p.id, pos)}>
                        {POSITION_LABEL[pos]}{w === pos && <span style={{ color: on ? '#fff' : 'var(--orange-deep)' }}>★</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="footer-cta">
        <button className="btn" onClick={() => go('weekly')}>決定して戻る ▶</button>
      </div>
    </div>
  )
}
