// ============================================================
// career/personality.ts — 性格の成長/雰囲気係数（補完F）
// ============================================================

import type { Personality } from '../engine/types'

type AbilityKey = 'kick' | 'power' | 'speed' | 'technique' | 'stamina' | 'iq' | 'defense' | 'saving' | 'gkIq'

/** 性格×能力の成長係数（E-4の性格係数） */
export function personalityGrowthCoef(p: Personality, ability: AbilityKey): number {
  switch (p) {
    case 'leader': return 0.85 // 自身の成長は遅い（チームに尽くす）
    case 'genius': return (ability === 'technique' || ability === 'iq' || ability === 'gkIq') ? 1.4 : 1.0
    case 'fighter': return 0.9 // 練習効率は平凡（試合経験で伸びる）
    case 'hardworker': return 1.15
    case 'troublemaker':
      if (ability === 'power' || ability === 'speed') return 1.25
      if (ability === 'technique' || ability === 'iq' || ability === 'gkIq') return 0.9
      return 1.0
    case 'egoist': return (ability === 'kick' || ability === 'technique') ? 1.25 : 1.0
    case 'lazy': return 0.75
    default: return 1.0 // moodmaker/shy/hotblood/mypace/timid
  }
}

/** 乱数幅（内気・ビビりは安定／熱血漢は倍） */
export function personalityRandWidth(p: Personality): { lo: number; hi: number } {
  if (p === 'shy' || p === 'timid') return { lo: 0.85, hi: 1.15 } // 安定して伸びる（ビビりは大舞台で弱い代わりに堅実）
  if (p === 'hotblood') return { lo: 0.4, hi: 1.7 }
  return { lo: 0.7, hi: 1.3 }
}

/** 雰囲気の恒常補正（平衡点に織り込む・補完H/P-1-1） */
export function personalityAtmosphereConstant(p: Personality): number {
  switch (p) {
    case 'leader': return 5      // リーダー＝自分の成長は遅いがチームの空気を引き上げる（存在価値）
    case 'moodmaker': return 4
    case 'troublemaker': return -8
    case 'egoist': return -5
    case 'lazy': return -2
    // hardworker は個の成長(+1.15)＋疲労回復が持ち味＝チーム雰囲気はニュートラル（無欠点をなくす）
    default: return 0
  }
}

/** 努力家は怪我率半減・疲労回復+20% 等。疲労回復係数を返す */
export function personalityRecoveryMult(p: Personality): number {
  if (p === 'hardworker') return 1.2
  if (p === 'lazy') return 1.0 // 疲労蓄積×0.8 は別途
  return 1.0
}

/**
 * #33: 性格が「何に効くか」を選手向けに短く説明する（実際の係数と整合）。
 * 成長・雰囲気・試合への影響を一行で。チーム編成/起用判断の材料にする。
 */
export function personalityEffectText(p: Personality): string {
  switch (p) {
    case 'leader': return '自分の成長は控えめだが、チームの雰囲気を大きく引き上げる（統率）。'
    case 'moodmaker': return 'チームの空気を明るくする。問題児の悪影響をやわらげる潤滑油。'
    case 'troublemaker': return 'パワー・スピードがよく伸びるが、チームの和を乱しやすい。数が揃うと相手を威圧する。'
    case 'genius': return '技術・判断（IQ）の伸びが抜群で練習効率が高い。たまに気分の波（スランプ）が出る。'
    case 'shy': return '安定して着実に伸びる。派手さはないが崩れにくい。'
    case 'timid': return '堅実に伸びるが、大一番では本来の力を出しにくい。'
    case 'fighter': return '練習より試合で伸びるタイプ。競り合い・勝負どころで強さを見せる（闘志）。'
    case 'hotblood': return '伸びにムラがある（当たれば大きく、外すと停滞）。気持ちが乗ると爆発する。'
    case 'egoist': return 'キック・技術がよく伸びるが、自分本位で空気をやや乱す。'
    case 'hardworker': return '成長が速く疲労回復も早い。地道な積み上げでチームを支える（努力家の粘り）。'
    case 'mypace': return '自分のペースを保ち、周囲に流されない。怠け者の悪影響をやわらげる。'
    case 'lazy': return '成長は遅いが疲れにくい。緩い空気がチーム全体の消耗を抑えることも。'
  }
}

/**
 * #33 成長で「性格が効いた瞬間」の一言。練習成長サマリに添えて“見える化”する。
 * 主成長(bestKey)が性格の得意と噛み合ったときだけ返す（毎回出すと薄れるので限定）。null=特になし。
 */
export function personalityGrowthFlavor(p: Personality, bestKey: AbilityKey): string | null {
  switch (p) {
    case 'genius':
      return (bestKey === 'technique' || bestKey === 'iq' || bestKey === 'gkIq') ? '✨ 天才肌のひらめき' : null
    case 'hardworker': return '💪 努力家の粘り'
    case 'egoist':
      return (bestKey === 'kick' || bestKey === 'technique') ? '🎯 エゴイストの一芸' : null
    case 'troublemaker':
      return (bestKey === 'power' || bestKey === 'speed') ? '🔥 持て余すパワー' : null
    default: return null
  }
}

/** #33/#34: 雰囲気への寄与の符号（編成メーターの色分け用）。 */
export function personalityAtmoSign(p: Personality): 'good' | 'bad' | 'neutral' {
  const c = personalityAtmosphereConstant(p)
  return c > 0 ? 'good' : c < 0 ? 'bad' : 'neutral'
}

/**
 * #31: 勉強適性（性格から導出・5段階／新ステータス不要）。
 *   4=秀才(天才肌) / 3=優等生(努力家) / 2=標準 / 1=やや苦手 / 0=赤点常連(怠け者が最危険)
 */
export function studyAptitude(p: Personality): 0 | 1 | 2 | 3 | 4 {
  switch (p) {
    case 'genius': return 4
    case 'hardworker': return 3
    case 'leader': case 'mypace': case 'shy': case 'moodmaker': return 2
    case 'egoist': case 'hotblood': case 'timid': return 1
    case 'fighter': case 'troublemaker': case 'lazy': return 0
  }
}

/** #31: 定期考査の赤点率（練習続行時）。怠け者は最危険。勉強優先なら呼び出し側で半減。 */
export function redMarkRate(p: Personality): number {
  if (p === 'lazy') return 0.35
  return [0.30, 0.18, 0.08, 0.02, 0.0][studyAptitude(p)]
}

/** #31: 勉強適性のラベル（選手詳細/結果表示用）。 */
export const STUDY_APT_LABEL: Record<0 | 1 | 2 | 3 | 4, string> = {
  4: '秀才', 3: '優等生', 2: '標準', 1: 'やや苦手', 0: '赤点常連',
}
