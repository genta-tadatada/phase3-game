// ナラティブ品質チェック: キャリアを進めてニュースログ・卒業進路・
// イベント文が破綻なく読めるかを目視確認する。
import { createCareer } from '../src/career/init'
import { advanceWeek } from '../src/career/engine'
import type { WeeklyPlan } from '../src/career/types'

const plan: WeeklyPlan = {
  lanes: [{ menuId: 'pass' }, { menuId: 'defense1v1' }, { menuId: 'shoot' }, { menuId: 'gk-saving' }], assign: {},
  weekend: 'rest', managerAction: 'meeting', meetingTarget: null,
}

let c = createCareer('物語検証学園', '静岡県')
const events: string[] = []
for (let i = 0; i < 48 * 6; i++) {
  const before = c.pendingEvents[0]?.body
  c = advanceWeek(c, plan).state
  const ev = c.pendingEvents[0]
  if (ev && ev.body !== before) events.push(`[${c.year}年${ev.title}] ${ev.body}`)
}

console.log('=== 週次イベント/ニュースのサンプル（6年分から抜粋） ===')
for (const e of events.slice(0, 20)) console.log('・' + e)
console.log('\n=== 最新ニュースログ ===')
for (const l of c.log.slice(0, 12)) console.log('・' + l)
console.log('\n=== 直近の卒業生進路 ===')
for (const g of c.lastGraduates.sort((a, b) => b.overall - a.overall)) console.log(`・${g.position} ${g.name} → ${g.destinyLabel}`)
console.log(`\n通算: 全国出場${c.records.nationalApps} / プロ${c.records.proPlayers} / 出身プロ: ${c.records.proAlumni.map(a => a.name).join('、') || 'なし'}`)
