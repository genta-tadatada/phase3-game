// year-1の夏季県予選で「創部直後の弱いチーム」がどこまで勝てるかを実測する。
// 初戦・二回戦が勝てないのは悲しい（ユーザー要望）→ 弱敵rampで初戦勝率が十分か確認。
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'

const g = () => useCareer.getState()
const PREFS = ['静岡県', '東京都', '青森県', '鳥取県', '福井県'] // 強県〜弱県の混在
const N = 40

let firstRoundWins = 0
let reachedR2 = 0          // 1回戦突破（=初戦勝利）
let reachedR3plus = 0      // 2回戦も突破
let totalRuns = 0

for (let s = 0; s < N; s++) {
  for (const pref of PREFS) {
    totalRuns++
    g().newCareer(`勝率検証${s}`, pref)
    let guard = 0
    let playerWins = 0
    let entered = false
    while (guard++ < 400) {
      const st = g()
      const sc = st.screen
      // 大会前に出る成長結果モーダルを閉じないと comp-bracket へ遷移しない（テスト駆動の前提）
      if (st.growthResult) { st.dismissGrowth(); continue }
      if (sc === 'weekly') {
        // 夏予選(week11)に入るまで既定プレイで週送り
        if (st.career!.week >= 12 && !entered) break // 予選を過ぎた（=予選未発生は無いはずだが安全）
        st.advance()
      } else if (sc === 'comp-bracket') {
        entered = true
        if (st.comp!.stage !== 'qualify') break // 全国まで来た＝予選は突破済み
        if (playerMatchIndex(st.comp!.tournament) >= 0) st.startCompMatch()
        else break
      } else if (sc === 'comp-match') {
        if (!st.comp!.matchResult) st.resumeCompMatch()
        else {
          // 勝敗を数える
          const t = st.comp!.tournament
          const r = st.comp!.matchResult!
          if (r.winnerId === t.playerId) playerWins++
          st.finishCompMatch()
        }
      } else if (sc === 'comp-result') {
        break // 予選敗退 or 突破でこのシーズンの予選は終了
      } else { g().go('weekly') }
    }
    if (playerWins >= 1) { firstRoundWins++; reachedR2++ }
    if (playerWins >= 2) reachedR3plus++
  }
}

const pct = (n: number) => `${(n / totalRuns * 100).toFixed(1)}%`
console.log(`=== year-1 夏季県予選 勝ち上がり（創部直後の弱小チーム・既定プレイ・${totalRuns}回）===`)
console.log(`  初戦勝利(1回戦突破): ${pct(reachedR2)}`)
console.log(`  2回戦も突破:         ${pct(reachedR3plus)}`)
console.log(reachedR2 / totalRuns >= 0.5
  ? '  → 初戦勝率50%以上：創部直後でも「初戦が勝てない悲しさ」は回避できている ✅'
  : '  ⚠ 初戦勝率が50%未満：弱敵rampをさらに緩める検討が必要')
