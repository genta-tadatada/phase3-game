// ============================================================
// worker.js — /games/football/* を配信する Cloudflare Worker
//
// tadatada.net はワンオリジン構成（設計正本: .secretary/planning/auth-architecture.md §1）:
//   /                  → Cloudflare Pages (phase1-tools)
//   /games/football/*  → このWorker（本ファイル・dist/ の静的アセットを配信）
//   /api/*             → auth-worker (tadatada-auth)
//
// Cloudflareは Pages より Worker route を優先するため、同一ドメイン上で
// このサブパスだけを横取りできる。同一オリジン＝認証Cookieがそのまま通る（ADR-023）。
//
// vite は base:'./'（相対パス）でビルドされる。ページが /games/football/ にあるとき
// ./assets/... は /games/football/assets/... に解決されるので、ここで /games/football
// プレフィックスを剥がして実アセット（dist直下）へ橋渡しする。
// ============================================================

const PREFIX = '/games/football'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 末尾スラッシュなしの入口は正規URL（末尾スラッシュ付き）へ寄せる
    if (url.pathname === PREFIX) {
      url.pathname = PREFIX + '/'
      return Response.redirect(url.toString(), 301)
    }

    // /games/football プレフィックスを剥がして実アセットのパスへ変換
    let assetPath = url.pathname.slice(PREFIX.length)
    if (assetPath === '' || assetPath === '/') assetPath = '/index.html'
    url.pathname = assetPath

    const res = await env.ASSETS.fetch(new Request(url, request))
    // SPA: 実在しない深いパスは index.html へフォールバック
    if (res.status === 404) {
      url.pathname = '/index.html'
      return env.ASSETS.fetch(new Request(url, request))
    }
    return res
  },
}
