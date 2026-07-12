// 夏合宿(7日サブモード・#34)の動作検証：週20の合宿到達→7日進行→スキル開花/効果を確認。
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'
const g = () => useCareer.getState()

function stepCamp() {
  let guard = 0
  const days: { day: number; tags: string[] }[] = []
  while (g().screen === 'camp' && guard++ < 80) {
    const st = g()
    if (st.campStage === 'choice') {
      // 監督の選択：最初の選択肢を選ぶ
      const camp = st.career!.activeCamp!
      const lastDay = camp.shown[camp.shown.length - 1]
      const choiceEv = lastDay.events[lastDay.events.length - 1]
      const opt = choiceEv.choice?.options[0]
      if (opt) st.resolveCampChoice(opt.effectId); else st.nextCampStep()
      continue
    }
    const before = st.career!.activeCamp!.shown.length
    st.nextCampStep()
    const after = g().career?.activeCamp
    if (after && after.shown.length > before) {
      const d = after.shown[after.shown.length - 1]
      days.push({ day: d.day, tags: d.events.map((e) => e.tag) })
    }
  }
  return days
}

function runToCamp(seed: number) {
  g().newCareer('検', '東京都', 'M' + seed)
  let a = 0
  let campSeen = 0
  const campReports: { year: number; days: any[]; skills: number; skillTarget: number }[] = []
  while (g().career && g().career!.year <= 6 && a < 40000) {
    a++
    const s = g(), sc = s.screen
    if (sc === 'weekly') {
      const c = s.career!
      // 簡易・標準育成
      s.autoAssignPositions(); s.setWeekend(c.week % 2 === 0 ? 'practice-match' : 'rest')
      try { s.upgrade('ground'); s.upgrade('training') } catch { /* noop */ }
      s.advance()
      // 成長結果が出ていれば閉じる（合宿前にも出る）
      if (g().growthResult) g().dismissGrowth()
    } else if (sc === 'camp') {
      const campBefore = g().career!.activeCamp!
      const target = campBefore.skillTarget
      const skillsBeforeRoster = g().career!.roster.reduce((n, p) => n + (p.skills?.length ?? 0), 0)
      const days = stepCamp()
      const skillsAfterRoster = g().career!.roster.reduce((n, p) => n + (p.skills?.length ?? 0), 0)
      campReports.push({ year: g().career!.year, days, skills: skillsAfterRoster - skillsBeforeRoster, skillTarget: target })
      campSeen++
      if (campSeen >= 4) break
    } else if (sc === 'summary') { s.dismissSummary(); if (g().growthResult) g().dismissGrowth() }
    else if (sc === 'comp-bracket') { if (playerMatchIndex(s.comp!.tournament) >= 0) s.startCompMatch(); else s.continueAfterComp() }
    else if (sc === 'comp-match') { if (!s.comp!.matchResult) s.resumeCompMatch(); else s.finishCompMatch() }
    else if (sc === 'comp-result') { s.continueAfterComp() }
    else if (sc === 'intake') { s.finishIntake() }
    else { s.go('weekly') }
    if (g().growthResult) g().dismissGrowth()
  }
  return campReports
}

console.log('=== 夏合宿 動作検証（seed別の毎年の合宿） ===')
let totalSkills = 0, totalCamps = 0
const dist: Record<number, number> = {}
for (let seed = 0; seed < 12; seed++) {
  const reps = runToCamp(seed)
  for (const r of reps) {
    totalSkills += r.skills; totalCamps++
    dist[r.skills] = (dist[r.skills] ?? 0) + 1
    if (seed < 3) console.log(`seed${seed} ${r.year}年目: 開花${r.skills}個(狙い${r.skillTarget}) / ${r.days.length}日 [${r.days.map((d: any) => d.day + ':' + d.tags.join('')).join(' ')}]`)
  }
}
console.log(`\n合宿回数=${totalCamps} 総開花=${totalSkills} 平均=${(totalSkills / totalCamps).toFixed(2)}個/合宿`)
console.log('開花数の分布:', Object.entries(dist).sort((a, b) => +a[0] - +b[0]).map(([k, v]) => `${k}個:${v}`).join('  '))
// 7日すべて解決され screen が weekly に戻ること＝stateリークなし
console.log('最終screen:', g().screen, '/ activeCamp:', g().career?.activeCamp ? 'のこってる(NG)' : 'クリア済(OK)')
