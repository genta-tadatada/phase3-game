import { useCareer } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'
import { PREFECTURES } from '../src/data/prefectures'
import { candStrength } from '../src/career/scout'
const g=()=>useCareer.getState()
const FP=['pass','shoot','dribble','defense1v1','run','tactics'], GK=['gk-saving','gk-position']
const PREFS=PREFECTURES.map(p=>p.name)
type S='optimal'|'good'|'average'|'poor'
const up=(s:any,keys:string[])=>{for(const k of keys){try{s.upgrade(k)}catch{}}}
function scout(s:any,c:any,minPot:number,maxInvest:number){s.setManagerAction('scout');let n=0
 for(const cd of c.scouting.candidates){if(cd.discovery<2&&n<maxInvest){try{s.investCandidate(cd.id);n++}catch{}}}
 for(const cd of c.scouting.candidates){if(cd.discovery>=2&&candStrength(cd.player)>=minPot&&!c.scouting.shortlist.includes(cd.id)){try{s.toggleShortlist(cd.id)}catch{}}}}
// 設備投資は全層が行う「基本動作」。層差は育成メニューの質＋スカウト深度で出す。
function setPlan(strat:S){const s=g(),c=s.career!,w=c.week
 if(strat==='poor'){up(s,['ground']);s.setLaneMenu(0,'tactics');s.assignGroup(0,'allfp');s.setLaneMenu(1,'gk-position');s.assignGroup(1,'gk');s.setWeekend(w%4===0?'practice-match':'rest');return}
 if(strat==='average'){up(s,['ground','training']);s.autoAssignPositions();s.setWeekend(w%2===0?'practice-match':'rest');return}
 // good/optimal: メニュー巡回＋試合2:休1。optimalは全設備＋積極スカウト（解放行動をフル活用）
 s.setLaneMenu(0,FP[w%FP.length]);s.assignGroup(0,'allfp');s.setLaneMenu(1,GK[w%GK.length]);s.assignGroup(1,'gk');s.setWeekend(w%3===2?'rest':'practice-match')
 s.recommendPositions()
 if(strat==='good'){up(s,['ground','training'])}
 if(strat==='optimal'){up(s,['ground','training']);scout(s,c,46,6)}}
function run(strat:S,pref:string,seed:number){g().newCareer('検',pref,'M'+seed);let p1:number|null=null,n1:number|null=null,a=0
 while(g().career&&g().career!.year<=60&&a<140000){a++;const s=g(),sc=s.screen
  if(g().growthResult){g().dismissGrowth()} // 成長結果を閉じる（合宿前にも出る→閉じると合宿へ）
  else if(sc==='camp'){let gg=0;while(g().screen==='camp'&&gg++<80){const cs=g();if(cs.campStage==='choice'){const cp=cs.career!.activeCamp!,ld=cp.shown[cp.shown.length-1],o=ld.events[ld.events.length-1].choice?.options[0];if(o)cs.resolveCampChoice(o.effectId);else cs.nextCampStep()}else cs.nextCampStep()}} // 夏合宿を進める（選択は最初の選択肢）
  else if(sc==='weekly'){setPlan(strat);s.advance()}else if(sc==='summary'){s.dismissSummary()}
  else if(sc==='comp-bracket'){if(playerMatchIndex(s.comp!.tournament)>=0)s.startCompMatch();else s.continueAfterComp()}
  else if(sc==='comp-match'){if(!s.comp!.matchResult)s.resumeCompMatch();else s.finishCompMatch()}
  else if(sc==='comp-result'){s.continueAfterComp()}else{s.go('weekly')}
  const cc=g().career;if(!cc)break;const sl=cc.season.summerLabel??'',wl=cc.season.winterLabel??''
  if(p1==null&&(sl.startsWith('全国')||wl.startsWith('全国')))p1=cc.year
  if(n1==null&&(sl==='全国優勝'||wl==='全国優勝'))n1=cc.year
  if(p1!=null&&n1!=null)break}
 return{p:p1,n:n1}}
// 県の強度帯（難県の県優勝を別途確認）
const tierPrefs:Record<string,string[]>={弱:[],中:[],強:[],最強:[]}
for(const p of PREFECTURES){const s=p.strength;(s<=49?tierPrefs.弱:s<=59?tierPrefs.中:s<=69?tierPrefs.強:tierPrefs.最強).push(p.name)}
const N=30
const natByStrat:Record<string,number>={}
console.log('=== 初優勝までの平均年数（各N='+N+'・全国の県をばらつかせ・最悪育成は除外）===')
for(const strat of ['optimal','good','average','poor'] as S[]){let ps=0,pc=0,ns=0,nc=0
 for(let i=0;i<N;i++){const r=run(strat,PREFS[(i*7+3)%PREFS.length],i);if(r.p!=null){ps+=r.p;pc++}if(r.n!=null){ns+=r.n;nc++}}
 if(nc)natByStrat[strat]=ns/nc
 const pa=pc?`${(ps/pc).toFixed(1)}年(${Math.round(100*pc/N)}%)`:'未達',na=nc?`${(ns/nc).toFixed(1)}年(${Math.round(100*nc/N)}%)`:'未達(0%)'
 console.log(`${strat.padEnd(8)} 県優勝 ${pa.padEnd(16)} 全国優勝 ${na}`)}
if(natByStrat.optimal&&natByStrat.average)console.log(`\n一般/最適の全国優勝 倍率 = ${(natByStrat.average/natByStrat.optimal).toFixed(2)}倍（目標1.5〜1.8）`)
console.log('\n=== 最適育成の県優勝・県の強度帯別（難県ほど遅い）===')
const M=18
for(const tier of ['弱','中','強','最強']){const prefs=tierPrefs[tier];let sum=0,cnt=0
 for(let i=0;i<M;i++){const r=run('optimal',prefs[i%prefs.length],i+500);if(r.p!=null){sum+=r.p;cnt++}}
 console.log(`  ${tier}帯 初県優勝: ${cnt?`${(sum/cnt).toFixed(1)}年(${Math.round(100*cnt/M)}%)`:'未達'}`)}
