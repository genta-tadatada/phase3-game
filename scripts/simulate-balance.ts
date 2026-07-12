// ============================================================
// scripts/simulate-balance.ts — バランス検証ハーネス（ヘッドレス）
// GDD 補完I の M1 合格基準: 「互角チームで片チーム期待得点1.2〜1.5点」。
// これを満たすまでUI実装に進まない（GDDのゲート条件）。
//
// 実行: npm run balance
// ============================================================

import { createRNG } from '../src/engine/rng'
import { generateTeam } from '../src/engine/generate/team'
import { simulateMatch } from '../src/engine/match/simulateMatch'
import { TUNING } from '../src/engine/match/eventTable'
import type { Team } from '../src/engine/types'

function makeTeam(seed: number, id: string, strength: number): Team {
  const rng = createRNG(seed)
  return generateTeam(rng, {
    id, name: `${id}校`, prefecture: '東京都', color: '#888',
    strength, isPlayer: false,
    formation: '4-4-2',
    tactics: {
      formation: '4-4-2', mentality: 'balance', press: 'mid',
      defenseLine: 'mid', width: 'mid', buildUp: 'mid', setPiece: false,
    },
  })
}

interface Stats {
  matches: number
  homeGoals: number
  awayGoals: number
  homeWins: number
  awayWins: number
  draws: number
  scoreDist: Record<string, number>
}

function runSet(strengthA: number, strengthB: number, n: number, baseSeed: number): Stats {
  const s: Stats = {
    matches: n, homeGoals: 0, awayGoals: 0,
    homeWins: 0, awayWins: 0, draws: 0, scoreDist: {},
  }
  for (let i = 0; i < n; i++) {
    // 毎試合チームを生成し直す（同強度なら平均的に互角）
    const a = makeTeam(baseSeed + i * 2 + 1, 'A', strengthA)
    const b = makeTeam(baseSeed + i * 2 + 2, 'B', strengthB)
    const r = simulateMatch(a, b, baseSeed + i * 7919, { knockout: false })
    s.homeGoals += r.homeScore
    s.awayGoals += r.awayScore
    if (r.homeScore > r.awayScore) s.homeWins++
    else if (r.awayScore > r.homeScore) s.awayWins++
    else s.draws++
    const key = `${Math.min(r.homeScore, 6)}-${Math.min(r.awayScore, 6)}`
    s.scoreDist[key] = (s.scoreDist[key] ?? 0) + 1
  }
  return s
}

function report(label: string, s: Stats) {
  const perHome = (s.homeGoals / s.matches).toFixed(3)
  const perAway = (s.awayGoals / s.matches).toFixed(3)
  const total = ((s.homeGoals + s.awayGoals) / s.matches).toFixed(3)
  console.log(`\n=== ${label} (${s.matches}試合) ===`)
  console.log(`  片チーム平均得点: home ${perHome} / away ${perAway}  (合計 ${total})`)
  console.log(`  勝敗: home勝 ${(100 * s.homeWins / s.matches).toFixed(1)}% / away勝 ${(100 * s.awayWins / s.matches).toFixed(1)}% / 引分 ${(100 * s.draws / s.matches).toFixed(1)}%`)
  // 上位スコアライン
  const top = Object.entries(s.scoreDist).sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log('  多いスコア: ' + top.map(([k, v]) => `${k}:${(100 * v / s.matches).toFixed(1)}%`).join('  '))
}

function main() {
  const N = 3000
  console.log('Phase3 試合エンジン バランス検証')
  console.log('TUNING:', JSON.stringify(TUNING))

  // ① 互角（強度55同士）— 合格基準: 片チーム平均 1.2〜1.5
  const even = runSet(55, 55, N, 1000)
  report('互角 55 vs 55', even)
  const perTeam = (even.homeGoals + even.awayGoals) / 2 / even.matches
  const pass = perTeam >= 1.2 && perTeam <= 1.5
  console.log(`\n  ▶ 片チーム平均得点 = ${perTeam.toFixed(3)}  →  ${pass ? '✅ 合格（1.2〜1.5）' : '❌ 要調整'}`)

  // ② 強豪 vs 互角（実力差の効き具合）
  report('実力差 65 vs 50', runSet(65, 50, N, 5000))
  report('僅差 58 vs 52', runSet(58, 52, N, 9000))
  // ③ 低強度同士（弱小同士でも極端なロースコアにならないか）
  report('弱小互角 42 vs 42', runSet(42, 42, N, 13000))

  console.log('\n--- 合格基準（互角・片チーム1.2〜1.5）:', pass ? 'PASS ✅' : 'FAIL ❌', '---')
  process.exit(pass ? 0 : 1)
}

main()
