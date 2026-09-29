import {cleanBranches} from './quiz.mjs';
export const FRAT_REWARD = 100;
export const MISSIONS = [
  {id:'frat',icon:'↗',title:'Bring a frat',short:'Frat referral',tag:'INTRODUCTIONS',reward:'$100',description:'Know someone who runs a chapter?',benefit:'Earn $100 after FOMO verifies your referral and the fraternity finishes onboarding.',steps:['Tell us the chapter and school','Make the introduction','They onboard. FOMO verifies. You earn $100.'],action:'Add to my list',interest:'campus',key:'connections'},
  {id:'creator',icon:'✦',title:'Make videos',short:'Creator',tag:'CREATE',reward:'Paid for views',description:'Get paid for qualifying views on your FOMO content.',benefit:'We’ll agree on the rate, brief, and which views count before you start.',steps:['Share your creator profile','Agree on a brief and rate','Post your content. Get paid for qualifying views.'],action:'Add to my list',interest:'creator',key:'creator'},
  {id:'circle',icon:'◎',title:'Bring your chapter',short:'Sorority',tag:'CONNECT',reward:'Chapter events',description:'Help get your sorority involved.',benefit:'Tell us your chapter. We’ll reach out about events and collaborations.',steps:['Share your sorority connection','Work out a plan with the team'],action:'Add to my list',interest:'people',key:'sorority'},
  {id:'dinner',icon:'✳',title:'Dinner’s on us',short:'Dinner',tag:'GO OUT',reward:'Dinner for content',description:'Make the agreed content at dinner. We cover your meal.',benefit:'Your dinner is comped when you attend and make the agreed content. We’ll confirm the invite and details first.',steps:['Choose how you want to join','Confirm your invite and content brief','Come to dinner and make the content. Meal comped.'],action:'Add to my list',interest:'dinners',key:'dinners'},
  {id:'internship',icon:'⚑',title:'Run things on campus',short:'Internship',tag:'LEAD',reward:'Campus internship',description:'Lead a team and plan campus events.',benefit:'Apply for a campus role. Responsibilities and decision-making scope depend on the role you’re selected for.',steps:['Choose a role','Meet the team','If selected, take on your campus projects'],action:'Add to my list',interest:'campus',key:'internship_role'}
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
export function introText(a){return `Hey! I’m talking to FOMO about getting ${a.connection_chapter} at ${a.referral_school} involved. Who should I connect them with?`;}

// A guest who is only attending has not opted into the content-for-comp offer.
export function missionFor(id,answers={}){
 const m=MISSIONS.find(x=>x.id===id);
 if(id==='dinner'&&answers.dinner_role&&answers.dinner_role!=='content')return {...m,title:'Join a dinner',reward:'Dinner · no content comp',benefit:'You’re interested in attending without the content offer. We’ll confirm availability and costs with you.',steps:['Share your interest','Confirm the invitation and details']};
 return m;
}
