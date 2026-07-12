// ============================================================
// engine/match/possession.ts — 新試合エンジン（ポゼッション・チェーン型）
//
// ボールが Z0(自陣GK前)→Z1(自陣)→Z2(中盤)→Z3(敵陣)→Z4(PA/シュート) の
// ゾーンを、選手から選手へ前進する。各前進は「保持者の能力 vs 守備者の能力」の
// デュエルで、成功=前進(パス/ドリブル)・失敗=ターンオーバー(タックル/インター)。
// Z4到達でシュート。ターンオーバー直後はトランジション(カウンター)が発生する。
//
// ・名前付きの選手が絡む実況を生成（サッカーゲーム感の核）
// ・戦術が「どのゾーンで何が起きるか」を変える（プレス位置・ライン・カウンター）
// ・決定的（seeded mulberry32）。simulate と観戦UIは beats を再生するだけ。
// ============================================================

import type {
  BeatAction, Condition, MatchBeat, MatchResult, MatchStats, Player, Tactics, Team,
} from '../types'
import { createRNG, type RNG } from '../rng'
import { atmosphereCoef, staminaCoef } from './teamQuality'
import { matchupEdgePct } from './tactics'
import { hasCombo } from '../../data/combos'

export interface MatchOptions {
  knockout: boolean   // 同点を許さない（延長・PK）
  bigMatch?: boolean  // 大一番（性格の試合補正が強く出る）
  // 気候適性係数（天候×チームの出身地域。1.0=中立。career層が算出して渡す＝engineは地域知識を持たない）
  climateHome?: number
  climateAway?: number
}

// ---- 調整レバー（balanceハーネスで「互角→各チーム1.2〜1.5点」に合わせる） ----
export const PTUNE = {
  ADV_BASE: 0.58, ADV_SPREAD: 0.42, ADV_DIV: 13, ADV_MIN: 0.15, ADV_MAX: 0.86,
  GOAL_BASE: 0.055, GOAL_SPREAD: 0.17, GOAL_DIV: 13, GOAL_MIN: 0.03, GOAL_MAX: 0.40,
  FOUL_RATE: 0.13,         // 前進失敗のうちファウルになる割合
  DRIBBLE_BIAS: 0.42,      // 前進成功が「ドリブル」になる基礎割合（速さ/技術で上下）
  TRANSITION_ATK: 1.10,    // トランジション時の前進ボーナス
  TRANSITION_SHOT: 1.18,   // トランジション/ビッグチャンスの決定率ボーナス
  STAMINA_DRAIN: 0.55,     // 1ビートの基礎スタミナ消耗
  DT_MIN: 0.45, DT_MAX: 1.45,// 1ビートの消費時間（分）
}

const CONDITION_COEF: Record<Condition, number> = { 1: 0.85, 2: 0.93, 3: 1.0, 4: 1.07, 5: 1.15 }
const HEIGHT_DUEL = [0, 0.88, 0.93, 0.97, 0.99, 1.0, 1.02, 1.05, 1.09, 1.13]
const HEIGHT_SAVE = [0, 0.82, 0.87, 0.92, 0.96, 1.0, 1.04, 1.08, 1.14, 1.18]

function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)) }

// 試合中のチーム揮発状態
interface Side {
  team: Team
  starters: Player[]
  byPos: Record<string, Player[]>
  live: Record<string, number> // 残スタミナ
  atmosphere: number
  score: number
  reds: number
  shots: number
  sot: number
  corners: number
  fouls: number
  possMs: number // 支配時間（分）
  climateCoef: number // 気候適性（1.0=中立）
  yellowIds: Set<string> // 警告を受けた選手id（2枚目で退場＝数的不利）
}

function buildSide(team: Team): Side {
  const starters = team.players.slice(0, 11)
  const live: Record<string, number> = {}
  // スタミナお化け(#34)＝疲労による出力低下の下限が高い（終盤も運動量が落ちにくい）。
  // スタミナお化け＝終盤の運動量下限UP。コンボ「不屈の機関車」はさらに高い下限。
  for (const p of starters) live[p.id] = Math.max(hasCombo(p, 'tireless-engine') ? 60 : p.skills?.includes('stamina-king') ? 52 : 35, 100 - p.fatigue * 0.4)
  const byPos: Record<string, Player[]> = {}
  for (const p of starters) {
    const slot = p.slot ?? p.position
    ;(byPos[slot] ??= []).push(p)
  }
  // キャプテンシー＝雰囲気の底上げ。コンボ「闘将」はさらに大きく引き上げる。
  const capBoost = starters.some((p) => hasCombo(p, 'captain-spirit')) ? 8 : starters.some((p) => p.skills?.includes('captaincy')) ? 4 : 0
  return {
    team, starters, byPos, live,
    atmosphere: 50 + capBoost,
    score: 0, reds: 0, shots: 0, sot: 0, corners: 0, fouls: 0, possMs: 0,
    climateCoef: 1, yellowIds: new Set(),
  }
}

// ゾーン別「ボール保持者」候補の重み（攻撃側視点）
const CARRIER_W: Record<number, Partial<Record<string, number>>> = {
  0: { GK: 3, CB: 2, DM: 1 },
  1: { CB: 3, SB: 2, DM: 3, CM: 3, WB: 2, GK: 1 },
  2: { DM: 3, CM: 3, AM: 2, WB: 2, SB: 2, CB: 1 },
  3: { AM: 3, WF: 3, WB: 2, CF: 2, CM: 1 },
  4: { CF: 4, WF: 3, AM: 2 },
}
// 攻撃側がゾーンzにいるとき、守る相手の候補の重み
const DEF_W: Record<number, Partial<Record<string, number>>> = {
  0: { CF: 2, WF: 1 },
  1: { CF: 2, WF: 2, AM: 1 },
  2: { DM: 3, CM: 3, WB: 2, AM: 1, CB: 1 },
  3: { CB: 3, SB: 2, WB: 1 },
  4: { CB: 3, SB: 1 },
}

function pickWeighted(side: Side, weights: Partial<Record<string, number>>, rng: RNG, exclude?: Player): Player {
  const pool: { p: Player; w: number }[] = []
  for (const [pos, w] of Object.entries(weights)) {
    for (const p of side.byPos[pos] ?? []) {
      if (p === exclude) continue
      pool.push({ p, w: w as number })
    }
  }
  if (pool.length === 0) {
    // フォールバック: フィールドプレイヤーから適当に
    const fp = side.starters.filter((p) => (p.slot ?? p.position) !== 'GK' && p !== exclude)
    return fp.length ? fp[rng.int(0, fp.length - 1)] : side.starters[0]
  }
  const total = pool.reduce((s, x) => s + x.w, 0)
  let r = rng.next() * total
  for (const x of pool) { r -= x.w; if (r <= 0) return x.p }
  return pool[0].p
}

function personalityMult(p: Player, isBehind: boolean, isBig: boolean): number {
  switch (p.personality) {
    case 'fighter': return isBehind ? 1.07 : 1.0
    case 'hotblood': return isBehind ? 1.04 : 1.0
    case 'genius': return isBig ? 1.06 : 1.0
    case 'timid': return isBig ? 0.91 : 0.97
    default: return 1.0
  }
}

function effMult(p: Player, side: Side, isBehind: boolean, isBig: boolean): number {
  // 大舞台の男(#9)：全国の大一番(big)でこそ全プレーに少し補正。コンボ「修羅場の支配者」はさらに強い。
  const bigGame = isBig ? (hasCombo(p, 'clutch-master') ? 1.14 : p.skills?.includes('big-game') ? 1.10 : 1) : 1
  return staminaCoef(side.live[p.id] ?? 100) * CONDITION_COEF[p.condition]
    * atmosphereCoef(side.atmosphere) * personalityMult(p, isBehind, isBig) * side.climateCoef * bigGame
}

/** #51 数的不利：退場(reds)でチームの実効力が下がる。1枚で攻守×0.91(≒10/11・spec§9)、線形（下限0.55）。 */
function redHandicap(reds: number): number { return reds > 0 ? Math.max(0.55, 1 - reds * 0.09) : 1 }
/** #51 守備側の追加ペナルティ：1枚ごと-0.05（穴が空き相手チャンス↑）。 */
function redDefExtra(reds: number): number { return reds > 0 ? Math.max(0.7, 1 - reds * 0.05) : 1 }

// ゾーン別の前進力（保持者の能力）※能力価値を均すため iq偏重を緩和し stamina/speed を厚く
function advanceScore(p: Player, zone: number): number {
  const a = p.abilities
  if (zone <= 1) return a.iq * 0.34 + a.technique * 0.40 + a.kick * 0.18 + a.stamina * 0.08
  if (zone === 2) return a.iq * 0.27 + a.technique * 0.27 + a.stamina * 0.26 + a.speed * 0.20
  return a.technique * 0.33 + a.speed * 0.33 + a.iq * 0.16 + a.kick * 0.18
}

// 守備力（守備者の能力・身長デュエル込み）※iqを下げ power/speed を厚く
function defendScore(p: Player): number {
  const a = p.abilities
  const power = a.power * HEIGHT_DUEL[p.heightTier]
  return a.defense * 0.42 + a.iq * 0.20 + a.speed * 0.18 + power * 0.20
}

const MENTALITY_ATK: Record<Tactics['mentality'], number> = {
  'ultra-attack': 1.10, attack: 1.05, balance: 1.0, defense: 0.95, 'ultra-defense': 0.90,
}
// 守備時の堅さ（攻撃的にすると守備が薄くなるトレードオフ）
const MENTALITY_DEF: Record<Tactics['mentality'], number> = {
  'ultra-attack': 0.90, attack: 0.95, balance: 1.0, defense: 1.05, 'ultra-defense': 1.10,
}

// プレス強度 → 攻撃側ゾーン別の守備強化（高プレス=高い位置で奪う）
function pressZoneMult(press: Tactics['press'], atkZone: number): number {
  if (press === 'high') return [1.20, 1.20, 1.15, 1.05, 1.0][atkZone] ?? 1.0
  if (press === 'low') return [0.95, 0.95, 1.0, 1.10, 1.15][atkZone] ?? 1.0
  return 1.0
}
// ディフェンスライン → 高ラインは前進阻止↑だが、速い選手に裏を取られる
function lineEffect(line: Tactics['defenseLine'], atkZone: number, carrierSpeed: number): { atk: number; def: number } {
  if (line === 'high') {
    if (atkZone >= 3 && carrierSpeed >= 60) return { atk: 1.10 + (carrierSpeed - 60) / 300, def: 1.0 } // 裏抜け
    return { atk: 1.0, def: atkZone === 2 || atkZone === 3 ? 1.10 : 1.0 }
  }
  if (line === 'low') return { atk: 1.0, def: atkZone >= 3 ? 1.10 : 0.98 }
  return { atk: 1.0, def: 1.0 }
}

function pressDrain(press: Tactics['press']): number {
  return press === 'high' ? 1.3 : press === 'low' ? 0.85 : 1.0
}

function drainAll(side: Side, mult: number) {
  for (const p of side.starters) {
    const indiv = 1.5 - (p.abilities.stamina / 99) * 1.0
    side.live[p.id] = Math.max(0, (side.live[p.id] ?? 100) - PTUNE.STAMINA_DRAIN * mult * indiv)
  }
}

function laneFor(rng: RNG, width: Tactics['width']): 'L' | 'C' | 'R' {
  if (width === 'wide') return rng.pick(['L', 'L', 'C', 'R', 'R'])
  if (width === 'central') return rng.pick(['C', 'C', 'C', 'L', 'R'])
  return rng.pick(['L', 'C', 'R'])
}

function ballPos(side: 'home' | 'away', zone: number, lane: 'L' | 'C' | 'R', rng: RNG): { x: number; y: number } {
  const lx = lane === 'L' ? 0.24 : lane === 'R' ? 0.76 : 0.5
  const x = Math.max(0.06, Math.min(0.94, lx + (rng.next() - 0.5) * 0.16))
  // home は y=1(敵ゴール) 方向へ、away は y=0 方向へ攻める
  const prog = 0.10 + (zone / 4) * 0.84
  const y = side === 'home' ? prog : 1 - prog
  return { x, y }
}

// 戦況に応じた戦術プリセット切替（リード/ビハインドで自動的に戦い方を変える）。
// プリセット未設定なら基本戦術。balanceハーネスのチームは未設定なので影響なし。
function effectiveTactics(team: Team, own: number, opp: number): Tactics {
  if (own > opp && team.tacticsLead) return team.tacticsLead
  if (own < opp && team.tacticsBehind) return team.tacticsBehind
  return team.tactics
}
const hasSkill = (p: Player, id: string): boolean => !!p.skills?.includes(id)
const teamHas = (s: Side, id: string): boolean => s.starters.some((p) => hasSkill(p, id))

// ============================================================
// メイン
// ============================================================
// 試合の進行状態（前半→ハーフタイム→後半をまたいで保持する）。
interface SimState {
  rng: RNG
  big: boolean
  home: Team
  away: Team
  H: Side
  A: Side
  beats: MatchBeat[]
  scorers: { teamId: string; playerId: string; playerName: string; minute: number }[]
  bi: number
  clock: number
}

function rebuildByPos(S: Side) {
  S.byPos = {}
  for (const p of S.starters) { const slot = p.slot ?? p.position; (S.byPos[slot] ??= []).push(p) }
}

function pushBeat(s: SimState, side: 'home' | 'away' | null, zone: number, lane: 'L' | 'C' | 'R',
                  action: BeatAction, text: string, actor?: Player, target?: Player) {
  const pos = side ? ballPos(side, zone, lane, s.rng) : { x: 0.5, y: 0.5 }
  s.beats.push({
    i: s.bi++, minute: Math.round(s.clock), side, zone, lane, ballX: pos.x, ballY: pos.y,
    action, text, actorName: actor?.name, actorId: actor?.id, targetName: target?.name, targetId: target?.id,
    homeScore: s.H.score, awayScore: s.A.score,
  })
}

// 1ポゼッション = ある側がボールを持ち、前進を試み、終端で終わる
function runPossession(
  s: SimState, atkSide: 'home' | 'away', startZone: number, transition: boolean,
): { next: 'home' | 'away'; zone: number; trans: boolean } {
  const { rng, big } = s
  const atk = atkSide === 'home' ? s.H : s.A
  const def = atkSide === 'home' ? s.A : s.H
  // 戦況（リード/ビハインド/互角）で戦術プリセットを自動切替
  const atkTac = effectiveTactics(atk.team, atk.score, def.score)
  const defTac = effectiveTactics(def.team, def.score, atk.score)
  const isBehind = atk.score < def.score
  const edge = matchupEdgePct(atkTac, defTac) / 100
  let zone = startZone
  let trans = transition
  let carrier = pickWeighted(atk, CARRIER_W[zone] ?? CARRIER_W[2], rng)
  let guard = 0

  while (guard++ < 12) {
    const dtBase = rng.next() * (PTUNE.DT_MAX - PTUNE.DT_MIN) + PTUNE.DT_MIN
    s.clock += (trans || atkTac.buildUp === 'fast') ? dtBase * 0.7 : dtBase
    const lane = laneFor(rng, atkTac.width)

    // 消耗（攻撃側やや多め・守備側はプレス強度で）
    drainAll(atk, 1.05)
    drainAll(def, pressDrain(defTac.press))

    if (zone >= 4) {
      // ---- シュート ----
      const gk = def.starters.find((p) => (p.slot ?? p.position) === 'GK') ?? def.starters[0]
      const blocker = pickWeighted(def, DEF_W[4], rng)
      const comp = 1 + (carrier.condition - 3) * 0.03 + (personalityMult(carrier, isBehind, big) - 1)
      const eM = effMult(carrier, atk, isBehind, big)
      const ga = carrier.abilities
      // 決定力(#9)＝能力値化済（kickへ加算）。守護神(#9)＝能力値化済（saving/gkIqへ加算）。
      const shotQ = (ga.kick * 0.42 + ga.technique * 0.30 + ga.iq * 0.16 + ga.power * 0.12) * eM * comp
      const gkA = gk.gk
      const eG = effMult(gk, def, false, big)
      const gkStop = (gkA
        ? (gkA.saving * 0.5 + gkA.gkIq * 0.3 + blocker.abilities.defense * 0.2) * eG * HEIGHT_SAVE[gk.heightTier]
        : 40 * eG)
      let pGoal = PTUNE.GOAL_BASE + PTUNE.GOAL_SPREAD * sigmoid((shotQ - gkStop) / PTUNE.GOAL_DIV)
      if (trans) pGoal *= PTUNE.TRANSITION_SHOT * (hasCombo(carrier, 'swift-wing') ? 1.16 : hasSkill(carrier, 'counter-ace') ? 1.12 : 1) // 韋駄天＝速攻で違いを生む／快速の翼でさらに
      pGoal = Math.max(PTUNE.GOAL_MIN, Math.min(PTUNE.GOAL_MAX, pGoal))
      atk.shots++
      const min = Math.round(s.clock)
      if (rng.next() < pGoal) {
        atk.score++; atk.sot++
        atk.atmosphere = Math.min(100, atk.atmosphere + 4)
        def.atmosphere = Math.max(0, def.atmosphere - 3)
        s.scorers.push({ teamId: atk.team.id, playerId: carrier.id, playerName: carrier.name, minute: min })
        const lines = trans
          ? ['カウンターから抜け出してゴール！', '速攻が完璧に決まった！', 'ワンチャンスをものにした！']
          : ['見事なフィニッシュ！', 'ネットを揺らした！', 'GKも届かない一撃！', '冷静に流し込んだ！']
        // 局面の意味づけ（RNG不使用＝決定性維持）。終盤・同点・逆転を盛り上げる
        const diff = atk.score - def.score
        const ctx = atk.score === def.score ? '同点に追いついた！ '
          : diff === 1 && min >= 70 ? '終盤に勝ち越し！ '
          : atk.score - 1 < def.score ? '反撃ののろし！ '
          : min >= 85 ? 'ダメ押しの一撃！ ' : ''
        // #33 性格が効いた瞬間を実況に（ビハインドの闘志家・大舞台の天才肌 等＝決定的）。
        const persFlair = carrier.personality === 'fighter' && isBehind ? ' 闘志を見せた！'
          : carrier.personality === 'hotblood' && isBehind ? ' 気持ちで押し込んだ！'
          : carrier.personality === 'genius' && big ? ' 大舞台で才能が輝く！'
          : carrier.personality === 'egoist' ? ' エゴイストの真骨頂だ！'
          : ''
        pushBeat(s, atkSide, 4, lane, 'shot-goal', `⚽ ${min}分 ${ctx}${atk.team.shortName}・${carrier.name}がゴール！ ${rng.pick(lines)}${persFlair}`, carrier)
        return { next: atkSide === 'home' ? 'away' : 'home' as const, zone: 2, trans: false }
      }
      // 非ゴール
      const r = rng.next()
      if (r < 0.45) {
        atk.sot++
        // 実況のバリエーション（決定性維持のため min から選択＝RNG非消費）
        const saveLines = [
          `${carrier.name}のシュート！ ${def.team.shortName}のGK${gk.name}が好セーブ！`,
          `${carrier.name}が放つ！ ${gk.name}が体を投げ出して防いだ！`,
          `決定機！ しかし${gk.name}が立ちはだかる！`,
          `${carrier.name}の一撃を${gk.name}が弾き出した！`,
        ]
        pushBeat(s, atkSide, 4, lane, 'shot-saved', `${min}分 ${saveLines[min % saveLines.length]}`, carrier, gk)
        return { next: atkSide === 'home' ? 'away' : 'home' as const, zone: 1, trans: false }
      } else if (r < 0.80) {
        const offLines = [
          `${carrier.name}のシュートは惜しくも枠の外。`,
          `${carrier.name}が打つも、わずかに外れる。`,
          `${carrier.name}のシュートはバーの上へ。`,
          `${carrier.name}、ねらうも枠をとらえきれない。`,
        ]
        pushBeat(s, atkSide, 4, lane, 'shot-off', `${min}分 ${offLines[min % offLines.length]}`, carrier)
        return { next: atkSide === 'home' ? 'away' : 'home' as const, zone: 1, trans: false }
      } else {
        atk.corners++
        pushBeat(s, atkSide, 4, lane, 'corner', `${min}分 ${blocker.name}がブロック！ ${atk.team.shortName}のコーナーキック。`, blocker)
        // コーナー→セットプレーのワンチャンス（指定キッカーがいればその選手・なければ空中戦の強い選手）
        const designated = atk.team.setPieceTakerId ? atk.starters.find((pl) => pl.id === atk.team.setPieceTakerId) : undefined
        const taker = designated ?? pickWeighted(atk, { CF: 3, CB: 2, WF: 1 }, rng)
        // ヘッダーの名手(#9)＝セットプレーの空中戦に強い。
        const headerB = hasSkill(taker, 'header') ? 1.15 : 1
        const aerial = (taker.abilities.power * HEIGHT_DUEL[taker.heightTier] * 0.6 + taker.abilities.kick * 0.4) * effMult(taker, atk, isBehind, big) * headerB
        // スキル: CKキッカーがいるとデリバリー精度UP
        const ckB = teamHas(atk, 'ck') ? 1.15 : 1
        let pSet = (PTUNE.GOAL_BASE * 0.7 + PTUNE.GOAL_SPREAD * sigmoid((aerial - gkStop) / PTUNE.GOAL_DIV)) * ckB
        pSet = Math.max(0.05, Math.min(0.42, pSet))
        atk.shots++
        if (rng.next() < pSet) {
          atk.score++; atk.sot++
          atk.atmosphere = Math.min(100, atk.atmosphere + 4); def.atmosphere = Math.max(0, def.atmosphere - 3)
          s.scorers.push({ teamId: atk.team.id, playerId: taker.id, playerName: taker.name, minute: Math.round(s.clock) })
          pushBeat(s, atkSide, 4, 'C', 'shot-goal', `⚽ ${Math.round(s.clock)}分 セットプレーから${taker.name}！ ヘディングが突き刺さる！`, taker)
          return { next: atkSide === 'home' ? 'away' : 'home' as const, zone: 2, trans: false }
        }
        pushBeat(s, atkSide, 4, 'C', 'gk-claim', `${Math.round(s.clock)}分 コーナーは${def.team.shortName}がクリア。`, gk)
        return { next: atkSide === 'home' ? 'away' : 'home' as const, zone: 1, trans: false }
      }
    }

    // ---- 前進デュエル ----
    const defender = pickWeighted(def, DEF_W[zone] ?? DEF_W[2], rng)
    const eA = effMult(carrier, atk, isBehind, big)
    const eD = effMult(defender, def, !isBehind, big)
    const line = lineEffect(defTac.defenseLine, zone, carrier.abilities.speed)
    // ドリブラー/司令塔/タックラー/守備の要/球際の鬼は能力値化済（実効能力に加算）＝個別倍率は撤去。
    // クロサーはサイド高い位置のみの状況依存なのでロジックのまま。コンボ「快速の翼」でさらに+。
    const crosserB = (lane !== 'C' && zone >= 3 && hasSkill(carrier, 'crosser')) ? (hasCombo(carrier, 'swift-wing') ? 1.13 : 1.08) : 1
    const effAtk = advanceScore(carrier, zone) * eA * MENTALITY_ATK[atkTac.mentality]
      * (trans ? PTUNE.TRANSITION_ATK : 1) * (1 + edge) * line.atk * crosserB
      * (atkTac.buildUp === 'fast' ? 1.04 : atkTac.buildUp === 'slow' ? 0.99 : 1)
      * redHandicap(atk.reds) // #51 攻撃側が数的不利なら前進力↓
    const effDef = defendScore(defender) * eD * pressZoneMult(defTac.press, zone) * line.def
      * MENTALITY_DEF[defTac.mentality]
      * redHandicap(def.reds) * redDefExtra(def.reds) // #51 守備側が数的不利なら守備力↓（相手チャンス↑）
    let p = PTUNE.ADV_BASE + PTUNE.ADV_SPREAD * (sigmoid((effAtk - effDef) / PTUNE.ADV_DIV) - 0.5)
    p = Math.max(PTUNE.ADV_MIN, Math.min(PTUNE.ADV_MAX, p))
    const min = Math.round(s.clock)

    if (rng.next() < p) {
      // 前進成功
      const next = pickWeighted(atk, CARRIER_W[zone + 1] ?? CARRIER_W[4], rng, carrier)
      const dribble = rng.next() < PTUNE.DRIBBLE_BIAS + (carrier.abilities.technique + carrier.abilities.speed - 100) / 400
      const nz = zone + 1
      if (dribble) {
        // 決定性維持のためRNG不使用。到達ゾーンで実況を変える
        const dtext = nz >= 4 ? `${carrier.name}が仕掛けてペナルティエリアへ侵入！`
          : nz === 3 ? `${carrier.name}がドリブルで持ち上がり敵陣を切り裂く！`
          : `${carrier.name}がドリブルで運ぶ。`
        pushBeat(s, atkSide, nz, lane, 'dribble', `${min}分 ${dtext}`, carrier)
      } else {
        const ptext = nz >= 4 ? `${carrier.name}から${next.name}へ決定的なスルーパス！`
          : nz === 3 ? `${carrier.name}が${next.name}へ鋭い縦パス！`
          : `${carrier.name}が${next.name}へパスをつなぐ。`
        pushBeat(s, atkSide, nz, lane, 'pass', `${min}分 ${ptext}`, carrier, next)
      }
      zone++; carrier = next; trans = false
    } else {
      // 前進失敗 → ファウル or ターンオーバー
      if (rng.next() < PTUNE.FOUL_RATE) {
        const tmRatio = def.starters.filter((q) => q.personality === 'troublemaker').length / 11
        const cardRoll = rng.next()
        if (cardRoll < 0.0075 + tmRatio * 0.022) {
          def.reds++; def.fouls++; def.atmosphere = Math.max(0, def.atmosphere - 6)
          pushBeat(s, atkSide, zone, lane, 'foul-red', `${min}分 ${defender.name}に一発レッド！ ${def.team.shortName}が数的不利に！`, defender)
        } else if (cardRoll < 0.4 + tmRatio * 0.2) {
          def.fouls++
          if (def.yellowIds.has(defender.id)) {
            // 2枚目の警告＝退場（数的不利・#51の係数が効く）
            def.reds++; def.atmosphere = Math.max(0, def.atmosphere - 6)
            pushBeat(s, atkSide, zone, lane, 'foul-red', `${min}分 ${defender.name}に2枚目のイエロー！ 警告2回で退場、${def.team.shortName}が数的不利に！`, defender)
          } else {
            def.yellowIds.add(defender.id)
            const yc = [`${defender.name}にイエローカード。`, `${defender.name}、警告を受ける。`, `${defender.name}の激しいチャージにイエロー。`]
            pushBeat(s, atkSide, zone, lane, 'foul-yellow', `${min}分 ${yc[min % yc.length]}`, defender)
          }
        } else {
          def.fouls++
          const fk = [`${defender.name}のファウルで${atk.team.shortName}のフリーキック。`, `${defender.name}が止めた。${atk.team.shortName}にFK。`, `${defender.name}のファウル。${atk.team.shortName}が再開する。`]
          pushBeat(s, atkSide, zone, lane, 'foul-none', `${min}分 ${fk[min % fk.length]}`, defender)
        }
        // スキル: 直接FKの名手がいて敵陣(zone>=3)なら、直接FKで一発を狙う
        const fkTaker = atk.starters.find((pl) => hasSkill(pl, 'free-kick'))
        if (zone >= 3 && fkTaker) {
          const gk = def.starters.find((pl) => (pl.slot ?? pl.position) === 'GK') ?? def.starters[0]
          const gkStop = gk.gk ? gk.gk.saving : 45
          // コンボ「セットプレーマスター」(直接FK+CKキッカー)は精度がさらに上がる。
          const spMaster = hasCombo(fkTaker, 'setpiece-master') ? 1.18 : 1
          const pFk = Math.min(0.34, (0.06 + 0.13 * sigmoid((fkTaker.abilities.kick - gkStop) / PTUNE.GOAL_DIV)) * spMaster)
          atk.shots++
          if (rng.next() < pFk) {
            atk.score++; atk.sot++
            atk.atmosphere = Math.min(100, atk.atmosphere + 4); def.atmosphere = Math.max(0, def.atmosphere - 3)
            s.scorers.push({ teamId: atk.team.id, playerId: fkTaker.id, playerName: fkTaker.name, minute: min })
            pushBeat(s, atkSide, 4, lane, 'shot-goal', `⚽ ${min}分 ${fkTaker.name}の直接フリーキックがゴール左隅に突き刺さった！`, fkTaker)
            return { next: atkSide === 'home' ? 'away' : 'home' as const, zone: 2, trans: false }
          }
          pushBeat(s, atkSide, 4, lane, 'shot-off', `${min}分 ${fkTaker.name}の直接FKは惜しくも枠の上。`, fkTaker)
        }
        // フリーキックで攻撃継続（同ゾーン保持）
        continue
      }
      // ターンオーバー（カウンター発生）
      const winner = pickWeighted(def, DEF_W[zone] ?? DEF_W[2], rng)
      const tk = winner.abilities.defense >= winner.abilities.iq
      pushBeat(s, atkSide, zone, lane, tk ? 'tackle' : 'intercept',
        `${min}分 ${winner.name}が${tk ? 'タックルでボールを奪う' : 'パスをカット'}！`, winner)
      const newTrans = zone <= 2 || defTac.press === 'high'
      return { next: atkSide === 'home' ? 'away' : 'home' as const, zone: 4 - zone, trans: newTrans }
    }
  }
  // 安全弁: 長すぎたらクリアで終了
  return { next: atkSide === 'home' ? 'away' : 'home' as const, zone: 1, trans: false }
}

// 1ピリオド（前半/後半/延長）を endMin まで進める
function runPeriod(s: SimState, endMin: number) {
  let atk: 'home' | 'away' = s.rng.next() < 0.5 ? 'home' : 'away'
  let zone = 2
  let trans = false
  while (s.clock < endMin) {
    const before = s.clock
    const r = runPossession(s, atk, zone, trans)
    const dt = s.clock - before
    if (atk === 'home') s.H.possMs += dt; else s.A.possMs += dt
    atk = r.next; zone = r.zone; trans = r.trans
  }
}

function createSim(home: Team, away: Team, seed: number, opts: MatchOptions): SimState {
  const rng = createRNG(seed)
  const H = buildSide(home); const A = buildSide(away)
  H.climateCoef = opts.climateHome ?? 1
  A.climateCoef = opts.climateAway ?? 1
  // #34: 問題児3人以上のチームは相手を威圧し、開始時の雰囲気を下げる。
  //      相手が格上（先発平均が明確に上）のときはさらに効く（強者に噛みつく荒くれ）。
  const tmCount = (s: Side) => s.starters.filter((p) => p.personality === 'troublemaker').length
  const strOf = (s: Side) => {
    if (!s.starters.length) return 0
    return s.starters.reduce((acc, p) => { const a = p.abilities; return acc + a.kick + a.power + a.speed + a.technique + a.stamina + a.iq + a.defense }, 0) / s.starters.length
  }
  const intimidate = (aggr: Side, victim: Side) => {
    if (tmCount(aggr) >= 3) {
      const victimIsStronger = strOf(victim) > strOf(aggr) + 10
      victim.atmosphere = Math.max(0, victim.atmosphere - (victimIsStronger ? 20 : 15))
    }
  }
  intimidate(H, A); intimidate(A, H)
  const s: SimState = {
    rng, big: opts.bigMatch ?? false, home, away,
    H, A, beats: [], scorers: [], bi: 0, clock: 0,
  }
  pushBeat(s, null, 2, 'C', 'kickoff', `キックオフ！ ${home.shortName} vs ${away.shortName}`)
  return s
}

// 後半（＋延長・PK）を消化して最終結果を組み立てる
function finishMatch(s: SimState, opts: MatchOptions): MatchResult {
  const { H, A, home, away } = s
  runPeriod(s, 90)

  let decidedByPK = false
  let homePK: number | undefined
  let awayPK: number | undefined
  if (opts.knockout && H.score === A.score) {
    pushBeat(s, null, 2, 'C', 'extra-start', '延長戦に突入！')
    runPeriod(s, 120)
    if (H.score === A.score) {
      decidedByPK = true
      pushBeat(s, null, 4, 'C', 'pk', `運命のPK戦へ……！ ${home.shortName} vs ${away.shortName}`)
      const pk = pkShootout(s, H, A, s.rng)
      homePK = pk.home; awayPK = pk.away
      pushBeat(s, null, 4, 'C', 'pk', `PK戦決着！ ${home.shortName} ${pk.home} - ${pk.away} ${away.shortName}`)
    }
  }

  pushBeat(s, null, 2, 'C', 'full-time', `試合終了！　${home.shortName} ${H.score} - ${A.score} ${away.shortName}`)

  const homeScore = H.score
  const awayScore = A.score
  let winnerId: string | null = null
  if (homeScore > awayScore) winnerId = home.id
  else if (awayScore > homeScore) winnerId = away.id
  else if (decidedByPK) winnerId = (homePK ?? 0) > (awayPK ?? 0) ? home.id : away.id

  const totalPoss = H.possMs + A.possMs || 1
  const stats: MatchStats = {
    possessionHome: Math.round((H.possMs / totalPoss) * 100),
    shots: { home: H.shots, away: A.shots },
    sot: { home: H.sot, away: A.sot },
    corners: { home: H.corners, away: A.corners },
    fouls: { home: H.fouls, away: A.fouls },
  }

  return {
    homeTeamId: home.id, awayTeamId: away.id, homeScore, awayScore,
    beats: s.beats, stats, steps: beatsToSteps(s.beats), winnerId, decidedByPK, homePK, awayPK, scorers: s.scorers,
  }
}

export function simulatePossessionMatch(
  home: Team, away: Team, seed: number, opts: MatchOptions = { knockout: false },
): MatchResult {
  const s = createSim(home, away, seed, opts)
  runPeriod(s, 45)
  pushBeat(s, null, 2, 'C', 'half-time', `ハーフタイム　${home.shortName} ${s.H.score} - ${s.A.score} ${away.shortName}`)
  return finishMatch(s, opts)
}

// ============================================================
// F7: 試合中に複数回采配（交代・戦術）を挟める「セグメント分割」試合
//   停止点 = 前半中盤(23分) → ハーフタイム(45分) → 後半中盤(68分) → 90分(終了or延長突入) → 延長HT(105分) → 最終(120+PK)
//   各停止点で交代/戦術変更可（通算 MAX_SUBS=5）。state を破壊的に更新して再開可能。
//   旧 simulateFirstHalf/resumeSecondHalf も「ハーフタイム1回だけ」用に残す（後方互換）。
// ============================================================
export interface MatchHalfState {
  sim: SimState
  opts: MatchOptions
  beats: MatchBeat[]   // 直近の停止点までの実況（観戦UIが再生する）
  homeScore: number
  awayScore: number
  homeStart: Player[]  // 試合開始時のスタメン11（交代UIの基準・以後の交代で不変）
  awayStart: Player[]
  /** 完了したセグメント数:
   *  0=未開始 / 1=23分後 / 2=HT(45分)後 / 3=68分後 / 4=延長突入(90分)後 / 5=延長HT(105分)後 / 6=試合終了 */
  segmentIndex: number
}

/** F7: セグメントの停止分（最終=90以降は finishMatch が消化） */
const SEGMENT_STOPS = [23, 45, 68] as const

/** F7: 試合を開始して最初の停止点（前半中盤・23分）まで進める */
export function simulateOpeningSegment(
  home: Team, away: Team, seed: number, opts: MatchOptions = { knockout: false },
): MatchHalfState {
  const s = createSim(home, away, seed, opts)
  runPeriod(s, SEGMENT_STOPS[0])
  pushBeat(s, null, 2, 'C', 'sub-window', `${SEGMENT_STOPS[0]}分　采配ポイント　${home.shortName} ${s.H.score} - ${s.A.score} ${away.shortName}`)
  return {
    sim: s, opts, beats: s.beats.slice(), homeScore: s.H.score, awayScore: s.A.score,
    homeStart: s.H.starters.slice(), awayStart: s.A.starters.slice(),
    segmentIndex: 1,
  }
}

/** F7: advanceMatchSegment の戻り値（途中停止 or 最終確定） */
export type SegmentAdvanceResult =
  | { kind: 'paused'; state: MatchHalfState }
  | { kind: 'final'; result: MatchResult }

/** F7: 90分終了後に「試合終了」を組み立てる（延長前・PKなし版） */
function buildResultAt(s: SimState, decidedByPK = false, homePK?: number, awayPK?: number): MatchResult {
  const { H, A, home, away } = s
  pushBeat(s, null, 2, 'C', 'full-time', `試合終了！　${home.shortName} ${H.score} - ${A.score} ${away.shortName}`)
  let winnerId: string | null = null
  if (H.score > A.score) winnerId = home.id
  else if (A.score > H.score) winnerId = away.id
  else if (decidedByPK) winnerId = (homePK ?? 0) > (awayPK ?? 0) ? home.id : away.id
  const totalPoss = H.possMs + A.possMs || 1
  const stats: MatchStats = {
    possessionHome: Math.round((H.possMs / totalPoss) * 100),
    shots: { home: H.shots, away: A.shots },
    sot: { home: H.sot, away: A.sot },
    corners: { home: H.corners, away: A.corners },
    fouls: { home: H.fouls, away: A.fouls },
  }
  return {
    homeTeamId: home.id, awayTeamId: away.id, homeScore: H.score, awayScore: A.score,
    beats: s.beats, stats, steps: beatsToSteps(s.beats), winnerId, decidedByPK, homePK, awayPK, scorers: s.scorers,
  }
}

/** F7: 次の停止点まで進める。延長戦突入(90分)・延長HT(105分)も停止点に追加。 */
export function advanceMatchSegment(state: MatchHalfState): SegmentAdvanceResult {
  const i = state.segmentIndex
  const s = state.sim
  const opts = state.opts

  if (i === 0) {
    // 念のため: 未開始からの呼び出しは最初の停止点へ
    runPeriod(s, SEGMENT_STOPS[0])
    pushBeat(s, null, 2, 'C', 'sub-window', `${SEGMENT_STOPS[0]}分　采配ポイント　${s.home.shortName} ${s.H.score} - ${s.A.score} ${s.away.shortName}`)
  } else if (i === 1) {
    // 23→45 (前半残り + ハーフタイム)
    runPeriod(s, SEGMENT_STOPS[1])
    pushBeat(s, null, 2, 'C', 'half-time', `ハーフタイム　${s.home.shortName} ${s.H.score} - ${s.A.score} ${s.away.shortName}`)
  } else if (i === 2) {
    // 45(HT)→68
    runPeriod(s, SEGMENT_STOPS[2])
    pushBeat(s, null, 2, 'C', 'sub-window', `${SEGMENT_STOPS[2]}分　采配ポイント　${s.home.shortName} ${s.H.score} - ${s.A.score} ${s.away.shortName}`)
  } else if (i === 3) {
    // 68→90。ノックアウト同点なら延長戦突入の采配ポイントで停止。決着済なら試合終了。
    runPeriod(s, 90)
    const tied = s.H.score === s.A.score
    if (opts.knockout && tied) {
      pushBeat(s, null, 2, 'C', 'extra-start', '延長戦に突入！')
      pushBeat(s, null, 2, 'C', 'sub-window', `延長戦・采配ポイント　${s.home.shortName} ${s.H.score} - ${s.A.score} ${s.away.shortName}`)
    } else {
      const result = buildResultAt(s)
      state.segmentIndex = 6
      state.beats = s.beats.slice(); state.homeScore = s.H.score; state.awayScore = s.A.score
      return { kind: 'final', result }
    }
  } else if (i === 4) {
    // 延長前半 (90→105)
    runPeriod(s, 105)
    pushBeat(s, null, 2, 'C', 'sub-window', `延長前半終了　${s.home.shortName} ${s.H.score} - ${s.A.score} ${s.away.shortName}`)
  } else if (i === 5) {
    // 延長後半 (105→120) → 同点ならPK → 終了
    runPeriod(s, 120)
    let decidedByPK = false
    let homePK: number | undefined
    let awayPK: number | undefined
    if (s.H.score === s.A.score) {
      decidedByPK = true
      pushBeat(s, null, 4, 'C', 'pk', `運命のPK戦へ……！ ${s.home.shortName} vs ${s.away.shortName}`)
      const pk = pkShootout(s, s.H, s.A, s.rng)
      homePK = pk.home; awayPK = pk.away
      pushBeat(s, null, 4, 'C', 'pk', `PK戦決着！ ${s.home.shortName} ${pk.home} - ${pk.away} ${s.away.shortName}`)
    }
    const result = buildResultAt(s, decidedByPK, homePK, awayPK)
    state.segmentIndex = 6
    state.beats = s.beats.slice(); state.homeScore = s.H.score; state.awayScore = s.A.score
    return { kind: 'final', result }
  } else {
    // i >= 6: 既に終了済（防御的）
    const result = buildResultAt(s)
    state.segmentIndex = 6
    state.beats = s.beats.slice(); state.homeScore = s.H.score; state.awayScore = s.A.score
    return { kind: 'final', result }
  }

  state.segmentIndex = i + 1
  state.beats = s.beats.slice()
  state.homeScore = s.H.score
  state.awayScore = s.A.score
  return { kind: 'paused', state }
}

/** 旧API互換: 前半だけを進め、ハーフタイムで止める（segmentIndex=2 になる） */
export function simulateFirstHalf(
  home: Team, away: Team, seed: number, opts: MatchOptions = { knockout: false },
): MatchHalfState {
  const s = createSim(home, away, seed, opts)
  runPeriod(s, 45)
  pushBeat(s, null, 2, 'C', 'half-time', `ハーフタイム　${home.shortName} ${s.H.score} - ${s.A.score} ${away.shortName}`)
  return {
    sim: s, opts, beats: s.beats.slice(), homeScore: s.H.score, awayScore: s.A.score,
    homeStart: s.H.starters.slice(), awayStart: s.A.starters.slice(),
    segmentIndex: 2,
  }
}

/** 旧API互換: ハーフタイムの采配後、後半（＋延長・PK）を消化して最終結果を返す */
export function resumeSecondHalf(state: MatchHalfState): MatchResult {
  return finishMatch(state.sim, state.opts)
}

/** F7: 任意の停止点での交代（side のスタメン outId をベンチの inId と入れ替え）。後半・最終盤でも可。 */
export function applySegmentSub(state: MatchHalfState, side: 'home' | 'away', outId: string, inId: string): boolean {
  return applyHalfTimeSub(state, side, outId, inId)
}

/** F7: 任意の停止点での戦術変更（side の基本戦術を差し替え）。 */
export function applySegmentTactics(state: MatchHalfState, side: 'home' | 'away', tactics: Tactics) {
  applyHalfTimeTactics(state, side, tactics)
}

/** ハーフタイム交代: side のスタメン outId を、ベンチの inId と入れ替える */
export function applyHalfTimeSub(state: MatchHalfState, side: 'home' | 'away', outId: string, inId: string): boolean {
  const S = side === 'home' ? state.sim.H : state.sim.A
  const team = side === 'home' ? state.sim.home : state.sim.away
  const idx = S.starters.findIndex((p) => p.id === outId)
  const inP = team.players.find((p) => p.id === inId)
  if (idx < 0 || !inP || S.starters.some((p) => p.id === inId)) return false
  // 出た選手のスロット（配置ポジション）を引き継ぐ＝穴を作らず表示も正しく
  const outSlot = S.starters[idx].slot ?? S.starters[idx].position
  S.starters[idx] = { ...inP, slot: outSlot }
  rebuildByPos(S)
  // 後半から入る選手はフレッシュ（残スタミナ高め）
  S.live[inP.id] = Math.max(62, 100 - inP.fatigue * 0.4)
  return true
}

/** ハーフタイム戦術変更: side の基本戦術を差し替える（後半の采配） */
export function applyHalfTimeTactics(state: MatchHalfState, side: 'home' | 'away', tactics: Tactics) {
  const S = side === 'home' ? state.sim.H : state.sim.A
  S.team = { ...S.team, tactics }
}

// PK戦（キック精度＋GKセービング）
function pkShootout(s: SimState, H: Side, A: Side, rng: RNG): { home: number; away: number } {
  const takers = (s: Side) => {
    const sorted = [...s.starters].sort((a, b) => b.abilities.kick - a.abilities.kick)
    if (s.team.pkTakerId) {
      const idx = sorted.findIndex((p) => p.id === s.team.pkTakerId)
      if (idx > 0) { const [t] = sorted.splice(idx, 1); sorted.unshift(t) }
    }
    return sorted.slice(0, 5)
  }
  const gkSave = (s: Side) => { const g = s.starters.find((p) => p.isGK); return g?.gk ? g.gk.saving : 40 }
  const hT = takers(H), aT = takers(A)
  const hGk = gkSave(H), aGk = gkSave(A)
  // スキル: PKキッカー＝成功率+ / PKストッパー(GK)＝相手の成功率-。コンボ「大守護神」はPK阻止がさらに強い。
  const pkStop = (s: Side) => s.starters.some((p) => p.isGK && hasCombo(p, 'great-keeper')) ? 0.11 : s.starters.some((p) => p.isGK && hasSkill(p, 'pk-stopper')) ? 0.07 : 0
  const stopH = pkStop(H)
  const stopA = pkStop(A)
  const conv = (taker: Player, oppGk: number, oppStop: number, max: number) =>
    Math.max(0.35, Math.min(max, 0.62 + (taker.abilities.kick - oppGk) / 320 + (hasSkill(taker, 'pk') ? 0.08 : 0) - oppStop))
  let home = 0, away = 0
  // 1蹴りずつ実況ビート（低速再生で緊張感を持って見られる・#23）
  const kick = (taker: Player, oppGk: number, oppStop: number, max: number, side: 'home' | 'away', teamName: string) => {
    const ok = rng.next() < conv(taker, oppGk, oppStop, max)
    if (ok) { if (side === 'home') home++; else away++ }
    pushBeat(s, side, 4, 'C', ok ? 'pk-goal' : 'pk-save',
      `PK ${home} - ${away}　${teamName}・${taker.name}が${ok ? '決めた！' : '外した…！'}`, taker)
  }
  for (let i = 0; i < 5; i++) {
    kick(hT[i], aGk, stopA, 0.95, 'home', H.team.shortName)
    kick(aT[i], hGk, stopH, 0.95, 'away', A.team.shortName)
  }
  let i = 0
  while (home === away) {
    kick(hT[i % 5], aGk, stopA, 0.92, 'home', H.team.shortName)
    kick(aT[i % 5], hGk, stopH, 0.92, 'away', A.team.shortName)
    if (++i > 30) { home += rng.int(0, 2); break }
  }
  return { home, away }
}

// 互換: beats から旧 StepResult[] を導出（旧UIが落ちないように）
import type { MatchEventKind, StepResult } from '../types'
function mapKind(a: BeatAction): MatchEventKind {
  switch (a) {
    case 'shot-goal': return 'goal'
    case 'shot-saved': case 'shot-off': case 'shot-blocked': return 'chance'
    case 'corner': return 'set-piece'
    case 'foul-yellow': return 'foul-yellow'
    case 'foul-red': return 'foul-red'
    case 'foul-none': return 'foul-none'
    case 'kickoff': return 'kickoff'
    case 'half-time': return 'half-time'
    case 'full-time': return 'full-time'
    case 'injury': return 'injury'
    case 'pass': case 'dribble': case 'carry': case 'tackle': case 'intercept':
    case 'clearance': case 'gk-claim': case 'throw-in': case 'goal-kick': return 'midfield'
    default: return 'flavor'
  }
}
function beatsToSteps(beats: MatchBeat[]): StepResult[] {
  return beats.map((b) => ({
    step: b.i, minute: b.minute, side: b.side, kind: mapKind(b.action), text: b.text,
    scored: b.action === 'shot-goal', homeScore: b.homeScore, awayScore: b.awayScore,
    ballX: b.ballX, ballY: b.ballY,
  }))
}
