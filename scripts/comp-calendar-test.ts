// #11完全版の検証：大会モードが「暦を消費する」こと＝大会の各試合で career.week が進むこと、
// 大会後に通常メニュー/合宿などのトリガーが正しく続くこと、reload(セーブ往復)で大会が再開できること。
// 2026-07-07更新: 暦消費は「2試合以上」で初めて観測できる（1回戦敗退＝1試合は週が進まない仕様）。
//   1回戦敗退のシードだと偽陰性になるため、2試合以上戦えるシード（校名）を見つかるまで試す。
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'

const g = () => useCareer.getState()

interface RunResult {
  weekAtCompStart: number
  weekAtCompEnd: number
  sawCampEvent: boolean
  reloadResumedComp: boolean
  playerMatches: number
}

function runOnce(schoolName: string): RunResult {
  g().newCareer(schoolName, '鳥取県') // 弱県＝勝ち上がりやすく大会が長く続く
  const r: RunResult = { weekAtCompStart: -1, weekAtCompEnd: -1, sawCampEvent: false, reloadResumedComp: false, playerMatches: 0 }
  let guard = 0

  while (g().career && g().career!.year < 2 && guard++ < 600) {
    const s = g()
    const sc = s.screen
    // 大会前に出る成長結果モーダルを閉じないと comp-bracket へ遷移しない（駆動の前提）
    if (s.growthResult) { s.dismissGrowth(); continue }
    if (sc === 'weekly') {
      s.advance()
    } else if (sc === 'camp') {
      // 合宿は#34でサブモード化＝camp画面への遷移がトリガー発火の証拠。1ステップずつ消化する。
      r.sawCampEvent = true
      if (s.campStage === 'choice') {
        const camp = s.career!.activeCamp!
        const lastDay = camp.shown[camp.shown.length - 1]
        const opt = lastDay.events[lastDay.events.length - 1].choice?.options[0]
        if (opt) { s.resolveCampChoice(opt.effectId); continue }
      }
      s.nextCampStep()
    } else if (sc === 'comp-bracket') {
      const c = s.career!
      if (c.activeComp && r.weekAtCompStart < 0) r.weekAtCompStart = c.week
      // reload安全性：localStorageはNode非対応のためJSON往復で永続を検証（save.tsと同手法）。
      // activeComp(Tournament含む)が関数混入なくJSON往復し、stageが保たれれば実機で再開可能。
      if (c.activeComp && !r.reloadResumedComp) {
        const round = JSON.parse(JSON.stringify(c)) as typeof c
        if (round.activeComp && round.activeComp.stage === c.activeComp.stage
          && round.activeComp.tournament?.playerId === c.activeComp.tournament.playerId) r.reloadResumedComp = true
      }
      if (playerMatchIndex(s.comp!.tournament) >= 0) s.startCompMatch()
      else break
    } else if (sc === 'comp-match') {
      if (!s.comp!.matchResult) s.resumeCompMatch()
      else { r.playerMatches++; s.finishCompMatch() }
    } else if (sc === 'comp-result') {
      if (r.weekAtCompEnd < 0) r.weekAtCompEnd = g().career!.week // 最初の大会(夏予選)の終了週だけ計測
      s.continueAfterComp()
    } else if (sc === 'summary') {
      s.dismissSummary()
    } else { g().go('weekly') }
  }
  return r
}

console.log('=== #11 大会の暦消費・reload再開 検証 ===')
let r: RunResult | null = null
for (let attempt = 1; attempt <= 8; attempt++) {
  const name = attempt === 1 ? '暦検証高校' : `暦検証高校${attempt}`
  r = runOnce(name)
  console.log(`  試行${attempt}（${name}）: 試合数=${r.playerMatches}`)
  if (r.playerMatches >= 2) break
}
if (!r || r.playerMatches < 2) {
  console.log('\n⚠ 8シード連続で1回戦敗退＝暦消費を観測できず（テスト環境の乱数要因を確認）')
  process.exit(1)
}

console.log(`  夏予選 開始週: ${r.weekAtCompStart}`)
console.log(`  夏予選 終了週: ${r.weekAtCompEnd}（開始より進んでいれば暦を消費した証拠）`)
console.log(`  合宿サブモード発火: ${r.sawCampEvent ? 'あり' : 'なし'}`)
console.log(`  reload(セーブ往復)で大会再開可: ${r.reloadResumedComp ? 'OK' : 'NG'}`)
const consumed = r.weekAtCompEnd > r.weekAtCompStart && r.weekAtCompStart > 0
const ok = consumed && r.sawCampEvent && r.reloadResumedComp
console.log(ok
  ? '\n✅ 大会が暦を消費し（試合ごとに週進行）、大会後のトリガー（合宿）も継続、reload再開も機能 ✅'
  : `\n⚠ 要確認: 暦消費=${consumed} / 合宿=${r.sawCampEvent} / reload=${r.reloadResumedComp}`)
if (!ok) process.exit(1)
