import {cleanBranches} from './quiz.mjs';
export const FRAT_REWARD = 100;
export const MISSIONS = [
  {id:'frat',icon:'↗',title:'Bring a frat to FOMO',short:'The connector',tag:'CASH MISSION',reward:'$100',description:'Your introduction could be their next chapter. Bring a fraternity onto FOMO and get rewarded.',benefit:'$100 when the fraternity completes onboarding and FOMO verifies your referral.',steps:['Pick your fraternity + school','Introduce FOMO to a chapter decision-maker','The chapter completes onboarding','FOMO verifies the referral → you earn $100'],action:'Pin the $100 mission',interest:'campus',key:'connections'},
  {id:'creator',icon:'✦',title:'Make something worth sharing',short:'The creator',tag:'CREATOR PATH',reward:'Get paid for views',description:'Turn content into paid views. Bring your style to FOMO and make something people want to watch.',benefit:'Creators get paid for views on qualifying content. FOMO confirms the rate, eligible views, and brief before you start.',steps:['Add your creator profile','FOMO reviews for a relevant brief','Agree on the rate and eligible content', 'Create, post, and get paid for verified qualifying views'],action:'Pin my creator mission',interest:'creator',key:'creator'},
  {id:'circle',icon:'◎',title:'Bring your girls into the mix',short:'The circle builder',tag:'COMMUNITY PATH',reward:'Community opportunities',description:'The sorority connection, the organizer, the girl who gets everyone there. That could be you.',benefit:'Get considered for chapter collaborations and community plans. No cash reward is set for this mission yet.',steps:['Add your sorority connection','FOMO follows up about a relevant plan','Agree on your contribution and any incentive'],action:'Pin my circle mission',interest:'people',key:'sorority'},
  {id:'dinner',icon:'✳',title:'Take it to the dinner table',short:'The dinner girl',tag:'SOCIAL PATH',reward:'Dinner + content = comped',description:'Come to dinner. Make content. Get your dinner comped when you complete the agreed content.',benefit:'Attend a FOMO dinner and make the agreed content to get your dinner comped. FOMO confirms the invitation, content requirements, and comp details beforehand.',steps:['Choose your dinner contribution','Confirm an invite and the content requirements','Attend and make the agreed content','FOMO confirms completion → dinner comped'],action:'Pin my dinner mission',interest:'dinners',key:'dinners'},
  {id:'internship',icon:'⚑',title:'Don’t just pull up. Run it.',short:'The campus leader',tag:'LEADERSHIP PATH',reward:'A role with real influence',description:'Build a team. Shape the plans. Help decide what FOMO looks like on your campus.',benefit:'Apply for an internship with responsibility for campus projects, people, or events. Your role and decision-making scope are confirmed if you’re selected.',steps:['Choose where you want to lead','Meet the team and complete selection','Own projects and decisions within your assigned role'],action:'Pin my leadership mission',interest:'campus',key:'internship_role'}
];
export function potentialReward(ids){return ids.includes('frat')?FRAT_REWARD:0;}
export function missionPayload(answers,ids){
  const a=cleanBranches({...answers});
  if(ids.includes('frat'))a.connection_chapter=answers.connection_chapter;
  a.interests=[...new Set(ids.map(id=>MISSIONS.find(m=>m.id===id)?.interest).filter(Boolean))];
  for(const [id,key,details] of [['frat','connections',['connection_chapter','referral_school']],['creator','creator',['platform','audience']],['circle','sorority',['chapter']],['dinner','dinners',['dinner_style','dinner_role']],['internship','internship_role',[]]]){
    if(!ids.includes(id)){a[key]='skip';details.forEach(k=>delete a[k]);}
  }
  return a;
}
export function introText(a){return `Hey! I thought ${a.connection_chapter} at ${a.referral_school} could be a great fit for FOMO. I’d love to introduce you to the team and help get the chapter onboarded. Who’s the best person to connect with?`;}

// A guest who is only attending has not opted into the content-for-comp offer.
export function missionFor(id,answers={}){
 const m=MISSIONS.find(x=>x.id===id);
 if(id==='dinner'&&answers.dinner_role&&answers.dinner_role!=='content')return {...m,reward:'Dinner interest · no content comp',benefit:'You chose to join without the content-for-comp mission. An invitation and any hosting arrangement are confirmed separately.',steps:['Choose how you want to join','FOMO reviews upcoming dinners for a fit','Confirm the invitation and any separate arrangement']};
 return m;
}
