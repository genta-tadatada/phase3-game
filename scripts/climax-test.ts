// 山場スキルイベント(#34)の発火検証：卒業継承・大会・セレクション。
// 2026-07-07更新: 検出を pendingEvents の id ベースに統一（旧: log の文言grep＝チャネルが古く偽陰性）。
//   ・継承は `inherit-{year}` イベントとして発火する
//   ・「新キャプテン覚醒（自動キャプテンシー付与）」は #62 でユーザー選択方式に変更＝自動付与は廃止 → 検証対象から除外
//   ・new-captain 画面をドライバで処理（処理しないと3年引退後に停止する）
//   ・セレクション開花(selskill)は発火条件（トグルON＋評判50）が通常プレイで届かないため参考値。専用検証は selection-test.ts
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'
const g = () => useCareer.getState()
const FP = ['pass', 'shoot', 'dribble', 'defense', 'physical', 'running', 'tactics']

function play(seed: number, years: number) {
  g().newCareer('検', '東京都', 'M' + seed)
  const counts = { inherit: 0, comp: 0, sel: 0, camp: 0 }
  const seen = new Set<string>()
  let a = 0
  while (g().career && g().career!.year <= years && a < 60000) {
    a++
    const s = g(), sc = s.screen, c = s.career!
    // 山場イベントは pendingEvents の id で拾う（発火の一次ソース）
    for (const ev of c.pendingEvents) {
      if (seen.has(ev.id)) continue
      if (ev.id.startsWith('inherit-')) { seen.add(ev.id); counts.inherit++ }
      else if (ev.id.startsWith('compskill')) { seen.add(ev.id); counts.comp++ }
      else if (ev.id.startsWith('selskill')) { seen.add(ev.id); counts.sel++ }
    }
    if (g().growthResult) { g().dismissGrowth(); continue }
    if (sc === 'camp') { let gg = 0; while (g().screen === 'camp' && gg++ < 80) { const cs = g(); if (cs.campStage === 'choice') { const cp = cs.career!.activeCamp!; const ld = cp.shown[cp.shown.length - 1]; const o = ld.events[ld.events.length - 1].choice?.options[0]; if (o) cs.resolveCampChoice(o.effectId); else cs.nextCampStep() } else cs.nextCampStep() } counts.camp++; continue }
    if (sc === 'weekly') {
      const w = c.week
      s.setLaneMenu(0, FP[w % FP.length]); s.assignGroup(0, 'allfp'); s.setWeekend(w % 3 === 2 ? 'rest' : 'practice-match')
      try { s.upgrade('ground'); s.upgrade('training'); s.upgrade('dorm') } catch { /* noop */ }
      s.recommendPositions(); s.advance()
    } else if (sc === 'summary') s.dismissSummary()
    else if (sc === 'selection') { const ap = c.pendingApplicants ?? []; s.confirmSelection(ap.slice(0, c.admitCap ?? ap.length).map((p) => p.id)) }
    else if (sc === 'intake') s.finishIntake()
    else if (sc === 'new-captain') { const cand = c.roster.find((p) => !p.retired); if (cand) s.pickInitialCaptain(cand.id); else break }
    else if (sc === 'comp-bracket') { if (playerMatchIndex(s.comp!.tournament) >= 0) s.startCompMatch(); else s.continueAfterComp() }
    else if (sc === 'comp-match') { if (!s.comp!.matchResult) s.resumeCompMatch(); else s.finishCompMatch() }
    else if (sc === 'comp-result') s.continueAfterComp()
    else s.go('weekly')
  }
  const totalSkills = (g().career?.roster ?? []).reduce((n, p) => n + (p.skills?.length ?? 0), 0)
  return { counts, totalSkills, year: g().career?.year }
}

console.log('=== 山場スキルイベント発火検証（各15年） ===')
const tot = { inherit: 0, comp: 0, sel: 0, camp: 0 }
for (let seed = 0; seed < 8; seed++) {
  const r = play(seed, 15)
  for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += r.counts[k]
  if (seed < 4) console.log(`seed${seed}: 継承${r.counts.inherit} 大会${r.counts.comp} セレ${r.counts.sel} 合宿${r.counts.camp}回 / 現役スキル計${r.totalSkills}`)
}
console.log('\n8キャリア合計:', `卒業継承=${tot.inherit} 大会開花=${tot.comp} セレクション=${tot.sel}(参考値) 合宿=${tot.camp}回`)
const ok = tot.inherit > 0 && tot.comp > 0
console.log(ok ? '✅ 全山場が発火している' : '⚠ 一部の山場が未発火（要確認）')
if (!ok) process.exit(1)
