import { useState } from 'react'
import { useGame } from '../store/gameStore'
import type { Tactics } from '../engine/types'
import { FORMATION_DESC, MENTALITY_LABEL } from '../lib/labels'
import { FORMATION_LIST } from '../engine/match/formations'
import { matchupEdgePct } from '../engine/match/tactics'
import { playerOpponent } from '../lib/tournament'

function ChipGroup<T extends string>(props: {
  label: string
  options: { v: T; t: string }[]
  value: T
  onChange: (v: T) => void
  hint?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="label">{props.label}</label>
      <div className="chip-row">
        {props.options.map((o) => (
          <button
            key={o.v}
            className={`chip ${props.value === o.v ? 'active' : ''}`}
            onClick={() => props.onChange(o.v)}
          >
            {o.t}
          </button>
        ))}
      </div>
      {props.hint && <div className="dim" style={{ fontSize: 11, marginTop: 5 }}>{props.hint}</div>}
    </div>
  )
}

export function TacticsScreen() {
  const team = useGame((s) => s.playerTeam)
  const setTactics = useGame((s) => s.setTactics)
  const go = useGame((s) => s.go)
  const tour = useGame((s) => s.tournament)
  const [t, setT] = useState<Tactics>(team?.tactics ?? {
    formation: '4-4-2', mentality: 'balance', press: 'mid',
    defenseLine: 'mid', width: 'mid', buildUp: 'mid', setPiece: false,
  })
  if (!team) return null
  const upd = (patch: Partial<Tactics>) => setT({ ...t, ...patch })
  const firstTime = tour?.roundIndex === 0 &&
    tour.rounds[0].every((m) => m.winnerId === null)

  // 相手が確定していれば相性をライブ表示（カウンターを組む学習ループ）
  const opp = tour ? playerOpponent(tour) : null
  const edge = opp ? matchupEdgePct(t, opp.tactics) : 0
  const matchup = edge >= 6
    ? { label: '有利', color: 'var(--good)' }
    : edge <= -6
      ? { label: '不利', color: 'var(--bad)' }
      : { label: '互角', color: 'var(--text-dim)' }

  const confirm = () => {
    setTactics(t)
    go('bracket')
  }

  return (
    <div className="screen">
      <div className="app-title">戦術設定</div>
      <h1 className="h1">{team.name}</h1>
      <p className="dim" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
        試合の采配はこの設定で決まる。相手の戦術との相性も勝敗を左右する。
        各試合の前に変更できる。
      </p>

      {opp && (
        <div className="panel" style={{
          position: 'sticky', top: 8, zIndex: 10, marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px',
        }}>
          <div style={{ minWidth: 0 }}>
            <div className="dim" style={{ fontSize: 10 }}>次の相手</div>
            <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {opp.shortName}
            </div>
            <div className="dim" style={{ fontSize: 11 }}>
              {MENTALITY_LABEL[opp.tactics.mentality]}・{opp.tactics.formation}・
              {opp.tactics.press === 'high' ? 'ハイプレス' : opp.tactics.press === 'low' ? '低プレス' : '標準プレス'}・
              {opp.tactics.buildUp === 'fast' ? '速攻' : opp.tactics.buildUp === 'slow' ? '遅攻' : '標準'}
            </div>
          </div>
          <div className="center" style={{ flexShrink: 0, marginLeft: 10 }}>
            <div className="dim" style={{ fontSize: 10 }}>相性</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: matchup.color }}>{matchup.label}</div>
            <div style={{ fontSize: 11, color: matchup.color }}>{edge > 0 ? '+' : ''}{edge}</div>
          </div>
        </div>
      )}

      <ChipGroup
        label="フォーメーション"
        options={FORMATION_LIST.map((f) => ({ v: f, t: f }))}
        value={t.formation}
        onChange={(v) => upd({ formation: v })}
        hint={FORMATION_DESC[t.formation]}
      />
      <ChipGroup
        label="メンタリティ"
        options={(['ultra-attack', 'attack', 'balance', 'defense', 'ultra-defense'] as const).map((m) => ({ v: m, t: MENTALITY_LABEL[m] }))}
        value={t.mentality}
        onChange={(v) => upd({ mentality: v })}
        hint="攻撃的にすると得点力は上がるが守備が薄くなる。"
      />
      <ChipGroup
        label="プレス強度"
        options={[{ v: 'high', t: '激しい' }, { v: 'mid', t: '標準' }, { v: 'low', t: '低い' }] as const}
        value={t.press}
        onChange={(v) => upd({ press: v })}
        hint="激しいプレスは中盤を支配できるがスタミナを多く消耗する。"
      />
      <ChipGroup
        label="守備ライン"
        options={[{ v: 'high', t: '高い' }, { v: 'mid', t: '標準' }, { v: 'low', t: '低い' }] as const}
        value={t.defenseLine}
        onChange={(v) => upd({ defenseLine: v })}
      />
      <ChipGroup
        label="攻撃の幅"
        options={[{ v: 'wide', t: 'ワイド' }, { v: 'mid', t: '標準' }, { v: 'central', t: '中央' }] as const}
        value={t.width}
        onChange={(v) => upd({ width: v })}
      />
      <ChipGroup
        label="ビルドアップ速度"
        options={[{ v: 'fast', t: '速い(カウンター)' }, { v: 'mid', t: '標準' }, { v: 'slow', t: '遅い(ポゼッション)' }] as const}
        value={t.buildUp}
        onChange={(v) => upd({ buildUp: v })}
      />
      <ChipGroup
        label="セットプレー重視"
        options={[{ v: 'on', t: 'する' }, { v: 'off', t: 'しない' }] as const}
        value={t.setPiece ? 'on' : 'off'}
        onChange={(v) => upd({ setPiece: v === 'on' })}
      />

      <div className="footer-cta">
        <button className="btn" onClick={confirm}>
          {firstTime ? 'この戦術で大会へ ▶' : '決定してブラケットへ ▶'}
        </button>
      </div>
    </div>
  )
}
