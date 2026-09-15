import {PONG_TABLE,pongTurn,activityPose} from './village-layout.js?v=104';
import {humanPose} from './village-human-motion.js?v=80';

// The throwing hand in world space, shared by every lawn game's projectile.
export function throwingHand(T,player,time){
  const state=activityPose(player,time),rig=humanPose(player,state,time),hand=rig.arms[1].hand,h=player.height,a=state.rotation;
  return new T.Vector3(state.x+(hand[0]*Math.cos(a)+hand[2]*Math.sin(a))*h,(hand[1]+.055)*h+player.ground,state.z+(-hand[0]*Math.sin(a)+hand[2]*Math.cos(a))*h);
}
// Tables and players share one layout and clock, including ball release from the hand.
// Every lawn game draws from one set of materials so all their tables and cups
// batch into the same handful of draw calls.
const lawnGameMaterials=new WeakMap();
export function lawnGameKit(T){
  if(!lawnGameMaterials.has(T))lawnGameMaterials.set(T,{
    top:new T.MeshStandardMaterial({color:0x285f61,roughness:.7}),metal:new T.MeshStandardMaterial({color:0x9ca4a6,metalness:.65,roughness:.45}),
    red:new T.MeshStandardMaterial({color:0xe34f4c,roughness:.6}),white:new T.MeshStandardMaterial({color:0xfff1dc,roughness:.5}),
    box:new T.BoxGeometry(1,1,1),cup:new T.CylinderGeometry(.10,.073,.22,12,1,true),rim:new T.TorusGeometry(.10,.012,4,12)
  });
  return lawnGameMaterials.get(T);
}
export function createPongGames(T,members){
  const root=new T.Group();root.name='chapter-beer-pong';const games=[];
  const kit=lawnGameKit(T),boxGeometry=kit.box,cupGeometry=kit.cup,rimGeometry=kit.rim;
  const {top,metal,red,white}=kit;
  function box(parent,x,y,z,w,h,d,material){const mesh=new T.Mesh(boxGeometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  for(const player of members.filter(m=>m.action==='pong'&&m.seat===0)){
    const players=[player,members.find(m=>m.chapter===player.chapter&&m.action==='pong'&&m.seat===1)],group=new T.Group();
    group.name=`beer-pong-${player.chapter}`;group.position.set(player.lot.x,0,player.lot.z);group.rotation.y=player.lot.rotation;root.add(group);
    const {x,z,width,length,height}=PONG_TABLE;
    box(group,x,height,z,width,.09,length,top);
    box(group,x,height+.05,z,.025,.006,length,white);
    for(const side of [-1,1]){
      box(group,x,height+.05,z+side*(length/2-.02),width,.006,.025,white);
      for(const dx of [-.43,.43])box(group,x+dx,height/2,z+side*.95,.055,height,.055,metal);
    }
    const cups=[];
    for(const side of [-1,1])for(let row=0;row<3;row++)for(let col=0;col<=row;col++){
      const cx=x+(col-row/2)*.235,cz=z+side*(.55+row*.22),cup=new T.Mesh(cupGeometry,red),rim=new T.Mesh(rimGeometry,white);
      cup.position.set(cx,height+.155,cz);group.add(cup);rim.rotation.x=-Math.PI/2;rim.position.set(cx,height+.265,cz);group.add(rim);cups.push(cup);
    }
    // The dynamic ball is a direct child of the world-space root; static geometry batches independently.
    const ball=new T.Mesh(new T.SphereGeometry(.07,10,8),new T.MeshBasicMaterial({color:0xfff5d7}));ball.name=`pong-ball-${player.chapter}`;root.add(ball);
    games.push({chapter:player.chapter,group,players,ball,cups});
  }
  const handPosition=(player,time)=>throwingHand(T,player,time);
  function animate(time){
    for(const game of games){
      const shot=pongTurn(game.chapter,time),player=game.players[shot.seat],t=shot.elapsed;
      game.ball.visible=t<shot.release+shot.flight+.1;
      if(!game.ball.visible)continue;
      if(t<shot.release){game.ball.position.copy(handPosition(player,time));continue;}
      const start=handPosition(player,time-(t-shot.release)),u=Math.min(1,(t-shot.release)/shot.flight);
      const target=game.cups[(shot.seat?0:6)+((shot.turn%6)+6)%6].position.clone();target.y=PONG_TABLE.height+.19;
      target.applyAxisAngle(new T.Vector3(0,1,0),player.lot.rotation).add(new T.Vector3(player.lot.x,0,player.lot.z));
      game.ball.position.lerpVectors(start,target,u);game.ball.position.y+=4*.85*u*(1-u);
    }
  }
  animate(0);return {root,games,animate,handPosition};
}
