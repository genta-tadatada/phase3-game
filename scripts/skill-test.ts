// スキルの試合効果（キャプテンシー雰囲気/セットプレー/PK）が機能するか検証。
import { createRNG } from '../src/engine/rng'
import { generateTeam } from '../src/engine/generate/team'
import { simulateMatch } from '../src/engine/match/simulateMatch'
import type { Tactics, Team } from '../src/engine/types'

const balanced: Tactics = { formation: '4-4-2', mentality: 'balance', press: 'mid', defenseLine: 'mid', width: 'mid', buildUp: 'mid', setPiece: true }

function team(seed: number, id: string, skilled: boolean): Team {
  const t = generateTeam(createRNG(seed), { id, name: `${id}校`, prefecture: '東京都', color: '#888', strength: 55, isPlayer: false, formation: '4-4-2', tactics: balanced })
  if (skilled) {
    // 数人にスキルを付与（キャプテンシー・直接FK・PKストッパー・PKキッカー）
    t.players[0].skills = ['pk-stopper']        // GK
    t.players[9].skills = ['free-kick', 'pk']   // FW
    t.players[7].skills = ['captaincy']         // 中盤
  }
  return t
}

const N = 4000
let skilledWins = 0, plainWins = 0, draws = 0, pk = 0
for (let i = 0; i < N; i++) {
  const home = team(i * 2 + 1, 'S', true)
  const away = team(i * 2 + 2, 'P', false)
  const r = simulateMatch(home, away, i * 7919 + 5, { knockout: true })
  if (r.decidedByPK) pk++
  if (r.winnerId === home.id) skilledWins++
  else if (r.winnerId === away.id) plainWins++
  else draws++
}
console.log(`=== スキル持ち vs 無し（互角・${N}試合・ノックアウト） ===`)
console.log(`  スキル持ち勝率 ${(100 * skilledWins / N).toFixed(1)}% / 無し ${(100 * plainWins / N).toFixed(1)}%（PK決着 ${(100 * pk / N).toFixed(1)}%）`)
console.log(`  → スキル持ちが50%超なら、キャプテンシー雰囲気＋セットプレー＋PK補正が機能`)
