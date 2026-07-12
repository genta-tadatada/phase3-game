// ============================================================
// components/PKView.tsx — #16 PK専用ピッチ表示
// PK戦の1蹴りを「ゴール正面」視点で可視化：打ったコースとGKの跳んだ方向を見せる。
// コース・GK方向はエンジンが持たないため beat.i から決定的に導出（成否はbeat.action）。
// ============================================================

import type { MatchBeat, Team } from '../engine/types'

// 0 0 100 70 のゴール正面シーン
const GOAL_X0 = 20, GOAL_X1 = 80, GOAL_Y0 = 8, GOAL_Y1 = 30
const SPOT_X = 50, SPOT_Y = 60

export function PKView({ beat, home, away }: { beat: MatchBeat; home: Team; away: Team }) {
  const isGoal = beat.action === 'pk-goal'
  const shootSide = beat.side
  const shooter = shootSide === 'home' ? home : shootSide === 'away' ? away : home
  const keeper = shootSide === 'home' ? away : home
  const ballColor = shooter.color

  // コース（左右）と高さを beat.i から決定的に。
  const dir = (beat.i % 3) - 1 // -1=左 / 0=中央 / 1=右
  const high = beat.i % 2 === 0
  // ボール到達点（ゴール内のコース）。中央は枠中、左右は隅。
  const targetX = SPOT_X + dir * 22
  const targetY = high ? GOAL_Y0 + 5 : GOAL_Y1 - 4
  // GKの跳んだ方向：決めた＝逆を突く（別方向）／止めた＝コースを読む（同方向）。
  const gkDir = isGoal ? (dir === 0 ? (beat.i % 4 < 2 ? -1 : 1) : -dir) : dir
  const gkX = SPOT_X + gkDir * 20
  const gkY = (GOAL_Y0 + GOAL_Y1) / 2 + 2

  return (
    <div className="pitch-wrap" style={{ position: 'relative', aspectRatio: '100 / 70', borderRadius: 14, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.18), 0 4px 16px rgba(40,60,40,0.18)' }}>
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="pkturf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4fb37d" /><stop offset="1" stopColor="#3f9f63" /></linearGradient>
        </defs>
        <rect x={0} y={0} width={100} height={70} fill="url(#pkturf)" />
        {/* 芝のストライプ */}
        {Array.from({ length: 7 }).map((_, i) => (
          <rect key={i} x={0} y={i * 10} width={100} height={5} fill="rgba(255,255,255,0.04)" />
        ))}
        {/* ペナルティエリアの弧・スポット */}
        <g stroke="rgba(255,255,255,0.7)" strokeWidth="0.4" fill="none">
          <rect x={10} y={GOAL_Y1} width={80} height={30} />
          <circle cx={SPOT_X} cy={SPOT_Y} r={0.8} fill="rgba(255,255,255,0.8)" />
        </g>
        {/* ゴール枠＋ネット */}
        <g>
          <rect x={GOAL_X0} y={GOAL_Y0} width={GOAL_X1 - GOAL_X0} height={GOAL_Y1 - GOAL_Y0} fill="rgba(255,255,255,0.10)" stroke="#fff" strokeWidth="0.9" />
          <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.25">
            {Array.from({ length: 11 }).map((_, i) => <line key={`v${i}`} x1={GOAL_X0 + i * 6} y1={GOAL_Y0} x2={GOAL_X0 + i * 6} y2={GOAL_Y1} />)}
            {Array.from({ length: 4 }).map((_, i) => <line key={`h${i}`} x1={GOAL_X0} y1={GOAL_Y0 + i * 7} x2={GOAL_X1} y2={GOAL_Y0 + i * 7} />)}
          </g>
        </g>

        {/* GK（コース方向へダイブ） */}
        <g key={`gk-${beat.i}`}>
          <g transform={`translate(${SPOT_X} ${gkY})`}>
            <animateTransform attributeName="transform" type="translate" from={`${SPOT_X} ${gkY}`} to={`${gkX} ${gkY}`} dur="0.55s" begin="0.15s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.3 1" keyTimes="0;1" />
            <ellipse cx={0} cy={3} rx={4} ry={1} fill="rgba(0,0,0,0.2)" />
            <circle r={3} fill="#f4f7fb" stroke="#23303a" strokeWidth="0.5" />
            <text textAnchor="middle" dy="1.1" style={{ fontSize: 3, fontWeight: 900, fill: '#23303a' }}>🧤</text>
          </g>
        </g>

        {/* ボール（スポット→コースへ） */}
        <g key={`ball-${beat.i}`}>
          <circle r={2} fill="url(#ballSheen)" stroke="#222" strokeWidth="0.3" cx={SPOT_X} cy={SPOT_Y}>
            <animate attributeName="cx" from={SPOT_X} to={isGoal ? targetX : gkX} dur="0.5s" begin="0.15s" fill="freeze" />
            <animate attributeName="cy" from={SPOT_Y} to={isGoal ? targetY : gkY} dur="0.5s" begin="0.15s" fill="freeze" />
          </circle>
          <radialGradient id="ballSheen" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#dcdcdc" /></radialGradient>
        </g>

        {/* シューター（下） */}
        <g transform={`translate(${SPOT_X} ${SPOT_Y + 6})`}>
          <circle r={2.6} fill={ballColor} stroke="rgba(0,0,0,0.5)" strokeWidth="0.4" />
        </g>
      </svg>

      {/* 結果ラベル */}
      <div key={`lbl-${beat.i}`} className="pop-in" style={{
        position: 'absolute', left: 0, right: 0, bottom: 6, textAlign: 'center', pointerEvents: 'none',
      }}>
        <span style={{
          display: 'inline-block', background: isGoal ? 'rgba(244,126,60,0.92)' : 'rgba(40,50,70,0.92)',
          color: '#fff', fontWeight: 900, fontSize: 15, padding: '4px 16px', borderRadius: 9, boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
        }}>
          {isGoal ? `⚽ ${beat.actorName ?? ''} 決めた！` : `🧤 ${keeper.shortName} がストップ！`}
        </span>
      </div>

      {/* チーム名（蹴る側） */}
      <div style={{ position: 'absolute', top: 5, left: 7, fontSize: 10, fontWeight: 900, color: '#fff', background: 'rgba(0,0,0,0.32)', padding: '1px 7px', borderRadius: 6 }}>
        PK：{shooter.shortName}
      </div>
    </div>
  )
}
