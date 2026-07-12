// ストア駆動: キャリアを複数年自動プレイし、大会フロー・評判成長・
// スカウト解禁・部員数を検証する（UIと同じコードパス）。
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'

const g = () => useCareer.getState()
g().newCareer('検証学院', '静岡県')

const TARGET_YEAR = 9
let actions = 0
const yearLog: { year: number; rep: number; players: number; scout: number; titles: number }[] = []
let lastLoggedYear = 0

while (g().career && g().career!.year < TARGET_YEAR && actions < 20000) {
  actions++
  const s = g()
  const screen = s.screen
  // 大会/合宿の前に成長結果モーダルが出る→閉じないと comp-bracket へ遷移しない（大会フロー検証の前提）
  if (s.growthResult) { s.dismissGrowth(); continue }
  if (screen === 'camp') {
    let gg = 0
    while (g().screen === 'camp' && gg++ < 80) {
      const cs = g()
      if (cs.campStage === 'choice') {
        const cp = cs.career!.activeCamp!; const ld = cp.shown[cp.shown.length - 1]; const o = ld.events[ld.events.length - 1].choice?.options[0]
        if (o) cs.resolveCampChoice(o.effectId); else cs.nextCampStep()
      } else cs.nextCampStep()
    }
  } else if (screen === 'weekly') {
    // 年が変わったら記録
    const c = s.career!
    if (c.year !== lastLoggedYear) {
      lastLoggedYear = c.year
      yearLog.push({ year: c.year, rep: c.reputation, players: c.roster.length, scout: c.scouting.level, titles: c.records.summerTitles + c.records.winterTitles })
    }
    s.advance()
  } else if (screen === 'summary') {
    s.dismissSummary()
  } else if (screen === 'comp-bracket') {
    if (playerMatchIndex(s.comp!.tournament) >= 0) s.startCompMatch()
    else { // プレイヤー敗退済みで自動進行待ち（通常起きない）
      s.continueAfterComp()
    }
  } else if (screen === 'comp-match') {
    if (!s.comp!.matchResult) s.resumeCompMatch(); else s.finishCompMatch()
  } else if (screen === 'comp-result') {
    s.continueAfterComp()
  } else {
    g().go('weekly')
  }
}

console.log(`=== キャリア ${TARGET_YEAR - 1}年自動プレイ（既定戦術・既定練習） ===`)
console.log('年 | 評判 | 部員 | スカウトLv | 通算優勝')
for (const y of yearLog) {
  console.log(`${String(y.year).padStart(2)} | ${String(y.rep).padStart(4)} | ${String(y.players).padStart(4)} | ${String(y.scout).padStart(8)} | ${y.titles}`)
}
const c = g().career!
console.log(`\n最終: ${c.year}年目 / 評判${c.reputation} / 部員${c.roster.length} / 通算優勝${c.records.summerTitles + c.records.winterTitles} / 全国出場${c.records.nationalApps}回 / 卒業${c.records.graduates}`)
console.log(`履歴:`)
for (const h of c.records.history.slice(-8)) console.log(`  ${h.year}年: 夏${h.summer} 冬${h.winter} (評判${h.reputationEnd})`)
console.log(`\n${actions}アクションで完走 ✅`)
