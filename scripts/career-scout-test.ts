// スカウトを積極運用したときに強化が加速し、全国制覇に近づくかを検証。
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'
import { candStrength } from '../src/career/scout'

const g = () => useCareer.getState()
g().newCareer('強化検証高', '福井県')
// スカウトにSPを多く割く
g().setManagerAction('scout')

const TARGET_YEAR = 11
let actions = 0

function doScouting() {
  const c = g().career!
  if (c.scouting.level === 0) return
  // SPがある限り、バッジ持ち・調査途中の候補を優先して発見度を上げる
  let guard = 0
  while (g().career!.scouting.sp >= 4 && guard++ < 20) {
    const sc = g().career!.scouting
    // 未完了候補をpotバッジ優先でソート
    const target = [...sc.candidates]
      .filter((x) => x.discovery < 3 && !x.recruited)
      .sort((a, b) => (b.repBadge ? 1 : 0) - (a.repBadge ? 1 : 0) || b.discovery - a.discovery)[0]
    if (!target) break
    const before = g().career!.scouting.sp
    g().investCandidate(target.id)
    if (g().career!.scouting.sp === before) break // 投資できなかった
  }
  // 発見度2以上で初期能力(素材)が高い候補を勧誘リストへ（最大6人）
  for (const cand of g().career!.scouting.candidates) {
    if (g().career!.scouting.shortlist.length >= 6) break
    if (cand.discovery >= 2 && candStrength(cand.player) >= 46 && !cand.recruited
      && !g().career!.scouting.shortlist.includes(cand.id)) {
      g().toggleShortlist(cand.id)
    }
  }
}

while (g().career && g().career!.year < TARGET_YEAR && actions < 40000) {
  actions++
  const s = g()
  // 大会前の成長結果モーダルを閉じないと comp-bracket へ遷移しない（駆動の前提）
  if (s.growthResult) { s.dismissGrowth(); continue }
  switch (s.screen) {
    case 'weekly':
      doScouting()
      s.advance()
      break
    case 'summary': s.dismissSummary(); break
    case 'comp-bracket':
      if (playerMatchIndex(s.comp!.tournament) >= 0) s.startCompMatch()
      else s.continueAfterComp()
      break
    case 'comp-match': s.comp!.matchResult ? s.finishCompMatch() : s.resumeCompMatch(); break
    case 'comp-result': s.continueAfterComp(); break
    default: g().go('weekly')
  }
}

const c = g().career!
console.log('=== スカウト積極運用・福井・10年 ===')
console.log(`最終: ${c.year}年目 / 評判${c.reputation} / 部員${c.roster.length} / スカウトLv${c.scouting.level}`)
console.log(`通算: 夏制覇${c.records.summerTitles} 冬制覇${c.records.winterTitles} / 全国出場${c.records.nationalApps}回 / 卒業${c.records.graduates}`)
// 主力11人の平均能力
import { selectLineup } from '../src/career/lineup'
import { abilitySum } from '../src/engine/match/teamQuality'
const xi = selectLineup(c.roster, c.tactics.formation)
const avg = xi.reduce((s, p) => s + abilitySum(p.abilities), 0) / xi.length
console.log(`主力11人の平均能力合計: ${avg.toFixed(0)}（1能力平均${(avg / 7).toFixed(1)}・全国出場ライン65-70/優勝73-80）`)
console.log('履歴:')
for (const h of c.records.history.slice(-10)) console.log(`  ${h.year}年: 夏${h.summer} 冬${h.winter} (評判${h.reputationEnd})`)
console.log(`\nベースライン(スカウト無し福井)は評判72・0冠。スカウト運用で改善していれば power loop 成立。`)
