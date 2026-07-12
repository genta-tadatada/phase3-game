// ============================================================
// career/engine.ts — 週次進行と年度ロールオーバーのオーケストレーション
// 大会の対戦UIはストア側で処理（interruptで通知）。それ以外（育成・
// 疲労・雰囲気・卒業・入部・予算）はここで決定的に処理する。
// ============================================================

import type { Condition, Player } from '../engine/types'
import { createRNG, hashSeed } from '../engine/rng'
import { playerOverallSum, bestFieldPosition } from '../engine/match/teamQuality'
import type { CareerState, WeekEvent, WeeklyPlan } from './types'
import { WEEKS_PER_YEAR } from './types'
import { applyWeeklyTraining, applyRest, applyMatchExperience, staminaFatigueMult, type GrowthSummary, type WeekendMatchResult } from './growth'
import { regressAtmosphere } from './atmosphere'
import { phaseForWeek, triggerForWeek } from './calendar'
import { generateRecruit, INTAKE_POSITIONS } from './recruit'
import { grantStartingSkills } from './skillGrant'
import { generateCandidates, runRecruitment } from './scout'
import { settleAnnualBudget } from './economy'
import { hasStaff, coachGrowthMult, scoutSpBonus } from './facilities'
import { tickSponsors } from './sponsor'
import { generateManager, MANAGER_FATIGUE_RELIEF, MANAGER_ATMO_BONUS, MANAGER_TRAIT, initManagerEventState } from './manager'
import { reputationTier, reputationTierName, reputationTierUpMessage } from '../lib/labels'
import { assignJerseyNumbers } from './jersey'
import { featuresUnlockedAtWeek, featureUnlocked, UNLOCK_EVENT } from './unlocks'
import { processGraduation, graduationNarrative } from './graduation'
import { isProDestiny } from './types'
import { repGainDamping } from './competition'
import { generateWeeklyFlavor, generateManagerWeekEvent, generateFestivalWeek } from './events'
import { generateWeather, weatherTrainingMult, climateAdaptedTo, type Weather } from './weather'
import { applyPersonalityChanges } from './personalityChange'
import { redMarkRate, studyAptitude } from './personality'
import { autoAssignSquads, squadMembers, squadStrength, quickMatchResult } from './squad'
import { evaluateAwakening } from './awakening'

function rngFor(state: CareerState, salt: string): ReturnType<typeof createRNG> {
  return createRNG(hashSeed(`${state.rngSeed}-${state.year}-${state.week}-${salt}`))
}

export interface WeekOutcome {
  state: CareerState
  growthSummary: GrowthSummary | null
  newEvents: WeekEvent[]
  interrupt: 'summer-tournament' | 'winter-tournament' | 'summer-national' | 'winter-national' | 'camp' | null
  yearEnded: boolean
}

/** 練習試合の得点者を攻撃力重みで選ぶ（演出・決定論） */
function pickPracticeScorers(starters: Player[], goals: number, rng: ReturnType<typeof rngFor>): string[] {
  if (goals <= 0) return []
  const fps = starters.filter((p) => !p.isGK)
  if (fps.length === 0) return []
  const posW: Record<string, number> = { CF: 42, WF: 26, AM: 24, CM: 11, WB: 7, SB: 5, DM: 5, CB: 4 }
  const weighted = fps.map((p) => ({ p, w: p.abilities.kick * 0.4 + p.abilities.technique * 0.3 + (posW[p.position] ?? 5) }))
  const out: string[] = []
  for (let i = 0; i < goals; i++) {
    const tot = weighted.reduce((s, x) => s + x.w, 0)
    let r = rng.next() * tot
    let pick = weighted[0]
    for (const x of weighted) { r -= x.w; if (r <= 0) { pick = x; break } }
    out.push(pick.p.name)
  }
  return out
}

/** 週末枠の処理 */
function applyWeekend(roster: Player[], plan: WeeklyPlan, state: CareerState, weather?: Weather): { roster: Player[]; atmoDelta: number; weekendResult?: WeekendMatchResult } {
  switch (plan.weekend) {
    case 'rest': {
      // 完全休養: 疲労回復 + 調子が上向く（上限は「好調」=4）
      const rested = applyRest(roster, 25).map((p) => ({ ...p, condition: Math.min(4, p.condition + 1) as Condition }))
      return { roster: rested, atmoDelta: 1 }
    }
    case 'practice-match': {
      const rng = rngFor(state, 'pm')
      // 招集メンバー(A・引退除く)の先発11で対戦。相手の強さは事前選択(#22c)。
      const aMembers = roster.filter((p) => (p.squad ?? 'A') === 'A' && !p.retired)
      const starters = (aMembers.length >= 11 ? aMembers : roster.filter((p) => !p.retired)).slice(0, 11)
      const starterIds = new Set(starters.map((p) => p.id))
      const benchIds = new Set(aMembers.filter((p) => !starterIds.has(p.id)).map((p) => p.id))
      // #27: 相手の強さは現チームの総合力を基準にした「近い3段階」。両端をクランプし、
      //   最弱時でも格下が、最強時でも格上が必ず存在するようにする（旧固定±12の矛盾を解消）。
      //   ギャップは強いほど少し開く（強豪はより強い相手と当たる）が、あくまで近い範囲(8〜15)。
      const tier = plan.practiceOpponent ?? 'even'
      const aStr = squadStrength(starters)
      const PM_FLOOR = 14, PM_CEIL = 96
      const pmGap = Math.round(Math.max(8, Math.min(15, aStr * 0.16)))
      const evenStr = Math.max(PM_FLOOR, Math.min(PM_CEIL, aStr))
      const oppStr = tier === 'weak' ? Math.max(PM_FLOOR, evenStr - pmGap)
        : tier === 'strong' ? Math.min(PM_CEIL, evenStr + pmGap)
        : evenStr
      const r = quickMatchResult(aStr, oppStr, rngFor(state, 'pmr'))
      const won = r.a > r.b
      const lost = r.a < r.b
      const mark: WeekendMatchResult['mark'] = won ? '○' : lost ? '●' : '△'
      // 成長＝相手の強さ(刺激) × 結果(勝てば大きく/負ければ小さく)。
      //   格上に勝つ＝最良(×1.74)／格下に負ける＝最悪(×0.56)。「強敵と当たればいい」だけでなく勝利が重要。
      // 成長は相手の強さ(刺激)で決まる。勝敗は「能力成長」ではなく調子・雰囲気で効かせる（バランス保持）。
      const growMul = tier === 'weak' ? 0.7 : tier === 'strong' ? 1.45 : 1.0
      // 出場先発はフル(×growMul)で伸びる。ベンチも練習相手としてごく少し伸びる(×growMul×0.15)。
      let r2 = applyMatchExperience(roster, starterIds, state.facilities, state.atmosphere, rng, growMul)
      if (benchIds.size > 0) r2 = applyMatchExperience(r2, benchIds, state.facilities, state.atmosphere, rngFor(state, 'pmbench'), growMul * 0.15)
      // ★試合ならではの効果＝「試合勘＝調子」：出場した先発は勝てば調子+1／負ければ-1（勝利が大事）。
      //   控えは出ていないので調子は動かない＝選手を試合に出す価値・選手層の重要性が出る（練習は能力のみ）。
      //   疲労：先発+10／ベンチ+4（スタミナが高いほど疲れにくい）。
      const tired = r2.map((p) => {
        if (starterIds.has(p.id)) {
          const cond = Math.max(1, Math.min(5, p.condition + (won ? 1 : lost ? -1 : 0))) as typeof p.condition
          return { ...p, fatigue: Math.min(100, p.fatigue + Math.round(10 * staminaFatigueMult(p.abilities.stamina))), condition: cond }
        }
        if (benchIds.has(p.id)) return { ...p, fatigue: Math.min(100, p.fatigue + Math.round(4 * staminaFatigueMult(p.abilities.stamina))) }
        return p
      })
      const oppLabel = tier === 'weak' ? '格下校' : tier === 'strong' ? '格上校' : '互角校'
      const scorers = pickPracticeScorers(starters, r.a, rngFor(state, 'pms'))
      // 雰囲気：勝てば上がる／負ければ下がる（格上に善戦＝手応え、格下に負け＝情けない）。
      const atmoDelta = won ? (tier === 'strong' ? 4 : tier === 'weak' ? 1 : 2)
        : lost ? (tier === 'strong' ? 0 : tier === 'weak' ? -3 : -1)
        : (tier === 'strong' ? 2 : 0)
      return { roster: tired, atmoDelta, weekendResult: { label: `練習試合（${oppLabel}）`, score: `${r.a}-${r.b}`, mark, scorers } }
    }
    case 'extra-training': {
      // 追加練習 = 今週の割当をもう一度（成長＋・疲労＋・雰囲気-1）
      const rng = rngFor(state, 'extra')
      // 追加練習＝疲れた中の軽い追加セッション（成長0.6倍・疲労増・雰囲気-1）
      const { roster: r2 } = applyWeeklyTraining(roster, plan, state.facilities, state.atmosphere, rng, 1.0, state.atmosphereB ?? state.atmosphere, weather, 0.6, false, {}, state.staff)
      return { roster: r2, atmoDelta: -1 }
    }
    default:
      return { roster, atmoDelta: 0 }
  }
}

/** 1週間を進める */
export function advanceWeek(state: CareerState, plan: WeeklyPlan): WeekOutcome {
  const trainRng = rngFor(state, 'train')
  // 0. 天候（補完L）— 練習効率にのみ作用。体育館があれば悪天候デバフ無効
  // 天候機能が解放される（年1・week5の「天候の影響」イベント）までは晴れ固定。
  // F3: 解放週（state.weekがweather解放週ちょうど）は確定で雨にする＝解説イベント本文
  //     「ずっと晴れていたグラウンドに、初めての雨」と現象を一致させる。
  // それ以前は晴れ固定、解放後の週は通常抽選。
  const isWeatherUnlockWeek = featuresUnlockedAtWeek(state.year, state.week).includes('weather')
  const weather: Weather = isWeatherUnlockWeek
    ? '雨'
    : featureUnlocked('weather', state.year, state.week)
      ? generateWeather(state.week, state.prefecture, rngFor(state, 'weather'))
      : '晴れ'
  const hasGym = state.facilities.extras.includes('gym')
  // 出身地域がその天候を得意とするなら悪天候デバフ無効＋好調（地域の特色が育成に出る）
  const adapted = climateAdaptedTo(state.prefecture, weather)

  // === マネージャー専用ミニイベント（trait別4種+共通2種）の評価 ===
  //   1. 年初に発火プランがなければ初期化（マネ加入時 or 年度切替時）
  //   2. training より前に「今週の練習効率倍率／受動効果オフ」を確定させる必要があるため
  //      flavor より早いタイミングで実行する。
  let managerEvents = state.managerEvents
  if (state.manager && (!managerEvents || managerEvents.year !== state.year)) {
    const planRng = createRNG(hashSeed(`${state.rngSeed}-mgr-plan-${state.year}`))
    managerEvents = initManagerEventState(planRng, state.manager.trait, state.year)
  }
  const mgrWeek = (state.manager && managerEvents)
    ? generateManagerWeekEvent(state, managerEvents, weather, rngFor(state, 'mgr-event'))
    : { event: null, atmoDelta: 0, practiceEffMult: 1, skipPassive: false, rosterPatch: undefined as ((r: Player[]) => Player[]) | undefined, counterPatch: undefined as Partial<NonNullable<typeof managerEvents>> | undefined }

  // #29: コーチ陣（専属+12%・アシスタント+8%）で練習環境係数UP
  // マネージャー専用イベントで「練習効率±15%×1週」が発火した週はここで反映される。
  const weatherMult = weatherTrainingMult(weather, hasGym, adapted) * coachGrowthMult(state) * mgrWeek.practiceEffMult
  const atmoB = state.atmosphereB ?? state.atmosphere
  // #28: マンネリ判定。今週使うメニューの連続採用週数を更新（使わないメニューは0にリセット）。
  const usedMenuIds = new Set(plan.lanes.map((l) => l.menuId))
  const prevStreak = state.menuStreak ?? {}
  const menuStreak: Record<string, number> = {}
  for (const id of usedMenuIds) menuStreak[id] = (prevStreak[id] ?? 0) + 1
  // 5週目(>4)から成長効率↓（-5%/週・-15%上限）。別メニューに替えるとリセット。
  const mannerismMult: Record<string, number> = {}
  // #42 マネージャーがいるとマンネリ減衰がやわらぐ（練習サポートで飽きを抑える：floor 0.85→0.90・進行も緩やか）
  const mannEase = state.manager ? 0.5 : 1
  const mannFloor = state.manager ? 0.90 : 0.85
  for (const id of usedMenuIds) mannerismMult[id] = Math.max(mannFloor, 1 - Math.max(0, menuStreak[id] - 4) * 0.05 * mannEase)
  // 1. 練習スロット（天候で伸びる能力が変わる＝地域×天候で能力が差別化される）
  // #32: 体育館 or 地域適応のときは能力別の天候マイナスを軽減（weatherMitigated）
  // #31/G-14: 勉強優先を選んだ週は練習に割く時間が減る＝今週の成長を控えめに（＝練習続行を選ぶ意味＝成長を確保）。
  const examStudyWeek = !!state.pendingExam?.study && state.pendingExam.askedWeek === state.week
  const { roster: trained, summary } = applyWeeklyTraining(state.roster, plan, state.facilities, state.atmosphere, trainRng, weatherMult, atmoB, weather, examStudyWeek ? 0.6 : 1, hasGym || adapted, mannerismMult, state.staff)
  // 2. 週末枠（A戦）
  let { roster: afterWeekend, atmoDelta, weekendResult } = applyWeekend(trained, plan, state, weather)
  summary.weekend = weekendResult ?? null // 練習試合の結果を成長画面で表示(#22c)
  // 2.5 B/Cチームの練習試合（軽量・結果のみ・育成のため経験を付与）
  let bcLog: string | null = null
  if (plan.weekend === 'practice-match') {
    const bcIds = new Set(afterWeekend.filter((p) => (p.squad ?? 'A') !== 'A').map((p) => p.id))
    if (bcIds.size > 0) {
      afterWeekend = applyMatchExperience(afterWeekend, bcIds, state.facilities, atmoB, rngFor(state, 'bc'))
      const bStr = squadStrength(squadMembers(afterWeekend, 'B'))
      const oppStr = Math.max(18, bStr - 3 - rngFor(state, 'bcopp').next() * 6) // 格下校
      const r = quickMatchResult(bStr, oppStr, rngFor(state, 'bcr'))
      bcLog = `B戦(練習試合) ${r.a}-${r.b} ${r.a > r.b ? '○' : r.a < r.b ? '●' : '△'}`
    }
  }
  // 2.7 きつい練習（ランニング・スプリント・ウェイト・総合フィジカル・プレッシング・紅白戦）は「つらく楽しくない」＝雰囲気が下がりやすい。
  //     スタミナが疲労軽減で強くなりすぎる分の相殺。多くの部員を回すほどチームの空気が重くなる。
  const TOUGH_MENUS = new Set(['run', 'sprint', 'weight', 'physical-all', 'pressing', 'scrimmage'])
  const toughLaneSet = new Set<number>()
  plan.lanes.forEach((l, i) => { if (TOUGH_MENUS.has(l.menuId)) toughLaneSet.add(i) })
  if (toughLaneSet.size > 0) {
    const toughCount = state.roster.filter((p) => toughLaneSet.has(plan.assign[p.id])).length
    atmoDelta -= Math.min(4, Math.round(toughCount / 4)) // 4人ごとに-1・最大-4
  }
  // #28: マンネリ（5週超の同一メニュー）があるほどチームの空気がだれる（-2/週・最大-4）。
  const mannerismLanes = plan.lanes.filter((l) => (menuStreak[l.menuId] ?? 0) > 4).length
  if (mannerismLanes > 0) atmoDelta -= Math.min(4, mannerismLanes * 2) * mannEase // #42 マネージャーでだれを半減
  // 部室(clubhouse)：居心地が良いほどチームの雰囲気が上がりやすい（Lv1=0〜Lv5=+2/週）。
  atmoDelta += (state.facilities.clubhouse - 1) * 0.5
  // 育成系スキル（#34）：ムードメーカー在籍で空気が上向き／兄貴肌(最上級生)がチームを支える。
  const moodMakers = afterWeekend.filter((p) => !p.retired && p.skills?.includes('mood-maker')).length
  const mentors = afterWeekend.filter((p) => !p.retired && p.skills?.includes('mentor')).length
  atmoDelta += Math.min(2, moodMakers * 0.6) + Math.min(2.4, mentors * 0.8)
  // G-22-④: 3年最後の大会演出 発火後、week32-38 の冬大会期間中は3年生1人あたり雰囲気+1。
  //   仕様準拠の +1/週。3年生が多すぎても効きすぎないよう soft cap 5（=実質3年A招集5人で +5/週）。
  if (state.seniorBoostYear === state.year && state.week >= 32 && state.week <= 38) {
    const seniors = afterWeekend.filter((p) => !p.retired && p.grade === 3 && (p.squad ?? 'A') === 'A')
    atmoDelta += Math.min(5, seniors.length)
  }
  // G-08 + 2026-06-26: 下級生キャプテンのトレードオフ。
  //   基本ペナ：1年=-1.5、2年=-0.5、3年=なし。
  //   - leader 性格 or captaincy スキル持ち: ペナを半減（リーダー資質で違和感を軽減）
  //   - 闘将コンボ(captaincy×leader)持ち: ペナを反転して +0.5/+1.0（むしろ周囲を引っ張る）
  //   本人成長は growth.ts で ×1.20(1年)/×1.10(2年) を別途加算（重圧で大きく伸びる）。
  const captain = afterWeekend.find((p) => p.isCaptain && !p.retired)
  if (captain && (captain.grade === 1 || captain.grade === 2)) {
    const basePenalty = captain.grade === 1 ? -1.5 : -0.5
    const hasCaptaincy = !!captain.skills?.includes('captaincy')
    const isLeader = captain.personality === 'leader'
    const isToshow = hasCaptaincy && isLeader // 闘将コンボ(captaincy×leader)
    if (isToshow) atmoDelta += captain.grade === 1 ? 0.5 : 1.0     // 反転して+
    else if (isLeader || hasCaptaincy) atmoDelta += basePenalty * 0.5 // 半減
    else atmoDelta += basePenalty
  }
  // 3. 雰囲気の自然回帰（A=招集メンバー / B=育成メンバー それぞれ）
  const aMembers = afterWeekend.filter((p) => (p.squad ?? 'A') === 'A')
  const bMembers = afterWeekend.filter((p) => (p.squad ?? 'A') !== 'A')
  // マネージャー風邪欠席週は雰囲気底上げをオフ（受動効果停止）
  const mgrAtmoBonusNow = (state.manager && !mgrWeek.skipPassive) ? MANAGER_ATMO_BONUS : 0
  const atmosphere = regressAtmosphere(state.atmosphere, aMembers.length > 0 ? aMembers : afterWeekend, atmoDelta, mgrAtmoBonusNow)
  const atmosphereB = bMembers.length > 0 ? regressAtmosphere(atmoB, bMembers, plan.weekend === 'practice-match' ? 1 : 0) : atmoB

  // 4. 監督アクション（週1・排他＝機会費用）。人・戦略の判断に絞る（練習/週末と役割が被らない）
  let roster = afterWeekend
  let mtgAtmo = 0
  if (plan.managerAction === 'meeting') {
    // G-41 §4 (Q-001 B案): meetingTargets[] を優先。未指定なら meetingTarget をフォールバック（後方互換）。
    //   雰囲気+1 は1回（監督アクションが面談である事実そのもの）・対象人数分は加算しない。
    const targetIds: string[] = plan.meetingTargets && plan.meetingTargets.length > 0
      ? plan.meetingTargets.filter(Boolean)
      : (plan.meetingTarget ? [plan.meetingTarget] : [])
    if (targetIds.length > 0) {
      const targetSet = new Set(targetIds)
      // 個別面談: 対象選手の調子を上げ・疲労を少し抜く（信頼関係＝ピーク調整/控えのケア）
      roster = roster.map((p) => targetSet.has(p.id)
        ? { ...p, condition: Math.min(5, p.condition + 1) as typeof p.condition, fatigue: Math.max(0, p.fatigue - 8) }
        : p)
      mtgAtmo = 1
    } else {
      // 全体ミーティング: チームの雰囲気+（高いほど逓減＝やり得防止）
      mtgAtmo = atmosphere >= 72 ? 1 : atmosphere >= 55 ? 3 : 6
    }
  }


  // 4.5 週次フレーバーイベント（補完N）
  const flavor = generateWeeklyFlavor(state, plan, rngFor(state, 'flavor'))
  // #37: 名指し選手への副作用（代表選出の成長/調子/バッジ）を working roster に適用
  if (flavor.rosterPatch) roster = flavor.rosterPatch(roster)
  // マネージャー専用イベントの roster 反映（fatigue/condition 変化）
  if (mgrWeek.rosterPatch) roster = mgrWeek.rosterPatch(roster)
  // G-32: マネージャー恋愛 patch（dating更新・破局）
  let managerState = state.manager
  if (flavor.managerPatch && managerState) managerState = flavor.managerPatch(managerState)

  // #31: 定期考査の結果を翌週に出す。pendingExam があれば赤点/好成績を判定し、結果イベントを生成。
  let examEvent: WeekEvent | null = null
  let examAtmoDelta = 0
  if (state.pendingExam) {
    const study = state.pendingExam.study
    const rng = rngFor(state, 'exam')
    let red = 0, good = 0
    const redNames: string[] = [], goodNames: string[] = []
    roster = roster.map((p) => {
      if (p.retired) return p
      const rate = redMarkRate(p.personality) * (study ? 0.5 : 1)
      if (rng.next() < rate) {
        red++; redNames.push(p.name)
        const weeks = 1 + (rng.next() < 0.4 ? 1 : 0)
        return { ...p, cramWeeks: Math.max(p.cramWeeks ?? 0, weeks), condition: Math.max(1, p.condition - 1) as typeof p.condition }
      }
      if (studyAptitude(p.personality) >= 3 && rng.next() < (study ? 0.45 : 0.25)) {
        good++; goodNames.push(p.name)
        return { ...p, condition: Math.min(5, p.condition + 1) as typeof p.condition }
      }
      return p
    })
    if (study) roster = roster.map((p) => p.retired ? p : ({ ...p, fatigue: Math.min(100, p.fatigue + 5) }))
    examAtmoDelta = (good >= 3 ? 2 : 0) + (red >= 3 ? -3 : red >= 1 ? -1 : 0)
    // G-13: 誰が赤点/好成績かを名前で明示。G-14: 勉強優先の効き（赤点が出にくい）も文で示す。
    const join = (ns: string[]) => ns.join('、')
    const headline = study
      ? (red > 0 ? 'テストが返ってきた。勉強を優先したが、それでも何人かは苦戦した。' : 'テストが返ってきた。勉強を優先した甲斐あって、赤点は出なかった。')
      : (red > 0 ? 'テストが返ってきた。練習を続けた分、いくつか赤点が出てしまった。' : 'テストが返ってきた。練習を続けたが、赤点は出ずに済んだ。')
    const redLine = red > 0 ? `赤点は${red}人——${join(redNames)}。しばらく補習で、その間は練習に出られない。` : ''
    const goodLine = good > 0 ? `好成績は${good}人——${join(goodNames)}。胸を張っている。` : ''
    const resultBody = [headline, redLine, goodLine].filter(Boolean).join('\n')
    examEvent = { id: `exam-result-${state.year}-${state.week}`, kind: 'flavor' as const, title: study ? '考査の結果（勉強優先）' : '考査の結果（練習続行）', body: resultBody }
    if (examAtmoDelta !== 0) examEvent.effect = { atmo: examAtmoDelta }
  }

  // 5. 週送り
  const nextWeek = state.week + 1
  // フレーバー/ニュースイベントには即時効果(雰囲気/評判)を effect として埋め込み、UIで影響を明示する。
  const newEvents: WeekEvent[] = []
  if (examEvent) newEvents.push(examEvent)
  if (mgrWeek.event) {
    const me: WeekEvent = { ...mgrWeek.event }
    if (mgrWeek.atmoDelta) me.effect = { atmo: mgrWeek.atmoDelta }
    newEvents.push(me)
  }
  if (flavor.event) {
    const fe: WeekEvent = { ...flavor.event }
    if (flavor.atmoDelta || flavor.repDelta) {
      fe.effect = {}
      if (flavor.atmoDelta) fe.effect.atmo = flavor.atmoDelta
      if (flavor.repDelta) fe.effect.rep = flavor.repDelta
    }
    newEvents.push(fe)
  }
  let interrupt: WeekOutcome['interrupt'] = null

  // 入る週のトリガー判定（大会はinterruptでストアに委譲）
  const trig = triggerForWeek(nextWeek <= WEEKS_PER_YEAR ? nextWeek : WEEKS_PER_YEAR)
  if (trig?.kind === 'summer-tournament') interrupt = 'summer-tournament'
  if (trig?.kind === 'winter-tournament') interrupt = 'winter-tournament'
  // 全国は県予選を突破している時(pendingNational)のみ開催（#11）。予選敗退なら全国は無い。
  if (trig?.kind === 'summer-national' && state.pendingNational === 'summer') interrupt = 'summer-national'
  if (trig?.kind === 'winter-national' && state.pendingNational === 'winter') interrupt = 'winter-national'

  // 🔓 段階的機能解放（#29）：年1は週ごとに新機能が解放される。
  // 初心者(#13)は物語＋丁寧な解説、経験者は「解放された」通知のみ（説明を省きサクサク進む）。
  const expert = state.tutorialMode === 'expert'
  for (const f of featuresUnlockedAtWeek(state.year, nextWeek)) {
    const ev = UNLOCK_EVENT[f]
    if (ev) newEvents.push({ id: `unlock-${f}-${state.year}`, kind: 'news', title: ev.title, body: expert ? ev.expert : ev.body })
  }

  // 🏕 夏合宿：7日サブモードへ（#34）。この週の通常練習は上で処理済み＝合宿モードは
  // 「1日ずつの物語イベント＋スキル開花＋小さな上乗せ」を担う。interruptでストアに委譲する。
  if (trig?.kind === 'camp') {
    interrupt = 'camp'
  }

  // 🎪 文化祭（G-45: 単発イベント形式）：week28進入時に「準備の選択＋当日＋恋愛(0-3件)」を
  // 週次イベントの先頭に積む。旧6日サブモード（G-22-A改）は廃止した（作業感が強いため）。
  // 恋愛イベントの効果（彼女/IQ/疲労/調子）は rosterPatch でここに反映する。
  let festivalAtmo = 0
  if (trig?.kind === 'festival') {
    const fest = generateFestivalWeek(state, rngFor(state, 'festival'))
    roster = fest.rosterPatch(roster)
    newEvents.unshift(...fest.events)
    festivalAtmo = fest.atmoDelta
  }

  // 専属トレーナーを雇うと毎週わずかに疲労が回復（好調維持）
  if (hasStaff(state, 'trainer')) {
    roster = roster.map((p) => ({ ...p, fatigue: Math.max(0, p.fatigue - 5) }))
  }
  // #42 マネージャーがいると毎週わずかに疲労が回復（コンディション管理）
  //    風邪欠席週は受動効果オフ（マネがいないことの実感を出す）
  if (state.manager && !mgrWeek.skipPassive) {
    roster = roster.map((p) => ({ ...p, fatigue: Math.max(0, p.fatigue - MANAGER_FATIGUE_RELIEF) }))
  }
  // 回復体質(#34)：毎週、疲労が余分に抜ける（タフな選手）
  roster = roster.map((p) => (!p.retired && p.skills?.includes('quick-heal')) ? { ...p, fatigue: Math.max(0, p.fatigue - 3) } : p)

  // スカウトSPの蓄積（解禁後のみ）。#41: スカウトスタッフ(広域+2/統括+3)で毎週増える。
  const scoutNetBonus = scoutSpBonus(state)
  const scouting = state.scouting.level > 0
    ? { ...state.scouting, sp: state.scouting.sp + state.scouting.spPerWeek + scoutNetBonus + (plan.managerAction === 'scout' ? 3 : 0) }
    : state.scouting

  // G-44: スポンサー残期間を週単位で1減らす（0で自動解約）
  const sponsorTicked = tickSponsors(state)

  // マネージャー専用イベント状態の更新（counterPatch を反映＋年度切替で再生成済みの値を持ち越す）
  const nextManagerEvents = managerEvents
    ? { ...managerEvents, ...(mgrWeek.counterPatch ?? {}) }
    : managerEvents

  let nextState: CareerState = {
    ...state,
    roster,
    scouting,
    weather,
    sponsorContracts: sponsorTicked.sponsorContracts,
    manager: managerState, // G-32: マネージャーの dating 状態を引き継ぐ（恋愛/破局）
    managerEvents: nextManagerEvents, // 2026-06-26: マネ専用ミニイベント状態
    seniorBoostYear: flavor.seniorBoostStartYear ?? state.seniorBoostYear, // G-22-④ persistent flag set
    reputation: Math.max(0, Math.min(100, state.reputation + (flavor.repDelta ?? 0))), // #37: 代表選出で部の評判↑
    atmosphere: Math.max(0, Math.min(100, atmosphere + mtgAtmo + flavor.atmoDelta + examAtmoDelta + mgrWeek.atmoDelta + festivalAtmo)),
    atmosphereB: Math.max(0, Math.min(100, atmosphereB)),
    log: bcLog ? [bcLog, ...state.log].slice(0, 40) : state.log,
    week: nextWeek,
    phase: phaseForWeek(Math.min(nextWeek, WEEKS_PER_YEAR)),
    lastPlan: plan,
    menuStreak, // #28: 連続採用週数を次週へ持ち越し
    pendingEvents: newEvents,
    pendingExam: null, // 結果を出したのでクリア（出していない週はそのまま）
  }

  let yearEnded = false
  if (nextWeek > WEEKS_PER_YEAR) {
    nextState = advanceYear(nextState)
    yearEnded = true
  }

  return { state: nextState, growthSummary: summary, newEvents, interrupt, yearEnded }
}

/** 年度ロールオーバー: 卒業・学年上げ・入部・予算・スカウト解禁 */
export function advanceYear(state: CareerState): CareerState {
  const rng = createRNG(hashSeed(`${state.rngSeed}-${state.year}-yearend`))

  // 1. 卒業（3年生を除外）＋進路決定（補完R-2）
  const graduating = state.roster.filter((p) => p.grade === 3)
  const remaining = state.roster.filter((p) => p.grade !== 3)
  const graduates = state.records.graduates + graduating.length
  // 今季の全国大会実績＝プロのスカウトの目に留まる度合い（試合の勝利→プロ）
  const proBonus = (state.season.winterLabel === '全国優勝' ? 0.14
    : state.season.summerBest === 3 ? 0.10
    : state.season.winterReachedNational ? 0.07
    : state.season.summerBest != null ? 0.05 : 0)
  const gradOut = processGraduation(graduating, rng, proBonus)
  // G-41 §5: tier 情報も保存する（OB指導の解放判定に使う）
  const newProAlumni = gradOut.results
    .filter((r) => isProDestiny(r.destiny))
    .map((r) => ({ name: r.name, year: state.year, tier: r.destiny }))
  // tier別の累計を更新
  const newProByTier = { ...(state.records.proCountByTier ?? {}) }
  for (const a of newProAlumni) {
    const k = a.tier === 'pro-overseas' ? 'overseas' : a.tier === 'pro-d1' ? 'd1' : a.tier === 'pro-d2' ? 'd2' : 'd3'
    newProByTier[k] = (newProByTier[k] ?? 0) + 1
  }
  // 今季のベストプレイヤー（最高能力の選手）を記録
  const seasonBest = state.roster.length > 0
    ? [...state.roster].sort((a, b) => playerOverallSum(b) - playerOverallSum(a))[0].name
    : state.records.bestPlayerName

  // 歴代ベストイレブン更新（R-8）: ポジション別に最高到達能力の選手を残す
  const BEST_POS = ['GK', 'CB', 'SB', 'WB', 'CM', 'AM', 'WF', 'CF']
  const bestEleven = (state.records.bestEleven ?? []).map((e) => ({ ...e }))
  for (const pos of BEST_POS) {
    const cands = state.roster.filter((p) => p.position === pos)
    if (cands.length === 0) continue
    const top = cands.sort((a, b) => playerOverallSum(b) - playerOverallSum(a))[0]
    const ov = playerOverallSum(top)
    const ex = bestEleven.find((e) => e.pos === pos)
    if (!ex) bestEleven.push({ pos, name: top.name, overall: ov })
    else if (ov > ex.overall) { ex.name = top.name; ex.overall = ov }
  }

  // 2. 学年上げ
  let roster: Player[] = remaining.map((p) => ({
    ...p,
    grade: (p.grade + 1) as 1 | 2 | 3,
    seasonGoals: 0,
    seasonApps: 0,
    condition: 3 as Condition, // 新シーズンは平常の調子から
  }))

  // 2.5 性格変化（補完2.4・年度末評価）
  const persChange = applyPersonalityChanges(roster, state.atmosphere, rng, state.atmosphereB ?? state.atmosphere)
  roster = persChange.roster

  // 2.6 スキル習得：通常練習・年度末の自動付与は撤去（#34）。
  //   特殊能力は「夏合宿」と「物語の山場」でのみ掴む。
  //   #5: 魂の継承・新キャプテン就任は **冬大会後の引退の節目**（careerStore.finishCompMatch）へ移動。
  //   3月（このadvanceYear）は進路決定＋シーズンまとめに専念する（節目を分散）。
  const skillLogs: string[] = []
  const climaxEvents: WeekEvent[] = []
  const captainAtmoDelta = 0

  // 2.7 下位チーム選手の覚醒（B/Cの隠れた力が開花＝努力と環境と運でプロを狙える道）
  const awakeOut = evaluateAwakening(roster, state.atmosphereB ?? state.atmosphere, rng)
  roster = awakeOut.roster

  const newYear = state.year + 1
  // G-36: 寮上限を 24/33/42/51/60 に変更（全て3の倍数で学年ハードキャップが綺麗）。
  //   学年あたり = floor(cap/3) = 8 / 11 / 14 / 17 / 20。
  //   GK段階配分（intakeN基準）: 8人以下=1人保証 / 9〜14人=1〜2人運 / 15人以上=2人固定。
  // Z-1: 旧セーブ等で facilities.dorm が範囲外(0 or 6+)になると dormCap=0 で入部不能→
  //   ゲーム進行が止まるため 1..5 にクランプして防御。
  const dormLv = Math.max(1, Math.min(5, state.facilities.dorm))
  const dormCap = [0, 24, 33, 42, 51, 60][dormLv]
  const gradeCap = Math.floor(dormCap / 3) // 学年ハードキャップ（1年生の入部総数の上限）

  // 3a. スカウト勧誘判定（2月相当）→ 成功者を入部させる
  const recruit = runRecruitment(state, rng)
  const scoutedCount = recruit.recruited.length

  // 3b. 一般入部（スカウト枠を差し引いた残りを埋める）
  // 入部希望者数は「評判」で決まる（有名校ほど集まる）。設備は受け入れ上限(dormCap)のみに作用し、
  // 希望者数そのものは増やさない（現実に即した設計）。
  // G-36: 希望者上限を 24 → 20 に縮小（セレクション機能は今後実装予定のため、寮Lv5でも学年20が天井）。
  const intakeBase = 8 + Math.floor(state.reputation / 8)
  const intakeN = Math.max(8, Math.min(20, intakeBase))
  // 入部（スカウト合格者は常に入部）
  const selectionOn = state.selectionEnabled && state.reputation >= 50
  const newcomers: Player[] = [...recruit.recruited]
  let pendingApplicants: Player[] | undefined
  let admitCap: number | undefined
  // G-36 GK段階配分: 入部規模ごとにGK人数を決定（毎年最大2人＝GK過多を防ぐ）。
  //   8人以下→1人保証 / 9〜14人→運で1〜2人（50/50） / 15人以上→2人固定。
  //   GKは学年ハードキャップの内数（GK 2人 = 残りFP は学年枠-2）。
  const FIELD_POS = INTAKE_POSITIONS.filter((p) => p !== 'GK')
  const gkCount = intakeN <= 8 ? 1 : intakeN <= 14 ? (rng.next() < 0.5 ? 1 : 2) : 2
  const intakePos = (i: number) => (i < gkCount ? 'GK' : rng.pick(FIELD_POS))
  if (selectionOn) {
    // セレクションON：応募者数はOFF時に入部する人数と完全に同数（セレクションの有無で希望者は増減しない）。
    //   プールを水増しする旧仕様（×1.6）は撤廃＝セレクションONが数・質で有利にならない。
    //   上限は両モード共通の物理制約のみ: 評判由来の希望者数(intakeN)・寮の空き・学年枠(寮容量の1/3)。
    //   セレクションの価値＝「入部前に能力を見て、弱い応募者を断れる（最低10人は合格）」の選別機能に限定。
    const naturalN = Math.max(0, Math.min(intakeN, dormCap - roster.length - newcomers.length, gradeCap - newcomers.length))
    const pool: Player[] = []
    for (let i = 0; i < naturalN; i++) {
      const np = generateRecruit(rng, { position: intakePos(i), reputation: state.reputation, grade: 1, joinedYear: newYear })
      grantStartingSkills(np, rng, 'intake') // 自然入部にもごく稀に素材スキル
      pool.push(np)
    }
    pendingApplicants = pool
    admitCap = naturalN
  } else {
    // 一般入部（自動・多人数）
    // G-36: 学年ハードキャップ（floor(dormCap/3)）= 寮Lv1-5で 8/11/14/17/20。
    //   1年生がここを超えないように打ち止め。スカウト合格者(recruit.recruited)も newcomers.length に含む。
    for (let i = 0; i < intakeN; i++) {
      if (roster.length + newcomers.length >= dormCap) break
      if (newcomers.length >= gradeCap) break // G-36 学年ハードキャップ
      const np = generateRecruit(rng, { position: intakePos(i), reputation: state.reputation, grade: 1, joinedYear: newYear })
      grantStartingSkills(np, rng, 'intake')
      newcomers.push(np)
    }
  }
  // 新入部員の初期配属＝能力からの希望ポジに揃える（フィールドのみ・GKはGK固定）
  roster = [...roster, ...newcomers.map((p) => (p.isGK ? p : { ...p, position: bestFieldPosition(p) }))]

  // 4. チーム再編成（A/B/C自動割当）＋背番号付与（新入生に空き番号）＋キャプテン
  roster = assignJerseyNumbers(autoAssignSquads(roster))
  // #5: 冬大会後の引退の節目で決めた新キャプテンを尊重する。年度開始では勝手に交代させない。
  //   既存の有効なキャプテン(非引退・最上級級・A)がいればそのまま、いなければIQ最上位を自動任命。
  const keepCap = roster.find((p) => p.isCaptain && !p.retired && p.grade >= 2 && (p.squad ?? 'A') === 'A')
  roster.forEach((p) => { if (p !== keepCap) p.isCaptain = false })
  if (!keepCap) {
    const cap = [...roster].filter((p) => p.grade >= 2 && (p.squad ?? 'A') === 'A').sort((a, b) => b.abilities.iq - a.abilities.iq)[0]
    if (cap) cap.isCaptain = true
  }

  // 5. スカウト解禁・段階UP（評判で範囲拡大）+ 新年度の候補生成
  // #39: SP持ち越し上限20（現実的に「視察と同年にほぼ使い切る」設計＝貯め込み攻略を封じる）
  const SP_CARRYOVER_CAP = 20
  const scouting = { ...state.scouting, sp: Math.min(state.scouting.sp, SP_CARRYOVER_CAP), shortlist: [] as string[] }
  // Z-2: scout-chief 雇用が「スカウト機能本体の解放」トリガー。説明文(facilities.ts L80)と
  //   実装を一致させた（旧: 年2自動Lv1 → 新: scout-chief雇用でLv1解禁）。年2の5月以降のみ
  //   雇用可(staffHireGate)なので時期は変わらない。既存セーブで scouting.level > 0 のものは
  //   そのまま保持＝save互換。
  if (hasStaff(state, 'scout-chief') && scouting.level === 0) { scouting.level = 1; scouting.spPerWeek = 1 }
  if (scouting.level >= 1) {
    // 評判と設備で段階UP（C-2を簡略化）
    if (state.reputation >= 70 && state.facilities.dorm >= 3) scouting.level = Math.max(scouting.level, 4)
    else if (state.reputation >= 50 && state.facilities.dorm >= 2) scouting.level = Math.max(scouting.level, 3)
    else if (state.reputation >= 30) scouting.level = Math.max(scouting.level, 2)
    // #41: 基礎SPを絞る（Lv1=1…Lv4=4）。上乗せはスカウトスタッフ雇用で得る設計に。
    scouting.spPerWeek = scouting.level
  }
  // 新年度の候補プールを生成（発見度はリセット）
  if (scouting.level > 0) {
    const candState = { ...state, year: newYear, scouting } as CareerState
    scouting.candidates = generateCandidates(candState, rng)
  }

  // 6. 年間収支（学校予算配分＋部費＋後援会/OB寄付＋大会補助金 − 設備維持費 − 部員運営費 − 年俸 − 勧誘費）
  const { budget, report: budgetReport } = settleAnnualBudget(state, rng, recruit.cost)
  // 財政難（支出が繰越＋収入を上回った）はチームの雰囲気に影響する
  const financeAtmoPenalty = budgetReport.deficit ? 8 : 0

  // 7. 履歴記録
  const history = [...state.records.history, {
    year: state.year,
    summer: state.season.summerLabel ?? '不参加',
    winter: state.season.winterLabel ?? '不参加',
    reputationEnd: state.reputation,
  }]

  const gradNarr = graduationNarrative(gradOut, state.schoolName)
  const improved = persChange.changes.filter((c) => c.improved)
  const changeNarr = improved.length > 0
    ? ` ${improved.slice(0, 3).map((c) => `${c.name}が${c.to}へ成長`).join('、')}。`
    : ''
  const changeLogs = persChange.changes.map((c) => `${c.name}: ${c.from}→${c.to}${c.improved ? '↑' : '↓'}`)
  const awakeLogs = awakeOut.awakenings.map((a) => `🌟 ${a.name}が覚醒！（能力+${a.gain}）`)
  const awakeNarr = awakeOut.awakenings.length > 0
    ? ` 下位チームから${awakeOut.awakenings.map((a) => a.name).join('、')}が覚醒の兆し！` : ''

  // #53 評判ティア昇格の祝福（達成感・マイルストーン可視化）。年度末の最終評判で判定。
  const newReputation = Math.max(0, Math.min(100, state.reputation + Math.round(gradOut.repGain * repGainDamping(state.reputation))))
  const prevRepTier = state.repTier ?? reputationTier(state.reputation)
  const newRepTier = reputationTier(newReputation)
  const repTierEvents: WeekEvent[] = []
  if (newRepTier > prevRepTier) {
    repTierEvents.push({ id: `reptier-${newYear}-${newRepTier}`, kind: 'flavor',
      title: `🎉 学校の格が上がった —「${reputationTierName(newReputation)}」`,
      body: reputationTierUpMessage(newRepTier) })
  }

  // #42 マネージャー加入（3年目以降・評判≥40で未加入のとき一度だけ）。受動効果でチームを支える。
  let manager = state.manager
  const managerEvents: WeekEvent[] = []
  if (!manager && newYear >= 3 && state.reputation >= 40) {
    manager = generateManager(rng, newYear)
    const tr = MANAGER_TRAIT[manager.trait]
    managerEvents.push({
      id: `manager-${newYear}`, kind: 'flavor', title: '🌸 マネージャー加入',
      body: `${manager.name}さんがマネージャーとして部に加わってくれた。「${tr.label}」で、${tr.desc}選手のコンディション管理や練習のサポートで、チームを陰から支えてくれる。`,
    })
  }
  return {
    ...state,
    year: newYear,
    manager,
    week: 1,
    phase: phaseForWeek(1),
    roster,
    budget,
    lastBudget: budgetReport,
    // G-41 §11: 年次収支履歴を蓄積（直近10年）。確定したstate.yearの収支として記録。
    budgetHistory: [
      ...(state.budgetHistory ?? []),
      { year: state.year, income: budgetReport.income.total, expense: budgetReport.expense.total, net: budgetReport.net },
    ].slice(-10),
    atmosphere: Math.max(0, Math.min(100, state.atmosphere - financeAtmoPenalty + captainAtmoDelta)),
    scouting,
    reputation: newReputation,
    repTier: newRepTier, // #53 通知済みティアを記録（昇格祝福の重複防止）
    lastGraduates: gradOut.results,
    pendingApplicants,
    admitCap,
    // 新入部員は入部式で1人ずつ確認（名前/ポジ/背番号）。セレクション合格者は選抜後に追加される。
    pendingIntake: newcomers.map((p) => p.id),
    season: { summerBest: null, winterReachedNational: false, summerLabel: null, winterLabel: null },
    records: {
      ...state.records, graduates, history,
      proPlayers: state.records.proPlayers + gradOut.proCount,
      proAlumni: [...state.records.proAlumni, ...newProAlumni],
      proCountByTier: newProByTier,
      bestPlayerName: seasonBest,
      bestEleven,
    },
    pendingEvents: [...repTierEvents, ...managerEvents, ...climaxEvents,
    // G-43: スカウト判定の大イベント化。候補ごとに「プロフィール＋結果」を1イベントずつ表示。
    //   告知なし・成功画像/失敗画像の枠だけUI側に確保（画像はバッチで別途）。
    ...recruit.results.map((r) => ({
      // Z-2: 画像振り分けのため id に ok/ng を入れる（EventBubble eventImage が成功/失敗で別画像を出す）
      id: `scout-result-${r.ok ? 'ok' : 'ng'}-${newYear}-${r.name}`,
      kind: 'flavor' as const,
      title: r.ok ? `🎯 スカウト判定：${r.name}` : `🛬 スカウト判定：${r.name}`,
      body: `候補プロフィール: ${r.position}・素材${Math.round(r.strength)}${r.badge ? `・${r.badge === 'u15' ? 'U-15代表級' : r.badge === 'national-tresen' ? '全国トレセン' : '県トレセン'}` : ''}${r.personalityKey ? `・性格 ${r.personalityKey}` : ''}\n\n${r.ok
        ? `${r.name}は来季から我が校でプレーすることが決まった。歓迎の意を伝えよう。`
        : `${r.name}は ${r.destinationLabel ?? '別の高校に入学を決めたようです。'} 縁がなかった。`}`,
    })),
    {
      id: `intake-${newYear}`,
      kind: 'flavor',
      title: `${newYear}年目・新入生入部`,
      body: `${gradNarr ? gradNarr + ' ' : ''}${selectionOn ? `スカウト${scoutedCount}人が入部。一般応募は${pendingApplicants?.length}人——セレクションで合格者を選抜する。` : `新たに${newcomers.length}人が入部（うちスカウト${scoutedCount}人）。`}${changeNarr}${awakeNarr}`,
    },
    // G-34: 招集メンバー(A=20人枠)を超える状態が初めて発生したらチュートリアル発火（一度きり）
    ...(!state.shownAFullTutorial && roster.length >= 21 ? [{
      id: `tut-afull-${newYear}`,
      kind: 'flavor' as const,
      title: '🔓 招集メンバー枠について',
      // G-44: 説明を ≤4 ページに短縮（旧3ページ→4ページだが各ページ短文）。
      body: '部員が20人を超えた。\nAチーム(招集メンバー)は公式戦のメンバー枠で、最大20人(先発11+ベンチ9)。\n21人目以降はベンチ外(Bチーム)に配属される。\n編成画面でA/Bを入れ替え可能。Bチームコーチを雇えばB専用の練習試合・成長も解禁。',
    }] : []),
    ],
    shownAFullTutorial: state.shownAFullTutorial || roster.length >= 21,
    log: [`${newYear}年目開始（卒業${graduating.length}[プロ${gradOut.proCount}]・入部${newcomers.length}・収入+${budgetReport.income.total}/支出-${budgetReport.expense.total}万${budgetReport.deficit ? '・財政難！' : ''}）`, ...awakeLogs, ...skillLogs, ...changeLogs, ...state.log].slice(0, 40),
  }
}
