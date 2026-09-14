import {FOMO_MARK_PATHS} from './village-floor-logo.js?v=24';
import {createBanknoteTexture} from './village-money-art.js?v=1';

export const NATIONAL_PRIZE_SITE={x:33,y:6,z:-90};
export const NATIONAL_PRIZE_COPY=['NATIONAL CHAMPION'];

export function createNationalPrize(T){
  const root=new T.Group();root.name='national-prize-trophy';
  const resources=new Set(),batches=new Map(),dummy=new T.Object3D();
  const own=value=>(resources.add(value),value);
  const purple=own(new T.MeshPhysicalMaterial({color:0x626cf3,metalness:.18,roughness:.3,clearcoat:.8}));
  const silver=own(new T.MeshStandardMaterial({color:0xbfc5ff,metalness:.8,roughness:.2}));
  const paper=own(new T.MeshStandardMaterial({color:0x9aac78,roughness:.85}));
  const bands=own(new T.MeshStandardMaterial({color:0xf0e7c9,roughness:.8}));
  const cube=own(new T.BoxGeometry(1,1,1)),cylinder=own(new T.CylinderGeometry(1,1,1,32));
  function part(geometry,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();
    if(!batches.has(material))batches.set(material,[]);
    batches.get(material).push({geometry,matrix:dummy.matrix.clone()});
  }
  // A low oval foot and twin swept stems replace the heavy pedestal and handles.
  part(cylinder,purple,0,.24,0,2.6,.48,1.85);
  part(cylinder,silver,0,.51,0,2.38,.08,1.66);
  part(cylinder,purple,0,.63,0,1.75,.17,1.2);
  for(const side of [-1,1]){
    const curve=new T.CatmullRomCurve3([new T.Vector3(side*.3,.65,0),new T.Vector3(side*.7,1.25,0),new T.Vector3(side*.55,2.15,0),new T.Vector3(side*.45,2.65,0)]);
    part(own(new T.TubeGeometry(curve,18,.23,8,false)),purple,0,0,0);
  }
  const profile=[[0,2.5],[.62,2.5],[1.08,2.93],[1.66,3.65],[2.12,4.55],[2.3,5.2],[2.15,5.2],[1.98,4.6],[1.53,3.76],[.96,3.1],[0,2.84]].map(p=>new T.Vector2(...p));
  const bowlGeometry=own(new T.LatheGeometry(profile,48));
  const bowlPositions=bowlGeometry.attributes.position,bowlUv=bowlGeometry.attributes.uv;
  for(let i=0;i<bowlPositions.count;i++){
    // Place the inscription on the actual cup surface, centered toward Greek Row.
    const section=Math.floor(i/profile.length);
    bowlUv.setXY(i,section/48,(bowlPositions.getY(i)-2.5)/2.7);
  }
  bowlGeometry.rotateY(Math.PI);
  part(own(new T.TorusGeometry(2.23,.085,8,48)),silver,0,5.2,0,1,1,1,Math.PI/2);
  // Packed bundles fill the bowl. Paper edges and pale bands read as cash
  // even before the banknote artwork becomes visible at closer distances.
  for(let i=0;i<12;i++){
    const angle=i*2.39996323,radius=i<4?.5:1.35,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=4.85+(i%3)*.29;
    part(cube,paper,x,y,z,1.4,.23,.65,0,angle,.08*(i%2?1:-1));
    part(cube,bands,x,y+.015,z,.28,.27,.68,0,angle,.08*(i%2?1:-1));
  }
  // Merge by finish: the monument's solid pieces cost four static draws.
  for(const [material,parts] of batches){
    const positions=[],normals=[];
    for(const {geometry,matrix} of parts){
      const copy=geometry.index?geometry.toNonIndexed():geometry.clone();copy.applyMatrix4(matrix);
      positions.push(...copy.attributes.position.array);normals.push(...copy.attributes.normal.array);copy.dispose();
    }
    const geometry=own(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    const mesh=new T.Mesh(geometry,material);mesh.name=material===purple?'national-prize-fomo-purple':'national-prize-trim-and-bundles';mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.ownedGeometry=true;root.add(mesh);
  }
  const noteMap=createBanknoteTexture(T);if(noteMap)own(noteMap);
  const noteGeometry=own(new T.PlaneGeometry(1.45,.64,5,1)),p=noteGeometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*2)*.13);noteGeometry.computeVertexNormals();
  const noteMaterial=own(new T.MeshStandardMaterial({color:noteMap?0xffffff:0xc4d39d,map:noteMap,side:T.DoubleSide,roughness:.8}));
  const notes=own(new T.InstancedMesh(noteGeometry,noteMaterial,28));notes.name='national-prize-cash';notes.castShadow=true;
  for(let i=0;i<28;i++){
    const angle=i*2.39996323,radius=.45+(i%4)*.38;
    dummy.position.set(Math.cos(angle)*radius,5.2+(i%5)*.23,Math.sin(angle)*radius);
    dummy.rotation.set(-.3+(i%3)*.27,angle,(i%2?1:-1)*(.25+i%4*.12));dummy.scale.setScalar(1);dummy.updateMatrix();notes.setMatrixAt(i,dummy.matrix);
  }
  notes.computeBoundingSphere();root.add(notes);
  function artwork(width,height,paint){
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'));
    const map=own(new T.CanvasTexture(canvas));map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return map;
  }
  function engraving(c,bump=false){
    c.fillStyle=bump?'#ffffff':'#626cf3';c.fillRect(0,0,2048,1024);
    function cut(draw){
      if(!bump){c.save();c.translate(0,3);c.fillStyle='#b2b9ff';draw();c.restore();}
      c.fillStyle=bump?'#050505':'#bfc5ff';draw();
    }
    cut(()=>{c.save();c.translate(784,-80);c.scale(4.8,4.8);for(const path of FOMO_MARK_PATHS)c.fill(new Path2D(path));c.restore();});
    c.textAlign='center';
    cut(()=>{c.font='bold 160px Arial';c.fillText('?',1024,480);});
    cut(()=>{c.font='bold 86px Arial';c.fillText('NATIONAL',1024,630);c.font='bold 96px Arial';c.fillText('CHAMPION',1024,755);});
  }
  const inscription=artwork(1024,512,c=>{c.scale(.5,.5);engraving(c);});
  const recess=artwork(1024,512,c=>{c.scale(.5,.5);engraving(c,true);});if(recess)recess.colorSpace=T.NoColorSpace;
  const bowlMaterial=own(new T.MeshPhysicalMaterial({color:inscription?0xffffff:0x626cf3,map:inscription,bumpMap:recess,bumpScale:.075,metalness:.18,roughness:.3,clearcoat:.8}));
  const bowl=new T.Mesh(bowlGeometry,bowlMaterial);bowl.name='national-prize-engraved-cup';bowl.userData.ownedGeometry=true;bowl.castShadow=true;bowl.receiveShadow=true;root.add(bowl);
  root.userData.prizeAmount=null;root.userData.label=NATIONAL_PRIZE_COPY.join(' · ');
  return {root,dispose(){root.removeFromParent();for(const resource of resources)resource.dispose();}};
}
