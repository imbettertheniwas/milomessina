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
  const skirtShape=new T.CylinderGeometry(.7,1,1,8);
  piece(skirtShape,[0,.74,0],[.255,.34,.18],5);skirtShape.dispose();
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
  geometry.setAttribute('motion',new T.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('dance',new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('poolRole',new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage));
  const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.84});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float region; attribute float poolRole; attribute vec2 swing; attribute vec3 skin; attribute vec3 pants; attribute vec3 hair; attribute vec3 motion; attribute vec4 dance;\nvec4 wardrobeFlags(float bits){return mod(floor(vec4(bits,bits/2.,bits/4.,bits/8.)),2.);}\n#define wardrobe wardrobeFlags(motion.z)\n');
    shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nif(region>.5&&region<1.5)vColor=skin; else if(region>1.5&&region<2.5)vColor=pants; else if(region>2.5&&region<3.5)vColor=hair; else if(region>4.5)vColor=pants; else if(region>3.5)vColor=vec3(.07); if(poolRole>.5&&((region>1.5&&region<2.5&&position.y<.7)||region>3.5))vColor=skin; if(wardrobe.x>.5&&region>1.5&&region<2.5&&position.y<.66)vColor=skin; if(wardrobe.z>.5&&region<.5&&swing.x>1.)vColor=skin;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      if(region>4.5&&wardrobe.y<.5)transformed=vec3(0.);
      if(wardrobe.w>.5&&region<.5&&swing.x==0.)transformed.x*=.85;
      float gait=sin(motion.x)*swing.y*motion.y;
      if(swing.x>0.){float y=transformed.y-swing.x; transformed.y=swing.x+y*cos(gait)-transformed.z*sin(gait); transformed.z=y*sin(gait)+transformed.z*cos(gait);}
      float upperBody=smoothstep(.12,.85,position.y);
      transformed.x+=sin(dance.x*.5)*dance.y*.06*upperBody;
      transformed.y-=dance.y*(.025+(1.-cos(dance.x*2.))*.018)*upperBody;
      if(swing.x>1.){
        float wave=dance.y*(.22+.16*sin(dance.x+swing.y*.65)+dance.z*(swing.y==dance.w?1.:.3));
        float y=transformed.y-swing.x;
        transformed.y=swing.x+y*cos(wave)+transformed.z*sin(wave);
        transformed.z=-y*sin(wave)+transformed.z*cos(wave);
      }
      if(poolRole>.5&&poolRole<1.5)transformed=vec3(transformed.x,-transformed.z+.04,transformed.y-.9);
      else if(poolRole>1.5&&poolRole<2.5)transformed=vec3(transformed.x,.57+max(0.,transformed.y-.85)*.55+transformed.z*.84, .05-(transformed.y-.85)*.84+transformed.z*.55);`);
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
      float normalGait=sin(motion.x)*swing.y*motion.y;
      if(swing.x>0.)objectNormal.yz=mat2(cos(normalGait),sin(normalGait),-sin(normalGait),cos(normalGait))*objectNormal.yz;
      if(swing.x>1.){float wave=dance.y*(.22+.16*sin(dance.x+swing.y*.65)+dance.z*(swing.y==dance.w?1.:.3));objectNormal.yz=mat2(cos(wave),-sin(wave),sin(wave),cos(wave))*objectNormal.yz;}
      if(poolRole>.5&&poolRole<1.5)objectNormal=vec3(objectNormal.x,-objectNormal.z,objectNormal.y); else if(poolRole>1.5&&poolRole<2.5)objectNormal=vec3(objectNormal.x,objectNormal.y*.55+objectNormal.z*.84,-objectNormal.y*.84+objectNormal.z*.55);`);
  };
  material.customProgramCacheKey=()=> 'distant-members-party-5';
  const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name='distant-chapter-members';mesh.count=0;mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3).setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.instanceMatrix.needsUpdate=true;mesh.boundingSphere=new T.Sphere(new T.Vector3(0,2,0),66);
  const dummy=new T.Object3D(),color=new T.Color(),slots=[],size=new T.Vector2();let count=0,pixelHeight=1440,colorsChanged=false,time=0;
  mesh.onBeforeRender=renderer=>{pixelHeight=renderer.getSize(size).y;};
  const view=new T.Vector3();
  function distant(batch,camera,matrixWorld){
    if(!camera)return false;
    view.copy(batch.bounds.center).applyMatrix4(matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    const depth=Math.max(1,-view.z-batch.bounds.radius),height=1.9*camera.projectionMatrix.elements[5]*pixelHeight/(2*depth);
    batch.distant=height<(batch.distant?28:22);return batch.distant;
  }
  function begin(now){time=now;count=0;colorsChanged=false;}
  function add(member,state){
    dummy.position.set(state.x,state.ground??member.ground??0,state.z);dummy.rotation.set(0,state.rotation,0);dummy.scale.set(member.height*(member.build??1),member.height,member.height);dummy.updateMatrix();mesh.setMatrixAt(count,dummy.matrix);
    if(slots[count]!==member){slots[count]=member;colorsChanged=true;
    color.set(member.poolRole?(member.swimsuit==='one-piece'?member.swimColor:palettes.skin[member.skin]):member.action==='build'?0xe5a13f:member.shirtColor??palettes.shirts[member.shirt]);mesh.setColorAt(count,color);
    for(const [name,value] of [['skin',palettes.skin[member.skin]],['pants',member.poolRole?member.swimColor:member.bottomColor??palettes.pants[member.pants]],['hair',member.cap?(member.shirtColor??palettes.shirts[member.shirt]):palettes.hair[member.hair]]]){color.set(value);geometry.attributes[name].setXYZ(count,color.r,color.g,color.b);}
    geometry.attributes.poolRole.setX(count,member.poolRole==='swim'?1:member.poolRole==='lounge'?2:member.poolRole?3:0);
    }
    // Use the same distance-based gait as nearby bodies. A slowing or waiting
    // walker must not keep marching at the old fixed shader-clock speed.
    const phase=member.phase??hash(member.chapter,member.member,'distant-gait')*Math.PI*2;
    // Pack clothing flags into the existing motion attribute so WebGL stays
    // within the attribute limit on phones as well as desktop GPUs.
    const party=member.partyLook&&!member.poolRole;
    const wardrobe=party?Number(member.shorts)+Number(member.skirt)*2+Number(member.sleeveless)*4+(member.partyLook==='sorority'?8:0):0;
    geometry.attributes.motion.setXYZ(count,state.walking?(state.gait??time*7.5+phase):time*2+phase,state.walking?.48*(state.motion??1):.055,wardrobe);
    const dance=!state.arrival&&!state.walking?state.dance:null;
    geometry.attributes.dance.setXYZW(count,dance?.beat??0,dance?.energy??0,dance?dance.accent*(dance.style===4?.8:.25):0,dance?.lead??0);count++;
  }
  function upload(attribute){attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate=true;}
  function finish(){
    mesh.count=count;if(!count)return;
    // Capacity includes every resident. Upload only the populated prefix while
    // retaining pending ranges until the renderer consumes them.
    upload(mesh.instanceMatrix);upload(geometry.attributes.motion);upload(geometry.attributes.dance);
    if(colorsChanged){upload(mesh.instanceColor);for(const name of ['skin','pants','hair','poolRole'])upload(geometry.attributes[name]);}
  }
  return {mesh,distant,begin,add,finish,dispose(){mesh.dispose();geometry.dispose();material.dispose();}};
}
