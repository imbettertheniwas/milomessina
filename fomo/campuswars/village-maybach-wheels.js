// The wheel axis is local X. Keep the .39 rolling radius in step with the
// arrival controller, and tuck the polished face just inside the bodywork.
export function createMaybachWheels(kit,car){
  const {T,own,mat,group,mesh:makeMesh,rubber}=kit;
  const mesh=(p,g,m,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>makeMesh(p,g,m,x,y,z,sx,sy,sz);
  const polished=mat(0xc8d1d4,.96,.15),machined=mat(0x84939b,.87,.27);
  const recess=mat(0x11171b,.34,.43),brake=mat(0x667078,.65,.46);
  const wheels=[],segments=48,TAU=Math.PI*2;

  function lathe(profile){
    const geometry=own(new T.LatheGeometry(profile.map(([radius,axial])=>new T.Vector2(radius,axial)),segments));
    geometry.rotateZ(-Math.PI/2);return geometry;
  }
  // Curved shoulders, a short tread, and a recessed bead give the rubber a
  // real cross-section rather than making each tire a flat black cylinder.
  const tire=lathe([[.299,-.091],[.323,-.10],[.361,-.094],[.384,-.074],
    [.390,-.048],[.390,.048],[.384,.074],[.361,.094],[.323,.10],[.299,.091]]);
  const barrel=lathe([[.282,-.087],[.294,-.087],[.304,.096],[.294,.108]]);
  const lip=own(new T.TorusGeometry(.297,.009,5,segments));lip.rotateY(Math.PI/2);
  const disk=own(new T.CylinderGeometry(1,1,1,24));disk.rotateZ(Math.PI/2);
  const hole=own(new T.CircleGeometry(1,6));hole.rotateY(Math.PI/2);
  const centerRing=own(new T.TorusGeometry(.056,.004,4,20));centerRing.rotateY(Math.PI/2);

  function surface(vertices,indices){
    const geometry=own(new T.BufferGeometry());
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap(p=>[p[1]+.5,p[2]+.5]),2));
    geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  }
  function radialSurface(rings){
    const vertices=[],indices=[];
    for(const [radius,axial] of rings)for(let j=0;j<=segments;j++){
      const a=j/segments*TAU;vertices.push([axial,Math.sin(a)*radius,Math.cos(a)*radius]);
    }
    for(let row=0;row<rings.length-1;row++)for(let j=0;j<segments;j++){
      const a=row*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);
    }
    return surface(vertices,indices);
  }
  // A solid machined center and broad curved turbine blades form the classic
  // monoblock face. The narrow spaces between blades reveal the dark barrel.
  const hubDish=radialSurface([[.054,.120],[.092,.119],[.124,.106]]);
  const bladeVertices=[],bladeIndices=[];
  for(let slot=0;slot<20;slot++){
    const start=bladeVertices.length;
    for(let ring=0;ring<4;ring++){
      const t=ring/3,radius=.108+t*.184,axial=.108+Math.sin(t*Math.PI)*.010;
      for(let edge=0;edge<4;edge++){
        const u=edge/3,angle=slot/20*TAU+t*.13+(u-.5)*.215;
        const bevel=Math.sin(u*Math.PI)*.004;
        bladeVertices.push([axial+bevel,Math.sin(angle)*radius,Math.cos(angle)*radius]);
      }
    }
    for(let ring=0;ring<3;ring++)for(let edge=0;edge<3;edge++){
      const a=start+ring*4+edge,b=a+4;bladeIndices.push(a,a+1,b,b,a+1,b+1);
    }
  }
  const blades=surface(bladeVertices,bladeIndices);
  const starVertices=[],starIndices=[];
  for(let i=0;i<3;i++){
    const a=i*TAU/3,n=starVertices.length;
    starVertices.push([.125,Math.sin(a-.7)*.011,Math.cos(a-.7)*.011],
      [.125,Math.sin(a)*.052,Math.cos(a)*.052],
      [.125,Math.sin(a+.7)*.011,Math.cos(a+.7)*.011]);
    starIndices.push(n,n+2,n+1);
  }
  const star=surface(starVertices,starIndices);

  for(const side of [-1,1])for(const z of [-1.83,1.83]){
    const wheel=group(car,'Maybach wheel',side*.94,.39,z);
    const face=group(wheel,'Polished twenty-slot Maybach monoblock');
    face.rotation.y=side<0?Math.PI:0;
    mesh(face,tire,rubber);mesh(face,barrel,machined);
    mesh(face,disk,recess,.072,0,0,.019,.295,.295);
    mesh(face,disk,brake,.085,0,0,.012,.262,.262);
    for(let i=0;i<10;i++){
      const a=i*TAU/10;
      mesh(face,hole,recess,.092,Math.sin(a)*.225,Math.cos(a)*.225,1,.009,.009);
    }
    mesh(face,lip,polished,.107,0,0);mesh(face,hubDish,polished);mesh(face,blades,polished);
    mesh(face,disk,machined,.116,0,0,.009,.058,.058);
    mesh(face,centerRing,polished,.123,0,0);mesh(face,star,polished);
    for(let i=0;i<5;i++){
      const a=i*TAU/5;
      mesh(face,hole,recess,.123,Math.sin(a)*.078,Math.cos(a)*.078,1,.007,.007);
    }
    wheels.push(wheel);
  }
  return wheels;
}
