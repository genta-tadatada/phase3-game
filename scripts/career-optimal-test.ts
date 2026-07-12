// 全システム連動（設備投資＋スカウト＋育成）で全国制覇に届くかを検証。
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'
import { selectLineup } from '../src/career/lineup'
import { abilitySum } from '../src/engine/match/teamQuality'
import { candStrength } from '../src/career/scout'
import { canUpgrade, nextUpgradeCost, type FacilityKey } from '../src/career/facilities'

const g = () => useCareer.getState()
g().newCareer('最強検証高', '福井県')
// 全体を広く伸ばすプランを週替わりで（GK枠を時々挟む）
const PLANS = [
  ['shoot', 'dribble', 'defense'],
  ['pass', 'physical', 'defense'],
  ['dribble', 'shoot', 'gk-saving'],
  ['defense', 'pass', 'running'],
] as const
function setFocus(week: number) {
  const p = PLANS[week % PLANS.length]
  // フィールド選手はlane0（メニュー週替わり）、GKはlane1に集約（現行store API）
  g().setLaneMenu(0, p.find((m) => m !== 'gk-saving') ?? 'pass')
  g().assignGroup(0, 'allfp')
  g().setLaneMenu(1, 'gk-saving')
  g().assignGroup(1, 'gk')
}

function manage() {
  const c = g().career!
  const f = c.facilities
  // スカウト上位解禁に必要な寮を優先（Lv3=rep50+dorm2, Lv4=rep70+dorm3）
  if (c.reputation >= 50 && f.dorm < 2 && c.budget >= 300) { g().upgrade('dorm'); return }
  if (c.reputation >= 70 && f.dorm < 3 && c.budget >= 1500) { g().upgrade('dorm'); return }
  // 成長倍率(ground)を最優先で底上げ
  if (canUpgrade(c, 'ground')) { g().upgrade('ground'); return }
  const reserve = nextUpgradeCost(c, 'ground') * 0.5
  for (const key of ['training', 'dorm', 'clubhouse'] as FacilityKey[]) {
    if (canUpgrade(c, key) && c.budget - nextUpgradeCost(c, key) >= reserve) { g().upgrade(key); return }
  }
}
function scout() {
  const c = g().career!
  if (c.scouting.level === 0) return
  let guard = 0
  while (g().career!.scouting.sp >= 4 && guard++ < 15) {
    const sc = g().career!.scouting
    const t = [...sc.candidates].filter((x) => x.discovery < 3 && !x.recruited)
      .sort((a, b) => (b.repBadge ? 1 : 0) - (a.repBadge ? 1 : 0) || b.discovery - a.discovery)[0]
    if (!t) break
    const before = g().career!.scouting.sp
    g().investCandidate(t.id)
    if (g().career!.scouting.sp === before) break
  }
  for (const cand of g().career!.scouting.candidates) {
    if (g().career!.scouting.shortlist.length >= 6) break
    if (cand.discovery >= 2 && candStrength(cand.player) >= 46 && !cand.recruited && !g().career!.scouting.shortlist.includes(cand.id))
      g().toggleShortlist(cand.id)
  }
}

let week = 0
while (g().career && g().career!.year < 26 && week < 50000) {
  week++
  const s = g()
  switch (s.screen) {
    case 'weekly': {
      // 選択イベントが出ていたら最初の選択肢で解決（全システム連動確認）
      const ev = g().career!.pendingEvents[0]
      if (ev?.kind === 'choice' && ev.options) { g().resolveEvent(ev.options[0].effectId); break }
      manage()
      scout()
      const c = g().career!
      const avgFat = c.roster.reduce((a, p) => a + p.fatigue, 0) / c.roster.length
      setFocus(week)
      g().setWeekend(avgFat > 55 ? 'rest' : 'practice-match')
      g().setManagerAction(week % 3 === 0 ? 'meeting' : 'scout')
      g().fastForward()
      break
    }
    case 'summary': s.dismissSummary(); break
    case 'comp-bracket': playerMatchIndex(s.comp!.tournament) >= 0 ? s.startCompMatch() : s.continueAfterComp(); break
    case 'comp-match': s.comp!.matchResult ? s.finishCompMatch() : s.resumeCompMatch(); break
    case 'comp-result': s.continueAfterComp(); break
    default: g().go('weekly')
  }
}

const c = g().career!
const xi = selectLineup(c.roster, c.tactics.formation)
const avg = xi.reduce((s, p) => s + abilitySum(p.abilities), 0) / xi.length
console.log('=== 全システム連動・福井・12年・最適運用 ===')
console.log(`最終: ${c.year}年目 / 評判${c.reputation} / 部員${c.roster.length} / 予算${c.budget}万`)
console.log(`設備: グラウンドLv${c.facilities.ground} 部室Lv${c.facilities.clubhouse} トレLv${c.facilities.training} 寮Lv${c.facilities.dorm} / スカウトLv${c.scouting.level}`)
console.log(`通算: 夏制覇${c.records.summerTitles} 冬制覇${c.records.winterTitles} / 全国出場${c.records.nationalApps}回 / プロ輩出${c.records.proPlayers}人 ${c.records.proAlumni.map(a => a.name).join('、')}`)
console.log(`主力11人 平均能力合計 ${avg.toFixed(0)}（1能力${(avg / 7).toFixed(1)}・全国出場65-70/優勝73-80）`)
console.log('履歴(直近10年):')
for (const h of c.records.history.slice(-10)) console.log(`  ${h.year}年: 夏${h.summer} 冬${h.winter} (評判${h.reputationEnd})`)
const totalSkills = c.roster.reduce((s, p) => s + (p.skills?.length ?? 0), 0)
const withSkills = c.roster.filter((p) => (p.skills?.length ?? 0) > 0).length
console.log(`スキル: 保持選手${withSkills}人 / 延べ${totalSkills}個（例: ${c.roster.filter(p=>p.skills?.length).slice(0,3).map(p=>`${p.name}[${p.skills!.map(s=>s).join(',')}]`).join(' ')}）`)
