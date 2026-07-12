// ============================================================
// components/MatchView.tsx — 試合観戦（新エンジンの beats を再生）
// 横長: 上=スコアボード＋スタッツ / 左=フォーメーションピッチ / 右=実況。
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MatchBeat, MatchResult, Player, Tactics, Team } from '../engine/types'
import { Pitch2D } from './Pitch2D'
import { PKView } from './PKView'
import { PlayerAvatar } from '../ui/PlayerAvatar'
import { playerOverallSum } from '../engine/match/teamQuality'
import { Confetti } from '../ui/celebrate'
import { asset } from '../ui/asset'
import { POSITION_LABEL, MENTALITY_LABEL, FORMATION_DESC } from '../lib/labels'
import { FORMATION_LIST } from '../engine/match/formations'
import { FORMATION_COORDS } from '../engine/match/formationCoords'
import { sfxWhistle, sfxGoal, sfxConcede, sfxSave, sfxCard, sfxTackle, sfxEnabled, setSfxEnabled } from '../ui/sfx'

// 実況フィードのアイコン（一目で何が起きたか分かる）
function feedIcon(a: string): string {
  switch (a) {
    case 'shot-goal': return '⚽'
    case 'shot-saved': return '🧤'
    case 'shot-off': return '🎯'
    case 'corner': return '🚩'
    case 'foul-red': return '🟥'
    case 'foul-yellow': return '🟨'
    case 'foul-none': return '✋'
    case 'tackle': case 'intercept': return '🛡'
    case 'kickoff': return '🔔'
    case 'half-time': return '⏸'
    case 'sub-window': return '🪧'  // F7: 試合中の采配ポイント
    case 'full-time': return '🏁'
    case 'extra-start': case 'pk': return '⏱'
    default: return '・'
  }
}

// スタッツ比較バー用の割合（home側%）
function pct(a: number, b: number): number {
  const t = a + b
  return t === 0 ? 50 : Math.round((a / t) * 100)
}

// 見せ場テロップ（得点以外のドラマを「観て分かる」ように）
function bigMoment(b: MatchBeat, home: Team, away: Team): { label: string; sub?: string; color: string } | null {
  const mine = (b.side === 'home' && home.isPlayer) || (b.side === 'away' && away.isPlayer)
  switch (b.action) {
    case 'shot-saved': return { label: 'ナイスセーブ！', sub: b.targetName ? `GK ${b.targetName}` : undefined, color: '#3f6fb0' }
    case 'shot-off': return { label: '惜しい！', sub: 'シュートは枠の外', color: '#7c8794' }
    case 'corner': return { label: 'コーナーキック', color: '#2a9d8f' }
    case 'foul-red': return { label: '一発レッド！', sub: '数的不利に', color: '#e63946' }
    case 'foul-yellow': return { label: 'イエローカード', color: '#e0a91c' }
    case 'tackle': return { label: mine ? 'ボール奪取！' : 'ボールを奪われた', sub: b.actorName, color: mine ? '#2f8a52' : '#b06a3a' }
    case 'intercept': return { label: mine ? 'パスカット！' : 'パスをカットされた', sub: b.actorName, color: mine ? '#2f8a52' : '#b06a3a' }
    case 'extra-start': return { label: '延長戦！', sub: '勝負はまだ終わらない', color: '#9b5de5' }
    case 'pk': return { label: 'PK戦', sub: '運命の一発勝負', color: '#e63946' }
    default: return null
  }
}

// ハーフタイムの戦術1項目（普段の戦術画面と同じ粒度のチップ選択）
function TacRow({ label, opts, val, on, hint }: { label: string; opts: [string, string][]; val: string; on: (v: string) => void; hint?: string }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-soft)', marginBottom: 3 }}>{label}</div>
      <div className="chip-row">
        {opts.map(([v, lab]) => (
          <button key={v} className={`chip ${val === v ? 'active' : ''}`} style={{ padding: '4px 9px', fontSize: 11.5 }} onClick={() => on(v)}>{lab}</button>
        ))}
      </div>
      {hint && <div className="dim" style={{ fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  )
}

// 試合中の采配ポイントでの受け口（F7: ハーフタイムだけでなく前半中盤・後半中盤でも使う）
export interface HalfTimeControls {
  mySide: 'home' | 'away'
  onPitch: Player[]
  bench: Player[]
  tactics: Tactics                 // 現在の全戦術（采配で丸ごと変更可）
  onSub: (outId: string, inId: string) => void
  onTactics: (tactics: Tactics) => void
  onResume: () => void             // 次の停止点 or 最終まで進める
}

// beats が無い旧resultでも落ちないようstepsから最小beatを作る
function fallbackBeats(result: MatchResult): MatchBeat[] {
  return result.steps.map((s) => ({
    i: s.step, minute: s.minute, side: s.side, zone: 2, lane: 'C' as const,
    ballX: s.ballX, ballY: s.ballY,
    action: s.scored ? 'shot-goal' : 'flavor',
    text: s.text, homeScore: s.homeScore, awayScore: s.awayScore,
  }))
}

export function MatchView({
  result, home, away, onDone, title, awaitingSecondHalf, ht,
}: {
  result: MatchResult
  home: Team
  away: Team
  onDone: () => void
  title?: string
  awaitingSecondHalf?: boolean   // true=後半未消化（ハーフタイムで采配を挟む）
  ht?: HalfTimeControls
}) {
  const beats = useMemo(() => (result.beats && result.beats.length ? result.beats : fallbackBeats(result)), [result])
  const [idx, setIdx] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [intro, setIntro] = useState(true)
  const [htPaused, setHtPaused] = useState(false)
  const [htTac, setHtTac] = useState<Tactics | null>(null)
  const [subs, setSubs] = useState<{ outId: string; inId: string }[]>([])
  const [pickOut, setPickOut] = useState<string | null>(null)
  // G-01: HT采配で「誰を入れる？」リストが戦術ブロックの下に押し出され見切れる問題の対策。
  //       pickOut設定時にこのリストを表示領域へスクロールして必ず見せる。
  const pickListRef = useRef<HTMLDivElement | null>(null)
  // F7: 中間停止点（前半23分・後半68分）は「采配画面に入るか？」の確認を挟む。
  //     初期=false（確認ダイアログ表示）→「はい」で true（采配UIを開く）。HT は常に true（直接采配）。
  const [subAdjustOpened, setSubAdjustOpened] = useState(false)
  // F7: 各采配ポイント（half-time / sub-window）で一度だけ停止する。
  //     beatのidxで管理＝複数停止点を順に処理できる。
  const htHandledIds = useRef<Set<number>>(new Set())
  const timer = useRef<number | null>(null)
  const feedRef = useRef<HTMLDivElement | null>(null)

  const last = beats.length - 1
  const atEnd = idx >= last
  const matchOver = atEnd && !awaitingSecondHalf  // 真の試合終了（前半終わりや采配ポイントの暫定endと区別）

  useEffect(() => {
    const t = window.setTimeout(() => setIntro(false), 1600)
    return () => clearTimeout(t)
  }, [])

  // G-44: 試合(result)が切り替わったら采配state(subs/pickOut/htHandledIds等)を必ず初期化する。
  //   トーナメントで複数試合連続消化するとき、前試合のsubs.inIdが新試合のbench.idと衝突して
  //   「誰を入れる？を押しても候補が出ない」現象が起きていた根本原因。
  // ※ F7セグメント方式以降、親(CareerComp)は segment advance ごとに result を新オブジェクトで
  //    再生成する。dep を [result] にすると 23分采配ポイントで「再開」→ result 識別子変化 →
  //    setIdx(0) で 0分に巻き戻り、再び同じ停止点で止まる無限ループに陥る。
  //    対戦カード(homeTeamId/awayTeamId)が変わったときだけ＝本当に別試合に切り替わったときだけ
  //    リセットする。試合中のセグメント切替では idx/采配 state を保つ。
  useEffect(() => {
    setSubs([])
    setPickOut(null)
    setHtTac(null)
    setSubAdjustOpened(false)
    setHtPaused(false)
    htHandledIds.current = new Set()
    setIdx(0)
  }, [result.homeTeamId, result.awayTeamId])

  // F7: 采配ポイント（'half-time'または'sub-window'）で一旦停止し、交代/戦術を挟む
  useEffect(() => {
    const a = beats[idx]?.action
    if ((a === 'half-time' || a === 'sub-window') && !htHandledIds.current.has(idx)) {
      htHandledIds.current.add(idx)
      setHtPaused(true)
      setPickOut(null) // G-01: 新しい停止点では交代の選択状態をリセット（前の停止点の残留を防ぐ）
      // HT は直接采配UIを開く。中間（sub-window）は先に「采配するか？」の確認を出す。
      setSubAdjustOpened(a === 'half-time')
      if (ht?.tactics) setHtTac({ ...ht.tactics }) // 采配の初期値＝現在の戦術
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, beats])

  // G-01: 替える選手を選んだら「誰を入れる？」リストへスクロールし、HTでも入る選手UIを確実に見せる。
  useEffect(() => {
    if (pickOut) pickListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [pickOut])

  useEffect(() => {
    if (!playing || atEnd || intro || htPaused) return
    const a = beats[idx]?.action
    // 連続モーションが映えるリズム：ビルドアップは軽快／要所は溜め／シュート・ゴールはドラマチックに。
    const base = a === 'shot-goal' ? 1750
      : a && a.startsWith('shot') ? 1200
      : (a === 'tackle' || a === 'intercept' || a === 'corner' || (a && a.startsWith('foul'))) ? 950
      : (a === 'pass' || a === 'dribble' || a === 'carry') ? 660
      : 780
    // G-18: PK戦は1蹴りごとに見せ場があるので倍速を無効化（常に等速）。
    const isPk = a === 'pk' || a === 'pk-goal' || a === 'pk-save'
    const eff = isPk ? 1 : speed
    timer.current = window.setTimeout(() => setIdx((i) => Math.min(last, i + 1)), base / eff)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [idx, playing, speed, atEnd, last, beats, intro, htPaused])

  const cur = beats[idx] ?? beats[0]
  const flash = cur?.action === 'shot-goal'
  const playerScored = flash && ((cur.side === 'home' && home.isPlayer) || (cur.side === 'away' && away.isPlayer))
  const scorer = playerScored ? (cur.side === 'home' ? home : away).players.find((p) => p.id === cur.actorId) : null
  // 一発レッド：ゴールと同等の演出強度（祝祭でなく重み）。自軍退場/相手退場で見え方を変える。
  const redFlash = cur?.action === 'foul-red'
  const myRed = redFlash && ((cur.side === 'home' && home.isPlayer) || (cur.side === 'away' && away.isPlayer))
  const oppRed = redFlash && !myRed && (home.isPlayer || away.isPlayer)
  // G-26: 退場プレーヤーは「攻撃側(beat.side)とは反対のチーム」の選手。
  //   レッドが出たビートのactorIdが、その時点の被退場者ID。
  //   ピッチ上の人数を正しく減らすため、現在のidxまでに発生した退場者IDを累積で集計する。
  const sentOff = redFlash ? (cur.side === 'home' ? away : home).players.find((p) => p.id === cur.actorId) : null
  const sentOffSets = useMemo(() => {
    const homeIds = new Set<string>()
    const awayIds = new Set<string>()
    for (let i = 0; i <= idx; i++) {
      const b = beats[i]
      if (b?.action === 'foul-red' && b.actorId) {
        // 退場側 = beat.side（攻撃側）の反対チーム
        if (b.side === 'home') awayIds.add(b.actorId)
        else homeIds.add(b.actorId)
      }
    }
    return { home: homeIds, away: awayIds }
  }, [beats, idx])

  // 効果音（再生位置の節目で1回だけ）
  const [soundOn, setSoundOn] = useState(sfxEnabled())
  const sfxRef = useRef(-1)
  useEffect(() => {
    if (intro || sfxRef.current === idx) return
    sfxRef.current = idx
    const a = beats[idx]?.action
    if (a === 'kickoff' || a === 'full-time') sfxWhistle()
    else if (a === 'shot-goal') {
      const mine = (cur.side === 'home' && home.isPlayer) || (cur.side === 'away' && away.isPlayer)
      if (mine) sfxGoal(); else sfxConcede()
    } else if (a === 'shot-saved') sfxSave()
    else if (a === 'foul-red' || a === 'foul-yellow') sfxCard()
    else if (a === 'tackle' || a === 'intercept') sfxTackle()
  }, [idx, beats, intro, cur, home, away])

  // ライブ・スタッツ（再生位置までの集計：支配率/シュート/枠内/CK/ファウル/イエロー/レッド）
  const live = useMemo(() => {
    let hp = 0, ap = 0, hs = 0, as = 0, hsot = 0, asot = 0, hck = 0, ack = 0, hf = 0, af = 0
    let hy = 0, ay = 0, hr = 0, ar = 0
    for (let i = 0; i <= idx && i < beats.length; i++) {
      const b = beats[i]
      if (b.side === 'home') hp++; else if (b.side === 'away') ap++
      if (b.action.startsWith('shot')) { if (b.side === 'home') hs++; else if (b.side === 'away') as++ }
      if (b.action === 'shot-goal' || b.action === 'shot-saved') { if (b.side === 'home') hsot++; else if (b.side === 'away') asot++ }
      if (b.action === 'corner') { if (b.side === 'home') hck++; else if (b.side === 'away') ack++ }
      if (b.action.startsWith('foul')) { if (b.side === 'home') hf++; else if (b.side === 'away') af++ }
      if (b.action === 'foul-yellow') { if (b.side === 'home') hy++; else if (b.side === 'away') ay++ }
      if (b.action === 'foul-red') { if (b.side === 'home') hr++; else if (b.side === 'away') ar++ }
    }
    // 勢い（直近14ビートの攻撃的プレーの偏り）
    let mh = 0, ma = 0
    for (let i = Math.max(0, idx - 13); i <= idx && i < beats.length; i++) {
      const b = beats[i]
      if (!b.side) continue
      let w = b.zone >= 4 ? 2.5 : b.zone >= 3 ? 1.8 : b.zone >= 2 ? 1 : 0.5
      if (b.action.startsWith('shot')) w += 2
      if (b.side === 'home') mh += w; else ma += w
    }
    const mtot = mh + ma || 1
    const tot = hp + ap || 1
    return { possHome: Math.round((hp / tot) * 100), hShots: hs, aShots: as, hsot, asot, hck, ack, hf, af, hy, ay, hr, ar, momHome: Math.round((mh / mtot) * 100) }
  }, [idx, beats])

  const moment = !flash && !intro && !htPaused ? bigMoment(cur, home, away) : null

  // 実況は「見せ場」を中心に（パスの羅列を間引き、要所を残す）
  const feed = useMemo(() => {
    // ログは「重要なプレーのみ」（ゴール・シュート・好セーブ・カード・セットプレー・ハーフタイム）。
    // ドリブル/パス/つなぎ等の細かい行動は省く（#17）。
    const IMPORTANT = new Set(['shot-goal', 'shot-saved', 'shot-off', 'foul-red', 'foul-yellow', 'corner', 'half-time', 'sub-window', 'pk', 'pk-goal', 'pk-miss', 'pk-save', 'extra-start'])
    const notable = (b: MatchBeat) => IMPORTANT.has(b.action)
    return beats.slice(0, idx + 1).filter(notable).reverse().slice(0, 30)
  }, [idx, beats])

  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = 0 }, [idx])

  const skip = () => { setPlaying(false); setIdx(last) }

  const TeamName = ({ t }: { t: Team }) => (
    <div className="center" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: t.color, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 14, boxShadow: '0 2px 5px rgba(0,0,0,0.2)', border: t.isPlayer ? '2px solid var(--sun)' : '2px solid rgba(255,255,255,0.6)' }}>
        {t.shortName?.[0] ?? '⚽'}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', color: t.isPlayer ? 'var(--orange-deep)' : 'var(--ink)' }}>
        {t.isPlayer && '★'}{t.shortName}
      </div>
    </div>
  )

  const StatBar = () => (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)' }}>
        <span>{live.possHome}%</span><span style={{ letterSpacing: '0.05em' }}>ボール支配</span><span>{100 - live.possHome}%</span>
      </div>
      <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 3, background: away.color }}>
        <div style={{ width: `${live.possHome}%`, background: home.color, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-dim)', marginTop: 5, gap: 4 }}>
        {([['シュート', live.hShots, live.aShots], ['枠内', live.hsot, live.asot], ['CK', live.hck, live.ack], ['反則', live.hf, live.af], ['🟨', live.hy, live.ay], ['🟥', live.hr, live.ar]] as const).map(([lab, h, a]) => (
          <span key={lab} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-num)' }}>{h}</b>
            <span style={{ fontSize: 9.5 }}>{lab}</span>
            <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-num)' }}>{a}</b>
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className="screen" style={{ position: 'relative' }}>
      {title && <div className="app-title">{title}</div>}

      {intro && (
        <div className="event-overlay" style={{ background: 'rgba(38,54,40,0.78)' }} onClick={() => setIntro(false)}>
          <div className="pop-in center" style={{ color: '#fff' }}>
            <img src={asset('events/pitch-entry.webp')} alt="" style={{ width: 230, maxWidth: '68%', filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.4))' }} onError={(e) => { (e.currentTarget.style.display = 'none') }} />
            <div style={{ fontFamily: 'var(--font-pop)', fontSize: 26, marginTop: 8 }}>{title ?? 'まもなくキックオフ'}</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 6 }}>
              <span style={{ color: home.isPlayer ? 'var(--sun)' : '#fff' }}>{home.shortName}</span>
              <span style={{ margin: '0 10px', opacity: 0.8 }}>vs</span>
              <span style={{ color: away.isPlayer ? 'var(--sun)' : '#fff' }}>{away.shortName}</span>
            </div>
            <div style={{ fontSize: 12, marginTop: 10, opacity: 0.8 }}>タップでスキップ</div>
          </div>
        </div>
      )}

      {htPaused && (() => {
        const meSide = ht?.mySide ?? (home.isPlayer ? 'home' : away.isPlayer ? 'away' : null)
        const myS = meSide === 'home' ? cur.homeScore : meSide === 'away' ? cur.awayScore : 0
        const opS = meSide === 'home' ? cur.awayScore : meSide === 'away' ? cur.homeScore : 0
        const ahead = myS > opS, behind = myS < opS
        const face = ahead ? 'coach-happy' : behind ? 'coach-sad' : 'coach'
        // F7: 停止点ごとにラベル・セリフ・再開ボタン文言を出し分け
        const isHT = cur.action === 'half-time'
        const isFirstWindow = cur.action === 'sub-window' && cur.minute < 45
        const isExtraStart = cur.action === 'sub-window' && cur.minute >= 88 && cur.minute < 100
        const isExtraHT = cur.action === 'sub-window' && cur.minute >= 100
        const isSecondWindow = cur.action === 'sub-window' && cur.minute >= 45 && cur.minute < 88
        const overlayTitle = isHT
          ? '― ハーフタイム ―'
          : isExtraStart ? '― 延長戦・采配タイム ―'
          : isExtraHT ? '― 延長前半終了・采配タイム ―'
          : `― ${cur.minute}分・采配タイム ―`
        const resumeLabel = isHT ? '後半キックオフ ▶' : isExtraStart ? '延長前半キックオフ ▶' : isExtraHT ? '延長後半キックオフ ▶' : '試合を再開 ▶'
        const line = !meSide
          ? (isHT ? '前半終了。後半も見守ろう。' : 'プレーが一旦止まる。流れを見極めよう。')
          : isHT
            ? (ahead ? 'よし、リードしてる。後半も集中を切らすな！'
              : behind ? 'まだ45分ある。采配で流れを変えるぞ！'
              : '互角だ。ここからの45分で決める。落ち着いていこう。')
            : isFirstWindow
              ? (ahead ? 'いい入りだ。このまま前半折り返しまで安全に行こう。'
                : behind ? '相手のペースだな。今のうちに手を打つぞ。'
                : '探り合いはここまで。前半残りで主導権を握ろう。')
              : isExtraStart
                ? '90分で決着がつかなかった。延長戦に入る。フレッシュな足が物を言うぞ。'
                : isExtraHT
                  ? '延長前半終了。最後の15分、ここで決めるか、PKまで持ち込むか。'
                  : isSecondWindow
                    ? (ahead ? '残り20分強。守り切る形に整えるか、追加点を狙うか。'
                      : behind ? '残り20分強。ここが勝負の分かれ目だ。仕掛けるぞ！'
                      : '残り20分強。同点だ。決めにいく1手を打とう。')
                    : '采配タイム。'
        const interactive = !!ht && awaitingSecondHalf
        const MAX_SUBS = 5
        const usedInIds = new Set(subs.map((s) => s.inId))
        const benchLeft = interactive ? ht!.bench.filter((b) => !usedInIds.has(b.id)) : []
        const doSub = (inId: string) => {
          if (!pickOut || subs.length >= MAX_SUBS) return
          ht!.onSub(pickOut, inId)
          setSubs((arr) => [...arr, { outId: pickOut, inId }])
          setPickOut(null)
        }
        const resume = () => {
          if (ht?.onResume) ht.onResume()
          setHtPaused(false); setIdx((i) => Math.min(beats.length - 1, i + 1))
        }
        // F7: 中間（前半23分・後半68分）は HT より演出を簡略化する。
        //   - 背景dimを薄く（試合観戦の中断感を弱める）
        //   - スコアボードのスコアフォントを小さく（節目感を出さない）
        //   - コーチマスコット行を非表示（セリフだけ控えめに）
        //   - 戦術変更セクションは折りたたみ（必要なときだけ開く・交代UIを主役に）
        //   - 中間は先に「采配するか？はい/いいえ」の確認ダイアログを出す（毎回采配画面に飛ばさない）

        // 中間ストップ & 未確認 → 軽量な確認ダイアログだけ表示
        if (!isHT && !subAdjustOpened) {
          const promptLine = isFirstWindow ? 'ここで戦術や交代を見直すか？' : '試合終盤だ。最後の采配を入れるか？'
          return (
            <div className="event-overlay" style={{ background: 'rgba(38,54,40,0.55)' }}>
              <div className="event-card pop-in" style={{ maxWidth: 'min(94vw, 420px)', textAlign: 'center' }}>
                <div className="event-title" style={{ fontSize: 15 }}>{overlayTitle}</div>
                <div style={{ margin: '6px 0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 800 }}>
                  <span style={{ fontSize: 12.5 }}>{home.isPlayer && '★'}{home.shortName}</span>
                  <span className="score-num" style={{ fontSize: 22 }}>{cur.homeScore}</span>
                  <span style={{ opacity: 0.5 }}>-</span>
                  <span className="score-num" style={{ fontSize: 22 }}>{cur.awayScore}</span>
                  <span style={{ fontSize: 12.5 }}>{away.isPlayer && '★'}{away.shortName}</span>
                </div>
                <div className="dim" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{line}</div>
                <div style={{ fontWeight: 800, fontSize: 14, marginTop: 10 }}>{promptLine}</div>
                {interactive ? (
                  <div className="row" style={{ marginTop: 10, gap: 8 }}>
                    <button className="btn ghost" style={{ flex: 1 }} onClick={resume}>このまま続ける</button>
                    <button className="btn" style={{ flex: 1 }} onClick={() => setSubAdjustOpened(true)}>采配する ▶</button>
                  </div>
                ) : (
                  <button className="btn" style={{ marginTop: 10 }} onClick={resume}>{resumeLabel}</button>
                )}
              </div>
            </div>
          )
        }

        return (
          <div className="event-overlay" style={{ background: isHT ? 'rgba(38,54,40,0.82)' : 'rgba(38,54,40,0.62)' }}>
            {/* F1.5: PC前面パネルの横幅活用。interactive（采配UI）は広く・閲覧のみは中位。 */}
            <div className="event-card pop-in" style={{ maxWidth: interactive ? 'min(94vw, 640px)' : 'min(94vw, 500px)', maxHeight: '94%', overflowY: 'auto' }}>
              <div className="event-title" style={{ textAlign: 'center', fontSize: isHT ? undefined : 16 }}>{overlayTitle}</div>
              <div className="scoreboard" style={{ margin: '6px 0 2px', gap: isHT ? 12 : 10 }}>
                <span style={{ fontWeight: 800, fontSize: isHT ? 14 : 12.5 }}>{home.isPlayer && '★'}{home.shortName}</span>
                <span className="score-num" style={{ fontSize: isHT ? 34 : 22 }}>{cur.homeScore}</span>
                <span style={{ opacity: 0.5, fontWeight: 800 }}>-</span>
                <span className="score-num" style={{ fontSize: isHT ? 34 : 22 }}>{cur.awayScore}</span>
                <span style={{ fontWeight: 800, fontSize: isHT ? 14 : 12.5 }}>{away.isPlayer && '★'}{away.shortName}</span>
              </div>
              {isHT ? (
                <div className="mascot-row" style={{ marginTop: 4 }}>
                  <img className="mascot-img" src={asset(`mascot/${face}.webp`)} alt="" style={{ width: 56, height: 56 }} />
                  <div className="bubble" style={{ fontSize: 13.5 }}>{line}</div>
                </div>
              ) : (
                // 中間: マスコットを使わずセリフだけ1行・控えめに
                <div className="dim" style={{ fontSize: 12, marginTop: 3, textAlign: 'center', lineHeight: 1.45 }}>{line}</div>
              )}

              {interactive && (() => {
                const tac = htTac ?? ht!.tactics
                const setTac = (patch: Partial<Tactics>) => { const n = { ...tac, ...patch }; setHtTac(n); ht!.onTactics(n) }
                // 中間は <details> で折りたたみ（クリックで展開）。HTは常時展開。
                const tacticsBlock = (
                  <>
                    <TacRow label="フォーメーション" opts={FORMATION_LIST.map((f) => [f, f])} val={tac.formation} on={(v) => setTac({ formation: v as Tactics['formation'] })} hint={FORMATION_DESC[tac.formation]} />
                    <TacRow label="姿勢" opts={(['ultra-attack', 'attack', 'balance', 'defense', 'ultra-defense'] as const).map((m) => [m, MENTALITY_LABEL[m]])} val={tac.mentality} on={(v) => setTac({ mentality: v as Tactics['mentality'] })} hint="攻撃的ほど得点力UP・守備が手薄。守備的ほど堅いが点は取りにくい。" />
                    <TacRow label="プレス" opts={[['high', '激しい'], ['mid', '標準'], ['low', '低い']]} val={tac.press} on={(v) => setTac({ press: v as Tactics['press'] })} hint="激しい＝高い位置で奪える／スタミナ消耗。低い＝省エネだが押し込まれる。" />
                    <TacRow label="守備ライン" opts={[['high', '高い'], ['mid', '標準'], ['low', '低い']]} val={tac.defenseLine} on={(v) => setTac({ defenseLine: v as Tactics['defenseLine'] })} hint="高い＝主導権／速い相手に裏を取られやすい。低い＝安全だが押し込まれる。" />
                    <TacRow label="攻撃の幅" opts={[['wide', 'ワイド'], ['mid', '標準'], ['central', '中央']]} val={tac.width} on={(v) => setTac({ width: v as Tactics['width'] })} hint="ワイド＝サイドから崩す。中央＝中央突破。" />
                    <TacRow label="ビルドアップ" opts={[['fast', '速い'], ['mid', '標準'], ['slow', '遅い']]} val={tac.buildUp} on={(v) => setTac({ buildUp: v as Tactics['buildUp'] })} hint="速い＝速攻。遅い＝じっくり保持して崩す。" />
                  </>
                )
                return (
                <>
                  {/* 戦術（HT=後半の戦術として常時展開／中間=必要なときだけ展開） */}
                  {isHT ? (
                    <>
                      <div className="section-label" style={{ margin: '10px 0 4px' }}>⚙ 後半の戦術</div>
                      {tacticsBlock}
                    </>
                  ) : (
                    <details style={{ margin: '8px 0 2px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 12.5, color: 'var(--ink-soft)', padding: '4px 0' }}>⚙ 戦術を変える（任意）</summary>
                      <div style={{ marginTop: 4 }}>{tacticsBlock}</div>
                    </details>
                  )}

                  {/* 交代 */}
                  <div className="section-label" style={{ margin: isHT ? '10px 0 4px' : '6px 0 4px' }}>交代 <span className="dim" style={{ fontWeight: 700 }}>{subs.length}/{MAX_SUBS}人 ・ 控え{ht!.bench.length}人</span></div>
                  {/* ベンチが空＝交代不可。目立つ警告で「交代できない」を伝える（小さい文字で隠れていた症状の解消） */}
                  {ht!.bench.length === 0 && (
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#a8512a', padding: '7px 10px', background: '#fce8e0', borderRadius: 7, textAlign: 'center', marginBottom: 6 }}>
                      ベンチに控え選手がいません（交代できません）
                    </div>
                  )}
                  {!pickOut ? (
                    <>
                      <div className="dim" style={{ fontSize: 11, marginBottom: 4 }}>替える選手をタップ（フォーメーション表示・🔴=疲労大）</div>
                      <div style={{ position: 'relative', width: '100%', height: 'min(82vw, 320px)', flexShrink: 0, background: 'linear-gradient(180deg,#5fc189,#3f9f63)', borderRadius: 10, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: '5%', right: '5%', top: '50%', height: 1, background: 'rgba(255,255,255,0.35)' }} />
                        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 46, height: 46, border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
                        {(FORMATION_COORDS[tac.formation] ?? FORMATION_COORDS['4-4-2']).map((cd, i) => {
                          const anchor = ht!.onPitch[i]; if (!anchor) return null
                          const subRec = subs.find((s) => s.outId === anchor.id)
                          const cur = subRec ? (ht!.bench.find((b) => b.id === subRec.inId) ?? anchor) : anchor
                          const isSubbed = !!subRec
                          const sel = pickOut === anchor.id
                          const [depth, lat] = cd
                          const fatCol = cur.fatigue >= 70 ? '#ff5a4d' : cur.fatigue >= 45 ? '#ffd23f' : '#bfe3b0'
                          return (
                            <button key={i} disabled={isSubbed || subs.length >= MAX_SUBS || ht!.bench.length === 0} onClick={() => setPickOut(anchor.id)}
                              style={{ position: 'absolute', left: `${8 + lat * 84}%`, top: `${8 + (1 - depth) * 82}%`, transform: 'translate(-50%,-50%)',
                                width: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
                                background: sel ? 'var(--orange)' : isSubbed ? 'rgba(240,240,240,0.7)' : 'rgba(255,255,255,0.96)',
                                color: sel ? '#fff' : 'var(--ink)', border: sel ? '2px solid #fff' : '2px solid rgba(0,0,0,0.14)',
                                borderRadius: 9, padding: '2px 1px', cursor: isSubbed ? 'default' : 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', opacity: isSubbed ? 0.7 : 1 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 900, lineHeight: 1.05 }}>{cur.number ?? ''}<span style={{ fontSize: 8, fontWeight: 800, marginLeft: 2 }}>{POSITION_LABEL[anchor.slot ?? anchor.position]}</span></span>
                              <span style={{ fontSize: 9.5, fontWeight: 800, lineHeight: 1.1, maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur.name}{(cur.skills?.length ?? 0) > 0 ? '⚡' : ''}</span>
                              <span style={{ display: 'inline-block', width: 14, height: 3.5, borderRadius: 2, background: sel ? '#fff' : fatCol, marginTop: 1 }} />
                              {isSubbed && <span style={{ position: 'absolute', top: -5, right: -3, fontSize: 8, fontWeight: 900, background: '#5a9a4a', color: '#fff', borderRadius: 5, padding: '0 3px' }}>替</span>}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* G-02: 出る選手の能力値・疲労を一行で見せる（誰を入れるかの判断材料） */}
                      {(() => {
                        const outP = ht!.onPitch.find((p) => p.id === pickOut)
                        return (
                          <div ref={pickListRef} className="dim" style={{ fontSize: 11, marginBottom: 4 }}>
                            <b style={{ color: 'var(--ink)' }}>{outP?.name}</b>
                            {outP && (<span style={{ marginLeft: 6, opacity: 0.85 }}>総{Math.round(playerOverallSum(outP) / 7)}・疲{Math.round(outP.fatigue)}{(outP.skills?.length ?? 0) > 0 ? ` ⚡${outP.skills!.length}` : ''}</span>)}
                            <span> → 誰を入れる？</span>
                            <button className="chip" style={{ padding: '2px 8px', fontSize: 11, marginLeft: 6 }} onClick={() => setPickOut(null)}>やめる</button>
                          </div>
                        )
                      })()}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 130, overflowY: 'auto' }}>
                        {benchLeft.length === 0 && (
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#a8512a', padding: '6px 10px', background: '#fce8e0', borderRadius: 7, width: '100%', textAlign: 'center' }}>
                            ベンチに控え選手がいません
                          </div>
                        )}
                        {benchLeft.map((b) => (
                          <button key={b.id} className="chip" style={{ padding: '4px 9px', fontSize: 11.5, flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.35 }} onClick={() => doSub(b.id)}>
                            <span>{b.number ?? ''} {POSITION_LABEL[b.slot ?? b.position]} {b.name}</span>
                            <span style={{ fontSize: 9.5, opacity: 0.8 }}>総{Math.round(playerOverallSum(b) / 7)}・疲{Math.round(b.fatigue)}{(b.skills?.length ?? 0) > 0 ? ` ⚡${b.skills!.length}` : ''}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
                )
              })()}

              <button className="btn" style={{ marginTop: 12 }} onClick={interactive ? resume : () => { setHtPaused(false); setIdx((i) => Math.min(last, i + 1)) }}>{resumeLabel}</button>
            </div>
          </div>
        )
      })()}

      {playerScored && (
        <div key={`cheer-${idx}`}>
          <Confetti count={40} />
          <div className="pop-in" style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', zIndex: 41, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
            {scorer
              ? <div style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))' }}><PlayerAvatar player={scorer} size={64} /></div>
              : <img src={asset('mascot/coach-happy.webp')} width={60} height={60} alt="" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }} />}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 900, fontSize: 34, color: 'var(--orange-deep)', textShadow: '0 2px 0 #fff, 0 3px 10px rgba(244,126,60,0.5)', letterSpacing: '0.04em', lineHeight: 1 }}>ゴーール！</div>
              {cur.actorName && <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)', textShadow: '0 1px 0 #fff', marginTop: 2 }}>⚽ {cur.actorName}</div>}
            </div>
          </div>
        </div>
      )}

      {redFlash && (
        <div key={`red-${idx}`}>
          {/* 画面全体に赤フラッシュ（祝祭感は出さない＝重み・痛み・転換点） */}
          <div className="red-flash" style={{ position: 'absolute', inset: 0, zIndex: 38, pointerEvents: 'none', background: 'radial-gradient(circle at center, rgba(230,57,70,0.55), rgba(230,57,70,0.15) 60%, transparent 80%)' }} />
          <div className="pop-in" style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', zIndex: 41, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
            {sentOff
              ? <div style={{ filter: 'drop-shadow(0 4px 10px rgba(230,57,70,0.55))' }}><PlayerAvatar player={sentOff} size={64} /></div>
              : <div style={{ fontSize: 56, filter: 'drop-shadow(0 4px 10px rgba(230,57,70,0.55))' }}>🟥</div>}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 900, fontSize: 32, color: '#e63946', textShadow: '0 2px 0 #fff, 0 3px 12px rgba(230,57,70,0.6)', letterSpacing: '0.05em', lineHeight: 1 }}>
                {myRed ? '退場……！' : oppRed ? '一発退場！' : '一発レッド！'}
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', textShadow: '0 1px 0 #fff', marginTop: 3 }}>
                🟥 {cur.actorName ?? '選手'}{myRed ? '（数的不利に）' : oppRed ? '（数的優位！）' : '（数的不利）'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* スコアボード＋スタッツ */}
      <div className="panel" style={{ padding: '10px 14px' }}>
        <div className="scoreboard">
          <TeamName t={home} />
          <div className="score-num">{cur.homeScore}</div>
          <div className="center" style={{ minWidth: 50 }}>
            <div className="clock">{matchOver ? '終了' : awaitingSecondHalf && atEnd ? (cur.action === 'half-time' ? 'HT' : `${cur.minute}'`) : `${cur.minute}'`}</div>
            <div className="dim" style={{ fontSize: 11, fontWeight: 800 }}>
              {(() => {
                if (matchOver) return '試合終了'
                if (awaitingSecondHalf && atEnd) return cur.action === 'half-time' ? 'ハーフタイム' : '采配タイム'
                // 90分超は AT（アディショナルタイム）。
                // ただし 'extra-start' ビートを通過済み＝ノックアウト同点後の本当の延長戦は「延長」表示。
                const inExtra = beats.slice(0, idx + 1).some((b) => b.action === 'extra-start')
                if (cur.minute <= 45) return '前半'
                if (cur.minute <= 90) return '後半'
                if (inExtra) return '延長'
                return 'AT'
              })()}
            </div>
          </div>
          <div className="score-num">{cur.awayScore}</div>
          <TeamName t={away} />
        </div>
        <StatBar />
      </div>

      {/* ピッチを主役に（フル幅・大きく）。実況は下に「今のプレー」を大きく1行＋ハイライトのみ。 */}
      <div style={{ marginTop: 6 }}>
        {/* 勢い（直近の流れ） */}
        {!matchOver && (
          <div style={{ width: '100%', marginBottom: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 800, color: 'var(--ink-dim)' }}>
              <span>勢い</span><span>{live.momHome >= 55 ? `${home.shortName}ペース` : live.momHome <= 45 ? `${away.shortName}ペース` : '互角'}</span>
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', background: away.color, marginTop: 2 }}>
              <div style={{ width: `${live.momHome}%`, background: home.color, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}

        <div style={{ width: '100%', position: 'relative' }}
          key={(cur.action === 'shot-goal' || cur.action === 'shot-saved' || cur.action === 'foul-red') ? `shk-${idx}` : 'pitch'}
          className={(cur.action === 'shot-goal' || cur.action === 'shot-saved' || cur.action === 'foul-red') ? 'pitch-shake' : undefined}>
          {/* #16 PK戦の1蹴りは専用のゴール正面表示（コース・GKの跳んだ方向を可視化） */}
          {(cur.action === 'pk-goal' || cur.action === 'pk-save')
            ? <PKView beat={cur} home={home} away={away} />
            : <Pitch2D beat={cur} home={home} away={away} sentOff={sentOffSets} />}
          {moment && (
            <div key={`mom-${idx}`} className="moment-cut" style={{ position: 'absolute', left: 0, right: 0, top: '38%', pointerEvents: 'none', textAlign: 'center' }}>
              <span style={{ display: 'inline-block', background: moment.color, color: '#fff', fontWeight: 900, fontSize: 17, padding: '5px 16px', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.4)', letterSpacing: '0.04em' }}>
                {moment.label}{moment.sub && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, opacity: 0.92 }}>{moment.sub}</span>}
              </span>
            </div>
          )}
        </div>

        {/* 今このピッチで起きていること（ライブ実況・大きく1行）＝ピッチを観ながら読める */}
        {!matchOver && (
          <div key={`live-${idx}`} className="pop-in" style={{
            marginTop: 7, padding: '9px 13px', borderRadius: 11, minHeight: 40, display: 'flex', alignItems: 'center', gap: 9,
            background: cur.action === 'shot-goal' ? 'rgba(244,126,60,0.16)' : '#fffdf8',
            borderLeft: `5px solid ${cur.side === 'home' ? home.color : cur.side === 'away' ? away.color : 'var(--card-edge)'}`,
            boxShadow: '0 2px 8px rgba(70,50,30,0.08)',
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{feedIcon(cur.action)}</span>
            <span style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.55, color: 'var(--ink)' }}>{cur.text}</span>
          </div>
        )}

        {/* ハイライト（要所のみ・コンパクト） */}
        <div className="section-label" style={{ margin: '9px 0 5px' }}>📣 ハイライト</div>
        <div className="feed" ref={feedRef} style={{ maxHeight: matchOver ? 220 : 116, overflowY: 'auto' }}>
          {feed.length === 0 && <div className="dim" style={{ fontSize: 12 }}>試合が動くと、ここに見せ場が並びます。</div>}
          {feed.map((s, i) => (
            <div className={`feed-line ${s.action === 'shot-goal' ? 'goal' : ''}`} key={`${s.i}_${i}`} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ flexShrink: 0 }}>{feedIcon(s.action)}</span><span>{s.text}</span>
            </div>
          ))}
        </div>
        {result.decidedByPK && matchOver && (
          <div className="panel tint-orange center" style={{ marginTop: 8, fontWeight: 800 }}>
            PK戦　{home.shortName} {result.homePK} - {result.awayPK} {away.shortName}
          </div>
        )}
      </div>

      {matchOver && (() => {
        const meId = home.isPlayer ? home.id : away.isPlayer ? away.id : null
        const mine = meId ? (result.scorers ?? []).filter((s) => s.teamId === meId) : []
        // MOM: 自チームの最多得点者、いなければ最高能力の先発
        const myTeam = home.isPlayer ? home : away.isPlayer ? away : null
        let mom: { p: typeof home.players[number]; reason: string } | null = null
        if (myTeam) {
          const goalCount: Record<string, number> = {}
          for (const s of mine) goalCount[s.playerId] = (goalCount[s.playerId] ?? 0) + 1
          const topScorerId = Object.entries(goalCount).sort((a, b) => b[1] - a[1])[0]?.[0]
          const byGoals = topScorerId ? myTeam.players.find((p) => p.id === topScorerId) : undefined
          if (byGoals) mom = { p: byGoals, reason: `${goalCount[topScorerId]}得点の活躍` }
          else {
            const top = [...myTeam.players.slice(0, 11)].sort((a, b) => playerOverallSum(b) - playerOverallSum(a))[0]
            if (top) mom = { p: top, reason: 'チームを牽引' }
          }
        }
        return (
          <>
            {mom && (
              <div className="panel tint-green" style={{ marginTop: 6, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <PlayerAvatar player={mom.p} size={46} />
                <div>
                  <div className="section-label" style={{ marginBottom: 1 }}>⭐ マン・オブ・ザ・マッチ</div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{mom.p.name}</div>
                  <div className="dim" style={{ fontSize: 11.5 }}>{mom.reason}</div>
                </div>
              </div>
            )}
            {mine.length > 0 && (
              <div className="panel tint-orange" style={{ marginTop: 6, padding: '9px 13px' }}>
                <b style={{ color: 'var(--orange-deep)' }}>⚽ 本日の得点者</b>
                <span style={{ fontSize: 13.5, marginLeft: 8 }}>{mine.map((s, i) => <span key={i}>{s.playerName}（{s.minute}'） </span>)}</span>
              </div>
            )}
            {/* 試合スタッツ比較（エンジン集計の確定値） */}
            {result.stats && (
            <div className="panel" style={{ marginTop: 6, padding: '10px 13px' }}>
              <div className="section-label center" style={{ marginBottom: 6 }}>📊 試合スタッツ</div>
              {([['ボール支配', `${result.stats.possessionHome}%`, `${100 - result.stats.possessionHome}%`, result.stats.possessionHome],
                 ['シュート', result.stats.shots.home, result.stats.shots.away, pct(result.stats.shots.home, result.stats.shots.away)],
                 ['枠内', result.stats.sot.home, result.stats.sot.away, pct(result.stats.sot.home, result.stats.sot.away)],
                 ['CK', result.stats.corners.home, result.stats.corners.away, pct(result.stats.corners.home, result.stats.corners.away)],
                 ['反則', result.stats.fouls.home, result.stats.fouls.away, pct(result.stats.fouls.home, result.stats.fouls.away)],
                 ['🟨 イエロー', live.hy, live.ay, pct(live.hy, live.ay)],
                 ['🟥 レッド', live.hr, live.ar, pct(live.hr, live.ar)]] as const).map(([lab, h, a, hpct]) => (
                <div key={lab} style={{ marginBottom: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
                    <span style={{ fontFamily: 'var(--font-num)' }}>{h}</span><span className="dim" style={{ fontSize: 11 }}>{lab}</span><span style={{ fontFamily: 'var(--font-num)' }}>{a}</span>
                  </div>
                  <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: away.color, marginTop: 2 }}>
                    <div style={{ width: `${hpct}%`, background: home.color }} />
                  </div>
                </div>
              ))}
            </div>
            )}
          </>
        )
      })()}

      <div className="footer-cta">
        {matchOver ? (
          <button className="btn" onClick={onDone}>結果を確定 ▶</button>
        ) : (
          <div className="row">
            <button className="btn ghost" style={{ flex: '0 0 20%' }} onClick={() => { const v = !soundOn; setSoundOn(v); setSfxEnabled(v) }}>{soundOn ? '🔊' : '🔇'}</button>
            <button className="btn ghost" style={{ flex: '0 0 22%' }} onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 3 : 1)}>{speed}倍</button>
            <button className="btn ghost" style={{ flex: '0 0 20%' }} onClick={() => setPlaying((p) => !p)}>{playing ? '⏸' : '▶'}</button>
            <button className="btn secondary" onClick={skip}>スキップ ⏩</button>
          </div>
        )}
      </div>
    </div>
  )
}
