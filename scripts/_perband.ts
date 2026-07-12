import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'
import { candStrength } from '../src/career/scout'
import { PREFECTURES } from '../src/data/prefectures'
import { prefDifficulty } from '../src/data/schoolLedger'
const g = () => useCareer.getState()
const FP = ['pass','shoot','dribble','defense','physical','running','tactics']
function repPref(d:'easy'|'normal'|'hard'){ const ps=PREFECTURES.filter(p=>prefDifficulty(p.name)===d).sort((a,b)=>a.strength-b.strength); return ps[Math.floor(ps.length/2)].name }
function camp(){ let gg=0; while(g().screen==='camp'&&gg++<120){ const cs=g(); if(cs.campStage==='choice'){ const cp=cs.career!.activeCamp!, ld=cp.shown[cp.shown.length-1], o=ld?.events[ld.events.length-1]?.choice?.options[0]; o?cs.resolveCampChoice(o.effectId):cs.nextCampStep() } else cs.nextCampStep() } }
function doScout(){ const c=g().career!; if(c.scouting.level===0)return; let gd=0; while(g().career!.scouting.sp>=4&&gd++<25){ const sc=g().career!.scouting; const t=[...sc.candidates].filter(x=>x.discovery<3&&!x.recruited).sort((a,b)=>(b.repBadge?1:0)-(a.repBadge?1:0)||b.discovery-a.discovery)[0]; if(!t)break; const bf=g().career!.scouting.sp; g().investCandidate(t.id); if(g().career!.scouting.sp===bf)break } for(const cd of g().career!.scouting.candidates){ if(g().career!.scouting.shortlist.length>=8)break; if(cd.discovery>=2&&candStrength(cd.player)>=44&&!cd.recruited&&!g().career!.scouting.shortlist.includes(cd.id)){g().toggleShortlist(cd.id);g().setOffer(cd.id,1)} } }
function run(pref:string,seed:number){
  g().newCareer('検'+seed,pref,'M'+seed); let a=0; let entryY=-1, champY=-1, natTitleY=-1
  while(g().career && g().career!.year<26 && a<16000){ a++; const s=g()
    const c=s.career
    if(c){ if(entryY<0 && (c.pendingNational||(s.comp&&s.comp.stage==='national'))) entryY=c.year
      if(champY<0 && c.lastQualifyChamp && (c.lastQualifyChamp.summer>0||c.lastQualifyChamp.winter>0)) champY=c.year
      if(natTitleY<0 && (c.natTitleYears?.length??0)>0) natTitleY=c.natTitleYears![0]
      if(entryY>0&&champY>0&&natTitleY>0) break }
    if(s.growthResult){s.dismissGrowth();continue}
    const sc=s.screen
    if(sc==='weekly'){ const w=s.career!.week; for(const k of ['ground','training','dorm','clubhouse']) try{s.upgrade(k)}catch{}
      s.setLaneMenu(0,FP[w%FP.length]); s.assignGroup(0,'allfp'); s.setLaneMenu(1,'gk-saving'); s.assignGroup(1,'gk')
      s.setWeekend(w%3===2?'rest':'practice-match'); s.setManagerAction('scout'); doScout(); s.advance() }
    else if(sc==='summary') s.dismissSummary()
    else if(sc==='comp-bracket'){playerMatchIndex(s.comp!.tournament)>=0?s.startCompMatch():s.continueAfterComp()}
    else if(sc==='comp-match'){s.comp!.matchResult?s.finishCompMatch():s.resumeCompMatch()}
    else if(sc==='comp-result') s.continueAfterComp()
    else if(sc==='camp') camp()
    else g().go('weekly')
  }
  return {entry:entryY, champ:champY, natTitle:natTitleY}
}
const N=6
for(const d of ['easy','normal','hard'] as const){ const pref=repPref(d)
  const rs=Array.from({length:N},(_,i)=>run(pref,i))
  const avg=(k:'entry'|'champ'|'natTitle')=>{const v=rs.map(r=>r[k]).filter(x=>x>0); return v.length?(v.reduce((a,b)=>a+b,0)/v.length):-1}
  console.log(`${d==='easy'?'易':d==='normal'?'普':'難'}(${pref}): 県優勝 ${avg('champ').toFixed(1)}年 / 全国出場 ${avg('entry').toFixed(1)}年 / 全国優勝 ${avg('natTitle').toFixed(1)}年`)
}
