// ============================================================
// career/hallOfFame.ts — #55 殿堂/コレクション（プレイをまたぐ永続保存）
// 1つのキャリアを超えて「歴代の名選手・全国制覇・名キャリア」をローカルに蓄積する。
// 育成のご褒美＋将来のオンライン対戦(別タスク)の基盤。プレイヤーデータは外部に出さない＝ローカル保持。
// ============================================================

import type { CareerState } from './types'

const HOF_KEY = 'tadatada_hof_v1'
const MAX_PROS = 23      // 名選手23人（spec）
const MAX_CAREERS = 5    // ベスト年代5（spec）
const MAX_CHAMPS = 30
const MAX_MANAGERS = 23  // G-32 §8: マネージャー殿堂 23人

export interface HofPro { name: string; school: string; year: number }
export interface HofChampion { school: string; year: number; kind: 'summer' | 'winter' }
export interface HofCareer { id: string; school: string; titles: number; graduates: number; proCount: number; years: number }
// G-32 §8: マネージャー殿堂 1キャリア1人・古い順に押し出し
export interface HofManager { name: string; school: string; year: number; trait: string }
export interface HallOfFame { pros: HofPro[]; champions: HofChampion[]; careers: HofCareer[]; managers?: HofManager[] }

const EMPTY: HallOfFame = { pros: [], champions: [], careers: [], managers: [] }

export function loadHallOfFame(): HallOfFame {
  try {
    const raw = localStorage.getItem(HOF_KEY)
    if (!raw) return { ...EMPTY, managers: [] }
    const h = JSON.parse(raw) as Partial<HallOfFame>
    return { pros: h.pros ?? [], champions: h.champions ?? [], careers: h.careers ?? [], managers: h.managers ?? [] }
  } catch { return { ...EMPTY, managers: [] } }
}

/** G-32 §8: マネージャーをHoFに登録（1キャリア1人想定・古い順に押し出し） */
export function registerHofManager(entry: HofManager): HallOfFame {
  const h = loadHallOfFame()
  // 重複排除（名前+学校+年）
  const key = `${entry.name}__${entry.school}__${entry.year}`
  const seen = new Set((h.managers ?? []).map((m) => `${m.name}__${m.school}__${m.year}`))
  if (!seen.has(key)) {
    h.managers = [entry, ...(h.managers ?? [])].slice(0, MAX_MANAGERS)
    persist(h)
  }
  return h
}

function persist(h: HallOfFame): void {
  try { localStorage.setItem(HOF_KEY, JSON.stringify(h)) } catch { /* ストレージ不可は無視 */ }
}

/**
 * 現在のキャリアの成果を永続殿堂へ統合（upsert・重複排除・上限管理）。
 * saveCarey のたびに呼んでよい（キャリアはrngSeedで同一性を持ち、再同期は上書き）。
 */
export function syncHallOfFame(state: CareerState): HallOfFame {
  const h = loadHallOfFame()
  const school = state.schoolName

  // 出身プロ（名選手）: name+year+school で重複排除し新しい順に23人。
  const proKey = (p: HofPro) => `${p.name}__${p.year}__${p.school}`
  const seenPro = new Set(h.pros.map(proKey))
  for (const a of state.records.proAlumni ?? []) {
    const entry: HofPro = { name: a.name, school, year: a.year }
    if (!seenPro.has(proKey(entry))) { h.pros.unshift(entry); seenPro.add(proKey(entry)) }
  }
  h.pros = h.pros.slice(0, MAX_PROS)

  // 全国制覇: history から「全国優勝」の年を拾う（school+year+kind で重複排除）。
  const champKey = (c: HofChampion) => `${c.school}__${c.year}__${c.kind}`
  const seenCh = new Set(h.champions.map(champKey))
  for (const hy of state.records.history ?? []) {
    if (hy.summer === '全国優勝') { const c: HofChampion = { school, year: hy.year, kind: 'summer' }; if (!seenCh.has(champKey(c))) { h.champions.unshift(c); seenCh.add(champKey(c)) } }
    if (hy.winter === '全国優勝') { const c: HofChampion = { school, year: hy.year, kind: 'winter' }; if (!seenCh.has(champKey(c))) { h.champions.unshift(c); seenCh.add(champKey(c)) } }
  }
  h.champions = h.champions.slice(0, MAX_CHAMPS)

  // ベストキャリア: このキャリアを rngSeed で upsert→タイトル数→年数 で上位5。
  const r = state.records
  const career: HofCareer = {
    id: String(state.rngSeed), school, titles: r.summerTitles + r.winterTitles,
    graduates: r.graduates, proCount: r.proPlayers, years: state.year,
  }
  const others = h.careers.filter((c) => c.id !== career.id)
  h.careers = [...others, career].sort((a, b) => b.titles - a.titles || b.years - a.years).slice(0, MAX_CAREERS)

  // G-32 §8: マネージャー殿堂入り（1キャリア1人・在席3年以上で自動登録）
  if (state.manager && (state.year - state.manager.joinedYear) >= 3) {
    const mgrEntry: HofManager = {
      name: state.manager.name, school, year: state.manager.joinedYear, trait: state.manager.trait,
    }
    const mgrKey = `${mgrEntry.name}__${mgrEntry.school}__${mgrEntry.year}`
    const seenMgr = new Set((h.managers ?? []).map((m) => `${m.name}__${m.school}__${m.year}`))
    if (!seenMgr.has(mgrKey)) {
      h.managers = [mgrEntry, ...(h.managers ?? [])].slice(0, MAX_MANAGERS)
    }
  }

  persist(h)
  return h
}
