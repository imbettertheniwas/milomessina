import {chapterGoalReached,GOAL_RAIN_DURATION} from './village-rewards.js?v=55';
import {INTRO_PACE} from './village-intro.js?v=70';
import {createCloudTexture,createBanknoteTexture} from './village-money-art.js?v=42';
import {houseStandings} from './village-competition.js?v=110';

export const MONEY_START=7.3*INTRO_PACE;
export const MONEY_END=12*INTRO_PACE;
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const seed=(index,salt)=>{const value=Math.sin(index*127.1+salt*311.7)*43758.5453;return value-Math.floor(value);};

// The rain covers the whole lot in the house's own coordinates, from behind the
// roof out to the street edge of the lawn, so the crowd standing in front of the
// porch is rained on as well as the roof. Both stay inside the walking routes.
export const RAIN_HALF_WIDTH=7.6,RAIN_BACK=-5,RAIN_FRONT=14.2;
const RAIN_DEPTH=RAIN_FRONT-RAIN_BACK,CLOUD_PUFFS=24;
// Bills reach the lawn itself, fade in just under the cloud and shrink out a
// short way above whatever they land on, at one speed across the lot. The
// shrink-out is kept near the surface: a note this small vanishing a metre and a
// half up would read as evaporating rather than landing.
const LAWN_LANDING=.1,BILL_TOP=12.5,ROOF_DROP=11.5,FADE_IN=1.1,FADE_OUT=.6;
// A house is about eleven metres wide here, so a note is sized the way a real
// one is against it: a hand's width across, not a doorway. Curl and flutter are
// written against the note's own width so its shape survives the smaller size.
const BILL_WIDTH=.34,BILL_HEIGHT=BILL_WIDTH/2.35;

// Use the same onboarding ranks as the roof badges. Ties receive equal rain.
// Counts are read against the note's size: real notes cover far less sky than
// the oversized ones did, so it takes more of them to still read as a downpour.
export function moneyRecipients(chapters,anchors){
  const byId=new Map(anchors.map(anchor=>[anchor.id,anchor]));
  return houseStandings(chapters).filter(row=>(row.joined>=15||chapterGoalReached(row))&&byId.has(row.id)).map(row=>{
    const anchor=byId.get(row.id);
    // Only a finished house reports a roof to catch bills. A lot still under
    // construction has none, so its rain carries all the way down to its crew.
    const house=anchor.house;
    return {id:row.id,goalReached:chapterGoalReached(row),rank:row.rank,count:Math.max(24,Math.round(560/Math.pow(row.rank,.8))),
      x:anchor.lot.x,z:anchor.lot.z,rotation:anchor.lot.rotation||0,roof:anchor.point.y-1,
      houseHalf:house?house.halfWidth+.45:0,houseFront:house?house.front+.45:0};
  });
}

export function createMoneyRain(T,chapters,anchors){
  const root=new T.Group();root.name='intro-money-rain';root.visible=false;
  const cloudGeometry=new T.PlaneGeometry(1,1),billGeometry=new T.PlaneGeometry(BILL_WIDTH,BILL_HEIGHT,12,4);
  const vertices=billGeometry.attributes.position;
  for(let i=0;i<vertices.count;i++){const u=vertices.getX(i)/BILL_WIDTH,v=vertices.getY(i)/BILL_HEIGHT;vertices.setZ(i,BILL_WIDTH*(.057*Math.sin(u*5.32)+.032*Math.cos(v*4.27+u*2.8)));}
  billGeometry.computeVertexNormals();
  const cloudTexture=createCloudTexture(T),texture=createBanknoteTexture(T),flutter={value:0};
  const cloudMaterial=new T.MeshBasicMaterial({map:cloudTexture,color:0xe4e9ef,transparent:true,opacity:0,depthWrite:false,alphaTest:.015});
  // Each soft puff faces the lens while its center remains anchored in the 3D cloud bank.
  cloudMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
    vec4 cloudCenter = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 cloudScale = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
    vec4 mvPosition = cloudCenter + vec4(position.xy * cloudScale, 0.0, 0.0);
    gl_Position = projectionMatrix * mvPosition;
  `);};
  const billMaterial=new T.MeshStandardMaterial({map:texture,color:texture?0xffffff:0xc5c8a6,roughness:.96,metalness:0,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.24,side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false});
  billMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uFlutter=flutter;
    shader.vertexShader='uniform float uFlutter;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
      transformed.z += .045 * sin(position.x * ${(7/BILL_WIDTH).toFixed(3)} + uFlutter * 3.8 + phase) * abs(position.x);
    `);
  };
  const dummy=new T.Object3D();
  let recipients=[],clouds=null,bills=null,lastTime=null,rewardTime=GOAL_RAIN_DURATION,celebrating=new Set(),knownGoals=new Set();
  function releaseInstances(){for(const mesh of [clouds,bills])if(mesh){root.remove(mesh);mesh.dispose();}clouds=bills=null;}
  function setChapters(nextChapters,nextAnchors){
    const goals=new Set(nextChapters.filter(chapterGoalReached).map(chapter=>chapter.id));
    const newlyReached=[...goals].filter(id=>!knownGoals.has(id));
    if(newlyReached.length){celebrating=new Set(newlyReached);rewardTime=0;}
    knownGoals=goals;
    releaseInstances();recipients=moneyRecipients(nextChapters,nextAnchors);lastTime=null;
    if(!recipients.length){root.visible=false;return;}
    clouds=new T.InstancedMesh(cloudGeometry,cloudMaterial,recipients.length*CLOUD_PUFFS);clouds.name='rising-money-clouds';
    bills=new T.InstancedMesh(billGeometry,billMaterial,recipients.reduce((sum,row)=>sum+row.count,0));bills.name='rank-weighted-money';
    for(const mesh of [clouds,bills]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(mesh);}
    root.visible=false;
  }
  function update(seconds,night=0,reward=false){
    if(seconds===lastTime)return;lastTime=seconds;
    const end=reward?MONEY_START+GOAL_RAIN_DURATION:MONEY_END;
    root.visible=recipients.some(row=>!reward||(row.goalReached&&celebrating.has(row.id)))&&seconds>MONEY_START&&seconds<end;
    if(!root.visible)return;
    const time=seconds-MONEY_START,rise=smooth(time/.65),fade=1-smooth((seconds-(end-.7))/.7);
    cloudMaterial.opacity=rise*fade*.88;cloudMaterial.color.setRGB(1-night*.3,1-night*.27,1-night*.22);billMaterial.opacity=rise*fade;flutter.value=time;
    let cloudIndex=0,billIndex=0;
    for(const row of recipients){
      const show=!reward||(row.goalReached&&celebrating.has(row.id))?1:0;
      // Lot-local placement, turned to face the street like the house it belongs to.
      const turn=Math.cos(row.rotation),lean=Math.sin(row.rotation),top=row.roof+BILL_TOP;
      const place=(x,z,y)=>dummy.position.set(row.x+x*turn+z*lean,y,row.z-x*lean+z*turn);
      for(let i=0;i<CLOUD_PUFFS;i++){
        const x=(seed(i,21)-.5)*2*RAIN_HALF_WIDTH,z=RAIN_BACK+seed(i,22)*RAIN_DEPTH,y=seed(i,23)*2.6;
        place(x+Math.sin(time*.4+i)*.15,z,row.roof+5+rise*9+y);
        dummy.rotation.set(0,0,0);dummy.scale.set((5+seed(i,24)*4)*rise*show,(3.5+seed(i,25)*3)*rise*show,1);dummy.updateMatrix();clouds.setMatrixAt(cloudIndex++,dummy.matrix);
      }
      for(let i=0;i<row.count;i++){
        // Drift on the beat clock rather than the bill's own fall, so the column
        // a bill will land in is known before its drop is chosen.
        const x=(seed(i,6)-.5)*2*RAIN_HALF_WIDTH+Math.sin(time*2.3+seed(i,8)*6)*1.1;
        const z=RAIN_BACK+seed(i,7)*RAIN_DEPTH+Math.cos(time*1.7+seed(i,9)*6)*.8;
        // Bills over the roof settle on it; the rest carry on past the eaves to
        // the lawn and the people standing on it.
        const onRoof=Math.abs(x)<row.houseHalf&&z<row.houseFront,drop=top-(onRoof?row.roof+1:LAWN_LANDING);
        // One fall speed across the lot, so the longer drop to the lawn simply
        // starts that much earlier and still lands inside the beat.
        const span=2.7+seed(i,5)*.7,fall=span*drop/ROOF_DROP;
        const delay=i/row.count*1.5,clock=time-.45-delay+fall-span;
        const age=Math.max(0,clock)%fall,fallen=Math.pow(age/fall,1.13)*drop;
        place(x,z,top-fallen);
        dummy.rotation.set(-Math.PI/2+Math.sin(age*3.5+i)*.5,age*.55+seed(i,11)*6,Math.sin(age*2.6+i)*.3);
        const size=clock<0?0:(.85+seed(i,12)*.3)*smooth(fallen/FADE_IN)*smooth((drop-fallen)/FADE_OUT);
        dummy.scale.setScalar(size*show);dummy.updateMatrix();bills.setMatrixAt(billIndex++,dummy.matrix);
      }
    }
    clouds.instanceMatrix.needsUpdate=true;bills.instanceMatrix.needsUpdate=true;
  }
  function updateRewards(dt,night=0){
    if(rewardTime>=GOAL_RAIN_DURATION){if(lastTime!==null)clear();return;}
    rewardTime=Math.min(GOAL_RAIN_DURATION,rewardTime+Math.max(0,dt));
    update(MONEY_START+rewardTime,night,true);
  }
  function clear(){root.visible=false;lastTime=null;}
  function dispose(){releaseInstances();cloudGeometry.dispose();billGeometry.dispose();cloudMaterial.dispose();billMaterial.dispose();texture?.dispose();cloudTexture?.dispose();root.visible=false;}
  setChapters(chapters,anchors);
  return {root,setChapters,update,updateRewards,clear,dispose,get recipients(){return recipients;}};
}
