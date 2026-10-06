// Short continuous descent with a gentle canopy opening and exact island handoff.
export const SCHOOL_DROP_DURATION=4.4;
export function createSchoolDrop(T,scene){
// A nine-cell ram-air canopy inflates unevenly, then tensions its suspension lines.
// Only cloth and cords enter the POV: no hands, arms, or artificial camera mount.
const canopyRig=new T.Group();canopyRig.name='pov-parachute';scene.add(canopyRig);
const canopyMaterials=[0x516af6,0xf4f6ff,0x283987].map(color=>new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:.86,emissive:color,emissiveIntensity:.32,transparent:true,opacity:1}));
const cordMaterial=new T.MeshStandardMaterial({color:0xcbd1de,roughness:.85,transparent:true,opacity:1});
const seamMaterial=new T.MeshStandardMaterial({color:0x353e63,roughness:.9,transparent:true,opacity:1});
const canopyCells=[],canopySeams=[],canopyCords=[];
const unitUp=new T.Vector3(0,1,0),lineA=new T.Vector3(),lineB=new T.Vector3(),lineDelta=new T.Vector3();
function rigLine(parent,r,material){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,1,5),material);parent.add(mesh);return mesh;}
function placeLine(mesh,a,b){lineA.set(...a);lineB.set(...b);lineDelta.copy(lineB).sub(lineA);mesh.position.copy(lineA).add(lineB).multiplyScalar(.5);mesh.scale.y=lineDelta.length();mesh.quaternion.setFromUnitVectors(unitUp,lineDelta.normalize());}
function canopyPoint(x,v,openLeft,openRight,flutter,upper=false){
  const side=(x/3.375+1)*.5,open=openLeft+(openRight-openLeft)*side;
  const span=x*(.085+.915*open),arch=1-(x/3.375)**2;
  // The packed bundle becomes an arched, visibly deep fabric wing.
  const cell=(x+3.375)/.75,belly=.065*Math.sin((cell-Math.floor(cell))*Math.PI)*Math.sin(v*Math.PI);
  const y=.76+open*(1.32+.30*arch+.28*Math.sin(v*Math.PI)+belly+(upper?.045+.22*Math.sin(v*Math.PI):0));
  const z=-1.24+open*(-2.58+2.66*v)+flutter*Math.sin(v*Math.PI)*(1-open*.8);
  return [span,y+flutter*.12*Math.sin(v*Math.PI+side*2),z];
}
for(let cell=0;cell<9;cell++){
  const x0=-3.375+cell*.75;
  for(const upper of [false,true]){
    const positions=[],indices=[];
    for(let j=0;j<=12;j++)for(let k=0;k<=2;k++)positions.push(...canopyPoint(x0+k*.375,j/12,1,1,0,upper));
    for(let j=0;j<12;j++)for(let k=0;k<2;k++){const i=j*3+k;indices.push(i,i+1,i+3,i+1,i+4,i+3);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const panel=new T.Mesh(geometry,canopyMaterials[cell%3===1?1:cell%3===2?2:0]);panel.name=upper?'parachute-inflated-upper-cell':'parachute-visible-cloth';canopyRig.add(panel);canopyCells.push({geometry,x0,upper});
  }
}
for(let rib=0;rib<=9;rib++)for(let j=0;j<12;j++)canopySeams.push({mesh:rigLine(canopyRig,.008,seamMaterial),x:-3.375+rib*.75,v0:j/12,v1:(j+1)/12});
for(const side of [-1,1])for(const x of [1.65,2.5,3.18])for(const v of [.04,.88])canopyCords.push({side,x,v,a:rigLine(canopyRig,.007,cordMaterial),b:rigLine(canopyRig,.007,cordMaterial)});
canopyRig.visible=false;


const clamp01=x=>Math.max(0,Math.min(1,x));
const smoother=(a,b,x)=>{const u=clamp01((x-a)/(b-a));return u*u*u*(10+u*(-15+6*u));};
// Integrate a smooth velocity profile: accelerate in freefall, brake under canopy,
// then steadily lose speed on approach. No second dive after the canopy opens.
function distanceRemaining(knots,t){
 let distance=0;
 for(let i=0;i<knots.length-1;i++){
  const [a,v0]=knots[i],[b,v1]=knots[i+1],dt=b-a,u=clamp01((t-a)/dt);
  const primitive=x=>v0*x+(v1-v0)*(x*x*x-.5*x*x*x*x);
  distance+=dt*(primitive(1)-primitive(u));
 }
 return distance;
}
function openingMotion(t){const age=Math.max(0,t-2.55);return {swing:.22*Math.exp(-2.8*age)*Math.sin(5*age),recoil:0,age};}
const FALL_SPEED=[[0,22],[.9,47],[1.55,20],[4.4,0]];
const GLIDE_SPEED=[[0,20],[.9,26],[1.55,16],[4.4,0]];
function updateCanopy(t,pose){
  canopyRig.visible=t>=2.4;if(!canopyRig.visible)return;
  const left=smoother(2.4,2.61,t),right=smoother(2.445,2.70,t),taut=smoother(2.48,2.57,t);
  const motion=openingMotion(t);
  const flutter=.06*Math.exp(-Math.max(0,t-2.55)*4)*Math.sin((t-2.4)*29);
  for(const cell of canopyCells){const a=cell.geometry.attributes.position;let i=0;for(let j=0;j<=12;j++)for(let k=0;k<=2;k++){a.setXYZ(i++,...canopyPoint(cell.x0+k*.375,j/12,left,right,flutter,cell.upper));}a.needsUpdate=true;cell.geometry.computeVertexNormals();}
  for(const seam of canopySeams)placeLine(seam.mesh,canopyPoint(seam.x,seam.v0,left,right,flutter),canopyPoint(seam.x,seam.v1,left,right,flutter));
  for(const cord of canopyCords){
    const anchor=[cord.side*.39,-.84,cord.v>.5?.1:-.2],end=canopyPoint(cord.side*cord.x,cord.v,left,right,flutter);
    const mid=anchor.map((n,i)=>(n+end[i])*.5);mid[0]+=cord.side*.30*(1-taut);mid[1]-=.50*(1-taut);
    placeLine(cord.a,anchor,mid);placeLine(cord.b,mid,end);
  }
  canopyRig.scale.setScalar(1);
  canopyRig.position.copy(pose.position);
  canopyRig.rotation.set(.095*motion.recoil,pose.yaw+.025*motion.swing,-.075*(left-right)-.055*motion.swing);
  const opacity=smoother(2.395,2.425,t);
  for(const m of [...canopyMaterials,cordMaterial,seamMaterial])m.opacity=opacity;
}


const cloudRoot=new T.Group();scene.add(cloudRoot);cloudRoot.visible=false;
if(typeof document!=='undefined'){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,3,64,64,62);g.addColorStop(0,'rgba(255,255,255,.6)');g.addColorStop(.45,'rgba(237,241,255,.3)');g.addColorStop(1,'rgba(237,241,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const texture=new T.CanvasTexture(canvas);
 for(let i=0;i<18;i++){const a=i*2.399,r=25+i*4,m=new T.SpriteMaterial({map:texture,color:0xd2dbea,transparent:true,opacity:.55,depthWrite:false,fog:false}),cloud=new T.Sprite(m);cloud.position.set(Math.sin(a)*r,115+i*24,Math.cos(a)*r+80);cloud.scale.set(65+i%4*22,30+i%3*12,1);cloudRoot.add(cloud);}
}
let path=null;
return {root:canopyRig,begin({anchor,extension=0,aspect=1,overview=null}){
 path={z:anchor?.lot.z??-19,x:anchor?.lot.originX??0,extension,aspect,overview};
 cloudRoot.visible=true;cloudRoot.position.set(path.x,0,path.z+19);
 for(const m of [...canopyMaterials,cordMaterial,seamMaterial])m.opacity=1;
},update(time,camera){
 if(!path)return;time=Math.max(0,Math.min(time,SCHOOL_DROP_DURATION));if(time>SCHOOL_DROP_DURATION-1e-9)time=SCHOOL_DROP_DURATION;cloudRoot.visible=time<1.4;
 const view=path.overview||{target:[path.x,3,path.z],radius:path.aspect<1?78:58,theta:.5,phi:.4},target=new T.Vector3(...view.target),r=view.radius;
 const end=target.clone().add(new T.Vector3(Math.sin(view.theta)*Math.cos(view.phi)*r,Math.sin(view.phi)*r,Math.cos(view.theta)*Math.cos(view.phi)*r));
 const settle=smoother(0,SCHOOL_DROP_DURATION,time),height=distanceRemaining(FALL_SPEED,time),forward=distanceRemaining(GLIDE_SPEED,time);
 camera.position.copy(end).add(new T.Vector3(-8*(1-settle),height,forward));
 const opening=smoother(.9,1.55,time),roll=(.008*Math.sin(time*1.7)+.007*opening*Math.exp(-Math.max(0,time-1.15)*2)*Math.sin(time*5))*(1-settle);
 camera.fov=64+4*smoother(0,.9,time)-6*opening-14*smoother(1.55,SCHOOL_DROP_DURATION,time);
 camera.far=Math.max(1800,r*3);camera.near=.1;camera.updateProjectionMatrix();camera.lookAt(target);camera.rotateZ(roll);camera.updateMatrixWorld();
 const canopyTime=time<.9?2.3:time<1.55?2.4+(time-.9)/.65*.32:2.72+(time-1.55)*.6;updateCanopy(canopyTime,{position:camera.position,yaw:Math.atan2(camera.position.x-target.x,camera.position.z-target.z)});
 const opacity=smoother(2.395,2.425,canopyTime)*(1-smoother(3.1,4.25,time));for(const m of [...canopyMaterials,cordMaterial,seamMaterial])m.opacity=opacity;
 return {target:target.toArray(),theta:view.theta,phi:view.phi,radius:r};
},finish(){path=null;canopyRig.visible=false;cloudRoot.visible=false;},dispose(){const resources=new Set();canopyRig.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[]))resources.add(m);});cloudRoot.traverse(o=>{if(o.material){resources.add(o.material);if(o.material.map)resources.add(o.material.map);}});resources.forEach(r=>r.dispose());canopyRig.removeFromParent();cloudRoot.removeFromParent();}};
}
