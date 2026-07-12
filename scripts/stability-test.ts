// 長期安定性: 複数県で30年回し、不変条件（NaNなし・上限内・予算非負・
// 評判0-100・能力1-99）が崩れないことを検証。
import { createCareer } from '../src/career/init'
import { advanceWeek } from '../src/career/engine'
import type { CareerState, WeeklyPlan } from '../src/career/types'

const plan: WeeklyPlan = {
  lanes: [{ menuId: 'pass' }, { menuId: 'defense1v1' }, { menuId: 'shoot' }, { menuId: 'gk-saving' }], assign: {},
  weekend: 'rest', managerAction: 'scout', meetingTarget: null,
}

const DORM_CAP = [0, 25, 38, 52, 68]
let problems = 0

function check(c: CareerState, label: string) {
  const bad = (m: string) => { console.log(`  ❌ ${label}: ${m}`); problems++ }
  if (!Number.isFinite(c.budget) || c.budget < 0) bad(`budget異常 ${c.budget}`)
  if (c.reputation < 0 || c.reputation > 100) bad(`reputation範囲外 ${c.reputation}`)
  if (c.atmosphere < 0 || c.atmosphere > 100 || !Number.isFinite(c.atmosphere)) bad(`atmosphere異常 ${c.atmosphere}`)
  if (c.roster.length > DORM_CAP[c.facilities.dorm]) bad(`部員上限超過 ${c.roster.length}/${DORM_CAP[c.facilities.dorm]}`)
  if (c.roster.length < 8) bad(`部員不足 ${c.roster.length}`)
  for (const p of c.roster) {
    for (const [k, v] of Object.entries(p.abilities)) {
      if (!Number.isFinite(v) || v < 1 || v > 99) { bad(`能力異常 ${p.name}.${k}=${v}`); break }
    }
    if (p.grade < 1 || p.grade > 3) bad(`学年異常 ${p.name} g${p.grade}`)
    if (p.isGK && (!p.gk || !Number.isFinite(p.gk.saving))) bad(`GK能力異常 ${p.name}`)
  }
}

for (const pref of ['東京都', '福井県', '静岡県', '鳥取県']) {
  let c = createCareer(`安定検証_${pref}`, pref)
  for (let y = 0; y < 30; y++) {
    for (let w = 0; w < 48; w++) c = advanceWeek(c, plan).state
    check(c, `${pref} ${c.year}年目`)
  }
  console.log(`  ${pref}: 30年完走 / 最終評判${c.reputation} 部員${c.roster.length} プロ${c.records.proPlayers} 全国出場${c.records.nationalApps}`)
}

console.log(problems === 0 ? '\n✅ 全県30年・不変条件すべて維持（長期安定性OK）' : `\n❌ ${problems}件の問題`)
process.exit(problems === 0 ? 0 : 1)
