import {bannerIdentity} from './village-banner-art.js?v=105';
import {FOMO_MARK_PATHS} from './village-floor-logo.js?v=79';

export const LEADERBOARD_LIMIT=10;
export const ROW_HEIGHT=166;
export const ROWS_TOP=382;
export const ROWS_HEIGHT=830;

export function paintLeaderboardFrame(ctx,w,h,count){
  ctx.fillStyle='#101D29';ctx.fillRect(0,0,w,h);ctx.textBaseline='middle';ctx.textAlign='left';
  ctx.fillStyle='#E9C873';ctx.fillRect(0,0,w,12);ctx.font='700 47px Aeonik, Arial, sans-serif';ctx.fillText('FOMO / GREEK WARS',100,91);
  ctx.fillStyle='#FFFFFF';ctx.font='700 121px Aeonik, Arial, sans-serif';ctx.fillText('LEADERBOARD',100,211);
  ctx.fillStyle='#AFC0CD';ctx.font='500 40px Aeonik, Arial, sans-serif';ctx.fillText('CHAPTER',105,315);
  ctx.textAlign='right';ctx.fillText('80% TARGET',w-327,315);ctx.fillText('% ACTIVE',w-110,315);
  if(!count){ctx.textAlign='center';ctx.font='700 58px Aeonik, Arial, sans-serif';ctx.fillText('YOUR CHAPTER COULD BE FIRST',w/2,740);}
  ctx.textAlign='left';ctx.fillStyle='#AFC0CD';ctx.font='500 32px Aeonik, Arial, sans-serif';
  ctx.fillText(`TOP ${Math.min(LEADERBOARD_LIMIT,count)} OF ${count} CHAPTERS · ONBOARDING STANDINGS`,100,h-74);
  ctx.font='500 27px Aeonik, Arial, sans-serif';ctx.fillText('RANKED BY % ACTIVE · TIES BY MEMBERS',100,h-27);
  ctx.fillStyle='#E9C873';ctx.font='700 27px Aeonik, Arial, sans-serif';ctx.textAlign='right';ctx.fillText('80% TO QUALIFY',w-100,h-27);
}

export function paintLeaderboardRows(ctx,w,h,rows){
  ctx.fillStyle='#101D29';ctx.fillRect(0,0,w,h);ctx.textBaseline='middle';
  rows.forEach((row,i)=>{
    const y=i*ROW_HEIGHT,first=row.rank===1;
    ctx.fillStyle=first?'#263A39':i%2?'#152632':'#12212E';ctx.fillRect(66,y,w-132,148);
    ctx.fillStyle=bannerIdentity(row).primary;ctx.fillRect(66,y,13,148);
    ctx.fillStyle=first?'#E9C873':'#AFC0CD';ctx.textAlign='left';ctx.font='700 67px Aeonik, Arial, sans-serif';ctx.fillText(`#${row.rank}`,107,y+75);
    ctx.fillStyle='#FFFFFF';ctx.font='700 55px Aeonik, Arial, sans-serif';ctx.fillText(row.name.toUpperCase(),285,y+54,990);
    ctx.fillStyle='#ACBDC8';ctx.font='500 34px Aeonik, Arial, sans-serif';ctx.fillText((row.shortSchool||row.school||'').toUpperCase(),285,y+106,990);
    ctx.textAlign='right';ctx.fillStyle='#D0DCE4';ctx.font='500 58px Aeonik, Arial, sans-serif';ctx.fillText(`${row.joined} / ${Math.ceil(row.active*.8)}`,w-328,y+76);
    ctx.fillStyle=first?'#E9C873':'#FFFFFF';ctx.font='700 75px Aeonik, Arial, sans-serif';ctx.fillText(`${Math.round(row.progress*100)}%`,w-111,y+76);
  });
}

// Spray-painted original FOMO eyes: purple overspray and long white drips.
export function paintLeaderboardGraffiti(ctx,w,h){
  ctx.fillStyle='#141320';ctx.fillRect(0,0,w,h);
  let seed=47;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<3600;i++){
    const x=random()*w,y=random()*h,r=random()*3+1;
    ctx.fillStyle=i%3?'#847af318':'#ffffff12';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.save();ctx.translate(w*.5,h*.48);ctx.rotate(-.075);
  const scale=w*.0105;
  ctx.scale(scale,scale);ctx.translate(-50,-50);
  const paths=FOMO_MARK_PATHS.map(path=>new Path2D(path));
  ctx.lineJoin='round';ctx.strokeStyle='#626CF3';ctx.lineWidth=8;ctx.shadowColor='#626CF3';ctx.shadowBlur=35;
  for(const path of paths)ctx.stroke(path);
  ctx.shadowBlur=0;
  ctx.fillStyle='#F5F1E7';for(const path of paths)ctx.fill(path);
  ctx.lineCap='round';
  for(const [x,y,len,width] of [[22,73,14,1.1],[30,74,21,.65],[39,71,10,.8],[59,74,15,1.2],[67,73,23,.7],[78,69,12,.9]]){
    ctx.strokeStyle='#F5F1E7';ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-.6,y+len);ctx.stroke();
  }
  ctx.restore();
}
