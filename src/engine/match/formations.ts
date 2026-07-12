// ============================================================
// engine/match/formations.ts — フォーメーション → 11ポジション割り当て
// GDD Section 3.1 の6フォーメーション。守備/中盤/攻撃の人数比が
// teamQuality（補完A-2）の加重平均に反映される。
// ============================================================

import type { Formation, PositionType } from '../types'

// 各フォーメーションの11スロット（先頭は必ずGK）。
// 守備ライン人数・中盤人数・攻撃人数がフォーメーション差として効く。
export const FORMATIONS: Record<Formation, PositionType[]> = {
  // 守備4 / 中盤4 / 攻撃2 — バランス型
  '4-4-2':   ['GK', 'CB', 'CB', 'SB', 'SB', 'WF', 'WF', 'CM', 'CM', 'CF', 'CF'],
  // 守備4 / 中盤3(DM+2CM) / 攻撃3 — 攻撃的
  '4-3-3':   ['GK', 'CB', 'CB', 'SB', 'SB', 'CM', 'DM', 'CM', 'WF', 'CF', 'WF'],
  // 守備4 / 中盤3(DM+CM+AM) / 攻撃3 — 中盤の創造性重視
  '4-2-3-1': ['GK', 'CB', 'CB', 'SB', 'SB', 'DM', 'DM', 'AM', 'WF', 'WF', 'CF'],
  // 守備3 / 中盤5(DM+CM+AM+2WB) / 攻撃2 — 中盤支配・ウイングバック多用
  '3-5-2':   ['GK', 'CB', 'CB', 'CB', 'WB', 'WB', 'DM', 'DM', 'AM', 'CF', 'CF'],
  // 守備5 / 中盤3(DM+CM+AM) / 攻撃2 — 堅守速攻
  '5-3-2':   ['GK', 'CB', 'CB', 'CB', 'SB', 'SB', 'CM', 'CM', 'AM', 'CF', 'CF'],
  // 守備3 / 中盤4 / 攻撃3 — 超攻撃的
  '3-4-3':   ['GK', 'CB', 'CB', 'CB', 'WB', 'WB', 'CM', 'CM', 'WF', 'CF', 'WF'],
}

export const FORMATION_LIST: Formation[] = [
  '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '3-4-3',
]

// グループ分類（攻撃QM/中盤QM/守備QMの算出に使う）
export const ATTACK_POSITIONS: PositionType[] = ['CF', 'WF']
export const MID_POSITIONS: PositionType[] = ['WB', 'DM', 'AM', 'CM']
export const DEF_POSITIONS: PositionType[] = ['CB', 'SB']

/**
 * 近似ポジション（必要能力＋ピッチ上の距離が近い隣接ポジション・無向）。
 * 自動配置で「本職が埋まっている時の代役」を選ぶ等に使う。
 * 能力が似ていてもピッチ上で遠い組（例: CB↔CF）は近似にしない。
 */
export const POSITION_NEIGHBORS: Record<PositionType, PositionType[]> = {
  GK: [],
  CB: ['SB', 'DM'],
  SB: ['CB', 'WB'],
  WB: ['SB', 'WF'],
  DM: ['CM', 'CB'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'WF'],
  WF: ['WB', 'AM', 'CF'],
  CF: ['WF'],
}

/** 2ポジションが近似（隣接）か */
export function arePositionsNear(a: PositionType, b: PositionType): boolean {
  return a === b || (POSITION_NEIGHBORS[a]?.includes(b) ?? false)
}
