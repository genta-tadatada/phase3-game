// ============================================================
// career/atmosphere.ts — チーム雰囲気（補完H・自然回帰式）
// 雰囲気 += (50 - 雰囲気 + 恒常補正合計) × 0.1   平衡点 = 50 + 恒常補正合計
// ============================================================

import type { Player } from '../engine/types'
import { personalityAtmosphereConstant } from './personality'

export interface AtmosphereBand {
  label: string
  trainingMult: number // 練習効率
  matchPct: number     // 試合実効%
  color: string
}

// #19: 7段階。下＝濃い赤（崩壊）→中立→上＝濃い緑（一体感）のグラデで良し悪しを一目で。
// レンジを上下に拡大（旧0.85〜1.10/±8 → 0.80〜1.14/±12）＝良い空気・悪い空気の差をはっきり。
export function atmosphereBand(a: number): AtmosphereBand {
  if (a < 10) return { label: '崩壊', trainingMult: 0.80, matchPct: -12, color: '#b00020' } // 濃い赤
  if (a < 25) return { label: '険悪', trainingMult: 0.88, matchPct: -7, color: '#e63946' }
  if (a < 40) return { label: '低調', trainingMult: 0.95, matchPct: -3, color: '#f08a4b' }
  if (a < 60) return { label: '普通', trainingMult: 1.0, matchPct: 0, color: '#9aa6c2' }  // 中立
  if (a < 75) return { label: '好調', trainingMult: 1.05, matchPct: 4, color: '#74c69d' }
  if (a < 90) return { label: '良好', trainingMult: 1.10, matchPct: 8, color: '#40916c' }
  return { label: '一体感', trainingMult: 1.14, matchPct: 12, color: '#1b5e3f' }            // 濃い緑
}

/** ロスターから恒常補正合計を算出（問題児はチーム計をクランプ）。
 *  #34: まとめ役の遮断＝ムードメーカーは問題児の、マイペースは怠け者の悪影響をやわらげる。 */
export function atmosphereConstant(roster: Player[]): number {
  let troublemaker = 0
  let lazy = 0
  let other = 0
  let moodmakers = 0
  let mypaces = 0
  for (const p of roster) {
    if (p.personality === 'moodmaker') moodmakers++
    if (p.personality === 'mypace') mypaces++
    const c = personalityAtmosphereConstant(p.personality)
    if (p.personality === 'troublemaker') troublemaker += c
    else if (p.personality === 'lazy') lazy += c
    else other += c
  }
  // #34: まとめ役1人につき該当ペナルティを20%軽減（最大60%軽減＝下限0.4倍）。
  troublemaker *= Math.max(0.4, 1 - moodmakers * 0.2)
  lazy *= Math.max(0.4, 1 - mypaces * 0.2)
  troublemaker = Math.max(-28, troublemaker) // 問題児の合計をクランプ（#19でレンジ拡大）
  // #19: 平衡点のレンジを拡大（旧±[-25,20]→[-35,30]）＝良い空気/悪い空気が新7段の端まで届く
  return Math.max(-35, Math.min(30, troublemaker + lazy + other))
}

/** #34: チームの性格相互作用フラグ（編成メーター＆システムで参照）。 */
export interface TeamChemistry {
  troublemakers: number
  lazies: number
  moodmakers: number
  mypaces: number
  leaders: number
  intimidation: boolean   // 問題児3人以上＝相手を威圧
  looseAir: boolean       // 怠け者4人以上＝緩い空気（疲労蓄積↓・天才肌スランプ率↓）
}
export function teamChemistry(roster: Player[]): TeamChemistry {
  const count = (pers: Player['personality']) => roster.filter((p) => p.personality === pers).length
  const troublemakers = count('troublemaker')
  const lazies = count('lazy')
  return {
    troublemakers, lazies,
    moodmakers: count('moodmaker'),
    mypaces: count('mypace'),
    leaders: count('leader'),
    intimidation: troublemakers >= 3,
    looseAir: lazies >= 4,
  }
}

/** 週次の自然回帰を1ステップ進める。targetBonus=#42マネージャー等の恒常的な平衡点底上げ。 */
export function regressAtmosphere(current: number, roster: Player[], extraDelta = 0, targetBonus = 0): number {
  const target = 50 + atmosphereConstant(roster) + targetBonus
  const next = current + (target - current) * 0.1 + extraDelta
  return Math.max(0, Math.min(100, next))
}
