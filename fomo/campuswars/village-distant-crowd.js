import {palettes,hash} from './village-district-layout.js?v=80';

// People smaller than twenty-two CSS pixels use one articulated silhouette. Their
// actual routes, height, build and clothing colors are retained; small features
// return before they become distinguishable when the camera approaches.
export function createDistantCrowd(T,capacity){
  const positions=[],normals=[],regions=[],swings=[];
  function piece(shape,position,scale,region,pivot=0,side=0){
    const source=shape.toNonIndexed(),p=source.attributes.position,n=source.attributes.normal;
    for(let i=0;i<p.count;i++){
      positions.push(p.getX(i)*scale[0]+position[0],p.getY(i)*scale[1]+position[1],p.getZ(i)*scale[2]+position[2]);
      const normal=new T.Vector3(n.getX(i)/scale[0],n.getY(i)/scale[1],n.getZ(i)/scale[2]).normalize();normals.push(...normal);
      regions.push(region);swings.push(pivot,side);
    }
    source.dispose();
  }
  const box=new T.BoxGeometry(1,1,1),round=new T.SphereGeometry(1,6,4),limb=new T.CylinderGeometry(1,1,1,5);
  piece(round,[0,1.12,0],[.205,.29,.14],0);
  piece(box,[0,.84,0],[.29,.2,.23],2);
  piece(round,[0,1.55,0],[.126,.17,.136],1);
  piece(round,[0,1.65,-.025],[.132,.09,.13],3);
  for(const side of [-1,1]){
    piece(limb,[side*.245,1.03,0],[.061,.42,.061],0,1.29,side);
    piece(limb,[side*.265,.77,.015],[.045,.22,.045],1,1.29,side);
    piece(limb,[side*.1,.52,0],[.076,.55,.076],2,.83,-side);
    piece(limb,[side*.1,.2,0],[.055,.3,.055],2,.83,-side);
    piece(box,[side*.1,.055,.05],[.145,.11,.25],4,.83,-side);
  }
  for(const geometry of [box,round,limb])geometry.dispose();
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('region',new T.Float32BufferAttribute(regions,1));geometry.setAttribute('swing',new T.Float32BufferAttribute(swings,2));
  for(const name of ['skin','pants','hair'])geometry.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('motion',new T.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('poolRole',new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage));
  const clock={value:0},material=new T.MeshStandardMaterial({color:0xffffff,roughness:.84});
  material.onBeforeCompile=shader=>{
    shader.uniforms.crowdTime=clock;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float region; attribute float poolRole; attribute vec2 swing; attribute vec3 skin; attribute vec3 pants; attribute vec3 hair; attribute vec2 motion; uniform float crowdTime;');
    shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nif(region>.5&&region<1.5)vColor=skin; else if(region>1.5&&region<2.5)vColor=pants; else if(region>2.5&&region<3.5)vColor=hair; else if(region>3.5)vColor=vec3(.07); if(poolRole>.5&&((region>1.5&&region<2.5&&position.y<.7)||region>3.5))vColor=skin;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float gait=sin(crowdTime*(motion.y>.5?7.5:2.0)+motion.x)*swing.y*(motion.y>.5?.48:.055);
      if(swing.x>0.){float y=transformed.y-swing.x; transformed.y=swing.x+y*cos(gait)-transformed.z*sin(gait); transformed.z=y*sin(gait)+transformed.z*cos(gait);}
      if(poolRole>.5&&poolRole<1.5)transformed=vec3(transformed.x,-transformed.z+.04,transformed.y-.9);
      else if(poolRole>1.5&&poolRole<2.5)transformed=vec3(transformed.x,.57+max(0.,transformed.y-.85)*.55+transformed.z*.84, .05-(transformed.y-.85)*.84+transformed.z*.55);`);
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nif(poolRole>.5&&poolRole<1.5)objectNormal=vec3(objectNormal.x,-objectNormal.z,objectNormal.y); else if(poolRole>1.5&&poolRole<2.5)objectNormal=vec3(objectNormal.x,objectNormal.y*.55+objectNormal.z*.84,-objectNormal.y*.84+objectNormal.z*.55);');
  };
  material.customProgramCacheKey=()=> 'distant-members-pool-2';
  const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name='distant-chapter-members';mesh.count=0;mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3).setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.instanceMatrix.needsUpdate=true;mesh.boundingSphere=new T.Sphere(new T.Vector3(0,2,0),66);
  const dummy=new T.Object3D(),color=new T.Color(),slots=[];let count=0,pixelHeight=1440,colorsChanged=false;
  mesh.onBeforeRender=renderer=>{pixelHeight=renderer.getSize(new T.Vector2()).y;};
  const view=new T.Vector3();
  function distant(batch,camera,matrixWorld){
    if(!camera)return false;
    view.copy(batch.bounds.center).applyMatrix4(matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    const depth=Math.max(1,-view.z-batch.bounds.radius),height=1.9*camera.projectionMatrix.elements[5]*pixelHeight/(2*depth);
    batch.distant=height<(batch.distant?28:22);return batch.distant;
  }
  function begin(time){clock.value=time;count=0;colorsChanged=false;}
  function add(member,state){
    dummy.position.set(state.x,state.ground??member.ground??0,state.z);dummy.rotation.set(0,state.rotation,0);dummy.scale.set(member.height*(member.build??1),member.height,member.height);dummy.updateMatrix();mesh.setMatrixAt(count,dummy.matrix);
    if(slots[count]!==member){slots[count]=member;colorsChanged=true;
    color.set(member.poolRole?(member.swimsuit==='one-piece'?member.swimColor:palettes.skin[member.skin]):member.action==='build'?0xe5a13f:palettes.shirts[member.shirt]);mesh.setColorAt(count,color);
    for(const [name,value] of [['skin',palettes.skin[member.skin]],['pants',member.poolRole?member.swimColor:palettes.pants[member.pants]],['hair',member.cap?palettes.shirts[member.shirt]:palettes.hair[member.hair]]]){color.set(value);geometry.attributes[name].setXYZ(count,color.r,color.g,color.b);}
    geometry.attributes.poolRole.setX(count,member.poolRole==='swim'?1:member.poolRole==='lounge'?2:member.poolRole?3:0);
    geometry.attributes.motion.setX(count,member.phase??hash(member.chapter,member.member,'distant-gait')*Math.PI*2);
    }
    geometry.attributes.motion.setY(count,state.walking?1:0);count++;
  }
  function finish(){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(colorsChanged){mesh.instanceColor.needsUpdate=true;for(const name of ['skin','pants','hair','poolRole'])geometry.attributes[name].needsUpdate=true;}geometry.attributes.motion.needsUpdate=true;}
  return {mesh,distant,begin,add,finish,dispose(){mesh.dispose();geometry.dispose();material.dispose();}};
}
