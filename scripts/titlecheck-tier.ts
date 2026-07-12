// Z-1+: 県の難度帯ごとに 県優勝・全国優勝 までの年数を分解
import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'
import { PREFECTURES } from '../src/data/prefectures'
import { candStrength } from '../src/career/scout'
const g=()=>useCareer.getState()
const FP=['pass','shoot','dribble','defense1v1','run','tactics'], GK=['gk-saving','gk-position']
type S='optimal'|'good'|'average'|'poor'
const up=(s:any,keys:string[])=>{for(const k of keys){try{s.upgrade(k)}catch{}}}
function scout(s:any,c:any,minPot:number,maxInvest:number){s.setManagerAction('scout');let n=0
 for(const cd of c.scouting.candidates){if(cd.discovery<2&&n<maxInvest){try{s.investCandidate(cd.id);n++}catch{}}}
 for(const cd of c.scouting.candidates){if(cd.discovery>=2&&candStrength(cd.player)>=minPot&&!c.scouting.shortlist.includes(cd.id)){try{s.toggleShortlist(cd.id)}catch{}}}}
function setPlan(strat:S){const s=g(),c=s.career!,w=c.week
 if(strat==='poor'){up(s,['ground']);s.setLaneMenu(0,'tactics');s.assignGroup(0,'allfp');s.setLaneMenu(1,'gk-position');s.assignGroup(1,'gk');s.setWeekend(w%4===0?'practice-match':'rest');return}
 if(strat==='average'){up(s,['ground','training']);s.autoAssignPositions();s.setWeekend(w%2===0?'practice-match':'rest');return}
 s.setLaneMenu(0,FP[w%FP.length]);s.assignGroup(0,'allfp');s.setLaneMenu(1,GK[w%GK.length]);s.assignGroup(1,'gk');s.setWeekend(w%3===2?'rest':'practice-match')
 s.recommendPositions()
 if(strat==='good'){up(s,['ground','training'])}
 if(strat==='optimal'){up(s,['ground','training']);scout(s,c,46,6)}}
function run(strat:S,pref:string,seed:number){g().newCareer('検',pref,'M'+seed);let p1:number|null=null,n1:number|null=null,a=0
 while(g().career&&g().career!.year<=60&&a<140000){a++;const s=g(),sc=s.screen
  if(g().growthResult){g().dismissGrowth()}
  else if(sc==='camp'){let gg=0;while(g().screen==='camp'&&gg++<80){const cs=g();if(cs.campStage==='choice'){const cp=cs.career!.activeCamp!,ld=cp.shown[cp.shown.length-1],o=ld.events[ld.events.length-1].choice?.options[0];if(o)cs.resolveCampChoice(o.effectId);else cs.nextCampStep()}else cs.nextCampStep()}}
  else if(sc==='weekly'){setPlan(strat);s.advance()}else if(sc==='summary'){s.dismissSummary()}
  else if(sc==='comp-bracket'){if(playerMatchIndex(s.comp!.tournament)>=0)s.startCompMatch();else s.continueAfterComp()}
  else if(sc==='comp-match'){if(!s.comp!.matchResult)s.resumeCompMatch();else s.finishCompMatch()}
  else if(sc==='comp-result'){s.continueAfterComp()}else{s.go('weekly')}
  const cc=g().career;if(!cc)break;const sl=cc.season.summerLabel??'',wl=cc.season.winterLabel??''
  if(p1==null&&(sl.startsWith('全国')||wl.startsWith('全国')))p1=cc.year
  if(n1==null&&(sl==='全国優勝'||wl==='全国優勝'))n1=cc.year
  if(p1!=null&&n1!=null)break}
 return{p:p1,n:n1}}
const tierPrefs:Record<string,string[]>={弱:[],中:[],強:[],最強:[]}
for(const p of PREFECTURES){const s=p.strength;(s<=49?tierPrefs.弱:s<=59?tierPrefs.中:s<=69?tierPrefs.強:tierPrefs.最強).push(p.name)}
const TIERS=['弱','中','強','最強'] as const
const STRATS:S[]=['optimal','good','average','poor']
const M=24
console.log('=== 県難度 × 戦略 × (県優勝/全国優勝) 平均年数 ===')
const pad=(s:string,n:number)=>s.padEnd(n,'　').slice(0,n)
const padNum=(s:string,n:number)=>s.padStart(n)
console.log(`${pad('帯',6)} ${pad('戦略',10)} ${padNum('県優勝',16)} ${padNum('全国優勝',18)}`)
console.log('─'.repeat(56))
for(const tier of TIERS){
  const prefs=tierPrefs[tier]
  if(prefs.length===0)continue
  for(const strat of STRATS){
    let ps=0,pc=0,ns=0,nc=0
    for(let i=0;i<M;i++){
      const r=run(strat,prefs[i%prefs.length],i+1000+TIERS.indexOf(tier)*100+STRATS.indexOf(strat)*30)
      if(r.p!=null){ps+=r.p;pc++}
      if(r.n!=null){ns+=r.n;nc++}
    }
    const pa=pc?`${(ps/pc).toFixed(1)}年(${Math.round(100*pc/M)}%)`:'未達(0%)'
    const na=nc?`${(ns/nc).toFixed(1)}年(${Math.round(100*nc/M)}%)`:'未達(0%)'
    console.log(`${pad(tier,6)} ${pad(strat,10)} ${padNum(pa,16)} ${padNum(na,18)}`)
  }
  console.log('─'.repeat(56))
}
