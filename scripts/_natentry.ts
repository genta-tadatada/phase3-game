import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'
import { candStrength } from '../src/career/scout'
import { PREFECTURES } from '../src/data/prefectures'
import { prefDifficulty } from '../src/data/schoolLedger'
const g = () => useCareer.getState()
const FP = ['pass','shoot','dribble','defense','physical','running','tactics']
// 各帯の中央値strengthに最も近い県を代表に選ぶ
function repPref(d:'easy'|'normal'|'hard'){ const ps=PREFECTURES.filter(p=>prefDifficulty(p.name)===d).sort((a,b)=>a.strength-b.strength)
  return ps[Math.floor(ps.length/2)].name }
function camp(){ let gg=0; while(g().screen==='camp'&&gg++<120){ const cs=g()
  if(cs.campStage==='choice'){ const cp=cs.career!.activeCamp!, ld=cp.shown[cp.shown.length-1], o=ld?.events[ld.events.length-1]?.choice?.options[0]; o?cs.resolveCampChoice(o.effectId):cs.nextCampStep() } else cs.nextCampStep() } }
function doScouting(){ const c=g().career!; if(c.scouting.level===0) return; let gd=0
  while(g().career!.scouting.sp>=4 && gd++<25){ const sc=g().career!.scouting
    const t=[...sc.candidates].filter(x=>x.discovery<3&&!x.recruited).sort((a,b)=>(b.repBadge?1:0)-(a.repBadge?1:0)||b.discovery-a.discovery)[0]
    if(!t)break; const bf=g().career!.scouting.sp; g().investCandidate(t.id); if(g().career!.scouting.sp===bf)break }
  for(const cand of g().career!.scouting.candidates){ if(g().career!.scouting.shortlist.length>=8)break
    if(cand.discovery>=2&&candStrength(cand.player)>=44&&!cand.recruited&&!g().career!.scouting.shortlist.includes(cand.id)){g().toggleShortlist(cand.id);g().setOffer(cand.id,1)} } }
function firstNationalYear(pref:string,seed:number){
  g().newCareer('検'+seed,pref,'M'+seed); let a=0
  while(g().career && g().career!.year<25 && a<14000){ a++; const s=g()
    if(s.career && (s.career.pendingNational || (s.comp && s.comp.stage==='national'))) return s.career.year
    if(s.growthResult){s.dismissGrowth();continue}
    const sc=s.screen
    if(sc==='weekly'){ const w=s.career!.week
      for(const k of ['ground','training','dorm','clubhouse']) try{s.upgrade(k)}catch{}
      s.setLaneMenu(0,FP[w%FP.length]); s.assignGroup(0,'allfp'); s.setLaneMenu(1,'gk-saving'); s.assignGroup(1,'gk')
      s.setWeekend(w%3===2?'rest':'practice-match'); s.setManagerAction('scout'); doScouting(); s.advance() }
    else if(sc==='summary') s.dismissSummary()
    else if(sc==='comp-bracket'){playerMatchIndex(s.comp!.tournament)>=0?s.startCompMatch():s.continueAfterComp()}
    else if(sc==='comp-match'){s.comp!.matchResult?s.finishCompMatch():s.resumeCompMatch()}
    else if(sc==='comp-result') s.continueAfterComp()
    else if(sc==='camp') camp()
    else g().go('weekly')
  }
  return g().career?.year ?? -1
}
for(const d of ['easy','normal','hard'] as const){ const pref=repPref(d)
  const yrs=[0,1,2].map(s=>firstNationalYear(pref,s)); const avg=yrs.reduce((a,b)=>a+b,0)/yrs.length
  console.log(`${d==='easy'?'やさしい':d==='normal'?'ふつう':'むずかしい'}(代表:${pref}): 初の全国出場 ${yrs.join('/')} 年 (平均${avg.toFixed(1)})`)
}
