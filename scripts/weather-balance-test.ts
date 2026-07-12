// G-05: 天候×能力 練習成長のバランス検証
// 各天候で能力別の倍率を集計し、晴れを基準に「年間成長の総和」がどのくらい劣るかを示す。
// 体育館あり/なし・地域適応あり/なしの4ケースで比較する。

import { weatherAbilityMult, weatherTrainingMult, type Weather } from '../src/career/weather'

const WEATHERS: Weather[] = ['晴れ', '曇り', '雨', '猛暑', '寒波', '雪']
const ABILS = ['speed', 'stamina', 'power', 'technique', 'kick', 'defense', 'saving', 'iq']

// 各能力の平均的な成長量を「1.0」と仮定し、weatherAbilityMult × weatherTrainingMult を効率として並べる。
function effective(weather: Weather, hasGym: boolean, adapted: boolean): { perAbil: Record<string, number>; sum: number; mean: number } {
  const train = weatherTrainingMult(weather, hasGym, adapted)
  const mitigated = hasGym || adapted
  const perAbil: Record<string, number> = {}
  let sum = 0
  for (const k of ABILS) {
    const a = weatherAbilityMult(weather, k, mitigated)
    const eff = a * train
    perAbil[k] = eff
    sum += eff
  }
  return { perAbil, sum, mean: sum / ABILS.length }
}

console.log('=== G-05 天候バランス検証 ===')
console.log()
const cases: { hasGym: boolean; adapted: boolean; label: string }[] = [
  { hasGym: false, adapted: false, label: '体育館なし・適応なし' },
  { hasGym: true,  adapted: false, label: '体育館あり' },
  { hasGym: false, adapted: true,  label: '地域適応あり' },
]
for (const cs of cases) {
  console.log(`--- ${cs.label} ---`)
  const rows: { weather: Weather; mean: number; perAbil: Record<string, number> }[] = []
  for (const w of WEATHERS) {
    const r = effective(w, cs.hasGym, cs.adapted)
    rows.push({ weather: w, mean: r.mean, perAbil: r.perAbil })
  }
  const baseSunny = rows.find((r) => r.weather === '晴れ')!.mean
  console.log('weather | mean | vs晴れ | ' + ABILS.join(' | '))
  for (const r of rows) {
    const diffPct = ((r.mean - baseSunny) / baseSunny) * 100
    const cells = ABILS.map((k) => r.perAbil[k].toFixed(3)).join(' | ')
    console.log(`${r.weather.padEnd(3)} | ${r.mean.toFixed(3)} | ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}% | ${cells}`)
  }
  console.log()
}

// 出身県と天候の組み合わせの実効値も比べる
console.log('=== 雪×雪国 / 猛暑×南国 のバランス（適応地でデバフを取り戻せるか） ===')
console.log('雪 適応なし mean=', effective('雪', false, false).mean.toFixed(3))
console.log('雪 適応あり mean=', effective('雪', false, true).mean.toFixed(3))
console.log('猛暑 適応なし mean=', effective('猛暑', false, false).mean.toFixed(3))
console.log('猛暑 適応あり mean=', effective('猛暑', false, true).mean.toFixed(3))
console.log('雨 適応あり mean=', effective('雨', false, true).mean.toFixed(3))
console.log('寒波 適応あり mean=', effective('寒波', false, true).mean.toFixed(3))

// === 能力別「得意天候」分布チェック（被りが減ったか）===
console.log()
console.log('=== 能力別 大ブースト(>=1.10) / 苦手(<=0.95) 天候の分布 ===')
console.log('能力     | 大ブースト | 苦手')
for (const key of ABILS) {
  const boost: string[] = []
  const debuff: string[] = []
  for (const w of WEATHERS) {
    const v = weatherAbilityMult(w, key)
    if (v >= 1.10) boost.push(`${w}(+${((v-1)*100).toFixed(0)}%)`)
    else if (v <= 0.95) debuff.push(`${w}(${((v-1)*100).toFixed(0)}%)`)
  }
  console.log(`${key.padEnd(9)}| ${boost.join('・') || '(無し)'} | ${debuff.join('・') || '(無し)'}`)
}
