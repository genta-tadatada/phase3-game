// ============================================================
// career/recruit.ts — 新入生・スカウト候補の生成
// 潜在(才能)の概念は廃止。選手の差は「初期能力・性格・身長」で表現する。
// 新入生は低く始め、育成（練習・試合・覚醒）で伸ばす。初期能力は相当重要＝
// アンダー世代代表など初期能力の高い選手（スカウトの strengthBoost）が大きな差。
// ============================================================

import type { Player, PositionType } from '../engine/types'
import type { RNG } from '../engine/rng'
import { generatePlayer } from '../engine/generate/player'

export interface RecruitOpts {
  position: PositionType
  reputation: number
  grade?: 1 | 2 | 3
  special?: boolean // 特待生（初期能力の底上げ）
  strengthBoost?: number // 初期能力の底上げ（スカウトの逸材・創部の即戦力スター等）
  /** 単一能力の上限（既定は strength から算出） */
  clampMax?: number
  /** ポジション補正の強さ（創部メンバーは指定ポジが本職になるよう高めに） */
  biasMult?: number
  joinedYear: number
}

export function generateRecruit(rng: RNG, opts: RecruitOpts): Player {
  const { reputation, special } = opts
  // 初期能力の中心値μ。一般入部は評判で緩やかに上がるが基本は低い（育成で伸ばす）。
  //   一般: rep0 μ≈22 ／ rep100 μ≈38。 特待+10。 strengthBoost（スカウトの腕）で更に上乗せ。
  const strength = Math.max(16, Math.min(82, 22 + reputation * 0.16 + (special ? 10 : 0) + (opts.strengthBoost ?? 0)))
  // 初期能力の単一上限は strength から算出（強い素材ほど初期から尖りを許す）
  const clampMax = opts.clampMax ?? Math.round(Math.min(86, strength + 13))
  const p = generatePlayer(rng, { position: opts.position, strength, grade: opts.grade ?? 1, clampMax, biasMult: opts.biasMult })

  p.joinedYear = opts.joinedYear
  p.skills = []
  p.seasonGoals = 0
  p.seasonApps = 0
  return p
}

// 創部メンバー（計17人＝1年8/2年6/3年3）
// 「（既存校に）サッカー部を創部 → 各学年から部員が集まった」設定。
// 3年生3人は即戦力スター（早期の勝利体験の担い手・1年で卒業）、2年に1人good。
// 1年生8人が育成のベース＝毎年8人intakeと噛み合い 8/8/8 へ滑らかに定常化（崖なし）。
export interface FoundingSlot { position: PositionType; grade: 1 | 2 | 3; tier: 'weak' | 'normal' | 'good' | 'star' }

// 【ポジション構成は固定】序盤は WB/DM/AM を出さず 4-4-2(GK/CB/SB/CM/WF/CF) で完結＝初心者が混乱しない（#29）。
// 1年8(GK/CB/SB/SB/CM/WF/WF/CF)・2年6(GK/CB/SB/CM/WF/CF)・3年3(CB/CM/CF)＝計17。この配分は変更しない。
export const FOUNDING_POSITIONS: { position: PositionType; grade: 1 | 2 | 3 }[] = [
  // 3年生3人 — 守備/中盤/攻撃の軸。冬季大会敗退で引退。
  { position: 'CB', grade: 3 },
  { position: 'CM', grade: 3 },
  { position: 'CF', grade: 3 },
  // 2年生6人
  { position: 'GK', grade: 2 },
  { position: 'CB', grade: 2 },
  { position: 'SB', grade: 2 },
  { position: 'CM', grade: 2 },
  { position: 'WF', grade: 2 },
  { position: 'CF', grade: 2 },
  // 1年生8人
  { position: 'GK', grade: 1 },
  { position: 'CB', grade: 1 },
  { position: 'SB', grade: 1 },
  { position: 'SB', grade: 1 },
  { position: 'CM', grade: 1 },
  { position: 'WF', grade: 1 },
  { position: 'WF', grade: 1 },
  { position: 'CF', grade: 1 },
]

// 【強さ（tier）の内訳は枚数だけ固定・どのポジションに当たるかは毎回ランダム】
// 2026-08-17: 旧実装は「2年のgoodは必ずCM」「1年のnormalは必ずCF」と固定で、
//   どの創部でも当たり選手のポジションが同じだった。学年ごとに tier をシャッフルして配る。
//   3年は全員 star なのでシャッフルしても内訳は変わらないが、
//   誰が一番強いかは generatePlayer 側のばらつきで元々毎回変わる。
export const FOUNDING_TIER_POOL: Record<1 | 2 | 3, FoundingSlot['tier'][]> = {
  3: ['star', 'star', 'star'],
  // 2年6人（normal=市区町村レベルの弱め・うち1人good＝翌年の中心へ継承）
  2: ['good', 'normal', 'normal', 'normal', 'normal', 'normal'],
  // 1年8人（育成ベース・weak=中学生レベル）。1人だけ normal＝「学年に1人だけ光る子」。
  1: ['normal', 'weak', 'weak', 'weak', 'weak', 'weak', 'weak', 'weak'],
}

/** 創部メンバーを組む。ポジション構成は固定・tier（強さ）だけ学年内でシャッフルして割り当てる。
 *  rng は createCareer のシード付きRNG＝同じシードなら同じ編成（デバッグ再現性を維持）。 */
export function buildFoundingSquad(rng: RNG): FoundingSlot[] {
  // 学年ごとに tier プールをシャッフル（Fisher-Yates）
  const pools: Record<number, FoundingSlot['tier'][]> = {}
  for (const g of [1, 2, 3] as const) {
    const a = [...FOUNDING_TIER_POOL[g]]
    for (let i = a.length - 1; i > 0; i--) {
      const j = rng.int(0, i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    pools[g] = a
  }
  return FOUNDING_POSITIONS.map((s) => ({ ...s, tier: pools[s.grade].pop()! }))
}

// 創部メンバーの初期能力 中心値μの底上げ量（rep0基準・μ=22+boost）。
// 3年生スターは地域クラブ仕込みの即戦力（高くて60）。控え/下級生が薄く勝ち進めない設計。
// 低評判の新設校は現実でも強い選手が少ない＝強いのは3年生スター3人＋2年good1人だけ（#37）。
//
// D群(2026-08-17): 旧実装は1年生と2年生がどちらも tier='normal' で完全に同一分布だった
//   （＝1学年ぶんの差がゼロ＝「初年度の2年生が弱すぎる」）。学年差が出るよう weak/normal を分けた。
//   狙いは「1年生（中学生レベル） < 初年度2年生（市区町村レベルの弱め） < 普通に育てた2年生」。
//   1年生のうち1人だけ normal を混ぜて「学年に1人は光る子がいる」形にしている（ポジションはランダム）。
//   実測（総合値の中央値・n=240〜320）: 創部1年生158 → 創部2年生182 → 1年育てた2年生188。
//   normal を上げすぎると「初年度2年生 > 育てた2年生」になり育成の意味が消えるので、
//   1年ぶんの成長量（実測 約+28）より小さい差に収めている。
export const FOUNDING_BOOST: Record<FoundingSlot['tier'], number> = { weak: -6, normal: -2, good: 18, star: 24 }

// 創部メンバーの単一能力 上限（育成実感のため低めから）。
//   star=60（3年即戦力の上限）/ good=52 / normal=46 / weak=44（新入生水準）
export const FOUNDING_CLAMP: Record<FoundingSlot['tier'], number> = { weak: 44, normal: 46, good: 52, star: 60 }

// 毎年の新入生ポジション傾向（ランダム化のベース）
export const INTAKE_POSITIONS: PositionType[] = [
  'GK', 'CB', 'SB', 'WB', 'DM', 'CM', 'AM', 'WF', 'CF',
]
