import {createLots,rowExtension} from './village-layout.js?v=146';
import {hash} from './village-district-layout.js?v=80';

// Keep every house, backyard and claim lot supported, then add land as members join.
export function islandFootprint(chapters=[]){
 const lots=createLots(chapters.length),members=chapters.reduce((n,c)=>n+Math.max(0,Number(c.joined)||0),0),extension=rowExtension(chapters.length);
 const growth=6+Math.sqrt(members)*.48+chapters.length*.35;
 const minX=Math.min(-32,...lots.map(l=>l.x-23)),maxX=Math.max(32,...lots.map(l=>l.x+23));
 const minZ=-40,maxZ=Math.max(52+extension,...lots.map(l=>l.z+20));
 return {x:(minX+maxX)/2,z:(minZ+maxZ)/2,rx:(maxX-minX)/2+growth,rz:(maxZ-minZ)/2+growth,depth:48+Math.sqrt(chapters.length)*3+Math.sqrt(members)*.5,members,chapters:chapters.length};
}
export function islandOutline(spec,seed='island',segments=64){
 return Array.from({length:segments},(_,i)=>{const a=i/segments*Math.PI*2,r=1+.022*Math.sin(a*5+hash(seed)*3)+.014*Math.sin(a*9);return [spec.x+Math.sign(Math.cos(a))*Math.sqrt(Math.abs(Math.cos(a)))*spec.rx*r,spec.z+Math.sign(Math.sin(a))*Math.sqrt(Math.abs(Math.sin(a)))*spec.rz*r];});
}
export function islandOverview(spec,aspect=1){
 const phi=.45,theta=.58,target=[spec.x,-7,spec.z];
 // Fit the actual silhouette from this angle, including the rocky underside.
 const tangent=Math.tan(Math.PI*24/180),sin=Math.sin(theta),cos=Math.cos(theta),up=Math.sin(phi),flat=Math.cos(phi);
 let radius=110;
 for(const [scale,y] of [[1.04,0],[.72,24],[.98,-15],[.8,-spec.depth*.62],[.44,-spec.depth*.95],[0,-spec.depth*1.18]])for(let i=0;i<32;i++){
  const a=i/32*Math.PI*2,x=Math.sign(Math.cos(a))*Math.sqrt(Math.abs(Math.cos(a)))*spec.rx*scale,z=Math.sign(Math.sin(a))*Math.sqrt(Math.abs(Math.sin(a)))*spec.rz*scale,dy=y-target[1];
  const depth=x*sin*flat+dy*up+z*cos*flat,horizontal=x*cos-z*sin,vertical=-x*sin*up+dy*flat-z*cos*up;
  radius=Math.max(radius,depth+Math.max(Math.abs(horizontal)/(tangent*Math.max(.2,aspect)),Math.abs(vertical)/tangent));
 }
 radius*=1.12;
 return {target,theta,phi,radius};
}
// A bounded floor, with the same road UVs as the village but no land beyond the edge.
export function islandFloorGeometry(T,spec,seed,extension=0){
 const outline=islandOutline(spec,seed),positions=[],uvs=[];
 const clip=(poly,z,greater)=>poly.flatMap((p,i)=>{const q=poly[(i+1)%poly.length],inside=greater?p[1]>=z:p[1]<=z,next=greater?q[1]>=z:q[1]<=z;const crossing=inside!==next?[p[0]+(q[0]-p[0])*(z-p[1])/(q[1]-p[1]),z]:null;return inside?(crossing?[p,crossing]:[p]):crossing?[crossing]:[];});
 const edges=[-Infinity,30];for(let z=49;z<30+extension;z+=19)edges.push(z);if(extension)edges.push(30+extension);edges.push(Infinity);
 for(let k=0;k<edges.length-1;k++){
  let poly=outline;if(Number.isFinite(edges[k]))poly=clip(poly,edges[k],true);if(Number.isFinite(edges[k+1]))poly=clip(poly,edges[k+1],false);if(poly.length<3)continue;
  const mapped=z=>k===0?z:k===edges.length-2?z-extension:-9.5+z-edges[k];
  for(let i=1;i<poly.length-1;i++)for(const p of [poly[0],poly[i+1],poly[i]]){positions.push(p[0],-p[1],0);uvs.push(p[0]/300+.5,.5-mapped(p[1])/300);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();return geometry;
}
export function createFloatingIsland(T,school,chapters=[]){
 const root=new T.Group();root.name='floating-campus-island';const spec=islandFootprint(chapters),outline=islandOutline(spec,school.id),resources=new Set();root.userData={...spec};
 const own=x=>(resources.add(x),x),vertices=[],colors=[];
 const rings=[[1,.035],[1,-2.2],[.98,-15],[.8,-spec.depth*.62],[.44,-spec.depth*.95],[0,-spec.depth*1.18]];
 const color=new T.Color(),palette=[0x879b58,0x6b7562,0x7c756c,0x606e78,0x45586d];
 function point(r,i){const [scale,y]=rings[r],p=outline[i%outline.length];return [spec.x+(p[0]-spec.x)*scale,y+(r>1?hash(school.id,r,i%outline.length)*2.8:0),spec.z+(p[1]-spec.z)*scale];}
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<outline.length;i++){
  const a=point(r,i),b=point(r,i+1),c=point(r+1,i),d=point(r+1,i+1);color.setHex(palette[r]).multiplyScalar(.82+hash(school.id,r,i,'rock')*.3);
  for(const p of [a,b,c,b,d,c]){vertices.push(...p);colors.push(color.r,color.g,color.b);}
 }
 const geometry=own(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const rock=new T.Mesh(geometry,own(new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,side:T.DoubleSide})));rock.name='island-rock-undercut';rock.receiveShadow=true;root.add(rock);
 // Soft clustered cloud forms below the land make the sky setting readable at every angle.
 const cloudMaterial=own(new T.MeshStandardMaterial({color:0xf4f8ff,roughness:1,flatShading:false,transparent:true,opacity:.82,depthWrite:false}));
 const clouds=new T.InstancedMesh(own(new T.SphereGeometry(1,12,8)),cloudMaterial,60),dummy=new T.Object3D();clouds.name='island-clouds';clouds.frustumCulled=false;root.add(clouds);
 for(let i=0;i<60;i++){const group=Math.floor(i/5),a=group*Math.PI*2/12,r=1.4+hash(school.id,group,'cloud')*.8;dummy.position.set(spec.x+Math.cos(a)*spec.rx*r+(i%5-2)*8,-spec.depth-12-hash(group,school.id)*24,spec.z+Math.sin(a)*spec.rz*r+Math.sin(i)*5);dummy.scale.set(15+hash(i,'wide')*12,5+hash(i,'tall')*5,10+hash(i,'deep')*10);dummy.updateMatrix();clouds.setMatrixAt(i,dummy.matrix);}clouds.instanceMatrix.needsUpdate=true;
 const stadium={root:new T.Group(),setNight(){},bounds:new T.Sphere(new T.Vector3(),1)};
 return {root,spec,stadium,pedestrians:[],building:false,update(){return false;},animate(){},setNight(night){cloudMaterial.color.setHex(night?0x71829f:0xf4f8ff);},dispose(){clouds.dispose();resources.forEach(r=>r.dispose());root.removeFromParent();}};
}
