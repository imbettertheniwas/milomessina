import {bannerIdentity} from './village-banner-art.js?v=180';
import {FOMO_MARK_PATHS} from './village-floor-logo.js?v=180';

export const LEADERBOARD_LIMIT=10;
export const ROW_HEIGHT=230;
export const ROWS_TOP=615;
export const ROWS_HEIGHT=1150;
const BG='#070610',WHITE='#f5f5f7',MUTED='#777680';
function text(ctx,value,x,y,size,color=WHITE,weight=500,max){ctx.fillStyle=color;ctx.font=`${weight} ${size}px Aeonik, Arial, sans-serif`;ctx.fillText(value,x,y,max);}
function pill(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
export function paintLeaderboardFrame(ctx,w,h,count,metric='members'){
 ctx.fillStyle=BG;ctx.fillRect(0,0,w,h);ctx.textAlign='left';ctx.textBaseline='middle';
 text(ctx,'9:41',90,91,37,WHITE,700);
 for(let i=0;i<4;i++)pill(ctx,760+i*13,101-i*7,9,13+i*7,3,WHITE);
 ctx.strokeStyle=WHITE;ctx.lineWidth=6;ctx.beginPath();ctx.arc(850,97,23,Math.PI*1.23,Math.PI*1.77);ctx.stroke();ctx.beginPath();ctx.arc(850,97,12,Math.PI*1.2,Math.PI*1.8);ctx.stroke();pill(ctx,846,96,8,7,4,WHITE);
 pill(ctx,897,75,54,28,8,MUTED);pill(ctx,901,79,43,20,4,WHITE);pill(ctx,954,84,4,10,2,MUTED);
 ctx.strokeStyle=MUTED;ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(98,205);ctx.lineTo(82,222);ctx.lineTo(98,239);ctx.stroke();
 text(ctx,'Chapters',58,336,65,WHITE,700);pill(ctx,686,302,102,62,20,'#1b1a24');text(ctx,'24h',704,334,34,WHITE,700);text(ctx,'7d',812,334,34,MUTED,700);text(ctx,'30d',891,334,34,MUTED,700);
 text(ctx,'The top chapters in Greek Village — ranked',62,437,30,MUTED);
 text(ctx,metric==='members'?'by members who have joined FOMO.':'by the percentage of members on FOMO.',62,478,30,MUTED);
 if(!count){text(ctx,'Your chapter could be first',100,950,45);}
 text(ctx,`Top ${Math.min(10,count)} chapters`,62,1860,27,MUTED);
 ctx.strokeStyle='#24232d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(45,1910);ctx.lineTo(955,1910);ctx.stroke();
 const centers=[145,325,505,685,865];
 for(let i=0;i<5;i++){const x=centers[i];ctx.strokeStyle=MUTED;ctx.fillStyle=MUTED;ctx.lineWidth=5;ctx.beginPath();if(i===0){ctx.moveTo(x-21,1970);ctx.lineTo(x,1950);ctx.lineTo(x+21,1970);ctx.lineTo(x+21,2000);ctx.lineTo(x-21,2000);ctx.closePath();ctx.stroke();}else if(i===1){ctx.arc(x-5,1971,17,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x+8,1985);ctx.lineTo(x+24,2001);ctx.stroke();}else if(i===2){ctx.save();const scale=.42;ctx.translate(x-44,1975);ctx.scale(scale,scale);ctx.translate(-50,-50);ctx.fillStyle=WHITE;for(const path of FOMO_MARK_PATHS)ctx.fill(new Path2D(path));ctx.restore();text(ctx,'fomo',x-6,1976,24,WHITE,700);}else if(i===3){pill(ctx,x-52,1940,104,73,35,'#292631');ctx.fillStyle=WHITE;ctx.beginPath();ctx.arc(x-8,1963,10,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+16,1968,8,0,Math.PI*2);ctx.fill();pill(ctx,x-26,1979,37,22,10,WHITE);pill(ctx,x+10,1982,22,19,8,WHITE);}else{ctx.fillStyle='#272334';ctx.arc(x,1976,25,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b7aacd';ctx.beginPath();ctx.arc(x,1969,8,0,Math.PI*2);ctx.fill();pill(ctx,x-14,1980,28,13,7,'#b7aacd');}}
 pill(ctx,340,2094,320,10,5,WHITE);ctx.textAlign='left';
}
export function paintLeaderboardRows(ctx,w,h,rows,metric='members',{rowHeight=ROW_HEIGHT,compact=false}={}){
 ctx.fillStyle=BG;ctx.fillRect(0,0,w,h);ctx.textBaseline='middle';
 rows.forEach((row,i)=>{const y=i*rowHeight+rowHeight/2,identity=bannerIdentity(row),s=compact?.68:1;
 ctx.save();ctx.translate(0,y);ctx.scale(1,s);ctx.textAlign='center';
 if(row.rank<=3){const colors=['#efbd48','#bfc0c5','#c78951'];ctx.strokeStyle=colors[row.rank-1];ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(71,7);ctx.lineTo(71,41);ctx.lineTo(88,32);ctx.lineTo(105,41);ctx.lineTo(105,7);ctx.stroke();ctx.fillStyle=colors[row.rank-1];ctx.beginPath();ctx.arc(88,-6,26,0,Math.PI*2);ctx.fill();text(ctx,String(row.rank),88,-5,32,'#18121a',700);}else text(ctx,`${row.rank}.`,88,0,38,MUTED,700);
 pill(ctx,150,-52,104,104,26,identity.primary);text(ctx,(row.letters||row.name.split(' ').map(v=>v[0]).join('')).slice(0,5),202,1,30,identity.secondary||WHITE,700,95);
 ctx.textAlign='left';text(ctx,row.name,276,-27,37,WHITE,500,530);text(ctx,row.shortSchool||row.school||'',278,14,25,MUTED,500,525);
 ctx.fillStyle=MUTED;ctx.beginPath();ctx.arc(287,52,6,0,Math.PI*2);ctx.fill();pill(ctx,277,61,21,11,5,MUTED);text(ctx,`${row.joined.toLocaleString()} members`,309,60,27,MUTED);
 // School identity replaces private member portraits while retaining the app's avatar stack.
 for(let j=2;j>=0;j--){const x=873+j*24;ctx.fillStyle=j===1?'#4a36ff':identity.primary;ctx.strokeStyle=BG;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,1,22,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.textAlign='center';text(ctx,(row.shortSchool||row.school||'F').split(' ').map(v=>v[0]).join('').slice(0,3),873,2,15,WHITE,700);ctx.restore();
 });
}

// Original symbol, centered with clear space; no outline, glow or distortion.
export function paintLeaderboardGraffiti(ctx,w,h){
 ctx.fillStyle='#221D4B';ctx.fillRect(0,0,w,h);
 ctx.save();const scale=Math.min(w*.65/82,h*.65/51.2823);
 ctx.translate(w/2,h/2);ctx.scale(scale,scale);ctx.translate(-50,-50);ctx.fillStyle='#EAEDFF';
 for(const path of FOMO_MARK_PATHS)ctx.fill(new Path2D(path));ctx.restore();
}
