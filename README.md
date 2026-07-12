# 育成！経営！高校サッカー部！！ — ただタダ games（Phase3 MVP）

新設高校にサッカー部を創部し、**戦術と采配だけ**で全国大会を勝ち抜く監督シミュレーション。
ブラウザで無料・登録不要。Vite + React + TypeScript。

> MVP（大会編）。育成・経営・スカウト・キャリアはフル版で実装予定。
> 設計の正は `../.secretary/planning/phase3-game-design.md`（GDD）。

## クイックスタート

```bash
npm install
npm run dev        # 開発サーバ http://localhost:5173 （スマホ375px幅で確認）
npm run build      # 本番ビルド（型チェック込み）→ dist/
npm run preview    # 本番ビルドのプレビュー
```

## 検証スクリプト（ヘッドレス）

```bash
npm run balance              # 試合エンジンのバランス検証（GDD M1ゲート: 互角→片チーム1.2〜1.5点）
npx tsx scripts/tactics-test.ts   # 戦術の効き（最適カウンター vs 無策の優勝率）
npx tsx scripts/store-test.ts     # ストア駆動でUIと同じ遷移を500回検証
npx tsx scripts/smoke.ts          # 大会フローのスモークテスト
```

現在の検証結果:
- 互角チーム: 片チーム平均 **1.27点**（現実の高校サッカー準拠）✅
- 最適カウンター戦術の優勝率 **18.7%** vs 無策 **10.2%**（采配が明確に効く）
- ストア駆動 **500/500** 正常終了

## アーキテクチャ

```
src/
├ engine/            試合エンジン（純TS・React非依存・シード決定的=mulberry32）
│  ├ types.ts  rng.ts
│  ├ match/          teamQuality(A-2) / tactics(A-3) / eventTable(A-4,A-5)
│  │                 stepMatch(1ステップ純粋関数) / simulateMatch / formations
│  └ generate/       player.ts / team.ts
├ data/              names / schools / prefectures（すべて架空生成）
├ lib/               tournament（8校シングルエリミ） / labels
├ store/             gameStore.ts（Zustand・画面遷移ステートマシン）
├ save/              stats.ts（localStorage通算成績・ログイン不要）
├ components/        Title / Squad / Tactics / Bracket / Match(+Pitch2D) / End
└ index.css          デザイントークン（phase3-theme.md準拠・ダーク固定）
scripts/             検証ハーネス群
```

**設計原則**: エンジンは完全に決定的。シードを固定すれば「スキップ=観戦」が同じ結果になる。
バランス調整の係数は `engine/match/eventTable.ts` の `TUNING` に集約。

## 配信（itch.io）

`vite.config.ts` で `base: './'` 設定済み（相対パス）。`npm run build` → `dist/` をzip化して
itch.io に HTML5 としてアップロードすればブラウザで即プレイ可能。

## 権利・コンプライアンス

実在の高校名・選手名・大会名・ロゴは一切不使用。すべて架空生成。
都道府県名のみ事実として使用（著作権対象外）。詳細は `../.secretary/compliance/rights-ledger.md`。
