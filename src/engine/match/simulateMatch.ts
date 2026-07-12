// ============================================================
// engine/match/simulateMatch.ts — 試合シミュレーションの公開エントリ
// 中身は possession.ts（ポゼッション・チェーン型エンジン）に委譲。
// 旧スロット抽選型（stepMatch.ts）は廃止し、選手が絡む新エンジンに統一。
// ============================================================

export type { MatchOptions } from './possession'
export { simulatePossessionMatch as simulateMatch, PTUNE } from './possession'
