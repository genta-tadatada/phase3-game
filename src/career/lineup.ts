// ============================================================
// career/lineup.ts — フォーメーションに対する最良スターティング11の選出
// ロスターから各ポジションに最適な選手を貪欲法で割り当てる。
// ============================================================

import type { Formation, Player, PositionType, Team, Tactics } from '../engine/types'
import { FORMATIONS } from '../engine/match/formations'
import { rawPositionScore } from '../engine/match/teamQuality'
import { applyMatchSkillBonuses } from './skillEffects'
import type { CareerState } from './types'

// ポジション隣接定義(#28)。近いポジションは小ペナルティ・遠いポジションは大ペナルティで、
// 「本職＞近いポジ＞畑違い」の順に自動配置される（能力主導は維持しつつ自然な並びを優先）。
const POS_ADJACENT: Record<PositionType, PositionType[]> = {
  GK: [],
  CB: ['SB', 'DM'],
  SB: ['WB', 'CB'],
  WB: ['SB', 'WF'],
  DM: ['CM', 'CB'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'WF'],
  WF: ['WB', 'AM', 'CF'],
  CF: ['WF'],
}

/** 本職=1.0 / 隣接=0.93 / 畑違い=0.80。能力差を覆さない程度の穏やかな係数。 */
function positionFamiliarity(playerPos: PositionType, slot: PositionType): number {
  if (playerPos === slot) return 1.0
  if (POS_ADJACENT[slot]?.includes(playerPos)) return 0.93
  return 0.8
}

/** 自動配置用スコア：能力適性 × ポジション習熟（#28・#35） */
function lineupFitScore(p: Player, slot: PositionType): number {
  return rawPositionScore(p, slot) * (p.isGK ? 1 : positionFamiliarity(p.position, slot))
}

/** フォーメーションに沿って最良11人を選び、position を割り当てて返す */
export function selectLineup(roster: Player[], formation: Formation): Player[] {
  const slots = FORMATIONS[formation]
  // 全(選手×枠)ペアをスコア化し、高い順に割り当てる「全体貪欲法」＝枠順貪欲より最適に近い配置(#35)。
  const pairs: { si: number; pid: string; score: number }[] = []
  slots.forEach((pos, si) => {
    for (const p of roster) {
      // GK枠はGKのみ／フィールド枠はFPのみ（GKを野に出さない・人数不足時はfillで補う）
      if (pos === 'GK' ? !p.isGK : p.isGK) continue
      pairs.push({ si, pid: p.id, score: lineupFitScore(p, pos) })
    }
  })
  pairs.sort((a, b) => b.score - a.score)

  const assign: (Player | undefined)[] = new Array(slots.length)
  const usedP = new Set<string>()
  for (const pr of pairs) {
    if (assign[pr.si] || usedP.has(pr.pid)) continue
    const p = roster.find((x) => x.id === pr.pid)!
    assign[pr.si] = p
    usedP.add(pr.pid)
  }
  // 空き枠（部員不足）を残りの選手で埋める
  const rest = roster.filter((p) => !usedP.has(p.id))
  for (let si = 0; si < slots.length; si++) {
    if (!assign[si]) { const p = rest.shift(); if (p) { assign[si] = p; usedP.add(p.id) } }
  }
  const lineup: Player[] = []
  slots.forEach((pos, si) => { if (assign[si]) lineup.push({ ...assign[si]!, slot: pos }) })
  return lineup
}

/** 控え（先発に選ばれなかった選手） */
export function selectBench(roster: Player[], lineup: Player[]): Player[] {
  const ids = new Set(lineup.map((p) => p.id))
  return roster.filter((p) => !ids.has(p.id))
}

/** CareerState から試合用 Team を構築（公式戦はAチームのみから先発11＋控え） */
export function careerToTeam(state: CareerState, tactics?: Tactics): Team {
  const t = tactics ?? state.tactics
  // Aチーム（招集メンバー）から選出。未割当(旧セーブ)は全員Aとして扱う。引退選手(#33)は除外。
  // G-24: 怪我中(injuryWeeks>0)は試合にも出場不可
  const active = state.roster.filter((p) => !p.retired && (p.injuryWeeks ?? 0) === 0)
  const aTeam = active.filter((p) => (p.squad ?? 'A') === 'A')
  const pool = aTeam.length >= 11 ? aTeam : active
  // 手動スタメンが有効（11人・全員poolに在籍）ならそれを使う。無ければ自動選出。
  const slots = FORMATIONS[t.formation]
  const manual = state.lineup
    && state.lineup.length === 11
    && state.lineup.every((id) => pool.some((p) => p.id === id))
    ? state.lineup.map((id, i) => ({ ...pool.find((p) => p.id === id)!, slot: slots[i] }))
    : null
  const lineup = manual ?? selectLineup(pool, t.formation)
  // #4: ベンチ（控え）の堅牢化。A(招集)枠が11ちょうどでも控えが空にならないよう、
  // 先発を除く現役全員から控えを作る（A枠を優先し、足りなければA枠外で補充）。
  // 最大9人＝先発11＋ベンチ9のマッチデー20人枠（squadCapacitiesと整合）。
  const lineupIds = new Set(lineup.map((p) => p.id))
  const benchPool = active
    .filter((p) => !lineupIds.has(p.id))
    .sort((a, b) => (((a.squad ?? 'A') === 'A' ? 0 : 1) - ((b.squad ?? 'A') === 'A' ? 0 : 1)))
  const bench = benchPool.slice(0, 9)
  // 戦術アナリストを雇うと試合での能力が僅かに底上げ（入りの良さ・粘り強さ＝+2.5%）
  const analyst = (state.staff ?? []).includes('analyst')
  const tune = (p: typeof lineup[number]) => {
    if (!analyst) return p
    const m = 1.025
    const abilities = { ...p.abilities }
    for (const k of Object.keys(abilities) as (keyof typeof abilities)[]) abilities[k] = Math.min(99, Math.round(abilities[k] * m))
    const gk = p.gk ? { ...p.gk, saving: Math.min(99, Math.round(p.gk.saving * m)), gkIq: Math.min(99, Math.round(p.gk.gkIq * m)) } : p.gk
    return { ...p, abilities, gk }
  }
  return {
    id: 'player',
    name: state.schoolName,
    shortName: state.shortName,
    prefecture: state.prefecture,
    color: state.color,
    players: [...lineup, ...bench].map(tune).map(applyMatchSkillBonuses),
    tactics: t,
    tacticsLead: state.tacticsLead,
    tacticsBehind: state.tacticsBehind,
    managerSkill: Math.min(95, 40 + state.reputation * 0.4),
    reputation: state.reputation,
    isPlayer: true,
    setPieceTakerId: state.setPieceTaker,
    pkTakerId: state.pkTaker,
  }
}
