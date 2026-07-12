// キャリアモードの成長バランス検証（新・練習システム: 各選手は週1メニュー）
// + 複数年の進行が破綻しないことの確認。
import { createCareer } from '../src/career/init'
import { advanceWeek } from '../src/career/engine'
import type { WeeklyPlan, Player } from '../src/career/types'
import { abilitySum } from '../src/engine/match/teamQuality'

// 全選手を枠0(指定メニュー)に割り当てるプランを作る
function planAll(roster: Player[], menuId: string): WeeklyPlan {
  const assign: Record<string, number> = {}
  for (const p of roster) assign[p.id] = 0
  return {
    lanes: [{ menuId }, { menuId: 'pass' }, { menuId: 'shoot' }, { menuId: 'gk-saving' }],
    assign, weekend: 'rest', managerAction: null, meetingTarget: null,
  }
}

// --- テスト1: 1年間IQ集中（tactics=main iq）でどれだけ伸びるか ---
{
  let c = createCareer('検証学院', '東京都')
  const targetId = [...c.roster].sort((a, b) => a.abilities.iq - b.abilities.iq)[0].id // IQが最も低い選手の伸びを見る
  const before = c.roster.find((p) => p.id === targetId)!
  const iq0 = before.abilities.iq
  for (let w = 0; w < 40; w++) {
    const out = advanceWeek(c, planAll(c.roster, 'tactics'))
    c = out.state
  }
  const after = c.roster.find((p) => p.id === targetId)!
  console.log('=== テスト1: IQ集中（tactics・40週） ===')
  console.log(`  初期IQ ${iq0.toFixed(1)} → ${after.abilities.iq.toFixed(1)}  伸び +${(after.abilities.iq - iq0).toFixed(1)}`)
}

// --- テスト2: 創部メンバーを3年間パス集中育成して最終到達値 ---
{
  let c = createCareer('育成検証高', '静岡県')
  const initSum = abilitySum(c.roster[0].abilities)
  const yearSnap: number[] = []
  for (let y = 0; y < 3; y++) {
    for (let w = 0; w < 48; w++) {
      const out = advanceWeek(c, planAll(c.roster, 'pass'))
      c = out.state
    }
    const founders = c.roster.filter((p) => p.joinedYear === 1)
    if (founders.length > 0) {
      const avg = founders.reduce((s, p) => s + abilitySum(p.abilities), 0) / founders.length
      yearSnap.push(avg)
    }
  }
  console.log('\n=== テスト2: 創部メンバーの3年育成（パス集中） ===')
  console.log(`  初期 能力合計 ${initSum} (1人目)`)
  yearSnap.forEach((avg, i) => {
    console.log(`  ${i + 1}年目終了 創部組平均: 合計${avg.toFixed(0)} (1能力平均${(avg / 7).toFixed(1)})`)
  })
}

// --- テスト3: 5年間まわして破綻しないか ---
{
  let c = createCareer('長期検証学園', '大阪府')
  for (let w = 0; w < 48 * 5; w++) {
    const out = advanceWeek(c, planAll(c.roster, 'pass'))
    c = out.state
  }
  console.log('\n=== テスト3: 5年間の進行 ===')
  console.log(`  最終: ${c.year}年目 / 部員${c.roster.length}人 / 予算${c.budget}万 / スカウトLv${c.scouting.level} / 卒業生${c.records.graduates}人`)
  console.log(`  学年内訳: 1年${c.roster.filter(p => p.grade === 1).length} / 2年${c.roster.filter(p => p.grade === 2).length} / 3年${c.roster.filter(p => p.grade === 3).length}`)
  console.log('  破綻なく5年完走 ✅')
}
