// ============================================================
// data/presetTeams.ts — MVP用の固定「最強8校」
// フル版に登場しうる全国強豪レベル。各校に個性ある戦術・監督能力。
// ============================================================

import type { Tactics, Team } from '../engine/types'
import { createRNG } from '../engine/rng'
import { generateTeam } from '../engine/generate/team'

interface PresetDef {
  id: string
  name: string
  prefecture: string
  color: string
  strength: number
  manager: number      // 監督能力（高いほど試合中に適応してくる）
  tactics: Tactics
  desc: string
}

const T = (formation: Tactics['formation'], mentality: Tactics['mentality'], press: Tactics['press'],
  defenseLine: Tactics['defenseLine'], width: Tactics['width'], buildUp: Tactics['buildUp'], setPiece: boolean): Tactics =>
  ({ formation, mentality, press, defenseLine, width, buildUp, setPiece })

export const PRESET_DEFS: PresetDef[] = [
  { id: 'p0', name: '天馬高校', prefecture: '東京都', color: '#f4a261', strength: 78, manager: 90,
    tactics: T('4-3-3', 'attack', 'high', 'high', 'wide', 'mid', true), desc: '王者・全方位に強い名門' },
  { id: 'p1', name: '青嵐学院', prefecture: '神奈川県', color: '#457b9d', strength: 77, manager: 88,
    tactics: T('4-2-3-1', 'attack', 'high', 'mid', 'mid', 'slow', false), desc: '中盤を支配するポゼッション' },
  { id: 'p2', name: '黒鉄工業', prefecture: '大阪府', color: '#6c757d', strength: 75, manager: 86,
    tactics: T('5-3-2', 'defense', 'mid', 'low', 'mid', 'fast', true), desc: '鉄壁の堅守速攻' },
  { id: 'p3', name: '紅蓮高校', prefecture: '静岡県', color: '#e63946', strength: 76, manager: 80,
    tactics: T('3-4-3', 'ultra-attack', 'high', 'high', 'wide', 'fast', false), desc: '超攻撃・打ち合い上等' },
  { id: 'p4', name: '蒼空FC高校', prefecture: '埼玉県', color: '#48cae4', strength: 75, manager: 84,
    tactics: T('4-4-2', 'balance', 'mid', 'mid', 'mid', 'mid', false), desc: '隙のないバランス型' },
  { id: 'p5', name: '雷電高校', prefecture: '福岡県', color: '#9b5de5', strength: 74, manager: 82,
    tactics: T('3-5-2', 'balance', 'high', 'mid', 'central', 'slow', false), desc: '中央突破とハイプレス' },
  { id: 'p6', name: '白鷺学園', prefecture: '愛知県', color: '#adb5bd', strength: 73, manager: 78,
    tactics: T('4-4-2', 'defense', 'low', 'low', 'mid', 'fast', true), desc: '我慢比べのカウンター' },
  { id: 'p7', name: '玄武学院', prefecture: '広島県', color: '#2a9d8f', strength: 74, manager: 76,
    tactics: T('4-3-3', 'balance', 'mid', 'high', 'wide', 'mid', false), desc: 'サイド攻撃の伝統校' },
]

/** 8つの固定チームを構築（毎回同じ＝固定。idで安定したシード） */
export function buildPresetTeams(): Team[] {
  return PRESET_DEFS.map((d, i) => {
    const t = generateTeam(createRNG(70001 + i * 131), {
      id: d.id, name: d.name, prefecture: d.prefecture, color: d.color,
      strength: d.strength, isPlayer: false, tactics: d.tactics,
    })
    t.managerSkill = d.manager
    return t
  })
}
