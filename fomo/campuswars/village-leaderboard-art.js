import {bannerIdentity} from './village-banner-art.js?v=153';
import {FOMO_MARK_PATHS} from './village-floor-logo.js?v=153';

export const LEADERBOARD_LIMIT=10;
export const ROW_HEIGHT=166;
export const ROWS_TOP=382;
export const ROWS_HEIGHT=830;

export function paintLeaderboardFrame(ctx,w,h,count,metric='progress',{schoolName=''}={}){
  ctx.fillStyle='#221D4B';ctx.fillRect(0,0,w,h);ctx.textBaseline='middle';ctx.textAlign='left';
  ctx.fillStyle='#EAEDFF';ctx.fillRect(0,0,w,12);ctx.font='700 47px Aeonik, Arial, sans-serif';ctx.fillText(schoolName?schoolName.toUpperCase():'FOMO / GREEK WARS',100,91,w-200);
  ctx.fillStyle='#EAEDFF';ctx.font='700 '+(schoolName?100:121)+'px Aeonik, Arial, sans-serif';ctx.fillText(schoolName?'CAMPUS LEADERBOARD':'LEADERBOARD',100,211);
  ctx.fillStyle='#EAEDFFB8';ctx.font='500 40px Aeonik, Arial, sans-serif';ctx.fillText('CHAPTER',105,315);
  ctx.textAlign='right';ctx.fillText(metric==='members'?'MEMBERS':'80% TARGET',w-327,315);ctx.fillText('% ROSTER',w-110,315);
  if(!count){ctx.textAlign='center';ctx.font='700 58px Aeonik, Arial, sans-serif';ctx.fillText('YOUR CHAPTER COULD BE FIRST',w/2,740);}
  ctx.textAlign='left';ctx.fillStyle='#EAEDFFB8';ctx.font='500 32px Aeonik, Arial, sans-serif';
  const scope=schoolName?'CAMPUS ':'';const total=count+' '+scope+(count===1?'CHAPTER':'CHAPTERS');ctx.fillText((count>LEADERBOARD_LIMIT?'TOP '+LEADERBOARD_LIMIT+' OF ':'')+total+' · ONBOARDING STANDINGS',100,h-74);
  ctx.font='500 27px Aeonik, Arial, sans-serif';ctx.fillText(metric==='members'?'RANKED BY MEMBERS ONBOARDED':'RANKED BY % ACTIVE · TIES BY MEMBERS',100,h-27);
  ctx.fillStyle='#EAEDFF';ctx.font='700 27px Aeonik, Arial, sans-serif';ctx.textAlign='right';ctx.fillText('80% TO QUALIFY',w-100,h-27);
}

export function paintLeaderboardRows(ctx,w,h,rows,metric='progress',{rowHeight=ROW_HEIGHT,schoolName='',compact=false}={}){
  const scale=rowHeight/ROW_HEIGHT,fontScale=compact?1:scale;
  ctx.fillStyle='#221D4B';ctx.fillRect(0,0,w,h);ctx.textBaseline='middle';
  rows.forEach((row,i)=>{
    const y=i*rowHeight,first=row.rank===1;
    ctx.fillStyle=first?'#4A36FF':i%2?'#516AF633':'#EAEDFF08';ctx.fillRect(66,y,w-132,148*scale);
    ctx.fillStyle=bannerIdentity(row).primary;ctx.fillRect(66,y,13,148*scale);
    ctx.fillStyle=first?'#EAEDFF':'#EAEDFFB8';ctx.textAlign='left';ctx.font='700 '+(67*fontScale)+'px Aeonik, Arial, sans-serif';ctx.fillText(`#${row.rank}`,107,y+rowHeight/2);
    ctx.fillStyle='#EAEDFF';ctx.font='700 '+(55*fontScale)+'px Aeonik, Arial, sans-serif';ctx.fillText(row.name.toUpperCase(),285,y+(compact?rowHeight/2:54*scale),990);
    ctx.fillStyle='#EAEDFFB8';ctx.font='500 '+(34*fontScale)+'px Aeonik, Arial, sans-serif';if(!compact)ctx.fillText((schoolName?(row.letters||''):(row.shortSchool||row.school||'')).toUpperCase(),285,y+106*scale,990);
    ctx.textAlign='right';ctx.fillStyle='#EAEDFF';ctx.font='500 '+(58*fontScale)+'px Aeonik, Arial, sans-serif';ctx.fillText(metric==='members'?row.joined.toLocaleString():`${row.joined} / ${Math.ceil(row.active*.8)}`,w-328,y+rowHeight/2);
    ctx.fillStyle=first?'#EAEDFF':'#EAEDFF';ctx.font='700 '+((metric==='members'?58:75)*fontScale)+'px Aeonik, Arial, sans-serif';ctx.fillText(`${Math.round(row.progress*100)}%`,w-111,y+rowHeight/2);
  });
}

// Original symbol, centered with clear space; no outline, glow or distortion.
export function paintLeaderboardGraffiti(ctx,w,h){
 ctx.fillStyle='#221D4B';ctx.fillRect(0,0,w,h);
 ctx.save();const scale=Math.min(w*.65/82,h*.65/51.2823);
 ctx.translate(w/2,h/2);ctx.scale(scale,scale);ctx.translate(-50,-50);ctx.fillStyle='#EAEDFF';
 for(const path of FOMO_MARK_PATHS)ctx.fill(new Path2D(path));ctx.restore();
}
