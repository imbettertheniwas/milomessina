import {DIE_TABLE,dieSeat,dieCup,dieTurn,lawnGround} from './village-layout.js?v=104';
import {lawnGameKit,throwingHand} from './village-pong.js?v=104';
import {bannerIdentity} from './village-banners.js?v=104';
import {DIE_EDGE_UV,DIE_FACES,createDieTableTexture,createDieFaceTexture} from './village-die-art.js?v=80';

// Die, as it is actually played: partners at one end, opponents at the other,
// a cup in front of every player, and a lob that has to clear head height and
// land past the half line before it sinks or gets caught one-handed.
export function createDieGames(T,members,chapters=[]){
  const root=new T.Group();root.name='chapter-die-games';const games=[];
  const kit=lawnGameKit(T),{metal,red,white}=kit;
  const {x,z,width,depth,height}=DIE_TABLE;
  // The legs stand on the lawn, not sunk into it.
  const base=lawnGround(x,z);
  // One plywood sheet for every table, so they batch; the four side faces of the
  // slab sample a clear patch of it instead of stretching the whole top across.
  const slab=new T.BoxGeometry(1,1,1),uv=slab.attributes.uv;
  for(let face=0;face<6;face++)for(let i=0;i<4;i++){
    if(face===2)continue;
    const index=face*4+i;
    uv.setXY(index,DIE_EDGE_UV.u0+uv.getX(index)*(DIE_EDGE_UV.u1-DIE_EDGE_UV.u0),DIE_EDGE_UV.v0+uv.getY(index)*(DIE_EDGE_UV.v1-DIE_EDGE_UV.v0));
  }
  const plywood=new T.MeshStandardMaterial({color:0xffffff,map:createDieTableTexture(T),roughness:.79});
  function box(parent,geometry,material,px,py,pz,sx,sy,sz){
    const mesh=new T.Mesh(geometry,material);mesh.position.set(px,py,pz);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  for(const player of members.filter(m=>m.action==='die'&&m.seat===0)){
    const table=members.filter(m=>m.chapter===player.chapter&&m.action==='die');
    const players=[0,1,2,3].map(seat=>table.find(m=>m.seat===seat)),group=new T.Group();
    group.name=`die-${player.chapter}`;group.position.set(player.lot.x,base,player.lot.z);group.rotation.y=player.lot.rotation;root.add(group);
    // Each house stains its sheet toward its own colours; the tint survives batching.
    const identity=bannerIdentity(chapters.find(c=>c.id===player.chapter)||{id:player.chapter,name:''});
    const stain=plywood.clone();stain.color.set(identity.primary).lerp(new T.Color(0xffffff),.62);
    box(group,slab,stain,x,height,z,width,.075,depth);
    // Folding-table underframe: a leg at each corner, rails down both axes.
    for(const dx of [-width/2+.14,width/2-.14]){
      for(const dz of [-depth/2+.12,depth/2-.12])box(group,kit.box,metal,x+dx,height/2,z+dz,.05,height,.05);
      box(group,kit.box,metal,x+dx,height-.12,z,.045,.04,depth-.24);
    }
    for(const dz of [-depth/2+.12,depth/2-.12])box(group,kit.box,metal,x,height-.12,z+dz,width-.28,.04,.045);
    const cups=[0,1,2,3].map(seat=>{
      const spot=dieCup(seat),cup=new T.Mesh(kit.cup,red),rim=new T.Mesh(kit.rim,white);
      cup.position.set(spot.x,height+.145,spot.z);group.add(cup);
      rim.rotation.x=-Math.PI/2;rim.position.set(spot.x,height+.25,spot.z);group.add(rim);
      return cup;
    });
    const die=new T.Object3D();die.name=`die-cube-${player.chapter}`;
    games.push({chapter:player.chapter,group,players,die,cups});
  }
  // Every die in the village is one instance of a single pipped cube.
  const cube=new T.BoxGeometry(.07,.07,.07),faces=cube.attributes.uv;
  for(let face=0;face<6;face++){
    const value=DIE_FACES[face],col=(value-1)%3,row=Math.floor((value-1)/3);
    for(let i=0;i<4;i++){const index=face*4+i;faces.setXY(index,(col+faces.getX(index))/3,(1-row-faces.getY(index))/2);}
  }
  const dice=new T.InstancedMesh(cube,new T.MeshStandardMaterial({color:0xffffff,map:createDieFaceTexture(T),roughness:.42}),Math.max(1,games.length));
  dice.name='chapter-dice';dice.instanceMatrix.setUsage(T.DynamicDrawUsage);dice.frustumCulled=false;dice.castShadow=false;root.add(dice);
  const place=(game,px,py,pz)=>new T.Vector3(px,py,pz).applyAxisAngle(new T.Vector3(0,1,0),game.players[0].lot.rotation).add(new T.Vector3(game.players[0].lot.x,base,game.players[0].lot.z));
  // The lob has to come down past the half line, in front of the cup it is aimed at.
  function landing(game,shot){
    const thrower=dieSeat(shot.seat),cup=dieCup(shot.target);
    return place(game,x-thrower.side*(width*.22),height+.075,cup.z-Math.sign(cup.z-z)*.1);
  }
  function write(game,index){
    game.die.scale.setScalar(game.die.visible?1:0);game.die.updateMatrix();dice.setMatrixAt(index,game.die.matrix);
  }
  function animate(time){
    games.forEach((game,index)=>{
      const shot=dieTurn(game.chapter,time),thrower=game.players[shot.seat],defender=game.players[shot.target],t=shot.elapsed;
      const hit=shot.release+shot.toss,done=hit+shot.settle;
      game.die.visible=t<done;
      if(!game.die.visible){write(game,index);return;}
      if(t<shot.release){
        // Tapped on the table and turned over in the hand before the throw.
        game.die.rotation.set(.5,t*1.4,.3);game.die.position.copy(throwingHand(T,thrower,time));write(game,index);return;
      }
      game.die.rotation.set(t*8.1+shot.turn,t*5.4,t*6.7);
      const land=landing(game,shot);
      if(t<hit){
        const s=(t-shot.release)/shot.toss,start=throwingHand(T,thrower,time-(t-shot.release));
        // Eight feet of air is the rule; the apex here clears it.
        game.die.position.lerpVectors(start,land,s);game.die.position.y+=4*1.55*s*(1-s);
      }else{
        const s=(t-hit)/shot.settle;
        const cup=dieCup(shot.target),rest=shot.sink?place(game,cup.x,height+.15,cup.z):throwingHand(T,defender,time);
        game.die.position.lerpVectors(land,rest,s);game.die.position.y+=4*(shot.sink?.2:.5)*s*(1-s);
      }
      write(game,index);
    });
    dice.instanceMatrix.needsUpdate=true;
  }
  animate(0);return {root,games,dice,animate,handPosition:(player,time)=>throwingHand(T,player,time)};
}
