import { useCareer } from '../../store/careerStore'
import { DISCOVERY_COST, OFFER_LABEL, successRateAtOffer, costAtOffer, candStrength } from '../../career/scout'
import { scoutSpBonus } from '../../career/facilities'
import { playerOverallSum } from '../../engine/match/teamQuality'
import { overallLabel, PERSONALITY_LABEL, ABILITY_LABEL, heightCmOf } from '../../lib/labels'
import type { ScoutCandidate } from '../../career/types'
import { PlayerAvatar } from '../../ui/PlayerAvatar'

const BADGE_LABEL: Record<string, string> = {
  'u15': '🔵U-15代表', 'national-tresen': '🔵ナショトレ', 'pref-tresen': '🔵県トレセン',
}

function materialStars(cs: number): string {
  const n = Math.max(1, Math.min(5, Math.round((cs - 30) / 9)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function CandCard({ cand }: { cand: ScoutCandidate }) {
  const invest = useCareer((s) => s.investCandidate)
  const toggle = useCareer((s) => s.toggleShortlist)
  const setOffer = useCareer((s) => s.setOffer)
  const state = useCareer((s) => s.career!)
  const sp = useCareer((s) => s.career!.scouting.sp)
  const shortlist = useCareer((s) => s.career!.scouting.shortlist)
  const p = cand.player
  const d = cand.discovery
  const onList = shortlist.includes(cand.id)
  const nextCost = d < 3 ? DISCOVERY_COST[d + 1] - DISCOVERY_COST[d] : 0
  const sum = playerOverallSum(p)

  return (
    <div className="panel" style={{ padding: '10px 12px', borderColor: onList ? 'var(--accent)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {d >= 1
            ? <PlayerAvatar player={p} size={40} />
            : <span className="avatar" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', fontSize: 20, color: 'var(--ink-dim)' }}>?</span>}
          <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {d >= 1 ? p.name : `${cand.district}の${cand.position}`}
            {cand.repBadge && <span style={{ fontSize: 10, marginLeft: 6 }}>{BADGE_LABEL[cand.repBadge]}</span>}
          </div>
          <div className="dim" style={{ fontSize: 11 }}>
            {cand.district}・{cand.position}・{heightCmOf(p)}cm
            {cand.recruited && <span style={{ color: 'var(--good)' }}>　入部決定</span>}
            {cand.rivalSnatched && <span style={{ color: 'var(--bad)' }}>　ライバル校へ</span>}
          </div>
          </div>
        </div>
        <div className="center" style={{ flexShrink: 0 }}>
          <div className="dim" style={{ fontSize: 10 }}>発見度</div>
          <div style={{ fontWeight: 800, color: 'var(--accent)' }}>{d}/3</div>
        </div>
      </div>

      {/* 開示情報（発見度で段階開示・#20）。スカウト前=ポジ/身長 / 1回目=性格＋おおよその総合 / 2回目=正確な総合 / 3回目=完全な能力 */}
      <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
        {d === 0 && <span className="dim">未調査：ポジションと身長のみ判明。調べると 性格→正確な総合→全能力 が分かる。{cand.repBadge && ' 代表歴あり＝有望のシグナル。'}</span>}
        {d === 1 && <span>性格 <b>{PERSONALITY_LABEL[p.personality]}</b>・総合 およそ<b>{Math.round(sum / 7 / 5) * 5}</b>前後</span>}
        {/* G-19: 2回調査は勧誘可だが成功率は控えめ。3回まで調べると成功率が大きく上がる */}
        {d === 2 && <span>性格 <b>{PERSONALITY_LABEL[p.personality]}</b>・総合 <b>{overallLabel(sum).label}</b>（{Math.round(sum / 7)}）<span className="dim" style={{ fontSize: 11 }}>　※もう1回調べると勧誘成功率が上がる</span></span>}
        {d >= 3 && (
          <div>
            <div>性格 <b>{PERSONALITY_LABEL[p.personality]}</b>・総合 <b>{overallLabel(sum).label}</b>（{Math.round(sum / 7)}）・素材 {materialStars(candStrength(p))}</div>
            <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
              {(['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense'] as const).map((k) => `${ABILITY_LABEL[k]}${Math.round(p.abilities[k])}`).join(' ')}
            </div>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        {d < 3 ? (
          <button className="btn ghost" style={{ padding: '9px' }} disabled={sp < nextCost} onClick={() => invest(cand.id)}>
            調べる（{nextCost}SP）
          </button>
        ) : <div className="dim center" style={{ fontSize: 11, flex: 1, alignSelf: 'center' }}>調査完了</div>}
        <button className={`btn ${onList ? '' : 'ghost'}`} style={{ padding: '9px' }} disabled={d < 2 || cand.recruited}
          onClick={() => toggle(cand.id)}>
          {onList ? '★勧誘リスト' : '勧誘リストへ'}
        </button>
      </div>

      {/* 特待オファー（勧誘リスト入り後）：お金で成功率UP。ただし効果は評判が高いほど大きい */}
      {onList && d >= 2 && !cand.recruited && (
        <div style={{ marginTop: 8 }}>
          <div className="dim" style={{ fontSize: 10.5, marginBottom: 3 }}>特待オファー（評判が高いほどお金が効く）</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {OFFER_LABEL.map((lab, lvl) => {
              const rate = Math.round(successRateAtOffer(state, cand, lvl) * 100)
              const cost = costAtOffer(cand, lvl)
              const active = (cand.offer ?? 0) === lvl
              return (
                <button key={lvl} className={`chip ${active ? 'active' : ''}`} style={{ flex: 1, padding: '5px 4px', fontSize: 11, lineHeight: 1.3, textAlign: 'center' }}
                  onClick={() => setOffer(cand.id, lvl)}>
                  {lab}<br /><span style={{ fontSize: 10 }}>{rate}%・{cost}万</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ScoutScreen() {
  const c = useCareer((s) => s.career)
  if (!c) return null
  const sc = c.scouting
  const levelLabel = ['未解禁', '県内', '近県', '地方', '全国'][sc.level]
  const spBonus = scoutSpBonus(c) // #41: スカウトスタッフ(広域+2/統括+3)による毎週の上乗せ
  const weekly = sc.spPerWeek + spBonus

  return (
    <div className="screen">
      <div className="app-title">スカウト</div>
      <h1 className="h1">スカウト（{levelLabel}）</h1>

      <div className="panel tint-sky" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{sc.sp}</div><div className="dim" style={{ fontSize: 11 }}>SP</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800 }}>+{weekly}</div><div className="dim" style={{ fontSize: 11 }}>毎週{spBonus > 0 ? `（基礎${sc.spPerWeek}+網${spBonus}）` : ''}</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800 }}>{sc.shortlist.length}</div><div className="dim" style={{ fontSize: 11 }}>勧誘リスト</div></div>
      </div>

      <p className="dim" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 10 }}>
        SPを使って候補を「調べる」と能力・性格・素材（初期能力）が分かる。良い選手を勧誘リストに入れ、2月の勧誘判定で入部を狙う。
        勧誘の成否は<b>評判が最重要</b>（設備・選手の格も影響）。<b>特待オファー</b>でお金を積むと成功率が上がり強豪との取り合いに勝てるが、その効果は評判が高いほど大きい＝<b>お金だけでは逸材は獲れない</b>。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {sc.candidates.length === 0
          ? <div className="panel dim center" style={{ gridColumn: '1 / -1' }}>今シーズンの候補はまだいない（年度開始時に出現）。</div>
          : sc.candidates.map((cand) => <CandCard key={cand.id} cand={cand} />)}
      </div>

    </div>
  )
}
