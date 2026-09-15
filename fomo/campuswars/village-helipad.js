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
  const helicopter={x:Math.sin(angle)*24,y:lift*36,z:(Math.cos(angle)-1)*18,heading:angle};
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
  const cube=own(new T.BoxGeometry(1,1,1)),ball=own(new T.SphereGeometry(1,22,14)),cylinder=own(new T.CylinderGeometry(1,1,1,24));
  const shape=new T.Shape();shape.moveTo(-.44,-.44);shape.lineTo(.44,-.44);shape.lineTo(.44,.44);shape.lineTo(-.44,.44);shape.closePath();
  const rounded=own(new T.ExtrudeGeometry(shape,{depth:.88,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:3,steps:1}));rounded.translate(0,0,-.44);
  function mat(color,metal=0,rough=.65){const key=`${color}:${metal}:${rough}`;if(!materials.has(key))materials.set(key,own(new T.MeshStandardMaterial({color,metalness:metal,roughness:rough})));return materials.get(key);}
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

  // Long-wheelbase Maybach: separate coach doors, two-tone paint, vertical
  // chrome grille, hood star, multi-spoke wheels and a cream leather cabin.
  const car=group(root,'Mercedes-Maybach',-12,.22,10);car.rotation.y=Math.PI;
  round(car,black,0,.65,0,2.25,.67,5.8);round(car,cream,0,1,0,2.2,.40,5.6);
  round(car,black,0,.32,0,2,.2,5.3);round(car,cream,0,1.56,-.12,1.92,.12,2.8);
  round(car,glass,0,1.32,1.40,1.87,.52,.1).rotation.x=.30;
  round(car,glass,0,1.32,-1.52,1.85,.5,.1).rotation.x=-.35;
  round(car,black,0,.91,2.83,1.35,.55,.08);
  for(let i=-7;i<=7;i++)box(car,silver,i*.078,.92,2.89,.025,.47,.025);
  for(const x of [-.87,.87]){round(car,white,x,1.02,2.78,.42,.13,.12);round(car,mat(0x982f34),x,.92,-2.84,.43,.12,.09);}
  const emblem=mesh(car,own(new T.TorusGeometry(.10,.009,6,24)),silver,0,1.34,2.53);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;bar(car,silver,[0,1.34,2.53],[Math.sin(a)*.09,1.34+Math.cos(a)*.09,2.53],.007);}
  for(const x of [-.54,.54])for(const z of [-.8,.7]){round(car,mat(0xc0a98b),x,.87,z,.62,.24,.65);round(car,mat(0xc0a98b),x,1.10,z-.23,.62,.57,.16);}
  const doors=[];
  for(const side of [-1,1])for(const z of [-1.35,.06]){
    const door=group(car,'Maybach passenger door',side*1.075,.94,z+1.15);
    round(door,cream,0,.03,-.6,.08,.40,1.29);round(door,black,0,-.23,-.6,.085,.22,1.29);
    round(door,glass,0,.43,-.61,.065,.40,1.21);box(door,silver,0,.19,-.61,.09,.025,1.26);
    box(door,silver,side*.045,.08,-1.03,.045,.035,.20);
    doors.push({root:door,side});
  }
  for(const side of [-1,1]){box(car,black,side*.98,1.34,.0,.08,.5,.10);oval(car,black,side*1.21,1.19,1.3,.17,.09,.22);bar(car,silver,[side*1.13,.58,-2.5],[side*1.13,.58,2.5],.019);}
  label(car,'MAYBACH',0,.59,2.903,.70,.17,'#161b20','#e3e1d8');
  const wheels=[];
  for(const side of [-1,1])for(const z of [-1.83,1.83]){
    const wheel=group(car,'Maybach wheel',side*1.1,.39,z);wheels.push(wheel);
    mesh(wheel,cylinder,rubber,0,0,0,.39,.24,.39).rotation.z=Math.PI/2;
    mesh(wheel,cylinder,silver,side*.13,0,0,.30,.018,.30).rotation.z=Math.PI/2;
    mesh(wheel,cylinder,black,side*.145,0,0,.24,.022,.24).rotation.z=Math.PI/2;
    for(let i=0;i<14;i++){const a=i*Math.PI/7;bar(wheel,silver,[side*.16,0,0],[side*.16,Math.sin(a)*.27,Math.cos(a)*.27],.014);}
    oval(wheel,silver,side*.17,0,0,.024,.08,.08);
  }

  const heli=group(root,'VIP helicopter');
  oval(heli,black,0,1.95,.20,1.24,1.04,2.43);
  oval(heli,cream,0,1.43,.25,1.18,.54,2.25);
  oval(heli,glass,0,2.15,1.55,1.10,.75,1.09);
  bar(heli,silver,[0,2.77,1.65],[0,1.69,2.51],.04);
  for(const side of [-1,1]){
    oval(heli,glass,side*1.13,2.18,.5,.065,.54,.72);
    round(heli,glass,side*1.19,2.08,-.88,.08,.6,.54);
    bar(heli,gold,[side*1.1,1.65,-1.4],[side*1.1,1.65,1.45],.025);
    for(const z of [-.9,1.1])bar(heli,silver,[side*.72,1.12,z],[side*1.55,.44,z+.14],.065);
    bar(heli,black,[side*1.55,.39,-1.9],[side*1.55,.39,2.12],.095);
    bar(heli,black,[side*1.55,.39,2.12],[side*1.55,.57,2.5],.095);
  }
  const cabinDoor=group(heli,'sliding passenger door',-1.22,1.95,-.2);
  round(cabinDoor,black,0,0,0,.12,1.42,1.2);round(cabinDoor,glass,-.075,.30,0,.025,.62,1.02);box(cabinDoor,silver,-.1,-.16,.35,.04,.035,.24);
  // Visible doorway and interior; the sliding door reveals this dark recess.
  round(heli,rubber,-1.205,1.94,-.2,.045,1.39,1.12);
  box(heli,silver,-1.45,.74,.25,.7,.1,.78);
  bar(heli,black,[0,2,-1.4],[0,2.92,-7.0],.24);
  const tail=box(heli,black,0,3.35,-6.8,.16,2.1,.92);tail.rotation.x=-.3;
  box(heli,cream,0,2.85,-5.75,2.9,.10,.7);
  round(heli,black,0,3.01,-.3,1.20,.55,2);
  for(const side of [-1,1])oval(heli,rubber,side*.47,3.15,-1.22,.23,.2,.12);
  bar(heli,silver,[0,2.95,0],[0,4.02,0],.09);
  const rotor=group(heli,'main rotor',0,4.02,0);
  for(let i=0;i<4;i++){const blade=group(rotor,'rotor blade');blade.rotation.y=i*Math.PI/2;box(blade,black,0,0,3.15,.24,.045,6.1);box(blade,cream,0,.004,6.05,.24,.05,.30);}
  oval(rotor,silver,0,0,0,.28,.14,.28);
  const tailRotor=group(heli,'tail rotor',-.22,3.2,-7);
  for(let i=0;i<3;i++){const blade=box(tailRotor,black,0,0,0,.055,1.5,.10);blade.rotation.x=i*Math.PI/3;}
  for(const side of [-1,1]){const branding=label(heli,'fomo',side*1.245,1.66,-.82,1.25,.34,'#eee6d8','#192025');branding.rotation.y=side*Math.PI/2;}

  function person(index){
    const isOrangie=index===1,skin=mat(isOrangie?0xe0b49c:0xc4967c),hair=mat(isOrangie?0x846343:0x29231f),shirt=mat(isOrangie?0x282728:0x344153),pants=mat(isOrangie?0x242a30:0x393b3f);
    const actor=group(root,isOrangie?'Orangie':'Rasmr'),body=group(actor,'body',0,.91,0);const width=isOrangie?.36:.28;
    oval(body,shirt,0,.37,0,width,.42,.20);oval(body,shirt,0,.20,0,width,.28,.20);
    if(!isOrangie){oval(body,shirt,0,.64,-.095,.24,.15,.15);for(const x of [-.06,.06])bar(body,cream,[x,.65,.17],[x,.43,.19],.009);}
    mesh(body,cylinder,skin,0,.77,0,.092,.20,.085);
    const head=group(body,'portrait',0,1.00,.018);
    oval(head,skin,0,0,0,isOrangie?.195:.168,.237,.172);
    oval(head,skin,0,-.125,.017,isOrangie?.167:.141,.105,.144);
    for(const side of [-1,1]){oval(head,skin,side*.175,-.008,-.005,.038,.065,.029);oval(head,white,side*.068,.035,.151,.039,.019,.015);oval(head,mat(0x443b31),side*.068,.036,.166,.015,.016,.007);oval(head,black,side*.068,.036,.171,.008,.011,.005);bar(head,hair,[side*.038,.079,.16],[side*.112,.088,.146],isOrangie?.009:.014);}
    oval(head,skin,0,-.022,.176,.034,.055,.052);
    bar(head,mat(0x9b6860),[-.048,-.103,.15],[.048,-.103,.15],.009);
    oval(head,hair,0,.164,-.028,isOrangie?.194:.173,.115,.155);
    // Sculpted curls and tapered temples remain recognizable from behind too.
    for(let i=0;i<(isOrangie?45:24);i++){const a=i*2.399963,r=Math.sqrt((i+.5)/(isOrangie?45:24))*.17;oval(head,hair,Math.cos(a)*r,.218+(1-r/.20)*.037,Math.sin(a)*r-.025,isOrangie?.046:.038,isOrangie?.045:.023,isOrangie?.044:.041);}
    if(isOrangie){
      for(const side of [-1,1]){const g=group(head,'rectangular glasses',side*.078,.043,.177);for(const y of [-.027,.027])bar(g,black,[-.061,y,0],[.061,y,0],.009);for(const x of [-.061,.061])bar(g,black,[x,-.027,0],[x,.027,0],.009);bar(head,black,[side*.139,.043,.178],[side*.18,.052,-.027],.008);}
      bar(head,black,[-.017,.049,.177],[.017,.049,.177],.009);
    }else{
      for(let i=0;i<32;i++){const x=Math.sin(i*2.4)*.12,y=-.14+Math.cos(i*1.4)*.022;oval(head,mat(0x725e50),x,y,.133-Math.abs(x)*.20,.003,.004,.002);}
    }
    label(body,isOrangie?'BALENCIAGA':'DEGODS',0,.41,.205,isOrangie?.59:.41,.12,isOrangie?'#d6c296':'#dedbd0',isOrangie?'#282728':'#344153');
    const arms=[],legs=[];
    for(const side of [-1,1]){
      const arm=group(body,'arm',side*(width+.015),.56,0);arms.push(arm);
      oval(arm,shirt,side*.02,-.12,0,.087,.19,.085);bar(arm,skin,[side*.02,-.20,0],[side*.035,-.47,.02],.058);oval(arm,skin,side*.035,-.50,.02,.06,.075,.045);
      const leg=group(actor,'leg',side*.115,.91,0);legs.push(leg);mesh(leg,cylinder,pants,0,-.37,0,.095,.74,.10);round(leg,white,0,-.81,.045,.20,.15,.34);box(leg,rubber,0,-.876,.045,.20,.02,.32);
    }
    const name=label(actor,isOrangie?'ORANGIE':'RASMR',0,2.42,0,isOrangie?1.18:.96,.24,'#fff',isOrangie?'#7b512f':'#344153',true);
    return {root:actor,body,head,arms,legs,name};
  }
  const guests=[person(0),person(1)];
  // One local atlas, projected onto curved face surfaces; modeled heads remain
  // as a fallback if loading fails. Never fetch a social-media asset at runtime.
  let disposed=false;
  if(typeof document!=='undefined'){
    const atlas=own(new T.TextureLoader().load(new URL('./assets/helipad/creator-face-atlas.png',import.meta.url).href,()=>{
      if(disposed)return;
      guests.forEach((guest,index)=>{
        for(const child of guest.head.children)child.visible=false;
        const geometry=own(new T.SphereGeometry(1,36,28,0,Math.PI));
        const positions=geometry.attributes.position,uv=geometry.attributes.uv;
        for(let i=0;i<positions.count;i++)uv.setXY(i,(index+.02+(positions.getX(i)+1)*.48)/2,.14+(positions.getY(i)+1)*.385);
        const face=mesh(guest.head,geometry,own(new T.MeshStandardMaterial({map:atlas,roughness:1})),0,.012,0,index?.205:.18,.267,.19);
        face.name='reference-based face';
        oval(guest.head,mat(index?0xd3aa91:0xc4967c),0,.012,-.014,index?.201:.177,.262,.17);
        oval(guest.head,mat(index?0x846343:0x29231f),0,.158,-.055,index?.17:.147,.10,.12);
      });
      setNight(night);document.dispatchEvent(new CustomEvent('village:artwork'));
    }));atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=8;
  }
  // Moving contact shadows avoid frozen silhouettes in the village's cached map.
  const shadowMap=texture(128,128,(c,W,H)=>{const g=c.createRadialGradient(W/2,H/2,4,W/2,H/2,W/2);g.addColorStop(0,'#0008');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(0,0,W,H);});
  const shadowMaterial=own(new T.MeshBasicMaterial({map:shadowMap,color:0x000000,transparent:true,opacity:.45,depthWrite:false}));
  function shadow(w,d){const s=mesh(root,own(new T.PlaneGeometry(w,d)),shadowMaterial,0,.34,0);s.rotation.x=-Math.PI/2;return s;}
  const carShadow=shadow(4,7),heliShadow=shadow(6,8),peopleShadows=guests.map(()=>shadow(.9,.9));
  // Merge static pieces per material within each articulated group. Doors,
  // limbs, rotors and wheels retain their independent transforms.
  function bake(parent){
    for(const child of [...parent.children])if(child.isGroup)bake(child);
    const sets=new Map();for(const child of parent.children)if(child.isMesh){const k=child.material;if(!sets.has(k))sets.set(k,[]);sets.get(k).push(child);}
    for(const [material,items] of sets){if(items.length<2)continue;const pos=[],norm=[],uv=[];
      for(const o of items){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);pos.push(...g.attributes.position.array);norm.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);g.dispose();o.removeFromParent();}
      const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));const m=new T.Mesh(g,material);m.receiveShadow=true;parent.add(m);
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
    for(const d of doors)d.root.rotation.y=d.side<0?-state.doors*1.13:0;
    heli.position.set(state.helicopter.x,state.helicopter.y,state.helicopter.z);heli.rotation.y=state.helicopter.heading;
    cabinDoor.position.z=-.2-state.cabin*1.2;
    // Integral of a smooth acceleration gives continuous blade angles.
    const t=state.time,integral=(x,a,b)=>{const u=clamp((x-a)/(b-a));return (b-a)*(u*u*u-.5*u*u*u*u)+Math.max(0,x-b);};
    rotor.rotation.y=8*Math.PI*(integral(t,42,45)-integral(t,71,74));tailRotor.rotation.x=rotor.rotation.y*2;
    heliShadow.position.set(state.helicopter.x,.34,state.helicopter.z);heliShadow.scale.setScalar(1+state.helicopter.y*.035);
    guests.forEach((g,i)=>{const p=state.guests[i];g.root.visible=p.visible;g.root.position.set(p.x,p.y,p.z);g.root.rotation.y=p.heading;
      const stride=Math.sin(p.gait)*.36*p.walking;g.legs[0].rotation.x=stride;g.legs[1].rotation.x=-stride;g.arms[0].rotation.x=-stride*.7;g.arms[1].rotation.x=stride*.7;
      g.body.rotation.y=p.standing?Math.sin(t*.6+i)*.06:0;g.head.rotation.y=p.standing?Math.sin(t*.8+i)*.12:0;
      peopleShadows[i].visible=p.visible;peopleShadows[i].position.set(p.x,.34,p.z);
    });
    return state;
  }
  update(27);
  function setNight(enabled){night=Boolean(enabled);for(const material of resources)if(material.isMeshStandardMaterial){material.emissive.copy(material.color);material.emissiveIntensity=night?(material.userData.lamp?1.8:.14):0;}}
  return {root,car,heli,guests,doors,rotor,resources,update,setNight,get night(){return night;},get state(){return state;},restart(time,still=false){epoch=time-(still?27:0);lastTime=NaN;return update(time);},relocate(ext){root.position.z=HELIPAD_SITE.z+ext;},dispose(){disposed=true;for(const r of resources)r.dispose();resources.clear();}};
}
