// セーブの健全性検証: CareerState がJSON往復で完全に保存・復元できるか
// （関数・循環参照が混入していないか）。localStorageはNode非対応のため
// JSON.stringify/parse で同等の検証を行う。
import { createCareer } from '../src/career/init'
import { advanceWeek } from '../src/career/engine'
import type { WeeklyPlan } from '../src/career/types'

const plan: WeeklyPlan = {
  lanes: [{ menuId: 'pass' }, { menuId: 'defense1v1' }, { menuId: 'shoot' }, { menuId: 'gk-saving' }], assign: {},
  weekend: 'rest', managerAction: 'scout', meetingTarget: null,
}

let c = createCareer('セーブ検証高', '東京都')
// 3年進めて状態を複雑化（卒業・入部・スカウト・記録）
for (let w = 0; w < 48 * 3; w++) c = advanceWeek(c, plan).state

const json = JSON.stringify(c)
const restored = JSON.parse(json)

const checks: [string, boolean][] = [
  ['JSONサイズ妥当(<2MB)', json.length < 2_000_000],
  ['year一致', restored.year === c.year],
  ['roster数一致', restored.roster.length === c.roster.length],
  ['records.history保持', Array.isArray(restored.records.history) && restored.records.history.length === c.records.history.length],
  ['scouting.candidates保持', Array.isArray(restored.scouting.candidates)],
  ['選手abilities保持', restored.roster[0]?.abilities?.kick !== undefined],
  ['GK gk情報保持', restored.roster.some((p: { isGK: boolean; gk: unknown }) => p.isGK && p.gk)],
  ['関数混入なし', !json.includes('function')],
]

console.log(`=== セーブ健全性（3年経過・JSONサイズ ${(json.length / 1024).toFixed(0)}KB） ===`)
let ok = true
for (const [name, pass] of checks) {
  console.log(`  ${pass ? '✅' : '❌'} ${name}`)
  if (!pass) ok = false
}
console.log(ok ? '\nセーブ往復OK ✅（localStorage容量も余裕・補完P-5想定通り）' : '\n❌ セーブに問題あり')
process.exit(ok ? 0 : 1)
