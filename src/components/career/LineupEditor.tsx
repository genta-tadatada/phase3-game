// ============================================================
// components/career/LineupEditor.tsx — 戦術＆スタメン（同一画面で操作）
// ピッチ(自陣ハーフ)に11人を配置。右で戦術＋主将＋セットプレー/PKキッカーを設定。
// スタメンの下にベンチ。配置は CareerState.lineup に保存（careerToTeamが使用）。
// ============================================================

import { useState } from 'react'
import { useCareer } from '../../store/careerStore'
import { FORMATIONS, FORMATION_LIST } from '../../engine/match/formations'
import { FORMATION_COORDS } from '../../engine/match/formationCoords'
import { selectLineup } from '../../career/lineup'
import { playerOverallSum } from '../../engine/match/teamQuality'
import { POSITION_LABEL, POSITION_COLOR, MENTALITY_LABEL, FORMATION_DESC, PERSONALITY_LABEL } from '../../lib/labels'
import { abilityColor } from './RosterScreen'
import { featureUnlocked } from '../../career/unlocks'
import type { Tactics, Player } from '../../engine/types'

function shortName(name: string): string {
  const parts = name.split(/[\s　]/)
  return parts[0].slice(0, 4)
}

// #21: 疲労の色（MatchViewハーフタイム交代UIと同一基準＝🔴大/🟡中/🟢小）
function fatColor(fatigue: number): string {
  return fatigue >= 70 ? '#ff5a4d' : fatigue >= 45 ? '#ffd23f' : '#7fc97f'
}

export function LineupEditor() {
  const c = useCareer((s) => s.career)
  const go = useCareer((s) => s.go)
  const inComp = useCareer((s) => s.comp != null) // 大会中の調整なら戻り先は大会画面
  const setLineup = useCareer((s) => s.setLineup)
  const setCaptain = useCareer((s) => s.setCaptain)
  const setTactics = useCareer((s) => s.setTactics)
  const setSetPieceTaker = useCareer((s) => s.setSetPieceTaker)
  const setPkTaker = useCareer((s) => s.setPkTaker)
  const upd = (patch: Partial<Tactics>) => { if (c) setTactics({ ...c.tactics, ...patch }) }

  const tacticsOn = !!c && featureUnlocked('tactics', c.year, c.week) // 戦術（フォーメ/姿勢）は解放後のみ
  // B-5(2026-08-17): 「フォーメーション解放」イベント前にこの画面から他フォーメを選べてしまうバグ。
  //   CareerTactics 側だけ formations で絞っていて、こちらは FORMATION_LIST 全件を出していた。
  const formOk = !!c && featureUnlocked('formations', c.year, c.week)
  const formation = c?.tactics.formation ?? '4-4-2'
  const slots = FORMATIONS[formation]
  const coords = FORMATION_COORDS[formation]
  const pool = (c?.roster ?? []).filter((p) => (p.squad ?? 'A') === 'A' && !p.retired)

  const valid = c?.lineup && c.lineup.length === 11 && c.lineup.every((id) => pool.some((p) => p.id === id))
  const initial = valid ? c!.lineup! : selectLineup(pool, formation).map((p) => p.id)

  const [ids, setIds] = useState<string[]>(initial)
  const [sel, setSel] = useState<number | null>(null)
  if (!c) return null

  const byId = (id: string) => pool.find((p) => p.id === id)
  const bench = pool.filter((p) => !ids.includes(p.id))
  const starters = ids.map((id) => byId(id)).filter(Boolean) as Player[]
  const apply = (n: string[]) => { setIds(n); setLineup(n) }

  const onToken = (i: number) => {
    if (sel === null) setSel(i)
    else if (sel === i) setSel(null)
    else { const n = [...ids]; [n[i], n[sel]] = [n[sel], n[i]]; apply(n); setSel(null) }
  }
  const onBench = (pid: string) => {
    if (sel === null) return
    const n = [...ids]; n[sel] = pid; apply(n); setSel(null)
  }
  // おすすめ配置: ①各スロットに本職一致の選手を能力順で ②本職不在のスロットは未配置の総合力上位で
  const recommend = () => {
    const order = FORMATIONS[formation]
    const used = new Set<string>()
    const res: (string | null)[] = order.map(() => null)
    // ① 本職ポジション一致を優先（同ポジ複数なら総合力の高い方）
    order.forEach((pos, i) => {
      const best = pool
        .filter((p) => !used.has(p.id) && (pos === 'GK' ? p.isGK : (!p.isGK && p.position === pos)))
        .sort((a, b) => playerOverallSum(b) - playerOverallSum(a))[0]
      if (best) { res[i] = best.id; used.add(best.id) }
    })
    // ② 残ったスロットは未配置の総合力上位から埋める
    const rest = pool.filter((p) => !used.has(p.id)).sort((a, b) => playerOverallSum(b) - playerOverallSum(a))
    let ri = 0
    for (let i = 0; i < res.length; i++) if (!res[i]) { const p = rest[ri++]; if (p) res[i] = p.id }
    const final = res.filter(Boolean) as string[]
    if (final.length === order.length) { apply(final); setSel(null) }
  }

  const PlayerOpt = ({ p }: { p: Player }) => <option value={p.id}>{p.name}（{p.grade}年・{POSITION_LABEL[p.slot ?? p.position]}）</option>
  // G-20: キャプテン選択は性格でチームへの影響が変わるため、性格も併記する
  const CaptainOpt = ({ p }: { p: Player }) => <option value={p.id}>{p.name}（{p.grade}年・{POSITION_LABEL[p.slot ?? p.position]}・{PERSONALITY_LABEL[p.personality]}）</option>

  return (
    <div className="screen">
      <div className="app-title">戦術・スターティングメンバー</div>
      <h1 className="h1">戦術＆スタメン <span className="dim" style={{ fontSize: 15, fontWeight: 700 }}>{formation}</span></h1>
      <p className="dim" style={{ fontSize: 12.5, marginTop: -2, lineHeight: 1.55 }}>
        {sel === null ? '大きい文字＝配置ポジション。「本職◯◯」が出る選手は本来と違う位置で、力を出しにくい。スロットをタップ→入替。' : '入れ替え先（ベンチ選手 or 別スロット）をタップ'}
      </p>
      {/* #21: 疲労バー/ドットの凡例（試合前にコンディションを確認できる） */}
      <div className="dim" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, marginTop: -2, marginBottom: 6 }}>
        <span style={{ fontWeight: 700 }}>疲労</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#7fc97f' }} />余裕</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ffd23f' }} />やや疲労</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5a4d' }} />要休養</span>
      </div>

      <div className="cols c2" style={{ alignItems: 'start' }}>
        <div>
        <button className="btn ghost sm" style={{ marginBottom: 8, width: '100%' }} onClick={recommend}>⚡ おすすめ配置（本職どおりに自動編成）</button>
        {/* ピッチ（自陣ハーフ） */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '7 / 6', background: 'linear-gradient(120deg,#5cbd84,#46a96d)', borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          <svg viewBox="0 0 100 75" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={i * 16.67} y={0} width={8.3} height={75} fill="rgba(255,255,255,0.05)" />)}
            <g stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" fill="none">
              <rect x={2} y={3} width={96} height={69} />
              <rect x={2} y={23} width={20} height={29} />
              <rect x={2} y={31} width={8} height={13} />
              <line x1={1} y1={31} x2={1} y2={44} strokeWidth="1.6" />
              <line x1={98} y1={3} x2={98} y2={72} />
              <path d="M98 25 A 13 13 0 0 0 98 50" />
            </g>
          </svg>
          {coords.map(([depth, lat], i) => {
            const p = byId(ids[i])
            const selOn = sel === i
            const leftPct = i === 0 ? 8 : 19 + depth * 75
            const place = slots[i]
            const offPos = !!p && !p.isGK && p.position !== place  // 本職と配置が違う
            const injured = !!p && (p.injuryWeeks ?? 0) > 0 // #75: 怪我中のスタメン配置は警告強調
            return (
              <button key={i} onClick={() => onToken(i)}
                style={{
                  position: 'absolute', left: `${leftPct}%`, top: `${8 + lat * 84}%`,
                  transform: 'translate(-50%,-50%)', width: 62, maxWidth: '16.5%',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
                  background: selOn ? 'var(--orange)' : injured ? '#fff5f3' : 'rgba(255,255,255,0.95)',
                  color: selOn ? '#fff' : 'var(--ink)',
                  border: selOn ? '2px solid #fff' : injured ? '2px solid #c43b3b' : '2px solid rgba(0,0,0,0.12)',
                  borderRadius: 10, padding: '3px 2px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.26)',
                }}>
                {injured && (
                  <span style={{ position: 'absolute', top: -7, left: -3, fontSize: 9, fontWeight: 900, background: '#c43b3b', color: '#fff', borderRadius: 6, padding: '0 4px', boxShadow: '0 1px 2px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>🚑{p!.injuryWeeks}週</span>
                )}
                {/* 特殊能力を持つ選手はⒺバッジで一目で分かる（スタメン選定の判断材料） */}
                {p && (p.skills?.length ?? 0) > 0 && (
                  <span style={{ position: 'absolute', top: -5, right: -3, fontSize: 8.5, fontWeight: 900, background: 'var(--sun)', color: '#3a2a10', borderRadius: 6, padding: '0 3px', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>⚡{p.skills!.length}</span>
                )}
                {/* 配置ポジション（大きく・色付き） */}
                <span style={{ fontSize: 13.5, fontWeight: 900, lineHeight: 1.05, color: selOn ? '#fff' : POSITION_COLOR[place] }}>{POSITION_LABEL[place]}</span>
                {/* F10: 長い名前でトークンがはみ出さないよう max-width 内で省略 */}
                <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', display: 'inline-block' }}>{p ? shortName(p.name) : '—'}{p?.isCaptain && <span style={{ color: selOn ? '#fff' : '#d24a3a', fontWeight: 900 }}> C</span>}</span>
                {p && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, lineHeight: 1.05 }}>
                    {/* 学年（編成判断の補助・1/2/3） */}
                    <span style={{ fontSize: 9, fontWeight: 800, color: selOn ? '#fff' : 'var(--ink-dim)' }}>{p.grade}年</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, fontFamily: 'var(--font-num)', color: selOn ? '#fff' : abilityColor(playerOverallSum(p) / 7) }}>{Math.round(playerOverallSum(p) / 7)}</span>
                    {/* 本職ポジション（配置と違う時だけ・小さく警告色） */}
                    {offPos && <span style={{ fontSize: 8.5, fontWeight: 800, color: selOn ? '#fff3e0' : '#c8782a' }}>本職{POSITION_LABEL[p.position]}</span>}
                  </span>
                )}
                {/* #21: 疲労バー（招集メンバー全員の疲労を試合前に確認できる） */}
                {p && (
                  <span title={`疲労 ${Math.round(p.fatigue)}`} style={{ display: 'inline-block', width: 22, height: 3.5, borderRadius: 2, marginTop: 2, background: selOn ? 'rgba(255,255,255,0.85)' : fatColor(p.fatigue) }} />
                )}
              </button>
            )
          })}
        </div>

        {/* ベンチ（ピッチ下の余白に収める） */}
        <h2 className="h2" style={{ marginTop: 10 }}>ベンチ <span className="dim" style={{ fontSize: 12, fontWeight: 700 }}>{bench.length}人</span></h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {bench.length === 0 && <span className="dim" style={{ fontSize: 13 }}>控え選手がいません（部員が増えると増えます）。</span>}
          {bench.map((p) => {
            const inj = (p.injuryWeeks ?? 0) > 0
            return (
            <button key={p.id} onClick={() => onBench(p.id)} disabled={sel === null}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: inj ? '#fff5f3' : '#fff', border: inj ? '2px solid #c43b3b' : '2px solid var(--card-edge)', borderRadius: 10, padding: '6px 9px', cursor: sel === null ? 'default' : 'pointer' }}>
              {inj && <span style={{ fontSize: 10.5, fontWeight: 900, color: '#fff', background: '#c43b3b', borderRadius: 5, padding: '1px 5px', whiteSpace: 'nowrap' }}>🚑{p.injuryWeeks}週</span>}
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-dim)' }}>{POSITION_LABEL[p.slot ?? p.position]}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-dim)' }}>{p.grade}年</span>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{shortName(p.name)}</span>
              <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-num)', color: abilityColor(playerOverallSum(p) / 7) }}>{Math.round(playerOverallSum(p) / 7)}</span>
              {/* #21: 疲労ドット（控えも疲労を確認して交代の判断材料に） */}
              <span title={`疲労 ${Math.round(p.fatigue)}`} style={{ width: 8, height: 8, borderRadius: '50%', background: fatColor(p.fatigue), flexShrink: 0 }} />
              {(p.skills?.length ?? 0) > 0 && <span style={{ fontSize: 10, fontWeight: 900, color: '#c8841a' }}>⚡{p.skills!.length}</span>}
            </button>
            )
          })}
        </div>
        </div>

        {/* 右カラム：戦術＋主将＋キッカー。戦術は解放後のみ（未解放時はフォーメ4-4-2固定・スタメンと主将のみ） */}
        <div className="panel" style={{ padding: '10px 12px' }}>
          {tacticsOn ? (<>
          <div className="section-label" style={{ marginBottom: 8 }}>⚙ 戦術（互角時）</div>
          <TacChips label="フォーメーション" opts={(formOk ? FORMATION_LIST : (['4-4-2'] as unknown as typeof FORMATION_LIST)).map((f) => [f, f])} val={formation} on={(v) => upd({ formation: v as Tactics['formation'] })} hint={formOk ? FORMATION_DESC[formation] : '他のフォーメーションは解放後に選べる（まずは4-4-2に慣れよう）'} />
          <TacChips label="姿勢" opts={(['ultra-attack', 'attack', 'balance', 'defense', 'ultra-defense'] as const).map((m) => [m, MENTALITY_LABEL[m]])} val={c.tactics.mentality} on={(v) => upd({ mentality: v as Tactics['mentality'] })} hint="攻撃的ほど得点力UP・守備が手薄に。守備的ほど堅いが点は取りにくい。" />
          <TacChips label="プレス" opts={[['high', '激しい'], ['mid', '標準'], ['low', '低い']]} val={c.tactics.press} on={(v) => upd({ press: v as Tactics['press'] })} hint="激しい＝高い位置で奪える／スタミナ消耗。低い＝省エネだが押し込まれやすい。" />
          <TacChips label="守備ライン" opts={[['high', '高い'], ['mid', '標準'], ['low', '低い']]} val={c.tactics.defenseLine} on={(v) => upd({ defenseLine: v as Tactics['defenseLine'] })} hint="高い＝主導権を握れるが、速い相手に裏を取られやすい。低い＝安全だが押し込まれる。" />
          <TacChips label="攻撃の幅" opts={[['wide', 'ワイド'], ['mid', '標準'], ['central', '中央']]} val={c.tactics.width} on={(v) => upd({ width: v as Tactics['width'] })} hint="ワイド＝サイドから崩す。中央＝中央突破を狙う。" />
          <TacChips label="ビルドアップ" opts={[['fast', '速い'], ['mid', '標準'], ['slow', '遅い']]} val={c.tactics.buildUp} on={(v) => upd({ buildUp: v as Tactics['buildUp'] })} hint="速い＝手数をかけず速攻。遅い＝じっくり保持して崩す。" />
          <button className="btn ghost sm" style={{ marginTop: 2, marginBottom: 10 }} onClick={() => go('tactics')}>リード時・ビハインド時の戦術 ▸</button>
          </>) : (
          <div className="dim" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
            ⚙ 戦術（フォーメーションや姿勢の設定）は、シーズンが進むと解放されます。今は<b>スタメン（出場メンバー）</b>と<b>主将・キッカー</b>を決めましょう。フォーメーションは <b>4-4-2</b> です。
          </div>
          )}

          <div className="section-label" style={{ marginBottom: 8 }}>👑 主将・キッカー</div>
          <label className="label" style={{ marginBottom: 3 }}>主将（C）</label>
          {/* #62: 主将変更ペナルティの事前告知（変えるとチームが混乱して雰囲気が下がる）。 */}
          <div className="dim" style={{ fontSize: 11, marginBottom: 4, lineHeight: 1.5, color: 'var(--orange-deep, #c2622d)' }}>⚠ 主将を変更すると雰囲気が <b>-3〜-5</b> 下がる（チームの混乱・派閥）。やむを得ない時だけ。</div>
          <select className="input" style={{ padding: '8px 10px', fontSize: 13, marginBottom: 8 }} value={starters.find((p) => p.isCaptain)?.id ?? ''} onChange={(e) => setCaptain(e.target.value)}>
            <option value="">未設定</option>
            {starters.map((p) => <CaptainOpt key={p.id} p={p} />)}
          </select>
          {/* G-08 + 2026-06-26: 下級生キャプテンのトレードオフを明示。
              leader性格 or captaincyスキル所持で違和感が半減、両方持ち(闘将)で雰囲気がむしろ上がる。 */}
          {(() => {
            const cap = starters.find((p) => p.isCaptain)
            if (!cap) return null
            if (cap.grade >= 3) {
              return <div className="dim" style={{ fontSize: 11, marginTop: -4, marginBottom: 8, lineHeight: 1.5 }}>📌 3年生主将＝定石。チームの雰囲気が安定する。</div>
            }
            const hasCap = !!cap.skills?.includes('captaincy')
            const isLeader = cap.personality === 'leader'
            const isToshow = hasCap && isLeader
            const growMult = cap.grade === 1 ? '×1.20' : '×1.10'
            if (isToshow) {
              return <div style={{ fontSize: 11, marginTop: -4, marginBottom: 8, lineHeight: 1.55, color: '#1f7a4d' }}>⭐ <b>闘将</b>（リーダー×キャプテンシー）＝下級生主将なのに雰囲気<b>+{cap.grade === 1 ? '0.5' : '1.0'}/週</b>。本人成長{growMult}。3年生主将より得な配置。</div>
            }
            if (isLeader || hasCap) {
              const why = isLeader ? 'リーダー性格' : 'キャプテンシー'
              const half = cap.grade === 1 ? '-0.75' : '-0.25'
              return <div style={{ fontSize: 11, marginTop: -4, marginBottom: 8, lineHeight: 1.55, color: 'var(--orange-deep, #c2622d)' }}>⚠ {cap.grade}年生主将（{why}持ち）＝違和感半減（雰囲気<b>{half}/週</b>）。本人成長{growMult}。</div>
            }
            if (cap.grade === 2) {
              return <div className="dim" style={{ fontSize: 11, marginTop: -4, marginBottom: 8, lineHeight: 1.55, color: 'var(--orange-deep, #c2622d)' }}>⚠ 2年生主将＝軽い違和感（雰囲気<b>-0.5/週</b>）。本人成長{growMult}。リーダー性格 or キャプテンシー持ちで違和感が半減。</div>
            }
            return <div style={{ fontSize: 11, marginTop: -4, marginBottom: 8, lineHeight: 1.55, color: '#b23b22' }}>⚠ 1年生主将＝強い違和感（雰囲気<b>-1.5/週</b>）。本人成長{growMult}＋特殊能力習得確率UP。リーダー性格 or キャプテンシー持ちで違和感が半減。両方持ちなら<b>闘将</b>で逆にプラス。</div>
          })()}
          <label className="label" style={{ marginBottom: 3 }}>セットプレーキッカー（FK・CK）</label>
          <select className="input" style={{ padding: '8px 10px', fontSize: 13, marginBottom: 8 }} value={c.setPieceTaker ?? ''} onChange={(e) => setSetPieceTaker(e.target.value)}>
            <option value="">自動（適性の高い選手）</option>
            {[...starters, ...bench].map((p) => <PlayerOpt key={p.id} p={p} />)}
          </select>
          <label className="label" style={{ marginBottom: 3 }}>PKキッカー</label>
          <select className="input" style={{ padding: '8px 10px', fontSize: 13 }} value={c.pkTaker ?? ''} onChange={(e) => setPkTaker(e.target.value)}>
            <option value="">自動（キックが上手い選手）</option>
            {[...starters, ...bench].map((p) => <PlayerOpt key={p.id} p={p} />)}
          </select>
        </div>
      </div>

      <div className="footer-cta">
        <button className="btn" onClick={() => go(inComp ? 'comp-bracket' : 'weekly')}>{inComp ? '大会へ戻る ▶' : '決定して戻る ▶'}</button>
      </div>
    </div>
  )
}

function TacChips({ label, opts, val, on, hint }: { label: string; opts: string[][]; val: string; on: (v: string) => void; hint?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="label" style={{ marginBottom: 4 }}>{label}</div>
      <div className="chip-row">
        {opts.map(([v, t]) => (
          <button key={v} className={`chip ${val === v ? 'active' : ''}`} style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => on(v)}>{t}</button>
        ))}
      </div>
      {hint && <div className="dim" style={{ fontSize: 10.5, marginTop: 3, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  )
}
