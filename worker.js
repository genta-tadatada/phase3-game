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
// アセット空間でのトップページの正規形。理由は下の fetch 内コメント参照。
const INDEX = '/'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 末尾スラッシュなしの入口は正規URL（末尾スラッシュ付き）へ寄せる。
    // url.search はそのまま引き継がれるので ?utm=… 付きでも落ちない
    if (url.pathname === PREFIX) {
      url.pathname = PREFIX + '/'
      return Response.redirect(url.toString(), 301)
    }

    // ルートを `…/games/football*` の1本にまとめた副作用で `/games/footballXYZ` の
    // ような近傍パスもここへ来る。ゲームのURL空間ではないので素直に404を返す
    // （index.htmlを返すと存在しないURLでゲームが起動してしまう）。
    if (url.pathname[PREFIX.length] !== '/') {
      return new Response('Not Found', { status: 404 })
    }

    // /games/football プレフィックスを剥がして実アセットのパスへ変換
    //
    // ⚠️ HTMLは必ず INDEX（'/'）で要求する。'/index.html' を渡してはいけない。
    //    Workers Static Assets の html_handling（既定 auto-trailing-slash）は
    //    '/index.html' を「正規形は '/' 」とみなして *307リダイレクトを返す*。
    //    その307がそのままブラウザへ渡ると Location: / ＝サイトルート（phase1ポータル）
    //    へ着地する。「/games/football/ を開くとポータルに飛ぶ」の正体がこれ
    //    （2026-08-17 特定。画像やrobots.txtは200で返っていたためルート自体は正常だった）。
    let assetPath = url.pathname.slice(PREFIX.length) // 必ず '/' 始まり（上のガード済み）
    if (assetPath === '/' || assetPath === '/index.html') assetPath = INDEX
    url.pathname = assetPath

    const res = await env.ASSETS.fetch(new Request(url, request))
    // SPA: 実在しない深いパスは index へフォールバック（ここも '/index.html' 禁止）
    if (res.status === 404) {
      url.pathname = INDEX
      return env.ASSETS.fetch(new Request(url, request))
    }
    return res
  },
}
