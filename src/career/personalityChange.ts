// ============================================================
// career/personalityChange.ts — 性格変化（補完2.4・再設計版）
//
// 設計思想（2026-06-14 改訂）:
//   あたり性格を新入生10%まで絞った分、「育成で性格を引き上げる」道を
//   主要ルートに格上げする。昇格は受け身のRNGではなく、監督が握る複数の
//   レバー（雰囲気・出場機会＝注目度・リーダー在籍）で確率が動く。
//
//   昇格確率 = base × 学年係数 × 雰囲気係数 × 注目度係数 × リーダー係数(社会性のみ)
//
//   ・1選手の在籍中に年度末評価は2回（1年→2年昇格時 / 2年→3年昇格時）。
//     よく管理された主力は2回で平均0.5〜0.7段階伸びる＝普通→あたりは狙える、
//     ハズレ→あたり（2段階）は稀。あたりの希少性は維持される。
//   ・放置・低雰囲気では退化のリスク。
// ============================================================

import type { Personality, Player } from '../engine/types'
import type { RNG } from '../engine/rng'
import { PERSONALITY_LABEL } from '../lib/labels'

// 4軸（ハズレ→普通→あたり）
const AXES: Personality[][] = [
  ['troublemaker', 'moodmaker', 'leader'],   // 社会性
  ['timid', 'shy', 'genius'],                // メンタル
  ['egoist', 'hotblood', 'fighter'],         // 情熱
  ['lazy', 'mypace', 'hardworker'],          // 勤勉さ
]

function locate(p: Personality): { axis: number; pos: number } | null {
  for (let a = 0; a < AXES.length; a++) {
    const i = AXES[a].indexOf(p)
    if (i >= 0) return { axis: a, pos: i }
  }
  return null
}

export interface PersonalityChange {
  name: string
  from: string
  to: string
  improved: boolean
}

// 評価時点では学年は既に+1済み（1年生は存在しない）。
// 「1年を終えたばかり＝2年」が最も変わりやすい。
const gradeMult = (g: number) => g === 1 ? 1.5 : g === 2 ? 1.3 : 0.55

// 雰囲気係数（50で1.0・良い環境ほど昇格しやすい）
const atmoFactor = (atmo: number) => Math.max(0.45, Math.min(1.6, 1 + (atmo - 50) * 0.018))

// 注目度係数（Aチーム＝試合経験と注目で人として伸びる / Cは放置気味）
const attentionFactor = (squad: 'A' | 'B' | 'C') => squad === 'A' ? 1.4 : squad === 'B' ? 1.0 : 0.8

const BASE_UP = 0.13
const UP_CAP = 0.42
const DOWN_CAP = 0.16

/**
 * ロスター全員の性格変化を年度末に評価。新ロスターと変化リストを返す。
 * @param atmosphere  Aチームの雰囲気
 * @param atmosphereB B/Cチームの雰囲気（未指定ならatmosphereを流用）
 */
export function applyPersonalityChanges(
  roster: Player[], atmosphere: number, rng: RNG, atmosphereB?: number,
): { roster: Player[]; changes: PersonalityChange[] } {
  const changes: PersonalityChange[] = []
  const atmoB = atmosphereB ?? atmosphere
  // リーダー在籍＝社会性軸の昇格を後押し（先輩の好影響）
  const hasLeader = roster.some((p) => p.personality === 'leader')

  const next = roster.map((orig) => {
    const loc = locate(orig.personality)
    if (!loc) return orig
    const squad = (orig.squad ?? 'A') as 'A' | 'B' | 'C'
    const atmo = squad === 'A' ? atmosphere : atmoB

    // --- 昇格（良い環境・出場機会・リーダーの影響） ---
    if (loc.pos < 2) {
      const leaderFactor = loc.axis === 0 && hasLeader ? 1.4 : 1.0
      const prob = Math.max(0, Math.min(UP_CAP,
        BASE_UP * gradeMult(orig.grade) * atmoFactor(atmo) * attentionFactor(squad) * leaderFactor))
      if (rng.next() < prob) {
        const to = AXES[loc.axis][loc.pos + 1]
        changes.push({ name: orig.name, from: PERSONALITY_LABEL[orig.personality], to: PERSONALITY_LABEL[to], improved: true })
        return { ...orig, personality: to }
      }
    }

    // --- 退化（低雰囲気・放置） ---
    if (loc.pos > 0 && atmo < 43) {
      const prob = Math.max(0, Math.min(DOWN_CAP, (43 - atmo) * 0.0045 * (squad === 'C' ? 1.3 : 1.0)))
      if (rng.next() < prob) {
        const to = AXES[loc.axis][loc.pos - 1]
        changes.push({ name: orig.name, from: PERSONALITY_LABEL[orig.personality], to: PERSONALITY_LABEL[to], improved: false })
        return { ...orig, personality: to }
      }
    }
    return orig
  })

  return { roster: next, changes }
}
