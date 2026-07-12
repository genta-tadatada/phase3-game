// 戦術の効果測定: プレイヤーが各戦術で大会に挑んだときの優勝率/勝率。
// 「戦術で勝率が動く」=戦略ゲームとして成立、を検証する。
import { createRNG, hashSeed } from '../src/engine/rng'
import { generateTeam, defaultTactics } from '../src/engine/generate/team'
import { generateUniqueSchoolNames } from '../src/data/schools'
import { PREFECTURES } from '../src/data/prefectures'
import { simulateMatch } from '../src/engine/match/simulateMatch'
import {
  applyPlayerResult, createTournament, matchSeed, playerMatchIndex, playerOpponent,
} from '../src/lib/tournament'
import type { Tactics, Team } from '../src/engine/types'

const RUNS = 1500

function runField(playerTactics: Tactics): { champ: number; matchWins: number; matches: number } {
  let champ = 0, matchWins = 0, matches = 0
  for (let run = 0; run < RUNS; run++) {
    const seed = (hashSeed('蒼空学院') ^ (run * 2654435761)) >>> 0
    const rng = createRNG(seed)
    const player = generateTeam(rng, {
      id: 'player', name: '蒼空学院', prefecture: '東京都', color: '#f4a261',
      strength: 58, isPlayer: true, formation: playerTactics.formation, tactics: playerTactics,
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
      const r = simulateMatch(isHome ? player : opp, isHome ? opp : player, matchSeed(t, t.roundIndex, idx), { knockout: true })
      matches++
      if (r.winnerId === player.id) matchWins++
      const out = applyPlayerResult(t, idx, r.homeScore, r.awayScore, r.winnerId ?? '',
        r.decidedByPK, r.decidedByPK ? [r.homePK ?? 0, r.awayPK ?? 0] : null)
      if (out.isFinalRound || out.eliminated) {
        if (out.championId === player.id) champ++
        break
      }
    }
  }
  return { champ, matchWins, matches }
}

function base(formation: Tactics['formation'] = '4-4-2'): Tactics {
  return defaultTactics(formation)
}

// 相手の戦術を読んで最適カウンターを組む（UIで相手戦術は見える）
function chooseCounter(opp: Tactics, underdog: boolean): Tactics {
  const t = base('4-4-2')
  // 格上には堅守速攻（ロースコア化で番狂わせ狙い）、格下には押し込む
  t.mentality = underdog ? 'defense' : 'attack'
  t.formation = underdog ? '5-3-2' : '4-3-3'
  // 相性ルールに沿ってカウンターを当てる
  if (opp.defenseLine === 'high') t.buildUp = 'fast'      // カウンター刺し
  if (opp.buildUp === 'slow') t.press = 'high'             // ポゼッション潰し
  if (opp.defenseLine === 'low') t.width = 'wide'          // 引いた相手を広げる
  if (opp.formation.startsWith('3-')) t.width = 'central'  // 3バックの中央を突く
  if (opp.press === 'high' && t.buildUp === 'slow') t.buildUp = 'mid' // 遅いビルドUPの自滅回避
  return t
}

function runAdaptive(chooseFn: (opp: Tactics, underdog: boolean) => Tactics) {
  let champ = 0, matchWins = 0, matches = 0
  for (let run = 0; run < RUNS; run++) {
    const seed = (hashSeed('蒼空学院') ^ (run * 2654435761)) >>> 0
    const rng = createRNG(seed)
    const player = generateTeam(rng, {
      id: 'player', name: '蒼空学院', prefecture: '東京都', color: '#f4a261',
      strength: 58, isPlayer: true, formation: '4-4-2', tactics: base(),
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
      // 相手を読んで戦術決定
      const ovP = player.players.slice(0, 11).reduce((s, p) => s + Object.values(p.abilities).reduce((a, b) => a + b, 0), 0)
      const ovO = opp.players.slice(0, 11).reduce((s, p) => s + Object.values(p.abilities).reduce((a, b) => a + b, 0), 0)
      player.tactics = chooseFn(opp.tactics, ovO > ovP)
      t.teams[player.id] = player
      const m = t.rounds[t.roundIndex][idx]
      const isHome = m.homeId === player.id
      const r = simulateMatch(isHome ? player : opp, isHome ? opp : player, matchSeed(t, t.roundIndex, idx), { knockout: true })
      matches++
      if (r.winnerId === player.id) matchWins++
      const out = applyPlayerResult(t, idx, r.homeScore, r.awayScore, r.winnerId ?? '',
        r.decidedByPK, r.decidedByPK ? [r.homePK ?? 0, r.awayPK ?? 0] : null)
      if (out.isFinalRound || out.eliminated) {
        if (out.championId === player.id) champ++
        break
      }
    }
  }
  return { champ, matchWins, matches }
}

const presets: { name: string; t: Tactics }[] = [
  { name: '4-4-2 バランス(既定)', t: base() },
  { name: '4-3-3 攻撃的', t: { ...base('4-3-3'), mentality: 'attack' } },
  { name: '5-3-2 超守備+カウンター', t: { ...base('5-3-2'), mentality: 'ultra-defense', buildUp: 'fast', press: 'low' } },
  { name: '4-4-2 超攻撃ハイプレス', t: { ...base(), mentality: 'ultra-attack', press: 'high', defenseLine: 'high' } },
  { name: '3-5-2 中盤支配ポゼッション', t: { ...base('3-5-2'), mentality: 'balance', buildUp: 'slow', press: 'high' } },
  { name: '4-2-3-1 堅実+セットプレー', t: { ...base('4-2-3-1'), mentality: 'defense', setPiece: true } },
]

console.log(`戦術別 プレイヤー成績（各${RUNS}大会・同一シード列）\n`)
console.log('戦術'.padEnd(30), '優勝率', ' 試合勝率')
for (const p of presets) {
  const r = runField(p.t)
  console.log(
    p.name.padEnd(26),
    `${(100 * r.champ / RUNS).toFixed(1)}%`.padStart(6),
    `  ${(100 * r.matchWins / r.matches).toFixed(1)}%`,
  )
}

console.log('\n--- 適応型（相手の戦術を読んでカウンター）---')
const adapt = runAdaptive(chooseCounter)
console.log(
  '最適カウンター戦術'.padEnd(26),
  `${(100 * adapt.champ / RUNS).toFixed(1)}%`.padStart(6),
  `  ${(100 * adapt.matchWins / adapt.matches).toFixed(1)}%`,
)
