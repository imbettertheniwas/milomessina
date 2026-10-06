// Adapted directly from the authored V13 camera track and nine-cell canopy.
export const SCHOOL_DROP_DURATION=6.4;
export function createSchoolDrop(T,scene){
// A nine-cell ram-air canopy inflates unevenly, then tensions its suspension lines.
// Only cloth and cords enter the POV: no hands, arms, or artificial camera mount.
const canopyRig=new T.Group();canopyRig.name='pov-parachute';scene.add(canopyRig);
const canopyMaterials=[0x7379c2,0xd5d9eb,0x515794].map(color=>new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:.86,emissive:color,emissiveIntensity:.32,transparent:true,opacity:1}));
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


const DURATION=163/30;
const MOTION_SPEED=145/107, OPENING_TRIM=77/30-MOTION_SPEED*51/30;
const sourceTimeAt=t=>OPENING_TRIM+MOTION_SPEED*t;
const outputTimeAt=t=>(t-OPENING_TRIM)/MOTION_SPEED;
const clamp01=x=>Math.max(0,Math.min(1,x));
const smoother=(a,b,x)=>{const u=clamp01((x-a)/(b-a));return u*u*u*(10+u*(-15+6*u));};
function track(knots,t){
  if(t<=knots[0][0])return knots[0][1];
  if(t>=knots[knots.length-1][0])return knots[knots.length-1][1];
  let i=0;while(t>knots[i+1][0])i++;
  const [ta,p0,v0=0]=knots[i],[tb,p1,v1=0]=knots[i+1],dt=tb-ta,u=(t-ta)/dt,d=p1-p0,m0=v0*dt,m1=v1*dt;
  return p0+m0*u+(10*d-6*m0-4*m1)*u**3+(-15*d+8*m0+7*m1)*u**4+(6*d-3*m0-3*m1)*u**5;
}
// Stay airborne and moving under the open canopy through the flyby and quick exit.
const HEIGHT=[[0,500,-125],[2.4,65,-250],[2.55,37.5,-70],[2.78,29,-14],[2.95,26.5,-14],[4.7,10,-5],[6.25,7,-1],[8.4,6,-.25]];
const FORWARD=[[0,148,-45],[2.4,62,-30],[2.55,58.3,-20],[2.95,46.5,-23],[4.7,8,-20],[6.25,-18,-10],[8.4,-36,-7]];
const LATERAL=[[0,3.5,-1],[2.4,.5,-1],[2.55,.29,-1.2],[2.95,-.36,0],[4.7,.15,0],[6.25,.08,0],[8.4,.12,0]];
const YAW=[[0,.012,0],[2.4,.025,0],[2.95,-.10,0],[4.7,.045,0],[6.25,-.025,0],[8.4,-.025,0]];
const PITCH=[[0,-1.14,0],[2.4,-.74,0],[2.55,-.37,0],[2.95,-.035,0],[4.7,-.045,0],[6.25,.10,0],[8.4,.10,0]];
const FOV=[[0,92,0],[2.4,94,0],[2.55,86,0],[2.95,77,0],[6.25,72,0],[7.3,72,0],[8.4,68,0]];
function openingMotion(t){
  const age=Math.max(0,t-2.55),active=t>=2.55?1:0;
  const swing=active*Math.exp(-1.72*age)*Math.sin(8.7*age);
  const recoil=active*Math.exp(-2.8*age)*Math.sin(12.1*age);
  const snatch=Math.exp(-(((t-2.565)/.041)**2));
  return {swing,recoil,snatch,age};
}
function cameraPose(t){
  const suspended=smoother(2.45,2.69,t);
  const skyTurn=0;
  const motion=openingMotion(t),settle=1;
  const x=track(LATERAL,t)+.30*motion.swing*settle;
  const y=track(HEIGHT,t)+.075*motion.recoil*settle-.055*motion.snatch;
  const z=track(FORWARD,t)+.17*motion.swing*settle;
  const yaw=track(YAW,t)+.041*motion.swing*settle;
  const pitch=track(PITCH,t)*(1-skyTurn)+1.40*skyTurn+.63*motion.snatch-.23*motion.recoil*settle;
  const roll=.085*(1-smoother(0,2.4,t))+.077*motion.snatch+.061*motion.swing*settle;
  const direction=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  return {position:new T.Vector3(x,y,z),direction,yaw,roll,fov:track(FOV,t)*(1-skyTurn)+68*skyTurn+1.4*motion.snatch,suspended,transition:skyTurn,phase:t<2.4?'freefall':t<2.95?'canopy-opening':t<6.3?'parachute-glide':t<7.4?'parachute-glide-flyby':'quick-sky-transition'};
}
function updateCanopy(t,pose){
  canopyRig.visible=t>=2.4;if(!canopyRig.visible)return;
  const left=smoother(2.4,2.61,t),right=smoother(2.445,2.70,t),taut=smoother(2.48,2.57,t);
  const motion=openingMotion(t);
  const flutter=.13*Math.exp(-Math.max(0,t-2.55)*4)*Math.sin((t-2.4)*29);
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
return {root:canopyRig,begin({anchor,extension=0,aspect=1,overview=null}){path={z:anchor?.lot.z??-19,x:anchor?.lot.originX??0,extension,aspect,overview};cloudRoot.visible=true;cloudRoot.position.set(path.x,0,path.z+19);},update(time,camera){
 if(!path)return;cloudRoot.visible=time<2.2;const t=sourceTimeAt(Math.min(time,4.85)),pose=cameraPose(t),shift=path.z+19;pose.position.x+=path.x;pose.position.z+=shift;
 const blend=smoother(4.85,SCHOOL_DROP_DURATION,time),view=path.overview||{target:[path.x,3,path.z],radius:path.aspect<1?78:58,theta:.5,phi:.4},target=new T.Vector3(...view.target),r=view.radius,end=target.clone().add(new T.Vector3(Math.sin(view.theta)*Math.cos(view.phi)*r,Math.sin(view.phi)*r,Math.cos(view.theta)*Math.cos(view.phi)*r));
 const aim=pose.position.clone().addScaledVector(pose.direction,30).lerp(target,blend);camera.position.copy(pose.position).lerp(end,blend);camera.fov=pose.fov+(48-pose.fov)*blend;camera.far=1800;camera.near=.1;camera.updateProjectionMatrix();camera.lookAt(aim);camera.rotateZ(pose.roll*(1-blend));camera.updateMatrixWorld();updateCanopy(t,pose);
 for(const m of [...canopyMaterials,cordMaterial,seamMaterial])m.opacity*=1-smoother(4.9,5.65,time);
 return {target:target.toArray(),theta:view.theta,phi:view.phi,radius:r};
},finish(){path=null;canopyRig.visible=false;cloudRoot.visible=false;},dispose(){const resources=new Set();canopyRig.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[]))resources.add(m);});cloudRoot.traverse(o=>{if(o.material){resources.add(o.material);if(o.material.map)resources.add(o.material.map);}});resources.forEach(r=>r.dispose());canopyRig.removeFromParent();cloudRoot.removeFromParent();}};
}
