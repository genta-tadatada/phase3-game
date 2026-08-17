// ============================================================
// store/careerStore.ts — フル版キャリアモードの進行ステート
// ============================================================

import { create } from 'zustand'
import type { MatchResult, Tactics, Player, PositionType } from '../engine/types'
import type { CareerState, WeeklyPlan, PracticeGroup } from '../career/types'
import { practiceLaneCount, MIN_PRACTICE_LANES } from '../career/types'
import { climateMatchCoef, type Weather } from '../career/weather'
import { bestFieldPosition, playerOverallSum } from '../engine/match/teamQuality'
import { checkAchievements } from '../career/achievementTracker'
import { achievementById } from '../data/achievements'
import { createCareer } from '../career/init'
import { advanceWeek } from '../career/engine'
import { saveCareer, loadCareer, deleteSave, hasSave, disableSave } from '../career/save'
import { applyMatchExperience, type GrowthSummary } from '../career/growth'
import {
  buildField, applyCompResult, playerPlacement, type CompKind, type CompStage, type CompOutcome,
} from '../career/competition'
import { investInCandidate } from '../career/scout'
import { upgradeFacility, buyExtra, hireStaff, coachCount, type FacilityKey, type StaffId } from '../career/facilities'
import { runObInstruction as runObInstructionImpl } from '../career/obInstruction'
import { signSponsor as signSponsorImpl } from '../career/sponsor'
import { setJerseyNumber } from '../career/jersey'
import { grantClimaxSkill, inheritFromGraduates } from '../career/climaxSkills'
import { CHOICE_EFFECTS } from '../career/events'
import { autoAssignSquads, squadCategoryOf } from '../career/squad'
import { availableMenus } from '../career/trainingMenus'
import { careerToTeam } from '../career/lineup'
import { startCamp, genCampDay, applyCampChoice, CAMP_TOTAL_DAYS } from '../career/camp'
import { simulateBcCamp, formatBcCampBody } from '../career/bcCamp'
import { phaseForWeek, FESTIVAL_WEEK } from '../career/calendar'
import { WEEKS_PER_YEAR } from '../career/types'
import { applyWeeklyTraining } from '../career/growth'
import { hashSeed } from '../engine/rng'
import {
  applyPlayerResult, playerMatchIndex, playerOpponent, matchSeed, stageReachedLabel, type Tournament,
} from '../lib/tournament'
import {
  resumeSecondHalf, type MatchHalfState,
  simulateOpeningSegment, advanceMatchSegment, applySegmentSub, applySegmentTactics,
} from '../engine/match/possession'
import { createRNG } from '../engine/rng'

// ポジション配属（GK⇄フィールド転向を含む）。slotはリセットして再配置を促す。
function clampAb(v: number) { return Math.max(10, Math.min(95, Math.round(v))) }
function convertPosition(p: Player, pos: PositionType): Player {
  if (pos === 'GK' && !p.isGK) {
    const a = p.abilities
    return { ...p, isGK: true, position: 'GK', slot: undefined, gk: { saving: clampAb((a.speed + a.power + a.defense) / 3), gkIq: clampAb((a.iq + a.defense) / 2) } }
  }
  if (pos !== 'GK' && p.isGK) {
    return { ...p, isGK: false, gk: null, position: pos, slot: undefined }
  }
  return { ...p, position: pos, slot: undefined }
}

export type CareerScreen =
  | 'title' | 'weekly' | 'roster' | 'tactics' | 'lineup' | 'positions' | 'scout' | 'manage' | 'summary' | 'records' | 'squad' | 'selection'
  | 'comp-bracket' | 'comp-match' | 'comp-result' | 'intake' | 'camp' | 'new-captain'

interface ActiveComp {
  kind: CompKind
  stage: CompStage
  tournament: Tournament
  matchResult: MatchResult | null
  matchHalf: MatchHalfState | null  // ハーフタイム采配のための前半状態（後半未消化）
  lastOutcome: CompOutcome | null
  transitionMsg: string | null
}

// 既定の練習メニュー枠（枠0=中盤/1=守備/2=攻撃/3=GK/4,5=拡張）。枠数は3〜6で可変。
const DEFAULT_LANE_MENUS = ['pass', 'defense1v1', 'shoot', 'gk-saving', 'dribble', 'run']
function defaultLanes(n: number) {
  return DEFAULT_LANE_MENUS.slice(0, n).map((menuId) => ({ menuId }))
}

function practiceGroupOf(p: Player): PracticeGroup {
  if (p.isGK) return 'gk'
  const pos = p.position
  if (pos === 'CF' || pos === 'WF') return 'fw'
  if (pos === 'CB' || pos === 'SB') return 'df'
  return 'mf'
}
// 本職ポジションから既定の枠へ自動割当。枠数が少ない序盤はGKは守備枠に同居（4枠以上でGK専用枠）
function laneForGroup(g: PracticeGroup, laneCount: number): number {
  if (g === 'gk') return laneCount >= 4 ? 3 : 1
  if (g === 'df') return 1
  if (g === 'fw') return 2
  return 0 // mf
}
function autoAssignByPosition(roster: Player[], laneCount: number, ctx: { roster: Player[]; facilities: { dorm: number }; staff?: string[] }): Record<string, number> {
  // 練習レーンはAメンバーのみ。B/C/招集外はgrowth.tsの万能成長で別系統に育つ。
  const ctxArg = { roster: { length: ctx.roster.length }, facilities: ctx.facilities, staff: ctx.staff }
  const a: Record<string, number> = {}
  for (const p of roster) {
    if (squadCategoryOf(p, ctxArg) !== 'A') continue
    a[p.id] = laneForGroup(practiceGroupOf(p), laneCount)
  }
  return a
}
function makeDefaultPlan(c: CareerState): WeeklyPlan {
  const n = practiceLaneCount(c.facilities.training, coachCount(c))
  return {
    lanes: defaultLanes(n),
    assign: autoAssignByPosition(c.roster, n, c),
    weekend: 'rest', practiceOpponent: 'even', managerAction: null, meetingTarget: null,
  }
}
const DEFAULT_PLAN: WeeklyPlan = {
  lanes: defaultLanes(MIN_PRACTICE_LANES),
  assign: {},
  weekend: 'rest',
  managerAction: null,
  meetingTarget: null,
}

interface CareerStore {
  screen: CareerScreen
  career: CareerState | null
  plan: WeeklyPlan
  lastSummary: GrowthSummary | null
  growthResult: GrowthSummary | null  // 1週進めた直後に表示する成長結果（矢印表示用）
  yearJustEnded: boolean
  hasSaveFile: boolean
  comp: ActiveComp | null
  campStage: 'intro' | 'day' | 'choice' | 'summary' | null  // 夏合宿サブモードの表示段階

  newCareer: (name: string, prefecture: string, manager?: string, tutorialMode?: 'beginner' | 'expert') => void
  continueCareer: () => void
  abandon: () => void
  go: (s: CareerScreen) => void
  setLaneMenu: (laneIdx: number, menuId: string) => void
  assignGroup: (laneIdx: number, group: PracticeGroup | 'allfp') => void
  assignPlayer: (id: string, laneIdx: number | null) => void
  autoAssignPositions: () => void
  repeatLastPlan: () => void
  setWeekend: (w: WeeklyPlan['weekend']) => void
  setPracticeOpponent: (o: NonNullable<WeeklyPlan['practiceOpponent']>) => void
  setManagerAction: (a: WeeklyPlan['managerAction'], target?: string | null) => void
  setMeetingTargets: (ids: string[]) => void
  setTactics: (t: Tactics) => void
  setTacticsPreset: (which: 'base' | 'lead' | 'behind', t: Tactics | undefined) => void
  setLineup: (ids: string[]) => void
  setCaptain: (id: string) => void
  // #62: 3年引退後の専用画面で初代キャプテンを選ぶ（雰囲気ペナルティなし）。
  pickInitialCaptain: (id: string) => void
  setPlayerPosition: (id: string, pos: PositionType) => void
  renamePlayer: (id: string, name: string) => void
  finishIntake: () => void
  recommendPositions: () => void
  setSetPieceTaker: (id: string) => void
  setPkTaker: (id: string) => void
  advance: () => void
  fastForward: () => void
  dismissSummary: () => void
  dismissGrowth: () => void
  nextCampStep: () => void
  resolveCampChoice: (effectId: string) => void
  // 🛠 devサーバ限定（?festival）: 使い捨てキャリアを文化祭前週(week27)で起動して検証する（G-45）
  debugStartFestival: (seed?: number) => void
  // 🛠 devサーバ限定（?selection）: 使い捨てキャリアを3月(week45)・セレクションON・評判60で起動して検証する
  debugStartSelection: (seed?: number) => void
  startCompMatch: () => void
  halfTimeSub: (outId: string, inId: string) => void
  halfTimeTactics: (tactics: Tactics) => void
  resumeCompMatch: () => void           // 後方互換: 残りセグメントを最終まで一気に消化（テスト用）
  continueCompMatch: () => void          // F7: 次の停止点まで進める or 最終確定（MatchViewから呼ぶ）
  finishCompMatch: () => void
  continueAfterComp: () => void
  investCandidate: (id: string) => void
  toggleShortlist: (id: string) => void
  setOffer: (id: string, level: number) => void
  setJersey: (id: string, num: number) => void
  upgrade: (key: FacilityKey) => void
  buyExtra: (id: string) => void
  hireStaff: (id: StaffId) => void
  // G-41 §5: プロOB指導の実行（tier別）
  runObInstruction: (tier: 'd3' | 'd2' | 'd1' | 'overseas') => void
  // G-44: スポンサー契約
  signSponsor: (slot: 'main' | 'uniform', defId: string) => void
  resolveEvent: (effectId: string) => void
  setPlayerSquad: (id: string, squad: 'A' | 'B' | 'C') => void
  autoAssignSquad: () => void
  toggleSelection: () => void
  confirmSelection: (selectedIds: string[]) => void
}

export const useCareer = create<CareerStore>((set, get) => ({
  screen: 'title',
  career: null,
  plan: structuredClone(DEFAULT_PLAN),
  lastSummary: null,
  growthResult: null,
  yearJustEnded: false,
  hasSaveFile: hasSave(),
  comp: null,
  campStage: null,

  newCareer: (name, prefecture, manager, tutorialMode) => {
    const career = createCareer(name, prefecture, manager, tutorialMode)
    saveCareer(career)
    set({ career, screen: 'weekly', plan: makeDefaultPlan(career), lastSummary: null, growthResult: null, hasSaveFile: true, comp: null, campStage: null })
  },

  continueCareer: () => {
    const career = loadCareer()
    if (career) {
      // 保存プランが旧形式/未割当なら本職ベースで自動割当
      const saved = career.lastPlan
      const plan = saved && Array.isArray(saved.lanes) && saved.assign ? saved : makeDefaultPlan(career)
      // 大会の途中で中断していたら、その大会を復元して大会モードへ再開（#11・reload安全）
      if (career.activeComp) {
        const ac = career.activeComp
        set({
          career, plan, screen: 'comp-bracket',
          comp: { kind: ac.kind, stage: ac.stage, tournament: ac.tournament, matchResult: null, matchHalf: null, lastOutcome: null, transitionMsg: '大会を再開します' },
        })
        return
      }
      // 夏合宿の途中で中断していたら合宿モードへ再開（#34・reload安全）。
      if (career.activeCamp && !career.activeCamp.done) {
        const ac = career.activeCamp
        const stage = ac.pendingChoice ? 'choice' : (ac.shown.length > 0 || ac.queue.length > 0) ? 'day' : 'intro'
        set({ career, plan, screen: 'camp', campStage: stage, comp: null })
        return
      }
      const screen = (career.pendingApplicants && career.pendingApplicants.length > 0) ? 'selection'
        : (career.pendingIntake && career.pendingIntake.length > 0) ? 'intake'
        : 'weekly'
      set({ career, screen, plan, comp: null })
    }
  },

  abandon: () => {
    deleteSave()
    set({ career: null, screen: 'title', hasSaveFile: false, comp: null })
  },

  go: (s) => set({ screen: s }),

  // 枠のメニューを変更
  setLaneMenu: (laneIdx, menuId) => {
    const plan = get().plan
    const lanes = plan.lanes.map((l, idx) => idx === laneIdx ? { menuId } : l)
    set({ plan: { ...plan, lanes } })
  },

  // グループ（守備/中盤/攻撃/GK or 全フィールド）をまとめてこの枠へ割当
  assignGroup: (laneIdx, group) => {
    const c = get().career
    const plan = get().plan
    if (!c) return
    const assign = { ...plan.assign }
    // 練習レーンはAメンバーのみ。B/C/招集外はgrowth.tsの万能成長で別系統に育つ。
    const ctx = { roster: { length: c.roster.length }, facilities: { dorm: c.facilities.dorm }, staff: c.staff }
    for (const p of c.roster) {
      if (squadCategoryOf(p, ctx) !== 'A') continue
      const inGroup = group === 'allfp' ? !p.isGK : practiceGroupOf(p) === group
      if (inGroup) assign[p.id] = laneIdx
    }
    set({ plan: { ...plan, assign } })
  },

  // 個別の選手を枠に割当（null=未割当＝完全休養）
  assignPlayer: (id, laneIdx) => {
    const plan = get().plan
    const assign = { ...plan.assign }
    if (laneIdx == null) delete assign[id]
    else assign[id] = laneIdx
    set({ plan: { ...plan, assign } })
  },

  // F6: 自動割当を改善＝選手の振り分け＋メニューのローテーション。
  //   旧: assign のみ更新→メニューは変わらず「ずっと同じ内容」に見えていた。
  //   新: lanes のメニューも DEFAULT_LANE_MENUS にリセット＋同じ練習が3週超で代替へ自動切替（マンネリ予兆回避）。
  //   原則「過剰最適化しない」＝基本メニュー中心。特化やスプリント等は手動で意図して選ぶ余地を残す。
  autoAssignPositions: () => {
    const c = get().career
    if (!c) return
    const plan = get().plan
    const n = plan.lanes.length
    const avail = new Set(availableMenus(c.facilities.training).map((m) => m.id))
    const streak = c.menuStreak ?? {}
    // 各既定メニューの代替候補（マンネリ・未解放時の振替先・基本＋天候非依存中心）
    const LANE_ALT: Record<string, string[]> = {
      pass: ['tactics', 'dribble'],
      defense1v1: ['tactics', 'run'],
      shoot: ['dribble', 'pass'],
      'gk-saving': ['gk-position'],
      dribble: ['pass'],
      run: ['defense1v1'],
    }
    const baseIds = ['pass', 'defense1v1', 'shoot', 'gk-saving', 'dribble', 'run'].slice(0, n)
    const pick = (id: string): string => {
      const stale = !avail.has(id) || (streak[id] ?? 0) >= 3
      if (!stale) return id
      const alts = (LANE_ALT[id] ?? []).filter((a) => avail.has(a))
      const fresh = alts.find((a) => (streak[a] ?? 0) < 3)
      return fresh ?? alts[0] ?? id
    }
    const newLanes = baseIds.map((id) => ({ menuId: pick(id) }))
    set({ plan: { ...plan, lanes: newLanes, assign: autoAssignByPosition(c.roster, n, c) } })
  },

  repeatLastPlan: () => {
    const last = get().career?.lastPlan
    if (last && Array.isArray(last.lanes)) set({ plan: structuredClone(last) })
  },

  setWeekend: (w) => set({ plan: { ...get().plan, weekend: w } }),
  setPracticeOpponent: (o) => set({ plan: { ...get().plan, practiceOpponent: o } }),
  setManagerAction: (a, target = null) => set({ plan: { ...get().plan, managerAction: a, meetingTarget: target, meetingTargets: target ? [target] : [] } }),
  setMeetingTargets: (ids) => set({ plan: { ...get().plan, meetingTargets: ids, meetingTarget: ids[0] ?? null } }),

  setTactics: (t) => {
    const c = get().career
    if (!c) return
    set({ career: { ...c, tactics: t } })
  },

  setLineup: (ids) => {
    const c = get().career
    if (!c) return
    const next = { ...c, lineup: ids }
    saveCareer(next)
    set({ career: next })
  },

  setCaptain: (id) => {
    const c = get().career
    if (!c) return
    const oldCaptain = c.roster.find((p) => p.isCaptain)
    const changed = oldCaptain && oldCaptain.id !== id
    const roster = c.roster.map((p) => ({ ...p, isCaptain: p.id === id }))
    // #62: 戦術画面でキャプテンを変更すると雰囲気-3〜-5（混乱・派閥が生まれる）。
    //   新キャプテン選択直後の即変更も同じくペナルティ（猶予期間なし）。
    let atmoDelta = 0
    if (changed) {
      const rng = createRNG(hashSeed(`${c.rngSeed}-${c.year}-${c.week}-capchange-${id}`))
      atmoDelta = -(3 + Math.floor(rng.next() * 3)) // -3〜-5
    }
    const next: CareerState = {
      ...c,
      roster,
      atmosphere: Math.max(0, Math.min(100, c.atmosphere + atmoDelta)),
      ...(changed ? { log: [`キャプテンを変更（雰囲気${atmoDelta}）`, ...c.log].slice(0, 40) } : {}),
    }
    saveCareer(next)
    set({ career: next })
  },

  // #62: 3年引退直後の専用画面で初代キャプテンを選ぶ（雰囲気ペナルティなし）。
  pickInitialCaptain: (id) => {
    const c = get().career
    if (!c) return
    const roster = c.roster.map((p) => ({ ...p, isCaptain: p.id === id }))
    const next: CareerState = {
      ...c, roster, pendingCaptainChoice: false,
      log: [`新キャプテンに ${roster.find((p) => p.id === id)?.name ?? '選手'} を任命`, ...c.log].slice(0, 40),
    }
    saveCareer(next)
    set({ career: next, screen: 'weekly' })
  },

  setPlayerPosition: (id, pos) => {
    const c = get().career
    if (!c) return
    const roster = c.roster.map((p) => (p.id === id ? convertPosition(p, pos) : p))
    const next = { ...c, roster }
    saveCareer(next)
    set({ career: next })
  },

  renamePlayer: (id, name) => {
    const c = get().career
    if (!c) return
    const clean = name.trim().slice(0, 8)
    if (!clean) return
    const roster = c.roster.map((p) => (p.id === id ? { ...p, name: clean } : p))
    const next = { ...c, roster }
    saveCareer(next)
    set({ career: next })
  },

  finishIntake: () => {
    const c = get().career
    if (!c) return
    const next = { ...c, pendingIntake: [] }
    saveCareer(next)
    set({ career: next, screen: 'weekly' })
  },

  recommendPositions: () => {
    const c = get().career
    if (!c) return
    const roster = c.roster.map((p) => (p.isGK ? p : convertPosition(p, bestFieldPosition(p))))
    const next = { ...c, roster }
    saveCareer(next)
    set({ career: next })
  },

  setSetPieceTaker: (id) => {
    const c = get().career
    if (!c) return
    const next = { ...c, setPieceTaker: id }
    saveCareer(next)
    set({ career: next })
  },

  setPkTaker: (id) => {
    const c = get().career
    if (!c) return
    const next = { ...c, pkTaker: id }
    saveCareer(next)
    set({ career: next })
  },

  setTacticsPreset: (which, t) => {
    const c = get().career
    if (!c) return
    if (which === 'base' && t) set({ career: { ...c, tactics: t } })
    else if (which === 'lead') set({ career: { ...c, tacticsLead: t } })
    else if (which === 'behind') set({ career: { ...c, tacticsBehind: t } })
  },

  advance: () => {
    let career = get().career
    const plan = get().plan
    if (!career) return
    const outcome = advanceWeek(career, plan)
    saveCareer(outcome.state)

    // 🏕 夏合宿（7日サブモード・#34）。この週の通常練習結果(growthResult)を先に見せ、閉じたら合宿へ。
    if (outcome.interrupt === 'camp') {
      // G-41 §7: B/C合宿を裏で同時実行（B/C所属者のみ・軽い成長 + 覚醒判定）
      const bcOut = simulateBcCamp(outcome.state)
      const stateAfterBc = { ...outcome.state, roster: bcOut.roster }
      // 結果は pendingEvents に1件追加（A合宿終了時にBが見える）
      const stateWithBcEvent = bcOut.summary.gains.length > 0 || bcOut.summary.awakened.length > 0
        ? { ...stateAfterBc, pendingEvents: [...stateAfterBc.pendingEvents, {
            id: `bc-camp-${stateAfterBc.year}`,
            kind: 'flavor' as const,
            title: '🏕 B/Cチームの裏合宿',
            body: formatBcCampBody(bcOut.summary),
          }] }
        : stateAfterBc
      const camp = startCamp(stateWithBcEvent)
      const careerWithCamp: CareerState = { ...stateWithBcEvent, activeCamp: camp }
      saveCareer(careerWithCamp)
      const showGrowth = outcome.growthSummary && (outcome.growthSummary.gains.length > 0 || outcome.growthSummary.weekend != null || (outcome.growthSummary.injuries?.length ?? 0) > 0)
      set({
        career: careerWithCamp,
        lastSummary: outcome.growthSummary,
        growthResult: showGrowth ? outcome.growthSummary : null,
        campStage: 'intro',
        screen: showGrowth ? 'weekly' : 'camp',
      })
      return
    }

    if (outcome.interrupt) {
      const isNational = outcome.interrupt === 'summer-national' || outcome.interrupt === 'winter-national'
      const kind: CompKind = (outcome.interrupt === 'summer-tournament' || outcome.interrupt === 'summer-national') ? 'summer' : 'winter'
      const stage = isNational ? 'national' : 'qualify'
      const tournament = buildField(outcome.state, kind, stage)
      // 大会を career に永続化（大会モード・reload再開可・#11）
      const careerWithComp: CareerState = { ...outcome.state, activeComp: { kind, stage, tournament, matchTick: 0 } }
      saveCareer(careerWithComp)
      // 大会開幕週でも、その週の成長結果(練習・練習試合)を先に見せる。閉じたら大会へ（dismissGrowthがcomp有→comp-bracketへ）。
      const showGrowth = outcome.growthSummary && (outcome.growthSummary.gains.length > 0 || outcome.growthSummary.weekend != null || (outcome.growthSummary.injuries?.length ?? 0) > 0)
      set({
        career: careerWithComp,
        lastSummary: outcome.growthSummary,
        comp: { kind, stage, tournament, matchResult: null, matchHalf: null, lastOutcome: null, transitionMsg: isNational ? `${kind === 'summer' ? '夏季' : '冬季'}全国大会、開幕！` : null },
        growthResult: showGrowth ? outcome.growthSummary : null,
        screen: showGrowth ? 'weekly' : 'comp-bracket',
      })
      return
    }

    // G-44: 年度末週(3月末)でも週次練習結果UIを必ず表示する。
    //   旧: 年度末は週次成長UIを飛ばして 'summary' に直行 → 1年最後の練習結果が見えなかった。
    //   新: 成長があるなら 'weekly' に留めて GrowthResult を表示。dismissGrowth で 'summary' に進む。
    const showGrowthAtYearEnd = outcome.yearEnded && outcome.growthSummary && (outcome.growthSummary.gains.length > 0 || outcome.growthSummary.weekend != null || (outcome.growthSummary.injuries?.length ?? 0) > 0)
    set({
      career: outcome.state,
      lastSummary: outcome.growthSummary,
      growthResult: outcome.growthSummary && (outcome.growthSummary.gains.length > 0 || outcome.growthSummary.weekend != null || (outcome.growthSummary.injuries?.length ?? 0) > 0) ? outcome.growthSummary : null,
      yearJustEnded: outcome.yearEnded,
      // 年度繰越後は新入部員を含めて本職レーンへ自動割当し直す（1週目に新入生が休養で止まらないように）
      ...(outcome.yearEnded ? { plan: makeDefaultPlan(outcome.state) } : {}),
      screen: outcome.yearEnded && !showGrowthAtYearEnd ? 'summary' : 'weekly',
    })
  },

  // 成長結果を閉じる。大会／合宿／年度末サマリーが控えている（週次画面に表示中）ならその画面へ進む。
  dismissGrowth: () => {
    const { comp, screen, career, yearJustEnded } = get()
    if (comp && screen === 'weekly') set({ growthResult: null, screen: 'comp-bracket' })
    else if (career?.activeCamp && !career.activeCamp.done && screen === 'weekly') set({ growthResult: null, screen: 'camp' })
    else if (yearJustEnded && screen === 'weekly') set({ growthResult: null, screen: 'summary' })
    else set({ growthResult: null })
  },

  // 夏合宿サブモードを1ステップ進める（intro→1日目…→7日目→まとめ→メニュー復帰）。
  // 合宿を「1イベントずつ」進める。当日のキューを1件ずつ表示→尽きたら次の日を生成→全日終了でまとめ。
  nextCampStep: () => {
    const { career, campStage } = get()
    if (!career || !career.activeCamp) return
    if (campStage === 'choice') return // 選択が未解決の間は進めない（選択肢で進む）
    const camp = career.activeCamp
    if (campStage === 'summary') {
      const next: CareerState = { ...career, activeCamp: null }
      saveCareer(next); set({ career: next, campStage: null, screen: 'weekly' }); return
    }
    // ① 当日にまだ未表示イベントがあれば1件だけ表示
    if (camp.queue.length > 0) {
      const [ev, ...rest] = camp.queue
      const shown = camp.shown.map((d, i) => i === camp.shown.length - 1 ? { ...d, events: [...d.events, ev] } : d)
      const isChoice = !!ev.choice
      const next: CareerState = { ...career, activeCamp: { ...camp, queue: rest, shown, pendingChoice: isChoice } }
      saveCareer(next); set({ career: next, campStage: isChoice ? 'choice' : 'day' }); return
    }
    // ② 当日のイベントを出し切った → 全日終了ならまとめ
    if (camp.day >= CAMP_TOTAL_DAYS) {
      const next: CareerState = { ...career, activeCamp: { ...camp, done: true } }
      saveCareer(next); set({ career: next, campStage: 'summary' }); return
    }
    // ③ 次の日を生成し、最初のイベントを1件だけ表示
    const nd = camp.day + 1
    const gen = genCampDay(career, nd)
    const [first, ...rest] = gen.events
    const shown = [...camp.shown, { day: nd, events: first ? [first] : [] }]
    const isChoice = !!first?.choice
    const next: CareerState = {
      ...career, roster: gen.roster, atmosphere: gen.atmosphere,
      activeCamp: { ...camp, day: nd, skillsGained: gen.skillsGained, used: gen.used, queue: rest, shown, pendingChoice: isChoice },
    }
    saveCareer(next); set({ career: next, campStage: isChoice ? 'choice' : 'day' })
  },

  // 合宿の「監督の判断」を選択 → 効果反映して当日の表示へ戻る
  resolveCampChoice: (effectId) => {
    const career = get().career
    if (!career?.activeCamp) return
    const next = applyCampChoice(career, effectId)
    saveCareer(next)
    set({ career: next, campStage: 'day' })
  },

  // 🛠 検証用（devサーバ限定・?festival）: 使い捨てキャリアを文化祭2週間前(week26)で起動する（G-45）。
  // 「週を進める」を2回押すと week28 に入り、文化祭イベント（準備選択→当日→恋の噂）が先頭に出る。
  // 前後の通常週（week26/27/29〜）の挙動もそのまま確認できる。
  // disableSave() で本物のセーブ（tadatada_career_v1）には一切触れない。
  debugStartFestival: (seed) => {
    disableSave()
    // seed指定時は創部から完全再現（部員も文化祭の出来事も毎回同じ）。未指定なら毎回ランダム。
    const base = createCareer('検証高校', '東京都', 'デバッグ監督', 'expert', seed)
    const career: CareerState = {
      ...base,
      week: FESTIVAL_WEEK - 2,
      phase: phaseForWeek(FESTIVAL_WEEK - 2),
      pendingEvents: [],
      pendingIntake: [],
    }
    set({
      career,
      plan: makeDefaultPlan(career),
      screen: 'weekly',
      comp: null, campStage: null, growthResult: null, lastSummary: null, yearJustEnded: false,
    })
  },

  // 🛠 検証用（devサーバ限定・?selection）: 使い捨てキャリアを3月第1週(week45)で起動する。
  // セレクションON＋評判60（応募者24人前後）＋寮Lv3（学年枠14人＝最低10人ルールが生きる規模）。
  // 「週を進める」で 卒業(week46)→年度末(week48)→年度替わりにセレクション画面が出る。
  // disableSave() で本物のセーブ（tadatada_career_v1）には一切触れない。
  debugStartSelection: (seed) => {
    disableSave()
    const base = createCareer('選抜検証高校', '東京都', 'デバッグ監督', 'expert', seed)
    const career: CareerState = {
      ...base,
      week: 45,
      phase: phaseForWeek(45),
      reputation: 60,
      selectionEnabled: true,
      facilities: { ...base.facilities, dorm: 3 },
      pendingEvents: [],
      pendingIntake: [],
    }
    set({
      career,
      plan: makeDefaultPlan(career),
      screen: 'weekly',
      comp: null, campStage: null, growthResult: null, lastSummary: null, yearJustEnded: false,
    })
  },

  // 現在の練習プランのまま、次の大会／シーズン終了まで一気に進める
  fastForward: () => {
    let career = get().career
    const plan = get().plan
    if (!career) return
    let lastSummary = get().lastSummary
    let guard = 0
    while (guard++ < 60) {
      const outcome = advanceWeek(career, plan)
      career = outcome.state
      lastSummary = outcome.growthSummary
      if (outcome.interrupt === 'camp') {
        const camp = startCamp(career)
        career = { ...career, activeCamp: camp }
        saveCareer(career)
        set({ career, lastSummary, campStage: 'intro', screen: 'camp' })
        return
      }
      if (outcome.interrupt) {
        saveCareer(career)
        const isNational = outcome.interrupt === 'summer-national' || outcome.interrupt === 'winter-national'
        const kind: CompKind = (outcome.interrupt === 'summer-tournament' || outcome.interrupt === 'summer-national') ? 'summer' : 'winter'
        const stage = isNational ? 'national' : 'qualify'
        const tournament = buildField(career, kind, stage)
        const careerWithComp: CareerState = { ...career, activeComp: { kind, stage, tournament, matchTick: 0 } }
        saveCareer(careerWithComp)
        set({ career: careerWithComp, lastSummary, comp: { kind, stage, tournament, matchResult: null, matchHalf: null, lastOutcome: null, transitionMsg: isNational ? `${kind === 'summer' ? '夏季' : '冬季'}全国大会、開幕！` : null }, screen: 'comp-bracket' })
        return
      }
      if (outcome.yearEnded) {
        saveCareer(career)
        set({ career, lastSummary, yearJustEnded: true, plan: makeDefaultPlan(career), screen: 'summary' })
        return
      }
      // 選択イベントが出たら一旦停止して監督の判断を仰ぐ
      if (career.pendingEvents[0]?.kind === 'choice') {
        saveCareer(career)
        set({ career, lastSummary, screen: 'weekly' })
        return
      }
    }
    saveCareer(career)
    set({ career, lastSummary, screen: 'weekly' })
  },

  dismissSummary: () => {
    const c = get().career
    // セレクションON＝応募者プールがあれば選抜画面へ
    if (c?.pendingApplicants && c.pendingApplicants.length > 0) {
      set({ screen: 'selection', yearJustEnded: false })
    } else if (c?.pendingIntake && c.pendingIntake.length > 0) {
      // 新入部員がいれば入部式（1人ずつ確認・名前/ポジ/背番号設定）へ
      set({ screen: 'intake', yearJustEnded: false })
    } else {
      set({ screen: 'weekly', yearJustEnded: false })
    }
  },

  confirmSelection: (selectedIds) => {
    const c = get().career
    if (!c || !c.pendingApplicants) return
    const ids = new Set(selectedIds)
    const selected = c.pendingApplicants.filter((p) => ids.has(p.id))
      .map((p) => (p.isGK ? p : { ...p, position: bestFieldPosition(p) }))
    // 最低合格人数（min(10, 合格枠)）を下回る選抜は受け付けない。
    // 部員が減りすぎると新チームが組めなくなる（引退後に部員0の詰みも防ぐ）。UIも同じ条件でボタンを無効化している。
    const minAdmit = Math.min(10, c.admitCap ?? 10, c.pendingApplicants.length)
    if (selected.length < minAdmit) return

    // 選考の数週間、上級生＋スカウト組は通常どおり練習を継続（＝出遅れない）。
    const SELECTION_DELAY = 3
    let existing = c.roster
    const plan = c.lastPlan ?? get().plan
    for (let i = 0; i < SELECTION_DELAY; i++) {
      const rng = createRNG(hashSeed(`${c.rngSeed}-sel-${c.year}-${i}`))
      existing = applyWeeklyTraining(existing, plan, c.facilities, c.atmosphere, rng, 1.0, c.atmosphereB ?? c.atmosphere, undefined, 1.0, false, {}, c.staff).roster
    }
    // 選抜した一般応募者は、この3週の練習を受けていない＝彼らだけが出遅れる
    let roster = autoAssignSquads([...existing, ...selected])
    roster = roster.map((p) => ({ ...p, isCaptain: false }))
    const cap = [...roster].filter((p) => p.grade >= 2 && (p.squad ?? 'A') === 'A').sort((a, b) => b.abilities.iq - a.abilities.iq)[0]
    if (cap) cap.isCaptain = true

    const newWeek = Math.min(WEEKS_PER_YEAR, c.week + SELECTION_DELAY)
    // 合格者も入部式へ（既にスカウト組がpendingIntakeにいればそれに追加）
    const intake = [...(c.pendingIntake ?? []), ...selected.map((p) => p.id)]
    // ✨ セレクションの山場（紅白戦）で、誰かが「コツを掴む」ことがある（#34・控えめ）。
    const selRng = createRNG(hashSeed(`${c.rngSeed}-${c.year}-selskill`))
    const selPending: typeof c.pendingEvents = []
    if (selRng.next() < 0.5) {
      const gain = grantClimaxSkill(roster, selRng)
      if (gain) { roster = gain.roster; selPending.push({ id: `selskill-${c.year}`, kind: 'flavor', title: '✨ セレクションの収穫', body: `セレクションの紅白戦で、${gain.name}が「${gain.skill}」のコツをつかんだ！` }) }
    }
    const next: CareerState = {
      ...c, roster, pendingApplicants: undefined, admitCap: undefined,
      week: newWeek, phase: phaseForWeek(newWeek),
      pendingIntake: intake,
      pendingEvents: [...c.pendingEvents, ...selPending],
      log: [`セレクションで${selected.length}人が入部（選考の${SELECTION_DELAY}週は上級生・スカウト組が先行練習）`, ...c.log].slice(0, 40),
    }
    saveCareer(next)
    set({ career: next, screen: intake.length > 0 ? 'intake' : 'weekly' })
  },

  startCompMatch: () => {
    const { comp, career } = get()
    if (!comp) return
    const t = comp.tournament
    const idx = playerMatchIndex(t)
    const opp = playerOpponent(t)
    if (idx < 0 || !opp) return
    const m = t.rounds[t.roundIndex][idx]
    const isHome = m.homeId === t.playerId
    // 直前のスタメン/戦術変更を反映：大会突入時(buildField)のチームではなく、
    // キックオフ直前の現在のcareer状態から組み直す（ブラケット画面での変更が試合に乗る）。
    const player = career ? { ...careerToTeam(career), id: t.playerId } : t.teams[t.playerId]
    if (career) t.teams[t.playerId] = player
    const home = isHome ? player : opp
    const away = isHome ? opp : player
    const seed = matchSeed(t, t.roundIndex, idx)
    const bigMatch = comp.stage === 'national' && t.roundIndex >= 1
    // 気候適性：今週の天候×各校の出身地域（極端な天候で地域差が出る）
    const w = career?.weather as Weather | undefined
    const climateHome = w ? climateMatchCoef(home.prefecture, w) : 1
    const climateAway = w ? climateMatchCoef(away.prefecture, w) : 1
    // F7: 試合を始め、最初の采配ポイント（前半23分）まで進めて止める。
    //     以後 continueCompMatch で 45分(HT)→68分→最終 と進む。途中の任意点で交代/戦術可。
    const half = simulateOpeningSegment(home, away, seed, { knockout: true, bigMatch, climateHome, climateAway })
    set({ comp: { ...comp, matchResult: null, matchHalf: half }, screen: 'comp-match' })
  },

  // F7: 試合中の任意采配ポイントでの交代（自チームのみ）
  halfTimeSub: (outId, inId) => {
    const { comp } = get()
    if (!comp?.matchHalf) return
    const half = comp.matchHalf
    const me = half.sim.home.isPlayer ? 'home' : 'away'
    if (applySegmentSub(half, me, outId, inId)) set({ comp: { ...comp } })
  },

  // F7: 試合中の任意采配ポイントでの戦術変更（自チームのみ・基本戦術を差し替え）
  halfTimeTactics: (tactics) => {
    const { comp } = get()
    if (!comp?.matchHalf) return
    const half = comp.matchHalf
    const me = half.sim.home.isPlayer ? 'home' : 'away'
    applySegmentTactics(half, me, tactics)
    set({ comp: { ...comp } })
  },

  // F7: 次の停止点まで進める（最終なら結果を確定）。MatchView の「再開」ボタンが呼ぶ。
  continueCompMatch: () => {
    const { comp } = get()
    if (!comp?.matchHalf) return
    const r = advanceMatchSegment(comp.matchHalf)
    if (r.kind === 'final') {
      set({ comp: { ...comp, matchResult: r.result } })
    } else {
      set({ comp: { ...comp } })
    }
  },

  // 後方互換: 残りセグメントを最終結果まで一気に消化（テストスクリプト・store駆動シミュ用）
  resumeCompMatch: () => {
    const { comp } = get()
    if (!comp?.matchHalf) return
    let safety = 8
    while (safety-- > 0) {
      const cur = get().comp
      if (!cur?.matchHalf) return
      const r = advanceMatchSegment(cur.matchHalf)
      if (r.kind === 'final') {
        set({ comp: { ...cur, matchResult: r.result } })
        return
      }
      set({ comp: { ...cur } })
    }
    // 安全弁: ループ過剰時は旧API（resumeSecondHalf）で締める
    const cur = get().comp
    if (cur?.matchHalf) {
      const result = resumeSecondHalf(cur.matchHalf)
      set({ comp: { ...cur, matchResult: result } })
    }
  },

  finishCompMatch: () => {
    const { comp, career } = get()
    if (!comp || !career || !comp.matchResult) return
    const t = comp.tournament
    const idx = playerMatchIndex(t)
    const r = comp.matchResult

    // 試合経験による成長＋出場者の疲労・調子変動
    const playerTeam = t.teams[t.playerId]
    const starterIds = new Set(playerTeam.players.slice(0, 11).map((p) => p.id))
    const won = r.winnerId === t.playerId
    // 強い相手と戦うほど試合経験での伸びが大きい（格上戦＝学びが大きい）。
    //   互角=1.0／大幅格上≈1.6／格下≈0.75。難県＝強豪と多く戦う＝経験で育つ（県優勝が遅い分を相殺）。
    const teamAvg = (tm: typeof playerTeam) => tm.players.slice(0, 11).reduce((s, p) => s + playerOverallSum(p), 0) / 11 / 7
    const opp = playerOpponent(t)
    // 格上ほど経験で伸びる「方向」は残しつつ、効きを弱める（難県が普通を追い越さない＝全体で簡単にならない）。
    const expScale = opp ? Math.max(0.92, Math.min(1.12, 1 + (teamAvg(opp) - teamAvg(playerTeam)) / 80)) : 1
    const grown = applyMatchExperience(career.roster, starterIds, career.facilities, career.atmosphere, simRng(career), expScale)
    // 試合後の成長表示（誰が何伸びたか）＝週次と同じ成長モーダルで見せる（CareerAppでグローバル描画）。
    const grpOf = (pos: string): 'gk' | 'df' | 'mf' | 'fw' => pos === 'GK' ? 'gk' : (['CB', 'SB', 'WB'].includes(pos) ? 'df' : ['CF', 'WF'].includes(pos) ? 'fw' : 'mf')
    const matchGains: GrowthSummary['gains'] = []
    // 試合経験は「ピッチに出た選手すべて」が対象（先発フル / 先発で交代された / 途中出場）。
    // 先発リストとピッチ最終11人のユニオンが、その試合に絡んだ選手。
    const playedIds = new Set<string>(starterIds)
    // ピッチ最終時点の11人も含める（途中出場の検出）
    if (comp.matchHalf) {
      const finalSide = comp.matchHalf.sim.home.isPlayer ? comp.matchHalf.sim.H.starters : comp.matchHalf.sim.away.isPlayer ? comp.matchHalf.sim.A.starters : []
      for (const p of finalSide) playedIds.add(p.id)
    }
    for (const p of grown) {
      if (!playedIds.has(p.id)) continue
      const before = career.roster.find((q) => q.id === p.id)
      if (!before) continue
      const d = playerOverallSum(p) - playerOverallSum(before)
      const pos = p.slot ?? p.position
      if (d >= 0.4) matchGains.push({ name: p.name, ability: '試合経験', amount: d, group: grpOf(pos), pos, grade: p.grade, note: expScale >= 1.15 ? '格上との対戦で大きく成長' : undefined })
    }
    matchGains.sort((a, b) => b.amount - a.amount)
    const matchSummary: GrowthSummary = {
      gains: matchGains.slice(0, 10), restedCount: 0, weekend: null,
      topGrowers: matchGains.slice(0, 3).map((g) => ({ name: g.name, total: g.amount, mainAbility: g.ability })),
    }
    if (matchSummary.gains.length > 0) set({ growthResult: matchSummary })
    const condDelta = won ? 1 : -1
    // 今季得点を加算（自チームの得点者をplayerIdで照合＝同名でも誤加算しない）
    const goalsById: Record<string, number> = {}
    for (const s of (r.scorers ?? [])) if (s.teamId === t.playerId) goalsById[s.playerId] = (goalsById[s.playerId] ?? 0) + 1
    // 出場区分による疲労差：先発フル / 先発で交代された / 途中出場 / 出場なし
    //   交代情報は試合終了時の matchHalf.sim から差分で取得（origStartersにいて今ピッチに居ない=途中交代/今ピッチに居て元先発じゃない=途中出場）。
    //   延長戦があった場合は出場者の疲労に追加分（extraFatigue）。
    const half = comp.matchHalf
    const me = half?.sim.home.isPlayer ? 'home' : half?.sim.away.isPlayer ? 'away' : null
    const origStartersSet = new Set<string>(
      me === 'home' ? half!.homeStart.map((p) => p.id)
      : me === 'away' ? half!.awayStart.map((p) => p.id)
      : Array.from(starterIds),
    )
    const finalStartersSet = new Set<string>(
      me === 'home' ? half!.sim.H.starters.map((p) => p.id)
      : me === 'away' ? half!.sim.A.starters.map((p) => p.id)
      : Array.from(starterIds),
    )
    const extraTime = (r.beats ?? []).some((b) => b.action === 'extra-start')
    const extraFatigue = extraTime ? 4 : 0  // 延長戦があった試合は出場者に追加疲労
    const rosterAfter = grown.map((p) => {
      const g = goalsById[p.id] ?? 0
      const base = g > 0 ? { ...p, seasonGoals: (p.seasonGoals ?? 0) + g } : p
      const wasStarter = origStartersSet.has(base.id)
      const onPitchAtEnd = finalStartersSet.has(base.id)
      const playedFull = wasStarter && onPitchAtEnd
      const subbedOff = wasStarter && !onPitchAtEnd  // 先発で交代された
      const cameOn = !wasStarter && onPitchAtEnd     // ベンチから出場
      if (playedFull) {
        return {
          ...base,
          fatigue: Math.min(100, base.fatigue + 12 + extraFatigue),
          seasonApps: (base.seasonApps ?? 0) + 1,
          condition: Math.max(1, Math.min(5, base.condition + condDelta)) as 1 | 2 | 3 | 4 | 5,
        }
      }
      if (subbedOff) {
        return {
          ...base,
          fatigue: Math.min(100, base.fatigue + 8 + Math.floor(extraFatigue / 2)),
          seasonApps: (base.seasonApps ?? 0) + 1,
          condition: Math.max(1, Math.min(5, base.condition + condDelta)) as 1 | 2 | 3 | 4 | 5,
        }
      }
      if (cameOn) {
        // ベンチから出場した選手は出場時間が短い分、疲労は控えめ・回復はなし
        return {
          ...base,
          fatigue: Math.min(100, base.fatigue + 6 + Math.floor(extraFatigue / 2)),
          seasonApps: (base.seasonApps ?? 0) + 1,
          condition: Math.max(1, Math.min(5, base.condition + condDelta)) as 1 | 2 | 3 | 4 | 5,
        }
      }
      // 試合に出なかった選手（ベンチ控え・招集外・B/C）は少し疲労が回復する＝休養効果。
      if (base.retired) return base
      return { ...base, fatigue: Math.max(0, base.fatigue - 3) }
    })
    let nextCareer: CareerState = { ...career, roster: rosterAfter }

    // #72: 大会初勝利を記録（既に記録済みなら据え置き）。tier10スポンサー解放トリガー＋次の大会終了でチュートリアル発火。
    const priorFirstCompWinYear = career.records.firstCompWinYear
    if (won && priorFirstCompWinYear == null) {
      nextCareer = { ...nextCareer, records: { ...nextCareer.records, firstCompWinYear: nextCareer.year } }
    }

    const out = applyPlayerResult(
      t, idx, r.homeScore, r.awayScore, r.winnerId ?? '',
      r.decidedByPK, r.decidedByPK ? [r.homePK ?? 0, r.awayPK ?? 0] : null,
    )

    // 暦消費（#11・大会モード）: 2試合で約1週すすむ。
    // 大会週も選手は試合の合間に軽く練習する（growthScale 0.75）＝消費した週の育成を補填。
    // これが無いと「深く勝ち上がる＝練習週を失う」ため最適育成がかえって不利になり、
    // 育成の腕の差（最適/一般の優勝年数倍率）が消えてしまう。少しの疲労回復も入れる。
    const prevTick = career.activeComp?.matchTick ?? 0
    let compTick = prevTick + 1
    if (compTick >= 2 && nextCareer.week < WEEKS_PER_YEAR) {
      compTick = 0
      const w = nextCareer.week + 1
      const plan = get().plan
      const lightTrained = applyWeeklyTraining(
        nextCareer.roster, plan, nextCareer.facilities, nextCareer.atmosphere,
        simRng({ ...nextCareer, week: w }), 1.0, nextCareer.atmosphereB ?? nextCareer.atmosphere, undefined, 1.0,
        false, {}, nextCareer.staff,
      ).roster
      nextCareer = {
        ...nextCareer,
        week: w,
        phase: phaseForWeek(w),
        roster: lightTrained.map((p) => ({ ...p, fatigue: Math.max(0, p.fatigue - 8) })),
      }
    } else if (compTick >= 2) {
      compTick = 0
    }

    if (out.isFinalRound || out.eliminated) {
      // このステージ終了
      const placement = playerPlacement(t)
      const prevChampYear = career.lastQualifyChamp?.[comp.kind]
      const compOut = applyCompResult(nextCareer, comp.kind, comp.stage, placement, stageReachedLabel(t))
      nextCareer = compOut.state
      // 全国優勝年を記録（連覇の厳密判定用）。
      if (comp.stage === 'national' && placement === 3) {
        nextCareer = { ...nextCareer, natTitleYears: [...(nextCareer.natTitleYears ?? []), nextCareer.year] }
      }
      // 🏅 実績の解禁（account永続）＋新規解禁はイベントで通知。
      const newAch = checkAchievements(nextCareer, { stage: comp.stage, kind: comp.kind, placement, qualifiedNational: compOut.qualifiedNational, prevQualifyChampYear: prevChampYear })
      if (newAch.length > 0) {
        nextCareer = { ...nextCareer, pendingEvents: [...nextCareer.pendingEvents, ...newAch.map((id) => ({ id: `ach-${id}-${nextCareer.year}`, kind: 'news' as const, title: '🏅 実績解除', body: `「${achievementById(id)?.name ?? id}」を達成した！（記録画面で確認できる）` }))] }
      }

      // #72: 大会初勝利を含んだ大会が終わったら、翌週にスポンサー解放チュートリアルを発火
      const justGotFirstWin = priorFirstCompWinYear == null && nextCareer.records.firstCompWinYear != null
      if (justGotFirstWin && !nextCareer.records.sponsorIntroSeen) {
        nextCareer = {
          ...nextCareer,
          records: { ...nextCareer.records, sponsorIntroSeen: true },
          pendingEvents: [...nextCareer.pendingEvents, {
            id: `sponsor-intro-${nextCareer.year}`, kind: 'flavor',
            title: '💰 スポンサーが声をかけてきた',
            body: '大会で勝ち上がったことで、地元のスポンサーがチームに目を留めた。\n運営画面の「💰 スポンサー」から、メイン枠とユニフォーム枠の2契約を結べる。月収が増えれば、設備への投資もラクになる。\n契約期間は6ヶ月／1年／2年から選べる。期間中は変更できないが違約金は無いから、まず試してみよう。',
          }],
        }
      }

      // 🏆 大会の山場で特殊能力が開花（#34）。優勝＝高確率／全国の手応え＝中／早期敗退＝低。
      // 立役者（今季得点が多い選手）が新しい武器を掴む。合宿がメイン源なので確率は控えめ。
      // 合宿がメイン源なので大会の付与は控えめ（年~1個程度に収める）。優勝＝特別な瞬間。
      const isChampion = out.isFinalRound && won
      const climaxProb = isChampion ? 0.55 : comp.stage === 'national' ? 0.25 : out.eliminated ? 0.1 : 0.15
      const climaxRng = createRNG(hashSeed(`${nextCareer.rngSeed}-${nextCareer.year}-compskill-${comp.kind}-${comp.stage}`))
      if (climaxRng.next() < climaxProb) {
        const hero = [...nextCareer.roster].filter((p) => !p.retired).sort((a, b) => (b.seasonGoals ?? 0) - (a.seasonGoals ?? 0))[0]
        const gain = grantClimaxSkill(nextCareer.roster, climaxRng, hero?.id)
        if (gain) {
          const head = isChampion ? '優勝の立役者' : comp.stage === 'national' ? '全国の舞台で' : '大会を経て'
          nextCareer = {
            ...nextCareer,
            roster: gain.roster,
            pendingEvents: [...nextCareer.pendingEvents, { id: `compskill-${nextCareer.year}-${comp.kind}-${comp.stage}`, kind: 'flavor', title: '✨ 大舞台が選手を変える', body: `${head}、${gain.name}が特殊能力「${gain.skill}」をつかんだ！` }],
          }
        }
      }
      saveCareer(nextCareer)

      if (comp.stage === 'qualify' && compOut.qualifiedNational) {
        // 県予選を突破。全国は後日（別の暦週）に開催する（#11）。今はメニューに戻り、
        // 全国までの数週間で疲労を抜き・戦術を練り直せる＝大会が現実的な期間に渡る。
        // 大会(予選)は完了。全国は後日 新たな activeComp として始まる。今は永続大会をクリア。
        nextCareer = { ...nextCareer, pendingNational: comp.kind, activeComp: null }
        saveCareer(nextCareer)
        set({
          career: nextCareer,
          comp: { ...comp, tournament: t, matchResult: null, matchHalf: null, lastOutcome: compOut },
          screen: 'comp-result',
        })
      } else {
        // 大会(campaign)完了 → 永続大会をクリア。全国終了なら pendingNational もクリア。
        nextCareer = { ...nextCareer, activeComp: null }
        if (comp.stage === 'national') {
          // potトレンド用：今回の全国でのpot番号を保存（次回の全国で「前回→今回」を表示＝立ち位置の変化）。
          const pAvg = (tm: typeof playerTeam) => { const s = tm.players.slice(0, 11); return s.length ? s.reduce((q, p) => q + playerOverallSum(p), 0) / s.length : 0 }
          const rank = [...Object.values(t.teams)].sort((a, b) => pAvg(b) - pAvg(a)).findIndex((tm) => tm.id === t.playerId)
          nextCareer = { ...nextCareer, pendingNational: undefined, lastNatPot: Math.floor(Math.max(0, rank) / 4) + 1 }
        }
        // 冬の大会を終えた時点で3年生は引退（#33）＝部活から離れる（選手一覧からも消える）。
        // この引退の節目に「魂の継承＋新キャプテン画面遷移フラグ」をまとめて起こす（卒業=3月は進路＋まとめに分離）。
        //   新キャプテンは #62 でユーザー選択方式に変更（pendingCaptainChoice を立て、weekly側で new-captain 画面へ）。
        // 残りの週(2-3月)は1・2年の新チームで回す＝世代交代。
        if (comp.kind === 'winter') {
          const retiring = nextCareer.roster.filter((p) => p.grade === 3 && !p.retired)
          if (retiring.length > 0) {
            const retRng = createRNG(hashSeed(`${nextCareer.rngSeed}-${nextCareer.year}-retire`))
            // 1. 3年を引退に（在籍は年度末卒業まで維持。表示は選手一覧から除外）
            let roster = nextCareer.roster.map((p) => (p.grade === 3 ? { ...p, retired: true } : p))
            // 2. 魂の継承（約55%・引退する先輩→残る後輩）
            const inh = retRng.next() < 0.55 ? inheritFromGraduates(roster, retiring, retRng) : { roster, text: null }
            roster = inh.roster
            // 3. #62: 旧キャプテンの腕章を外す。新キャプテンはユーザーが next-captain 画面で選ぶ。
            //   自動任命は廃止（newCaptainGainsCaptaincy も呼ばない＝雰囲気±変動なし＝ユーザー選択が物語）。
            roster = roster.map((p) => ({ ...p, isCaptain: false }))
            const evts: CareerState['pendingEvents'] = [
              { id: `retire-${nextCareer.year}`, kind: 'flavor', title: '3年生、引退',
                body: `冬の大会を最後に、3年生${retiring.length}名が部を引退した。今日でグラウンドを去る——残された1・2年が新チームを背負う。（${retiring.slice(0, 6).map((p) => p.name).join('、')}${retiring.length > 6 ? ' ほか' : ''}）` },
            ]
            if (inh.text) evts.push({ id: `inherit-${nextCareer.year}`, kind: 'flavor', title: '🎓 最後の居残り', body: inh.text })
            nextCareer = {
              ...nextCareer,
              roster,
              // #62: 次の weekly 表示時に new-captain 画面へ。
              // 引退後に現役が1人もいない場合は立てない（選べる相手がいない＝画面が詰むため）。
              pendingCaptainChoice: roster.some((p) => !p.retired),
              pendingEvents: [...evts, ...nextCareer.pendingEvents],
            }
            saveCareer(nextCareer)
          }
        }
        set({
          career: nextCareer,
          comp: { ...comp, tournament: t, matchResult: null, matchHalf: null, lastOutcome: compOut },
          screen: 'comp-result',
        })
      }
    } else {
      // 次ラウンドへ。永続大会(activeComp)に進行中のトーナメントと暦tickを反映し保存（reload再開可）。
      nextCareer = { ...nextCareer, activeComp: { kind: comp.kind, stage: comp.stage, tournament: t, matchTick: compTick } }
      saveCareer(nextCareer)
      set({ career: nextCareer, comp: { ...comp, tournament: t, matchResult: null, matchHalf: null }, screen: 'comp-bracket' })
    }
  },

  continueAfterComp: () => {
    let c = get().career
    // 大会を抜けたら永続大会フラグも確実にクリア（防御的・通常はfinishCompMatchでnull済み）
    if (c && c.activeComp) c = { ...c, activeComp: null }
    if (c) saveCareer(c)
    set({ career: c, comp: null, screen: 'weekly' })
  },

  investCandidate: (id) => {
    const c = get().career
    if (!c) return
    const candidates = c.scouting.candidates.map((x) =>
      x.id === id ? { ...x, player: { ...x.player } } : x)
    const cand = candidates.find((x) => x.id === id)
    if (!cand) return
    const res = investInCandidate(cand, c.scouting.sp)
    if (!res.ok) return
    set({ career: { ...c, scouting: { ...c.scouting, candidates, sp: c.scouting.sp - res.cost } } })
  },

  toggleShortlist: (id) => {
    const c = get().career
    if (!c) return
    const cand = c.scouting.candidates.find((x) => x.id === id)
    if (!cand || cand.discovery < 2) return
    const sl = c.scouting.shortlist.includes(id)
      ? c.scouting.shortlist.filter((x) => x !== id)
      : [...c.scouting.shortlist, id]
    set({ career: { ...c, scouting: { ...c.scouting, shortlist: sl } } })
  },

  setJersey: (id, num) => {
    const c = get().career
    if (!c) return
    const roster = setJerseyNumber(c.roster, id, num)
    const next = { ...c, roster }
    saveCareer(next); set({ career: next })
  },

  setOffer: (id, level) => {
    const c = get().career
    if (!c) return
    const candidates = c.scouting.candidates.map((x) =>
      x.id === id ? { ...x, offer: Math.max(0, Math.min(2, level)) } : x)
    set({ career: { ...c, scouting: { ...c.scouting, candidates } } })
  },

  upgrade: (key) => {
    const c = get().career
    if (!c) return
    const next = upgradeFacility(c, key)
    if (next !== c) {
      saveCareer(next)
      // トレーニング設備強化で練習枠が増えたら、不足分の枠を追加（既存の割当・メニューは保持）
      const plan = get().plan
      const cap = practiceLaneCount(next.facilities.training, coachCount(next))
      if (plan.lanes.length < cap) {
        set({ career: next, plan: { ...plan, lanes: defaultLanes(cap).map((d, i) => plan.lanes[i] ?? d) } })
      } else {
        set({ career: next })
      }
    }
  },

  buyExtra: (id) => {
    const c = get().career
    if (!c) return
    const next = buyExtra(c, id)
    if (next !== c) { saveCareer(next); set({ career: next }) }
  },

  hireStaff: (id) => {
    const c = get().career
    if (!c) return
    let next = hireStaff(c, id)
    if (next !== c) {
      // G-33: B/Cチームコーチ採用時に解放チュートリアルを pendingEvents に追加（次の週開始時に表示）
      if (id === 'bcoach') {
        const ev = {
          id: `tut-b-${next.year}-${next.week}`, kind: 'flavor' as const, title: '🔓 Bチームが解放',
          body: 'Bチームコーチを雇い、Bチームが解放された。\n編成画面で、Aチーム以外の部員をBチームに入れられる。Bチームは週末に自分たちで練習試合を組んで実戦経験を積み、まれに一皮むける選手が出る。Aの控えと併せて、チームの厚みを作ろう。',
        }
        next = { ...next, pendingEvents: [...next.pendingEvents, ev] }
      } else if (id === 'ccoach') {
        const ev = {
          id: `tut-c-${next.year}-${next.week}`, kind: 'flavor' as const, title: '🔓 Cチームが解放',
          body: 'Cチームコーチを雇い、Cチームが解放された。\n部員も寮もここまで揃えたチームだけがたどり着ける規模だ。Bチームのさらに一段下で経験を積む層を作れる。3チームで、長い目で選手を育てられるようになった。',
        }
        next = { ...next, pendingEvents: [...next.pendingEvents, ev] }
      } else if (id === 'scout-chief') {
        // G-38 予防：スカウト主任雇用後の影響（スカウト機能本体解放）を明示
        const ev = {
          id: `tut-scout-chief-${next.year}-${next.week}`, kind: 'flavor' as const, title: '🔓 スカウト主任が就任',
          // G-44: 2ページに短縮。
          body: 'スカウト主任が就任した。候補生の調査や勧誘リストが使えるようになる。\n広域スカウトを併せて雇えば、もっと広い地区から候補を見つけられる。',
        }
        next = { ...next, pendingEvents: [...next.pendingEvents, ev] }
      } else if (id === 'scout-net') {
        const ev = {
          id: `tut-scout-net-${next.year}-${next.week}`, kind: 'flavor' as const, title: '広域スカウトが加入',
          body: '広域スカウトを雇った。毎週のスカウトSPが2増え、追える候補も4人増える。県外まで足を運べるようになった。',
        }
        next = { ...next, pendingEvents: [...next.pendingEvents, ev] }
      } else if (id === 'coach' || id === 'coach2') {
        const ev = {
          id: `tut-coach-${id}-${next.year}-${next.week}`, kind: 'flavor' as const, title: 'コーチを採用',
          body: `${id === 'coach' ? '専属フィジカルコーチ' : 'アシスタントコーチ'}を採用した。同時に組める練習が1つ増え、練習での伸びも ${id === 'coach' ? '12%' : '8%'} 上がる。練習メニューを組み直そう。`,
        }
        next = { ...next, pendingEvents: [...next.pendingEvents, ev] }
      } else if (id === 'trainer') {
        const ev = {
          id: `tut-trainer-${next.year}-${next.week}`, kind: 'flavor' as const, title: '専属トレーナーが加入',
          body: '専属トレーナーを採用した。疲労回復が早まり、選手が好調を保ちやすくなる。連戦・夏場のコンディション維持に効く。',
        }
        next = { ...next, pendingEvents: [...next.pendingEvents, ev] }
      }
      saveCareer(next)
      // #29: コーチ採用で練習枠が増えたら、不足分の枠を追加（既存の割当・メニューは保持）
      const plan = get().plan
      const cap = practiceLaneCount(next.facilities.training, coachCount(next))
      if (plan.lanes.length < cap) set({ career: next, plan: { ...plan, lanes: defaultLanes(cap).map((d, i) => plan.lanes[i] ?? d) } })
      else set({ career: next })
    }
  },

  runObInstruction: (tier) => {
    const c = get().career
    if (!c) return
    const rng = createRNG(c.year * 31 + c.week + 12345)
    const next = runObInstructionImpl(c, tier, rng)
    if (next !== c) { saveCareer(next); set({ career: next }) }
  },

  signSponsor: (slot, defId) => {
    const c = get().career
    if (!c) return
    const next = signSponsorImpl(c, slot, defId)
    if (next !== c) { saveCareer(next); set({ career: next }) }
  },

  setPlayerSquad: (id, squad) => {
    const c = get().career
    if (!c) return
    const roster = c.roster.map((p) => p.id === id ? { ...p, squad } : p)
    const next = { ...c, roster }
    saveCareer(next); set({ career: next })
    // squad変更時、A昇格者にはレーンを自動割当・降格者はレーンから外す
    const plan = get().plan
    const ctx = { roster: { length: roster.length }, facilities: { dorm: c.facilities.dorm }, staff: c.staff }
    const target = roster.find((p) => p.id === id)
    if (!target) return
    const assign = { ...plan.assign }
    if (squadCategoryOf(target, ctx) === 'A') {
      assign[id] = laneForGroup(practiceGroupOf(target), plan.lanes.length)
    } else {
      delete assign[id]
    }
    set({ plan: { ...plan, assign } })
  },

  autoAssignSquad: () => {
    const c = get().career
    if (!c) return
    const newRoster = autoAssignSquads(c.roster)
    const next = { ...c, roster: newRoster }
    saveCareer(next); set({ career: next })
    // squad再編後、レーン割当もAメンバーのみに同期し直す
    const plan = get().plan
    set({ plan: { ...plan, assign: autoAssignByPosition(newRoster, plan.lanes.length, next) } })
  },

  toggleSelection: () => {
    const c = get().career
    if (!c || c.reputation < 50) return
    const next = { ...c, selectionEnabled: !c.selectionEnabled }
    saveCareer(next); set({ career: next })
  },

  resolveEvent: (effectId) => {
    const c = get().career
    if (!c) return
    // #31: 定期考査の選択（📚勉強優先 / ⚽練習続行）。
    //   選んだ直後は結果を出さず、pendingExam で次週まで持ち越す。テスト返却は1週後（自然なタイミング）。
    if (effectId === 'exam_study' || effectId === 'exam_train') {
      const study = effectId === 'exam_study'
      const remaining = c.pendingEvents.slice(1)
      const next = { ...c, pendingEvents: remaining, pendingExam: { study, askedYear: c.year, askedWeek: c.week } }
      saveCareer(next); set({ career: next }); return
    }
    // 創部イベントを閉じたら、そのままポジション配属画面へ（入部時に自分で配属できる）
    const wasFounding = c.pendingEvents[0]?.id === 'founding'
    const evObj = c.pendingEvents[0]
    const baseEff = CHOICE_EFFECTS[effectId] ?? {}
    const rng = simRng(c)
    // G-29: risk があれば確率で成功/失敗の outcome に分岐（どちらも前向きな結果）。なければ baseEff をそのまま使う。
    const outcome = baseEff.risk
      ? (rng.next() < baseEff.risk.p ? baseEff.risk.success : baseEff.risk.fail)
      : baseEff
    // G-03/G-28: 結果の地の文。{name}/{name2}は出題時と同じ選手で置換。
    const fillName = (s: string) => s.replace(/\{name2\}/g, evObj?.actorName2 ?? '別の選手').replace(/\{name\}/g, evObj?.actorName ?? '選手')
    let roster = outcome.fatigueAll
      ? c.roster.map((p) => ({ ...p, fatigue: Math.max(0, Math.min(100, p.fatigue + (outcome.fatigueAll ?? 0))) }))
      : c.roster
    // 能力ブースト（育成イベントの運）：対象からn人選び、ランダムな能力を lo〜hi 上げる
    const boostChosenNames: string[] = []
    if (outcome.boost) {
      const boost = outcome.boost
      const pool = boost.target === 'bc' ? roster.filter((p) => (p.squad ?? 'A') !== 'A') : roster.slice()
      const chosen = new Set<string>()
      for (let i = 0; i < boost.n && pool.length > 0; i++) {
        const pick = pool[Math.floor(rng.next() * pool.length)]
        if (pick && !chosen.has(pick.id)) {
          chosen.add(pick.id)
          boostChosenNames.push(pick.name)
        }
      }
      const ks: (keyof CareerState['roster'][number]['abilities'])[] = ['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense']
      roster = roster.map((p) => {
        if (!chosen.has(p.id)) return p
        const amt = boost.lo + Math.round(rng.next() * (boost.hi - boost.lo))
        if (p.isGK && p.gk) return { ...p, gk: { ...p.gk, saving: Math.min(99, p.gk.saving + amt) } }
        const k = ks[Math.floor(rng.next() * ks.length)]
        return { ...p, abilities: { ...p.abilities, [k]: Math.min(99, p.abilities[k] + amt) } }
      })
    }
    // 解決したのは先頭1件のみ。残りは順に表示する（創部→基礎説明など複数イベントの取りこぼし防止）。
    const remaining = c.pendingEvents.slice(1)
    // G-03/G-28: 選択結果＝地の文（物語）＋数値バッジを必ず明示。数値が0でも地の文があれば結果を出す。
    const evTitle = evObj?.title ?? '結果'
    const fbLines: string[] = []
    if (outcome.budget && outcome.budget > 0) fbLines.push(`💴 部費 +${outcome.budget}万円`)
    else if (outcome.budget && outcome.budget < 0) fbLines.push(`💴 部費 -${Math.abs(outcome.budget)}万円`)
    if (outcome.atmo && outcome.atmo > 0) fbLines.push(`🎈 チームの雰囲気 +${outcome.atmo}`)
    else if (outcome.atmo && outcome.atmo < 0) fbLines.push(`🌧 チームの雰囲気 ${outcome.atmo}`)
    if (outcome.fatigueAll && outcome.fatigueAll > 0) fbLines.push(`💦 全員の疲労 +${outcome.fatigueAll}`)
    else if (outcome.fatigueAll && outcome.fatigueAll < 0) fbLines.push(`🛌 全員の疲労 ${outcome.fatigueAll}`)
    if (outcome.boost) {
      const subject = boostChosenNames.length > 0
        ? boostChosenNames.join('、')
        : `${outcome.boost.n}人`
      fbLines.push(`✨ ${subject}の能力が +${outcome.boost.lo}〜${outcome.boost.hi} 伸びた！`)
    }
    const resultBody = [outcome.result ? fillName(outcome.result) : '', ...fbLines].filter(Boolean).join('\n')
    const resultEv = resultBody
      ? { id: `result-${effectId}-${c.year}-${c.week}`, kind: 'flavor' as const, title: `${evTitle}：結果`, body: resultBody }
      : null
    const enqueued = resultEv ? [resultEv, ...remaining] : remaining
    const next = {
      ...c,
      roster,
      atmosphere: Math.max(0, Math.min(100, c.atmosphere + (outcome.atmo ?? 0))),
      budget: Math.max(0, c.budget + (outcome.budget ?? 0)),
      pendingEvents: enqueued,
    }
    saveCareer(next)
    if (enqueued.length > 0) { set({ career: next }); return } // 次のイベント or 結果フィードバックを表示
    // 全イベント消化 → 新入部員がいれば入部式へ。創部直後も同様（founding時はpendingIntakeを設定済み）。
    if (next.pendingIntake && next.pendingIntake.length > 0) set({ career: next, screen: 'intake' })
    else set(wasFounding ? { career: next, screen: 'positions' } : { career: next })
  },
}))

// 試合経験成長用のRNG（年・週から導出して再現性確保）
function simRng(c: CareerState) {
  return createRNG((c.rngSeed ^ (c.year * 131 + c.week * 17)) >>> 0)
}
