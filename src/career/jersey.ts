// ============================================================
// career/jersey.ts — 背番号（#6）。名前を覚えにくいので背番号＋ポジションを併記する。
// 自動割当（ポジション準拠の現実的な番号）＋手動変更可。
// ============================================================

import type { Player, PositionType } from '../engine/types'

// ポジション別の希望番号（埋まっていたら次の空き番号へ）。サッカーの慣例に準拠。
const POS_PREF: Record<PositionType, number[]> = {
  GK: [1, 12, 21, 23],
  CB: [4, 5, 3, 15, 6],
  SB: [2, 3, 16, 26],
  WB: [2, 6, 16, 26],
  DM: [6, 8, 14, 25],
  CM: [7, 8, 16, 17, 14],
  AM: [10, 8, 7, 20],
  WF: [11, 7, 9, 17, 27],
  CF: [9, 11, 19, 18, 29],
}

/** ロスター全員に背番号を割当（既存番号は保持・未設定/重複のみ埋める）。1〜40で一意。 */
export function assignJerseyNumbers(roster: Player[]): Player[] {
  const used = new Set<number>()
  // まず既存の有効・重複しない番号を確保
  for (const p of roster) {
    if (p.number && p.number >= 1 && p.number <= 99 && !used.has(p.number)) used.add(p.number)
    else if (p.number && used.has(p.number)) p.number = undefined // 重複は振り直し
  }
  for (const p of roster) {
    if (p.number) continue
    let n = POS_PREF[p.position]?.find((x) => !used.has(x))
    if (!n) { for (let i = 1; i <= 40; i++) { if (!used.has(i)) { n = i; break } } }
    p.number = n ?? 99
    used.add(p.number)
  }
  return roster
}

/** 背番号を手動変更（他選手と重複したら入れ替え）。 */
export function setJerseyNumber(roster: Player[], playerId: string, num: number): Player[] {
  const n = Math.max(1, Math.min(99, Math.round(num)))
  const target = roster.find((p) => p.id === playerId)
  if (!target) return roster
  const holder = roster.find((p) => p.number === n && p.id !== playerId)
  return roster.map((p) => {
    if (p.id === playerId) return { ...p, number: n }
    if (holder && p.id === holder.id) return { ...p, number: target.number } // 入れ替え
    return p
  })
}
