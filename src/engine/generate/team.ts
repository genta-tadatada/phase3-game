// ============================================================
// engine/generate/team.ts — チーム生成（先発11 + 控え + 戦術 + 監督能力）
// ============================================================

import type {
  Formation, Player, PositionType, Tactics, Team,
} from '../types'
import type { RNG } from '../rng'
import { FORMATIONS, FORMATION_LIST } from '../match/formations'
import { generatePlayer } from './player'
import { shortenSchoolName } from '../../data/schools'

/** フォーメーションに対する無難な既定戦術 */
export function defaultTactics(formation: Formation): Tactics {
  return {
    formation,
    mentality: 'balance',
    press: 'mid',
    defenseLine: 'mid',
    width: 'mid',
    buildUp: 'mid',
    setPiece: false,
  }
}

const WIDTHS: Tactics['width'][] = ['wide', 'mid', 'central']

/** AIチームの戦術プロファイルを生成（強度で傾向を変える） */
function aiTactics(rng: RNG, formation: Formation, strength: number): Tactics {
  // 強いチームほど攻撃的・ハイプレス寄り、弱いチームは堅守速攻寄り
  const aggressive = strength >= 62
  return {
    formation,
    mentality: aggressive
      ? rng.pick(['attack', 'balance', 'ultra-attack'])
      : rng.pick(['balance', 'defense', 'defense']),
    press: aggressive ? rng.pick(['high', 'mid']) : rng.pick(['mid', 'low']),
    defenseLine: aggressive ? rng.pick(['high', 'mid']) : rng.pick(['mid', 'low']),
    width: rng.pick(WIDTHS),
    buildUp: aggressive ? rng.pick(['mid', 'slow']) : rng.pick(['fast', 'mid']),
    setPiece: rng.chance(0.4),
  }
}

export interface GenTeamOpts {
  id: string
  name: string
  prefecture: string
  color: string
  strength: number
  isPlayer: boolean
  formation?: Formation
  tactics?: Tactics
  feature?: string // #30/#45: 特色タグ（表示用）
}

/** 控え用のポジションプール（バランス良く5人） */
const SUB_POSITIONS: PositionType[] = ['GK', 'CB', 'CM', 'WF', 'CF']

// G-09: 特色（feature）にひもづいたフォーメーション選好。
//   均等ランダムだと「全部442に感じる」（実際は1/6で442でも記憶補正で目立つ）。
//   特色とフォーメーションを連動させて「相手校ごとに戦い方が違う」感覚を作る。
const FEATURE_FORMATION_BIAS: Record<string, Formation[]> = {
  '堅守速攻':     ['5-3-2', '5-3-2', '4-4-2', '4-4-2', '4-2-3-1'],
  'フィジカル堅守': ['5-3-2', '5-3-2', '4-4-2', '4-4-2', '3-5-2'],
  '大型FW':       ['4-3-3', '3-4-3', '4-3-3', '4-2-3-1', '4-4-2'],
  '技巧派':       ['4-2-3-1', '4-2-3-1', '4-3-3', '3-5-2', '4-4-2'],
  'スタミナ自慢':  ['3-5-2', '3-5-2', '3-4-3', '4-3-3', '4-4-2'],
  '総合力':       ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '3-4-3'],
}

/** 1チームを生成 */
export function generateTeam(rng: RNG, opts: GenTeamOpts): Team {
  // G-09: feature が与えられていれば特色プールから選び、なければ全6種から均等抽選
  const featurePool = opts.feature ? FEATURE_FORMATION_BIAS[opts.feature] : undefined
  const formation = opts.formation ?? rng.pick(featurePool ?? FORMATION_LIST)
  const slots = FORMATIONS[formation]

  const players: Player[] = []
  // 先発11（生成slot＝配置スロット。採点はslot基準）
  for (const pos of slots) {
    players.push({ ...generatePlayer(rng, { position: pos, strength: opts.strength }), slot: pos })
  }
  // 控え5（やや能力控えめ・学年若め多め）
  for (const pos of SUB_POSITIONS) {
    players.push(generatePlayer(rng, {
      position: pos,
      strength: opts.strength - rng.int(4, 12),
      grade: rng.pick([1, 1, 2]) as 1 | 2,
    }))
  }

  const tactics = opts.tactics
    ?? (opts.isPlayer ? defaultTactics(formation) : aiTactics(rng, formation, opts.strength))

  const managerSkill = Math.max(20, Math.min(95,
    opts.strength + rng.int(-12, 12)))

  return {
    id: opts.id,
    name: opts.name,
    shortName: shortenSchoolName(opts.name),
    prefecture: opts.prefecture,
    color: opts.color,
    players,
    tactics,
    managerSkill,
    reputation: Math.max(0, Math.min(100, opts.strength + rng.int(-8, 8))),
    isPlayer: opts.isPlayer,
    feature: opts.feature,
  }
}
