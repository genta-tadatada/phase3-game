import { useCareer } from '../../store/careerStore'
import { squadMembers, abcUnlocked, type Squad } from '../../career/squad'
import { atmosphereBand, teamChemistry } from '../../career/atmosphere'
import { personalityAtmoSign } from '../../career/personality'
import { playerOverallSum } from '../../engine/match/teamQuality'
import { overallLabel, PERSONALITY_LABEL, POSITION_COLOR } from '../../lib/labels'
import { skillName } from '../../data/skills'
import type { Player } from '../../engine/types'
import { PlayerAvatar } from '../../ui/PlayerAvatar'

const ATARI = ['leader', 'genius', 'fighter', 'hardworker']

function Row({ p, unlocked }: { p: Player; unlocked: boolean }) {
  const setSquad = useCareer((s) => s.setPlayerSquad)
  const aCount = useCareer((s) => s.career!.roster.filter((x) => (x.squad ?? 'A') === 'A').length)
  const sq = (p.squad ?? 'A') as Squad
  const aFull = aCount >= 20 && sq !== 'A' // 招集20人ガード
  const atari = ATARI.includes(p.personality)
  // 解禁前は 招集(A)/ベンチ外(B) の2択。解禁後は A/B/C。
  const opts: { v: Squad; t: string }[] = unlocked
    ? [{ v: 'A', t: 'A' }, { v: 'B', t: 'B' }, { v: 'C', t: 'C' }]
    : [{ v: 'A', t: '招集' }, { v: 'B', t: '外' }]
  return (
    <div className="player-card" style={{ padding: '8px 10px' }}>
      <PlayerAvatar player={p} size={34} />
      <span className="pos-badge" style={{ background: POSITION_COLOR[p.slot ?? p.position], width: 30, height: 30, fontSize: 11 }}>{p.slot ?? p.position}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.name}{p.isCaptain && ' (C)'} {p.awakened && '🌟'}
        </div>
        {/* G-17: ラベルだけでなく総合スコアの数値も併記（編成判断に必要） */}
        <div className="dim" style={{ fontSize: 10 }}>
          {overallLabel(playerOverallSum(p)).label}<span style={{ marginLeft: 3, opacity: 0.85, fontFamily: 'var(--font-num)' }}>{Math.round(playerOverallSum(p) / 7)}</span>・<span style={{ color: atari ? 'var(--accent)' : undefined }}>{PERSONALITY_LABEL[p.personality]}</span>
          {p.skills && p.skills.length > 0 && '・⚡' + p.skills.map(skillName).join(',')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {opts.map((o) => {
          const blocked = o.v === 'A' && aFull
          return (
            <button key={o.v} disabled={blocked} onClick={() => !blocked && setSquad(p.id, o.v)}
              title={blocked ? '招集は20人まで' : undefined}
              style={{ minWidth: 27, height: 27, padding: '0 7px', borderRadius: 7, border: 'none', fontWeight: 800, fontSize: 12, cursor: blocked ? 'not-allowed' : 'pointer',
                background: sq === o.v ? (o.v === 'A' ? 'var(--orange)' : 'var(--green)') : 'rgba(74,64,54,0.08)',
                color: sq === o.v ? '#fff' : 'var(--ink-dim)', opacity: blocked ? 0.4 : 1 }}>{o.t}</button>
          )
        })}
      </div>
    </div>
  )
}

function TeamBlock({ squad, label, atmo, unlocked, cap }: { squad: Squad; label: string; atmo: number; unlocked: boolean; cap?: number }) {
  const roster = useCareer((s) => s.career!.roster)
  const members = squadMembers(roster, squad).sort((a, b) => playerOverallSum(b) - playerOverallSum(a))
  if (squad !== 'A' && members.length === 0) return null
  const band = atmosphereBand(atmo)
  const over = cap !== undefined && members.length > cap
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 className="h2">{label}（<span style={{ color: over ? 'var(--bad)' : undefined }}>{members.length}{cap !== undefined ? `/${cap}` : ''}</span>人）</h2>
        <span style={{ fontSize: 12, color: band.color }}>雰囲気: {band.label}</span>
      </div>
      {over && <div style={{ fontSize: 11, color: 'var(--bad)', marginBottom: 4 }}>⚠ 招集は20人まで。あふれた選手は試合に出られません。</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {members.map((p) => <Row key={p.id} p={p} unlocked={unlocked} />)}
        {members.length === 0 && <div className="dim" style={{ fontSize: 12 }}>所属なし</div>}
      </div>
    </div>
  )
}

// #34: 招集メンバーの「チームの空気」メーター＋性格内訳＋助言。
function ChemistryPanel({ members }: { members: Player[] }) {
  if (members.length === 0) return null
  const chem = teamChemistry(members)
  const good = members.filter((p) => personalityAtmoSign(p.personality) === 'good').length
  const bad = members.filter((p) => personalityAtmoSign(p.personality) === 'bad').length
  const tips: { tone: 'warn' | 'good'; text: string }[] = []
  if (chem.intimidation) tips.push({ tone: 'good', text: `🔥 問題児${chem.troublemakers}人＝相手を威圧（試合開始時に相手の雰囲気↓）` })
  if (chem.troublemakers >= 2 && chem.moodmakers === 0) tips.push({ tone: 'warn', text: '⚠️ 問題児が多くまとめ役（ムードメーカー）不在＝空気が荒れやすい' })
  else if (chem.troublemakers >= 1 && chem.moodmakers >= 1) tips.push({ tone: 'good', text: '😊 ムードメーカーが問題児の悪影響をやわらげている' })
  if (chem.looseAir) tips.push({ tone: 'good', text: `😪 怠け者${chem.lazies}人＝緩い空気で疲労がたまりにくい（天才肌も気楽に）` })
  if (chem.lazies >= 2 && chem.mypaces >= 1) tips.push({ tone: 'good', text: '🧘 マイペースが怠け者の悪影響をやわらげている' })
  if (chem.leaders >= 1) tips.push({ tone: 'good', text: `✅ リーダー${chem.leaders}人がチームを統率（雰囲気の底上げ）` })
  else tips.push({ tone: 'warn', text: '⚠️ リーダー不在＝雰囲気の引き上げ役がいない' })

  return (
    <div className="panel" style={{ marginBottom: 10, padding: '10px 12px' }}>
      <div className="section-label" style={{ marginBottom: 6 }}>🌬 チームの空気（招集メンバー）</div>
      {/* good/bad の割合バー（緑＝和を作る性格／赤＝乱す性格） */}
      <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: '#e7e2d8', marginBottom: 6 }}>
        <span style={{ width: `${(good / members.length) * 100}%`, background: '#52b788' }} />
        <span style={{ width: `${(bad / members.length) * 100}%`, background: '#e63946' }} />
      </div>
      <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>
        和を作る {good}人 ／ 乱しがち {bad}人 ／ 中立 {members.length - good - bad}人　|
        👑{chem.leaders} 😊{chem.moodmakers} 😈{chem.troublemakers} 😪{chem.lazies} 🧘{chem.mypaces}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tips.map((t, i) => (
          <div key={i} style={{ fontSize: 11.5, lineHeight: 1.45, color: t.tone === 'warn' ? '#b23b22' : 'var(--green-deep)' }}>{t.text}</div>
        ))}
      </div>
    </div>
  )
}

export function SquadAssignScreen() {
  const c = useCareer((s) => s.career)
  const auto = useCareer((s) => s.autoAssignSquad)
  const go = useCareer((s) => s.go)
  if (!c) return null
  const atmoB = c.atmosphereB ?? c.atmosphere
  const unlocked = abcUnlocked(c)
  const aMembers = squadMembers(c.roster, 'A')

  return (
    <div className="screen">
      <div className="app-title">メンバー編成</div>
      {unlocked ? (
        <>
          <h1 className="h1">A / B / Cチーム</h1>
          <p className="dim" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
            Aチーム＝公式戦の招集メンバー。能力だけでなく性格・スキルでも選考を。
            B・Cチームは練習試合で経験を積み、稀に<b>覚醒</b>する。チームごとに雰囲気が分かれる。
          </p>
        </>
      ) : (
        <>
          <h1 className="h1">招集メンバー / 招集外</h1>
          <p className="dim" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
            公式戦に連れて行く<b>招集メンバー（最大20人＝先発11＋ベンチ9）</b>を選ぶ。外れた選手は<b>招集外</b>となり、見てくれる人間がいないぶん伸びも鈍い。
            部員が少ないうちは全員が招集される。<br />
            <span style={{ color: 'var(--green-deep)' }}>部員25人＋寮Lv2＋Bチームコーチ雇用</span>でBチームが、<span style={{ color: 'var(--green-deep)' }}>部員45人＋寮Lv4＋Cチームコーチ雇用</span>でCチームが解禁されます。
          </p>
        </>
      )}
      <button className="btn ghost" style={{ marginBottom: 10 }} onClick={auto}>能力順に自動編成 ↻</button>

      <ChemistryPanel members={aMembers} />

      {unlocked ? (
        <>
          <TeamBlock squad="A" label="Aチーム（招集）" atmo={c.atmosphere} unlocked />
          <TeamBlock squad="B" label="Bチーム（育成）" atmo={atmoB} unlocked />
          <TeamBlock squad="C" label="Cチーム（育成）" atmo={atmoB} unlocked />
        </>
      ) : (
        <>
          <TeamBlock squad="A" label="招集メンバー" atmo={c.atmosphere} unlocked={false} cap={20} />
          <TeamBlock squad="B" label="招集外" atmo={atmoB} unlocked={false} />
        </>
      )}

      <div className="footer-cta">
        <button className="btn secondary" onClick={() => go('weekly')}>◀ 週次画面に戻る</button>
      </div>
    </div>
  )
}
