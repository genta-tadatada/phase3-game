// 大会フロー全体のヘッドレス・スモークテスト（ランタイムエラー検出用）
import { createRNG, hashSeed } from '../src/engine/rng'
import { generateTeam, defaultTactics } from '../src/engine/generate/team'
import { generateUniqueSchoolNames } from '../src/data/schools'
import { PREFECTURES } from '../src/data/prefectures'
import { simulateMatch } from '../src/engine/match/simulateMatch'
import {
  applyPlayerResult, createTournament, matchSeed, playerMatchIndex,
  playerOpponent, roundName,
} from '../src/lib/tournament'
import type { Team } from '../src/engine/types'

let champions = 0
const RUNS = 200

for (let run = 0; run < RUNS; run++) {
  const seed = (hashSeed('蒼空学院') ^ (run * 2654435761)) >>> 0
  const rng = createRNG(seed)
  const player = generateTeam(rng, {
    id: 'player', name: '蒼空学院', prefecture: '東京都', color: '#f4a261',
    strength: 58, isPlayer: true, formation: '4-4-2', tactics: defaultTactics('4-4-2'),
  })
  const aiNames = generateUniqueSchoolNames(rng, 7, ['蒼空学院'])
  const strengths = [50, 53, 56, 60, 63, 67, 71]
  const ai: Team[] = aiNames.map((nm, i) => generateTeam(rng, {
    id: `ai_${i}`, name: nm, prefecture: rng.pick(PREFECTURES).name,
    color: '#888', strength: strengths[i], isPlayer: false,
  }))
  const t = createTournament(player, ai, seed)

  let guard = 0
  while (guard++ < 10) {
    const idx = playerMatchIndex(t)
    const opp = playerOpponent(t)
    if (idx < 0 || !opp) break
    const m = t.rounds[t.roundIndex][idx]
    const isHome = m.homeId === player.id
    const home = isHome ? player : opp
    const away = isHome ? opp : player
    const r = simulateMatch(home, away, matchSeed(t, t.roundIndex, idx), { knockout: true })
    if (run === 0) {
      console.log(`${roundName(t.roundIndex)}: ${home.shortName} ${r.homeScore}-${r.awayScore} ${away.shortName}${r.decidedByPK ? ` (PK ${r.homePK}-${r.awayPK})` : ''}`)
    }
    const out = applyPlayerResult(
      t, idx, r.homeScore, r.awayScore, r.winnerId ?? '',
      r.decidedByPK, r.decidedByPK ? [r.homePK ?? 0, r.awayPK ?? 0] : null,
    )
    if (out.isFinalRound || out.eliminated) {
      if (out.championId === player.id) champions++
      break
    }
  }
}

console.log(`\n${RUNS}回プレイ（既定戦術4-4-2バランス・無操作）でのプレイヤー優勝率: ${(100 * champions / RUNS).toFixed(1)}%`)
console.log('→ 戦術無調整でこの水準。最適戦術ならさらに上がる想定。')
