import { useState } from 'react'
import { useCareer } from '../../store/careerStore'
import { AbilityBars, RankBadge } from '../shared'
import { selectLineup } from '../../career/lineup'
import { abcUnlocked } from '../../career/squad'
import { playerOverallSum, playerLevelSum, bestFieldPosition } from '../../engine/match/teamQuality'
import type { Player, Abilities, PositionType } from '../../engine/types'
import { PERSONALITY_LABEL, conditionLabel, gradeLabel, POSITION_LABEL, overallLabel, heightCmOf, ABILITY_ICON, GK_ABILITY_ICON } from '../../lib/labels'
import { skillName, skillById, RARITY_COLOR, RARITY_LABEL, COMBO_GRADIENT } from '../../data/skills'
import { activeCombos } from '../../data/combos'
import { personalityEffectText, studyAptitude, STUDY_APT_LABEL } from '../../career/personality'
import { PlayerAvatar } from '../../ui/PlayerAvatar'
import { asset } from '../../ui/asset'

const MINI_ORDER: (keyof Abilities)[] = ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense']
// 調子を栄冠ナイン式の色付き矢印で（好調=オレンジ↑ / 不調=青↓ / 普通=灰→）
const COND_MARK = [
  null,
  { s: '↓↓', c: '#3f6fb0' }, // 1 絶不調
  { s: '↓', c: '#5b9bd5' },  // 2 不調
  { s: '→', c: '#9aa3ad' },  // 3 普通
  { s: '↑', c: '#f0843c' },  // 4 好調
  { s: '↑↑', c: '#e8554f' }, // 5 絶好調
] as const
function CondMark({ condition }: { condition: number }) {
  const m = COND_MARK[condition] ?? COND_MARK[3]!
  return <span title="調子" style={{ color: m.c, fontWeight: 900 }}>{m.s}</span>
}

function fatigueColor(f: number): string {
  if (f >= 90) return '#e63946'
  if (f >= 70) return '#f4a261'
  if (f >= 50) return '#ffd166'
  return '#52b788'
}
// 能力値の色分け（栄冠ナイン風・§7.5）: 値の帯ごとに色を変える
export function abilityColor(v: number): string {
  if (v >= 90) return '#e8554f'  // 赤=傑出
  if (v >= 75) return '#f0843c'  // 橙
  if (v >= 60) return '#e0a91c'  // 黄(濃)
  if (v >= 45) return '#3f9e74'  // 緑
  if (v >= 30) return '#5b8def'  // 青
  return '#9aa3ad'               // 灰
}

// 能力メーターのフィル色（値帯ごとにグラデーションを変える＝高能力ほど鮮やか・特別感）。
// stat-fillの style.background を上書きして使う。
export function abilityFillGradient(v: number): string {
  if (v >= 90) return 'linear-gradient(90deg, #ffce4d 0%, #f0843c 40%, #e8554f 75%, #d6248f 100%)' // 金→橙→赤→マゼンタ（傑出）
  if (v >= 75) return 'linear-gradient(90deg, #b6e072 0%, #f0bb3c 60%, #f0843c 100%)'              // 黄緑→金→橙
  if (v >= 60) return 'linear-gradient(90deg, #6fcd95 0%, #b6e072 55%, #e0a91c 100%)'              // 緑→黄緑→黄
  if (v >= 45) return 'linear-gradient(90deg, #4fb487 0%, #6fcd95 100%)'                            // 緑のみ
  if (v >= 30) return 'linear-gradient(90deg, #5b8def 0%, #84b6e8 100%)'                            // 青
  return 'linear-gradient(90deg, #9aa3ad 0%, #b4bcc6 100%)'                                         // 灰
}

const ABBR: Record<keyof Abilities, string> = {
  kick: 'キ', power: 'パ', speed: '走', technique: '技', stamina: '体', iq: '知', defense: '守',
}

const FIELD_POS: PositionType[] = ['CB', 'SB', 'WB', 'DM', 'CM', 'AM', 'WF', 'CF']

/** 能力を数値＋色で一目化（栄冠ナイン風）。#56: GKはGK固有能力(セ/GK-IQ)を主役に専用表示。 */
function AbilityChips({ player }: { player: Player }) {
  if (player.isGK && player.gk) {
    const gk = player.gk
    const commons: (keyof Abilities)[] = ['power', 'speed', 'iq', 'stamina'] // GKに効く身体・読み
    return (
      <div className="ab-grid">
        <div className="ab-cell"><img src={asset(GK_ABILITY_ICON.saving)} alt="セ" title="セービング" style={{ width: 15, height: 15, objectFit: 'contain', flexShrink: 0 }} /><span className="ab-v" style={{ color: abilityColor(gk.saving) }}>{Math.round(gk.saving)}</span></div>
        <div className="ab-cell"><img src={asset(GK_ABILITY_ICON.gkIq)} alt="GK" title="GK-IQ" style={{ width: 15, height: 15, objectFit: 'contain', flexShrink: 0 }} /><span className="ab-v" style={{ color: abilityColor(gk.gkIq) }}>{Math.round(gk.gkIq)}</span></div>
        {commons.map((k) => (
          <div className="ab-cell" key={k}>
            <img src={asset(ABILITY_ICON[k])} alt={ABBR[k]} title={ABBR[k]} style={{ width: 15, height: 15, objectFit: 'contain', flexShrink: 0 }} />
            <span className="ab-v" style={{ color: abilityColor(player.abilities[k]) }}>{Math.round(player.abilities[k])}</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="ab-grid">
      {MINI_ORDER.map((k) => (
        <div className="ab-cell" key={k}>
          <img src={asset(ABILITY_ICON[k])} alt={ABBR[k]} title={ABBR[k]} style={{ width: 15, height: 15, objectFit: 'contain', flexShrink: 0 }} />
          <span className="ab-v" style={{ color: abilityColor(player.abilities[k]) }}>{Math.round(player.abilities[k])}</span>
        </div>
      ))}
    </div>
  )
}

type SortKey = 'overall' | 'grade' | 'position'

export function RosterScreen() {
  const c = useCareer((s) => s.career)
  const [sel, setSel] = useState<Player | null>(null)
  const [sort, setSort] = useState<SortKey>('grade')
  const [squad, setSquad] = useState<'all' | 'A' | 'B' | 'C'>('all')
  if (!c) return null

  const lineup = selectLineup(c.roster, c.tactics.formation)
  const lineupIds = new Set(lineup.map((p) => p.id))
  // #5: 冬大会後に引退した3年は選手一覧から消す（部活から去ったため）。年度末に正式卒業。
  const activeRoster = c.roster.filter((p) => !p.retired)
  const hasSquads = activeRoster.some((p) => (p.squad ?? 'A') !== 'A')

  const filtered = activeRoster.filter((p) => squad === 'all' || (p.squad ?? 'A') === squad)
  const byOverall = (a: Player, b: Player) => playerOverallSum(b) - playerOverallSum(a)
  const posCat = (p: Player): 'FW' | 'MF' | 'DF' | 'GK' => {
    if (p.isGK) return 'GK'
    const pos = p.slot ?? p.position
    if (pos === 'CF' || pos === 'WF') return 'FW'
    if (pos === 'CB' || pos === 'SB') return 'DF'
    return 'MF'
  }
  let groups: { label: string; players: Player[] }[]
  if (sort === 'position') {
    groups = (['FW', 'MF', 'DF', 'GK'] as const).map((cat) => ({ label: cat, players: filtered.filter((p) => posCat(p) === cat).sort(byOverall) }))
  } else if (sort === 'overall') {
    const sorted = [...filtered].sort(byOverall)
    const m = new Map<string, Player[]>()
    for (const p of sorted) { const l = overallLabel(playerLevelSum(p), 'player', c?.prefecture).label; if (!m.has(l)) m.set(l, []); m.get(l)!.push(p) }
    groups = [...m.entries()].map(([label, players]) => ({ label, players }))
  } else {
    groups = ([3, 2, 1] as const).map((g) => ({ label: `${g}年生`, players: filtered.filter((p) => p.grade === g).sort(byOverall) }))
  }
  groups = groups.filter((g) => g.players.length > 0)

  const renderCard = (p: Player) => {
    const sum = playerLevelSum(p)
    const starter = lineupIds.has(p.id)
    const injured = (p.injuryWeeks ?? 0) > 0
    return (
      <div key={p.id} className={`pcard float-up ${starter ? 'starter' : ''} ${injured ? 'injured' : ''}`} onClick={() => setSel(p)}>
        {starter && <span style={{ position: 'absolute', top: 7, right: 8, fontSize: 13 }}>⭐</span>}
        <div className="pcard-top">
          <PlayerAvatar player={p} size={44} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pcard-name"><span style={{ color: 'var(--accent)', fontFamily: 'var(--font-num)', marginRight: 5 }}>{p.number ?? '—'}</span>{p.name}{p.isCaptain && <span className="tag captain" style={{ marginLeft: 4, padding: '0 5px' }}>C</span>}{p.retired && <span className="tag" style={{ marginLeft: 4, padding: '0 5px', background: 'var(--ink-dim)', color: '#fff' }}>引退</span>}{(p.injuryWeeks ?? 0) > 0 && <span className="tag" style={{ marginLeft: 4, padding: '0 5px', background: '#c43b3b', color: '#fff' }}>怪我{p.injuryWeeks}週</span>}{(p.cramWeeks ?? 0) > 0 && <span className="tag" style={{ marginLeft: 4, padding: '0 5px', background: '#a9791c', color: '#fff' }}>補習{p.cramWeeks}週</span>}</div>
            <div className="pcard-meta">{gradeLabel(p.grade)}・{POSITION_LABEL[p.slot ?? p.position]}・調子<CondMark condition={p.condition} /></div>
          </div>
        </div>
        {/* 性格はカード全幅の独立行で（途中改行を防ぐ） */}
        <div className="pcard-meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>性格 <b style={{ color: 'var(--ink)' }}>{PERSONALITY_LABEL[p.personality]}</b></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RankBadge sum={sum} prefecture={c?.prefecture} />
          <span className="dim" style={{ fontSize: 11, fontWeight: 800 }}>総合 {Math.round(sum / 7)}</span>
        </div>
        <AbilityChips player={p} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5 }}>
          <span className="dim" style={{ flexShrink: 0 }}>疲労</span>
          <span style={{ flex: 1, height: 5, background: 'rgba(74,64,54,0.12)', borderRadius: 3, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${p.fatigue}%`, background: fatigueColor(p.fatigue) }} />
          </span>
          {(p.skills?.length ?? 0) > 0 && <span className="tag skill" style={{ padding: '1px 7px' }}>⚡{p.skills!.length}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h1 className="h1">部員名簿 <span className="dim" style={{ fontSize: 14, fontWeight: 700 }}>{activeRoster.length}人</span></h1>
        <span className="section-label">⭐＝先発</span>
      </div>

      {/* #50: 並び替えと絞り込みを別の行に分割（区切り線廃止）＝375pxでチップが改行で崩れない */}
      <div className="chip-row">
        {([['overall', '総合順'], ['grade', '学年順'], ['position', 'ポジション順']] as const).map(([v, t]) => (
          <button key={v} className={`chip ${sort === v ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setSort(v)}>{t}</button>
        ))}
      </div>
      {hasSquads && (
        <div className="chip-row" style={{ marginTop: 6 }}>
          {(abcUnlocked(c)
            ? ([['all', '全'], ['A', 'A'], ['B', 'B'], ['C', 'C']] as const)
            : ([['all', '全'], ['A', '招集'], ['B', 'ベンチ外']] as const)
          ).map(([v, t]) => (
            <button key={v} className={`chip ${squad === v ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setSquad(v)}>{t}</button>
          ))}
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label}>
          <div className="section-label" style={{ margin: '8px 0 4px' }}>{g.label} <span className="dim" style={{ fontWeight: 700 }}>{g.players.length}人</span></div>
          <div className="roster-grid">{g.players.map(renderCard)}</div>
        </div>
      ))}

      {sel && <PlayerDetail player={sel} starter={lineupIds.has(sel.id)} onClose={() => setSel(null)} />}

    </div>
  )
}

function PlayerDetail({ player: snapshot, starter, onClose }: { player: Player; starter: boolean; onClose: () => void }) {
  const setPos = useCareer((s) => s.setPlayerPosition)
  const setJersey = useCareer((s) => s.setJersey)
  // ストア上の最新の選手を参照（ポジション変更を即座に反映するため）
  const player = useCareer((s) => s.career?.roster.find((p) => p.id === snapshot.id)) ?? snapshot
  const prefecture = useCareer((s) => s.career?.prefecture)
  // G-21: 背番号を入力式から選択式に変更（誰が何番か見ながら選べる）
  const roster = useCareer((s) => s.career?.roster ?? [])
  const [editNum, setEditNum] = useState(false)
  const numOwners = new Map<number, string>()
  roster.forEach((p) => { if (p.number) numOwners.set(p.number, p.name) })
  const sum = playerLevelSum(player)
  const want = player.isGK ? null : bestFieldPosition(player)
  const cur: PositionType = player.isGK ? 'GK' : player.position
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(60,48,36,0.5)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 18 }}>
      {/* F1.5: PCでは横幅を活かす（min(94vw, 560px)）。スマホは現状維持。 */}
      <div className="panel pop-in" style={{ width: '100%', maxWidth: 'min(94vw, 560px)', maxHeight: '92%', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <PlayerAvatar player={player} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* F10: 長い名前で名前行が崩れないよう flexWrap:wrap・名前は省略可能に */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-num)' }}>{player.number ?? '—'}</span>
              <strong style={{ fontSize: 19, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.name}</strong>
              {player.isCaptain && <span className="tag captain">主将</span>}
              {player.nationalRep && <span className="tag" style={{ background: 'var(--sky-pastel, #dbeafe)', color: '#1e5bb8' }} title="年代別代表に選出された逸材。プロへの道が近い。">🔵代表歴</span>}
              {starter && <span className="tag" style={{ background: 'var(--orange-pastel)', color: 'var(--orange-edge)' }}>先発</span>}
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
              {gradeLabel(player.grade)}・本職 {POSITION_LABEL[player.position]}{player.slot && player.slot !== player.position ? `（配置 ${POSITION_LABEL[player.slot]}）` : ''}
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <RankBadge sum={sum} full prefecture={prefecture} />
              <span className="dim" style={{ fontSize: 12 }}>背番号</span>
              {/* G-21: 入力式→選択式。タップでモーダル展開・グリッドから選択 */}
              <button onClick={() => setEditNum(true)}
                style={{ width: 60, padding: '3px 6px', borderRadius: 8, border: '1.5px solid var(--card-edge)', fontFamily: 'var(--font-num)', textAlign: 'center', background: '#fff', cursor: 'pointer', fontWeight: 800 }}>
                {player.number ?? '—'} ✎
              </button>
            </div>
            {editNum && (
              <div className="event-overlay" style={{ background: 'rgba(40,30,20,0.5)' }} onClick={() => setEditNum(false)}>
                <div className="panel pop-in" style={{ maxWidth: 360, width: '100%', padding: 16 }} onClick={(e) => e.stopPropagation()}>
                  <div className="section-label" style={{ marginBottom: 4 }}>背番号を選ぶ</div>
                  <div className="dim" style={{ fontSize: 11, marginBottom: 8 }}>使用中の番号には所有者名を表示。選ぶと相手と入れ替わります。</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5, maxHeight: 260, overflowY: 'auto' }}>
                    {Array.from({ length: 40 }, (_, n) => n + 1).map((n) => {
                      const ownerName = numOwners.get(n)
                      const isMine = player.number === n
                      return (
                        <button key={n} className={`chip ${isMine ? 'active' : ''}`}
                          style={{ padding: '4px 0', fontSize: 12, fontFamily: 'var(--font-num)', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, opacity: ownerName && !isMine ? 0.7 : 1 }}
                          title={ownerName ? `${ownerName}` : '空き'}
                          onClick={() => { setJersey(player.id, n); setEditNum(false) }}>
                          <span style={{ fontWeight: 800 }}>{n}</span>
                          {ownerName && !isMine && <span style={{ fontSize: 8, fontWeight: 700, maxWidth: 28, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerName.slice(0, 3)}</span>}
                        </button>
                      )
                    })}
                  </div>
                  <button className="btn ghost sm" style={{ width: '100%', marginTop: 12 }} onClick={() => setEditNum(false)}>とじる</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ポジション変更（タブを切り替えずにここで変えられる）。GKは固定 */}
        <div style={{ margin: '10px 0 6px' }}>
          <div className="section-label" style={{ marginBottom: 5 }}>ポジション{want && <span className="dim" style={{ fontWeight: 700, marginLeft: 6 }}>希望 <b style={{ color: 'var(--orange-deep)' }}>{POSITION_LABEL[want]}</b></span>}</div>
          {player.isGK ? (
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--green-deep)' }}>GK（現在は変更不可）</div>
          ) : (
            <div className="chip-row">
              {FIELD_POS.map((pos) => (
                <button key={pos} className={`chip ${cur === pos ? 'active' : ''}`} style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setPos(player.id, pos)}>
                  {POSITION_LABEL[pos]}{want === pos && <span style={{ color: cur === pos ? '#fff' : 'var(--orange-deep)' }}> ★</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dim" style={{ fontSize: 12.5, margin: '10px 0 6px', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          <span>身長 <b style={{ color: 'var(--ink)' }}>{heightCmOf(player)}cm</b></span>
          <span>性格 <b style={{ color: 'var(--ink)' }}>{PERSONALITY_LABEL[player.personality]}</b></span>
          <span>調子 <b style={{ color: 'var(--ink)' }}>{conditionLabel(player.condition)}</b></span>
          <span>疲労 <b style={{ color: fatigueColor(player.fatigue) }}>{Math.round(player.fatigue)}</b></span>
          <span>勉強 <b style={{ color: 'var(--ink)' }}>{STUDY_APT_LABEL[studyAptitude(player.personality)]}</b></span>
          {(player.cramWeeks ?? 0) > 0 && <span style={{ color: '#b23b22', fontWeight: 800 }}>📚 補習中（あと{player.cramWeeks}週・練習不可）</span>}
        </div>
        {/* #33: 性格が何に効くかを明示（成長/雰囲気/試合への影響）＝起用・編成の判断材料 */}
        <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--ink-soft)', background: '#fbf7ef', borderRadius: 9, padding: '7px 10px', margin: '0 0 8px', borderLeft: '4px solid var(--accent)' }}>
          <b style={{ color: 'var(--accent)' }}>{PERSONALITY_LABEL[player.personality]}</b>：{personalityEffectText(player.personality)}
        </div>

        {(() => {
          // URになった素材スキルは詳細では非表示にし、URを1つの能力として表示する。
          const combos = activeCombos(player)
          const hidden = new Set(combos.flatMap((c) => c.skillComponents))
          const shown = (player.skills ?? []).filter((s) => !hidden.has(s))
          if (combos.length === 0 && shown.length === 0) return null
          return (
            <div style={{ marginBottom: 8 }}>
              <div className="section-label" style={{ marginBottom: 6 }}>⚡ 特殊能力</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {/* UR（組み合わせ）＝虹色で最上位 */}
                {combos.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: COMBO_GRADIENT, boxShadow: '0 2px 8px rgba(192,38,211,0.25)' }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#c026d3', background: '#fff', borderRadius: 5, padding: '1px 5px', minWidth: 24, textAlign: 'center' }}>{RARITY_LABEL[4]}</span>
                    <b style={{ fontSize: 13, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{c.name}</b>
                    <span style={{ fontSize: 10.5, color: '#fff', opacity: 0.95, fontWeight: 600 }}>{c.components.join('＋')}の組み合わせ</span>
                  </div>
                ))}
                {shown.map((s) => {
                  const d = skillById(s)
                  const col = d ? RARITY_COLOR[d.rarity] : '#888'
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 9, background: '#fffdf8', borderLeft: `4px solid ${col}` }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', background: col, borderRadius: 5, padding: '1px 5px', minWidth: 24, textAlign: 'center' }}>{d ? RARITY_LABEL[d.rarity] : '?'}</span>
                      <b style={{ fontSize: 13, color: 'var(--ink)' }}>{skillName(s)}</b>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-dim)', fontWeight: 600 }}>{d?.desc}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* #56: GKは専用レイアウト＝GK固有能力を主役に先頭表示し、フィールド能力は補助扱い。 */}
        {player.isGK && player.gk ? (
          <>
            <div className="section-label" style={{ marginBottom: 6 }}>🧤 GK能力 <span className="dim" style={{ fontWeight: 700 }}>（GKの主軸）</span></div>
            <div className="stat-row"><span className="stat-name">セービング</span><span className="stat-track"><span className="stat-fill" style={{ width: `${player.gk.saving}%`, background: abilityFillGradient(player.gk.saving) }} /></span><span className="stat-val" style={{ color: abilityColor(player.gk.saving) }}>{Math.round(player.gk.saving)}</span></div>
            <div className="stat-row"><span className="stat-name">GK-IQ</span><span className="stat-track"><span className="stat-fill" style={{ width: `${player.gk.gkIq}%`, background: abilityFillGradient(player.gk.gkIq) }} /></span><span className="stat-val" style={{ color: abilityColor(player.gk.gkIq) }}>{Math.round(player.gk.gkIq)}</span></div>
            <div className="section-label" style={{ margin: '10px 0 6px' }}>フィールド能力 <span className="dim" style={{ fontWeight: 700 }}>（補助・足元/対応力）</span></div>
            <AbilityBars abilities={player.abilities} />
          </>
        ) : (
          <>
            <div className="section-label" style={{ marginBottom: 6 }}>能力</div>
            <AbilityBars abilities={player.abilities} />
          </>
        )}

        <div className="gap-sm" />
        <button className="btn ghost" onClick={onClose}>とじる</button>
      </div>
    </div>
  )
}
