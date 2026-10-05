import {hash} from './village-district-layout.js?v=80';
import {createCampusKit} from './village-campus-kit.js?v=128';
const themes={
 mission:{wall:0xe5d3b0,roof:0x9c4f36,sky:0xb8d9e6,ground:0xbfa779,tree:'palm',land:'hills',label:'Mission-style courtyards'},
 pacific:{wall:0xcaa88c,roof:0x96513f,sky:0xafd2e7,ground:0xbba77e,tree:'palm',land:'coast',label:'Pacific campus'},
 desert:{wall:0xc78f65,roof:0x845846,sky:0xd6d9d7,ground:0xc5a173,tree:'cactus',land:'mesa',label:'Desert campus'},
 mountain:{wall:0xac947c,roof:0x59666a,sky:0xbacfdc,ground:0x84916e,tree:'pine',land:'mountains',label:'Mountain campus'},
 flatirons:{wall:0xb99072,roof:0x985644,sky:0xafcddd,ground:0x929476,tree:'pine',land:'flatirons',label:'Front Range campus'},
 stone:{wall:0xa9aaa0,roof:0x596268,sky:0xc5d6de,ground:0x86926d,tree:'oak',land:'hills',label:'Stone campus'},
 northwest:{wall:0x9f9588,roof:0x526562,sky:0xb2c6cf,ground:0x6f8b75,tree:'pine',land:'hills',label:'Evergreen campus'},
 tropical:{wall:0xe1cba7,roof:0xb16c4b,sky:0xaed7e1,ground:0xa6b681,tree:'palm',land:'water',label:'Palm-lined campus'},
 south:{wall:0xaa715c,roof:0x60646b,sky:0xc2d9e2,ground:0x819164,tree:'oak',land:'grove',label:'Southern campus'},
 southern:{wall:0xbca58d,roof:0x5d6662,sky:0xc4d6d8,ground:0x71886c,tree:'oak',land:'grove',label:'Garden campus'},
 midwest:{wall:0xa27665,roof:0x58606a,sky:0xc2d0dc,ground:0x8c9970,tree:'oak',land:'grove',label:'College-town campus'},
 northeast:{wall:0x986d60,roof:0x59606b,sky:0xbccbd9,ground:0x949473,tree:'autumn',land:'grove',label:'Brick college town'},
 midatlantic:{wall:0xa98070,roof:0x54616a,sky:0xc1d0dc,ground:0x819370,tree:'oak',land:'hills',label:'Mid-Atlantic campus'},
 urban:{wall:0x98786c,roof:0x505964,sky:0xb8c7d2,ground:0x858c83,tree:'oak',land:'city',label:'City campus'},
 texas:{wall:0xc5ab87,roof:0x946b53,sky:0xcbd7de,ground:0xa2a177,tree:'oak',land:'grove',label:'Texas campus'}
};
export function schoolTheme(school){if(!school)return null;const base=themes[school.theme]||themes[school.region]||themes.midwest;return {...base,seed:school.id,description:school.character||`${base.label} · ${school.city||school.name}${school.state?', '+school.state:''}`};}
export function createSchoolDistricts(T,school,extension=0){
 const theme=schoolTheme(school),root=new T.Group(),kit=createCampusKit(T),{box,cylinder,mesh,sign}=kit;root.name=`school-environment-${school.id}`;
 const rand=k=>hash(school.id,k),end=60+extension,resources=new Set();
 const ground=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.MeshStandardMaterial({color:theme.ground,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.32;ground.receiveShadow=true;root.add(ground);
 function tree(x,z,i){
  const h=7+hash(school.id,i)*5;
  if(theme.tree==='palm'){
   cylinder(root,x,h/2,z,.24,h,0x92735c);
   for(let j=0;j<7;j++){const a=j*Math.PI*2/7,leaf=mesh(root,'leaf',x+Math.cos(a)*1.8,h-.2,z+Math.sin(a)*1.8,2.7,.22,.7,0x557e55);leaf.rotation.y=-a;leaf.rotation.z=.2;}
  }else if(theme.tree==='cactus'){
   cylinder(root,x,h*.32,z,.38,h*.64,0x6e8760);for(const side of [-1,1]){box(root,x+side*.8,h*.3,z,1.6,.45,.45,0x6e8760);cylinder(root,x+side*1.4,h*.4,z,.24,h*.2,0x6e8760);}
  }else if(theme.tree==='pine'){
   cylinder(root,x,h/2,z,.25,h,0x726958);for(let j=0;j<3;j++)mesh(root,'cone',x,h*.5+j*h*.2,z,2.5-j*.5,h*.65,2.5-j*.5,0x486c58);
  }else kit.tree(root,x,z,Math.floor(hash(school.id,i)*10000),.8+hash(i,school.id)*.6);
 }
 for(let i=0;i<26;i++){const side=i%2?1:-1;tree(side*(48+rand(i+'setback')*35),-55+(end+105)*i/26,i);}
 // Each campus has its own seeded quadrangle and silhouette, clear of chapter lots.
 const offset=(rand('quad')-.5)*28;
 const towerColor=theme.wall;
 if(theme.tree==='palm')for(const side of [-1,1]){
  const x=side*17+offset,z=-79;box(root,x,9,z,5,18,5,towerColor);box(root,x,18.3,z,5.8,.6,5.8,0xe4d5b9);
  box(root,x,16,z+2.55,2.2,2.5,.12,0x354d57);mesh(root,'dome',x,19.2,z,3,2,3,theme.roof);
  for(let j=0;j<3;j++)cylinder(root,x+side*(4+j*3),3.4,z+1,.28,6.8,0xe9dbc0);
 }else if(theme.land!=='city'){
  box(root,offset,13,-90,7,26,7,towerColor);box(root,offset,26.4,-90,8,.7,8,0xe5dbca);
  for(const side of [-1,1])box(root,offset+side*2,23,-86.4,1.2,3,.15,0x394e5c);
 }
 for(let i=0;i<5;i++){
  const x=(i-2)*35+offset,z=-96-rand(i+'depth')*15,h=10+rand(i+'height')*6;
  const type=i===2?'hall':theme.land==='city'?'townhouse':i%2?'residence':'hall';
  const building=kit.building(root,{type,x,z,width:27,depth:17,height:h,rotation:0,label:'',seed:Math.floor(rand(i+'building')*10000)},0,0);
  // Reuse the village's detailed masonry, windows, cornices and entry steps.
  // Clone the wall materials before regional tinting so other objects keep their colors.
  const copies=new Map();building.traverse(o=>{if(!o.material||!o.material.map||!o.geometry)return;const m=o.material;if(!copies.has(m)){const copy=m.clone();copy.color.lerp(new T.Color(theme.wall),.65);copies.set(m,copy);}o.material=copies.get(m);});
  if(i===2)sign(root,school.name.toUpperCase(),x,h+5,z+10,36,2.4);
 }
 if(theme.land==='city')for(const side of [-1,1])for(let i=0;i<5;i++){
  const x=side*(65+rand(i+'urban')*8),z=-40+i*28,h=19+rand(i+'urban-height')*16;
  kit.building(root,{type:'townhouse',x,z,width:24,depth:14,height:h,rotation:-side*Math.PI/2,label:'',seed:Math.floor(rand(i+'brownstone')*10000)},0,0);
 }
 // Broad, irregular ridgelines sit behind the campus, rather than pointed cones.
 if(['mountains','flatirons','mesa','hills'].includes(theme.land)){
  for(let layer=0;layer<3;layer++){
   const vertices=[],indices=[],nx=46,nz=8;
   const peaks=Array.from({length:nx+1},(_,i)=>22+hash(school.id,layer,Math.floor(i/3))*45);
   for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
    const envelope=Math.pow(Math.sin(z/nz*Math.PI),1.3),terrain=theme.land==='hills'?.5:theme.land==='mesa'?.65:1;
    const height=Math.max(0,(peaks[x]+Math.sin(x*.83)*8)*envelope*terrain)-3;
    vertices.push(-550+x*1100/nx,height,-190-layer*120-z*27);
   }
   for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*(nx+1)+x;indices.push(i,i+1,i+nx+1,i+1,i+nx+2,i+nx+1);}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const color=new T.Color(theme.land==='mesa'?0xad8c72:theme.land==='flatirons'?0xa58c78:0x7a9187).lerp(new T.Color(theme.sky),layer*.19);
   root.add(new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:1,side:T.DoubleSide})));
  }
 }else for(let i=0;i<18;i++){
  const a=Math.PI*.1+i*Math.PI*1.8/17,r=225+rand(i+'r')*70,x=Math.cos(a)*r,z=Math.sin(a)*r+extension*.35;
  if(theme.land==='city'){
   const h=25+rand(i+'h')*70;box(root,x,h/2,z,18+rand(i+'w')*18,h,20,0x7b8792);for(let j=0;j<h/5;j++)box(root,x,j*5+2,z+10.1,16,.5,.1,0xb8c6cb);
  }else for(let j=0;j<3;j++)tree(x+j*7,z+i%3*9,i*10+j+100);
 }
 if(['coast','water'].includes(theme.land)){
  const lake=new T.Mesh(new T.CircleGeometry(210,64),new T.MeshStandardMaterial({color:0x5e98ad,roughness:.27,metalness:.25}));lake.rotation.x=-Math.PI/2;lake.position.set(-340,.075,10);root.add(lake);
  for(let i=0;i<8;i++)tree(-91-i*7,-30+i*22,200+i);
 }
 sign(root,`${school.city||school.name}${school.state?' / '+school.state:''}`,0,5,end+26,31,2,0xe7dfcc,0x27344a);
 kit.batch(root);root.updateMatrixWorld(true);root.traverse(o=>o.matrixAutoUpdate=false);
 root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[])){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});
 Object.values(kit.geometries).forEach(g=>resources.add(g));kit.vehicles.resources.forEach(r=>resources.add(r));
 const stadium={root:new T.Group(),setNight(){},bounds:new T.Sphere(new T.Vector3(),1)};
 return {root,theme,stadium,pedestrians:[],building:false,update(){return false;},animate(){},setNight(){},dispose(){root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});for(const r of resources)if(!r.userData?.sharedResource)r.dispose();resources.clear();root.removeFromParent();}};
}
