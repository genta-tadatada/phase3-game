// ============================================================
// components/career/PracticePlanner.tsx — 週次練習（メニュー枠＋選手割当）
//   各選手は1つの枠にだけ参加（週1メニュー）。未割当=完全休養。
//   グループ一括割当（中盤/守備/攻撃/GK/全FP）＋本職で自動割当＋個別割当。
// ============================================================

import { useState } from 'react'
import { useCareer } from '../../store/careerStore'
import { availableMenus, getMenu } from '../../career/trainingMenus'
import type { PracticeGroup, TrainingMenu } from '../../career/types'
import { POSITION_LABEL } from '../../lib/labels'
import { weatherAbilityMult, WEATHER_ICON, type Weather } from '../../career/weather'
import { squadCategoryOf } from '../../career/squad'

const AB_LABEL: Record<string, string> = {
  kick: 'キック', power: 'パワー', speed: 'スピード', technique: '技術',
  stamina: 'スタミナ', iq: 'IQ', defense: '守備', saving: 'セービング', gkIq: 'GK-IQ',
}
const LANE_COLOR = ['#2a9d8f', '#457b9d', '#e76f51', '#f4a261', '#9b5de5', '#c0843a']
const GROUPS: { g: PracticeGroup | 'allfp'; label: string }[] = [
  { g: 'mf', label: '中盤陣' }, { g: 'df', label: '守備陣' }, { g: 'fw', label: '攻撃陣' }, { g: 'gk', label: 'GK' }, { g: 'allfp', label: '全FP' },
]

// 伸びる能力を矢印の数で明示（main=▲▲ 大きく / sub=▲ 少し）
function menuMain(m: TrainingMenu): string { return m.main.map((k) => AB_LABEL[k] ?? k).join('・') }
function menuSub(m: TrainingMenu): string { return m.sub.map((k) => AB_LABEL[k] ?? k).join('・') }
// 疲労の増減を分かりやすく（練習は+／休養系は回復）
function fatigueText(m: TrainingMenu): string {
  return m.fatigue < 0 ? `疲労回復 ${-m.fatigue}` : `疲労 +${m.fatigue}`
}
// 今週の天候で、このメニューの main/sub 能力が実際にどう影響を受けるかを抽出。
// 影響を受ける能力が無い場合は null（＝バッジを出さない）。
function menuWeatherEffect(m: TrainingMenu, weather?: Weather): { pos: string[]; neg: string[] } | null {
  if (!weather || m.weatherProof) return null
  const keys = [...m.main, ...m.sub]
  if (keys.length === 0) return null
  const pos: string[] = []
  const neg: string[] = []
  for (const k of keys) {
    const mult = weatherAbilityMult(weather, k, false)
    if (mult >= 1.05) pos.push(AB_LABEL[k] ?? k)
    else if (mult <= 0.95) neg.push(AB_LABEL[k] ?? k)
  }
  if (pos.length === 0 && neg.length === 0) return null
  return { pos, neg }
}

// 効果バッジ（伸びる能力・疲労を枠と別色で大きく・高コントラストに分離表示）
// 天候バッジは「実際に影響を受けるとき（+/-）のみ」表示する（常時表示はチュートリアルで把握済のため不要）。
// compact=true ＝ 選択モーダル用（横幅が狭いので天候バッジを「☁️ 能力 ▲」に縮約・黄色で色分離・別行折返し可）
// compact=false ＝ ホーム画面用（横幅に余裕があるので旧表示「曇りで〇〇が伸びやすい ▲」緑/橙のまま）
function EffectBadges({ m, weather, compact = false }: { m: TrainingMenu; weather?: Weather; compact?: boolean }) {
  const main = menuMain(m); const sub = menuSub(m); const rest = m.fatigue < 0
  // #68: 小型化（fontSize 12→11・padding 3px8px→2px6px・gap 6→4）。
  const badge: React.CSSProperties = { fontSize: 11, fontWeight: 800, borderRadius: 7, padding: '2px 6px', lineHeight: 1.3, whiteSpace: 'nowrap' }
  const wBadge: React.CSSProperties = { ...badge, whiteSpace: 'normal', wordBreak: 'break-word' }
  const wEff = menuWeatherEffect(m, weather)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, minWidth: 0 }}>
      {main && <span style={{ ...badge, background: '#dff0e6', color: '#1f7a4d' }}>{main} <b style={{ fontSize: 13 }}>▲▲</b></span>}
      {sub && <span style={{ ...badge, background: '#e7f0f6', color: '#356a8a' }}>{sub} <b style={{ fontSize: 12 }}>▲</b></span>}
      <span style={{ ...badge, background: rest ? '#dff0e6' : '#fbe2db', color: rest ? '#1f7a4d' : '#b23b22' }}>{fatigueText(m)}</span>
      {wEff && weather && (wEff.pos.length > 0 || wEff.neg.length > 0) && (
        compact ? (
          <div style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0 }}>
            {/* 選択モーダル: 天候は黄色系で能力(緑/水色)・疲労(赤)と色被りしない。文字数削減: 天候絵文字＋能力名＋▲/▼ のみ。 */}
            {wEff.pos.length > 0 && (
              <span style={{ ...wBadge, background: '#fff4cc', color: '#8a6d00' }}>{WEATHER_ICON[weather]} {wEff.pos.join('・')} ▲</span>
            )}
            {wEff.neg.length > 0 && (
              <span style={{ ...wBadge, background: '#ffe0d1', color: '#b04d20' }}>{WEATHER_ICON[weather]} {wEff.neg.join('・')} ▼</span>
            )}
          </div>
        ) : (
          <>
            {/* ホーム画面: 文章は旧表示のまま、色だけモーダルと揃える（pos=黄・neg=橙でmain緑と色被り回避）。 */}
            {wEff.pos.length > 0 && (
              <span style={{ ...badge, background: '#fff4cc', color: '#8a6d00' }}>{weather}で{wEff.pos.join('・')}が伸びやすい ▲</span>
            )}
            {wEff.neg.length > 0 && (
              <span style={{ ...badge, background: '#ffe0d1', color: '#b04d20' }}>{weather}で{wEff.neg.join('・')}が伸びにくい ▼</span>
            )}
          </>
        )
      )}
    </div>
  )
}

export function PracticePlanner() {
  const c = useCareer((s) => s.career)
  const plan = useCareer((s) => s.plan)
  const setLaneMenu = useCareer((s) => s.setLaneMenu)
  const assignGroup = useCareer((s) => s.assignGroup)
  const assignPlayer = useCareer((s) => s.assignPlayer)
  const autoAssign = useCareer((s) => s.autoAssignPositions)
  const repeatLastPlan = useCareer((s) => s.repeatLastPlan)
  const hasLast = !!c?.lastPlan && Array.isArray(c.lastPlan.lanes)
  const [picker, setPicker] = useState<number | null>(null)
  const [openLane, setOpenLane] = useState<number | null>(null) // 参加者の割り当てUIを開いている枠（既定は折りたたみ＝画面を圧迫しない）
  if (!c) return null

  const menus = availableMenus(c.facilities.training)
  // 攻撃／守備／フィジカル／その他／GK の5カテゴリ（戦術・実戦・調整・休養は「その他」に統合）
  const byCat = (cat: import('../../career/types').TrainingCategory) => menus.filter((m) => m.category === cat)
  const catSections: { key: import('../../career/types').TrainingCategory; label: string; icon: string; color: string }[] = [
    { key: '攻撃',     label: '攻撃',     icon: '⚽',  color: '#e76f51' },
    { key: '守備',     label: '守備',     icon: '🛡',  color: '#457b9d' },
    { key: 'フィジカル', label: 'フィジカル', icon: '💪', color: '#9b5de5' },
    { key: 'その他',   label: 'その他',   icon: '🧠', color: '#2a9d8f' },
    { key: 'GK',       label: 'GK',       icon: '🥅', color: '#f0843c' },
  ]
  const pool = c.roster.filter((p) => (p.squad ?? 'A') === 'A')
  const inLane = (i: number) => pool.filter((p) => plan.assign[p.id] === i)
  const rested = pool.filter((p) => plan.assign[p.id] == null || !plan.lanes[plan.assign[p.id]])
  // 2026-06-26: B/C/招集外 の自動成長メンバー数（PracticePlannerでは非表示・透明性のため別セクションで集計表示）
  const unlockCtx = { roster: { length: c.roster.length }, facilities: { dorm: c.facilities.dorm }, staff: c.staff }
  const bcoCounts = { B: 0, C: 0, orphan: 0 }
  for (const p of c.roster) {
    if (p.retired) continue
    const cat = squadCategoryOf(p, unlockCtx)
    if (cat === 'B' || cat === 'C' || cat === 'orphan') bcoCounts[cat]++
  }
  const hasBco = bcoCounts.B + bcoCounts.C + bcoCounts.orphan > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="h2">今週の練習 <span className="dim" style={{ fontSize: 11, fontWeight: 700 }}>各選手は1つだけ参加</span></h2>
        <div style={{ display: 'flex', gap: 5 }}>
          {hasLast && <button className="chip" style={{ padding: '5px 9px', fontSize: 12 }} onClick={repeatLastPlan}>先週と同じ ↻</button>}
          <button className="chip" style={{ padding: '5px 9px', fontSize: 12 }} onClick={autoAssign}>⚡ 自動割当</button>
        </div>
      </div>
      {plan.lanes.length < 6 && (
        <div className="dim" style={{ fontSize: 11, marginTop: -2 }}>練習枠は現在{plan.lanes.length}つ。トレーニング設備の強化とコーチの採用で最大6つまで増えます。</div>
      )}

      {/* 広い画面では枠を2カラムに（PCの横幅を活かす）。スマホは1カラム。 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 8, alignItems: 'start' }}>
      {plan.lanes.map((lane, i) => {
        const menu = getMenu(lane.menuId)
        const members = inLane(i)
        // #28: マンネリ予兆。前週までの連続採用週数で判定（4週超で成長・雰囲気↓）。
        const streak = c.menuStreak?.[lane.menuId] ?? 0
        const mannerism = streak >= 4 ? 'active' : streak >= 3 ? 'warn' : null
        return (
          <div key={i} className="panel" style={{ padding: '8px 11px', borderLeft: `5px solid ${LANE_COLOR[i]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setPicker(i)} style={{ display: 'flex', alignItems: 'baseline', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, minWidth: 0, textAlign: 'left' }}>
                <span style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--ink)' }}>枠{i + 1}：{menu.name}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: LANE_COLOR[i] }}>変更 ▸</span>
              </button>
              {/* 人数バッジ＝参加者割当の開閉トグル（折りたたみで画面を圧迫しない・#UI） */}
              <button onClick={() => setOpenLane(openLane === i ? null : i)}
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3, background: openLane === i ? LANE_COLOR[i] : '#f3eee4', color: openLane === i ? '#fff' : 'var(--ink-soft)', border: 'none', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
                👥{members.length} {openLane === i ? '▲' : '▼'}
              </button>
            </div>
            {/* 伸びる能力・疲労を枠と別色のバッジで大きく分離（同色で読みづらい問題の解消） */}
            <EffectBadges m={menu} weather={c.weather as Weather | undefined} />
            {/* #28: マンネリの予兆/発生（別メニューに替えるとリセット） */}
            {mannerism && (
              <div style={{ marginTop: 5, fontSize: 11, fontWeight: 800, color: mannerism === 'active' ? '#b23b22' : '#a9791c' }}>
                {mannerism === 'active'
                  ? '⚠️ マンネリ（成長▼雰囲気▼）別メニューへ'
                  : '⚠️ そろそろマンネリ気味（同じ練習が続いています）'}
              </div>
            )}
            {openLane === i && (<>
              {/* グループ一括割当 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '7px 0 5px' }}>
                {GROUPS.map(({ g, label }) => (
                  <button key={g} className="chip" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => assignGroup(i, g)}>＋{label}</button>
                ))}
              </div>
              {/* 配置選手（タップで休養に外す） */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {members.length === 0 && <span className="dim" style={{ fontSize: 11.5 }}>未配置</span>}
                {members.map((p) => (
                  <button key={p.id} onClick={() => assignPlayer(p.id, null)} title="タップで休養へ"
                    style={{ fontSize: 12.5, fontWeight: 700, background: '#fff', border: '1.5px solid var(--card-edge)', borderRadius: 9, padding: '4px 9px', cursor: 'pointer', minHeight: 30 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>{POSITION_LABEL[p.slot ?? p.position]}</span> {p.name.split(/[\s　]/)[0]}
                  </button>
                ))}
              </div>
            </>)}
          </div>
        )
      })}
      </div>

      {/* 2026-06-26: B/C/招集外 の自動成長セクション（透明性UI）。
          これらの選手はPracticePlannerで個別操作できない＝何の練習を受けるか分からないと混乱するため明示。
          実際の成長は growth.ts の万能成長で全7能力に少しずつ加算（A特化練習を絶対に超えない範囲）。 */}
      {hasBco && (
        <div className="panel" style={{ padding: '8px 11px', marginTop: 8, background: '#f6f1e8', borderLeft: '4px solid #a47d4a' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>🔹 育成メンバー（自動成長）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
            {bcoCounts.B > 0 && <span>Bチーム <b style={{ color: 'var(--ink)' }}>{bcoCounts.B}人</b></span>}
            {bcoCounts.C > 0 && <span>Cチーム <b style={{ color: 'var(--ink)' }}>{bcoCounts.C}人</b></span>}
            {bcoCounts.orphan > 0 && <span>招集外 <b style={{ color: 'var(--ink)' }}>{bcoCounts.orphan}人</b></span>}
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
            B・Cチームはコーチの指導、招集外は自主練で伸びていく。
          </div>
        </div>
      )}

      {/* 休ませたい選手は枠メニューを「ストレッチ・休養」にして入れる（＝練習内での休養に一本化）。
          ここでは未参加の選手を控えめに表示するだけ（週末の「完全休養」は別途・週末枠で選べる）。 */}
      {rested.length > 0 && (
        <div className="dim" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.6 }}>
          💤 未参加 {rested.length}人（疲労回復のみ）。休ませるなら枠を<b>「ストレッチ・休養」</b>にして入れてもOK。
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
            {rested.map((p) => (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, background: '#f3eee4', borderRadius: 8, padding: '2px 5px 2px 8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{p.name.split(/[\s　]/)[0]}</span>
                {plan.lanes.map((_, li) => (
                  <button key={li} onClick={() => assignPlayer(p.id, li)} title={`枠${li + 1}へ`}
                    style={{ width: 18, height: 18, borderRadius: 5, border: 'none', background: LANE_COLOR[li], color: '#fff', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>{li + 1}</button>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* メニュー選択モーダル */}
      {/* F1.5: PCでは横幅を活かす（min(94vw, 760px)）。スマホは frame内 (94vw)。 */}
      {picker !== null && (
        <div className="event-overlay" style={{ background: 'rgba(40,30,20,0.5)' }} onClick={() => setPicker(null)}>
          <div className="panel pop-in" style={{ maxWidth: 'min(94vw, 760px)', width: '100%', maxHeight: '86%', overflowY: 'auto', padding: '12px 14px' }} onClick={(e) => e.stopPropagation()}>
            <div className="section-label" style={{ marginBottom: 8 }}>枠{picker + 1} のメニューを選ぶ</div>
            {(() => {
              // #68: カード小型化（minHeight 64→48・padding 10→7・font 15→13.5）。
              //   分類タブで項目数が減ったので1カードあたりも詰めて、画面の縦伸びを抑える。
              const cardOf = (m: TrainingMenu) => {
                const on = plan.lanes[picker].menuId === m.id
                return (
                  <button key={m.id}
                    onClick={() => { setLaneMenu(picker, m.id); setPicker(null) }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 3, textAlign: 'left',
                      padding: '7px 9px', borderRadius: 10, cursor: 'pointer', minHeight: 48,
                      background: on ? 'var(--orange-pastel)' : '#fff',
                      border: on ? '2px solid var(--orange)' : '1.5px solid rgba(74,64,54,0.14)',
                      boxShadow: on ? '0 2px 8px rgba(244,126,60,0.25)' : '0 1px 2px rgba(0,0,0,0.04)',
                    }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.25 }}>{m.name}</span>
                    <EffectBadges m={m} weather={c.weather as Weather | undefined} compact />
                  </button>
                )
              }
              // #68: カードを細くして1行に多く並べる（minmax 172→150）。スマホでも2カラム可能に。
              const grid = (list: TrainingMenu[]) => (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 6 }}>{list.map(cardOf)}</div>
              )
              // 5分類タブ（攻撃／守備／フィジカル／その他／GK）。
              //   戦術・実戦・調整・休養は「その他」に統合。1セクションあたりの項目数が適度で選びやすい。
              return (
                <>
                  {catSections.map((cat) => {
                    const list = byCat(cat.key)
                    if (list.length === 0) return null
                    return (
                      <div key={cat.key}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 5px', fontSize: 11.5, fontWeight: 800, color: cat.color }}>
                          <span>{cat.icon} {cat.label}</span>
                          <span style={{ background: '#f3eee4', color: 'var(--ink-soft)', padding: '1px 7px', borderRadius: 10, fontSize: 10.5, fontWeight: 700 }}>{list.length}</span>
                        </div>
                        {grid(list)}
                      </div>
                    )
                  })}
                </>
              )
            })()}
            <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>設備を強化するとメニューが増えます。</div>
            <button className="btn ghost sm" style={{ marginTop: 8, width: '100%' }} onClick={() => setPicker(null)}>とじる</button>
          </div>
        </div>
      )}
    </div>
  )
}
