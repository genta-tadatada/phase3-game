// G-45 文化祭（単発イベント形式）の検証
// ① generateFestivalWeek 単体: 決定論・恋愛0-3件の分布・💘/💔効果（彼女/IQ/疲労/調子）の正確な反映
// ② 統合: ?festival 相当（debugStartFestival→週送り2回・week26起動）で week28 に準備選択が先頭に出ること
// ③ festival_help 選択で 5人の能力+1〜+3・雰囲気+3・全員疲労+6 が反映されること
// ④ 長期走行: 文化祭が毎年1回発火・G-39（💑/🍀/💔）とマネージャー機能が生きていること
import { useCareer } from '../src/store/careerStore'
import { generateFestivalWeek } from '../src/career/events'
import { createCareer } from '../src/career/init'
import { createRNG, hashSeed } from '../src/engine/rng'
import { playerMatchIndex } from '../src/lib/tournament'
import type { CareerState, WeekEvent } from '../src/career/types'

const g = () => useCareer.getState()
let fails = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'OK' : 'NG'} ${label}${detail ? `（${detail}）` : ''}`)
  if (!ok) fails++
}

// ============ ① 単体: generateFestivalWeek ============
console.log('=== ① generateFestivalWeek 単体（決定論・分布・効果） ===')
{
  // 決定論: 同シード2回で完全一致
  const mk = (seed: number) => {
    const c = createCareer('検証高校', '東京都', undefined, 'expert', seed)
    const st: CareerState = { ...c, week: 27 }
    return generateFestivalWeek(st, createRNG(hashSeed(`fest-${seed}`)))
  }
  const r1 = mk(5)
  const r2 = mk(5)
  check('同シード2回で同一イベント列', JSON.stringify(r1.events) === JSON.stringify(r2.events))

  // 分布と効果: 400シードで恋愛件数を集計し、💘/💔の効果をロースター反映で厳密検証
  const counts = [0, 0, 0, 0]
  let effectsOk = true
  let effectDetail = ''
  for (let seed = 1; seed <= 400; seed++) {
    const c = createCareer('検証高校', '東京都', undefined, 'expert', seed)
    const st: CareerState = { ...c, week: 27 }
    const fest = generateFestivalWeek(st, createRNG(hashSeed(`fest-${seed}`)))
    const loves = fest.events.filter((e) => e.id.startsWith('festival-love'))
    counts[loves.length]++
    // 構造: 先頭=準備choice・2件目=当日flavor
    if (!(fest.events[0].kind === 'choice' && fest.events[0].id.startsWith('festival-prep'))) { effectsOk = false; effectDetail = `seed${seed}: 先頭がchoiceでない`; break }
    if (!(fest.events[1].id.startsWith('festival-day'))) { effectsOk = false; effectDetail = `seed${seed}: 2件目が当日でない`; break }
    const patched = fest.rosterPatch(st.roster)
    for (const love of loves) {
      const target = st.roster.find((p) => love.body.startsWith(`${p.name}が`))
      if (!target) { effectsOk = false; effectDetail = `seed${seed}: 恋愛イベントの対象者が特定できない`; break }
      const after = patched.find((p) => p.id === target.id)!
      if (love.title.includes('💘')) {
        const wantIq = Math.min(99, target.abilities.iq + 1)
        const wantFatigue = Math.max(0, target.fatigue - 5)
        if (!(after.hasGirlfriend === true && after.abilities.iq === wantIq && after.fatigue === wantFatigue)) {
          effectsOk = false; effectDetail = `seed${seed}: 💘効果が不正（${target.name}）`; break
        }
      } else {
        const wantCond = Math.max(1, target.condition - 1)
        if (!(after.condition === wantCond && !after.hasGirlfriend)) {
          effectsOk = false; effectDetail = `seed${seed}: 💔効果が不正（${target.name}）`; break
        }
      }
    }
    if (!effectsOk) break
  }
  check('イベント構造（準備choice→当日→恋愛）と効果反映', effectsOk, effectDetail)
  console.log(`  恋愛件数の分布（400シード・期待 20/50/25/5%）: 0件=${counts[0]} 1件=${counts[1]} 2件=${counts[2]} 3件=${counts[3]}`)
  check('分布が期待形（1件が最多・3件も発生）', counts[1] > counts[0] && counts[1] > counts[2] && counts[2] > counts[3] && counts[3] > 0)
}

// ============ ② 統合: debugStartFestival → 週送り2回で week28 ============
console.log('\n=== ② 統合（?festival 相当: week26起動→週送り2回） ===')
function bootAndEnterFestival(seed: number): CareerState {
  g().debugStartFestival(seed)
  if (g().career!.week !== 26) throw new Error('boot週が26でない')
  // week28 に入るまで週送り（途中週の選択イベントは既定＝第1候補で解決）
  let guard = 0
  while (g().career!.week < 28 && guard++ < 10) {
    const head = g().career!.pendingEvents[0]
    if (head?.kind === 'choice' && head.options?.[0]) { g().resolveEvent(head.options[0].effectId); continue }
    g().advance()
    if (g().growthResult) g().dismissGrowth()
  }
  return g().career!
}
{
  const c = bootAndEnterFestival(7)
  check('週送り2回で week28 に入る', c.week === 28, `week=${c.week}`)
  const ev = c.pendingEvents
  check('先頭が準備の選択イベント', ev[0]?.kind === 'choice' && ev[0].id.startsWith('festival-prep'), ev[0]?.title ?? 'なし')
  check('選択肢＝手伝わせる/練習優先', ev[0]?.options?.map((o) => o.effectId).join(',') === 'festival_help,festival_skip')
  check('2件目が文化祭当日', ev[1]?.id.startsWith('festival-day') ?? false)
  const loves = ev.filter((e) => e.id.startsWith('festival-love'))
  console.log(`  恋の噂: ${loves.length}件（${loves.map((e) => e.title).join(' / ') || 'なし'}）`)
  // 決定論: 同シードで再実行し pendingEvents が一致
  const again = bootAndEnterFestival(7)
  check('同シード再実行で同一結果（決定論）', JSON.stringify(again.pendingEvents) === JSON.stringify(ev))
}

// ============ ③ festival_help の効果反映 ============
console.log('\n=== ③ 準備を手伝わせる（festival_help）の効果 ===')
{
  const before = bootAndEnterFestival(11)
  const sumAb = (r: CareerState['roster']) => r.reduce((s, p) => s + Object.values(p.abilities).reduce((a, b) => a + b, 0) + (p.gk?.saving ?? 0), 0)
  const abBefore = sumAb(before.roster)
  const fatBefore = before.roster.reduce((s, p) => s + p.fatigue, 0)
  const atmoBefore = before.atmosphere
  g().resolveEvent('festival_help')
  const after = g().career!
  check('結果イベントが先頭に入る', after.pendingEvents[0]?.title.includes('結果') ?? false, after.pendingEvents[0]?.title ?? 'なし')
  const abDelta = sumAb(after.roster) - abBefore
  check('能力合計が +5〜+15 伸びる（5人×+1〜+3）', abDelta >= 5 && abDelta <= 15, `+${abDelta}`)
  check('雰囲気 +3', after.atmosphere === Math.min(100, atmoBefore + 3), `${atmoBefore}→${after.atmosphere}`)
  const fatDelta = after.roster.reduce((s, p) => s + p.fatigue, 0) - fatBefore
  check('全員の疲労が増える（+6×人数相当）', fatDelta > 0 && fatDelta <= 6 * after.roster.length, `+${fatDelta}`)
}

// ============ ④ 長期走行: 毎年発火・G-39/マネージャー生存確認 ============
console.log('\n=== ④ 長期走行（〜4年目）: 文化祭の年1発火・G-39・マネージャー ===')
{
  g().debugStartFestival(21)
  // 機構検証のための状態注入:
  //   評判60 → マネージャー加入条件（3年目以降+評判40）を満たす
  //   彼女持ち5人 → G-39 の💑フレーバー/💔破局の発火母数を確保
  {
    const c0 = g().career!
    const roster = c0.roster.map((p, i) => i < 5 ? { ...p, hasGirlfriend: true } : p)
    useCareer.setState({ career: { ...c0, reputation: 60, roster } })
  }
  const seen = new Set<string>()
  const titleCount = { prep: 0, love: 0, gfFlavor: 0, gfMeet: 0, gfBreak: 0, mgr: 0 }
  const scan = () => {
    for (const e of (g().career?.pendingEvents ?? []) as WeekEvent[]) {
      const key = `${g().career!.year}-${e.id}`
      if (seen.has(key)) continue
      seen.add(key)
      if (e.id.startsWith('festival-prep')) titleCount.prep++
      if (e.id.startsWith('festival-love')) titleCount.love++
      if (e.title.includes('💑')) titleCount.gfFlavor++
      if (e.title.includes('🍀')) titleCount.gfMeet++
      if (e.title.includes('ぎくしゃく')) titleCount.gfBreak++
      if (e.title.includes('マネ')) titleCount.mgr++
    }
  }
  let guard = 0
  while (g().career && g().career!.year < 4 && guard++ < 1500) {
    const s = g()
    if (s.growthResult) { s.dismissGrowth(); continue }
    const sc = s.screen
    if (sc === 'weekly') {
      // 先頭の選択イベントは既定（第1候補）で解決してから週送り
      const head = s.career!.pendingEvents[0]
      if (head?.kind === 'choice' && head.options?.[0]) { s.resolveEvent(head.options[0].effectId); scan(); continue }
      s.advance(); scan()
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
  const gfNow = g().career?.roster.filter((p) => !p.retired && p.hasGirlfriend).length ?? 0
  console.log(`  走行結果: year=${g().career?.year} week=${g().career?.week} guard=${guard}`)
  console.log(`  文化祭準備=${titleCount.prep}回 / 恋の噂=${titleCount.love}件 / 💑デート=${titleCount.gfFlavor} / 🍀出会い=${titleCount.gfMeet} / 💔破局=${titleCount.gfBreak} / マネ関連=${titleCount.mgr} / 現在の彼女持ち=${gfNow}人`)
  check('文化祭が毎年1回発火（3年で3回）', titleCount.prep >= 3, `${titleCount.prep}回`)
  check('G-39 彼女システムが動作（💑/🍀/💔いずれか発火 or 彼女持ちが存在）', titleCount.gfFlavor + titleCount.gfMeet + titleCount.gfBreak > 0 || gfNow > 0)
  check('マネージャー機能が動作（3年目加入→マネ関連イベント or 在籍）', titleCount.mgr > 0 || g().career?.manager != null)
}

console.log(fails === 0 ? '\n✅ G-45 文化祭（単発イベント形式）: 全チェック通過 ✅' : `\n⚠ ${fails}件のNGあり — 上のログを確認`)
if (fails > 0) process.exitCode = 1
