// ============================================================
// engine/generate/player.ts — 選手生成（決定的・シード使用）
// ポジション適性に応じて能力をバイアスし、身長分布・性格・潜在を付与。
// ============================================================

import type {
  Abilities, Condition, MaturityType, Personality, Player, PositionType,
} from '../types'
import type { RNG } from '../rng'
import { generateName } from '../../data/names'

const ALL_PERSONALITIES: Personality[] = [
  'leader', 'moodmaker', 'troublemaker',
  'genius', 'shy', 'timid',
  'fighter', 'hotblood', 'egoist',
  'hardworker', 'mypace', 'lazy',
]

// 出現重み（普通が多め・ハズレは多め・あたりは稀）
// ※あたり性格は「育成で引き上げる」もの＝新入生で簡単に出てはいけない。
//   設計目標 あたり計≒10% / 普通≒50% / ハズレ≒40%（合計20）。
//   ハズレが増えた分、性格育成（昇格）が主要な「あたりを得る道」になる。
const PERSONALITY_WEIGHT: Record<Personality, number> = {
  leader: 0.5, moodmaker: 2.6, troublemaker: 2.1,    // 社会性
  genius: 0.45, shy: 2.5, timid: 2.0,                // メンタル
  fighter: 0.55, hotblood: 2.3, egoist: 2.1,         // 情熱
  hardworker: 0.5, mypace: 2.6, lazy: 1.8,           // 勤勉さ
}

// ポジション別の能力バイアス（加算）
const POS_BIAS: Record<Exclude<PositionType, 'GK'>, Partial<Abilities>> = {
  CF: { kick: 10, power: 8, iq: 4, technique: 4, speed: 2, stamina: 2, defense: -12 },
  WF: { speed: 12, technique: 10, kick: 4, stamina: 4, power: -4, defense: -10 },
  WB: { stamina: 10, speed: 8, defense: 6, technique: 2, kick: 2 },
  DM: { defense: 10, iq: 8, stamina: 8, power: 4, technique: -2, kick: -2 },
  AM: { technique: 12, iq: 8, kick: 8, stamina: 2, power: -4, defense: -8 },
  CM: { iq: 8, stamina: 8, defense: 6, technique: 4, kick: 2 },
  CB: { defense: 14, power: 8, iq: 6, speed: -2, technique: -8, kick: -6 },
  SB: { speed: 10, defense: 8, stamina: 8, kick: 2, technique: -2 },
}

// 身長傾向（ポジション別の偏り）
const HEIGHT_TENDENCY: Record<PositionType, 'tall' | 'short' | 'mid'> = {
  GK: 'tall', CB: 'tall', CF: 'tall',
  WF: 'short', SB: 'short', AM: 'short',
  WB: 'mid', CM: 'mid', DM: 'mid',
}

function clampAbility(v: number, max = 95): number {
  return Math.max(10, Math.min(max, Math.round(v)))
}

function pickPersonality(rng: RNG): Personality {
  const total = ALL_PERSONALITIES.reduce((s, p) => s + PERSONALITY_WEIGHT[p], 0)
  let r = rng.next() * total
  for (const p of ALL_PERSONALITIES) {
    r -= PERSONALITY_WEIGHT[p]
    if (r <= 0) return p
  }
  return 'mypace'
}

// 身長段階の出現分布（GDD 2.3.1） — 累積で抽選
const HEIGHT_CUM: { tier: number; cum: number }[] = [
  { tier: 1, cum: 0.005 }, { tier: 2, cum: 0.045 }, { tier: 3, cum: 0.165 },
  { tier: 4, cum: 0.345 }, { tier: 5, cum: 0.585 }, { tier: 6, cum: 0.775 },
  { tier: 7, cum: 0.915 }, { tier: 8, cum: 0.985 }, { tier: 9, cum: 1.0 },
]

function sampleHeightTier(rng: RNG, tendency: 'tall' | 'short' | 'mid'): number {
  let r = rng.next()
  // 偏り: tall は上振れ、short は下振れ（rを歪める）
  if (tendency === 'tall') r = Math.min(1, r * 0.7 + 0.3)
  else if (tendency === 'short') r = r * 0.7
  for (const h of HEIGHT_CUM) {
    if (r <= h.cum) return h.tier
  }
  return 5
}

function sampleMaturity(rng: RNG): MaturityType {
  const r = rng.next()
  if (r < 0.2) return 'early'
  if (r < 0.8) return 'normal'
  return 'late'
}

// 一意なID用の単調カウンタ（生成順は決定的なので再現性も保たれる）
let playerIdCounter = 0

export interface GenPlayerOpts {
  position: PositionType
  strength: number // 能力の中心値μ（新入生≈26 / 創部3年≈48 / ライバル強豪≈70 目安）
  grade?: 1 | 2 | 3
  /** 単一能力の上限（育成カーブ用。新入生44 / 創部3年60 / ライバル95）。既定95 */
  clampMax?: number
  /** ポジション補正の強さ（既定0.6）。創部メンバーは高め(=指定ポジが最適になる)。 */
  biasMult?: number
}

/** 1選手を生成 */
export function generatePlayer(rng: RNG, opts: GenPlayerOpts): Player {
  const { position, strength } = opts
  const clampMax = opts.clampMax ?? 95
  const isGK = position === 'GK'
  const base = strength + rng.int(-4, 5)

  // ポジション補正（既定0.6倍に圧縮。創部メンバーは biasMult を上げて指定ポジが本職になるように）。
  const biasMult = opts.biasMult ?? 0.6
  const mk = (bias: number): number =>
    clampAbility(base + Math.round(bias * biasMult) + rng.int(-6, 7), clampMax)

  let abilities: Abilities
  if (isGK) {
    // GKのFP能力は控えめ（キック・技術はビルドアップで意味を持つ）
    abilities = {
      kick: mk(0), power: mk(2), speed: mk(-4), technique: mk(-2),
      stamina: mk(-6), iq: mk(2), defense: mk(-2),
    }
  } else {
    const bias = POS_BIAS[position]
    abilities = {
      kick: mk(bias.kick ?? 0),
      power: mk(bias.power ?? 0),
      speed: mk(bias.speed ?? 0),
      technique: mk(bias.technique ?? 0),
      stamina: mk(bias.stamina ?? 0),
      iq: mk(bias.iq ?? 0),
      defense: mk(bias.defense ?? 0),
    }
  }

  const heightTier = sampleHeightTier(rng, HEIGHT_TENDENCY[position])
  const grade: 1 | 2 | 3 = opts.grade ?? (rng.pick([1, 2, 2, 3, 3]) as 1 | 2 | 3)

  // G-22-A: 入部時にランダムな所属クラス（1〜6）を配属。進級時持ち上がり。
  const classroom = (rng.int(1, 6)) as 1 | 2 | 3 | 4 | 5 | 6
  return {
    id: `p${(playerIdCounter++).toString(36)}_${rng.state().toString(36)}`,
    name: generateName(rng),
    grade,
    abilities,
    isGK,
    gk: isGK
      ? { saving: clampAbility(base + rng.int(-2, 12)), gkIq: clampAbility(base + rng.int(-2, 10)) }
      : null,
    heightTier,
    maturity: sampleMaturity(rng),
    personality: pickPersonality(rng),
    fatigue: 0,
    condition: 3 as Condition,
    position,
    classroom,
  }
}
