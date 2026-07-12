// G-45 文化祭のバランス計測（合否ではなく実測レポート）
// ① festival_help の成長量分布（300シード）— 旧6日モードの期待値≈+10.5 との比較
// ② 同一シードで「手伝わせる vs 練習優先」を年末まで走らせたA/B比較 — 選択の重みが適正か
// ③ 新旧の固定効果（雰囲気・疲労）の設計値比較
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'
import type { CareerState } from '../src/career/types'

const g = () => useCareer.getState()
const sumAb = (r: CareerState['roster']) => r.filter((p) => !p.retired)
  .reduce((s, p) => s + Object.values(p.abilities).reduce((a, b) => a + b, 0) + (p.gk?.saving ?? 0), 0)

// ============ ① festival_help の成長量分布 ============
{
  const deltas: number[] = []
  let noPrep = 0
  for (let seed = 1; seed <= 300; seed++) {
    g().debugStartFestival(seed)
    // week26起動 → week28 まで週送り（途中週の選択イベントは既定＝第1候補で解決）
    let guard = 0
    while (g().career!.week < 28 && guard++ < 10) {
      const head = g().career!.pendingEvents[0]
      if (head?.kind === 'choice' && head.options?.[0]) { g().resolveEvent(head.options[0].effectId); continue }
      g().advance()
      if (g().growthResult) g().dismissGrowth()
    }
    const c = g().career!
    if (!c.pendingEvents[0]?.id.startsWith('festival-prep')) { noPrep++; continue }
    const before = sumAb(c.roster)
    g().resolveEvent('festival_help')
    deltas.push(sumAb(g().career!.roster) - before)
  }
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
  const hist = new Map<number, number>()
  for (const d of deltas) hist.set(d, (hist.get(d) ?? 0) + 1)
  console.log(`=== ① festival_help の成長量（${deltas.length}シード実測） ===`)
  console.log(`  平均 +${mean.toFixed(2)} / 最小 +${Math.min(...deltas)} / 最大 +${Math.max(...deltas)}（旧6日モードの期待値 ≈ +10.5）`)
  console.log('  分布: ' + [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([d, n]) => `+${d}:${n}件`).join(' '))
  if (noPrep > 0) console.log(`  ⚠ 準備イベントが先頭に出なかったシード: ${noPrep}件`)
}

// ============ ② 1年A/B（同一シード・手伝わせる vs 練習優先） ============
function runToYearEnd(seed: number, arm: 'festival_help' | 'festival_skip') {
  g().debugStartFestival(seed)
  let guard = 0
  while (g().career && !(g().career!.year >= 2 && g().career!.week >= 2) && guard++ < 900) {
    const s = g()
    if (s.growthResult) { s.dismissGrowth(); continue }
    const sc = s.screen
    if (sc === 'weekly') {
      const head = s.career!.pendingEvents[0]
      if (head?.kind === 'choice' && head.options?.[0]) {
        s.resolveEvent(head.id.startsWith('festival-prep') ? arm : head.options[0].effectId)
        continue
      }
      s.advance()
    } else if (sc === 'camp') {
      if (s.campStage === 'choice') {
        const camp = s.career!.activeCamp!
        const lastDay = camp.shown[camp.shown.length - 1]
        const opt = lastDay.events[lastDay.events.length - 1].choice?.options[0]
        if (opt) { s.resolveCampChoice(opt.effectId); continue }
      }
      s.nextCampStep()
    } else if (sc === 'comp-bracket') {
      if (playerMatchIndex(s.comp!.tournament) >= 0) s.startCompMatch()
      else s.continueAfterComp()
    } else if (sc === 'comp-match') {
      if (!s.comp!.matchResult) s.resumeCompMatch(); else s.finishCompMatch()
    } else if (sc === 'comp-result') {
      s.continueAfterComp()
    } else if (sc === 'summary') {
      s.dismissSummary()
    } else if (sc === 'intake') {
      s.finishIntake()
    } else if (sc === 'new-captain') {
      const cand = s.career!.roster.find((p) => !p.retired && p.grade < 3)
      if (cand) s.pickInitialCaptain(cand.id)
    } else if (sc === 'selection') {
      const ids = (s.career!.pendingApplicants ?? []).slice(0, 8).map((a: { id: string }) => a.id)
      s.confirmSelection(ids)
    } else { g().go('weekly') }
  }
  const c = g().career!
  const active = c.roster.filter((p) => !p.retired)
  return {
    ab: sumAb(c.roster),
    atmo: c.atmosphere,
    rep: c.reputation,
    avgFat: active.reduce((s2, p) => s2 + p.fatigue, 0) / Math.max(1, active.length),
  }
}
console.log('\n=== ② 年末A/B（同一シード・週27→翌年週2まで走行） ===')
for (const seed of [3, 7, 13]) {
  const A = runToYearEnd(seed, 'festival_help')
  const B = runToYearEnd(seed, 'festival_skip')
  console.log(`  seed${seed}: 能力合計 手伝う=${A.ab} 練習優先=${B.ab}（差 ${A.ab - B.ab >= 0 ? '+' : ''}${A.ab - B.ab}） / 雰囲気 ${A.atmo.toFixed(1)} vs ${B.atmo.toFixed(1)} / 評判 ${A.rep} vs ${B.rep} / 平均疲労 ${A.avgFat.toFixed(1)} vs ${B.avgFat.toFixed(1)}`)
}

// ============ ③ 設計値の新旧比較 ============
console.log('\n=== ③ 固定効果の新旧比較（設計値） ===')
console.log('  旧6日サブモード:  成長≈+10.5 / 雰囲気+6 / 全員疲労+15（選択肢なし・強制参加）')
console.log('  新・手伝わせる:   成長=①の実測 / 雰囲気+5（選択+3・当日+2） / 全員疲労+6')
console.log('  新・練習優先:     成長+0 / 雰囲気+3（選択+1・当日+2） / 全員疲労-2')
console.log('  恋愛イベント:     件数分布(20/50/25/5%)・告白6:4・成否7:3・効果とも新旧同一（festival-test①で分布検証済）')
