export const STEPS = [
  {key:'interests', chapter:'The vibe check', title:'What are you here for?', sub:'Pick your mix. There’s room for more than one version of you.', multi:true, choices:[['people','Find my people','A group chat that makes actual plans','✳'],['dinners','A seat at the table','Good food. New faces. Real conversations.','✦'],['creator','Create something','Content, collaborations, and fresh ideas','↗'],['campus','Make campus moves','Bring your people into the mix','◎']]},
  {key:'college', chapter:'Your world', title:'Is campus part of your life?', sub:'College girl, post-grad, or on your own path. You belong here.', choices:[['student','Yes, I’m in college','Currently living the campus chapter','⌂'],['graduate','I’ve graduated','The group chat lives on','↗'],['other','I’m on a different path','There’s a whole world beyond campus','✳']]},
  {key:'sorority', chapter:'Your circle', title:'Any sorority ties?', sub:'Your chapter, your friends, or just your own thing.', optional:true, choices:[['member','I’m in a sorority','My chapter is part of my world','♡'],['alumna','I’m an alumna','Still connected to my sisters','✦'],['friends','I have friends in one','In the loop, just not on the roster','◎'],['none','Not my scene','I’ve got my own circle','↗']]},
  {key:'creator', chapter:'Your creative side', title:'Camera roll or creator mode?', sub:'No follower minimum. Tell us where you’re at.', optional:true, choices:[['active','I create & post','Content is already my thing','↗'],['starting','I want to start','Ideas? Plenty. Ready to try? Yes.','✦'],['casual','Just for fun','A photo dump when the mood hits','♡'],['none','I’m here for the plans','Happy to stay behind the scenes','◎']]},
  {key:'connections', chapter:'The group chat', title:'Know the people who make plans happen?', sub:'Think fraternity presidents, social chairs, or the friend who brings everyone together.', optional:true, choices:[['leader','I know fraternity leaders','Presidents, social chairs, chapter organizers','✳'],['connected','I know well-connected frat guys','The ones everyone seems to know','◎'],['friends','I have a few fraternity friends','A connection here and there','♡'],['none','Not really','I’m here to meet new people','↗']]},
  {key:'dinners', chapter:'Your next plan', title:'A few new faces. One great dinner.', sub:'Would you want an invite to a FOMO dinner near you?', optional:true, choices:[['yes','Save me a seat','I’d love to hear about the next one','✦'],['friend','Yes, with a friend','Everything’s better with a plus-one','♡'],['maybe','Tell me more first','Curious. Send me the details.','◎'],['no','Not right now','Keep me in the loop for other things','↗']]},
  {key:'contact', chapter:'The last little thing', title:'Where should good plans find you?', sub:'Your mix is ready. Leave your details to join the interest list.'}
];
export function badges(a){
  const tags=[];
  if(a.college==='student')tags.push('Campus girl');
  if(['member','alumna'].includes(a.sorority))tags.push('Sisterhood');
  if(['active','starting'].includes(a.creator))tags.push(a.creator==='active'?'Creator':'Future creator');
  if(['leader','connected'].includes(a.connections))tags.push('Connector');
  if(['yes','friend','maybe'].includes(a.dinners))tags.push('Dinner circle');
  return tags.length?tags:['Social explorer'];
}
export function matches(a){
  const items=[];
  if(['yes','friend','maybe'].includes(a.dinners))items.push(['At the table','We’ll use your city and dinner interest to consider you for upcoming dinners.']);
  if(['active','starting'].includes(a.creator))items.push(['In your creator era','Your creator interest helps the team spot relevant collaboration opportunities.']);
  if(a.college==='student'||['member','alumna'].includes(a.sorority))items.push(['Campus, connected','Your school and chapter help us find the right campus community for you.']);
  if(['leader','connected'].includes(a.connections))items.push(['The social connection','You could help bring people and chapters into future FOMO plans.']);
  if(!items.length)items.push(['Your next circle','You’re on the list for community opportunities that fit your interests and city.']);
  return items;
}
export function cleanBranches(a){
  if(a.college==='other'){delete a.school;delete a.grad_year;}
  if(!['member','alumna','friends'].includes(a.sorority))delete a.chapter;
  if(!['active','starting','casual'].includes(a.creator)){delete a.platform;delete a.audience;}
  if(!['leader','connected','friends'].includes(a.connections))delete a.connection_chapter;
  if(!['yes','friend','maybe'].includes(a.dinners))delete a.dinner_style;
  return a;
}
