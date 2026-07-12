// ============================================================
// store/gameStore.ts — ゲーム進行のステートマシン（Zustand）
// title → squad → tactics → bracket → match → (bracket…) → end
// ============================================================

import { create } from 'zustand'
import type { MatchResult, Tactics, Team } from '../engine/types'
import { createRNG, hashSeed } from '../engine/rng'
import { generateTeam, defaultTactics } from '../engine/generate/team'
import { generateUniqueSchoolNames } from '../data/schools'
import { PREFECTURES, findPrefecture } from '../data/prefectures'
import { simulateMatch } from '../engine/match/simulateMatch'
import {
  applyPlayerResult, createTournament, matchSeed, playerMatchIndex,
  playerOpponent, type Tournament,
} from '../lib/tournament'

export type Screen = 'title' | 'squad' | 'tactics' | 'bracket' | 'match' | 'end'

const PLAYER_STRENGTH = 58
const AI_STRENGTHS = [50, 53, 56, 60, 63, 67, 71]
const AI_COLORS = ['#457b9d', '#9b5de5', '#06d6a0', '#ef476f', '#118ab2', '#ffd166', '#8338ec']

interface GameState {
  screen: Screen
  seed: number
  schoolName: string
  prefecture: string
  playerTeam: Team | null
  tournament: Tournament | null
  currentResult: MatchResult | null
  isPlayerHome: boolean
  championId: string | null
  eliminated: boolean

  // actions
  startGame: (name: string, prefecture: string) => void
  setTactics: (t: Tactics) => void
  go: (s: Screen) => void
  startPlayerMatch: () => void
  finishMatch: () => void
  reset: () => void
}

function shuffle<T>(arr: T[], rng: ReturnType<typeof createRNG>): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'title',
  seed: 0,
  schoolName: '',
  prefecture: '東京都',
  playerTeam: null,
  tournament: null,
  currentResult: null,
  isPlayerHome: true,
  championId: null,
  eliminated: false,

  startGame: (name, prefecture) => {
    const cleanName = name.trim() || '蒼空学院'
    const seed = (hashSeed(cleanName) ^ (Date.now() & 0xffffff)) >>> 0
    const rng = createRNG(seed)
    const pref = findPrefecture(prefecture)

    // プレイヤーチーム
    const playerTeam = generateTeam(rng, {
      id: 'player',
      name: cleanName,
      prefecture: pref.name,
      color: '#f4a261',
      strength: PLAYER_STRENGTH,
      isPlayer: true,
      formation: '4-4-2',
      tactics: defaultTactics('4-4-2'),
    })

    // AI 7校
    const aiNames = generateUniqueSchoolNames(rng, 7, [cleanName])
    const strengths = shuffle(AI_STRENGTHS, rng)
    const aiTeams: Team[] = aiNames.map((nm, i) => {
      const aiPref = rng.pick(PREFECTURES)
      // 強度に県補正を少し足す（強豪県はやや強い）
      const strength = Math.round(strengths[i] * 0.85 + aiPref.strength * 0.15)
      return generateTeam(rng, {
        id: `ai_${i}`,
        name: nm,
        prefecture: aiPref.name,
        color: AI_COLORS[i],
        strength,
        isPlayer: false,
      })
    })

    const tournament = createTournament(playerTeam, aiTeams, seed)

    set({
      screen: 'squad', seed, schoolName: cleanName, prefecture: pref.name,
      playerTeam, tournament, currentResult: null,
      championId: null, eliminated: false,
    })
  },

  setTactics: (t) => {
    const pt = get().playerTeam
    if (!pt) return
    const updated: Team = { ...pt, tactics: t }
    const tour = get().tournament
    if (tour) tour.teams[pt.id] = updated // 大会側の参照も更新
    set({ playerTeam: updated })
  },

  go: (s) => set({ screen: s }),

  startPlayerMatch: () => {
    const { tournament, playerTeam } = get()
    if (!tournament || !playerTeam) return
    const idx = playerMatchIndex(tournament)
    if (idx < 0) return
    const m = tournament.rounds[tournament.roundIndex][idx]
    const isPlayerHome = m.homeId === playerTeam.id
    const opp = playerOpponent(tournament)
    if (!opp) return
    const home = isPlayerHome ? playerTeam : opp
    const away = isPlayerHome ? opp : playerTeam
    const seed = matchSeed(tournament, tournament.roundIndex, idx)
    const result = simulateMatch(home, away, seed, { knockout: true, bigMatch: tournament.roundIndex >= 1 })
    set({ currentResult: result, isPlayerHome, screen: 'match' })
  },

  finishMatch: () => {
    const { tournament, currentResult } = get()
    if (!tournament || !currentResult) return
    const idx = playerMatchIndex(tournament)
    if (idx < 0) return
    const r = currentResult
    const outcome = applyPlayerResult(
      tournament, idx, r.homeScore, r.awayScore,
      r.winnerId ?? '', r.decidedByPK,
      r.decidedByPK ? [r.homePK ?? 0, r.awayPK ?? 0] : null,
    )

    if (outcome.isFinalRound || outcome.eliminated) {
      set({
        screen: 'end',
        championId: outcome.championId,
        eliminated: outcome.eliminated,
        currentResult: null,
      })
    } else {
      set({ screen: 'bracket', currentResult: null })
    }
  },

  reset: () => set({
    screen: 'title', playerTeam: null, tournament: null,
    currentResult: null, championId: null, eliminated: false,
  }),
}))
