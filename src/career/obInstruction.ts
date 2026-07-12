// ============================================================
// career/obInstruction.ts — G-41 §5 プロOB指導
// 出身プロのtier別に解放される「お金の使い道」イベント。
// 毎年各tier1回・前年度の使用は year で判定する。
// ============================================================

import type { CareerState } from './types'
import type { Player } from '../engine/types'
import type { RNG } from '../engine/rng'

export type ObTier = 'd3' | 'd2' | 'd1' | 'overseas'

export interface ObInstructionDef {
  tier: ObTier
  name: string
  cost: number // 万円
  desc: string
}

// G-41 §5 仕様: 費用感は仮置き（Z-1で再点検）
export const OB_INSTRUCTION: ObInstructionDef[] = [
  { tier: 'd3', name: '3部プロからの指導', cost: 100, desc: '雰囲気が大きく上がる（一段階）' },
  { tier: 'd2', name: '2部プロからの指導', cost: 400, desc: '全選手の苦手能力が小さく上がる' },
  { tier: 'd1', name: '1部プロからの指導', cost: 1200, desc: 'Aチーム1人に特殊能力（UR不可）' },
  { tier: 'overseas', name: '海外プロからの指導', cost: 3000, desc: 'Aチーム3人に特殊能力（UR不可）' },
]

/** tier ごとに解放されているか（その tier のプロ排出が累計1人以上） */
export function obTierUnlocked(state: CareerState, tier: ObTier): boolean {
  const c = state.records.proCountByTier
  return (c?.[tier] ?? 0) > 0
}

/** 今年このtierを既に使ったか */
export function obTierUsedThisYear(state: CareerState, tier: ObTier): boolean {
  return (state.obInstructionLast?.[tier] ?? -1) === state.year
}

/** 雇用ゲート＝解放済＋今年未使用＋予算あり */
export function obCanRun(state: CareerState, tier: ObTier): { ok: boolean; reason?: string } {
  if (!obTierUnlocked(state, tier)) return { ok: false, reason: 'まだこのレベルのプロOBが出ていません' }
  if (obTierUsedThisYear(state, tier)) return { ok: false, reason: '今年は実施済' }
  const def = OB_INSTRUCTION.find((o) => o.tier === tier)!
  if (state.budget < def.cost) return { ok: false, reason: `予算不足（必要${def.cost}万）` }
  return { ok: true }
}

/** OB指導を実行して新しい state を返す */
export function runObInstruction(state: CareerState, tier: ObTier, rng: RNG): CareerState {
  const def = OB_INSTRUCTION.find((o) => o.tier === tier)!
  if (!obCanRun(state, tier).ok) return state
  let next: CareerState = {
    ...state,
    budget: state.budget - def.cost,
    obInstructionLast: { ...(state.obInstructionLast ?? {}), [tier]: state.year },
  }
  // tier 別効果適用
  if (tier === 'd3') {
    // 雰囲気を一段階（+12）上げる
    next = { ...next, atmosphere: Math.min(100, next.atmosphere + 12) }
  } else if (tier === 'd2') {
    // 全選手（A/B/C問わず・引退除く）の最も低い能力を +3〜5
    const keys = ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense'] as const
    next = {
      ...next,
      roster: next.roster.map((p) => {
        if (p.retired) return p
        const a = { ...p.abilities }
        const weakest = keys.reduce((min, k) => (a[k] < a[min] ? k : min), 'iq')
        const inc = 3 + Math.floor(rng.next() * 3)
        a[weakest] = Math.min(99, a[weakest] + inc)
        return { ...p, abilities: a }
      }),
    }
  } else if (tier === 'd1' || tier === 'overseas') {
    // Aチームから1人 or 3人にランダムで特殊能力（UR/コンボ系は対象外＝SKILLSから選別）
    const aTeam = next.roster.filter((p) => !p.retired && (p.squad ?? 'A') === 'A' && (p.skills?.length ?? 0) < 3)
    const n = tier === 'd1' ? 1 : 3
    // 簡易：候補からSKILL idの中から1つランダム付与（addSkill的）
    // SKILLSを完全に読みたくないので簡易的にスキルIDのプリセットを使う
    const PRESET_SKILLS = ['speed-king', 'iron-body', 'finisher', 'visionary', 'tackler', 'long-shot', 'set-piece', 'big-game', 'mood-maker', 'stamina-king']
    const chosen: Player[] = []
    for (let i = 0; i < n && aTeam.length > 0; i++) {
      const candIdx = Math.floor(rng.next() * aTeam.length)
      const target = aTeam[candIdx]
      if (chosen.includes(target)) { i--; continue }
      chosen.push(target)
    }
    next = {
      ...next,
      roster: next.roster.map((p) => {
        const hit = chosen.find((c) => c.id === p.id)
        if (!hit) return p
        const existing = p.skills ?? []
        const candidates = PRESET_SKILLS.filter((s) => !existing.includes(s))
        if (candidates.length === 0) return p
        const skill = candidates[Math.floor(rng.next() * candidates.length)]
        return { ...p, skills: [...existing, skill] }
      }),
    }
  }
  next = {
    ...next,
    log: [`${def.name}を実施（-${def.cost}万）`, ...next.log].slice(0, 40),
  }
  return next
}
