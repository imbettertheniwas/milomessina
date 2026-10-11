import {LEADERBOARD_LIMIT,ROW_HEIGHT,ROWS_TOP,ROWS_HEIGHT,paintLeaderboardFrame,paintLeaderboardRows,paintLeaderboardGraffiti} from './village-leaderboard-art.js?v=180';

// These standings use the chapter onboarding totals, not unavailable trading P&L.
export function houseStandings(chapters,metric='progress'){
  const rows=chapters.filter(c=>c.active>0||metric==='members').map(c=>({...c,progress:c.active>0?c.joined/c.active:0}));
  const score=c=>metric==='members'?c.joined:c.progress;
  rows.sort((a,b)=>score(b)-score(a)||b.joined-a.joined||a.id.localeCompare(b.id));
  rows.forEach((row,i)=>{row.rank=i&&score(row)===score(rows[i-1])&&row.joined===rows[i-1].joined?rows[i-1].rank:i+1;});
  return rows;
}
function canvasTexture(T,w,h,paint){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');paint(ctx,w,h);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  if(document.fonts)document.fonts.load('700 80px Aeonik').then(()=>{paint(ctx,w,h);map.needsUpdate=true;document.dispatchEvent(new Event('village:artwork'));});
  return map;
}
export function createCompetition(T,chapters,anchors,lightAnchors=anchors,metric='progress',{schoolName=''}={}){
  const root=new T.Group();root.name='village-competition';
  const standings=houseStandings(chapters,metric),leader=standings[0]?.joined>0?standings[0]:null,badges=[];
  for(const row of standings){
    const anchor=anchors.find(a=>a.id===row.id);if(!anchor)continue;
    const first=row.id===leader?.id,medal=row.rank===1?'#516AF6':'#EAEDFF';
    const map=canvasTexture(T,512,256,(ctx,w,h)=>{
      ctx.clearRect(0,0,w,h);ctx.fillStyle=first?'#4A36FF':'#221D4B';ctx.beginPath();ctx.roundRect(16,18,w-32,h-36,44);ctx.fill();
      ctx.strokeStyle=medal;ctx.lineWidth=7;ctx.stroke();ctx.fillStyle='#EAEDFF';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='700 119px Aeonik, Arial, sans-serif';ctx.fillText(`#${row.rank}`,w*.5,h*.43);
      ctx.font='700 28px Aeonik, Arial, sans-serif';ctx.fillText(first?'ROW LEADER':metric==='members'?`${row.joined} MEMBERS`:`${Math.round(row.progress*100)}% ONBOARDED`,w*.5,h*.80);
    });
    const badge=new T.Sprite(new T.SpriteMaterial({map,color:map?0xffffff:medal,transparent:true,depthWrite:false,toneMapped:false}));
    badge.name=`house-rank-${row.id}`;badge.position.set(anchor.lot.x,anchor.point.y+1.9,anchor.lot.z);badge.scale.set(first?4.5:3.7,first?2.25:1.85,1);badge.userData={chapter:row.id,rank:row.rank,metric:metric==='members'?'members':'onboarding-progress',width:first?4.5:3.7};root.add(badge);badges.push(badge);
  }
  let spotlight=null;
  if(leader){
    const anchor=lightAnchors.find(a=>a.id===leader.id);
    if(anchor){
      spotlight=new T.SpotLight(0xffe3a6,360,40,.48,.8,2);spotlight.name='leading-house-spotlight';spotlight.position.set(anchor.lot.x-2,anchor.point.y+9,anchor.lot.z+3);spotlight.target.position.set(anchor.lot.x,4,anchor.lot.z);root.add(spotlight,spotlight.target);
      // A very faint dust-lit shaft makes the spotlight visible in daylight.
      const beamHeight=spotlight.position.y-3,beam=new T.Mesh(new T.CylinderGeometry(.12,6.5,beamHeight,32,1,true),new T.MeshBasicMaterial({color:0xffdfa2,transparent:true,opacity:.025,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));
      beam.name='leader-light-shaft';beam.position.set(anchor.lot.x,3+beamHeight/2,anchor.lot.z);root.add(beam);
    }
  }
  const board=new T.Group();board.name='intersection-leaderboard';board.userData.scope=schoolName||'national';board.position.set(17.5,0,41.8);board.rotation.y=Math.PI+.28;root.add(board);
  // A solid rounded phone: titanium frame, OLED glass, side keys and rear cameras.
  // A small studio-sky map gives curved titanium and glass a real reflection.
  const pixels=new Uint8Array(128*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<128;x++){const horizon=Math.exp(-Math.pow((y/64-.5)*9,2)),softbox=Math.exp(-Math.pow((x/128-.72)*16,2)-Math.pow((y/64-.27)*7,2)),i=(y*128+x)*4;pixels[i]=Math.min(255,70+horizon*130+softbox*155);pixels[i+1]=Math.min(255,83+horizon*130+softbox*150);pixels[i+2]=Math.min(255,97+horizon*120+softbox*140);pixels[i+3]=255;}
  const environment=new T.DataTexture(pixels,128,64);environment.mapping=T.EquirectangularReflectionMapping;environment.colorSpace=T.SRGBColorSpace;environment.needsUpdate=true;
  const metal=new T.MeshPhysicalMaterial({color:0xc3aca0,metalness:.92,roughness:.24,envMap:environment,envMapIntensity:1.4,clearcoat:.3});
  const polished=new T.MeshPhysicalMaterial({color:0xdfd7cb,metalness:1,roughness:.12,envMap:environment,envMapIntensity:1.6});
  const black=new T.MeshPhysicalMaterial({color:0x08090c,metalness:.15,roughness:.18,envMap:environment,clearcoat:1});
  function rounded(w,h,r,depth,material,x,y,z,name){
    const shape=new T.Shape();shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:3,curveSegments:16});geometry.translate(0,0,-depth/2);
    const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;board.add(mesh);return mesh;
  }
  rounded(7.1,15.1,.98,.70,metal,0,7.8,0,'iphone-titanium-frame');
  rounded(7.08,15.08,.97,.035,polished,0,7.8,.358,'iphone-polished-front-rim');
  rounded(7.08,15.08,.97,.035,polished,0,7.8,-.358,'iphone-polished-rear-rim');
  rounded(6.98,14.98,.93,.04,black,0,7.8,.398,'iphone-front-glass');
  const rearMaterial=new T.MeshPhysicalMaterial({color:0xd3c1b1,metalness:.16,roughness:.48,clearcoat:.6,clearcoatRoughness:.3,envMap:environment});
  rounded(6.96,14.96,.9,.04,rearMaterial,0,7.8,-.398,'iphone-rear-glass');
  rounded(2.85,3.05,.6,.19,rearMaterial,1.72,13.35,-.515,'iphone-camera-island');
  function circle(radius,material,x,y,z,name){const mesh=new T.Mesh(new T.CircleGeometry(radius,48),material);mesh.position.set(x,y,z);mesh.rotation.y=Math.PI;mesh.name=name;board.add(mesh);return mesh;}
  for(const [x,y] of [[1.02,14.14],[2.32,13.38],[1.02,12.66]]){
    const lens=new T.Mesh(new T.CylinderGeometry(.55,.55,.26,48),polished);lens.rotation.x=Math.PI/2;lens.position.set(x,y,-.70);lens.name='iphone-camera-lens';board.add(lens);
    circle(.48,black,x,y,-.843,'iphone-lens-gasket');
    circle(.405,new T.MeshPhysicalMaterial({color:0x172337,metalness:.55,roughness:.07,clearcoat:1,envMap:environment,envMapIntensity:1.6}),x,y,-.849,'iphone-optical-glass');
    circle(.265,new T.MeshStandardMaterial({color:0x0a111e,metalness:.6,roughness:.1,envMap:environment}),x,y,-.853,'iphone-inner-lens');
    circle(.13,new T.MeshBasicMaterial({color:0x020307}),x,y,-.857,'iphone-aperture');
    circle(.063,new T.MeshBasicMaterial({color:0x698cae}),x-.13,y+.15,-.86,'iphone-lens-reflection');
  }
  circle(.18,new T.MeshStandardMaterial({color:0xf1e6d1,roughness:.3}),2.36,14.31,-.637,'iphone-flash');
  circle(.15,black,2.36,12.5,-.637,'iphone-lidar');circle(.035,black,2.61,12.77,-.64,'iphone-rear-microphone');
  for(const [x,y,h] of [[-3.585,12.1,.5],[-3.585,10.75,1],[-3.585,9.35,1],[3.585,10.9,1.6],[3.585,5.1,1.2]]){
    rounded(.085,h+.07,.04,.37,black,x,y,0,'iphone-button-recess');rounded(.14,h,.055,.3,metal,x+Math.sign(x)*.025,y,0,'iphone-side-button');
  }
  const antenna=new T.MeshStandardMaterial({color:0x8e877f,roughness:.9});
  for(const x of [-3.565,3.565])for(const y of [2.2,13.45]){const band=new T.Mesh(new T.BoxGeometry(.032,.095,.7),antenna);band.position.set(x,y,0);band.name='iphone-antenna-line';board.add(band);}
  rounded(.82,.15,.065,.025,black,0,.202,0,'iphone-usb-port').rotation.x=Math.PI/2;
  rounded(.54,.034,.015,.025,metal,0,.186,0,'iphone-usb-tongue').rotation.x=Math.PI/2;
  for(const side of [-1,1])for(let i=0;i<6;i++){const hole=circle(.058,black,side*(1.05+i*.235),.202,0,'iphone-speaker-hole');hole.rotation.set(Math.PI/2,0,0);}
  rounded(1.14,.025,.012,.016,black,0,15.194,.4,'iphone-earpiece');
  const topChapters=standings.slice(0,LEADERBOARD_LIMIT);
  const map=canvasTexture(T,1000,2130,(ctx,w,h)=>paintLeaderboardFrame(ctx,w,h,standings.length,metric,{schoolName}));
  const face=new T.Mesh(new T.PlaneGeometry(6.68,14.2284),new T.MeshBasicMaterial({color:map?0xffffff:0x070610,map,toneMapped:false}));
  face.name='leaderboard-display';face.position.set(0,7.8,.451);face.userData.ownedTexture=true;board.add(face);
  // Scroll UV coordinates on a prepainted strip, avoiding canvas uploads per frame.
  const textureRows=Math.max(5,topChapters.length);let compactRows=false;
  const paintRows=(ctx,w,h)=>{const rowHeight=compactRows?ROWS_HEIGHT/topChapters.length:ROW_HEIGHT,scale=compactRows?textureRows/5:1;ctx.save();ctx.scale(1,scale);paintLeaderboardRows(ctx,w,h/scale,topChapters,metric,{rowHeight,schoolName,compact:compactRows});ctx.restore();};
  const rowMap=topChapters.length?canvasTexture(T,1000,textureRows*ROW_HEIGHT,paintRows):null;
  if(rowMap){rowMap.wrapT=T.RepeatWrapping;rowMap.generateMipmaps=false;rowMap.minFilter=T.LinearFilter;}
  const rowFace=new T.Mesh(new T.PlaneGeometry(6.68,14.2284*ROWS_HEIGHT/2130),new T.MeshBasicMaterial({color:rowMap?0xffffff:0x070610,map:rowMap,toneMapped:false}));
  rowFace.name='leaderboard-scrolling-rows';rowFace.position.set(0,7.8+14.2284*(.5-(ROWS_TOP+ROWS_HEIGHT/2)/2130),.456);rowFace.userData.ownedTexture=true;rowFace.visible=topChapters.length>0;board.add(rowFace);
  let scrollStart=0,pausedAt=null,lastScrollTime=0;
  function animate(time,reducedMotion=false){
    lastScrollTime=time;time=Math.max(0,(pausedAt??time)-scrollStart);
    if(!rowMap)return;
    const compact=reducedMotion&&topChapters.length>5;
    if(compact!==compactRows){compactRows=compact;paintRows(rowMap.image.getContext('2d'),rowMap.image.width,rowMap.image.height);rowMap.needsUpdate=true;}
    rowMap.repeat.y=compact?1:5/textureRows;
    rowMap.offset.y=1-rowMap.repeat.y-(reducedMotion||topChapters.length<=5?0:(time/3.2/topChapters.length)%1);
  }
  function setPaused(paused,time=lastScrollTime){if(paused&&pausedAt===null)pausedAt=time;else if(!paused&&pausedAt!==null){scrollStart+=time-pausedAt;pausedAt=null;}}
  function restart(time=lastScrollTime){scrollStart=time;pausedAt=null;animate(time);}
  function chapterAtUV(uv){if(!rowMap||!uv)return null;rowMap.updateMatrix();const point=rowMap.transformUv(uv.clone());return topChapters[Math.floor(point.y*textureRows)]||null;}
  animate(0);
  rounded(1.98,.52,.26,.015,new T.MeshBasicMaterial({color:0x000000}),0,14.26,.48,'iphone-dynamic-island');
  const backMap=canvasTexture(T,512,512,paintLeaderboardGraffiti);
  const back=new T.Mesh(new T.PlaneGeometry(1.8,1.8),new T.MeshBasicMaterial({map:backMap,color:backMap?0xffffff:0x221d4b}));back.name='leaderboard-fomo-graffiti';back.position.set(0,7.8,-.45);back.rotation.y=Math.PI;back.userData.ownedTexture=true;board.add(back);
  const sensor=new T.Mesh(new T.CircleGeometry(.083,32),new T.MeshPhysicalMaterial({color:0x101a28,metalness:.6,roughness:.08,envMap:environment}));sensor.position.set(.67,14.26,.52);sensor.name='iphone-front-camera';board.add(sensor);
  // Subtle edge reflections preserve the contrast of the OLED content.
  const sheen=canvasTexture(T,128,256,(ctx,w,h)=>{const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'rgba(215,231,255,.15)');gradient.addColorStop(.13,'rgba(215,231,255,.018)');gradient.addColorStop(.7,'rgba(255,255,255,0)');gradient.addColorStop(1,'rgba(255,241,220,.07)');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);});
  const reflection=new T.Mesh(new T.PlaneGeometry(6.68,14.2284),new T.MeshBasicMaterial({map:sheen,transparent:true,depthWrite:false,toneMapped:false}));reflection.position.set(0,7.8,.465);reflection.name='iphone-glass-reflection';reflection.raycast=()=>{};reflection.userData.ownedTexture=true;board.add(reflection);
  board.userData.focusHeight=7.8;
  return {root,standings,topChapters,badges,spotlight,board,animate,setPaused,restart,chapterAtUV,leaderId:leader?.id||null};
}
