// ============================================================
// career/bcCamp.ts — G-41 §7 B/C合宿（裏でシミュレート → 結果のみ表示）
// A合宿(camp.ts)と同時期(week20)に発火。B/Cチーム所属者だけの軽量育成。
// 微調整な伸び方（A合宿の約1/3）。特殊能力はほぼ付かない。
// G-23: 覚醒イベントもこのB/C合宿で発生（B/Cメンバーが対象）。
// 2026-06-26 改修:
//   - 覚醒候補=「部活全体平均より低い」（旧: B/C内平均より低い）
//   - 覚醒判定=各候補について独立6%（旧: 全体で人数抽選）
//   - 覚醒効果=固定+5 → 部員全体の総合値ランキングで 10位/14位/17位(20%/40%/40%) にジャンプ
// ============================================================

import type { Player } from '../engine/types'
import type { RNG } from '../engine/rng'
import type { CareerState } from './types'
import { createRNG, hashSeed } from '../engine/rng'
import { playerOverallSum } from '../engine/match/teamQuality'

export interface BcCampSummary {
  gains: { name: string; ability: string; amount: number; squad: 'B' | 'C' }[]
  awakened: { name: string; squad: 'B' | 'C'; rank: number }[]
}

const AB_LABEL: Record<string, string> = {
  kick: 'キック', power: 'パワー', speed: 'スピード', technique: '技術',
  stamina: 'スタミナ', iq: 'IQ', defense: '守備',
}
const ABS = ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense'] as const

/** B/C合宿の裏シミュレーション。A合宿と同タイミングで呼ぶ。 */
export function simulateBcCamp(state: CareerState): { roster: Player[]; summary: BcCampSummary } {
  const rng: RNG = createRNG(hashSeed(`${state.rngSeed}-${state.year}-bccamp`))
  const summary: BcCampSummary = { gains: [], awakened: [] }
  const bcMembers = state.roster.filter((p) => !p.retired && ((p.squad ?? 'A') === 'B' || (p.squad ?? 'A') === 'C'))
  if (bcMembers.length === 0) return { roster: state.roster, summary }

  const bcIds = new Set(bcMembers.map((p) => p.id))
  // 覚醒候補=「部活全体平均より能力が低い」かつ性格が前向き＝下剋上の物語性。
  // 旧（B/C内平均）はA上位を含めた全体像を反映できなかった→B/Cほぼ全員が候補に入りやすくなる。
  const allActive = state.roster.filter((p) => !p.retired)
  const teamAvg = allActive.reduce((s, p) => s + Object.values(p.abilities).reduce((a, v) => a + v, 0), 0) / Math.max(1, allActive.length) / 7
  const awakenCandidates = bcMembers.filter((p) => {
    const ov = Object.values(p.abilities).reduce((a, v) => a + v, 0) / 7
    return ov < teamAvg && ['fighter', 'hardworker', 'genius', 'leader'].includes(p.personality) && !p.awakened
  })
  // 各候補について独立6%で覚醒判定（旧: 全体で人数抽選＝部員が増えても確率変わらない問題）。
  // 部員数が増えると覚醒人数の期待値も増える＝大規模部活の旨味。
  const awoken = new Set<string>()
  for (const cand of awakenCandidates) {
    if (rng.next() < 0.06) awoken.add(cand.id)
  }

  // 覚醒効果=「部員全体の総合値ランキングで N位にジャンプ」（20%:10位 / 40%:14位 / 40%:17位）。
  // 旧の +5 固定はAのスタメン能力に届かず無意味になりやすかった→ランキング指定で確実にA招集圏内に。
  // 順位ジャンプ用に「現在の各順位の総合値」を事前計算。
  const sortedOveralls = [...allActive]
    .map((p) => playerOverallSum(p))
    .sort((a, b) => b - a)
  const rankOverall = (rank: number): number => {
    // rank=1始まり。範囲外は最小値にフォールバック。
    const idx = Math.max(0, Math.min(sortedOveralls.length - 1, rank - 1))
    return sortedOveralls[idx] ?? 0
  }

  const next = state.roster.map((p) => {
    if (!bcIds.has(p.id)) return p
    let newAbs: typeof p.abilities = { ...p.abilities }
    let newGk = p.gk ? { ...p.gk } : p.gk
    const awoke = awoken.has(p.id)
    if (awoke) {
      // 覚醒：総合値を指定順位に持っていく（既に高ければ何も起こらない）。
      // 全能力を一律スケールUP＝特化能力の比率を維持しつつ底上げ。
      const r = rng.next()
      const targetRank = r < 0.20 ? 10 : r < 0.60 ? 14 : 17 // 20/40/40
      const targetSum = rankOverall(targetRank)
      const curSum = playerOverallSum(p)
      if (targetSum > curSum && curSum > 0) {
        const scale = targetSum / curSum
        // 各能力を比率で拡大（99上限）。0 の能力(FPのGK能力等)は触らない。
        const scaleAb = (v: number): number => (v <= 0 ? v : Math.min(99, Math.round(v * scale * 10) / 10))
        newAbs = {
          kick: scaleAb(p.abilities.kick),
          power: scaleAb(p.abilities.power),
          speed: scaleAb(p.abilities.speed),
          technique: scaleAb(p.abilities.technique),
          stamina: scaleAb(p.abilities.stamina),
          iq: scaleAb(p.abilities.iq),
          defense: scaleAb(p.abilities.defense),
        }
        if (p.gk && newGk) {
          newGk = { ...newGk, saving: scaleAb(p.gk.saving), gkIq: scaleAb(p.gk.gkIq) }
        }
        summary.awakened.push({ name: p.name, squad: (p.squad ?? 'B') as 'B' | 'C', rank: targetRank })
      }
    }
    // 通常合宿成長（覚醒の有無に関係なく実施）: ランダムな1能力 +1〜+3
    const key = ABS[Math.floor(rng.next() * ABS.length)]
    const baseInc = 1 + Math.floor(rng.next() * 3) // 1〜3
    newAbs = { ...newAbs, [key]: Math.min(99, newAbs[key] + baseInc) }
    summary.gains.push({ name: p.name, ability: AB_LABEL[key], amount: baseInc, squad: (p.squad ?? 'B') as 'B' | 'C' })
    return { ...p, abilities: newAbs, gk: newGk, awakened: p.awakened || awoke }
  })
  return { roster: next, summary }
}

/** B/C合宿結果から表示用 body 文字列を生成（pendingEvent body に使う） */
export function formatBcCampBody(summary: BcCampSummary): string {
  if (summary.gains.length === 0) return 'B/Cチームの選手はいなかった。来年に向けてA招集を整えよう。'
  const lines: string[] = []
  lines.push(`B/Cチームは裏で軽い合宿を行った。${summary.gains.length}人が小さく成長:`)
  for (const g of summary.gains.slice(0, 10)) {
    lines.push(`・${g.name}（${g.squad}）が${g.ability} +${g.amount}`)
  }
  if (summary.gains.length > 10) lines.push(`...他${summary.gains.length - 10}人`)
  if (summary.awakened.length > 0) {
    lines.push('')
    lines.push(`🌟 覚醒した選手:`)
    for (const a of summary.awakened) {
      lines.push(`・${a.name}（${a.squad}）が部内${a.rank}位の総合値に化けた`)
    }
  }
  return lines.join('\n')
}
