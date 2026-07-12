// ============================================================
// ui/asset.ts — public配下アセットのURL解決
//   import.meta.env はVite専用。node実行の検証(render-test)では未定義に
//   なるため、optional chainingで安全に既定値へフォールバックする。
// ============================================================

export const BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'

/** public配下の相対パス → 配信URL（vite base / itch.io相対パス対応） */
export function asset(path: string): string {
  return BASE + path.replace(/^\//, '')
}
