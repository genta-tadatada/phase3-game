// ============================================================
// components/career/GrowthResult.tsx — 1週進めた直後の成長表示
//   数値（小数）は出さず、伸びを「小/中/大アップ」の矢印で視認させる。
// ============================================================

import { useEffect, useState } from 'react'
import type { GrowthSummary } from '../../career/growth'
import { asset } from '../../ui/asset'
import { POSITION_LABEL } from '../../lib/labels'
import type { PositionType } from '../../engine/types'

const INJURY_TUTORIAL_KEY = 'tts-injury-tutorial-shown'

// 伸び量 → 段階（1未満でも視認できるよう3段階の矢印で表現）
function tier(amount: number): 0 | 1 | 2 {
  if (amount >= 1.3) return 2   // 大アップ
  if (amount >= 0.6) return 1   // 中アップ
  return 0                      // 小アップ
}
const TIER_LABEL = ['小アップ', '中アップ', '大アップ']
const TIER_COLOR = ['#7cc6a6', '#3f9e74', '#e0843a']

function Arrows({ t }: { t: 0 | 1 | 2 }) {
  // 段階で本数を変える（1/2/3本）。フォントサイズは固定＝行の高さが段階で変わらない（縦伸び防止 #20）。
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: TIER_COLOR[t], lineHeight: 1, flexShrink: 0 }}>
      {Array.from({ length: t + 1 }).map((_, i) => (
        <span key={i} style={{ fontSize: 14, fontWeight: 900 }}>▲</span>
      ))}
    </span>
  )
}

export function GrowthResult({ summary, onClose }: { summary: GrowthSummary; onClose: () => void }) {
  // #75: 初回怪我発生時のみチュートリアルを差し込む（通常プレイでは表示なし）
  const [showInjuryTutorial, setShowInjuryTutorial] = useState(false)
  useEffect(() => {
    if (!summary.injuries || summary.injuries.length === 0) return
    try {
      if (localStorage.getItem(INJURY_TUTORIAL_KEY) === '1') return
      localStorage.setItem(INJURY_TUTORIAL_KEY, '1')
      setShowInjuryTutorial(true)
    } catch { /* noop */ }
  }, [summary.injuries])

  // G-44: フィルター → グルーピング表示に変更。A/B/C/外 でセクション分けし、0人グループは非表示。
  const allGains = summary.gains
  const squadOrder: Array<'A' | 'B' | 'C' | 'orphan'> = ['A', 'B', 'C', 'orphan']
  const SQUAD_LABEL: Record<'A' | 'B' | 'C' | 'orphan', string> = { A: 'Aチーム（招集メンバー）', B: 'Bチーム', C: 'Cチーム', orphan: '招集外' }
  const groups = squadOrder.map((sq) => ({ sq, items: allGains.filter((g) => (g.squad ?? 'A') === sq) })).filter((gr) => gr.items.length > 0)
  return (
    <div className="event-overlay" style={{ background: 'rgba(38,54,40,0.78)' }}>
      {/* F1.5: PCでは横幅を活かす（min(94vw, 620px)）。event-card共通拡張＋上書き。 */}
      <div className="event-card pop-in" style={{ maxWidth: 'min(94vw, 620px)', maxHeight: '92%', overflowY: 'auto', padding: '14px 16px' }}>
        <div className="event-title" style={{ textAlign: 'center' }}>📈 今週の成長</div>

        {/* #75: 今週新たに発生した怪我（赤帯で目立たせる） */}
        {summary.injuries && summary.injuries.length > 0 && (
          <div className="panel" style={{ padding: '9px 11px', margin: '8px 0 4px', background: '#fff5f3', border: '2px solid #c43b3b' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#c43b3b', marginBottom: 4 }}>🚑 練習中に怪我</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
              {summary.injuries.map((inj, i) => (
                <span key={i} style={{ marginRight: 8 }}><b>{inj.name}</b>（{inj.weeks}週間 離脱）</span>
              ))}
            </div>
          </div>
        )}

        {/* 週末の練習試合の結果（相手・スコア・得点者）#22c */}
        {summary.weekend && (
          <div className="panel" style={{ padding: '9px 11px', margin: '8px 0 4px', background: 'var(--card-2, rgba(0,0,0,0.04))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>⚽ {summary.weekend.label}</span>
              <span style={{ fontSize: 17, fontWeight: 900, color: summary.weekend.mark === '○' ? 'var(--good)' : summary.weekend.mark === '●' ? 'var(--bad)' : 'var(--ink)' }}>
                {summary.weekend.score} {summary.weekend.mark}
              </span>
            </div>
            {summary.weekend.scorers.length > 0 && (
              <div className="dim" style={{ fontSize: 11.5, marginTop: 3 }}>得点: {summary.weekend.scorers.join('、')}</div>
            )}
          </div>
        )}

        {allGains.length === 0 ? (
          <p className="center" style={{ margin: '14px 0', fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)' }}>
            目に見える急成長はなかったが、選手たちは着実に経験を積んだ。<br />
            <span className="dim" style={{ fontSize: 12 }}>{summary.restedCount > 0 ? `${summary.restedCount}人が休養し、コンディションを整えた。` : 'コツコツ続けることが力になる。'}</span>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '10px 0' }}>
            {/* G-44: A/B/C/外 でグルーピング。0人のグループは非表示。 */}
            {groups.map((gr) => (
              <div key={gr.sq}>
                <div className="section-label" style={{ margin: '2px 0 4px', fontSize: 12 }}>
                  {SQUAD_LABEL[gr.sq]} <span className="dim" style={{ fontWeight: 700 }}>{gr.items.length}人</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {gr.items.map((g, i) => {
                    const t = tier(g.amount)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minHeight: 26, fontSize: 13.5, padding: '3px 4px', borderBottom: '1px solid var(--card-edge)' }}>
                        <span style={{ flex: '0 0 44%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingTop: 3 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink-dim)', marginRight: 3 }}>{g.grade}年</span>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--accent)', marginRight: 4 }}>{POSITION_LABEL[g.pos as PositionType] ?? g.pos}</span>
                          <span style={{ fontWeight: 800 }}>{g.name}</span>
                        </span>
                        <span className="dim" style={{ flex: 1, fontSize: 12.5, minWidth: 0, lineHeight: 1.45, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', wordBreak: 'break-word', paddingTop: 1 }}>
                          {g.ability}
                          {g.note && <span style={{ color: 'var(--accent)', fontWeight: 800, marginLeft: 5 }}>{g.note}</span>}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, paddingTop: 2 }}>
                          <Arrows t={t} />
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: TIER_COLOR[t], whiteSpace: 'nowrap' }}>{TIER_LABEL[t]}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mascot-row" style={{ marginTop: 6 }}>
          <img className="mascot-img" src={asset('mascot/coach-happy.webp')} alt="" style={{ width: 48, height: 48 }} />
          <div className="bubble" style={{ fontSize: 12.5 }}>
            {allGains.length > 0 ? `${allGains.length}人が成長！` : 'コツコツいこう。'}
            {summary.restedCount > 0 && <span className="dim">（{summary.restedCount}人は休養）</span>}
          </div>
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={onClose}>OK ▶</button>
      </div>

      {/* #75: 初回怪我時のみ表示するチュートリアル */}
      {showInjuryTutorial && (
        <div className="event-overlay" style={{ background: 'rgba(38,54,40,0.86)', zIndex: 10 }}>
          <div className="event-card pop-in" style={{ maxWidth: 'min(94vw, 480px)', padding: '14px 16px' }}>
            <div className="event-title" style={{ textAlign: 'center', color: '#c43b3b' }}>🚑 怪我システム</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, margin: '10px 0' }}>
              <p style={{ margin: '0 0 8px' }}>選手は疲労が<b>85以上</b>になると、練習中に怪我をすることがある。疲労が<b>100</b>に達すると怪我のリスクが一気に上がるぞ。</p>
              <p style={{ margin: '0 0 8px' }}>怪我した選手は<b>1〜4週間</b>、練習にも試合にも出られない。試合直前に主力が抜けると痛い。</p>
              <p style={{ margin: '0 0 8px' }}>対策はシンプル。疲労がたまった選手は<b>休養メニュー</b>に切り替えるか、週末に<b>完全休養</b>を選ぼう。</p>
              <p className="dim" style={{ margin: 0, fontSize: 12 }}>「努力家」性格や「鉄人」スキルは怪我率が下がる。スタミナが高い選手も疲れにくい。</p>
            </div>
            <button className="btn" style={{ marginTop: 4 }} onClick={() => setShowInjuryTutorial(false)}>わかった ▶</button>
          </div>
        </div>
      )}
    </div>
  )
}
