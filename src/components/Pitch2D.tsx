// ============================================================
// components/Pitch2D.tsx — 連続アニメーションの2D観戦ピッチ（#試合モーション刷新）
// エンジンの離散beatsを「キーフレーム」とし、requestAnimationFrameで22人＋ボールを
// 毎フレーム目標位置へ指数イージング＝本物の試合のように滑らかに動かす。
//   ・選手の移動速度は能力(speed)でスケール＝速い選手が速く動く（育成が見える）
//   ・攻撃中はFWが前線へ・守備時はライン圧縮。常に微動（生きている）
//   ・ボールはアクション別の速度：パス=速い直線/ドリブル=保持者と一緒/シュート=ゴールへ高速＋トレイル
//   ・全選手に背番号。自チーム=金リング。GK=白基調。保持者=発光リング＋名前タグ。
// 位置更新はSVG transformへref直書き（毎フレームReact再描画しない＝高速）。エンジンは不変。
// ============================================================

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { MatchBeat, Team } from '../engine/types'
import { FORMATION_COORDS } from '../engine/match/formationCoords'

const VW = 100, VH = 62
const FX0 = 4, FX1 = 96, FY0 = 6, FY1 = 56
const MIDY = (FY0 + FY1) / 2
const fx = (ballY: number) => FX0 + Math.max(0, Math.min(1, ballY)) * (FX1 - FX0)
const fy = (ballX: number) => FY0 + Math.max(0, Math.min(1, ballX)) * (FY1 - FY0)

interface P { x: number; y: number }
interface Targets { home: P[]; away: P[]; ball: P; ownerId: string | null; ownerSide: 'home' | 'away' | null }

// beat（キーフレーム）から各選手・ボールの「目標位置」を算出する。
function computeTargets(beat: MatchBeat, home: Team, away: Team): Targets {
  const bx = fx(beat.ballY), by = fy(beat.ballX)
  const ballOwnerId = beat.targetId ?? beat.actorId ?? null
  const ownerSide = beat.side
  const action = beat.action
  const homeCoords = FORMATION_COORDS[home.tactics.formation] ?? FORMATION_COORDS['4-4-2']
  const awayCoords = FORMATION_COORDS[away.tactics.formation] ?? FORMATION_COORDS['4-4-2']

  const build = (coords: readonly (readonly [number, number])[], side: 'home' | 'away'): P[] => {
    const team = side === 'home' ? home : away
    const hasBall = beat.side === side
    const tac = team.tactics
    const attackDir = side === 'home' ? 1 : -1
    const oppGoalX = side === 'home' ? FX1 - 4 : FX0 + 4
    // 戦術によるチーム全体の押し引き・スライド（チームが「形」を保ったまま連動して動く）
    // F7: 戦術の見た目反映を強化。視覚的にラインが上下し・幅が変わり・寄せ方が変わる。
    const ment = ({ 'ultra-attack': 7, attack: 4, balance: 0, defense: -4, 'ultra-defense': -7 } as Record<string, number>)[tac.mentality] ?? 0
    // 守備ラインhigh/low: 効きを±5→±10に倍化（DFほど大きく動く＝lineDepthFactor）。
    const lineSh = ({ high: 10, mid: 0, low: -10 } as Record<string, number>)[tac.defenseLine] ?? 0
    const lineIsHigh = tac.defenseLine === 'high'
    const lineIsLow = tac.defenseLine === 'low'
    // 攻撃の幅: wideは更にボールから遠く・centralは強く寄る。
    const slideW = ({ central: 0.48, mid: 0.34, wide: 0.18 } as Record<string, number>)[tac.width] ?? 0.34
    const pressOn = tac.press === 'high'
    const pressLow = tac.press === 'low'
    // 攻撃姿勢でwave人数と押上倍率が変わる（ultra-attack=6人/strong押上 / ultra-defense=3人/控えめ）
    const attackBoost = ({ 'ultra-attack': 1.25, attack: 1.10, balance: 1.0, defense: 0.80, 'ultra-defense': 0.55 } as Record<string, number>)[tac.mentality] ?? 1.0
    const pts = coords.map(([depth, lateral], i) => {
      const p = team.players[i]
      const isGK = i === 0
      const baseX = side === 'home' ? FX0 + depth * (FX1 - FX0) * 0.5 : FX1 - depth * (FX1 - FX0) * 0.5
      const baseY = fy(lateral)
      let cx: number, cy: number
      if (isGK) {
        cx = baseX + (bx - baseX) * 0.05
        cy = baseY + (by - baseY) * 0.12
        if (!hasBall && action.startsWith('shot')) cy += (by - cy) * 0.6 // セーブで飛ぶ
      } else {
        // ① チーム全体がボールのレーン（上下）へスライド
        cy = baseY + (by - baseY) * slideW
        // ② チーム全体がボールの前後位置に連動＋戦術の押し引き
        const ballPull = hasBall ? 0.36 : 0.26
        cx = baseX + (bx - baseX) * ballPull
        cx += attackDir * ment * 0.9
        // 守備ライン: DF（depthが低い）ほど大きくラインが動く。highでDFが前にせり出す/lowで張り付く。
        const lineDepthFactor = 1.6 - depth   // depth0.1→1.5 / depth0.9→0.7
        cx += attackDir * lineSh * lineDepthFactor * 0.45
        if (hasBall) cx += attackDir * depth * 11 * attackBoost
        else {
          // 守備時の引き戻し：lowなら更に深く引き籠もる（×1.4）・highなら浅め（×0.55）
          const retract = lineIsLow ? 1.4 : lineIsHigh ? 0.55 : 1.0
          cx += -attackDir * (4 - depth * 1.5) * (pressOn ? 0.5 : 1) * retract
        }
        // wide時：ボールから遠いサイドの選手はタッチライン側へ追加で開く（攻撃時のみ）。
        if (hasBall && tac.width === 'wide') {
          const farSide = Math.sign(baseY - by)        // ボールと逆サイドへ
          if (farSide !== 0) cy += farSide * (1 - Math.abs(baseY - MIDY) / 30) * 3
        }
      }
      if (p && p.id === ballOwnerId) { cx = bx; cy = by }    // 保持者はボールへ
      return { x: cx, y: cy, depth, isGK }
    })
    if (!hasBall) {
      // 守備：ボール近接の選手が寄せる。highプレス=最寄り2人で囲む / 通常=最寄り1人 / lowプレス=遠めから様子見
      const distSq = (q: { x: number; y: number }) => (q.x - bx) ** 2 + (q.y - by) ** 2
      const indexed = pts.map((q, i) => ({ q, i, d: distSq(q) })).filter((x) => x.i !== 0).sort((a, b) => a.d - b.d)
      if (pressOn) {
        // 高プレス：最寄り2人がボールを挟むように寄せる
        const f1 = 0.62, f2 = 0.45
        if (indexed[0]) { pts[indexed[0].i].x += (bx - pts[indexed[0].i].x) * f1; pts[indexed[0].i].y += (by - pts[indexed[0].i].y) * f1 }
        if (indexed[1]) { pts[indexed[1].i].x += (bx - pts[indexed[1].i].x) * f2; pts[indexed[1].i].y += (by - pts[indexed[1].i].y) * f2 }
      } else if (pressLow) {
        // 低プレス：最寄り1人だけ控えめに寄せる（ブロックを崩さない）
        if (indexed[0]) { pts[indexed[0].i].x += (bx - pts[indexed[0].i].x) * 0.28; pts[indexed[0].i].y += (by - pts[indexed[0].i].y) * 0.28 }
      } else {
        // 通常：最寄り1人がしっかり寄せる
        if (indexed[0]) { pts[indexed[0].i].x += (bx - pts[indexed[0].i].x) * 0.46; pts[indexed[0].i].y += (by - pts[indexed[0].i].y) * 0.46 }
      }
    } else if (beat.zone >= 2) {
      // F7①: 攻撃時は中盤以降（zone>=2）から多くの選手が前進。
      //   zone=2（中盤押上）: 上位4人がやや押上
      //   zone>=3（敵陣深く）: 上位5人がボックス周辺へ・残り中盤2人もハーフライン超え
      //   ultra-attack: +1人 / ultra-defense: -1人（攻撃姿勢が見た目に出る）
      const order = pts.map((q, i) => ({ i, depth: q.depth })).filter((q) => q.i !== 0).sort((a, b) => b.depth - a.depth)
      const deepAttack = beat.zone >= 3
      const baseWave = deepAttack ? 5 : 4
      const waveShift = tac.mentality === 'ultra-attack' ? 1 : tac.mentality === 'ultra-defense' ? -1 : 0
      const wave1Count = Math.max(2, Math.min(7, baseWave + waveShift))
      // wide=横に大きく展開 / central=ボックス中央に集中
      const wideLanes = [0, -8, 8, -14, 14, -18, 18]
      const centralLanes = [0, -3, 3, -6, 6, -9, 9]
      const lanes = tac.width === 'wide' ? wideLanes : tac.width === 'central' ? centralLanes : [0, -5, 5, -10, 10, -13, 13]
      order.slice(0, wave1Count).forEach((f, n) => {
        const q = pts[f.i]
        const pull = (deepAttack ? 0.45 : 0.28) * attackBoost
        q.x += (oppGoalX - q.x) * pull
        if (deepAttack) q.y += ((MIDY + (lanes[n] ?? 0)) - q.y) * 0.30
      })
      // 中盤2列目もハーフラインを越えるよう少し押し上げる（攻撃姿勢で人数増）
      if (deepAttack) {
        const wave2 = tac.mentality === 'ultra-attack' ? 3 : 2
        order.slice(wave1Count, wave1Count + wave2).forEach((f) => {
          const q = pts[f.i]
          q.x += (oppGoalX - q.x) * 0.18 * attackBoost
        })
      }
    }
    // ピッチ外に出ないようクランプ
    return pts.map((q) => ({ x: Math.max(FX0 + 1, Math.min(FX1 - 1, q.x)), y: Math.max(FY0 + 1, Math.min(FY1 - 1, q.y)) }))
  }

  // ボール目標：シュートはゴールへ飛ぶ／ドリブルは保持者の少し前（運ぶ感）／他はビート位置。
  let ball: P = { x: bx, y: by }
  if (action.startsWith('shot') && ownerSide) {
    ball = { x: ownerSide === 'home' ? FX1 + (action === 'shot-goal' ? 2 : 0.5) : FX0 - (action === 'shot-goal' ? 2 : 0.5), y: MIDY + (beat.lane === 'L' ? -2 : beat.lane === 'R' ? 2 : 0) }
  } else if ((action === 'dribble' || action === 'carry') && ownerSide) {
    ball = { x: bx + (ownerSide === 'home' ? 1.5 : -1.5), y: by }
  }
  return { home: build(homeCoords, 'home'), away: build(awayCoords, 'away'), ball, ownerId: ballOwnerId, ownerSide }
}

// G-26: 退場(レッドカード)を受けた選手は描画から除外する＝ピッチ上の人数を実際に減らす。
export function Pitch2D({ beat, home, away, sentOff }: { beat: MatchBeat; home: Team; away: Team; sentOff?: { home: Set<string>; away: Set<string> } }) {
  const action = beat.action
  const flash = action === 'shot-goal'
  const isShot = action.startsWith('shot')
  const isSteal = action === 'tackle' || action === 'intercept'
  const isRed = action === 'foul-red'
  const bx = fx(beat.ballY), by = fy(beat.ballX)
  const ballOwnerId = beat.targetId ?? beat.actorId ?? null
  const ownerSide: 'home' | 'away' | null = beat.side

  const homeCoords = FORMATION_COORDS[home.tactics.formation] ?? FORMATION_COORDS['4-4-2']
  const awayCoords = FORMATION_COORDS[away.tactics.formation] ?? FORMATION_COORDS['4-4-2']

  // --- アニメーション用 refs ---
  const homeRefs = useRef<(SVGGElement | null)[]>([])
  const awayRefs = useRef<(SVGGElement | null)[]>([])
  const ballRef = useRef<SVGGElement | null>(null)
  const ballCircleRef = useRef<SVGCircleElement | null>(null)
  const travelRef = useRef(0)
  const ghostRef = useRef<SVGCircleElement | null>(null)
  const tagRef = useRef<HTMLDivElement | null>(null)
  const live = useRef<{ home: P[]; away: P[]; ball: P; ghost: P } | null>(null)
  const target = useRef<Targets | null>(null)
  const beatRef = useRef(beat)
  const tRef = useRef(0)

  // beat変化で目標を更新（初回は live を目標にスナップして transform を即書き＝チラつき防止）
  useLayoutEffect(() => {
    beatRef.current = beat
    const tg = computeTargets(beat, home, away)
    target.current = tg
    if (live.current) travelRef.current = Math.hypot(tg.ball.x - live.current.ball.x, tg.ball.y - live.current.ball.y) // 今回のボール移動距離（ホップ算出用）
    if (!live.current) {
      live.current = {
        home: tg.home.map((p) => ({ ...p })), away: tg.away.map((p) => ({ ...p })),
        ball: { ...tg.ball }, ghost: { ...tg.ball },
      }
      writeAll()
    }
  }, [beat, home, away])

  // 全トークン/ボールの現在位置をSVGへ書き込む
  function writeAll() {
    const L = live.current; if (!L) return
    for (let i = 0; i < 11; i++) {
      const h = homeRefs.current[i]; if (h && L.home[i]) h.setAttribute('transform', `translate(${L.home[i].x.toFixed(2)} ${L.home[i].y.toFixed(2)})`)
      const a = awayRefs.current[i]; if (a && L.away[i]) a.setAttribute('transform', `translate(${L.away[i].x.toFixed(2)} ${L.away[i].y.toFixed(2)})`)
    }
    if (ballRef.current) ballRef.current.setAttribute('transform', `translate(${L.ball.x.toFixed(2)} ${L.ball.y.toFixed(2)})`)
    if (ghostRef.current) { ghostRef.current.setAttribute('cx', L.ghost.x.toFixed(2)); ghostRef.current.setAttribute('cy', (L.ghost.y - 0.4).toFixed(2)) }
  }

  // rAFループ（マウント1回）。各選手を能力スケールの速度で目標へイージング。
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return
    let raf = 0
    let last = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; tRef.current += dt
      const L = live.current, T = target.current
      if (L && T) {
        const b = beatRef.current
        const ownerId = T.ownerId
        const step = (idx: number, side: 'home' | 'away') => {
          const team = side === 'home' ? home : away
          const arr = side === 'home' ? L.home : L.away
          const tg = side === 'home' ? T.home : T.away
          const p = team.players[idx]
          if (!arr[idx] || !tg[idx]) return
          const isOwner = p && p.id === ownerId
          const isGK = idx === 0
          const sp = p ? p.abilities.speed : 60
          // 能力で移動の俊敏さが変わる＝速い選手が明確に速く動く（育成が見える）。GKは控えめ。
          const rate = (isGK ? 2.4 : 3.7) * (0.5 + sp / 95)
          const al = 1 - Math.exp(-rate * dt)
          // F7: オフボール選手の微動を控えめに（過剰な「微妙なアニメ」を抑制）。
          //     保持者・GKは静か。ピクセル単位のチラつきにしない。
          const osc = isOwner ? 0 : (isGK ? 0.06 : 0.14)
          const ox = osc * Math.sin(tRef.current * 1.5 + idx * 1.3 + (side === 'away' ? 2 : 0))
          const oy = osc * Math.cos(tRef.current * 1.25 + idx * 2.1)
          arr[idx].x += (tg[idx].x + ox - arr[idx].x) * al
          arr[idx].y += (tg[idx].y + oy - arr[idx].y) * al
          const el = (side === 'home' ? homeRefs : awayRefs).current[idx]
          if (el) el.setAttribute('transform', `translate(${arr[idx].x.toFixed(2)} ${arr[idx].y.toFixed(2)})`)
        }
        for (let i = 0; i < 11; i++) { step(i, 'home'); step(i, 'away') }

        // ボール：アクション別の速さ
        const act = b.action
        const bRate = (act === 'pass' || act.startsWith('shot')) ? 11 : (act === 'dribble' || act === 'carry') ? 4.5 : 6.5
        const ba = 1 - Math.exp(-bRate * dt)
        L.ball.x += (T.ball.x - L.ball.x) * ba
        L.ball.y += (T.ball.y - L.ball.y) * ba
        if (ballRef.current) ballRef.current.setAttribute('transform', `translate(${L.ball.x.toFixed(2)} ${L.ball.y.toFixed(2)})`)
        // 速いボール（パス/シュート）は放物線で浮く＝立体感（影は地面に残る）
        if (ballCircleRef.current) {
          const fast = act === 'pass' || act.startsWith('shot')
          const rem = Math.hypot(T.ball.x - L.ball.x, T.ball.y - L.ball.y)
          const prog = Math.max(0, Math.min(1, 1 - rem / (travelRef.current || 1)))
          const hop = fast ? Math.sin(prog * Math.PI) * Math.min(3.2, (travelRef.current || 0) * 0.13) : 0
          ballCircleRef.current.setAttribute('cy', (-0.4 - hop).toFixed(2))
        }
        // トレイル（ゴーストはボールに遅れて追従＝速い動きで尾を引く）
        const ga = 1 - Math.exp(-bRate * 0.4 * dt)
        L.ghost.x += (L.ball.x - L.ghost.x) * ga
        L.ghost.y += (L.ball.y - L.ghost.y) * ga
        if (ghostRef.current) { ghostRef.current.setAttribute('cx', L.ghost.x.toFixed(2)); ghostRef.current.setAttribute('cy', (L.ghost.y - 0.4).toFixed(2)) }
        // 名前タグはライブのボールに追従
        if (tagRef.current) {
          tagRef.current.style.left = `${L.ball.x}%`
          tagRef.current.style.top = `${L.ball.y}%`
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away])

  // --- トークンの見た目（位置以外）。beatごとに再描画。位置はrAFがtransformで上書き。 ---
  const tokenInner = (idx: number, side: 'home' | 'away') => {
    const team = side === 'home' ? home : away
    const p = team.players[idx]
    const color = team.color
    const isGK = idx === 0
    const owner = p && p.id === ballOwnerId
    const stealer = isSteal && beat.side !== side && owner
    const mine = team.isPlayer
    const r = isGK ? 2.3 : owner ? 3.0 : 2.5
    const fillCol = isGK ? '#f4f7fb' : color
    const numCol = isGK ? '#23303a' : '#fff'
    const num = p?.number ?? (idx === 0 ? 1 : idx + 1) // 実際の背番号（無ければスロット順）
    return (
      <>
        {/* F7: 「無駄な影」削減＝個々の足元楕円影は削除（22個分の不要な装飾）。立体感はトークン自体のリング/シャドウで担保。
            保持者のpulseは周期を緩めて目障りでない強調に。 */}
        {owner && <circle r={r + 1.8} fill="none" stroke={stealer || isRed ? '#ff5a4d' : '#fff'} strokeWidth="0.95" opacity="0.95">
          <animate attributeName="r" values={`${r + 1.3};${r + 2.4};${r + 1.3}`} dur="1.3s" repeatCount="indefinite" />
        </circle>}
        {mine && !owner && <circle r={r + 0.95} fill="none" stroke="#ffd24a" strokeWidth="0.7" opacity="0.92" />}
        <circle r={r} fill={fillCol} stroke="rgba(0,0,0,0.5)" strokeWidth="0.45" />
        <circle r={r} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" opacity={isGK ? 0.9 : 0.4} />
        <text textAnchor="middle" dy="1.0" style={{ fontSize: owner ? 2.7 : 2.3, fontWeight: 900, fill: numCol, paintOrder: 'stroke', stroke: isGK ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)', strokeWidth: 0.28 }}>{num}</text>
      </>
    )
  }

  const goalLineX = ownerSide === 'home' ? FX1 + 2 : FX0 - 2
  const advanced = beat.zone >= 3 && ownerSide
  const thirdW = (FX1 - FX0) / 3
  const thirdX = ownerSide === 'home' ? FX1 - thirdW : FX0
  const attackColor = ownerSide === 'home' ? home.color : ownerSide === 'away' ? away.color : '#fff'

  return (
    <div className="pitch-wrap" style={{ position: 'relative', aspectRatio: `${VW} / ${VH}`, borderRadius: 14, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.18), 0 4px 16px rgba(40,60,40,0.18)' }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5fc189" /><stop offset="1" stopColor="#3f9f63" /></linearGradient>
          <linearGradient id="stand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6b5b7a" /><stop offset="1" stopColor="#4d4060" /></linearGradient>
          <radialGradient id="ballSheen" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#d6d6d6" /></radialGradient>
        </defs>

        <rect x={0} y={0} width={VW} height={VH} fill="url(#turf)" />
        <g className={flash ? 'crowd-cheer' : undefined}>
          <rect x={0} y={0} width={VW} height={FY0 - 0.5} fill="url(#stand)" />
          <rect x={0} y={FY1 + 0.5} width={VW} height={VH - FY1 - 0.5} fill="url(#stand)" />
          {Array.from({ length: 50 }).map((_, i) => (
            <circle key={`ct${i}`} cx={1 + i * 2} cy={(i % 2) * 2.4 + 1.6} r={0.65} fill={['#ffd2b0', '#f6b6ab', '#cfe3ff', '#ffe39a', '#d9f5e3'][i % 5]} opacity={0.8} />
          ))}
          {Array.from({ length: 50 }).map((_, i) => (
            <circle key={`cb${i}`} cx={1 + i * 2} cy={FY1 + 2 + (i % 2) * 2.4} r={0.65} fill={['#ffd2b0', '#f6b6ab', '#cfe3ff', '#ffe39a', '#d9f5e3'][(i + 2) % 5]} opacity={0.8} />
          ))}
        </g>
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={`st${i}`} x={FX0 + i * ((FX1 - FX0) / 10)} y={FY0} width={(FX1 - FX0) / 20} height={FY1 - FY0} fill="rgba(255,255,255,0.05)" />
        ))}
        {advanced && (
          <rect x={thirdX} y={FY0} width={thirdW} height={FY1 - FY0} fill={attackColor} opacity={0.13}>
            <animate attributeName="opacity" values="0.05;0.16;0.05" dur="1.4s" repeatCount="indefinite" />
          </rect>
        )}
        <g stroke="rgba(255,255,255,0.72)" strokeWidth="0.42" fill="none">
          <rect x={FX0} y={FY0} width={FX1 - FX0} height={FY1 - FY0} />
          <line x1={50} y1={FY0} x2={50} y2={FY1} />
          <circle cx={50} cy={MIDY} r={8} />
          <circle cx={50} cy={MIDY} r={0.7} fill="rgba(255,255,255,0.7)" />
          <rect x={FX0} y={MIDY - 13} width={12} height={26} />
          <rect x={FX1 - 12} y={MIDY - 13} width={12} height={26} />
          <rect x={FX0} y={MIDY - 6} width={5} height={12} />
          <rect x={FX1 - 5} y={MIDY - 6} width={5} height={12} />
        </g>
        <g stroke="rgba(255,255,255,0.9)" strokeWidth="0.3">
          <rect x={FX0 - 2.4} y={MIDY - 5} width={2.4} height={10} fill="rgba(255,255,255,0.2)" className={flash && ownerSide === 'away' ? 'net-shake' : undefined} />
          <rect x={FX1} y={MIDY - 5} width={2.4} height={10} fill="rgba(255,255,255,0.2)" className={flash && ownerSide === 'home' ? 'net-shake' : undefined} />
        </g>

        {/* シュート軌道（パスは動くボール＋トレイルで表現するので線は不要） */}
        {isShot && ownerSide && (
          <line x1={bx} y1={by} x2={goalLineX} y2={MIDY} stroke={flash ? '#ffe08a' : '#fff'} strokeWidth={flash ? 1.1 : 0.6} opacity="0.9">
            <animate attributeName="opacity" values="0.95;0.25" dur="0.55s" fill="freeze" />
          </line>
        )}

        {/* トレイル（ゴースト・ボールに遅れて追従） */}
        <circle ref={ghostRef} r={1.5} fill="#fff" opacity={isShot || action === 'pass' ? 0.4 : 0} />

        {/* 選手（22人・固定キーで常駐＝remountチラつき無し。位置はrAFがtransformで制御。
            保持者は発光リング＋足元のボールで前面に見える）
            G-26: sentOff集合にあるidの選手は描画スキップ＝退場でピッチから消える */}
        {homeCoords.map((_, i) => {
          const p = home.players[i]
          if (p && sentOff?.home.has(p.id)) return null
          return <g key={`h${i}`} ref={(el) => { homeRefs.current[i] = el }}>{tokenInner(i, 'home')}</g>
        })}
        {awayCoords.map((_, i) => {
          const p = away.players[i]
          if (p && sentOff?.away.has(p.id)) return null
          return <g key={`a${i}`} ref={(el) => { awayRefs.current[i] = el }}>{tokenInner(i, 'away')}</g>
        })}

        {/* ボール（影＋本体・位置はrAF） */}
        <g ref={ballRef}>
          <ellipse cx={0.4} cy={1.6} rx={1.4} ry={0.6} fill="rgba(0,0,0,0.25)" />
          <circle ref={ballCircleRef} cy={-0.4} r={flash ? 2.2 : 1.55} fill="url(#ballSheen)" stroke="#222" strokeWidth="0.32">
            {flash && <animate attributeName="r" values="1.6;3.2;1.6" dur="0.45s" repeatCount="3" />}
          </circle>
        </g>
      </svg>

      {/* ボール保持者の名前タグ（ライブのボールに追従） */}
      {beat.actorName && beat.side && !flash && (
        <div ref={tagRef} style={{
          position: 'absolute', left: `${bx}%`, top: `${by}%`,
          transform: 'translate(-50%, -230%)', pointerEvents: 'none',
          background: beat.side === 'home' ? home.color : away.color,
          color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 7,
          whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}>{beat.actorName}</div>
      )}

      {ownerSide && !flash && (
        <div style={{
          position: 'absolute', top: 4, [ownerSide === 'home' ? 'right' : 'left']: 6,
          fontSize: 9, fontWeight: 900, color: '#fff', background: 'rgba(0,0,0,0.32)', padding: '1px 6px', borderRadius: 6, pointerEvents: 'none',
        } as React.CSSProperties}>{ownerSide === 'home' ? `${home.shortName} ▶` : `◀ ${away.shortName}`}</div>
      )}

      {flash && (
        <div className="goal-pop" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 40, fontWeight: 900, color: '#fff', textShadow: '0 2px 14px rgba(231,111,81,0.95), 0 0 5px #000', letterSpacing: '0.08em' }}>GOAL!</span>
        </div>
      )}
    </div>
  )
}
