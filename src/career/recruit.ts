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

// 創部メンバー（計16人＝1年8/2年5/3年3）
// 「（既存校に）サッカー部を創部 → 各学年から部員が集まった」設定。
// 3年生3人は即戦力スター（早期の勝利体験の担い手・1年で卒業）、2年に1人good。
// 1年生8人が育成のベース＝毎年8人intakeと噛み合い 8/8/8 へ滑らかに定常化（崖なし）。
export interface FoundingSlot { position: PositionType; grade: 1 | 2 | 3; tier: 'normal' | 'good' | 'star' }
// 序盤は WB/DM/AM を出さず 4-4-2(GK/CB/SB/CM/WF/CF) で完結＝初心者が混乱しない（#29）。
// ポジション人数固定：1年8(GK/CB/SB/SB/CM/WF/WF/CF)・2年6(GK/CB/SB/CM/WF/CF)・3年3(CB/CM/CF)＝計17。
export const FOUNDING_SQUAD: FoundingSlot[] = [
  // 3年生3人（即戦力スター）— 守備/中盤/攻撃の軸。冬季大会敗退で引退。
  { position: 'CB', grade: 3, tier: 'star' },
  { position: 'CM', grade: 3, tier: 'star' },
  { position: 'CF', grade: 3, tier: 'star' },
  // 2年生6人（うち1人good＝翌年の中心へ継承）
  { position: 'GK', grade: 2, tier: 'normal' },
  { position: 'CB', grade: 2, tier: 'normal' },
  { position: 'SB', grade: 2, tier: 'normal' },
  { position: 'CM', grade: 2, tier: 'good' },
  { position: 'WF', grade: 2, tier: 'normal' },
  { position: 'CF', grade: 2, tier: 'normal' },
  // 1年生8人（育成ベース）
  { position: 'GK', grade: 1, tier: 'normal' },
  { position: 'CB', grade: 1, tier: 'normal' },
  { position: 'SB', grade: 1, tier: 'normal' },
  { position: 'SB', grade: 1, tier: 'normal' },
  { position: 'CM', grade: 1, tier: 'normal' },
  { position: 'WF', grade: 1, tier: 'normal' },
  { position: 'WF', grade: 1, tier: 'normal' },
  { position: 'CF', grade: 1, tier: 'normal' },
]

// 創部メンバーの初期能力 中心値μの底上げ量（rep0基準・μ=25+boost）。
//   star→μ46(best≈58-60) / good→μ35(best≈48-50) / normal→μ25(best≈38-40)
// 3年生スターは地域クラブ仕込みの即戦力（高くて60）。控え/下級生が薄く勝ち進めない設計。
// 低評判の新設校は現実でも強い選手が少ない＝強いのは3年生スター3人＋2年good1人だけ。
// それ以外（normal）は「とても弱い」初期能力にする（#37）。育成で伸ばす土台。
export const FOUNDING_BOOST: Record<FoundingSlot['tier'], number> = { normal: -3, good: 18, star: 24 }

// 創部メンバーの単一能力 上限（育成実感のため低めから）。
//   star=60（3年即戦力の上限）/ good=52 / normal=44（新入生水準）
export const FOUNDING_CLAMP: Record<FoundingSlot['tier'], number> = { normal: 44, good: 52, star: 60 }

// 毎年の新入生ポジション傾向（ランダム化のベース）
export const INTAKE_POSITIONS: PositionType[] = [
  'GK', 'CB', 'SB', 'WB', 'DM', 'CM', 'AM', 'WF', 'CF',
]
