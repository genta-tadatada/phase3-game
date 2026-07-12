// 実際のゲームストア（Zustand）を駆動してUIと同じコードパスを検証。
// startGame → (tactics) → bracket → match → finishMatch を end まで回す。
import { useGame } from '../src/store/gameStore'
import type { Tactics } from '../src/engine/types'
import { FORMATION_LIST } from '../src/engine/match/formations'

const MENT: Tactics['mentality'][] = ['ultra-attack', 'attack', 'balance', 'defense', 'ultra-defense']
function randTactics(i: number): Tactics {
  return {
    formation: FORMATION_LIST[i % FORMATION_LIST.length],
    mentality: MENT[i % MENT.length],
    press: (['high', 'mid', 'low'] as const)[i % 3],
    defenseLine: (['high', 'mid', 'low'] as const)[(i + 1) % 3],
    width: (['wide', 'mid', 'central'] as const)[(i + 2) % 3],
    buildUp: (['fast', 'mid', 'slow'] as const)[i % 3],
    setPiece: i % 2 === 0,
  }
}

const RUNS = 500
let ok = 0
let champs = 0

for (let run = 0; run < RUNS; run++) {
  const g = useGame.getState
  g().reset()
  useGame.getState().startGame(`テスト校${run}`, '東京都')
  if (useGame.getState().screen !== 'squad') throw new Error('startGame後にsquadでない')

  let guard = 0
  let matchCount = 0
  while (useGame.getState().screen !== 'end' && guard++ < 12) {
    // 毎試合ランダム戦術を設定（setTactics）
    useGame.getState().setTactics(randTactics(run + matchCount))
    useGame.getState().go('bracket')
    useGame.getState().startPlayerMatch()
    if (useGame.getState().screen !== 'match') throw new Error('startPlayerMatch後にmatchでない')
    const res = useGame.getState().currentResult
    if (!res) throw new Error('currentResultがnull')
    if (res.winnerId == null && !res.decidedByPK) throw new Error('ノックアウトなのに勝者未定')
    useGame.getState().finishMatch()
    matchCount++
  }

  const st = useGame.getState()
  if (st.screen !== 'end') throw new Error(`endに到達しない (run ${run})`)
  if (st.championId == null) throw new Error('championId未確定')
  if (matchCount < 1 || matchCount > 3) throw new Error(`試合数が異常: ${matchCount}`)
  if (st.championId === st.playerTeam?.id) champs++
  ok++
}

console.log(`ストア駆動 ${RUNS}回: 全て正常終了 ${ok}/${RUNS}`)
console.log(`プレイヤー優勝: ${champs}回 (${(100 * champs / RUNS).toFixed(1)}%・ランダム戦術)`)
console.log('画面遷移・勝者確定・大会終了すべて整合 ✅')
