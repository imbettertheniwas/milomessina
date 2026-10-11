// Scenery spectators, separate from the village's registered-member population.
export const HELIPAD_FAN_COUNT=48;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const seed=(i,k)=>{const n=Math.sin(i*127.1+k*311.7)*43758.5453;return n-Math.floor(n);};
function fanPath(i,time){
  const t=((time%134)+134)%134,delay=seed(i,1)*6.2;
  const alongCarpet=i>=32,ringAngle=-2.5+(i%16)/15*5,ringRadius=12.8+Math.floor(i/16)*2.2;
  const targetX=alongCarpet?-27+(i%8)*2.05:Math.cos(ringAngle)*ringRadius;
  const targetZ=alongCarpet?.3+(i<40?-2.6:2.6):Math.sin(ringAngle)*ringRadius;
  // These same students are on the campus paths before and after the car
  // arrives. Their small, individually phased routes loop without a reset pop.
  const idleAngle=t/134*Math.PI*2*(1+i%3)+seed(i,13)*Math.PI*2;
  const strolling=i%3!==0;
  const east=i<24,curb=i>=24&&i<36;
  const homeX=east?35.3+(seed(i,14)-.5)*2:curb?-33+(seed(i,14)-.5): -29+(i-36)/11*61;
  const homeZ=east?-55+i/23*84:curb?Math.sign(targetZ)*(11+(i%6)*3.2):35+(seed(i,15)-.5);
  const startX=homeX+(strolling?Math.sin(idleAngle)*.4:0);
  const startZ=homeZ+(strolling?Math.cos(idleAngle)*(east?2.2:.7):0);
  const startAngle=Math.atan2(startZ,startX),targetAngle=Math.atan2(targetZ,targetX);
  const approachDistance=Math.hypot(Math.hypot(startX,startZ)-Math.hypot(targetX,targetZ),(Math.hypot(startX,startZ)+Math.hypot(targetX,targetZ))*.5*(targetAngle-startAngle));
  const travel=Math.max(7,approachDistance/(4.5+seed(i,2)));
  const arrive=smooth((t-8.5-delay)/travel),leave=smooth((t-107-delay)/(12+seed(i,3)*5)),amount=arrive*(1-leave);
  const angle=startAngle+(targetAngle-startAngle)*amount,radius=Math.hypot(startX,startZ)*(1-amount)+Math.hypot(targetX,targetZ)*amount;
  const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,gathering=amount>.001&&amount<.999,moving=gathering||(amount<=.001&&strolling),excited=amount>.98;
  return {t,x,z,amount,moving,excited,strolling,alongCarpet};
}
export function helipadFanPose(i,time){
  const {t,x,z,amount,moving,excited,strolling,alongCarpet}=fanPath(i,time);
  const next=fanPath(i,time+.02),toward=Math.atan2(-x,alongCarpet?.3-z:-z);
  const direction=Math.atan2(next.x-x,next.z-z),settle=smooth((amount-.96)/.04);
  const heading=moving?direction+Math.atan2(Math.sin(toward-direction),Math.cos(toward-direction))*settle:toward;
  const phase=time*(7.5+seed(i,4)*3.5)+seed(i,5)*Math.PI*2,beat=(t+seed(i,6)*19)%(6+seed(i,7)*9),gesture=smooth(beat/.8)*(1-smooth((beat-2.2)/1.1));
  const behavior=i%5,phoneRaise=behavior===0?.92:behavior===1?gesture:behavior===2?.65:behavior===3?.3+gesture*.65:gesture*.55;
  // Most spectators keep their feet on the ground. Only a few occasionally
  // hop; each person's recording, waving and weight shifts have their own beat.
  const hop=excited&&i%13===0&&beat<.65?Math.sin(beat/.65*Math.PI)*.12:0;
  return {x,z,heading:heading+(excited?Math.sin(t*.23+seed(i,8)*6)*.09:0),moving,excited,visible:true,phase:strolling&&amount<=.001?phase*.35:phase,
    height:.92+seed(i,9)*.16,hop,lean:excited?Math.sin(t*(.45+seed(i,10)*.3)+i)*.018:0,
    phoneRaise:excited?phoneRaise:0,wave:excited&&behavior===2?gesture:0,twoHands:behavior===0||behavior===1,
    headTurn:excited?Math.sin(t*(.3+seed(i,11)*.3)+i)*.16:0,headTilt:excited?Math.sin(t*.4+i)*.045:0,
    flash:excited&&phoneRaise>.75&&behavior!==0&&beat>1.3&&beat<1.39};
}
export function createHelipadFans({T,root,own,cube,ball}){
  const group=new T.Group();group.name='excited-helicopter-spectators';group.userData.scenery=true;root.add(group);
  const material=own(new T.MeshStandardMaterial({color:0xffffff,roughness:.88}));
  const parts=own(new T.InstancedMesh(cube,material,HELIPAD_FAN_COUNT*10)),heads=own(new T.InstancedMesh(ball,material,HELIPAD_FAN_COUNT));
  const flashes=own(new T.InstancedMesh(cube,own(new T.MeshBasicMaterial({color:0xffffff})),HELIPAD_FAN_COUNT));
  for(const mesh of [parts,heads,flashes]){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;group.add(mesh);}
  parts.name='spectators-clothing-and-phones';heads.name='spectators-heads';flashes.name='phone-camera-flashes';
  const actor=new T.Object3D(),piece=new T.Object3D(),matrix=new T.Matrix4(),color=new T.Color(),up=new T.Vector3(0,1,0);
  const shirts=[0x516af6,0xeaedff,0x272332,0xb76552,0x7a9b74,0xe7bd60],skins=[0xe1b18a,0x9a6548,0xc98f67,0x704a38];
  function put(mesh,index,pos,scale,hex,rotation=0,yaw=0){piece.position.set(...pos);piece.rotation.set(rotation,yaw,0);piece.scale.set(...scale);piece.updateMatrix();matrix.multiplyMatrices(actor.matrix,piece.matrix);mesh.setMatrixAt(index,matrix);if(hex!==undefined)mesh.setColorAt(index,color.setHex(hex));}
  function limb(index,a,b,width,hex){const av=new T.Vector3(...a),bv=new T.Vector3(...b);piece.position.copy(av).add(bv).multiplyScalar(.5);piece.quaternion.setFromUnitVectors(up,bv.clone().sub(av).normalize());piece.scale.set(width,av.distanceTo(bv),width);piece.updateMatrix();matrix.multiplyMatrices(actor.matrix,piece.matrix);parts.setMatrixAt(index,matrix);parts.setColorAt(index,color.setHex(hex));}
  function update(time){
    for(let i=0;i<HELIPAD_FAN_COUNT;i++){
      const p=helipadFanPose(i,time),gait=Math.sin(p.phase),jump=p.moving?Math.abs(gait)*.035:p.hop;
      actor.position.set(p.x,.25+jump,p.z);actor.rotation.set(0,p.heading,p.lean);actor.scale.setScalar(p.visible?p.height:0);actor.updateMatrix();const n=i*10,shirt=shirts[i%shirts.length],skin=skins[i%skins.length];
      put(parts,n,[0,1.13,0],[.46,.6,.26],shirt);
      put(heads,i,[0,1.67,0],[.15,.19,.15],skin,p.headTilt,p.headTurn);
      put(parts,n+1,[0,1.81,-.02],[.3,.11,.27],i%3?0x382b26:0xdec79a,p.headTilt,p.headTurn);
      const stride=p.moving?gait*.42:0;
      for(let k=0;k<2;k++){const side=k?1:-1;put(parts,n+2+k,[side*.12,.51,side*stride*.4],[.17,.78,.19],0x364457,side*stride);put(parts,n+4+k,[side*.12,.12,side*stride*.8+.08],[.2,.14,.32],0xe5e2d8);}
      const phoneY=1.05+p.phoneRaise*.72,phoneX=p.twoHands?.12:.34,phoneZ=.18+p.phoneRaise*.25;
      limb(n+6,[.24,1.36,0],[phoneX,phoneY,phoneZ],.12,shirt);
      const hand=p.twoHands&&p.excited?[-.06,phoneY-.05,phoneZ]:[-.32,1.05+p.wave*(.8+Math.sin(time*(2+seed(i,12))+i)*.12),p.excited?.05:-stride*.6];limb(n+7,[-.24,1.36,0],hand,.12,shirt);
      put(parts,n+8,[phoneX,phoneY,phoneZ],[.15,.25,.035],0x141620);
      put(parts,n+9,[phoneX,phoneY,phoneZ-.022],[.12,.2,.012],0x9badca);
      put(flashes,i,[phoneX+.045,phoneY+.075,phoneZ+.025],p.flash?[.065,.065,.035]:[0,0,0]);
    }
    for(const mesh of [parts,heads,flashes]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  }
  return {root:group,update};
}
