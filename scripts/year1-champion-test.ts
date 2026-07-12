// G-10: 1年目県優勝の運幅検証
// 既定プレイで夏予選を最後まで進め、各県の県優勝率を観測する。
// 強県は0%でよいが、弱県は1〜5%程度のロマンが残っていてほしい。
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'

const g = () => useCareer.getState()
// 強県/中堅/弱県でレンジを見る
const PREFS = ['静岡県', '東京都', '青森県', '鳥取県', '福井県']
const N = 60 // 各県60回 → 計300回

type Outcome = { firstWin: number; r2Win: number; r3Win: number; champion: number; total: number }
const stat: Record<string, Outcome> = {}
for (const p of PREFS) stat[p] = { firstWin: 0, r2Win: 0, r3Win: 0, champion: 0, total: 0 }

for (let s = 0; s < N; s++) {
  for (const pref of PREFS) {
    stat[pref].total++
    g().newCareer(`県優勝検証${s}`, pref)
    let guard = 0
    let playerWins = 0
    let entered = false
    let eliminated = false
    while (guard++ < 600) {
      const st = g()
      const sc = st.screen
      if (st.growthResult) { st.dismissGrowth(); continue }
      if (sc === 'weekly') {
        if (st.career!.week >= 13 && !entered) break
        st.advance()
      } else if (sc === 'comp-bracket') {
        entered = true
        if (st.comp!.stage !== 'qualify') {
          // 県大会突破＝県優勝
          break
        }
        if (playerMatchIndex(st.comp!.tournament) >= 0) st.startCompMatch()
        else break
      } else if (sc === 'comp-match') {
        if (!st.comp!.matchResult) st.resumeCompMatch()
        else {
          const t = st.comp!.tournament
          const r = st.comp!.matchResult!
          if (r.winnerId === t.playerId) playerWins++
          else eliminated = true
          st.finishCompMatch()
        }
      } else if (sc === 'comp-result') {
        break
      } else { g().go('weekly') }
    }
    const o = stat[pref]
    if (playerWins >= 1) o.firstWin++
    if (playerWins >= 2) o.r2Win++
    if (playerWins >= 3) o.r3Win++
    // 4勝以上 or eliminated=false かつ comp-bracket抜けで県優勝
    if (!eliminated && playerWins >= 4) o.champion++
  }
}

console.log(`=== year-1 夏季県予選 県優勝の運幅（既定プレイ・各${N}回・計${PREFS.length*N}回）===`)
console.log('県      | 初戦勝   | 2回戦勝 | 3回戦勝 | 県優勝')
for (const pref of PREFS) {
  const o = stat[pref]
  const p = (n: number) => `${(n/o.total*100).toFixed(1)}%`.padStart(7)
  console.log(`${pref.padEnd(5)} | ${p(o.firstWin)} | ${p(o.r2Win)} | ${p(o.r3Win)} | ${p(o.champion)}`)
}
console.log()
const weakChamp = stat['鳥取県'].champion / stat['鳥取県'].total
console.log(`弱県(鳥取県)の県優勝率: ${(weakChamp*100).toFixed(1)}%`)
if (weakChamp >= 0.01 && weakChamp <= 0.10) {
  console.log('  → 1〜10%帯：1年目県優勝の「ロマン」は残されている ✅')
} else if (weakChamp < 0.01) {
  console.log('  ⚠ 1%未満：1年目県優勝が事実上不可能。運の幅をもう少し残してもよい')
} else {
  console.log('  ⚠ 10%超：1年目から県優勝しすぎ。難易度を上げる余地あり')
}
