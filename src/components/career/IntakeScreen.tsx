// ============================================================
// components/career/IntakeScreen.tsx — 入部式（#愛着）
//   ① まず新入部員を「全員まとめて」一覧表示（顔・名前・ポジ・背番号）。
//   ② 選手をタップすると、その1人の詳細で 名前・背番号（＋2年目以降はポジション）を設定できる。
//   ポジション変更は1年目は未解放（年2〜）。1年目は自動配置を表示するだけ。
// ============================================================

import { useState } from 'react'
import { useCareer } from '../../store/careerStore'
import { PlayerAvatar } from '../../ui/PlayerAvatar'
import { asset } from '../../ui/asset'
import { POSITION_LABEL, POSITION_COLOR, PERSONALITY_LABEL, ABILITY_LABEL, ABILITY_ICON, heightCmOf, overallLabel, gradeLabel } from '../../lib/labels'
import { playerOverallSum } from '../../engine/match/teamQuality'
import { featureUnlocked } from '../../career/unlocks'
import type { PositionType } from '../../engine/types'

const PERS_HINT: Record<string, string> = {
  leader: '統率力でチームを引き締める', moodmaker: '場を明るくする', troublemaker: '才能はあるが扱いに注意',
  genius: '才能型・成長にムラ', shy: '内気だが芯がある', timid: '大舞台にやや弱い',
  fighter: '負けず嫌い・試合で伸びる', hotblood: '熱く粘り強い', egoist: '自分本位だが武器は鋭い',
  hardworker: 'コツコツ確実に伸びる', mypace: 'マイペース', lazy: '練習をサボりがち',
}
const FP: PositionType[] = ['CB', 'SB', 'WB', 'DM', 'CM', 'AM', 'WF', 'CF']
const abColor = (v: number) => (v >= 70 ? '#e0843a' : v >= 55 ? '#3f9e74' : v >= 40 ? '#5b9bd5' : '#9aa0a6')

export function IntakeScreen() {
  const c = useCareer((s) => s.career)
  const renamePlayer = useCareer((s) => s.renamePlayer)
  const setPlayerPosition = useCareer((s) => s.setPlayerPosition)
  const setJersey = useCareer((s) => s.setJersey)
  const finishIntake = useCareer((s) => s.finishIntake)
  const [selected, setSelected] = useState<string | null>(null)
  const [edit, setEdit] = useState<null | 'name' | 'pos' | 'num'>(null)
  const [nameDraft, setNameDraft] = useState('')
  // G-37: 能力順だけでなくポジション順でも一覧できるよう、並び替えを追加
  const [sortKey, setSortKey] = useState<'overall' | 'position'>('overall')

  if (!c) return null
  const ids = c.pendingIntake ?? []
  const players = ids.map((id) => c.roster.find((p) => p.id === id)).filter(Boolean) as NonNullable<ReturnType<typeof c.roster.find>>[]
  if (players.length === 0) { finishIntake(); return null }
  const posEditable = featureUnlocked('position-change', c.year, c.week) // ポジション変更は年2〜
  const usedNums = new Set(c.roster.map((x) => x.number).filter(Boolean) as number[])

  // ===== ① 一覧（全員まとめて） =====
  if (!selected) {
    // G-37: 並び替え（能力順=総合力降順 / ポジション順=FW→MF→DF→GK）
    const POS_ORDER: Record<string, number> = { CF: 0, WF: 1, AM: 2, CM: 3, DM: 4, WB: 5, SB: 6, CB: 7, GK: 8 }
    const sortedPlayers = sortKey === 'position'
      ? [...players].sort((a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) || playerOverallSum(b) - playerOverallSum(a))
      : [...players].sort((a, b) => playerOverallSum(b) - playerOverallSum(a))
    return (
      <div className="screen" style={{ justifyContent: 'flex-start' }}>
        <div className="app-title">入部式</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
          <h1 className="h1" style={{ margin: 0 }}>新入部員 {players.length}人</h1>
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: 2, marginBottom: 8, lineHeight: 1.5 }}>
          選手を<b>タップ</b>すると、名前{posEditable ? '・ポジション' : ''}・背番号を設定できます。設定は後からでも変更可。
        </p>

        {/* G-37: 並び替えチップ（能力順 / ポジション順） */}
        <div className="chip-row" style={{ marginBottom: 6 }}>
          {([['overall', '能力順'], ['position', 'ポジション順']] as const).map(([v, t]) => (
            <button key={v} className={`chip ${sortKey === v ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setSortKey(v)}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 6, alignContent: 'start' }}>
          {sortedPlayers.map((p) => {
            const sum = playerOverallSum(p)
            return (
              <button key={p.id} onClick={() => setSelected(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 11, border: '2px solid var(--card-edge)', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <PlayerAvatar player={p} size={32} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-soft)' }}>{gradeLabel(p.grade)}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: POSITION_COLOR[p.position] }}>{POSITION_LABEL[p.position]}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-num)', color: 'var(--accent)' }}>#{p.number ?? '—'}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div className="dim" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{PERSONALITY_LABEL[p.personality]}</div>
                  {/* ランクは「〇〇レベル」だけで意味が通る（「総合」は冗長なので省略）。独立行・折返し可で全表示。 */}
                  <div style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1.3, color: abColor(sum / 7) }}>{overallLabel(sum).label}</div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="footer-cta">
          <button className="btn" onClick={finishIntake}>✅ 全員入部！はじめる</button>
        </div>
      </div>
    )
  }

  // ===== ② 個別設定 =====
  const p = players.find((x) => x.id === selected) ?? players[0]
  const sum = playerOverallSum(p)
  const ov = overallLabel(sum)
  const abilityRows = p.isGK
    ? ([['saving', p.gk?.saving ?? 0], ['gkIq', p.gk?.gkIq ?? 0], ['speed', p.abilities.speed], ['power', p.abilities.power], ['iq', p.abilities.iq], ['stamina', p.abilities.stamina]] as const)
    : (['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense'] as const).map((k) => [k, p.abilities[k]] as const)
  const abLabel = (k: string) => (k === 'saving' ? 'セービング' : k === 'gkIq' ? 'GK-IQ' : ABILITY_LABEL[k as keyof typeof ABILITY_LABEL] ?? k)

  return (
    <div className="screen" style={{ justifyContent: 'flex-start' }}>
      <div className="app-title">入部式</div>
      <button className="btn ghost sm" style={{ alignSelf: 'flex-start', marginBottom: 6 }} onClick={() => { setSelected(null); setEdit(null) }}>◀ 一覧へ戻る</button>

      <div className="panel" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <PlayerAvatar player={p} size={72} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <button onClick={() => { setNameDraft(p.name); setEdit('name') }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{p.name}</span>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800 }}>✎</span>
            </button>
            <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{gradeLabel(p.grade)}・{heightCmOf(p)}cm・総合 <b style={{ color: abColor(sum / 7) }}>{ov.label}</b></div>
            <div style={{ fontSize: 12, marginTop: 3 }}>性格 <b>{PERSONALITY_LABEL[p.personality]}</b> <span className="dim">— {PERS_HINT[p.personality] ?? ''}</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {/* ポジション（年2〜編集可。年1は自動配置を表示のみ） */}
          <button onClick={() => posEditable && setEdit('pos')} disabled={!posEditable}
            style={{ flex: 1, padding: '8px', borderRadius: 10, border: '2px solid var(--card-edge)', background: posEditable ? '#fff' : '#f3f0ea', cursor: posEditable ? 'pointer' : 'default', textAlign: 'left' }}>
            <div className="dim" style={{ fontSize: 10 }}>ポジション{posEditable ? ' ✎' : ''}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: POSITION_COLOR[p.position] }}>{POSITION_LABEL[p.position]}</div>
          </button>
          <button onClick={() => setEdit('num')} style={{ flex: 1, padding: '8px', borderRadius: 10, border: '2px solid var(--card-edge)', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
            <div className="dim" style={{ fontSize: 10 }}>背番号 ✎</div>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-num)', color: 'var(--accent)' }}>{p.number ?? '—'}</div>
          </button>
        </div>
        {!posEditable && <div className="dim" style={{ fontSize: 10.5, marginTop: 4 }}>ポジションの変更は2年目から解放されます（今は能力に合った自動配置）。</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', marginTop: 10 }}>
          {abilityRows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <span style={{ width: 64, color: 'var(--ink-soft)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                {ABILITY_ICON[k as keyof typeof ABILITY_ICON] && <img src={asset(ABILITY_ICON[k as keyof typeof ABILITY_ICON])} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
                {abLabel(k)}
              </span>
              <span style={{ flex: 1, height: 6, background: '#eceae4', borderRadius: 3, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${v}%`, background: abColor(v) }} />
              </span>
              <span style={{ width: 18, textAlign: 'right', fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="footer-cta">
        <button className="btn" onClick={() => { setSelected(null); setEdit(null) }}>この選手はOK ▶ 一覧へ</button>
      </div>

      {/* 名前編集 */}
      {edit === 'name' && (
        <div className="event-overlay" style={{ background: 'rgba(40,30,20,0.5)' }} onClick={() => setEdit(null)}>
          <div className="panel pop-in" style={{ maxWidth: 320, width: '100%', padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="section-label" style={{ marginBottom: 8 }}>名前を変更</div>
            <input className="input" value={nameDraft} maxLength={8} autoFocus onChange={(e) => setNameDraft(e.target.value)} placeholder={p.name} />
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <button className="btn ghost" style={{ flex: '0 0 34%' }} onClick={() => setEdit(null)}>やめる</button>
              <button className="btn" onClick={() => { renamePlayer(p.id, nameDraft); setEdit(null) }}>決定</button>
            </div>
          </div>
        </div>
      )}

      {/* ポジション編集（年2〜） */}
      {edit === 'pos' && posEditable && (
        <div className="event-overlay" style={{ background: 'rgba(40,30,20,0.5)' }} onClick={() => setEdit(null)}>
          <div className="panel pop-in" style={{ maxWidth: 360, width: '100%', padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="section-label" style={{ marginBottom: 8 }}>ポジションを選ぶ{p.isGK && '（GKは固定）'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {p.isGK
                ? <span className="chip active" style={{ padding: '6px 14px' }}>GK</span>
                : FP.map((pos) => (
                  <button key={pos} className={`chip ${p.position === pos ? 'active' : ''}`} style={{ padding: '6px 13px', fontSize: 13 }}
                    onClick={() => { setPlayerPosition(p.id, pos); setEdit(null) }}>{POSITION_LABEL[pos]}</button>
                ))}
            </div>
            <button className="btn ghost sm" style={{ width: '100%', marginTop: 12 }} onClick={() => setEdit(null)}>とじる</button>
          </div>
        </div>
      )}

      {/* 背番号編集 */}
      {edit === 'num' && (
        <div className="event-overlay" style={{ background: 'rgba(40,30,20,0.5)' }} onClick={() => setEdit(null)}>
          <div className="panel pop-in" style={{ maxWidth: 340, width: '100%', padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="section-label" style={{ marginBottom: 4 }}>背番号を選ぶ</div>
            <div className="dim" style={{ fontSize: 11, marginBottom: 8 }}>使用中の番号を選ぶと相手と入れ替わります。</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
              {Array.from({ length: 40 }, (_, n) => n + 1).map((n) => (
                <button key={n} className={`chip ${p.number === n ? 'active' : ''}`} style={{ padding: '6px 0', fontSize: 12, fontFamily: 'var(--font-num)', opacity: usedNums.has(n) && p.number !== n ? 0.5 : 1 }}
                  onClick={() => { setJersey(p.id, n); setEdit(null) }}>{n}</button>
              ))}
            </div>
            <button className="btn ghost sm" style={{ width: '100%', marginTop: 12 }} onClick={() => setEdit(null)}>とじる</button>
          </div>
        </div>
      )}
    </div>
  )
}
