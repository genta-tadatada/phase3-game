// ============================================================
// engine/rng.ts — シード付き決定的乱数（mulberry32）
// GDD 補完I: シード固定でスキップ=観戦の結果一致を保証する基盤。
// ============================================================

export interface RNG {
  /** 0以上1未満の浮動小数 */
  next(): number
  /** min以上max未満の整数 */
  int(min: number, max: number): number
  /** 1〜sides の整数（ダイス） */
  dice(sides: number): number
  /** 確率pでtrue */
  chance(p: number): boolean
  /** 配列からランダムに1つ */
  pick<T>(arr: readonly T[]): T
  /** 現在のシード状態（セーブ・再現用） */
  state(): number
}

/**
 * mulberry32: 32bit 高速シード乱数。
 * 同一シードからは常に同一の系列を生成する。
 */
export function createRNG(seed: number): RNG {
  let a = seed >>> 0
  const next = (): number => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min)),
    dice: (sides) => 1 + Math.floor(next() * sides),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    state: () => a >>> 0,
  }
}

/** 文字列からシード値を生成（高校名などからの再現用） */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
