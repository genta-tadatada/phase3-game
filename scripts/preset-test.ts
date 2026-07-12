// 3戦術プリセット（得点状況で自動切替）が実際に有利かを検証。
// 互角チーム同士で、片方だけ「リード時=守備的 / ビハインド時=攻撃的」を設定。
import { createRNG } from '../src/engine/rng'
import { generateTeam } from '../src/engine/generate/team'
import { simulateMatch } from '../src/engine/match/simulateMatch'
import type { Tactics, Team } from '../src/engine/types'

const balanced: Tactics = { formation: '4-4-2', mentality: 'balance', press: 'mid', defenseLine: 'mid', width: 'mid', buildUp: 'mid', setPiece: false }
const defensive: Tactics = { ...balanced, mentality: 'defense', press: 'low', defenseLine: 'low', buildUp: 'fast' }
const attacking: Tactics = { ...balanced, mentality: 'attack', press: 'high', defenseLine: 'high' }

function team(seed: number, id: string, withPresets: boolean): Team {
  const t = generateTeam(createRNG(seed), { id, name: `${id}校`, prefecture: '東京都', color: '#888', strength: 55, isPlayer: false, formation: '4-4-2', tactics: balanced })
  if (withPresets) { t.tacticsLead = defensive; t.tacticsBehind = attacking }
  return t
}

const N = 4000
let adaptiveWins = 0, staticWins = 0, draws = 0
for (let i = 0; i < N; i++) {
  // home=適応型 / away=固定。互角（同strength・別ロスター）
  const home = team(i * 2 + 1, 'A', true)
  const away = team(i * 2 + 2, 'B', false)
  const r = simulateMatch(home, away, i * 7919 + 3, { knockout: false })
  if (r.homeScore > r.awayScore) adaptiveWins++
  else if (r.awayScore > r.homeScore) staticWins++
  else draws++
}
console.log(`=== 3プリセット適応型 vs 固定（互角・${N}試合） ===`)
console.log(`  適応型 勝率 ${(100 * adaptiveWins / N).toFixed(1)}% / 固定 ${(100 * staticWins / N).toFixed(1)}% / 引分 ${(100 * draws / N).toFixed(1)}%`)
console.log(`  → 適応型が50%を明確に超えれば、状況別プリセットに戦略的価値あり`)
