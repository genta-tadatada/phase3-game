// 入部セレクション機能の回帰テスト（2026-07-07 新設・同日仕様変更を反映）
//   ①発火条件（selectionEnabled ON + 評判50以上）で年度替わりに selection 画面が出る
//   ②応募者数＝合格枠（×1.6水増しは撤廃）・学年枠（寮容量の1/3）以内
//   ③最低人数(min(10,応募数))未満の選抜は store が拒否する（画面に留まる）
//   ④最低人数以上なら確定でき、合格者が入部する（intake へ）
//   ⑤セレクションOFF（既定）では selection 画面は一度も出ない
//   ⑥応募者の数・顔ぶれはセレクションの有無で変わらない（同シードON/OFF比較）
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'

const g = () => useCareer.getState()
let fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail++
}

// 汎用ドライバ: selection 画面に到達するか、指定年数を回しきるまで進める
function runUntilSelection(years: number): boolean {
  let a = 0
  while (g().career && g().career!.year <= years && a++ < 20000) {
    const s = g(), sc = s.screen, c = s.career!
    if (sc === 'selection') return true
    if (s.growthResult) { s.dismissGrowth(); continue }
    if (sc === 'camp') { let gg = 0; while (g().screen === 'camp' && gg++ < 80) { const cs = g(); if (cs.campStage === 'choice') { const cp = cs.career!.activeCamp!; const ld = cp.shown[cp.shown.length - 1]; const o = ld.events[ld.events.length - 1].choice?.options[0]; if (o) cs.resolveCampChoice(o.effectId); else cs.nextCampStep() } else cs.nextCampStep() } continue }
    if (sc === 'weekly') {
      const head = c.pendingEvents[0]
      if (head?.kind === 'choice' && head.options?.[0]) { s.resolveEvent(head.options[0].effectId); continue }
      s.advance()
    } else if (sc === 'summary') s.dismissSummary()
    else if (sc === 'intake') s.finishIntake()
    else if (sc === 'new-captain') { const cand = c.roster.find((p) => !p.retired); if (cand) s.pickInitialCaptain(cand.id) }
    else if (sc === 'comp-bracket') { if (playerMatchIndex(s.comp!.tournament) >= 0) s.startCompMatch(); else s.continueAfterComp() }
    else if (sc === 'comp-match') { if (!s.comp!.matchResult) s.resumeCompMatch(); else s.finishCompMatch() }
    else if (sc === 'comp-result') s.continueAfterComp()
    else s.go('weekly')
  }
  return false
}

console.log('=== ① 発火条件: ON + 評判50 で selection 画面が出る ===')
g().newCareer('選抜検証', '東京都')
// 発火条件を直接満たす（トグルON・評判60）
useCareer.setState({ career: { ...g().career!, selectionEnabled: true, reputation: 60 } })
const fired = runUntilSelection(3)
check('selection 画面に到達', fired, `screen=${g().screen}`)

if (fired) {
  const c = g().career!
  const pool = c.pendingApplicants ?? []
  const cap = c.admitCap ?? 0
  const minReq = Math.min(10, cap, pool.length)
  console.log(`  応募者=${pool.length}人 / 合格枠=${cap}人 / 最低=${minReq}人`)

  console.log('=== ② 応募者数＝合格枠・学年枠以内（水増しなし） ===')
  const dormLv = Math.max(1, Math.min(5, c.facilities.dorm))
  const gradeCap = Math.floor([0, 24, 33, 42, 51, 60][dormLv] / 3)
  check('応募者数 === 合格枠', pool.length === cap, `応募${pool.length}/枠${cap}`)
  check('応募者数 <= 学年枠(寮容量の1/3)', pool.length <= gradeCap, `学年枠=${gradeCap}`)
  check('合格枠 >= 最低人数', cap >= minReq)

  console.log('=== ③ 最低人数未満は拒否される ===')
  const before = c.roster.length
  g().confirmSelection(pool.slice(0, Math.max(0, minReq - 1)).map((p) => p.id))
  check('画面が selection のまま', g().screen === 'selection', `screen=${g().screen}`)
  check('roster が変わっていない', g().career!.roster.length === before)
  check('応募者プールが残っている', (g().career!.pendingApplicants ?? []).length === pool.length)

  console.log('=== ④ 最低人数ちょうどなら確定できる ===')
  g().confirmSelection(pool.slice(0, minReq).map((p) => p.id))
  const after = g().career!
  check('selection を抜けた', g().screen !== 'selection', `screen=${g().screen}`)
  check('プールがクリアされた', after.pendingApplicants === undefined)
  check(`合格${minReq}人が入部待ちに入った`, (after.pendingIntake ?? []).length >= minReq, `pendingIntake=${(after.pendingIntake ?? []).length}`)
}

console.log('=== ⑤ セレクションOFF（既定）では画面が出ない ===')
g().newCareer('既定検証', '鳥取県')
const firedOff = runUntilSelection(3)
check('3年間 selection 画面ゼロ', !firedOff, `screen=${g().screen}`)

console.log('=== ⑥ 応募者はセレクションの有無で増減しない（同シードON/OFF比較） ===')
g().debugStartSelection(20260707)
const onFired = runUntilSelection(2)
const onNames = onFired ? (g().career!.pendingApplicants ?? []).map((p) => p.name) : []
check('ON側で selection 到達', onFired, `screen=${g().screen}`)
g().debugStartSelection(20260707)
useCareer.setState({ career: { ...g().career!, selectionEnabled: false } })
runUntilSelection(1) // 年度替わり直後（year=2）でループが抜ける＝2度目の入部が混ざる前に計測
const offJoin = g().career!.roster.filter((p) => p.grade === 1 && p.joinedYear === 2).map((p) => p.name)
check('ON応募者数 === OFF入部数', onNames.length === offJoin.length, `ON=${onNames.length}人 OFF=${offJoin.length}人`)
check('顔ぶれも同一', JSON.stringify([...onNames].sort()) === JSON.stringify([...offJoin].sort()))

console.log(fail === 0 ? '\n✅ selection-test 全チェック合格' : `\n❌ ${fail}件失敗`)
if (fail > 0) process.exit(1)
