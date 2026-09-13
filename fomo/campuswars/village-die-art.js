import {hash} from './village-district-layout.js?v=77';
import {FOMO_MARK_PATHS} from './village-floor-logo.js?v=37';

// One sheet of plywood art serves every die table in the village: houses tell
// themselves apart by the stain each table is tinted with, so any number of
// them still batch into a single draw call.
// The strip the box sides sample; the paint keeps it clear of stickers.
export const DIE_EDGE_UV={u0:.02,v0:.02,u1:.06,v1:.06};
const STICKER_INK=['#1d2a35','#9a2a2a','#1f4f7a','#0f6b52','#b8862c','#5b2a6b'];
const GREEK=['Σ','Φ','Δ','Ω','Κ','Θ','Λ','Ψ'];

export function paintDieTable(ctx,w,h){
  const sans='Aeonik, Arial Narrow, sans-serif',serif='Georgia, serif';
  ctx.save();ctx.textBaseline='middle';ctx.textAlign='center';ctx.lineJoin='round';
  // Plywood: a warm base, long grain down the eight-foot axis, a few knots.
  ctx.fillStyle='#b98a55';ctx.fillRect(0,0,w,h);
  for(let i=0;i<130;i++){
    const y=hash(i,'grain-y')*h,sweep=.35+hash(i,'grain-s')*.65,x0=hash(i,'grain-x')*w*(1-sweep);
    ctx.strokeStyle=i%3?`rgba(108,72,36,${.07+hash(i,'grain-a')*.13})`:`rgba(232,198,150,${.07+hash(i,'grain-a')*.12})`;
    ctx.lineWidth=1+hash(i,'grain-w')*3.2;ctx.beginPath();
    for(let s=0;s<=6;s++){const x=x0+sweep*w*s/6,dy=Math.sin(s*.9+i)*(2+hash(i,'grain-d')*5);s?ctx.lineTo(x,y+dy):ctx.moveTo(x,y+dy);}
    ctx.stroke();
  }
  for(let i=0;i<5;i++){
    const x=.12*w+hash(i,'knot-x')*w*.76,y=.16*h+hash(i,'knot-y')*h*.68;
    for(let ring=4;ring>0;ring--){
      ctx.strokeStyle=`rgba(108,74,42,${.1+ring*.06})`;ctx.lineWidth=1.6;
      ctx.beginPath();ctx.ellipse(x,y,ring*3.4+2,ring*2.1+1.4,hash(i,'knot-a')*3,0,Math.PI*2);ctx.stroke();
    }
  }
  // Painted half line: the die has to land past it.
  ctx.save();ctx.globalAlpha=.72;ctx.fillStyle='#f2ead8';
  for(let y=0;y<h;y+=18)ctx.fillRect(w/2-4,y,8,13+hash(y,'dash')*4);
  ctx.restore();
  const sticker=(x,y,angle,scale,paint)=>{
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
    ctx.shadowColor='rgba(58,38,18,.45)';ctx.shadowBlur=7;ctx.shadowOffsetY=2;paint();ctx.restore();
  };
  const disc=(r,fill,border='#f7f2e6')=>{ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=border;ctx.fill();ctx.shadowColor='transparent';ctx.beginPath();ctx.arc(0,0,r-4,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();};
  const plate=(rw,rh,fill,border='#f7f2e6')=>{
    const round=(width,height,radius)=>{ctx.beginPath();ctx.roundRect(-width/2,-height/2,width,height,radius);ctx.fill();};
    ctx.fillStyle=border;round(rw,rh,rh*.32);ctx.shadowColor='transparent';ctx.fillStyle=fill;round(rw-8,rh-8,rh*.28);
  };
  const label=(value,size,color,font=sans,weight='700',spacing=1)=>{ctx.letterSpacing=`${spacing}px`;ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=color;ctx.fillText(value,0,1);ctx.letterSpacing='0px';};
  const starPath=(r,fill)=>{ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.44:r;i?ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s):ctx.moveTo(Math.cos(a)*s,Math.sin(a)*s);}ctx.closePath();ctx.fillStyle=fill;ctx.fill();};
  const designs=[
    // A Greek-letter disc, the kind every chapter hands out at rush.
    i=>{const ink=STICKER_INK[Math.floor(hash(i,'ink')*STICKER_INK.length)];disc(34,ink);label(GREEK[Math.floor(hash(i,'letter')*GREEK.length)],40,'#f7f2e6',serif,'700',0);},
    i=>{plate(158,46,'#17202b');label('GREEK WARS',21,'#ffd98a');},
    i=>{plate(124,42,STICKER_INK[Math.floor(hash(i,'ink')*STICKER_INK.length)]);label('EST. 2026',18,'#f7f2e6',sans,'700',2);},
    // Pennant: a felt triangle with two stripes.
    i=>{ctx.fillStyle='#f7f2e6';ctx.beginPath();ctx.moveTo(-62,-24);ctx.lineTo(62,0);ctx.lineTo(-62,24);ctx.closePath();ctx.fill();ctx.shadowColor='transparent';
      ctx.fillStyle=STICKER_INK[Math.floor(hash(i,'ink')*STICKER_INK.length)];ctx.beginPath();ctx.moveTo(-56,-18);ctx.lineTo(46,0);ctx.lineTo(-56,18);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffd98a';ctx.fillRect(-52,-13,7,26);ctx.fillRect(-38,-10,5,20);},
    // Bottle cap, crimped edge and all.
    i=>{ctx.beginPath();for(let s=0;s<44;s++){const a=s/44*Math.PI*2,r=s%2?26:30;s?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();
      ctx.fillStyle=i%2?'#9a2a2a':'#1f4f7a';ctx.fill();ctx.shadowColor='transparent';starPath(13,'#f7f2e6');},
    i=>{disc(32,'#101820');ctx.save();ctx.translate(-20,-20);ctx.scale(.40,.40);ctx.fillStyle='#f7f7f7';for(const path of FOMO_MARK_PATHS)ctx.fill(new Path2D(path));ctx.restore();},
    i=>{starPath(32,'#f7f2e6');ctx.shadowColor='transparent';starPath(25,'#b8862c');},
    // Shield with a house number.
    i=>{ctx.fillStyle='#f7f2e6';ctx.beginPath();ctx.moveTo(-31,-33);ctx.lineTo(31,-33);ctx.lineTo(31,14);ctx.quadraticCurveTo(0,43,-31,14);ctx.closePath();ctx.fill();ctx.shadowColor='transparent';
      ctx.fillStyle='#1d2a35';ctx.beginPath();ctx.moveTo(-25,-27);ctx.lineTo(25,-27);ctx.lineTo(25,11);ctx.quadraticCurveTo(0,34,-25,11);ctx.closePath();ctx.fill();label('#1',27,'#ffd98a',serif,'700',0);},
    i=>{plate(104,40,'#0f6b52');label('SNAPPA',19,'#f7f2e6',sans,'700',3);},
    i=>{plate(116,40,'#9a2a2a');label('BEER DIE',18,'#f7f2e6',sans,'700',2);},
    // The house's own lettering, two Greek characters on a bar.
    i=>{plate(96,48,STICKER_INK[Math.floor(hash(i,'ink')*STICKER_INK.length)]);label(GREEK[Math.floor(hash(i,'g1')*GREEK.length)]+GREEK[Math.floor(hash(i,'g2')*GREEK.length)],30,'#f7f2e6',serif,'700',2);},
    // A worn smiley, the oldest sticker on the sheet.
    i=>{disc(28,'#e8b830');ctx.shadowColor='transparent';ctx.fillStyle='#3a2a10';
      for(const dx of [-9,9]){ctx.beginPath();ctx.arc(dx,-7,3.4,0,Math.PI*2);ctx.fill();}
      ctx.strokeStyle='#3a2a10';ctx.lineWidth=3.4;ctx.beginPath();ctx.arc(0,-1,13,.35,Math.PI-.35);ctx.stroke();},
    // Lightning decal off a beer case.
    i=>{ctx.fillStyle='#f7f2e6';ctx.beginPath();ctx.moveTo(6,-34);ctx.lineTo(-22,4);ctx.lineTo(-4,4);ctx.lineTo(-9,34);ctx.lineTo(22,-8);ctx.lineTo(2,-8);ctx.closePath();ctx.fill();
      ctx.shadowColor='transparent';ctx.fillStyle='#b8862c';ctx.beginPath();ctx.moveTo(4,-27);ctx.lineTo(-16,2);ctx.lineTo(-1,2);ctx.lineTo(-6,26);ctx.lineTo(15,-5);ctx.lineTo(-1,-5);ctx.closePath();ctx.fill();}
  ];
  // Deal the designs from a shuffled deck over a jittered grid: no sheet repeats
  // a sticker until it has used every one, and none of them clump.
  const deck=designs.map((paint,i)=>({paint,order:hash(i,'deal')})).sort((a,b)=>a.order-b.order);
  const columns=7,rows=3;let dealt=0;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const cell=(row*columns+col);
    if(hash(cell,'skip')>.9)continue;
    const cw=w/columns,ch=h/rows;
    const x=cw*(col+.22+hash(cell,'jx')*.56),y=ch*(row+.22+hash(cell,'jy')*.56);
    if(x<.09*w&&y<.15*h)continue;
    if(Math.abs(x-w/2)<30)continue;
    sticker(x,y,(hash(cell,'sr')-.5)*1.6,.62+hash(cell,'ss')*.42,()=>deck[dealt%deck.length].paint(cell));
    dealt++;
  }
  // Cup rings, scratches and dings on top of everything.
  ctx.globalAlpha=.5;
  for(let i=0;i<7;i++){
    const x=(.1+hash(i,'ring-x')*.8)*w,y=(.12+hash(i,'ring-y')*.76)*h;
    ctx.strokeStyle='rgba(92,62,32,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,17+hash(i,'ring-r')*4,0,Math.PI*2);ctx.stroke();
  }
  ctx.globalAlpha=.38;
  for(let i=0;i<70;i++){
    const x=hash(i,'sc-x')*w,y=hash(i,'sc-y')*h,len=6+hash(i,'sc-l')*46,a=(hash(i,'sc-a')-.5)*.9;
    ctx.strokeStyle=i%3?'rgba(233,206,168,.8)':'rgba(96,66,38,.8)';ctx.lineWidth=hash(i,'sc-w')*1.6+.4;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);ctx.stroke();
  }
  ctx.globalAlpha=1;
  // Darken the rim where hands and cups have worn the finish off.
  const edge=ctx.createLinearGradient(0,0,0,h);edge.addColorStop(0,'rgba(74,48,24,.34)');edge.addColorStop(.18,'rgba(74,48,24,0)');edge.addColorStop(.82,'rgba(74,48,24,0)');edge.addColorStop(1,'rgba(74,48,24,.34)');
  ctx.fillStyle=edge;ctx.fillRect(0,0,w,h);
  ctx.restore();
}

export function createDieTableTexture(T){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');paintDieTable(ctx,canvas.width,canvas.height);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;map.minFilter=T.LinearMipmapLinearFilter;
  if(document.fonts)Promise.allSettled([document.fonts.load('700 20px Aeonik'),document.fonts.load('700 38px Georgia')]).then(()=>{
    paintDieTable(ctx,canvas.width,canvas.height);map.needsUpdate=true;document.dispatchEvent(new Event('village:artwork'));
  });
  return map;
}

// Six faces on one small sheet; opposite faces still add up to seven.
export const DIE_FACES=[1,6,2,5,3,4];
export function createDieFaceTexture(T){
  if(typeof document==='undefined')return null;
  const cell=64,canvas=document.createElement('canvas');canvas.width=cell*3;canvas.height=cell*2;
  const ctx=canvas.getContext('2d');
  const spots={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
  for(let value=1;value<=6;value++){
    const col=(value-1)%3,row=Math.floor((value-1)/3),x=col*cell,y=row*cell;
    ctx.fillStyle='#f6f1e2';ctx.fillRect(x,y,cell,cell);
    ctx.fillStyle='rgba(148,132,104,.35)';ctx.fillRect(x,y,cell,3);ctx.fillRect(x,y+cell-3,cell,3);ctx.fillRect(x,y,3,cell);ctx.fillRect(x+cell-3,y,3,cell);
    ctx.fillStyle='#8c1d1d';
    for(const [dx,dy] of spots[value]){ctx.beginPath();ctx.arc(x+cell/2+dx*cell*.26,y+cell/2+dy*cell*.26,cell*.1,0,Math.PI*2);ctx.fill();}
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
}
