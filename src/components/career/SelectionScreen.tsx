import { useState } from 'react'
import { useCareer } from '../../store/careerStore'
import { playerOverallSum } from '../../engine/match/teamQuality'
import { overallLabel, PERSONALITY_LABEL, POSITION_COLOR } from '../../lib/labels'
import { skillName } from '../../data/skills'
import { candStrength } from '../../career/scout'
import { PlayerAvatar } from '../../ui/PlayerAvatar'

const ATARI = ['leader', 'genius', 'fighter', 'hardworker']
// 一般入部の分布（評判50-100で candStrength≈28-47・σ≈3）に合わせた★スケール。
// スカウト画面の★はスカウト候補（特待+10等で高め）用の別スケールのまま＝流用しない。
// 旧式 (cs-30)/9 は一般入部だとほぼ全員★1になり選抜の判断材料にならなかった。
function stars(cs: number): string {
  const n = Math.max(1, Math.min(5, Math.round((cs - 20) / 5)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

export function SelectionScreen() {
  const c = useCareer((s) => s.career)
  const confirm = useCareer((s) => s.confirmSelection)
  const [sel, setSel] = useState<string[]>([])
  if (!c || !c.pendingApplicants) return null
  const cap = c.admitCap ?? 8
  // 最低合格人数＝min(10, 合格枠)。部員が減りすぎて新チームが組めなくなるのを防ぐ（storeの confirmSelection と同じ条件）。
  const minReq = Math.min(10, cap, c.pendingApplicants.length)
  const applicants = [...c.pendingApplicants].sort((a, b) => playerOverallSum(b) - playerOverallSum(a))

  const toggle = (id: string) => {
    setSel((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < cap ? [...prev, id] : prev)
  }

  return (
    <div className="screen">
      <div className="app-title">入部セレクション</div>
      <h1 className="h1">合格者を選抜</h1>
      <p className="dim" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
        応募者{applicants.length}人から<b style={{ color: 'var(--accent)' }}>最低{minReq}人</b>を合格に。全員合格でも、能力を見て絞ってもいい。
        能力・性格・素材（初期能力★）が判断材料。
        <br /><span style={{ color: 'var(--accent)' }}>⚠ 選考の約3週間ぶん、選抜した新入生だけが育成に出遅れる（上級生・スカウト組は先行して練習）。</span>
      </p>
      <div className="panel" style={{ padding: '8px 12px', marginBottom: 10, textAlign: 'center' }}>
        選択中 <b style={{ color: 'var(--accent)', fontSize: 18 }}>{sel.length}</b> / {cap} 人
        {sel.length < minReq && <span className="dim" style={{ fontSize: 11 }}>（あと{minReq - sel.length}人選ぶと確定できる）</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 7 }}>
        {applicants.map((p) => {
          const on = sel.includes(p.id)
          const atari = ATARI.includes(p.personality)
          return (
            <div key={p.id} className="player-card" onClick={() => toggle(p.id)}
              style={{ padding: '8px 10px', cursor: 'pointer', boxShadow: on ? '0 0 0 2px var(--orange), var(--shadow-card)' : undefined, background: on ? 'var(--orange-pastel)' : undefined }}>
              <PlayerAvatar player={p} size={36} />
              <span className="pos-badge" style={{ background: POSITION_COLOR[p.slot ?? p.position], width: 30, height: 30, fontSize: 11 }}>{p.slot ?? p.position}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div className="dim" style={{ fontSize: 10 }}>
                  {overallLabel(playerOverallSum(p)).label}・<span style={{ color: atari ? 'var(--accent)' : undefined }}>{PERSONALITY_LABEL[p.personality]}</span>
                  {p.skills && p.skills.length > 0 && '・⚡' + p.skills.map(skillName).join(',')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--accent)' }}>素材 {stars(candStrength(p))}</div>
              </div>
              <div style={{ width: 26, height: 26, borderRadius: 13, border: '2px solid', borderColor: on ? 'var(--accent)' : 'var(--card-edge)', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--accent)', fontWeight: 800 }}>
                {on ? '✓' : ''}
              </div>
            </div>
          )
        })}
      </div>

      <div className="footer-cta">
        <button className="btn" disabled={sel.length < minReq} onClick={() => confirm(sel)}>
          {sel.length < minReq ? `最低${minReq}人選んでください（あと${minReq - sel.length}人）` : `${sel.length}人を合格にする ▶`}
        </button>
      </div>
    </div>
  )
}
