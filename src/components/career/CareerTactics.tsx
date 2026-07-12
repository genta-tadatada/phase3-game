import { useState } from 'react'
import { useCareer } from '../../store/careerStore'
import type { Tactics } from '../../engine/types'
import { FORMATION_DESC, MENTALITY_LABEL } from '../../lib/labels'
import { FORMATION_LIST } from '../../engine/match/formations'
import { featureUnlocked } from '../../career/unlocks'

function Group<T extends string>(p: { label: string; opts: { v: T; t: string }[]; value: T; on: (v: T) => void; hint?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="label">{p.label}</label>
      <div className="chip-row">
        {p.opts.map((o) => (
          <button key={o.v} className={`chip ${p.value === o.v ? 'active' : ''}`} onClick={() => p.on(o.v)}>{o.t}</button>
        ))}
      </div>
      {p.hint && <div className="dim" style={{ fontSize: 11, marginTop: 5 }}>{p.hint}</div>}
    </div>
  )
}

// 各戦術オプションの「どう戦い・どんな相手に有効か」の説明（選択中の値を表示）
const MENTALITY_HINT: Record<string, string> = {
  'ultra-attack': '超攻撃的：全員で押し込むが背後は手薄。格下を攻め崩す／点が欲しい時に。',
  attack: '攻撃的：主導権を握りやすい。互角〜やや格下に有効。',
  balance: 'バランス：攻守の偏りなし。相手を見て柔軟に戦える。',
  defense: '守備的：失点を抑え堅く戦う。格上相手・リード時に有効。',
  'ultra-defense': '超守備的：極端に守りカウンター頼み。強敵相手の番狂わせ狙い。',
}
const PRESS_HINT: Record<string, string> = {
  high: '激しいプレス：高い位置で奪い主導権を握るが、体力消耗が激しく終盤バテやすい。スタミナのあるチーム向き。',
  mid: '標準のプレス：バランス型。',
  low: '低いプレス：構えて守り体力温存。格上相手・連戦で有効。',
}
const LINE_HINT: Record<string, string> = {
  high: '高い守備ライン：コンパクトに押し上げ攻撃的。ただし裏のスペースを突かれやすい（速い相手に注意）。',
  mid: '標準の守備ライン：バランス型。',
  low: '低い守備ライン：引いて守り裏を消す。格上・足の速い相手に有効。',
}
const WIDTH_HINT: Record<string, string> = {
  wide: 'ワイド：サイドを広く使う。中央が固い相手・クロサーがいる時に有効。',
  mid: '標準の幅：バランス型。',
  central: '中央：中央密集で崩す。サイドが弱い相手・技術/IQが高い時に有効。',
}
const BUILDUP_HINT: Record<string, string> = {
  fast: '速いビルドアップ：素早く前進しカウンター主体。守備的な相手の隙を突く／速い選手向き。',
  mid: '標準のビルドアップ：バランス型。',
  slow: '遅いビルドアップ：じっくり保持して崩す。主導権を握り体力温存。技術が高い時に有効。',
}

function TacticEditor({ t, upd }: { t: Tactics; upd: (patch: Partial<Tactics>) => void }) {
  const c = useCareer((s) => s.career)
  // 年1は4-4-2固定（WB/DM/AMがややこしいので）。他フォーメーションは2年目に解放（#29）。
  const formOk = c ? featureUnlocked('formations', c.year, c.week) : true
  const formOpts = (formOk ? FORMATION_LIST : (['4-4-2'] as typeof FORMATION_LIST)).map((f) => ({ v: f, t: f }))
  return (
    <div className="panel">
      <Group label="フォーメーション" opts={formOpts} value={t.formation} on={(v) => upd({ formation: v })} hint={formOk ? FORMATION_DESC[t.formation] : '他のフォーメーションは2年目から解放（まずは4-4-2に慣れよう）'} />
      <div className="cols c2">
        <Group label="メンタリティ" opts={(['ultra-attack', 'attack', 'balance', 'defense', 'ultra-defense'] as const).map((m) => ({ v: m, t: MENTALITY_LABEL[m] }))} value={t.mentality} on={(v) => upd({ mentality: v })} hint={MENTALITY_HINT[t.mentality]} />
        <Group label="プレス強度" opts={[{ v: 'high', t: '激しい' }, { v: 'mid', t: '標準' }, { v: 'low', t: '低い' }] as const} value={t.press} on={(v) => upd({ press: v })} hint={PRESS_HINT[t.press]} />
        <Group label="守備ライン" opts={[{ v: 'high', t: '高い' }, { v: 'mid', t: '標準' }, { v: 'low', t: '低い' }] as const} value={t.defenseLine} on={(v) => upd({ defenseLine: v })} hint={LINE_HINT[t.defenseLine]} />
        <Group label="攻撃の幅" opts={[{ v: 'wide', t: 'ワイド' }, { v: 'mid', t: '標準' }, { v: 'central', t: '中央' }] as const} value={t.width} on={(v) => upd({ width: v })} hint={WIDTH_HINT[t.width]} />
        <Group label="ビルドアップ" opts={[{ v: 'fast', t: '速い' }, { v: 'mid', t: '標準' }, { v: 'slow', t: '遅い' }] as const} value={t.buildUp} on={(v) => upd({ buildUp: v })} hint={BUILDUP_HINT[t.buildUp]} />
        <Group label="セットプレー重視" opts={[{ v: 'on', t: 'する' }, { v: 'off', t: 'しない' }] as const} value={t.setPiece ? 'on' : 'off'} on={(v) => upd({ setPiece: v === 'on' })} hint={t.setPiece ? 'FK/CKを狙う。セットプレーキッカーや高さ(身長)のある選手がいる時に有効。' : 'セットプレーは流す。'} />
      </div>
    </div>
  )
}

export function CareerTactics() {
  const c = useCareer((s) => s.career)
  const setPreset = useCareer((s) => s.setTacticsPreset)
  const go = useCareer((s) => s.go)
  const [base, setBase] = useState<Tactics>(c?.tactics ?? {
    formation: '4-4-2', mentality: 'balance', press: 'mid', defenseLine: 'mid', width: 'mid', buildUp: 'mid', setPiece: false,
  })
  const [lead, setLead] = useState<Tactics | undefined>(c?.tacticsLead)
  const [behind, setBehind] = useState<Tactics | undefined>(c?.tacticsBehind)
  const [tab, setTab] = useState<'base' | 'lead' | 'behind'>('base')
  if (!c) return null

  const current = tab === 'base' ? base : tab === 'lead' ? lead : behind
  const enabled = tab === 'base' || current !== undefined

  const upd = (patch: Partial<Tactics>) => {
    if (tab === 'base') setBase({ ...base, ...patch })
    else if (tab === 'lead') setLead({ ...(lead ?? base), ...patch })
    else setBehind({ ...(behind ?? base), ...patch })
  }
  const toggleEnabled = () => {
    if (tab === 'lead') setLead(lead ? undefined : { ...base })
    else if (tab === 'behind') setBehind(behind ? undefined : { ...base })
  }

  const persist = () => {
    setPreset('base', base)
    setPreset('lead', lead)
    setPreset('behind', behind)
  }
  const save = () => { persist(); go(useCareer.getState().comp != null ? 'comp-bracket' : 'weekly') }
  const toLineup = () => { persist(); go('lineup') }

  return (
    <div className="screen">
      <div className="app-title">戦術設定</div>
      <h1 className="h1">{c.schoolName}</h1>
      <p className="dim" style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.6 }}>
        得点状況で戦術が自動で切り替わる。リード時に守備的、ビハインド時に攻撃的にすると展開が安定する。相手との相性も勝敗を左右する。
      </p>

      <div className="chip-row" style={{ marginBottom: 12 }}>
        {([['base', '基本(互角時)'], ['lead', 'リード時'], ['behind', 'ビハインド時']] as const).map(([v, t]) => (
          <button key={v} className={`chip ${tab === v ? 'active' : ''}`} onClick={() => setTab(v)}>
            {t}{(v === 'lead' && lead) || (v === 'behind' && behind) ? ' ●' : ''}
          </button>
        ))}
      </div>

      {tab !== 'base' && (
        <div className="panel" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
          <span style={{ fontSize: 13 }}>{tab === 'lead' ? 'リード時' : 'ビハインド時'}に戦術を変える</span>
          <button className={`chip ${enabled ? 'active' : ''}`} onClick={toggleEnabled}>{enabled ? 'ON' : 'OFF(基本と同じ)'}</button>
        </div>
      )}

      {enabled && current
        ? <TacticEditor t={current} upd={upd} />
        : <div className="panel dim center" style={{ marginBottom: 12 }}>この状況では「基本」戦術で戦う。</div>}

      <div className="footer-cta">
        <div className="row">
          <button className="btn ghost" style={{ flex: '0 0 42%' }} onClick={toLineup}>⚽ スタメン編成へ</button>
          <button className="btn" onClick={save}>決定して戻る ▶</button>
        </div>
      </div>
    </div>
  )
}
