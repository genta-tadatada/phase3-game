// 共通UI部品
import type { Abilities, Player, Team } from '../engine/types'
import { playerOverallSum } from '../engine/match/teamQuality'
import {
  ABILITY_LABEL, POSITION_COLOR, POSITION_LABEL, PERSONALITY_LABEL,
  conditionLabel, gradeLabel, overallLabel,
} from '../lib/labels'
import { PlayerAvatar } from '../ui/PlayerAvatar'
import { abilityFillGradient } from './career/RosterScreen'

const ABILITY_ORDER: (keyof Abilities)[] = ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense']

// 総合力ティア(1〜8) → ランクバッジ色（草色→金）
// tier1-8＝従来色 / tier9(逸材・歴史に残る世代)＝マゼンタ / tier10(日本の至宝・伝説の世代)＝虹グラデ
const TIER_COLOR = ['#9aa6b2', '#86b06a', '#5cb98b', '#3f9e74', '#4aa3c8', '#6c8cf0', '#9b6cf0', '#f0a93c', '#d6248f']
export function rankColor(tier: number) {
  if (tier >= 10) return 'linear-gradient(135deg, #f59e0b 0%, #ec4899 45%, #8b5cf6 100%)'
  return TIER_COLOR[Math.max(0, Math.min(8, tier - 1))]
}

/** 総合力を一目で示すランクバッジ。kind='school'で格名（強豪/名門/伝説の世代）／prefectureで「○○県の逸材」。 */
export function RankBadge({ sum, full, kind = 'player', prefecture }: { sum: number; full?: boolean; kind?: 'player' | 'school'; prefecture?: string }) {
  const ov = overallLabel(sum, kind, prefecture)
  return <span className="rank-badge" style={{ background: rankColor(ov.tier) }}>{full ? ov.label : ov.short}</span>
}

export function AbilityBars({ abilities }: { abilities: Abilities }) {
  return (
    <div>
      {ABILITY_ORDER.map((k) => {
        const v = abilities[k]
        return (
          <div className="stat-row" key={k}>
            <span className="stat-name">{ABILITY_LABEL[k]}</span>
            <span className="stat-track" style={{ position: 'relative' }}>
              <span className="stat-fill" style={{ width: `${v}%`, background: abilityFillGradient(v) }} />
            </span>
            <span className="stat-val">{Math.round(v)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function PosBadge({ pos }: { pos: Player['position'] }) {
  return (
    <span className="pos-badge" style={{ background: POSITION_COLOR[pos] }}>
      {POSITION_LABEL[pos]}
    </span>
  )
}

export function PlayerRow({ player, onClick }: { player: Player; onClick?: () => void }) {
  const sum = playerOverallSum(player)
  return (
    <div className="player-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <PlayerAvatar player={player} size={40} />
      <PosBadge pos={player.slot ?? player.position} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <strong style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {player.name}
          </strong>
          <RankBadge sum={sum} />
        </div>
        <div className="dim" style={{ fontSize: 11 }}>
          {gradeLabel(player.grade)}・{PERSONALITY_LABEL[player.personality]}　{conditionLabel(player.condition)}
        </div>
      </div>
    </div>
  )
}

/** チームの先発11人の平均能力合計と総合力ラベル */
export function teamOverall(team: Team) {
  const starters = team.players.slice(0, 11)
  const avg = starters.length ? starters.reduce((s, p) => s + playerOverallSum(p), 0) / starters.length : 0
  return overallLabel(avg, 'school')
}

export function TeamBadge({ team, big }: { team: Team; big?: boolean }) {
  const ov = teamOverall(team)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: big ? 16 : 12, height: big ? 16 : 12, borderRadius: 4,
        background: team.color, flexShrink: 0,
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: big ? 18 : 15 }}>{team.name}</div>
        <div className="dim" style={{ fontSize: 11 }}>{team.prefecture}・{ov.label}</div>
      </div>
    </div>
  )
}
