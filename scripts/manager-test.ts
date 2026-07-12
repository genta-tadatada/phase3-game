// G-32/G-39/#42 マネージャー・彼女システムの実動作検証
//   「コード無変更＝動く」の思い込みを排し、無変更部も実際に発火・効果反映まで確認する。
// ① G-32 マネージャー恋愛: 成立/条件ゲート/継続/破局を generateWeeklyFlavor 単体で発火率と効果まで検証
// ② マネージャー業6種（風邪/体調気付き/スポドリ/用具整理/お菓子/写真）を generateManagerWeekEvent 単体で検証
// ③ G-39 彼女システム: 💑継続/💔破局/🍀出会い の発火率と効果（unit）
// ④ engine/store 統合: 恋愛成立・破局・風邪週・毎週の疲労-3（受動効果）が実ゲーム状態に反映されること
// ⑤ 二股防止（2026-07-07修正の回帰）: G-32は彼女持ちを選ばない・文化祭はマネ交際相手を選ばない
import { useCareer } from '../src/store/careerStore'
import { createCareer } from '../src/career/init'
import { createRNG, hashSeed } from '../src/engine/rng'
import { generateWeeklyFlavor, generateManagerWeekEvent, generateFestivalWeek } from '../src/career/events'
import { MANAGER_FATIGUE_RELIEF, type Manager, type ManagerEventState } from '../src/career/manager'
import { regressAtmosphere } from '../src/career/atmosphere'
import { phaseForWeek } from '../src/career/calendar'
import type { CareerState, WeeklyPlan } from '../src/career/types'

const g = () => useCareer.getState()
let fails = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'OK' : 'NG'} ${label}${detail ? `（${detail}）` : ''}`)
  if (!ok) fails++
}

const PLAN: WeeklyPlan = { lanes: [{ menuId: 'basic' }, { menuId: 'basic' }, { menuId: 'basic' }], assign: {}, weekend: 'rest', managerAction: null, meetingTarget: null }
const CANDIDATE_PERSONALITIES = ['leader', 'hardworker', 'genius', 'fighter', 'moodmaker']

const base = createCareer('検証高校', '東京都', undefined, 'expert', 1)
const mkMgr = (over: Partial<Manager> = {}): Manager => ({ name: '結城美咲', trait: 'caring', joinedYear: 2, ...over })
// 恋愛成立の条件が揃った状態（3年目・week5・部室Lv3・マネ在籍2年目・未交際）
const mkSt = (over: Partial<CareerState> = {}): CareerState => ({
  ...base, year: 3, week: 5,
  manager: mkMgr(),
  facilities: { ...base.facilities, clubhouse: 3 },
  ...over,
})

// ============ ① G-32 マネージャー恋愛（unit） ============
console.log('=== ① G-32 マネージャー恋愛（generateWeeklyFlavor 単体） ===')
{
  const candidates = base.roster.filter((p) => !p.retired && (p.squad ?? 'A') === 'A' && CANDIDATE_PERSONALITIES.includes(p.personality as string))
  check('候補選手（対象性格×Aチーム）が存在する', candidates.length > 0, `${candidates.length}人`)

  // 成立（week5・15%/年）: 発火率と効果（dating設定・IQ+1・雰囲気+1・本文に相手名）
  let fires = 0
  let bad = ''
  for (let i = 1; i <= 2000; i++) {
    const st = mkSt()
    const res = generateWeeklyFlavor(st, PLAN, createRNG(hashSeed(`love-${i}`)))
    if (!res.event?.id.startsWith('mgr-love')) continue
    fires++
    if (bad) continue
    const mgr2 = res.managerPatch ? res.managerPatch(st.manager!) : st.manager!
    const target = st.roster.find((p) => p.id === mgr2.dating?.playerId)
    if (!target) { bad = `i=${i}: datingが設定されない`; continue }
    if (!CANDIDATE_PERSONALITIES.includes(target.personality as string) || (target.squad ?? 'A') !== 'A') { bad = `i=${i}: 相手が候補条件外（${target.personality}）`; continue }
    const after = res.rosterPatch!(st.roster).find((p) => p.id === target.id)!
    if (after.abilities.iq !== Math.min(99, target.abilities.iq + 1)) { bad = `i=${i}: IQ+1未反映`; continue }
    if (res.atmoDelta !== 1) { bad = `i=${i}: atmoDelta=${res.atmoDelta}`; continue }
    if (!res.event.body.includes(target.name)) { bad = `i=${i}: 本文に相手名がない`; continue }
  }
  check('成立が15%前後で発火する', fires >= 240 && fires <= 360, `2000回中${fires}回=${(fires / 20).toFixed(1)}%`)
  check('成立時の効果（dating設定・候補条件・IQ+1・雰囲気+1・本文）', bad === '', bad)

  // 条件ゲート: 満たさないと絶対に発火しない
  const noFire = (label: string, st: CareerState) => {
    let n = 0
    for (let i = 1; i <= 1500; i++) {
      if (generateWeeklyFlavor(st, PLAN, createRNG(hashSeed(`${label}-${i}`))).event?.id.startsWith('mgr-love')) n++
    }
    check(`ゲート: ${label} では成立しない`, n === 0, n > 0 ? `${n}回発火` : '')
  }
  noFire('部室Lv2', mkSt({ facilities: { ...base.facilities, clubhouse: 2 } }))
  noFire('マネ加入初年度', mkSt({ manager: mkMgr({ joinedYear: 3 }) }))
  noFire('交際中の再成立', mkSt({ manager: mkMgr({ dating: { playerId: base.roster[0].id, startYear: 2 } }) }))
  noFire('week5以外', mkSt({ week: 7 }))
  noFire('全員彼女持ち', mkSt({ roster: base.roster.map((p) => ({ ...p, hasGirlfriend: true })) }))

  // 二股防止（2026-07-07修正）: 候補のうち1人だけ彼女なしにすると、成立相手は必ずその選手になる
  {
    const free = candidates[0]
    const gfRoster = base.roster.map((p) => (p.id === free.id ? p : { ...p, hasGirlfriend: true }))
    let picks = 0
    let badPick = ''
    for (let i = 1; i <= 2000; i++) {
      const st = mkSt({ roster: gfRoster })
      const res = generateWeeklyFlavor(st, PLAN, createRNG(hashSeed(`pick-${i}`)))
      if (!res.event?.id.startsWith('mgr-love')) continue
      picks++
      const mgr2 = res.managerPatch!(st.manager!)
      if (mgr2.dating?.playerId !== free.id) { badPick = `i=${i}: 彼女持ちが選ばれた`; break }
    }
    check('彼女持ちは候補から除外される（残る1人だけが常に相手）', picks > 0 && badPick === '', badPick || `${picks}回とも彼女なしの選手`)
  }

  // 継続フレーバー（交際中・0.04×eventMult）
  let cont = 0
  let contBad = ''
  for (let i = 1; i <= 2000; i++) {
    const st = mkSt({ week: 7, manager: mkMgr({ dating: { playerId: base.roster[0].id, startYear: 2 } }) })
    const res = generateWeeklyFlavor(st, PLAN, createRNG(hashSeed(`cont-${i}`)))
    if (!res.event?.id.startsWith('mgr-flavor')) continue
    cont++
    if (res.atmoDelta !== 1) contBad = `i=${i}: atmoDelta=${res.atmoDelta}`
  }
  check('交際継続フレーバーが発火する（期待≈7.6%）', cont >= 100 && cont <= 210 && contBad === '', contBad || `2000回中${cont}回`)

  // 破局（week25・5%）: dating解消・雰囲気-2
  let brk = 0
  let brkBad = ''
  for (let i = 1; i <= 2000; i++) {
    const st = mkSt({ week: 25, manager: mkMgr({ dating: { playerId: base.roster[0].id, startYear: 2 } }) })
    const res = generateWeeklyFlavor(st, PLAN, createRNG(hashSeed(`brk-${i}`)))
    if (!res.event?.id.startsWith('mgr-breakup')) continue
    brk++
    if (brkBad) continue
    const mgr2 = res.managerPatch ? res.managerPatch(st.manager!) : st.manager!
    if (mgr2.dating !== undefined) brkBad = `i=${i}: 破局後もdatingが残る`
    else if (res.atmoDelta !== -2) brkBad = `i=${i}: atmoDelta=${res.atmoDelta}`
  }
  check('破局が発火し dating が解消される（期待≈4.6%）', brk >= 50 && brk <= 140 && brkBad === '', brkBad || `2000回中${brk}回`)
}

// ============ ② マネージャー業イベント6種（unit） ============
console.log('\n=== ② マネージャー業イベント6種（generateManagerWeekEvent 単体） ===')
{
  const emptyPlan = { cheerful: [] as number[], organized: [] as number[], analytical: [] as number[] }
  const mkEv = (over: Partial<ManagerEventState> = {}): ManagerEventState => ({ year: 3, plan: emptyPlan, caringFired: 0, coldUsed: false, absentWeek: undefined, ...over })

  // 🤧 風邪欠席: absentWeek到来で必ず発火・受動効果オフ・練習効率-15%・coldUsed更新
  {
    const st = mkSt({ week: 40 })
    const res = generateManagerWeekEvent(st, mkEv({ absentWeek: 40 }), '晴れ', createRNG(hashSeed('cold-1')))
    check('🤧 風邪欠席: absentWeek到来で発火', res.event?.id.startsWith('mgr-cold') ?? false)
    check('🤧 受動効果オフ＋練習効率0.85＋coldUsed', res.skipPassive && res.practiceEffMult === 0.85 && res.counterPatch?.coldUsed === true)
  }
  // 💖 caring: 疲労70以上の選手に12%/週で気付き疲労-15・年4回上限
  {
    const tiredRoster = base.roster.map((p) => ({ ...p, fatigue: 80 }))
    let n = 0
    let bad = ''
    for (let i = 1; i <= 1000; i++) {
      const st = mkSt({ week: 10, roster: tiredRoster })
      const res = generateManagerWeekEvent(st, mkEv(), '雨', createRNG(hashSeed(`care-${i}`)))
      if (!res.event?.id.startsWith('mgr-care')) continue
      n++
      if (bad) continue
      const patched = res.rosterPatch!(tiredRoster)
      const healed = patched.filter((p, idx) => p.fatigue !== tiredRoster[idx].fatigue)
      if (!(healed.length === 1 && healed[0].fatigue === 65)) bad = `i=${i}: 疲労-15が不正`
      else if (res.counterPatch?.caringFired !== 1) bad = `i=${i}: caringFired未更新`
    }
    check('💖 体調気付き: 12%前後で発火し対象1人の疲労-15', n >= 80 && n <= 170 && bad === '', bad || `1000回中${n}回`)
    let capped = 0
    for (let i = 1; i <= 500; i++) {
      const st = mkSt({ week: 10, roster: tiredRoster })
      if (generateManagerWeekEvent(st, mkEv({ caringFired: 4 }), '雨', createRNG(hashSeed(`carecap-${i}`))).event?.id.startsWith('mgr-care')) capped++
    }
    check('💖 年4回上限で発火停止', capped === 0, capped > 0 ? `${capped}回発火` : '')
  }
  // 🥤 スポドリ: 週14-34×晴れ/猛暑×8%で全員疲労-5。雨では出ない
  {
    const tiredRoster = base.roster.map((p) => ({ ...p, fatigue: 80 }))
    let n = 0
    let bad = ''
    for (let i = 1; i <= 1000; i++) {
      const st = mkSt({ week: 20, roster: tiredRoster, manager: mkMgr({ trait: 'analytical' }) })
      const res = generateManagerWeekEvent(st, mkEv({ plan: { ...emptyPlan, analytical: [30] } }), '晴れ', createRNG(hashSeed(`drink-${i}`)))
      if (!res.event?.id.startsWith('mgr-drink')) continue
      n++
      if (bad) continue
      const patched = res.rosterPatch!(tiredRoster)
      if (!patched.every((p) => p.retired || p.fatigue === 75)) bad = `i=${i}: 全員疲労-5が不正`
    }
    check('🥤 スポドリ: 晴れの週14-34で8%前後・全員疲労-5', n >= 45 && n <= 125 && bad === '', bad || `1000回中${n}回`)
    let rainy = 0
    for (let i = 1; i <= 500; i++) {
      const st = mkSt({ week: 20, roster: tiredRoster, manager: mkMgr({ trait: 'analytical' }) })
      if (generateManagerWeekEvent(st, mkEv({ plan: { ...emptyPlan, analytical: [30] } }), '雨', createRNG(hashSeed(`rain-${i}`))).event) rainy++
    }
    check('🥤 雨の週は発火しない', rainy === 0, rainy > 0 ? `${rainy}回発火` : '')
  }
  // 🧹 organized: プラン週に必ず発火・練習効率+15%
  {
    const st = mkSt({ week: 20, manager: mkMgr({ trait: 'organized' }) })
    const res = generateManagerWeekEvent(st, mkEv({ plan: { ...emptyPlan, organized: [20] } }), '雨', createRNG(hashSeed('org-1')))
    check('🧹 用具整理: プラン週に発火し練習効率1.15', (res.event?.id.startsWith('mgr-tools') ?? false) && res.practiceEffMult === 1.15)
  }
  // 🍪 cheerful: 雰囲気+3・交際中は+5＋本文に相手名（G-32との連携）
  {
    const st1 = mkSt({ week: 20, manager: mkMgr({ trait: 'cheerful' }) })
    const r1 = generateManagerWeekEvent(st1, mkEv({ plan: { ...emptyPlan, cheerful: [20] } }), '雨', createRNG(hashSeed('swt-1')))
    check('🍪 お菓子差し入れ: プラン週に発火し雰囲気+3', (r1.event?.id.startsWith('mgr-sweets') ?? false) && r1.atmoDelta === 3)
    const partner = base.roster[0]
    const st2 = mkSt({ week: 20, manager: mkMgr({ trait: 'cheerful', dating: { playerId: partner.id, startYear: 2 } }) })
    const r2 = generateManagerWeekEvent(st2, mkEv({ plan: { ...emptyPlan, cheerful: [20] } }), '雨', createRNG(hashSeed('swt-2')))
    check('🍪 交際中は雰囲気+5＋本文に相手名（G-32連携）', r2.atmoDelta === 5 && (r2.event?.body.includes(partner.name) ?? false))
  }
  // 📷 analytical: プラン週に発火し3人の調子+1
  {
    const evenRoster = base.roster.map((p) => ({ ...p, condition: 3 as const }))
    const st = mkSt({ week: 20, roster: evenRoster, manager: mkMgr({ trait: 'analytical' }) })
    const res = generateManagerWeekEvent(st, mkEv({ plan: { ...emptyPlan, analytical: [20] } }), '雨', createRNG(hashSeed('photo-1')))
    const patched = res.rosterPatch ? res.rosterPatch(evenRoster) : evenRoster
    const upped = patched.filter((p, i) => p.condition !== evenRoster[i].condition)
    check('📷 写真: プラン週に発火し3人の調子+1', (res.event?.id.startsWith('mgr-photo') ?? false) && upped.length === 3 && upped.every((p) => p.condition === 4))
  }
}

// ============ ③ G-39 彼女システム（unit） ============
console.log('\n=== ③ G-39 彼女システム（💑継続/💔破局/🍀出会い） ===')
{
  // 彼女持ち5人を注入した状態で4000回抽選し、各分岐の発火と効果を検証
  const gfRoster = base.roster.map((p, i) => (i < 5 ? { ...p, hasGirlfriend: true } : p))
  const st: CareerState = { ...base, year: 3, week: 6, roster: gfRoster }
  let flav = 0
  let brk = 0
  let meet = 0
  let bad = ''
  for (let i = 1; i <= 4000; i++) {
    const res = generateWeeklyFlavor(st, PLAN, createRNG(hashSeed(`gf-${i}`)))
    const id = res.event?.id ?? ''
    if (id.startsWith('gf-breakup')) {
      brk++
      if (bad) continue
      const dater = gfRoster.find((p) => p.hasGirlfriend && res.event!.body.startsWith(p.name))
      if (!dater) { bad = `i=${i}: 💔対象不明`; continue }
      const after = res.rosterPatch!(gfRoster).find((p) => p.id === dater.id)!
      if (after.hasGirlfriend || after.condition !== Math.max(1, dater.condition - 1)) bad = `i=${i}: 💔効果（彼女解消・調子-1）が不正`
      else if (res.atmoDelta !== -2) bad = `i=${i}: 💔atmoDelta=${res.atmoDelta}`
    } else if (id.startsWith('gf-meet')) {
      meet++
      if (bad) continue
      const target = gfRoster.find((p) => !p.hasGirlfriend && res.event!.body.startsWith(p.name))
      if (!target) { bad = `i=${i}: 🍀対象不明`; continue }
      const after = res.rosterPatch!(gfRoster).find((p) => p.id === target.id)!
      if (!(after.hasGirlfriend && after.abilities.iq === Math.min(99, target.abilities.iq + 1) && after.fatigue === Math.max(0, target.fatigue - 5))) bad = `i=${i}: 🍀効果（彼女+IQ+1+疲労-5）が不正`
    } else if (id.startsWith('gf-')) {
      flav++
      if (!bad && res.atmoDelta !== 1) bad = `i=${i}: 💑atmoDelta=${res.atmoDelta}`
    }
  }
  console.log(`  4000回抽選: 💑デート=${flav}（期待≈304） / 💔破局=${brk}（期待≈11） / 🍀出会い=${meet}（期待≈22）`)
  check('💑 継続フレーバーが期待率で発火', flav >= 230 && flav <= 380)
  check('💔 破局が稀に発火', brk >= 3 && brk <= 25)
  check('🍀 出会いが稀に発火', meet >= 8 && meet <= 40)
  check('各分岐の効果（彼女解消/取得・IQ・疲労・調子・雰囲気）', bad === '', bad)
}

// ============ ④ engine/store 統合 ============
console.log('\n=== ④ engine/store 統合（実ゲーム状態への反映） ===')
const bootAt = (seed: number, week: number, mgr: Manager | undefined, extra: Partial<CareerState> = {}) => {
  g().debugStartFestival(seed)
  const c0 = g().career!
  useCareer.setState({
    career: {
      ...c0, week, phase: phaseForWeek(week), year: 3, pendingEvents: [],
      manager: mgr, managerEvents: undefined,
      facilities: { ...c0.facilities, clubhouse: 3 },
      ...extra,
    },
  })
}
const step = () => { g().advance(); if (g().growthResult) g().dismissGrowth() }
{
  // 恋愛成立が実ゲームで発火し、manager.dating がストアに保存される
  let fires = 0
  let bad = ''
  for (let seed = 1; seed <= 150; seed++) {
    bootAt(seed, 5, mkMgr())
    step()
    const c = g().career!
    const ev = c.pendingEvents.find((e) => e.id.startsWith('mgr-love'))
    if (!ev) continue
    fires++
    const target = c.roster.find((p) => p.id === c.manager?.dating?.playerId)
    if (!target) { bad = `seed${seed}: datingが保存されない`; break }
    if (!ev.body.includes(target.name)) { bad = `seed${seed}: イベント本文と相手が不一致`; break }
  }
  check(`恋愛成立がゲーム内発火し dating が保存される（150シード中${fires}回・期待≈22）`, fires >= 10 && fires <= 40 && bad === '', bad || `${fires}回`)

  // 破局が実ゲームで発火し、dating が解消される
  let brks = 0
  let brkBad = ''
  for (let seed = 1; seed <= 200; seed++) {
    g().debugStartFestival(seed)
    const c0 = g().career!
    const partner = c0.roster.find((p) => !p.retired && (p.squad ?? 'A') === 'A')!
    useCareer.setState({
      career: {
        ...c0, week: 25, phase: phaseForWeek(25), year: 3, pendingEvents: [],
        manager: mkMgr({ dating: { playerId: partner.id, startYear: 2 } }), managerEvents: undefined,
        facilities: { ...c0.facilities, clubhouse: 3 },
      },
    })
    step()
    const c = g().career!
    if (!c.pendingEvents.some((e) => e.id.startsWith('mgr-breakup'))) continue
    brks++
    if (c.manager?.dating) { brkBad = `seed${seed}: 破局後もdatingが残る`; break }
  }
  check(`破局がゲーム内発火し dating が解消される（200シード中${brks}回・期待≈9）`, brks >= 2 && brks <= 25 && brkBad === '', brkBad || `${brks}回`)

  // 風邪欠席週: イベント表示＋coldUsed更新（絶対発火なので1シードで十分）
  {
    bootAt(3, 5, mkMgr(), { managerEvents: { year: 3, plan: { cheerful: [], organized: [], analytical: [] }, caringFired: 0, coldUsed: false, absentWeek: 5 } })
    step()
    const c = g().career!
    check('風邪欠席がゲーム内発火する', c.pendingEvents.some((e) => e.id.startsWith('mgr-cold')))
    check('coldUsed カウンタがストアに反映される', c.managerEvents?.coldUsed === true)
  }

  // 受動効果: マネ在籍で毎週 疲労-3（同一シードのマネ有無を厳密比較）
  //   部室Lv1＋caring＝week5では恋愛/業イベントとも発火不能→乱数消費も一致し、差分は受動効果のみになる
  //   注意: 選手IDの接頭辞はプロセス全体の連番のため2回目の起動で変わる→配列位置で対応づける
  //   注意: boot直後は全員疲労0で-3が空振りになる→疲労40を注入して差を可視化する
  const bootPassive = (seed: number, mgr: Manager | undefined): CareerState => {
    g().debugStartFestival(seed)
    const c0 = g().career!
    useCareer.setState({
      career: {
        ...c0, week: 5, phase: phaseForWeek(5), year: 3, pendingEvents: [],
        manager: mgr, managerEvents: undefined,
        facilities: { ...c0.facilities, clubhouse: 1 },
        roster: c0.roster.map((p) => ({ ...p, fatigue: 40 })),
      },
    })
    step()
    return g().career!
  }
  let passOk = true
  let passDetail = ''
  for (const seed of [2, 5, 8, 11, 14]) {
    const withMgr = bootPassive(seed, mkMgr())
    const noMgr = bootPassive(seed, undefined)
    if (withMgr.roster.length !== noMgr.roster.length) { passOk = false; passDetail = `seed${seed}: 人数不一致`; break }
    for (let i = 0; i < noMgr.roster.length; i++) {
      const p = noMgr.roster[i]
      const q = withMgr.roster[i]
      if (q.fatigue !== Math.max(0, p.fatigue - MANAGER_FATIGUE_RELIEF)) {
        passOk = false
        passDetail = `seed${seed}: ${p.name} 疲労 ${p.fatigue}→${q.fatigue}（期待${Math.max(0, p.fatigue - MANAGER_FATIGUE_RELIEF)}）`
        break
      }
    }
    if (passOk && withMgr.atmosphere < noMgr.atmosphere) { passOk = false; passDetail = `seed${seed}: 雰囲気が底上げされていない` }
    if (!passOk) break
  }
  check('受動効果: マネ在籍で全選手の疲労-3（5シード×全選手で厳密一致）', passOk, passDetail)

  // MANAGER_ATMO_BONUS: 平衡点+2 が regressAtmosphere に効いている
  const members = base.roster.filter((p) => !p.retired && (p.squad ?? 'A') === 'A')
  const bonusWorks = [30, 50, 70].some((cur) => regressAtmosphere(cur, members, 0, 2) > regressAtmosphere(cur, members, 0, 0))
  check('受動効果: 雰囲気の平衡点+2が作用する', bonusWorks)
}

// ============ ⑤ 二股防止: 文化祭の恋愛抽選（2026-07-07修正の回帰） ============
console.log('\n=== ⑤ 二股防止: 文化祭の恋愛抽選からマネ交際相手を除外 ===')
{
  const partner = base.roster.find((p) => !p.retired && (p.squad ?? 'A') === 'A')!
  const st = mkSt({ week: 28, manager: mkMgr({ dating: { playerId: partner.id, startYear: 2 } }) })
  let touched = 0
  let loveTotal = 0
  for (let i = 1; i <= 600; i++) {
    const res = generateFestivalWeek(st, createRNG(hashSeed(`fest-${i}`)))
    loveTotal += res.events.filter((e) => e.id.startsWith('festival-love')).length
    const after = res.rosterPatch(st.roster).find((p) => p.id === partner.id)!
    if (after.hasGirlfriend || after.condition !== partner.condition) touched++
  }
  check('マネ交際相手は文化祭で恋愛対象にならない', touched === 0 && loveTotal > 0,
    touched > 0 ? `${touched}回被弾` : `恋愛イベント${loveTotal}件中0件が交際相手`)
}

console.log(fails === 0 ? '\n✅ マネージャー・彼女システム: 全チェック通過 ✅' : `\n⚠ ${fails}件のNGあり — 上のログを確認`)
if (fails > 0) process.exitCode = 1
