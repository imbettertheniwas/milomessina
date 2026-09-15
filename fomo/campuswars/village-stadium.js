import {hash} from './village-district-layout.js?v=80';
import {footballState,footballPlayer,footballBall} from './village-football.js?v=88';
import {createStadiumFireworks} from './village-stadium-fireworks.js?v=1';
import {FOMO_MARK_PATHS} from './village-floor-logo.js?v=36';

export const STADIUM_SITE={x:0,z:200,width:82,depth:84};
export function createStadium(T,extension=0){
  const root=new T.Group();root.name='Greek Village Memorial Stadium';root.position.set(0,0,STADIUM_SITE.z+extension);
  const resources=new Set(),batches=new Map(),materials=new Map(),dummy=new T.Object3D(),color=new T.Color();
  const own=r=>(resources.add(r),r);
  const awayBlack=0x111111;
  function drawFomoEyes(c,x,y,height,aspect=1){
    c.save();c.translate(x,y);c.scale(height/51.2823*aspect,height/51.2823);c.translate(-50,-50);c.fillStyle='#ffffff';
    for(const path of FOMO_MARK_PATHS)c.fill(new Path2D(path));
    c.restore();
  }
  const cube=own(new T.BoxGeometry(1,1,1)),sphere=own(new T.SphereGeometry(1,10,7)),tube=own(new T.CylinderGeometry(1,1,1,10));
  function material(hex,kind='concrete'){
    const key=`${hex}:${kind}`;
    if(!materials.has(key))materials.set(key,own(new T.MeshStandardMaterial({color:hex,roughness:kind==='metal'?.38:.91,metalness:kind==='metal'?.55:0,...(kind==='light'?{emissive:hex,emissiveIntensity:.4}:{})})));
    return materials.get(key);
  }
  function part(geometry,x,y,z,sx,sy,sz,hex,kind='concrete',rotation=0){
    const mat=typeof hex==='object'?hex:material(hex,kind),key=`${geometry.uuid}:${kind}:${mat.emissive?.getHex()}:${mat.emissiveIntensity}`;
    if(!batches.has(key))batches.set(key,{geometry,material:mat,items:[]});
    dummy.position.set(x,y,z);dummy.rotation.set(0,rotation,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
    const item={matrix:dummy.matrix.clone(),color:mat.color.clone()};batches.get(key).items.push(item);return item;
  }
  const box=(x,y,z,w,h,d,c,k='concrete',a=0)=>part(cube,x,y,z,w,h,d,c,k,a);
  function bar(a,b,r,c=0x69757b){
    const v=new T.Vector3(...b).sub(new T.Vector3(...a));
    const item=part(tube,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,v.length(),r,c,'metal');
    item.matrix.compose(new T.Vector3().addVectors(new T.Vector3(...a),new T.Vector3(...b)).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()),new T.Vector3(r,new T.Vector3(...a).distanceTo(new T.Vector3(...b)),r));
  }
  function canvasMap(width,height,paint){
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'),width,height);
    const map=own(new T.CanvasTexture(canvas));map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return map;
  }
  function panel(text,x,y,z,w,h,rotation=0,bg='#10283b',ink='#faf0d8'){
    const map=canvasMap(1024,128,(c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.fillStyle=ink;c.font='bold 62px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,W/2,H/2,W-36);});
    const mesh=new T.Mesh(own(new T.PlaneGeometry(w,h)),own(new T.MeshStandardMaterial({color:map?0xffffff:0x16394c,map,roughness:.7,side:T.DoubleSide})));
    mesh.position.set(x,y,z);mesh.rotation.y=rotation;root.add(mesh);return mesh;
  }
  // One opaque forecourt masks the underlying campus paths. The stadium stays
  // inside its reserved block, clear of the roads at z=150 and z=250.
  box(0,.16,0,82,.22,84,0xb2afa3);
  box(0,.30,0,72,.18,77,0x525d60);
  box(0,.41,0,30,.15,63,0xd0d0bf);
  const fieldMap=canvasMap(1024,2048,(c,W,H)=>{
    const x=n=>(n/26.667+.5)*W,z=n=>(n/60+.5)*H;
    c.fillStyle='#316541';c.fillRect(0,0,W,H);
    for(let n=-25;n<25;n+=2.5){c.fillStyle=Math.round(n/2.5)%2?'#3f7948':'#396e40';c.fillRect(0,z(n),W,z(2.5)-z(0));}
    for(let i=0;i<90000;i++){const shade=hash(i,'turf');c.fillStyle=shade>.5?'#dddc9821':'#052e2028';c.fillRect(hash(i,'tx')*W,hash(i,'tz')*H,1,2+shade*4);}
    for(const end of [-1,1]){
      c.fillStyle=end<0?'#4048a8':'#111111';c.fillRect(0,z(end<0?-30:25),W,H/12);
      c.save();c.translate(W/2,z(end*27.5));
      if(end>0){c.rotate(Math.PI);drawFomoEyes(c,0,0,H/12*.76,(W/26.667)/(H/60));}
      else{c.fillStyle='#efe9d6';c.font='900 144px Arial';c.textAlign='center';c.textBaseline='middle';c.scale(1.55,1);c.fillText('fomo',0,0,W*.92/1.55);}
      c.restore();
    }
    c.strokeStyle='#eeeede';c.lineWidth=3;c.strokeRect(2,2,W-4,H-4);
    for(let yard=0;yard<=100;yard+=5){const zz=-25+yard*.5;c.beginPath();c.moveTo(0,z(zz));c.lineTo(W,z(zz));c.stroke();}
    c.lineWidth=2;
    for(let yard=1;yard<100;yard++){if(yard%5===0)continue;for(const xx of [-12.8,-3.1,3.1,12.8]){c.beginPath();c.moveTo(x(xx-.24),z(-25+yard*.5));c.lineTo(x(xx+.24),z(-25+yard*.5));c.stroke();}}
    for(let yard=10;yard<100;yard+=10)for(const side of [-1,1]){c.save();c.translate(x(side*9.8),z(-25+yard*.5));c.rotate(side*Math.PI/2);c.fillStyle='#eeedde';c.font='bold 43px Arial';c.textAlign='center';c.fillText(String(Math.min(yard,100-yard)),0,14);c.restore();}
    c.save();c.translate(W/2,H/2);c.rotate(Math.PI/2);c.fillStyle='#173b50';c.strokeStyle='#ede1bf';c.lineWidth=6;c.beginPath();c.moveTo(-100,0);c.lineTo(0,-80);c.lineTo(100,0);c.lineTo(0,80);c.closePath();c.fill();c.stroke();c.fillStyle='#f6eed6';c.font='900 69px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText('GV',0,4);c.restore();
  });
  const field=new T.Mesh(own(new T.PlaneGeometry(26.667,60)),own(new T.MeshStandardMaterial({color:fieldMap?0xffffff:0x376f42,map:fieldMap,roughness:1})));
  field.rotation.x=-Math.PI/2;field.position.y=.505;field.receiveShadow=true;field.name='100-yard-field-with-end-zones';root.add(field);

  // Continuous tiered concrete bowl: lower seating, concourse, upper seating.
  const fans=[];
  for(const side of [-1,1]){
    for(let row=0;row<16;row++){
      const upper=row>=9,gap=upper?1.7:0,depth=17+row*.82+gap,y=1.2+row*.47+(upper?.55:0);
      box(side*depth,y/2,0,.84,y,64,0xa4a59f);
      for(let seat=0;seat<78;seat++){
        if(seat%13===0||seat%13===12)continue;
        const z=(seat-38.5)*.8;
        fans.push({x:side*depth,y:y+.08,z,angle:-side*Math.PI/2,team:side>0?0:1,row,section:seat/13|0});
      }
    }
    for(let row=0;row<10;row++){
      const depth=32.8+row*.8,y=1.2+row*.47;
      box(0,y/2,side*depth,34,y,.82,0xaaa9a0);
      for(let seat=0;seat<40;seat++){
        if(seat%10===0||seat%10===9||Math.abs(seat-19.5)<2&&row<5)continue;
        fans.push({x:(seat-19.5)*.8,y:y+.08,z:side*depth,angle:side>0?Math.PI:0,team:seat%2,row,section:seat/10|0});
      }
    }
    // Aisle handrails, entrances, structural piers and a glazed press box.
    for(let aisle=0;aisle<=6;aisle++){
      const z=-31.2+aisle*10.4;
      for(let row=0;row<16;row++){
        const d=17+row*.82+(row>=9?1.7:0),y=1.2+row*.47+(row>=9?.55:0);
        box(side*d,y+.07,z,.76,.1,.12,0xe8d5a2);
        if(row%3===0)bar([side*d,y,z],[side*d,y+.95,z],.035);
        if(row<15){const nd=17+(row+1)*.82+(row+1>=9?1.7:0),ny=1.2+(row+1)*.47+(row+1>=9?.55:0);bar([side*d,y+.95,z],[side*nd,ny+.95,z],.035);}
      }
    }
    box(side*33,7.95,0,3.5,.35,65,0xc3c0b2);
    for(let z=-30;z<=30;z+=5){box(side*33,3.8,z,.65,7.6,.65,0xb9b6aa);bar([side*34.4,8.1,z],[side*34.4,9.2,z],.045);}
    bar([side*34.4,9.2,-32],[side*34.4,9.2,32],.05);
    box(side*33,9.8,0,3,3.4,37,0xd7d5c8);
    box(side*31.43,9.9,0,.06,2,36,0x334e60,'metal');
    for(let z=-17;z<19;z+=2.5)box(side*31.36,9.9,z,.1,2.1,.075,0xa5b2b3,'metal');
    box(side*32.5,11.65,0,5.2,.35,40,0xe2dfd3);
    box(side*34,2.1,34,4,3.7,8,0x8e7264);
    panel(side<0?'HOME GATE • 01':'VISITOR GATE • 02',side*34,3.5,38.04,4,.6);
    for(const z of [-20,20]){
      box(side*36.5,1.4,z,3,2.6,7,0x7d6656);
      panel(z<0?'CONCESSIONS':'TEAM STORE',side*36.5,2.3,z+3.53,3,.45);
    }
    // Bowl fascia with ribbons, section plaques and advertising boards.
    box(side*16.3,1.1,0,.24,1.3,64,0x102e43);
    for(let section=0;section<6;section++)panel(`MEMORIAL  /  ${101+section+(side>0?6:0)}`,side*16.15,1.2,-26+section*10.4,8,.55,-side*Math.PI/2);
    // Goalposts with padded gooseneck support, crossbar and two uprights.
    bar([0,.5,side*31],[0,2.2,side*31],.11,0xefc74d);
    bar([0,2.2,side*31],[0,3.55,side*29.9],.1,0xefc74d);
    bar([-1.54,3.55,side*29.9],[1.54,3.55,side*29.9],.075,0xf5d453);
    for(const x of [-1.54,1.54])bar([x,3.55,side*29.9],[x,7.4,side*29.9],.065,0xf5d453);
    box(0,1.1,side*31,.45,1.25,.45,0x163a53);
    for(const x of [-13.2,13.2])for(const z of [25,30])box(x,.7,side*z,.16,.4,.16,0xff772b);
    for(const z of [-7,3,13]){box(side*14.8,.9,z,.6,.18,5,0xd8dce0,'metal');box(side*14.8,.65,z,.1,.5,4.5,0x687579,'metal');}
    box(side*14.8,1.1,-14,.65,.8,1.2,0xe66932);box(side*14.8,1.54,-14,.72,.1,1.28,0xeeeece);
  }
  panel('GREEK VILLAGE  •  MEMORIAL STADIUM',0,6.6,-40.65,27,1.2,Math.PI);
  box(0,6.6,-40.5,29,1.7,.35,0x173449);
  for(const x of [-14,14])box(x,3.5,-40.5,.8,6,.8,0xa8a398);
  // Four light towers, each a real bank of luminaires on a braced steel mast.
  for(const x of [-36.5,36.5])for(const z of [-31,31]){
    bar([x,0,z],[x,23,z],.19,0x8e999c);
    box(x,23,z,6.8,2,.5,0x45535c,'metal');
    for(let i=0;i<6;i++)for(let j=0;j<2;j++)box(x-2.8+i*1.12,22.5+j,z-Math.sign(z)*.29,.86,.69,.1,0xffefd5,'light');
    bar([x-3,22,z],[x,19,z],.06);bar([x+3,22,z],[x,19,z],.06);
    // Soft field illumination is local to this district; no shadow-map passes.
  }
  const flood=new T.PointLight(0xe5efff,0,95,0);flood.position.set(0,20,0);root.add(flood);

  // Combine a seated spectator's anatomy into one geometry and one instance.
  // Arm identifiers let the GPU raise and wave arms without CPU instance uploads.
  function merged(parts){
    const positions=[],normals=[],colors=[],limbs=[];
    for(const [geometry,pos,scale,tint,limb=0] of parts){
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.scale(...scale);g.translate(...pos);
      const p=g.getAttribute('position'),n=g.getAttribute('normal'),c=new T.Color(tint);
      for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(c.r,c.g,c.b);limbs.push(limb);}g.dispose();
    }
    const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('cheerLimb',new T.Float32BufferAttribute(limbs,1));return g;
  }
  const fanSphere=own(new T.SphereGeometry(1,6,4)),fanTorso=own(new T.CylinderGeometry(.85,1,1,6));
  const fanGeometry=merged([
    [fanTorso,[0,.48,0],[.18,.44,.13],0xffffff],
    [fanSphere,[0,.84,0],[.115,.14,.115],0xe1b18a],
    [fanSphere,[0,.92,-.015],[.12,.06,.115],0x463830],
    ...[-1,1].flatMap(s=>[[cube,[s*.1,.15,.08],[.115,.3,.16],0x3c4554],[cube,[s*.1,.035,.16],[.12,.08,.23],0xdedecf],[cube,[s*.23,.53,0],[.1,.39,.11],0xffffff,s],[fanSphere,[s*.23,.29,0],[.065,.07,.065],0xe1b18a,s]])
  ]);
  const crowdUniforms={stadiumTime:{value:0},stadiumRoar:{value:0}};
  const fanMaterial=own(new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.95}));
  fanMaterial.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,crowdUniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float cheerLimb; attribute vec2 fanPhase; uniform float stadiumTime; uniform float stadiumRoar;');
    shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nif(color.r < .99 || color.g < .99 || color.b < .99) vColor.rgb = color * (.64 + fanPhase.y * .18);');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float beat=stadiumTime*(2.6+fanPhase.y)+fanPhase.x;
      float jump=max(0.0,sin(beat))* (0.06+stadiumRoar*0.13);
      if(abs(cheerLimb)>.5){
        float a=cheerLimb*(2.15+sin(beat*.8)*.55+stadiumRoar*.3);
        vec2 pivot=vec2(cheerLimb*.20,.69);
        vec2 arm=transformed.xy-pivot;
        transformed.xy=mat2(cos(a),sin(a),-sin(a),cos(a))*arm+pivot;
      }
      transformed.y+=jump;
      transformed.x+=sin(beat*.47)*.035*transformed.y;`);
  };
  fanMaterial.customProgramCacheKey=()=> 'stadium-cheering-v1';
  const fanMesh=own(new T.InstancedMesh(fanGeometry,fanMaterial,fans.length));fanMesh.name='cheering-stadium-fans';
  const phases=new Float32Array(fans.length*2);
  const seatGeometry=merged([[cube,[0,.22,0],[.48,.07,.45],0xffffff],[cube,[0,.46,-.2],[.46,.43,.055],0xffffff]]);
  fans.forEach((f,i)=>{
    dummy.position.set(f.x,f.y,f.z);dummy.rotation.set(0,f.angle,0);dummy.scale.setScalar(.86+hash(i,'fan-height')*.22);dummy.updateMatrix();fanMesh.setMatrixAt(i,dummy.matrix);
    color.setHex(hash(i,'fan-shirt')>.27?(f.team?awayBlack:0x626cf3):hash(i,'white-shirt')>.4?0xece3cf:0xd9b35a);fanMesh.setColorAt(i,color);
    phases[i*2]=hash(i,'cheer-phase')*Math.PI*2;phases[i*2+1]=hash(i,'cheer-speed')*2;
    part(seatGeometry,f.x,f.y,f.z,1,1,1,f.team?awayBlack:0x454da9,'seat',f.angle);
  });
  fanGeometry.setAttribute('fanPhase',new T.InstancedBufferAttribute(phases,2));fanMesh.boundingSphere=new T.Sphere(new T.Vector3(0,5,0),56);root.add(fanMesh);

  // One articulated player batch: helmets, pads, striped pants and moving limbs.
  const paddedBody=own(new T.CapsuleGeometry(.5,1,2,8));paddedBody.scale(1,.5,1);
  const playerParts=own(new T.InstancedMesh(paddedBody,own(new T.MeshStandardMaterial({color:0xffffff,roughness:.65})),22*12));
  playerParts.name='football-players';playerParts.instanceMatrix.setUsage(T.DynamicDrawUsage);playerParts.boundingSphere=new T.Sphere(new T.Vector3(0,2,0),66);root.add(playerParts);
  const helmets=own(new T.InstancedMesh(sphere,own(new T.MeshStandardMaterial({color:0xffffff,roughness:.32,metalness:.22})),22));helmets.name='football-helmets';helmets.instanceMatrix.setUsage(T.DynamicDrawUsage);helmets.boundingSphere=playerParts.boundingSphere.clone();root.add(helmets);
  const ball=new T.Mesh(sphere,material(0x7c4225));ball.name='football';ball.scale.set(.13,.13,.23);root.add(ball);
  const ballLaces=new T.Mesh(cube,material(0xf5e8ce));ballLaces.position.set(0,.95,0);ballLaces.scale.set(.25,.08,.6);ball.add(ballLaces);
  // Sideline chain crew markers and officials are separate from registrations.
  for(const z of [-9,-4]){bar([14,.5,z],[14,2,z],.035,0xf17b34);box(14,2,z,.38,.45,.08,0xe78336);}
  panel('1',14,2,-8.94,.28,.3,0,'#211f20','#ffc36a');
  for(const x of [-12,12])for(const z of [-18,18]){
    box(x,1.3,z,.35,.52,.22,0xf0eeea);for(let dx=-.12;dx<.2;dx+=.12)box(x+dx,1.3,z+.115,.045,.52,.012,0x21262d);
    part(sphere,x,1.74,z,.13,.15,.13,0xc99470);box(x,1.88,z,.3,.07,.25,0xf0ede2);
    for(const dx of [-.1,.1])box(x+dx,.85,z,.11,.4,.14,0x242c34);
  }

  let scoreboardCanvas,scoreboardTexture;
  const scoreboardMap=canvasMap(1024,512,(c)=>{scoreboardCanvas=c.canvas;});scoreboardTexture=scoreboardMap;
  const screenMaterial=own(new T.MeshBasicMaterial({color:scoreboardMap?0xffffff:0x153b51,map:scoreboardMap}));
  box(0,13,39.5,23,11,.85,0x263b48,'metal');
  for(const x of [-8,8])box(x,5.5,39.5,.75,11,.75,0x667579,'metal');
  const screen=new T.Mesh(own(new T.PlaneGeometry(21.5,10)),screenMaterial);screen.position.set(0,13,39.02);screen.rotation.y=Math.PI;root.add(screen);
  panel('MEMORIAL STADIUM',0,19,39.02,19,.8,Math.PI);
  const back=panel('GREEK VILLAGE FOOTBALL',0,13,40.01,20,2,0);back.name='stadium-exterior-sign';
  function drawScoreboard(state){
    if(!scoreboardCanvas)return;
    const c=scoreboardCanvas.getContext('2d'),W=1024;
    c.fillStyle='#081826';c.fillRect(0,0,W,512);
    c.fillStyle='#dcad60';c.fillRect(0,0,W,8);c.font='bold 32px Arial';c.textAlign='center';c.fillText('GREEK VILLAGE  /  EXHIBITION',512,57);
    c.fillStyle='#626cf3';c.fillRect(30,86,440,208);c.fillStyle='#111111';c.fillRect(554,86,440,208);
    drawFomoEyes(c,774,120,38);
    c.fillStyle='#f6edda';c.font='bold 34px Arial';c.fillText('FOMO',250,132);c.fillText('v',512,132);
    c.font='bold 130px Arial';c.fillText(String(state.home),250,266);c.fillText(String(state.away),774,266);
    c.font='bold 48px monospace';c.fillText(`Q${state.quarter}   ${state.clock}`,512,361);
    c.fillStyle=state.celebration?'#f5c769':'#a8c5cf';c.font='bold 43px Arial';c.fillText(state.celebration?'TOUCHDOWN!':state.phase==='RESET'?'NEXT POSSESSION':state.phase==='SET'?'1ST & 10  •  READY TO PLAY':state.phase==='PASS'?'PASS IN THE AIR':'MAKE SOME NOISE',512,435);
    c.fillStyle='#547486';c.font='22px Arial';c.fillText('MEMORIAL STADIUM  •  HOME OF THE VILLAGE',512,484);scoreboardTexture.needsUpdate=true;
  }
  // Static architecture shares a handful of geometry/material draw calls.
  for(const [key,b] of batches){
    const mat=own(b.material.clone());mat.color.set(0xffffff);
    const mesh=own(new T.InstancedMesh(b.geometry,mat,b.items.length));mesh.name=`stadium-architecture-${key.split(':')[1]}`;
    b.items.forEach((item,i)=>{mesh.setMatrixAt(i,item.matrix);mesh.setColorAt(i,item.color);});mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  const fireworks=createStadiumFireworks(T);root.add(fireworks.root);
  const bounds=new T.Sphere(new T.Vector3(0,8,STADIUM_SITE.z+extension),64);
  let lastTime=NaN,lastBoard='',night=false;
  function animate(time){
    if(time===lastTime)return;lastTime=time;const state=footballState(time);
    fireworks.animate(time);
    crowdUniforms.stadiumTime.value=time;crowdUniforms.stadiumRoar.value=state.celebration;
    for(let i=0;i<22;i++){
      const p=footballPlayer(i,time),stride=p.running?Math.sin(time*10+i)*.55:0,jersey=p.team?awayBlack:0x626cf3;
      const pieces=[
        [0,1.05,0,.56,.5,.33,jersey],[0,.76,0,.4,.14,.28,p.team?0x242424:0xe9decc],
        [-.14,.52,stride*.2,.15,.4,.19,p.team?awayBlack:0xe1d8c1],[.14,.52,-stride*.2,.15,.4,.19,p.team?awayBlack:0xe1d8c1],
        [-.14,.22,stride*.33,.13,.24,.15,p.team?0x242424:0xe8e1d0],[.14,.22,-stride*.33,.13,.24,.15,p.team?0x242424:0xe8e1d0],
        [-.14,.07,stride*.4+.05,.17,.12,.3,0x24313a],[.14,.07,-stride*.4+.05,.17,.12,.3,0x24313a],
        [-.36,p.celebrating?1.55:1.02,-stride*.3,.14,.4,.17,jersey],[.36,p.celebrating?1.55:1.02,stride*.3,.14,.4,.17,jersey],
        [0,1.19,.179,.08,.22,.015,0xf9f0d8],[0,1.42,.17,.3,.045,.1,0xc0c5c6]
      ];
      const angle=p.running?p.angle:(state.direction<0?Math.PI:0),s=Math.sin(angle),c=Math.cos(angle);
      pieces.forEach(([x,y,z,w,h,d,hex],j)=>{
        const bodyScale=.76,limb=j>=2&&j<=5?stride*(j%2?-1:1):j===8||j===9?stride*(j%2?1:-1):0;
        dummy.position.set(p.x+(x*c+z*s)*bodyScale,.505+y*bodyScale+(p.running?Math.abs(stride)*.035:0),p.z+(z*c-x*s)*bodyScale);dummy.rotation.set(limb,angle,0,'YXZ');dummy.scale.set(w*bodyScale,h*bodyScale,d*bodyScale);dummy.updateMatrix();playerParts.setMatrixAt(i*12+j,dummy.matrix);playerParts.setColorAt(i*12+j,color.setHex(hex));
      });
      dummy.position.set(p.x,.505+1.56*.76,p.z);dummy.rotation.set(0,angle,0);dummy.scale.set(.23*.76,.25*.76,.24*.76);dummy.updateMatrix();helmets.setMatrixAt(i,dummy.matrix);helmets.setColorAt(i,color.setHex(p.team?awayBlack:0x626cf3));
    }
    playerParts.instanceMatrix.needsUpdate=true;playerParts.instanceColor.needsUpdate=true;helmets.instanceMatrix.needsUpdate=true;helmets.instanceColor.needsUpdate=true;
    const b=footballBall(time);ball.position.set(b.x,.505+b.y,b.z);ball.rotation.set(time*5,0,Math.PI/5);ball.updateMatrix();
    const boardKey=`${state.play}:${state.phase}:${state.clock}`;if(boardKey!==lastBoard){lastBoard=boardKey;drawScoreboard(state);}
  }
  function setNight(enabled){night=Boolean(enabled);flood.intensity=night?2.8:0;fireworks.setEnabled(night,Number.isFinite(lastTime)?lastTime:0);bounds.center.y=night?25:8;bounds.radius=night?82:64;for(const b of root.children)if(b.material?.emissive?.getHex()===0xffefd5)b.material.emissiveIntensity=night?3.5:.4;}
  animate(0);root.updateMatrixWorld(true);
  return {root,bounds,fanCount:fans.length,fanMesh,playerParts,helmets,ball,crowdUniforms,animate,setNight,get night(){return night;},dispose(){fireworks.dispose();for(const resource of resources)resource.dispose();root.removeFromParent();}};
}
