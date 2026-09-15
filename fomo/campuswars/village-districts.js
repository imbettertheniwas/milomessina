import {createCampusHill,isCampusHill,CAMPUS_HILL_HEIGHT} from './village-campus-hill.js?v=99';
import {BLOCK,districtSpecs,districtAt,districtKind,mod,hash,pick} from './village-district-layout.js?v=80';
import {createCampusKit} from './village-campus-kit.js?v=87';
import {createCampusPeople,createCampusTraffic} from './village-campus-life.js?v=99';
import {dressNeighborhood} from './village-places.js?v=80';
import {createStadium,STADIUM_SITE} from './village-stadium.js?v=98';
import {campusDistrictExists} from './village-campus-bounds.js?v=1';

export function createDistricts(T,extension=0,streets=1,{incremental=false}={}){
  const root=new T.Group(),chunks=new Map(),kit=createCampusKit(T);let night=false;
  const stadium=createStadium(T,extension);root.add(stadium.root);
  const {box,mesh,cylinder,bar,tree:plantTree,bench,lamp,table,path,sign}=kit;
  function tree(p,x,z,seed,size){
    const blocked=(p.userData.specs||[]).some(s=>{const dx=x-(s.x-p.position.x),dz=z-(s.z-p.position.z),a=s.rotation;return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<s.width/2+2&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<s.depth/2+3;});
    if(!blocked)plantTree(p,x,z,seed,size);
  }
  const traffic=createCampusTraffic(T,kit,extension);root.add(traffic.root);
  function bikeRack(p,x,z){
    for(let i=0;i<5;i++){
      const a=x+i*.75;bar(p,[a,.1,z],[a,.9,z],.035,0x7a898b);bar(p,[a,.9,z],[a,.9,z+1],.035,0x7a898b);bar(p,[a,.9,z+1],[a,.1,z+1],.035,0x7a898b);
      if(i%2===0){for(const offset of [-.1,1.2]){const w=mesh(p,'wheel',a+.16,.4,z+offset,1,1,1,0x384649);w.rotation.y=Math.PI/2;}
        bar(p,[a+.16,.4,z-.1],[a+.16,.9,z+.35],.033,0xa78059);bar(p,[a+.16,.9,z+.35],[a+.16,.4,z+1.2],.033,0xa78059);bar(p,[a+.16,.4,z-.1],[a+.16,.4,z+1.2],.033,0xa78059);
      }
    }
  }
  function corePlaces(p){
    box(p,41,.07,-18,16,.08,18,0xc4bcaa);box(p,41,1.95,-20,8,3.6,5.5,0xc5b599,'stone');box(p,41,3.92,-20,9,.22,6.2,0x626961);box(p,41,2,-17.17,6.8,1.8,.08,0x49616b);
    for(let i=0;i<8;i++)box(p,37.5+i,3.2,-16.5,1,.12,2.2,i%2?0xb4805d:0xe9dfc7);
    sign(p,'CAMPUS COFFEE',41,3.6,-17.12,7,.6);
    for(const x of [37,43,46])table(p,x,-11,x!==43);
    bikeRack(p,34,-25);
    // A low fountain and curved seating edge anchor the social lawn.
    cylinder(p,42,.3,14,3.2,.45,0xc9c2b1);cylinder(p,42,.56,14,2.85,.07,0x729ca1);cylinder(p,42,.8,14,.35,.7,0xd6cdb6);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const water=bar(p,[42,.9,14],[42+Math.cos(a)*1.1,.68,14+Math.sin(a)*1.1],.025,0xb6cfca);water.castShadow=false;}
    bench(p,36,12,Math.PI/2);bench(p,48,12,-Math.PI/2);bench(p,42,21);bench(p,35,23,.4);
    // Court lines sit on one raised sports slab, with a visible curb clearance.
    box(p,-42,.2,10,18,.24,28,0x718888);
    for(const x of [-50,-34])box(p,x,.335,10,.09,.025,25,0xe8e0cd);
    for(const z of [-2.5,10,22.5])box(p,-42,.335,z,16,.025,.09,0xe8e0cd);
    for(const z of [-1.5,21.5]){cylinder(p,-42,1.8,z,.07,3.2,0x8a9590);box(p,-42,3.35,z,1.55,1,.1,0xe4dfcb);const hoop=mesh(p,'wheel',-42,3.05,z+(z<0?.5:-.5),1.15,1.15,1.15,0xb37350);hoop.rotation.x=Math.PI/2;}
    bench(p,-32,7,Math.PI/2);bench(p,-32,14,Math.PI/2);
    for(const z of [-34,-7,31]){tree(p,-42,z,mod(z,9),1.1);tree(p,43,z+2,mod(z+3,9),1.0);}
    for(const side of [-1,1]){path(p,[side*30.8,-39],[side*30.8,39],2.6);path(p,[side*7,34],[side*45,34],2.2);}
    for(const [x,z] of [[-52,-30],[53,-22],[55,5],[-56,25],[-52,-9],[55,34]])tree(p,x,z,mod(x+z,9),1.15);
  }
  function landscape(p,kind,cx,cz){
    const spine=['library','athletics','commons'].includes(kind),seed=mod(cx*17+cz*41,27);
    // Staggered groves and varied setbacks replace the repeated fence of trees.
    if(kind==='greek'){corePlaces(p);return;}
    if(['town','green','residential'].includes(kind))return;
    if(spine){
      path(p,[0,kind==='athletics'?-39:-7],[0,41],5);path(p,[-38,34],[38,34],2.5);if(kind!=='athletics')path(p,[-19,0],[19,27],2.2);else path(p,[-35,-8],[35,-8],2.2);
      for(const side of [-1,1]){bench(p,side*12,36);for(const z of [8,24,39])tree(p,side*(22+(z%3)*3),z,seed+mod(z,8),1.15);}
      for(let i=0;i<4;i++){box(p,(kind==='athletics'?13:-20)+i*2.1,.16,(kind==='athletics'?-21:15)+(i%2)*2,1.8,.025,1.3,[0xad8769,0x78899a,0xd0c4a5,0x8f9586][i]);}
      if(kind==='athletics'){
        for(const x of [-22,-2])for(const z of [-33,-14]){cylinder(p,x,1.1,z,.065,2.1,0xe2deca);}
        for(const z of [-33,-14])bar(p,[-22,2.1,z],[-2,2.1,z],.025,0xd8d5c7);
        sign(p,'INTRAMURAL FIELD',-12,1.5,-10,12,.55);
      }
    }else{
      for(const side of [-1,1]){
        path(p,[side*7,38],[side*42,38],2.3);bench(p,side*29,38);
        for(const z of [-39,5,39])tree(p,side*(40+(z%3)),z,seed+mod(z,8),.95+seed%3*.1);
        bikeRack(p,side>0?11:-16,30);
      }
      if(kind==='town'){
        for(let i=0;i<3;i++){table(p,18+i*4.2,5,i!==1);}
      }
    }
    for(const side of [-1,1])for(const z of [-35,17])lamp(p,side*8,z);
    // Bus shelters and campus noticeboards make the curb useful.
    if(kind==='science'||kind==='arts'){
      const x=kind==='science'?8.8:-8.8;for(const z of [-30,-24])cylinder(p,x,1.4,z,.045,2.8,0x657774);
      box(p,x,2.86,-27,2.5,.14,7.2,0x748984);box(p,x+(x>0?1:-1),1.5,-27,.08,2.4,6,0x90aaa5);bench(p,x,-27,Math.PI/2);
      sign(p,'CAMPUS SHUTTLE',x,2.7,-23.35,2,.35);
    }
    for(let i=0;i<4;i++){
      const x=(i%2?1:-1)*(45+(seed%3)),z=-32+i*19;
      tree(p,x,z,seed+i,.8+(i%3)*.17);
    }
  }
  function fillDetails(p,kind,cx,cz){
    const core=kind==='greek',spine=['library','athletics','commons'].includes(kind);
    for(const side of [-1,1]){
      if(core){
        const x=side*23;
        kit.hedge(p,x,-42,12);kit.hedge(p,side*34,-35,10,Math.PI/2);
        box(p,x,.25,-36,12,.35,6,0xbcb7a7);for(const dx of [-3,3]){table(p,x+dx,-36);bench(p,x+dx,-34.3);}
        kit.streetFurniture(p,side*14,-39,side);
        cylinder(p,side*32,3.3,-32,.06,6.6,0x687575);box(p,side*32+.44,5.3,-32,.78,1.7,.045,0x7b83ac);box(p,side*32+.44,5.3,-31.97,.035,1.4,.015,0xd9d4bd);
        for(const dx of [-5,5])tree(p,x+dx,-38,Math.floor(hash(x,dx)*10000),.8);
        kit.parkedCar(p,side*43,-37,0,side,false);kit.parkedCar(p,side*47,-37,0,side+8,true);
        kit.bins(p,side*31,30);kit.hedge(p,side*44,33,11);
      }else{
        kit.hedge(p,side*35,42,15);kit.hedge(p,side*46,20,11,Math.PI/2);
        kit.streetFurniture(p,side*15,37,cx*71+cz);
        for(const x of [side*22,side*36]){box(p,x,.34,41,5,.5,.45,0xb1ae9d);for(let i=0;i<3;i++)mesh(p,'leaf',x-1.4+i*1.4,.8,41,.65,.48,.6,pick([0x748363,0x7b8059,0x88785d],cx,cz,x,i));}
        if(!spine)for(let i=0;i<6;i++)kit.parkedCar(p,side*(18+i*4.8),-40,side>0?Math.PI/2:-Math.PI/2,Math.floor(hash(cx,cz,side,i)*10000),i%2===1);
        if(spine){for(const x of [side*16,side*30]){table(p,x,39);kit.bins(p,x+1.8,40.5);}}
      }
      // Lamps and access bollards punctuate long pavements without blocking the road.
      for(const z of [-40,34])for(let i=0;i<3;i++)cylinder(p,side*(core?31:18)+i*.9,.55,z,.09,.9,0x687575);
    }
  }
  function distantCampus(){
    const p=new T.Group();p.name='permanent-campus-horizon';
    for(let i=0;i<65;i++){
      const a=hash(i,'sky-angle')*Math.PI*2,r=225+hash(i,'sky-radius')*130,x=Math.sin(a)*r,z=Math.cos(a)*r,w=7+hash(i,'sky-width')*17,h=6+hash(i,'sky-height')*19;
      if(Math.abs(x)<STADIUM_SITE.width/2+w&&Math.abs(z-STADIUM_SITE.z)<STADIUM_SITE.depth/2+18)continue;
      box(p,x,h/2,z,w,h,8+hash(i,'sky-depth')*9,pick([0x8d9c9b,0x899292,0x9eaaa3,0x92988f],i,'sky-color'));
      box(p,x,h+.3,z,w+.5,.5,10,0x9daba7);
      for(let row=1;row<4;row++)for(const side of [-1,1])box(p,x,h*row/4,z+side*(4+hash(i,'sky-depth')*4.5+.03),w*.8,.55,.05,0x768a8b);
    }
    for(let i=0;i<80;i++){const a=hash(i,'distant-tree')*Math.PI*2,r=205+hash(i,'tree-radius')*130,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<50&&Math.abs(z-STADIUM_SITE.z)<50)continue;mesh(p,'leaf',x,3.5,z,5+hash(i)*6,5+hash(i,1)*5,4+hash(i,2)*6,pick([0x7d907b,0x718978,0x8c9b82],i));}
    // Water tower, bell tower and stadium floodlights break the dormitory skyline.
    for(const x of [233,241])for(const z of [181,189])bar(p,[x,0,z],[x,24,z],.20,0x8c9f9d);
    cylinder(p,237,26,185,6,6,0xaebdb5);mesh(p,'dome',237,29,185,6,2,6,0xaebdb5);
    box(p,-248,16,55,8,32,8,0x9b9e8e);for(const x of [-251,-245])for(const z of [52,58])box(p,x,35,z,.6,6,.6,0xaeb3a3);mesh(p,'cone',-248,40,55,6,6,6,0x829790);
    for(const z of [-155,-115]){cylinder(p,247,20,z,.35,40,0x9cacab);box(p,247,40,z,13,1.5,.6,0x859794);for(let i=0;i<6;i++)box(p,242+i*2,40,z+.4,1.5,1.1,.3,0xc6d0bd);}
    if(extension)for(const child of p.children)if(child.position.z>30)child.position.z+=extension;
    kit.batch(p);p.updateMatrixWorld(true);p.traverse(o=>o.matrixAutoUpdate=false);return p;
  }
  const horizon=distantCampus();root.add(horizon);
  function makeChunk(cx,cz){
    const p=new T.Group();p.position.set(cx*BLOCK,0,cz*BLOCK);root.add(p);
    // Reserve this entire outlying block for the permanent stadium. No campus
    // buildings, through-path crowds or trees may be streamed into its bowl.
    if(cx===0&&cz===2){p.position.z+=extension;return {group:p,kind:'stadium',specs:[],people:[],activityBounds:stadium.bounds.clone(),setNight(){},animate(){},dispose(){}};}
    const kind=districtKind(cx,cz,streets),specs=districtSpecs(cx,cz,streets);p.userData.specs=specs;
    for(const spec of specs){const building=kit.building(p,spec,cx*BLOCK,cz*BLOCK);if(isCampusHill(cx,cz))building.position.y=CAMPUS_HILL_HEIGHT;}
    if(isCampusHill(cx,cz))createCampusHill(T,kit,p);
    else {landscape(p,kind,cx,cz);fillDetails(p,kind,cx,cz);dressNeighborhood(T,kit,p,kind,cx,cz);}
    const activity=createCampusPeople(T,kit,kind,cx,cz,streets);p.add(activity.root);
    if(extension){
      if(cz>0)p.position.z+=extension;
      else if(cz===0)for(const child of p.children)if(child!==activity.root && child.position.z>=30)child.position.z+=extension;
    }
    kit.batch(p);
    const lights=new Set();p.traverse(o=>{if(o.material?.userData.placeLight)lights.add(o.material);});
    const setNight=enabled=>{for(const m of lights)m.emissiveIntensity=enabled?(m.userData.placeLight==='homeLight'?.65:m.userData.placeLight==='shopLight'?1.6:2.3):.04;activity.setNight(enabled);animatedAt=NaN;};
    p.updateMatrixWorld(true);p.traverse(o=>o.matrixAutoUpdate=false);
    // Use the same conservative bounds as the crowd's instance batches. These
    // include every route and prop, so skipping a whole invisible batch cannot
    // leave an old pose visible. Absolute-time poses catch up before drawing.
    const activityBounds=activity.root.children.find(o=>o.isInstancedMesh).boundingSphere.clone().applyMatrix4(activity.root.matrixWorld);
    let animatedAt=0;setNight(night);
    return {group:p,kind,specs,activityBounds,people:activity.people,setNight,animate(time,animatePeople=true,camera=null){
      if(animatePeople){activity.animate(time,camera);animatedAt=time;}
    },dispose(){p.userData.nationalPrize?.dispose();activity.dispose();kit.disposeChunk(p);}};
  }
  let lastKey='',pending=[];
  function update(x,z){
    const center=districtAt(x,z>30?Math.max(30,z-extension):z),key=`${center.x},${center.z}`;
    let changed=false;
    if(key!==lastKey){
      lastKey=key;
      const wanted=new Set(),missing=[];
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
        const a=center.x+dx,b=center.z+dz,id=`${a},${b}`;
        if(!campusDistrictExists(a,b,streets))continue;
        wanted.add(id);if(!chunks.has(id))missing.push({a,b,id,distance:dx*dx+dz*dz});
      }
      pending=missing.sort((a,b)=>a.distance-b.distance);
      // Keep nearby blocks resident when crossing an intersection. The small
      // campus fits in this cache, avoiding buildings popping out and rebuilding.
      const evict=[...chunks].filter(([id,c])=>!wanted.has(id)&&c.kind!=='stadium').sort((a,b)=>{
        const distance=([,c])=>Math.hypot(c.group.position.x-x,c.group.position.z-z);
        return distance(b)-distance(a);
      });
      let detailed=[...chunks.values()].filter(c=>c.kind!=='stadium').length+missing.filter(c=>!(c.a===0&&c.b===2)).length;
      while(detailed>9&&evict.length){const [id,chunk]=evict.shift();chunk.group.removeFromParent();chunk.dispose();chunks.delete(id);detailed--;changed=true;}
    }
    const count=incremental?Math.min(1,pending.length):pending.length;
    for(let i=0;i<count;i++){const {a,b,id}=pending.shift();chunks.set(id,makeChunk(a,b));changed=true;}
    if(changed)root.updateMatrixWorld(true);return changed;
  }
  const frustum=new T.Frustum(),projection=new T.Matrix4();
  let trafficTime,trafficX,trafficZ;
  function animate(time,x=0,z=0,camera=null){
    if(camera)frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    stadium.root.visible=!camera||frustum.intersectsSphere(stadium.bounds);
    if(stadium.root.visible)stadium.animate(time);
    for(const chunk of chunks.values()){
      const inView=camera?frustum.intersectsSphere(chunk.activityBounds):Math.hypot(chunk.group.position.x-x,chunk.group.position.z-z)<165;
      chunk.animate(time,inView,camera);
    }
    if(time!==trafficTime||x!==trafficX||z!==trafficZ){traffic.animate(time,x,z);trafficTime=time;trafficX=x;trafficZ=z;}
  }
  update(0,0);
  function dispose(){
    stadium.dispose();
    for(const chunk of chunks.values())chunk.dispose();
    const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.isInstancedMesh)resources.add(o);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});
    Object.values(kit.geometries).forEach(g=>resources.add(g));
    kit.vehicles.resources.forEach(r=>resources.add(r));
    for(const r of resources)if(!r.userData?.sharedResource)r.dispose();chunks.clear();
  }
  return {root,update,animate,chunks,get building(){return pending.length>0;},traffic,horizon,stadium,dispose,setNight(enabled){night=Boolean(enabled);stadium.setNight(night);for(const chunk of chunks.values())chunk.setNight(night);}};
}
