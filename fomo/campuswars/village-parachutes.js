// One reusable instance batch carries every canopy, rim and suspension line.
export function createParachutes(T,capacity){
  const positions=[],normals=[],colors=[];
  function add(source,colorAt){
    const geometry=source.index?source.toNonIndexed():source;
    const p=geometry.attributes.position,n=geometry.attributes.normal;
    for(let i=0;i<p.count;i++){
      positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));
      const color=new T.Color(colorAt(i,p));colors.push(color.r,color.g,color.b);
    }
    if(geometry!==source)geometry.dispose();source.dispose();
  }
  const canopy=new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2);canopy.scale(2.5,1.25,2.5);canopy.translate(0,4.6,0);
  add(canopy,(i,p)=>{
    const face=Math.floor(i/3)*3;
    const x=(p.getX(face)+p.getX(face+1)+p.getX(face+2))/3,z=(p.getZ(face)+p.getZ(face+1)+p.getZ(face+2))/3;
    return Math.floor((Math.atan2(z,x)+Math.PI)/(Math.PI/4))%2?0xfff6df:0x8555e8;
  });
  const rim=new T.TorusGeometry(2.5,.045,4,32);rim.rotateX(Math.PI/2);rim.translate(0,4.6,0);add(rim,()=>0xfff6df);
  const up=new T.Vector3(0,1,0);
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,top=new T.Vector3(Math.cos(angle)*2.48,4.6,Math.sin(angle)*2.48),bottom=new T.Vector3(Math.cos(angle)*.28,1.95,Math.sin(angle)*.15);
    const direction=top.clone().sub(bottom),cord=new T.CylinderGeometry(.018,.018,direction.length(),4);
    cord.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,direction.normalize()));cord.translate(...top.add(bottom).multiplyScalar(.5));add(cord,()=>0xfff8e8);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const material=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.85,emissive:0x322044,emissiveIntensity:.18});
  const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name='new-member-parachutes';mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const dummy=new T.Object3D();let count=0;
  function begin(){count=0;}
  function addMember(member,state){
    const open=state.arrival?.canopy??0;if(open<=0)return;
    dummy.position.set(state.x,state.ground??0,state.z);dummy.rotation.set(0,state.rotation,0);dummy.scale.setScalar(open*member.height);dummy.updateMatrix();mesh.setMatrixAt(count++,dummy.matrix);
  }
  function finish(){mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;}
  return {mesh,begin,add:addMember,finish};
}
