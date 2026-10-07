import {createLots,rowExtension} from './village-layout.js?v=167';
import {hash} from './village-district-layout.js?v=80';

// Keep every house, backyard and claim lot supported, then add land as members join.
export function islandFootprint(chapters=[]){
 const lots=createLots(chapters.length),members=chapters.reduce((n,c)=>n+Math.max(0,Number(c.joined)||0),0),extension=rowExtension(chapters.length);
 const growth=2+Math.sqrt(members)*.16+chapters.length*.15;
 const minX=Math.min(-32,...lots.map(l=>l.x-23)),maxX=Math.max(32,...lots.map(l=>l.x+23));
 const minZ=-40,maxZ=Math.max(52+extension,...lots.map(l=>l.z+20));
 const spec={x:(minX+maxX)/2,z:(minZ+maxZ)/2,rx:(maxX-minX)/2,rz:(maxZ-minZ)/2,depth:36+Math.sqrt(chapters.length)*2+Math.sqrt(members)*.25,members,chapters:chapters.length};
 let support=1;const power=2/.6;
 for(const lot of lots)for(const dx of [-20,20])for(const dz of [-9,9])support=Math.max(support,Math.pow(Math.pow(Math.abs(lot.x+dx-spec.x)/spec.rx,power)+Math.pow(Math.abs(lot.z+dz-spec.z)/spec.rz,power),1/power)/.94);
 spec.rx=spec.rx*support+growth;spec.rz=spec.rz*support+growth;return spec;
}
export function islandOutline(spec,seed='island',segments=96){
 return Array.from({length:segments},(_,i)=>{const a=i/segments*Math.PI*2,r=1+.025*Math.sin(a*5+hash(seed)*3)+.018*Math.sin(a*9)+.009*Math.sin(a*17);return [spec.x+Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.6)*spec.rx*r,spec.z+Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.6)*spec.rz*r];});
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
 const rings=[[1,.035],[1,-.5],[.995,-1.8],[1.005,-4],[.99,-7],[.96,-11],[.93,-16],[.88,-spec.depth*.48],[.82,-spec.depth*.62],[.72,-spec.depth*.76],[.57,-spec.depth*.9],[.38,-spec.depth*1.04],[.18,-spec.depth*1.16],[0,-spec.depth*1.22]];
 const color=new T.Color(),palette=[0x697b46,0x665a43,0x807867,0x928b79,0x7c776b,0x8c8577,0x77746b,0x817d72,0x746f65,0x6d6b65,0x64645f,0x5e615e,0x565b5a];
 function point(r,i){
  const index=i%outline.length,[scale,y]=rings[r],p=outline[index],a=index/outline.length*Math.PI*2;
  const erosion=r<3||scale===0?0:Math.sin(a*7+r*.8)*.018+Math.sin(a*13-r*.4)*.012;
  const vertical=r<2?0:(Math.sin(a*5+r*.7)*.8+Math.sin(a*11)*.35)*Math.min(1,r/4);
  return [spec.x+(p[0]-spec.x)*(scale+erosion),y+vertical,spec.z+(p[1]-spec.z)*(scale+erosion)];
 }
 const indices=[];
 for(let r=0;r<rings.length;r++)for(let i=0;i<outline.length;i++){
  vertices.push(...point(r,i));color.setHex(palette[Math.min(r,palette.length-1)]).multiplyScalar(.94+hash(school.id,Math.floor(i/5),r,'stone')*.12);colors.push(color.r,color.g,color.b);
  if(r<rings.length-1){const a=r*outline.length+i,b=r*outline.length+(i+1)%outline.length,c=a+outline.length,d=b+outline.length;indices.push(a,b,c,b,d,c);}
 }
 const geometry=own(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const rockMaterial=own(new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));
 rockMaterial.customProgramCacheKey=()=> 'weathered-island-stone-v149';
 rockMaterial.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 islandStonePoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nislandStonePoint=position;');
  shader.fragmentShader=`varying vec3 islandStonePoint;
float stoneHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float stoneNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(stoneHash(i),stoneHash(i+vec3(1,0,0)),f.x),mix(stoneHash(i+vec3(0,1,0)),stoneHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(stoneHash(i+vec3(0,0,1)),stoneHash(i+vec3(1,0,1)),f.x),mix(stoneHash(i+vec3(0,1,1)),stoneHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat mineral=stoneNoise(islandStonePoint*.3);float grain=stoneNoise(islandStonePoint*3.0);float layers=sin(islandStonePoint.y*1.8+mineral*4.0);diffuseColor.rgb*=.79+.26*mineral+.12*grain+.045*layers;');
 };
 const rock=new T.Mesh(geometry,rockMaterial);rock.name='island-rock-undercut';rock.receiveShadow=true;root.add(rock);
 // Feathered clouds float above the campus; all sixty share one draw call.
 let cloudTexture=null;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const ctx=canvas.getContext('2d');
  for(let i=0;i<12;i++){const x=35+hash(i,'cloud-x')*186,y=47+hash(i,'cloud-y')*34,r=21+hash(i,'cloud-radius')*23,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.34)');g.addColorStop(.4,'rgba(255,255,255,.24)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  cloudTexture=own(new T.CanvasTexture(canvas));
 }
 const cloudMaterial=own(new T.MeshBasicMaterial({map:cloudTexture,color:0xf4f8ff,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide}));
 const clouds=new T.InstancedMesh(own(new T.PlaneGeometry(1,1)),cloudMaterial,60),dummy=new T.Object3D(),cloudPositions=[];clouds.name='island-clouds';clouds.frustumCulled=false;root.add(clouds);
 for(let i=0;i<60;i++){const group=Math.floor(i/5),a=group*Math.PI*2/12,r=.35+hash(school.id,group,'cloud')*.55;cloudPositions.push({x:spec.x+Math.cos(a)*spec.rx*r+(i%5-2)*7,y:52+hash(group,school.id)*16,z:spec.z+Math.sin(a)*spec.rz*r+Math.sin(i)*5,w:37+hash(i,'wide')*24,h:17+hash(i,'tall')*10});}
 function faceClouds(camera){for(let i=0;i<cloudPositions.length;i++){const p=cloudPositions[i];dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,1);if(camera)dummy.quaternion.copy(camera.quaternion);dummy.updateMatrix();clouds.setMatrixAt(i,dummy.matrix);}clouds.instanceMatrix.needsUpdate=true;}faceClouds();
 const stadium={root:new T.Group(),setNight(){},bounds:new T.Sphere(new T.Vector3(),1)};
 return {root,spec,stadium,pedestrians:[],building:false,update(){return false;},animate(time,x,z,camera){faceClouds(camera);},setNight(night){cloudMaterial.color.setHex(night?0x71829f:0xf4f8ff);},dispose(){clouds.dispose();resources.forEach(r=>r.dispose());root.removeFromParent();}};
}
