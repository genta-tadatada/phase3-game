// G-05 年間視点のバランス検証：
// 1年48週×1000試行で天候を抽選し、各能力の「年間の実効倍率の総和」を集計。
// 各能力が"年間でどれだけ伸びる総量"がフェアか、極端に不利な能力が無いかを確認する。
import { generateWeather, weatherAbilityMult, weatherTrainingMult, climateAdaptedTo, type Weather } from '../src/career/weather'
import { createRNG } from '../src/engine/rng'

const ABILS = ['speed', 'stamina', 'power', 'technique', 'kick', 'defense', 'saving', 'iq']
const PREFS = ['北海道', '東京都', '静岡県', '鹿児島県', '新潟県'] // 北→温暖→豪雪 を網羅
const TRIALS = 1000
const WEEKS = 48

// 各県・各能力の「年間実効倍率の総和」と「天候出現回数」
type Result = { weekSum: Record<string, number>; weatherCounts: Record<Weather, number> }

function simulateYear(pref: string, seed: number): Result {
  const rng = createRNG(seed)
  const weekSum: Record<string, number> = {}
  for (const k of ABILS) weekSum[k] = 0
  const weatherCounts: Record<Weather, number> = { 晴れ: 0, 曇り: 0, 雨: 0, 猛暑: 0, 寒波: 0, 雪: 0 }
  for (let w = 0; w < WEEKS; w++) {
    const wt = generateWeather(w, pref, rng)
    weatherCounts[wt]++
    const adapted = climateAdaptedTo(pref, wt)
    const train = weatherTrainingMult(wt, false, adapted)
    for (const k of ABILS) {
      const eff = weatherAbilityMult(wt, k, adapted) * train
      weekSum[k] += eff
    }
  }
  return { weekSum, weatherCounts }
}

console.log(`=== 年間実効倍率の総和（48週×${TRIALS}試行・体育館なし）===\n`)
for (const pref of PREFS) {
  const totalSums: Record<string, number> = {}
  const totalCounts: Record<Weather, number> = { 晴れ: 0, 曇り: 0, 雨: 0, 猛暑: 0, 寒波: 0, 雪: 0 }
  for (const k of ABILS) totalSums[k] = 0
  for (let s = 0; s < TRIALS; s++) {
    const r = simulateYear(pref, s * 1000 + pref.charCodeAt(0))
    for (const k of ABILS) totalSums[k] += r.weekSum[k]
    for (const w of Object.keys(r.weatherCounts) as Weather[]) totalCounts[w] += r.weatherCounts[w]
  }
  console.log(`--- ${pref} ---`)
  // 1試行平均
  const baseline = WEEKS * 1.0 // 全週 ×1.0 だと 48
  console.log('  天候出現(年平均):',
    (['晴れ', '曇り', '雨', '猛暑', '寒波', '雪'] as Weather[])
      .map((w) => `${w}${(totalCounts[w] / TRIALS).toFixed(1)}週`).join(' '))
  console.log('  能力     | 年間総倍率 | vs ×1.0基準 | vs 全能力平均')
  const meansPerAbil: Record<string, number> = {}
  for (const k of ABILS) meansPerAbil[k] = totalSums[k] / TRIALS
  const overallMean = ABILS.reduce((s, k) => s + meansPerAbil[k], 0) / ABILS.length
  for (const k of ABILS) {
    const m = meansPerAbil[k]
    const vsFlat = ((m - baseline) / baseline) * 100
    const vsAvg = ((m - overallMean) / overallMean) * 100
    console.log(`  ${k.padEnd(9)}| ${m.toFixed(2)}      | ${vsFlat >= 0 ? '+' : ''}${vsFlat.toFixed(1)}%     | ${vsAvg >= 0 ? '+' : ''}${vsAvg.toFixed(1)}%`)
  }
  // 最大と最小の能力差
  const sorted = [...ABILS].sort((a, b) => meansPerAbil[b] - meansPerAbil[a])
  const max = meansPerAbil[sorted[0]]
  const min = meansPerAbil[sorted[sorted.length - 1]]
  console.log(`  → 最伸び ${sorted[0]}(${max.toFixed(2)}) vs 最縮み ${sorted[sorted.length-1]}(${min.toFixed(2)})  差=${((max - min) / min * 100).toFixed(1)}%`)
  console.log()
}
