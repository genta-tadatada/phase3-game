// ============================================================
// save/stats.ts — 通算成績の永続化（localStorage・ログイン不要）
// itch.io の iframe 等でストレージが使えない場合も安全に動作する。
// ============================================================

const KEY = 'tadatada_soccer_stats_v1'

export interface PlayerStats {
  plays: number          // 挑戦した大会数
  championships: number  // 優勝回数
  bestStage: number      // 自己最高: 0=ベスト8 1=ベスト4 2=準優勝 3=優勝（-1=未プレイ）
}

const STAGE_LABEL = ['ベスト8', 'ベスト4', '準優勝', '優勝']

export function stageLabel(stage: number): string {
  return STAGE_LABEL[stage] ?? '記録なし'
}

const EMPTY: PlayerStats = { plays: 0, championships: 0, bestStage: -1 }

export function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const s = JSON.parse(raw) as Partial<PlayerStats>
    return {
      plays: s.plays ?? 0,
      championships: s.championships ?? 0,
      bestStage: s.bestStage ?? -1,
    }
  } catch {
    return { ...EMPTY }
  }
}

/** 1大会の結果を記録して新しい通算成績を返す */
export function recordResult(stage: number): PlayerStats {
  const cur = loadStats()
  const next: PlayerStats = {
    plays: cur.plays + 1,
    championships: cur.championships + (stage === 3 ? 1 : 0),
    bestStage: Math.max(cur.bestStage, stage),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ストレージ不可環境では揮発（このプレイのみ反映） */
  }
  return next
}
