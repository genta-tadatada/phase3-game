// ============================================================
// lib/account.ts — アカウント永続データ（localStorage・キャリアsaveとは別キー）
// 「はじめから」を選んでも実績・殿堂入り選手は残る＝別の県でやり直す楽しみ（メタ進行）。
// ============================================================

import { ICON_UNLOCKS, TITLE_UNLOCKS } from '../data/achievements'

const KEY = 'tadatada-soccer-account-v1'

export interface SavedPlayer { name: string; pref: string; level: string; year: number; note?: string }
export interface AccountData {
  achievements: Record<string, { at: number }>
  savedPlayers: SavedPlayer[]
}

function load(): AccountData {
  if (typeof localStorage === 'undefined') return { achievements: {}, savedPlayers: [] }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const d = JSON.parse(raw); return { achievements: d.achievements ?? {}, savedPlayers: d.savedPlayers ?? [] } }
  } catch { /* 壊れていれば初期化 */ }
  return { achievements: {}, savedPlayers: [] }
}
function persist(d: AccountData) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* 容量超過等は黙殺 */ } }

export function getAccount(): AccountData { return load() }
export function isUnlocked(id: string): boolean { return !!load().achievements[id] }
export function unlockedCount(): number { return Object.keys(load().achievements).length }

/** 実績を解禁（新規解禁なら定義を返す＝通知用／既取得や未定義なら null）。account永続。 */
export function unlockAchievement(id: string): boolean {
  const d = load()
  if (d.achievements[id]) return false
  d.achievements[id] = { at: Date.now() }
  persist(d)
  return true
}

export function unlockedIcons() { const n = unlockedCount(); return ICON_UNLOCKS.filter((x) => n >= x.at) }
export function unlockedTitles() { const n = unlockedCount(); return TITLE_UNLOCKS.filter((x) => n >= x.at) }

/** 殿堂入り選手をアカウントに保存（はじめからでも残る・最大50人）。 */
export function addSavedPlayer(p: SavedPlayer) {
  const d = load()
  d.savedPlayers = [p, ...d.savedPlayers].slice(0, 50)
  persist(d)
}
