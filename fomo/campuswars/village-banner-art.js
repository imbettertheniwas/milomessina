import {FOMO_MARK_PATHS} from './village-floor-logo.js?v=79';
import {chapterGoalReached} from './village-rewards.js?v=55';
// Original chapter compositions informed by public fraternity brand references.
// Color provenance and design notes: banner-references.md. These are not official flags.
const identities={
  'sigma-chi-sdsu':{key:'blue-and-gold',primary:'#009DDC',secondary:'#FFD24F',ink:'#10334D',paper:'#FFFFFF'},
  'kappa-sigma-coastal':{key:'star-and-crescent',primary:'#215732',secondary:'#BF0D3E',ink:'#FFFFFF',paper:'#FFFFFF',gold:'#C99700'},
  'phi-delta-theta-tampa':{key:'azure-academic',primary:'#0D1433',secondary:'#619CC7',ink:'#0D1433',paper:'#F8FAFC',silver:'#CBD5E1'},
  'phi-kappa-psi-vt':{key:'cardinal-rose',primary:'#006341',secondary:'#A6192E',ink:'#FFFFFF',paper:'#FFFFFF',gold:'#EAAA00'},
  'tau-kappa-epsilon-tampa':{key:'cherry-varsity',primary:'#AD2624',secondary:'#919194',ink:'#FFFFFF',paper:'#FFFFFF'}
};
const fallback={key:'chapter-classic',primary:'#252A51',secondary:'#C6BD9F',ink:'#FFFFFF',paper:'#FFFFFF'};
export function bannerIdentity(chapter){return identities[chapter.id]||Object.entries(identities).find(([id])=>id.startsWith(chapter.name.toLowerCase().replaceAll(" ","-")+"-"))?.[1]||fallback;}

// Shared FOMO campaign layout in each fraternity’s own colors.
export function paintChapterBanner(ctx,chapter,w,h){
  const b=bannerIdentity(chapter),sans='Aeonik, Arial, sans-serif';
  const white='#FFFFFF',muted='#BFC1D8',black='#12111A';
  const target=Math.ceil(chapter.active*.8),reached=chapterGoalReached(chapter);
  const progress=target>0?Math.max(0,Math.min(1,chapter.joined/target)):0;
  ctx.save();ctx.clearRect(0,0,w,h);ctx.textBaseline='middle';
  const rect=(x,y,sw,sh,color)=>{ctx.fillStyle=color;ctx.fillRect(x*w,y*h,sw*w,sh*h);};
  const text=(value,x,y,size,color,width,align='left',weight=700)=>{
    ctx.textAlign=align;ctx.letterSpacing='0px';let px=size*h;
    ctx.font=`${weight} ${px}px ${sans}`;
    while(ctx.measureText(value).width>width*w&&px>1){px-=.5;ctx.font=`${weight} ${px}px ${sans}`;}
    ctx.fillStyle=color;ctx.fillText(value,x*w,y*h);
  };
  rect(0,0,1,1,black);
  // The left identity panel reads from across the street; the right is a scorecard.
  rect(0,0,.40,1,b.primary);
  ctx.beginPath();ctx.moveTo(.29*w,0);ctx.lineTo(.40*w,0);ctx.lineTo(.40*w,h);ctx.lineTo(.13*w,h);ctx.closePath();
  ctx.fillStyle=b.secondary;ctx.globalAlpha=.26;ctx.fill();ctx.globalAlpha=1;
  ctx.save();ctx.beginPath();ctx.rect(0,0,.40*w,h);ctx.clip();
  ctx.strokeStyle='#FFFFFF12';ctx.lineWidth=h*.026;
  for(let i=-4;i<8;i++){ctx.beginPath();ctx.moveTo(i*h*.25,0);ctx.lineTo(i*h*.25-h*.5,h);ctx.stroke();}
  ctx.restore();
  rect(0,0,.40,.018,b.secondary);
  rect(.02,.018,.010,.964,b.secondary);
  // Use the existing original FOMO mark, never an approximation of it.
  if(typeof Path2D!=='undefined'){
    ctx.save();const size=h*.39;ctx.translate(w*.21-size*.5,-h*.017);ctx.scale(size/100,size/100);ctx.fillStyle=white;
    for(const path of FOMO_MARK_PATHS)ctx.fill(new Path2D(path));ctx.restore();
  }
  text(chapter.letters,.21,.49,.36,white,.32,'center');
  text(chapter.name.toUpperCase(),.21,.742,.065,white,.32,'center');
  text((chapter.shortSchool||chapter.school||'').toUpperCase(),.21,.851,.049,white,.32,'center',500);

  text('GREEK WARS',.45,.135,.068,muted,.24);
  const status=reached?'$500 PAID':'ROAD TO $500';
  rect(.744,.075,.211,.12,reached?'#CAFF83':'#29273D');
  text(status,.8495,.138,.060,reached?black:'#DAD9FF',.19,'center');
  text(`${chapter.joined} / ${target}`,.45,.425,.28,white,.50);
  text('MEMBERS ONBOARDED',.453,.614,.059,muted,.49);
  rect(.45,.73,.505,.028,'#343245');
  if(progress>0)rect(.45,.73,.505*progress,.028,reached?'#CAFF83':b.secondary);
  text(reached?'80% GOAL REACHED':'80% MEMBER TARGET',.45,.862,.054,reached?'#CAFF83':muted,.32);
  // Quiet stitching keeps the cloth tangible without muddying the typography.
  ctx.strokeStyle='#FFFFFF38';ctx.lineWidth=Math.max(.5,h*.002);ctx.setLineDash([h*.01,h*.008]);
  ctx.strokeRect(w*.009,h*.027,w*.982,h*.946);ctx.setLineDash([]);
  ctx.restore();
}
