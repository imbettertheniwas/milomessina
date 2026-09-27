import {createMaybach} from './village-helipad-maybach.js?v=3';
import {createHelipadGuests} from './village-helipad-guests.js?v=2';
import {createHelipadAircraft} from './village-helipad-aircraft.js?v=2';
// Appearance references and modeling notes: helipad-references.md.
// This scenery has its own identities; neither guest is a registered member.
export const HELIPAD_SITE={x:100,z:200,radius:24};
export const HELIPAD_CYCLE=96;
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const between=(t,a,b)=>ease((t-a)/(b-a));

export function helipadState(seconds){
  const t=((seconds%HELIPAD_CYCLE)+HELIPAD_CYCLE)%HELIPAD_CYCLE;
  const carZ=t<9?mix(45,10,between(t,0,9)):t<90?10:mix(10,-45,between(t,90,96));
  const doors=between(t,9,11)*(1-between(t,17,19))+between(t,84,86)*(1-between(t,89,90));
  const cabin=between(t,30,32)*(1-between(t,42,44))+between(t,72,74)*(1-between(t,81,83));
  const lift=between(t,45,51)*(1-between(t,64,71));
  const angle=between(t,51,64)*Math.PI*2;
  const helicopter={x:Math.sin(angle)*24,y:lift*36,z:(Math.cos(angle)-1)*18,heading:angle+(between(t,48,51)-between(t,64,68))*Math.PI/2};
  const rotor=between(t,42,45)*(1-between(t,71,74));
  const guests=[0,1].map(i=>{
    const delay=i*1.4;
    // Both passengers use the pad-side doors. The front passenger waits for
    // the rear passenger at the same rendezvous, clear of the car and skids.
    const seat={x:-12,z:10+(i?-.9:.9)},exit={x:-9.8,z:seat.z},stand={x:-3.8+i*1.25,z:4.6+i*.25},step={x:-1.65,z:.3};
    let a=seat,b=seat,p=0,walking=0,boarded=false,y=.22,heading=Math.PI/2;
    const walk=(from,to,start,end)=>{a=from;b=to;p=between(t,start,end);walking=t>start&&t<end?Math.sin(Math.PI*clamp((t-start)/(end-start))):0;heading=Math.atan2(to.x-from.x,to.z-from.z);};
    if(t<11+delay){boarded=true;}
    else if(t<14+delay)walk(seat,exit,11+delay,14+delay);
    else if(t<23+delay)walk(exit,stand,14+delay,23+delay);
    else if(t<34+delay){a=b=stand;heading=-.35+i*.3;}
    else if(t<38+delay)walk(stand,step,34+delay,38+delay);
    else if(t<40+delay){walk(step,{x:-.4,z:.3},38+delay,40+delay);y+=between(t,38+delay,40+delay)*.7;}
    else if(t<74+delay){boarded=true;a=b={x:-.4,z:.3};}
    else if(t<77+delay){walk({x:-.4,z:.3},step,74+delay,77+delay);y+=(1-p)*.7;}
    else if(t<85+delay)walk(step,exit,77+delay,85+delay);
    else if(t<88+delay)walk(exit,seat,85+delay,88+delay);
    else {boarded=true;}
    return {x:mix(a.x,b.x,p),z:mix(a.z,b.z,p),y,heading,walking,visible:!boarded,gait:t*7.4+i,standing:t>=23+delay&&t<34+delay};
  });
  const phase=t<9?'Arriving in the Maybach':t<18?'Stepping out':t<27?'Walking to the helicopter':t<34?'Rasmr & Orangie':t<43?'All aboard':t<51?'Taking off':t<64?'Over the village':t<74?'Coming in to land':t<90?'Back to the Maybach':'Until next time';
  return {time:t,carZ,doors,cabin,helicopter,rotor,guests,phase};
}

export function createHelipad(T,extension=0){
  const root=new T.Group();root.name='Rasmr & Orangie · helicopter arrival';root.position.set(HELIPAD_SITE.x,0,HELIPAD_SITE.z+extension);
  const resources=new Set(),own=r=>(resources.add(r),r),materials=new Map();let night=false;
  // A small local sky reflection gives polished paint, chrome and glazing a
  // shared outdoor response without another network asset or render pass.
  const skyPixels=new Uint8Array(64*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<64;x++){
    const t=y/31,sky=t<.52,horizon=Math.exp(-Math.pow((t-.49)*13,2));
    const softbox=Math.exp(-Math.pow((x/64-.72)*13,2)-Math.pow((t-.30)*9,2));
    const color=sky?[111+104*horizon,143+78*horizon,174+53*horizon]:[83+79*horizon,87+81*horizon,78+90*horizon];
    const n=(y*64+x)*4;for(let i=0;i<3;i++)skyPixels[n+i]=Math.min(255,color[i]+softbox*70);skyPixels[n+3]=255;
  }
  const environment=own(new T.DataTexture(skyPixels,64,32));environment.colorSpace=T.SRGBColorSpace;environment.mapping=T.EquirectangularReflectionMapping;environment.needsUpdate=true;
  const cube=own(new T.BoxGeometry(1,1,1)),ball=own(new T.SphereGeometry(1,22,14)),cylinder=own(new T.CylinderGeometry(1,1,1,24));
  const shape=new T.Shape();shape.moveTo(-.44,-.44);shape.lineTo(.44,-.44);shape.lineTo(.44,.44);shape.lineTo(-.44,.44);shape.closePath();
  const rounded=own(new T.ExtrudeGeometry(shape,{depth:.88,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:3,steps:1}));rounded.translate(0,0,-.44);
  function mat(color,metal=0,rough=.65){const key=`${color}:${metal}:${rough}`;if(!materials.has(key))materials.set(key,own(new T.MeshStandardMaterial({color,metalness:metal,roughness:rough,...(metal>.2?{envMap:environment,envMapIntensity:.8}:{})})));return materials.get(key);}
  const black=mat(0x15191d,.5,.26),silver=mat(0xaeb9bb,.8,.25),cream=mat(0xd4c8b1,.55,.3),glass=mat(0x203540,.65,.16),rubber=mat(0x171a1b,0,.9),white=mat(0xe9ece7),gold=mat(0xc4a66d,.7,.3),violet=mat(0x7365b9,.4,.35);
  const group=(p,name,x=0,y=0,z=0)=>{const g=new T.Group();g.name=name;g.position.set(x,y,z);p.add(g);return g;};
  function mesh(p,g,m,x,y,z,sx=1,sy=1,sz=1){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.receiveShadow=true;p.add(o);return o;}
  const box=(p,m,x,y,z,w,h,d)=>mesh(p,cube,m,x,y,z,w,h,d);
  const oval=(p,m,x,y,z,w,h,d)=>mesh(p,ball,m,x,y,z,w,h,d);
  const round=(p,m,x,y,z,w,h,d)=>mesh(p,rounded,m,x,y,z,w,h,d);
  function bar(p,m,a,b,r){const v=new T.Vector3(...a),w=new T.Vector3(...b),o=mesh(p,cylinder,m,...v.clone().add(w).multiplyScalar(.5).toArray(),r,v.distanceTo(w),r);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),w.sub(v).normalize());return o;}
  function texture(w,h,paint){if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const map=own(new T.CanvasTexture(c));map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return map;}
  function label(p,text,x,y,z,w,h,color='#f6f2e9',background='#19232c',sprite=false){
    const map=texture(1024,256,(c,W,H)=>{c.fillStyle=background;c.fillRect(0,0,W,H);c.fillStyle=color;c.font='700 92px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,W/2,H/2,W-60);});
    const material=own(sprite?new T.SpriteMaterial({map,color:map?0xffffff:0xeeeeee,depthTest:true}):new T.MeshStandardMaterial({map,color:map?0xffffff:0xeeeeee,roughness:.75}));
    const o=sprite?new T.Sprite(material):new T.Mesh(own(new T.PlaneGeometry(1,1)),material);o.position.set(x,y,z);o.scale.set(w,h,1);p.add(o);return o;
  }
  // Compact paved apron, connected to the existing road at the front of this block.
  const fixed=group(root,'helipad-apron');
  box(fixed,mat(0xaaa69c),-3,.10,1,38,.2,38);
  box(fixed,mat(0x505a5a),-12,.215,3,5.8,.025,94);
  const pad=mesh(fixed,own(new T.CylinderGeometry(9.5,9.7,.18,64)),mat(0x39464a),0,.22,0);
  const ring=mesh(fixed,own(new T.RingGeometry(8.1,8.35,80)),white,0,.318,0);ring.rotation.x=-Math.PI/2;
  for(const x of [-1.6,1.6])box(fixed,white,x,.32,0,.48,.018,4.4);box(fixed,white,0,.32,0,3.2,.018,.48);
  const edgeLight=own(new T.MeshStandardMaterial({color:0xf4c780,emissive:0xf4c780,emissiveIntensity:0}));edgeLight.userData.lamp=true;
  for(let i=0;i<24;i++){const a=i*Math.PI/12;box(fixed,edgeLight,Math.cos(a)*9,.33,Math.sin(a)*9,.32,.06,.32);}
  for(const x of [-15.05,-8.95])box(fixed,white,x,.232,2,.09,.012,92);
  for(let z=-42;z<46;z+=5)box(fixed,gold,-12,.233,z,.10,.012,2.4);
  const groundTitle=label(fixed,'FOMO  /  HELIPORT',0,.325,12,14,1.7,'#f4efe0','#505a5a');groundTitle.rotation.x=-Math.PI/2;
  // Low planters, a windsock and a restrained entrance sign.
  for(const x of [-20,15])for(const z of [-16,16]){round(fixed,mat(0xb7b0a1),x,.5,z,2,.8,2);oval(fixed,mat(0x4c654b),x,1.1,z,.95,.7,.95);}
  for(const z of [-17,17]){bar(fixed,silver,[13,.1,z],[13,3.5,z],.055);box(fixed,black,13,3.5,z,.8,.1,.4);box(fixed,white,13,3.43,z,.65,.025,.3);}
  bar(fixed,silver,[11,0,-12],[11,6,-12],.055);
  const sock=group(fixed,'windsock',11,5.9,-12);bar(sock,silver,[0,0,0],[.4,0,0],.035);
  for(let i=0;i<5;i++){const s=mesh(sock,own(new T.CylinderGeometry(.28-i*.035,.315-i*.035,.35,12)),i%2?white:mat(0xe69049),.45+i*.33,-i*.055,0);s.rotation.z=-Math.PI/2-.16;}
  for(const x of [-1,8])bar(fixed,silver,[x,0,17],[x,2.8,17],.055);
  label(fixed,'RASMR  ×  ORANGIE',3.5,2.65,17,10,1.25);

  const kit={T,root,own,mat,group,mesh,box,oval,round,bar,label,cube,ball,cylinder,black,silver,cream,glass,rubber,white,gold};
  const {car,doors,wheels}=createMaybach(kit);
  const {heli,cabinDoor,rotor,tailRotor,rotorBlur}=createHelipadAircraft(kit);

  const guests=createHelipadGuests(kit);
  // Only the shaped facial surface gets the atlas. Hair, ears, glasses and
  // side/back anatomy remain three dimensional at every viewing angle.
  let disposed=false;
  if(typeof document!=='undefined'){
    const atlas=own(new T.TextureLoader().load(new URL('./assets/helipad/creator-face-atlas.png',import.meta.url).href,()=>{
      if(disposed)return;
      guests.forEach(guest=>{
        const portrait=own(new T.MeshStandardMaterial({map:atlas,roughness:.96}));
        portrait.onBeforeCompile=shader=>{
          shader.uniforms.portraitSkin={value:guest.skinTint};
          shader.vertexShader='attribute float portraitBlend; varying float vPortraitBlend;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPortraitBlend=portraitBlend;');
          shader.fragmentShader='uniform vec3 portraitSkin; varying float vPortraitBlend;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(portraitSkin,diffuseColor.rgb,vPortraitBlend);');
        };
        portrait.customProgramCacheKey=()=> 'helipad-portrait-edge-v1';
        guest.portraitSurface.material=portrait;
        guest.portraitSurface.visible=true;guest.faceDetails.visible=false;
      });
      setNight(night);document.dispatchEvent(new CustomEvent('village:artwork'));
    }));atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=8;
  }
  // Moving contact shadows avoid frozen silhouettes in the village's cached map.
  const shadowMap=texture(128,128,(c,W,H)=>{const g=c.createRadialGradient(W/2,H/2,4,W/2,H/2,W/2);g.addColorStop(0,'#0008');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(0,0,W,H);});
  const shadowMaterial=own(new T.MeshBasicMaterial({map:shadowMap,color:0x000000,transparent:true,opacity:.45,depthWrite:false}));
  function shadow(w,d){const s=mesh(root,own(new T.PlaneGeometry(w,d)),shadowMaterial,0,.34,0);s.rotation.x=-Math.PI/2;return s;}
  const carShadow=shadow(4,7),heliShadow=shadow(6,8),peopleShadows=guests.map(()=>shadow(.9,.9));
  heliShadow.material=own(shadowMaterial.clone());
  // Merge static pieces per material within each articulated group. Doors,
  // limbs, rotors and wheels retain their independent transforms.
  function bake(parent){
    for(const child of [...parent.children])if(child.isGroup)bake(child);
    const sets=new Map();for(const child of parent.children)if(child.isMesh&&!child.userData.keepSeparate){const k=child.material;if(!sets.has(k))sets.set(k,[]);sets.get(k).push(child);}
    for(const [material,items] of sets){if(items.length<2)continue;const pos=[],norm=[],uv=[],color=[];
      for(const o of items){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);pos.push(...g.attributes.position.array);norm.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);if(g.attributes.color)color.push(...g.attributes.color.array);g.dispose();o.removeFromParent();}
      const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(color.length)g.setAttribute('color',new T.Float32BufferAttribute(color,3));const m=new T.Mesh(g,material);m.receiveShadow=true;parent.add(m);
    }
  }
  bake(fixed);bake(car);bake(heli);guests.forEach(g=>bake(g.root));
  fixed.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  let epoch=0,lastTime=NaN,state;
  function update(time){
    if(time===lastTime)return state;lastTime=time;state=helipadState(time-epoch);
    car.position.z=state.carZ;car.visible=state.time>.05&&state.time<95.95;
    carShadow.position.set(-12,.34,state.carZ);carShadow.visible=car.visible;
    for(const w of wheels)w.rotation.x=(state.carZ-45)/.39;
    for(const d of doors)d.root.rotation.y=d.side<0?state.doors*1.13:0;
    heli.position.set(state.helicopter.x,state.helicopter.y,state.helicopter.z);heli.rotation.y=state.helicopter.heading;
    cabinDoor.position.z=-.1-state.cabin*1.40;
    // Integral of a smooth acceleration gives continuous blade angles.
    const t=state.time,integral=(x,a,b)=>{const u=clamp((x-a)/(b-a));return (b-a)*(u*u*u-.5*u*u*u*u)+Math.max(0,x-b);};
    rotor.rotation.y=8*Math.PI*(integral(t,42,45)-integral(t,71,74));tailRotor.rotation.x=rotor.rotation.y*2;
    rotorBlur.material.opacity=state.rotor*.085;rotorBlur.visible=state.rotor>.08;
    const airborne=Math.min(1,state.helicopter.y/6);
    heli.rotation.z=Math.sin(state.helicopter.heading)*-.055*airborne;heli.rotation.x=-Math.sin(state.helicopter.heading*.5)*.045*airborne;
    heliShadow.position.set(state.helicopter.x,.34,state.helicopter.z);heliShadow.scale.setScalar(1+state.helicopter.y*.035);
    heliShadow.material.opacity=.45/(1+state.helicopter.y*.15);
    guests.forEach((g,i)=>{const p=state.guests[i];g.root.visible=p.visible;g.root.position.set(p.x,p.y,p.z);g.root.rotation.y=p.heading;
      const stride=Math.sin(p.gait)*.34*p.walking;g.legs[0].rotation.x=stride;g.legs[1].rotation.x=-stride;g.arms[0].rotation.x=-stride*.62;g.arms[1].rotation.x=stride*.62;
      g.knees[0].rotation.x=Math.max(0,-Math.sin(p.gait))*.48*p.walking;g.knees[1].rotation.x=Math.max(0,Math.sin(p.gait))*.48*p.walking;
      g.forearms.forEach((arm,j)=>{arm.rotation.x=-.085-Math.max(0,Math.sin(p.gait+j*Math.PI))*.16*p.walking;});
      g.body.position.y=1.0+Math.sin(p.gait*2)*.012*p.walking;
      g.body.rotation.y=p.standing?Math.sin(t*.6+i)*.06:0;g.head.rotation.y=p.standing?Math.sin(t*.8+i)*.12:0;
      peopleShadows[i].visible=p.visible;peopleShadows[i].position.set(p.x,.34,p.z);
    });
    return state;
  }
  update(27);
  function setNight(enabled){night=Boolean(enabled);for(const material of resources)if(material.isMeshStandardMaterial){material.emissive.copy(material.color);material.emissiveIntensity=night?(material.userData.lamp?1.8:material.vertexColors?.025:.14):(material.userData.dayGlow||0);if(material.envMap)material.envMapIntensity=night?.18:.8;}}
  return {root,car,heli,guests,doors,rotor,resources,update,setNight,get night(){return night;},get state(){return state;},restart(time,still=false){epoch=time-(still?27:0);lastTime=NaN;return update(time);},relocate(ext){root.position.z=HELIPAD_SITE.z+ext;},dispose(){disposed=true;for(const r of resources)r.dispose();resources.clear();}};
}
