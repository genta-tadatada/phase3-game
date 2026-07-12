// ============================================================
// career/save.ts — キャリアのセーブ/ロード（localStorage・版管理・2世代）
// ============================================================

import type { CareerState } from './types'
import type { Player } from '../engine/types'
import { SAVE_VERSION } from './types'
import { assignJerseyNumbers } from './jersey'
import { syncHallOfFame } from './hallOfFame'

const KEY = 'tadatada_career_v1'
const BAK = 'tadatada_career_v1_bak'

// デバッグ検証モード（?festival 等）用: セーブを無効化し、使い捨てプレイが
// 本物のセーブデータを上書きしないようにする。一度無効化したらセッション中は戻さない。
let saveDisabled = false
export function disableSave(): void { saveDisabled = true }

export function hasSave(): boolean {
  try { return localStorage.getItem(KEY) != null } catch { return false }
}

export function saveCareer(state: CareerState): void {
  if (saveDisabled) return
  try {
    // 2世代バックアップ: 現行を_bakへ退避してから上書き
    const prev = localStorage.getItem(KEY)
    if (prev) localStorage.setItem(BAK, prev)
    localStorage.setItem(KEY, JSON.stringify({ ...state, version: SAVE_VERSION }))
    syncHallOfFame(state) // #55 プレイをまたぐ永続殿堂へ成果を統合
  } catch {
    /* ストレージ不可環境ではセーブ無効（揮発プレイ） */
  }
}

// 練習メニュー再設計に伴う旧ID→新IDのマップ（18メニュー版・2026-06-27）
const MENU_ID_MAP: Record<string, string> = {
  'fw-finish': 'shoot',            // FW決定力特訓→シュートに統合
  'defense': 'defense1v1',         // 守備練習(1対1)
  'df-positioning': 'linecontrol', // DFラインコントロール→ラインコントロール
  'physical': 'heading',           // 旧フィジカル(Lv2 power)→ヘディング(Lv2 power)
  'running': 'run',                // ランニング
  'gk-positioning': 'gk-position', // GKポジショニング
}
function migrateMenuId(id: string): string {
  return MENU_ID_MAP[id] ?? id
}

function migrate(raw: Record<string, unknown>): CareerState {
  // 将来のセーブ形式差分を吸収: 欠落フィールドを安全な既定値で補完し、
  // UIが undefined.length / .map で落ちないようにする（防御的ロード）。
  const s = raw as Record<string, any>
  // 旧練習メニューIDを新IDに変換（保存中の lastPlan.lanes と menuStreak のキー）
  if (s.lastPlan && Array.isArray(s.lastPlan.lanes)) {
    s.lastPlan.lanes = (s.lastPlan.lanes as { menuId: string }[]).map((l) => ({ ...l, menuId: migrateMenuId(l.menuId) }))
  }
  if (s.menuStreak && typeof s.menuStreak === 'object') {
    const next: Record<string, number> = {}
    for (const [k, v] of Object.entries(s.menuStreak as Record<string, number>)) {
      const nk = migrateMenuId(k)
      next[nk] = (next[nk] ?? 0) + (typeof v === 'number' ? v : 0)
    }
    s.menuStreak = next
  }
  s.roster ??= []
  s.atmosphereB ??= s.atmosphere ?? 50
  s.selectionEnabled ??= false
  // 旧セーブの選手は squad 未設定→全員A扱い
  for (const p of s.roster as { squad?: string }[]) p.squad ??= 'A'
  // 旧セーブに背番号が無ければ付与
  if ((s.roster as { number?: number }[]).some((p) => !p.number)) assignJerseyNumbers(s.roster as Player[])
  s.pendingEvents ??= []
  s.log ??= []
  s.lastGraduates ??= []
  s.facilities ??= { ground: 1, clubhouse: 1, training: 1, dorm: 1, extras: [] }
  s.facilities.extras ??= []
  s.staff ??= []
  s.scouting ??= { level: 0, sp: 0, spPerWeek: 0, candidates: [], shortlist: [] }
  s.scouting.candidates ??= []
  s.scouting.shortlist ??= []
  s.season ??= { summerBest: null, winterReachedNational: false, summerLabel: null, winterLabel: null }
  s.records ??= {}
  s.records.history ??= []
  s.records.proAlumni ??= []
  s.records.bestEleven ??= []
  s.records.bestPlayerName ??= null
  s.records.summerTitles ??= 0
  s.records.winterTitles ??= 0
  s.records.nationalApps ??= 0
  s.records.graduates ??= 0
  s.records.proPlayers ??= 0
  return s as unknown as CareerState
}

export function loadCareer(): CareerState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return migrate(parsed)
  } catch {
    // 破損時はバックアップを試す
    try {
      const bak = localStorage.getItem(BAK)
      if (bak) return migrate(JSON.parse(bak))
    } catch { /* noop */ }
    return null
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(BAK)
  } catch { /* noop */ }
}
