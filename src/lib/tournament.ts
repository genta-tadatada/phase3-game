// ============================================================
// lib/tournament.ts — 8チーム シングルエリミネーション大会
// QF(4試合) → SF(2試合) → 決勝(1試合)。プレイヤーはスロット0固定。
// ============================================================

import type { Team } from '../engine/types'
import { simulateMatch } from '../engine/match/simulateMatch'
import { playerOverallSum } from '../engine/match/teamQuality'
import { createRNG } from '../engine/rng'

export interface TMatch {
  homeId: string | null
  awayId: string | null
  winnerId: string | null
  homeScore: number | null
  awayScore: number | null
  decidedByPK: boolean
  pk: [number, number] | null
}

export interface Tournament {
  teams: Record<string, Team>
  rounds: TMatch[][] // [QF×4, SF×2, Final×1]
  roundIndex: number // 0..2
  seed: number
  playerId: string
}

/** ラウンド名（終端からの距離で命名・任意サイズ対応）。total=総ラウンド数。 */
export function roundName(i: number, total = 3): string {
  const fromEnd = total - 1 - i
  if (fromEnd === 0) return '決勝'
  if (fromEnd === 1) return '準決勝'
  if (fromEnd === 2) return '準々決勝'
  return `ベスト${2 ** (fromEnd + 1)}` // 例: ベスト16 / ベスト32
}

function emptyMatch(homeId: string | null, awayId: string | null): TMatch {
  return { homeId, awayId, winnerId: null, homeScore: null, awayScore: null, decidedByPK: false, pk: null }
}

/**
 * 大会を生成。playerTeam を slot0、ai を slot1.. に配置。
 * 参加校数（playerTeam + ai）は2のべき乗（8/16/32等）。ラウンド数 = log2(校数)。
 */
export function createTournament(playerTeam: Team, ai: Team[], seed: number): Tournament {
  const all = [playerTeam, ...ai]
  const teams: Record<string, Team> = {}
  for (const t of all) teams[t.id] = t

  const ids = all.map((t) => t.id)
  // 1回戦: 隣接ペア (0,1)(2,3)...
  const rounds: TMatch[][] = []
  const first: TMatch[] = []
  for (let i = 0; i < ids.length; i += 2) first.push(emptyMatch(ids[i], ids[i + 1] ?? null))
  rounds.push(first)
  // 以降は空試合で勝者を埋めていく
  let count = first.length
  while (count > 1) {
    count = Math.ceil(count / 2)
    rounds.push(Array.from({ length: count }, () => emptyMatch(null, null)))
  }

  return {
    teams, rounds, roundIndex: 0, seed, playerId: playerTeam.id,
  }
}

// #26: 大会での自チームの「道のり」（各ラウンドの対戦相手・スコア・勝敗）。
export interface PathLeg { round: string; oppShort: string; oppName: string; myScore: number; oppScore: number; won: boolean; pk: string | null }
/** 自チームが戦ったラウンドを順に返す（優勝なら全勝・敗退なら最後が黒星）。 */
export function playerPath(t: Tournament): PathLeg[] {
  const total = t.rounds.length
  const legs: PathLeg[] = []
  for (let i = 0; i < t.rounds.length; i++) {
    const m = t.rounds[i].find((mm) => mm.homeId === t.playerId || mm.awayId === t.playerId)
    if (!m || m.homeScore === null || m.awayScore === null) break // ここから先は未消化
    const isHome = m.homeId === t.playerId
    const oppId = isHome ? m.awayId : m.homeId
    const opp = oppId ? t.teams[oppId] : null
    const myScore = isHome ? m.homeScore : m.awayScore
    const oppScore = isHome ? m.awayScore : m.homeScore
    const pk = m.decidedByPK && m.pk ? (isHome ? `PK ${m.pk[0]}-${m.pk[1]}` : `PK ${m.pk[1]}-${m.pk[0]}`) : null
    legs.push({ round: roundName(i, total), oppShort: opp?.shortName ?? '—', oppName: opp?.name ?? '—', myScore, oppScore, won: m.winnerId === t.playerId, pk })
  }
  return legs
}

function nextPow2(n: number): number { let p = 1; while (p < n) p *= 2; return p }

/**
 * #30 プレイヤーの到達段階ラベル（大きいブラケットでも正確に）。
 *  優勝／準優勝／ベスト4／ベスト8／ベスト16／ベスト32… を実際の敗退ラウンドから返す。
 *  placement(0-3正規化)はrep/賞金の段階に使い、表示はこの正確ラベルを使う。
 */
export function stageReachedLabel(t: Tournament): string {
  const L = t.rounds.length
  const final = t.rounds[L - 1][0]
  if (final.winnerId === t.playerId) return '優勝'
  for (let r = 0; r < L; r++) {
    const m = t.rounds[r].find((mm) => (mm.homeId === t.playerId || mm.awayId === t.playerId) && mm.winnerId && mm.winnerId !== t.playerId)
    if (m) {
      if (r === L - 1) return '準優勝'
      const teamsInRound = 2 ** (L - r) // そのラウンドの参加校数
      if (teamsInRound === 4) return 'ベスト4'
      return `ベスト${teamsInRound}`
    }
  }
  return `ベスト${2 ** L}`
}

/** チームの実戦強さ（先発11人の総合平均）。シード配置の基準。 */
function teamStrength(t: Team): number {
  const s = t.players.slice(0, 11)
  return s.length ? s.reduce((a, p) => a + playerOverallSum(p), 0) / s.length : t.reputation
}

/** 標準トーナメントのシード→スロット配置順。slot[i] が入るべきシード番号(0始まり)を返す。 */
function seedSlotOrder(size: number): number[] {
  let arr = [0]
  while (arr.length < size) {
    const len = arr.length * 2
    const next: number[] = []
    for (const a of arr) { next.push(a, len - 1 - a) }
    arr = next
  }
  return arr
}

/**
 * #30 強さシード付き・バイ対応の全国ブラケットを生成（spec「ラウンドが進むほど強い校＝序列維持」）。
 *  全参加 = playerTeam + others（例60校）。次の2のべき乗(64)スロットの単一エリミ。
 *  強さ順にシードを振り、標準配置で「強豪は終盤まで当たらない」。空き(64-60=4)は上位シードのバイ＝一回戦免除。
 *  プレイヤーは絶対にバイ（シード上位4）にならない＝強くてもバイ枠は最強CPUへ譲り、自身は実戦の高シードに入る。
 *  効果: ランダム抽選の高分散（強豪と早期遭遇での番狂わせ）を抑え、強いチームほど深く勝ち上がる＝腕の差が出る。
 */
export function createSeededTournament(playerTeam: Team, others: Team[], _seedIds: string[], seed: number): Tournament {
  const all = [playerTeam, ...others]
  const teams: Record<string, Team> = {}
  for (const tm of all) teams[tm.id] = tm

  const size = nextPow2(all.length)        // 64
  const matches0 = size / 2                 // 32
  const byeCount = size - all.length        // 4 = シード上位4が一回戦免除

  // 強さ降順でシードランクを付与（タイブレークはid安定ソート）。
  const ranked = [...all].sort((a, b) => teamStrength(b) - teamStrength(a) || (a.id < b.id ? -1 : 1))
  // pot制: 強さ帯(4チーム)ごとにシャッフル＝強さ序列(どの帯か)は保ちつつ、毎回違う組み合わせに。
  //   ＝決定論を崩し「毎回同じ敵には当たらない」抽選のドキドキを出す（seedは年度を含むため年ごとに変わる）。
  //   プレイヤーは下のbump処理でバイ回避のため帯固定＝シャッフルから除外して安定させる。
  const potRng = createRNG(seed >>> 0)
  const POT = 4
  for (let i = 0; i < ranked.length; i += POT) {
    const end = Math.min(i + POT, ranked.length)
    for (let j = end - 1; j > i; j--) {
      const k = i + Math.floor(potRng.next() * (j - i + 1))
      const tmp = ranked[j]; ranked[j] = ranked[k]; ranked[k] = tmp
    }
  }
  // プレイヤーが上位byeCount(=シードバイ)に入る場合、バイ枠を最強CPUへ譲り、プレイヤーは直下に下げる。
  const pIdx = ranked.findIndex((t) => t.id === playerTeam.id)
  if (pIdx < byeCount) {
    ranked.splice(pIdx, 1)        // プレイヤーを抜き
    ranked.splice(byeCount, 0, playerTeam) // バイ境界の直後(非バイ最上位)へ挿入
  }
  // seedRank -> team（ランク60..63は空席=null）
  const teamAtSeed: (Team | null)[] = ranked.concat(Array(size - ranked.length).fill(null))
  for (let r = 0; r < byeCount; r++) { if (teamAtSeed[r]) teamAtSeed[r]!.seeded = true }

  // 標準配置で round0 を構築（slot→seedRank→team）。片側nullはバイ。
  const order = seedSlotOrder(size)
  const first: TMatch[] = []
  for (let i = 0; i < matches0; i++) {
    const home = teamAtSeed[order[i * 2]] ?? null
    const away = teamAtSeed[order[i * 2 + 1]] ?? null
    first.push(emptyMatch(home?.id ?? null, away?.id ?? null))
  }

  const rounds: TMatch[][] = [first]
  let count = matches0
  while (count > 1) { count = Math.ceil(count / 2); rounds.push(Array.from({ length: count }, () => emptyMatch(null, null))) }

  return { teams, rounds, roundIndex: 0, seed, playerId: playerTeam.id }
}

/** 現ラウンドでプレイヤーが含まれる試合のindexを返す（敗退済みなら-1） */
export function playerMatchIndex(t: Tournament): number {
  const round = t.rounds[t.roundIndex]
  return round.findIndex((m) => m.homeId === t.playerId || m.awayId === t.playerId)
}

/** プレイヤーの対戦相手チーム（いなければnull） */
export function playerOpponent(t: Tournament): Team | null {
  const idx = playerMatchIndex(t)
  if (idx < 0) return null
  const m = t.rounds[t.roundIndex][idx]
  const oppId = m.homeId === t.playerId ? m.awayId : m.homeId
  return oppId ? t.teams[oppId] : null
}

export function matchSeed(t: Tournament, round: number, idx: number): number {
  return (t.seed ^ ((round + 1) * 0x9e3779b1) ^ ((idx + 1) * 0x85ebca77)) >>> 0
}

/** 1試合をシミュレートして TMatch に結果を書き込む */
function resolveMatch(t: Tournament, round: number, idx: number): void {
  const m = t.rounds[round][idx]
  if (m.winnerId) return
  // #30 バイ（片側のみ確定）＝不戦勝でそのまま勝ち上がる（スコアは付かない）。
  if (m.homeId && !m.awayId) { m.winnerId = m.homeId; return }
  if (!m.homeId && m.awayId) { m.winnerId = m.awayId; return }
  if (!m.homeId || !m.awayId) return // 両側未確定
  const r = simulateMatch(t.teams[m.homeId], t.teams[m.awayId], matchSeed(t, round, idx), { knockout: true, bigMatch: round >= 1 })
  m.homeScore = r.homeScore
  m.awayScore = r.awayScore
  m.winnerId = r.winnerId
  m.decidedByPK = r.decidedByPK
  m.pk = r.decidedByPK ? [r.homePK ?? 0, r.awayPK ?? 0] : null
}

/** あるラウンドの勝者を次ラウンドへ配置 */
function propagate(t: Tournament, round: number): void {
  if (round >= t.rounds.length - 1) return
  const cur = t.rounds[round]
  const next = t.rounds[round + 1]
  for (let i = 0; i < next.length; i++) {
    const a = cur[i * 2]?.winnerId ?? null
    const b = cur[i * 2 + 1]?.winnerId ?? null
    next[i].homeId = a
    next[i].awayId = b
  }
}

/**
 * プレイヤーの試合結果を反映し、同ラウンドの残り試合を自動消化、
 * 次ラウンドを編成する。戻り値で状態を通知。
 */
export interface AdvanceOutcome {
  playerWon: boolean
  eliminated: boolean
  championId: string | null // プレイヤー優勝 or 敗退後の最終優勝校
  isFinalRound: boolean
}

export function applyPlayerResult(
  t: Tournament,
  playerMatchIdx: number,
  homeScore: number,
  awayScore: number,
  winnerId: string,
  decidedByPK: boolean,
  pk: [number, number] | null,
): AdvanceOutcome {
  const round = t.roundIndex
  const m = t.rounds[round][playerMatchIdx]
  m.homeScore = homeScore
  m.awayScore = awayScore
  m.winnerId = winnerId
  m.decidedByPK = decidedByPK
  m.pk = pk

  // 同ラウンドの残りを自動消化
  for (let i = 0; i < t.rounds[round].length; i++) resolveMatch(t, round, i)
  propagate(t, round)

  const playerWon = winnerId === t.playerId
  const isFinalRound = round === t.rounds.length - 1

  if (isFinalRound) {
    // 決勝 → 大会終了
    return {
      playerWon, eliminated: !playerWon, isFinalRound: true,
      championId: t.rounds[round][0].winnerId,
    }
  }

  if (!playerWon) {
    // 敗退 → 残りの大会を自動消化して優勝校を確定（エンド画面用）
    for (let r = round + 1; r < t.rounds.length; r++) {
      for (let i = 0; i < t.rounds[r].length; i++) resolveMatch(t, r, i)
      propagate(t, r)
    }
    const champ = t.rounds[t.rounds.length - 1][0].winnerId
    return { playerWon: false, eliminated: true, isFinalRound: false, championId: champ }
  }

  // 勝ち上がり → 次ラウンドへ
  t.roundIndex = round + 1
  return { playerWon: true, eliminated: false, isFinalRound: false, championId: null }
}
