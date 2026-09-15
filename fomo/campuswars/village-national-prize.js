import {FOMO_MARK_PATHS} from './village-floor-logo.js?v=24';
import {createBanknoteTexture} from './village-money-art.js?v=1';

export const NATIONAL_PRIZE_SITE={x:33,y:6,z:-90};
export const NATIONAL_PRIZE_COPY=['NATIONAL CHAMPION'];

export function createNationalPrize(T){
  const root=new T.Group();root.name='national-prize-trophy';root.scale.setScalar(1.14);
  const resources=new Set(),batches=new Map(),dummy=new T.Object3D();
  const own=value=>(resources.add(value),value);
  // A small reflection map gives the gold a polished finish in both lighting modes.
  const reflection=artwork(256,128,c=>{
    const sky=c.createLinearGradient(0,0,0,128);
    sky.addColorStop(0,'#b9c9e0');sky.addColorStop(.46,'#faf5e4');sky.addColorStop(.54,'#a39578');sky.addColorStop(1,'#4c4539');
    c.fillStyle=sky;c.fillRect(0,0,256,128);
    for(const x of [28,158]){const light=c.createLinearGradient(x-18,0,x+18,0);light.addColorStop(0,'#ffffff00');light.addColorStop(.5,'#ffffff');light.addColorStop(1,'#ffffff00');c.fillStyle=light;c.fillRect(x-18,10,36,94);}
  });
  if(reflection)reflection.mapping=T.EquirectangularReflectionMapping;
  const goldFinish={metalness:.78,roughness:.24,clearcoat:.45,envMap:reflection,envMapIntensity:.9};
  const gold=own(new T.MeshPhysicalMaterial({color:0xe7ad3c,...goldFinish}));
  const trim=own(new T.MeshPhysicalMaterial({color:0xffd879,...goldFinish,roughness:.19}));
  const plinth=own(new T.MeshStandardMaterial({color:0x20202a,metalness:.22,roughness:.3}));
  const paper=own(new T.MeshStandardMaterial({color:0x9aac78,roughness:.85}));
  const bands=own(new T.MeshStandardMaterial({color:0xf0e7c9,roughness:.8}));
  const cube=own(new T.BoxGeometry(1,1,1)),cylinder=own(new T.CylinderGeometry(1,1,1,32));
  function part(geometry,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();
    if(!batches.has(material))batches.set(material,[]);
    batches.get(material).push({geometry,matrix:dummy.matrix.clone()});
  }
  // A tapered pedestal, single sculpted stem and swept handles form a classic cup.
  part(cylinder,plinth,0,.20,0,2.25,.40,1.7);
  part(cylinder,trim,0,.43,0,2.15,.08,1.6);
  part(cylinder,plinth,0,.54,0,1.91,.14,1.41);
  const stemProfile=[[0,.6],[1.35,.6],[1.28,.74],[.72,.94],[.43,1.23],[.28,1.74],[.35,2.08],[.69,2.48],[0,2.48]].map(p=>new T.Vector2(...p));
  part(own(new T.LatheGeometry(stemProfile,32)),gold,0,0,0);
  for(const side of [-1,1]){
    const curve=new T.CatmullRomCurve3([[1.99,5.15],[2.72,5.27],[3.12,4.94],[3.03,4.25],[2.55,3.53],[1.52,3.14]].map(([x,y])=>new T.Vector3(side*x,y,0)));
    part(own(new T.TubeGeometry(curve,22,.17,8,false)),gold,0,0,0);
  }
  const profile=[[0,2.45],[.62,2.45],[1.05,2.75],[1.5,3.2],[1.84,3.85],[1.96,4.55],[2.04,5.25],[2.2,5.55],[2.05,5.55],[1.89,5.22],[1.82,4.55],[1.69,3.9],[1.36,3.28],[.93,2.88],[0,2.7]].map(p=>new T.Vector2(...p));
  const bowlGeometry=own(new T.LatheGeometry(profile,48));
  const bowlPositions=bowlGeometry.attributes.position,bowlUv=bowlGeometry.attributes.uv;
  for(let i=0;i<bowlPositions.count;i++){
    // Place the inscription on the actual cup surface, centered toward Greek Row.
    const section=Math.floor(i/profile.length);
    bowlUv.setXY(i,section/48,(bowlPositions.getY(i)-2.45)/3.1);
  }
  bowlGeometry.rotateY(Math.PI);
  part(own(new T.TorusGeometry(2.13,.085,8,48)),trim,0,5.55,0,1,1,1,Math.PI/2);
  // Packed bundles fill the bowl. Paper edges and pale bands read as cash
  // even before the banknote artwork becomes visible at closer distances.
  for(let i=0;i<12;i++){
    const angle=i*2.39996323,radius=i<4?.45:1.05,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=5.18+(i%3)*.29;
    part(cube,paper,x,y,z,1.4,.23,.65,0,angle,.08*(i%2?1:-1));
    part(cube,bands,x,y+.015,z,.28,.27,.68,0,angle,.08*(i%2?1:-1));
  }
  // Merge by finish to keep the entire monument within eight static draws.
  for(const [material,parts] of batches){
    const positions=[],normals=[];
    for(const {geometry,matrix} of parts){
      const copy=geometry.index?geometry.toNonIndexed():geometry.clone();copy.applyMatrix4(matrix);
      positions.push(...copy.attributes.position.array);normals.push(...copy.attributes.normal.array);copy.dispose();
    }
    const geometry=own(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    const mesh=new T.Mesh(geometry,material);mesh.name=material===gold?'national-prize-gold':'national-prize-trim-and-bundles';mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.ownedGeometry=true;root.add(mesh);
  }
  const noteMap=createBanknoteTexture(T);if(noteMap)own(noteMap);
  const noteGeometry=own(new T.PlaneGeometry(1.45,.64,5,1)),p=noteGeometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*2)*.13);noteGeometry.computeVertexNormals();
  const noteMaterial=own(new T.MeshStandardMaterial({color:noteMap?0xffffff:0xc4d39d,map:noteMap,side:T.DoubleSide,roughness:.8}));
  const notes=own(new T.InstancedMesh(noteGeometry,noteMaterial,28));notes.name='national-prize-cash';notes.castShadow=true;
  for(let i=0;i<28;i++){
    const angle=i*2.39996323,radius=.35+(i%4)*.29;
    dummy.position.set(Math.cos(angle)*radius,5.55+(i%5)*.23,Math.sin(angle)*radius);
    dummy.rotation.set(-.3+(i%3)*.27,angle,(i%2?1:-1)*(.25+i%4*.12));dummy.scale.setScalar(1);dummy.updateMatrix();notes.setMatrixAt(i,dummy.matrix);
  }
  notes.computeBoundingSphere();root.add(notes);
  function artwork(width,height,paint){
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'));
    const map=own(new T.CanvasTexture(canvas));map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return map;
  }
  function engraving(c,bump=false){
    c.fillStyle=bump?'#ffffff':'#e7ad3c';c.fillRect(0,0,2048,1024);
    function cut(draw){
      if(!bump){c.save();c.translate(0,3);c.fillStyle='#fff0b0';draw();c.restore();}
      c.fillStyle=bump?'#050505':'#79531f';draw();
    }
    cut(()=>{c.save();c.translate(824,24);c.scale(4,4);for(const path of FOMO_MARK_PATHS)c.fill(new Path2D(path));c.restore();});
    c.textAlign='center';
    cut(()=>{c.font='bold 138px Arial';c.fillText('?',1024,480);});
    cut(()=>{c.font='bold 86px Arial';c.fillText('NATIONAL',1024,630);c.font='bold 96px Arial';c.fillText('CHAMPION',1024,755);});
  }
  const inscription=artwork(1024,512,c=>{c.scale(.5,.5);engraving(c);});
  const recess=artwork(1024,512,c=>{c.scale(.5,.5);engraving(c,true);});if(recess)recess.colorSpace=T.NoColorSpace;
  const bowlMaterial=own(new T.MeshPhysicalMaterial({color:inscription?0xffffff:0xe7ad3c,map:inscription,bumpMap:recess,bumpScale:.12,...goldFinish}));
  const bowl=new T.Mesh(bowlGeometry,bowlMaterial);bowl.name='national-prize-engraved-cup';bowl.userData.ownedGeometry=true;bowl.castShadow=true;bowl.receiveShadow=true;root.add(bowl);
  // A shallow concrete footing supports the trophy without covering the quad lawn.
  for(const child of root.children)child.position.y+=.18;
  const slab=new T.Mesh(own(new T.BoxGeometry(5.35,.18,4.15)),own(new T.MeshStandardMaterial({color:0xa7a69e,roughness:.98})));
  slab.name='national-prize-concrete-slab';slab.position.y=.09;slab.receiveShadow=true;slab.castShadow=true;slab.userData.ownedGeometry=true;root.add(slab);
  root.userData.prizeAmount=null;root.userData.label=NATIONAL_PRIZE_COPY.join(' · ');
  return {root,dispose(){root.removeFromParent();for(const resource of resources)resource.dispose();}};
}
