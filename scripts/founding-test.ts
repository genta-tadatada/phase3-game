// 創部リデザインの検証: 学年構成・3年生スターの強さ・初年度県予選の到達度・
// 複数年の学年フロー（8/8/8定常・崖なし）。
import { createCareer } from '../src/career/init'
import { advanceWeek } from '../src/career/engine'
import { buildField, playerPlacement } from '../src/career/competition'
import { playerMatchIndex, playerOpponent, matchSeed, applyPlayerResult } from '../src/lib/tournament'
import { simulateMatch } from '../src/engine/match/simulateMatch'
import { playerOverallSum } from '../src/engine/match/teamQuality'
import { overallLabel } from '../src/lib/labels'
import type { WeeklyPlan } from '../src/career/types'

// --- 創部チームの構成 ---
const c0 = createCareer('創部検証高', '東京都')
const byGrade = (g: number) => c0.roster.filter((p) => p.grade === g)
console.log('=== 創部チーム構成 ===')
for (const g of [3, 2, 1]) {
  const ps = byGrade(g)
  const avg = ps.reduce((s, p) => s + playerOverallSum(p), 0) / ps.length
  console.log(`  ${g}年: ${ps.length}人 平均総合${(avg / 7).toFixed(0)}(${overallLabel(avg).label}) — ${ps.map(p => `${p.position}${(playerOverallSum(p) / 7).toFixed(0)}`).join(' ')}`)
}

// --- 初年度 夏季県予選の到達度（プレイヤー無操作・生の創部チーム） ---
function year1Placement(pref: string, n: number): number[] {
  const dist = [0, 0, 0, 0] // 0=初戦敗退 1=ベスト4 2=準優勝 3=県優勝
  for (let i = 0; i < n; i++) {
    const c = createCareer(`創部${i}`, pref)
    const t = buildField(c, 'summer', 'qualify')
    let guard = 0
    while (guard++ < 6) {
      const idx = playerMatchIndex(t)
      const opp = playerOpponent(t)
      if (idx < 0 || !opp) break
      const m = t.rounds[t.roundIndex][idx]
      const isHome = m.homeId === t.playerId
      const r = simulateMatch(isHome ? t.teams[t.playerId] : opp, isHome ? opp : t.teams[t.playerId], matchSeed(t, t.roundIndex, idx), { knockout: true })
      const out = applyPlayerResult(t, idx, r.homeScore, r.awayScore, r.winnerId ?? '', r.decidedByPK, r.decidedByPK ? [r.homePK ?? 0, r.awayPK ?? 0] : null)
      if (out.isFinalRound || out.eliminated) break
    }
    dist[playerPlacement(t)]++
  }
  return dist
}
console.log('\n=== 初年度 夏季県予選 到達度（生の創部チーム・各300回）===')
for (const pref of ['鳥取県', '東京都', '静岡県']) {
  const d = year1Placement(pref, 300)
  const won1 = ((d[1] + d[2] + d[3]) / 3).toFixed(0)
  console.log(`  ${pref}: 初戦敗退${(d[0] / 3).toFixed(0)}% / ベスト4${(d[1] / 3).toFixed(0)}% / 準優勝${(d[2] / 3).toFixed(0)}% / 県優勝${(d[3] / 3).toFixed(0)}%  → 1勝以上=${won1}%`)
}

// --- 学年フロー（無操作で5年・8/8/8定常になるか） ---
const plan: WeeklyPlan = { lanes: [{ menuId: 'pass' }, { menuId: 'defense1v1' }, { menuId: 'shoot' }, { menuId: 'gk-saving' }], assign: {}, weekend: 'rest', managerAction: null, meetingTarget: null }
let c = createCareer('学年フロー高', '東京都')
console.log('\n=== 学年フロー（初期設備・無操作）===')
console.log(`  1年目: 1年${byGrade2(c,1)} / 2年${byGrade2(c,2)} / 3年${byGrade2(c,3)} = ${c.roster.length}`)
for (let y = 0; y < 5; y++) {
  for (let w = 0; w < 48; w++) c = advanceWeek(c, plan).state
  console.log(`  ${c.year}年目: 1年${byGrade2(c,1)} / 2年${byGrade2(c,2)} / 3年${byGrade2(c,3)} = ${c.roster.length}`)
}
function byGrade2(s: typeof c, g: number) { return s.roster.filter((p) => p.grade === g).length }
