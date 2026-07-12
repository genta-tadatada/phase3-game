// ============================================================
// components/career/NewCaptainScreen.tsx — #62 新キャプテン選択専用画面
//   3年引退の翌週に表示。2年生全員から1人を選ぶ。
//   選んだ後は戦術画面でキャプテンを変えると雰囲気-3〜-5。
// ============================================================

import { useState } from 'react'
import { useCareer } from '../../store/careerStore'
import { PlayerAvatar } from '../../ui/PlayerAvatar'
import { playerOverallSum } from '../../engine/match/teamQuality'
import { PERSONALITY_LABEL, POSITION_LABEL } from '../../lib/labels'
import { abilityColor } from './RosterScreen'
import type { Player } from '../../engine/types'

export function NewCaptainScreen() {
  const c = useCareer((s) => s.career)
  const pickInitialCaptain = useCareer((s) => s.pickInitialCaptain)
  const [sel, setSel] = useState<string | null>(null)
  if (!c) return null

  // 2年生全員（引退者・補習中は除外しない＝補習中でもキャプテン可）
  const candidates: Player[] = c.roster
    .filter((p) => !p.retired && p.grade === 2)
    .sort((a, b) => playerOverallSum(b) - playerOverallSum(a))

  if (candidates.length === 0) {
    // 異常系: 2年生が誰もいない（部員数<11等）→ 1年生から最強を自動任命して終わり
    const fallback = c.roster.filter((p) => !p.retired).sort((a, b) => playerOverallSum(b) - playerOverallSum(a))[0]
    if (fallback) {
      return (
        <div className="screen">
          <h1 className="h1">新キャプテン</h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, margin: '10px 0' }}>2年生が部にいないため、特例で <b>{fallback.name}</b>（{fallback.grade}年）を新キャプテンに任命します。</p>
          <button className="btn" onClick={() => pickInitialCaptain(fallback.id)}>了解 ▶</button>
        </div>
      )
    }
    // 二重防御: 現役が1人もいない（store側でフラグを立てない仕様のため通常到達しない）。
    // 白画面で詰まないよう、フラグを下ろして週画面へ戻す退避ボタンを出す。
    return (
      <div className="screen">
        <h1 className="h1">新キャプテン</h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, margin: '10px 0' }}>キャプテンを任せられる部員がいません。新入生の入部を待ちましょう。</p>
        <button className="btn" onClick={() => useCareer.setState((s) => ({ career: s.career ? { ...s.career, pendingCaptainChoice: false } : s.career, screen: 'weekly' }))}>戻る ▶</button>
      </div>
    )
  }

  const selected = candidates.find((p) => p.id === sel)

  return (
    <div className="screen">
      <div className="app-title">新キャプテン就任</div>
      <h1 className="h1">🔥 新しいキャプテンを選ぶ</h1>
      <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.7, marginTop: -2 }}>
        3年生が引退した。残った2年生から、来年のチームを背負うキャプテンを1人選ぼう。
        <br />
        <span style={{ color: 'var(--orange-deep, #c2622d)', fontWeight: 700 }}>選んだあとに戦術画面で変更すると、雰囲気が下がる（-3〜-5）。即変更でも同じ。</span>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginTop: 10 }}>
        {candidates.map((p) => {
          const isSel = sel === p.id
          const ov = Math.round(playerOverallSum(p) / 7)
          return (
            <button key={p.id} onClick={() => setSel(p.id)}
              style={{
                background: isSel ? 'var(--orange)' : '#fff',
                color: isSel ? '#fff' : 'var(--ink)',
                border: isSel ? '3px solid var(--orange-deep, #c2622d)' : '2px solid var(--card-edge)',
                borderRadius: 14, padding: 10, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 6,
                boxShadow: isSel ? '0 4px 12px rgba(194, 98, 45, 0.35)' : 'var(--shadow-card)',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PlayerAvatar player={p} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.82 }}>{POSITION_LABEL[p.slot ?? p.position]}・<span style={{ color: isSel ? '#fff' : abilityColor(ov), fontFamily: 'var(--font-num)' }}>{ov}</span></div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.85, lineHeight: 1.35 }}>
                性格 <b>{PERSONALITY_LABEL[p.personality]}</b>
                {p.skills?.includes('captaincy') && <span style={{ marginLeft: 4, fontWeight: 800, color: isSel ? '#fff' : '#1f7a4d' }}>👑キャプテンシー</span>}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="panel" style={{ marginTop: 14, padding: '10px 12px', background: '#fff' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-dim)', marginBottom: 4 }}>選んだキャプテン</div>
          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 4 }}>{selected.name}</div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            {selected.personality === 'leader' ? '🌟 リーダー性格＝チームを引っ張れる。雰囲気が安定する。' :
             selected.skills?.includes('captaincy') ? '🌟 キャプテンシー持ち＝若くても腕章が似合う。' :
             '普通の2年生。任せれば成長する。'}
          </div>
        </div>
      )}

      <div className="footer-cta">
        <button className="btn" disabled={!sel} onClick={() => sel && pickInitialCaptain(sel)}>
          {sel ? `${selected?.name} を新キャプテンに任命 ▶` : '誰かを選んでください'}
        </button>
      </div>
    </div>
  )
}
