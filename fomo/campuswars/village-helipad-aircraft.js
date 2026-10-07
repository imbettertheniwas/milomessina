// A continuous cabin shell keeps the glazing on the actual airframe surface.
export function createHelipadAircraft(k){
  const {T,root,own,mat,group,mesh,box,oval,round,bar,label,black,silver,cream,glass,rubber,gold}=k;
  const heli=group(root,'VIP helicopter');
  const paint=mat(0x202a2e,.72,.23),pearl=mat(0xc7c6bd,.45,.31),seal=mat(0x111a1f,.15,.43);
  const glazing=mat(0x385663,.56,.13),trim=mat(0x8b9698,.85,.19);
  const sections=[[-2.5,2.03,.19,.30],[-2.15,1.98,.72,.68],[-1.45,1.96,1.15,.94],[-.55,1.98,1.27,1.04],[.65,1.98,1.26,1.03],[1.5,1.91,1.08,.90],[2.2,1.70,.70,.61],[2.65,1.53,.14,.24],[2.69,1.53,.01,.05]];
  function sample(z,angle,offset=0){
    let i=0;while(i<sections.length-2&&z>sections[i+1][0])i++;
    const a=sections[i],b=sections[i+1],t=T.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);
    const cy=T.MathUtils.lerp(a[1],b[1],t),w=T.MathUtils.lerp(a[2],b[2],t)+offset,h=T.MathUtils.lerp(a[3],b[3],t)+offset;
    return [Math.cos(angle)*w,cy+Math.sin(angle)*h,z];
  }
  function skin(parent,material,z0,z1,a0,a1,offset=0,nz=32,na=24){
    const positions=[],uv=[],indices=[];
    for(let iz=0;iz<=nz;iz++)for(let ia=0;ia<=na;ia++){positions.push(...sample(T.MathUtils.lerp(z0,z1,iz/nz),T.MathUtils.lerp(a0,a1,ia/na),offset));uv.push(ia/na,iz/nz);}
    for(let iz=0;iz<nz;iz++)for(let ia=0;ia<na;ia++){const a=iz*(na+1)+ia,b=a+na+1;indices.push(a,a+1,b,b,a+1,b+1);}
    const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    return mesh(parent,g,material,0,0,0);
  }
  function seam(parent,z0,z1,a0,a1,material=seal,r=.023){const points=[];for(let i=0;i<=14;i++)points.push(new T.Vector3(...sample(T.MathUtils.lerp(z0,z1,i/14),T.MathUtils.lerp(a0,a1,i/14),.036)));mesh(parent,own(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,r,5,false)),material,0,0,0);}
  skin(heli,paint,-2.5,2.69,0,Math.PI);
  skin(heli,pearl,-2.5,2.69,Math.PI,Math.PI*2);
  // Split wraparound windshield with structural pillars and rubber seals.
  skin(heli,glazing,.68,2.51,.09,Math.PI-.09,.016,28,24);
  seam(heli,.68,2.51,Math.PI/2,Math.PI/2,trim,.028);
  seam(heli,.68,.68,.09,Math.PI-.09);
  seam(heli,2.51,2.51,.09,Math.PI-.09);
  for(const a of [.09,Math.PI-.09])seam(heli,.68,2.51,a,a);
  for(const side of [-1,1]){
    const a0=side>0?.05:Math.PI-.94,a1=side>0?.94:Math.PI-.05;
    skin(heli,glazing,-1.6,-.94,a0,a1,.024,10,10);
    for(const z of [-1.6,-.94])seam(heli,z,z,a0,a1);
    seam(heli,-1.6,-.94,a0,a0);seam(heli,-1.6,-.94,a1,a1);
    if(side>0){skin(heli,glazing,-.72,.55,a0,a1,.024,14,10);for(const z of [-.72,.55])seam(heli,z,z,a0,a1);}
    seam(heli,-1.8,1.7,side>0?-.06:Math.PI+.06,side>0?-.06:Math.PI+.06,gold,.019);
    for(const z of [-.88,1.12]){
      bar(heli,trim,[side*.72,1.13,z],[side*1.5,.48,z+.18],.064);
      oval(heli,seal,side*.78,1.11,z,.12,.075,.15);
    }
    bar(heli,paint,[side*1.5,.43,-2.05],[side*1.5,.43,1.94],.09);
    bar(heli,paint,[side*1.5,.43,1.94],[side*1.5,.55,2.28],.09);
    bar(heli,paint,[side*1.5,.55,2.28],[side*1.5,.70,2.46],.08);
    box(heli,rubber,side*1.5,.51,.05,.18,.035,1.6);
    const badge=label(heli,'fomo',side*1.265,1.63,-.62,.80,.20,'#EAEDFF','#221D4B');badge.rotation.y=side*Math.PI/2;
  }
  // A dark doorway, leather seats and an independently sliding cabin panel.
  round(heli,seal,-1.246,1.99,-.1,.055,1.45,1.36);
  round(heli,mat(0x8a7965,0,.85),-1.282,1.63,-.20,.02,.27,.62);
  round(heli,mat(0x988772,0,.82),-1.281,1.95,-.49,.02,.54,.21);
  const cabinDoor=group(heli,'sliding passenger door',-1.29,1.99,-.1);
  round(cabinDoor,paint,0,-.26,0,.075,.87,1.40);
  round(cabinDoor,glazing,-.02,.39,0,.071,.62,1.31);
  for(const z of [-.71,.71])bar(cabinDoor,trim,[0,-.66,z],[0,.72,z],.021);
  bar(cabinDoor,trim,[0,.73,-.70],[0,.73,.70],.021);
  box(cabinDoor,trim,-.069,-.13,.43,.035,.039,.23);
  bar(heli,trim,[-1.28,2.84,-1.65],[-1.28,2.84,.62],.026);
  box(heli,trim,-1.48,.80,.12,.58,.08,.90);
  box(heli,rubber,-1.49,.851,.12,.51,.017,.81);
  // Tapered tail boom with swept fin and horizontal stabilizers.
  const boom=mesh(heli,own(new T.CylinderGeometry(.13,.44,5.1,24)),paint,0,2.40,-4.57);
  boom.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(0,.70,-5.05).normalize());
  const finShape=new T.Shape();finShape.moveTo(-.54,0);finShape.lineTo(.39,.08);finShape.lineTo(.74,1.84);finShape.lineTo(.12,1.70);finShape.closePath();
  const finGeometry=own(new T.ExtrudeGeometry(finShape,{depth:.11,bevelEnabled:true,bevelSegments:2,bevelSize:.025,bevelThickness:.025,steps:1}));
  const fin=mesh(heli,finGeometry,paint,0,2.6,-6.86);fin.rotation.y=Math.PI/2;
  for(const side of [-1,1]){const wing=round(heli,pearl,side*.75,2.58,-5.65,1.5,.095,.70);wing.rotation.z=side*.06;}
  oval(heli,paint,0,2.94,-.63,.68,.36,1.15);
  for(const side of [-1,1]){
    oval(heli,trim,side*.48,3.04,-1.59,.24,.21,.11);oval(heli,rubber,side*.48,3.04,-1.675,.19,.16,.025);
    for(let i=0;i<7;i++)box(heli,seal,side*.64,3.03,-1.15+i*.13,.025,.21,.037);
    bar(heli,seal,[side*.42,2.99,.40],[side*.42,3.21,.18],.025);
  }
  bar(heli,trim,[0,3.0,0],[0,3.88,0],.09);
  oval(heli,paint,0,3.47,0,.29,.10,.29);
  const rotor=group(heli,'main rotor',0,3.89,0);
  for(let i=0;i<4;i++){
    const blade=group(rotor,'tapered rotor blade');blade.rotation.y=i*Math.PI/2+.19;
    bar(blade,trim,[0,0,.12],[0,0,.66],.058);
    const bladeShape=new T.Shape();bladeShape.moveTo(-.13,.53);bladeShape.lineTo(.15,.53);bladeShape.lineTo(.11,5.77);bladeShape.lineTo(-.04,6.20);bladeShape.lineTo(-.20,6.20);bladeShape.closePath();
    const g=own(new T.ExtrudeGeometry(bladeShape,{depth:.022,bevelEnabled:false,steps:1}));
    const surface=mesh(blade,g,paint,0,0,0);surface.rotation.x=Math.PI/2;
    box(blade,pearl,-.035,-.012,6.06,.17,.027,.20);
  }
  oval(rotor,trim,0,.045,0,.29,.10,.29);
  // Blade pitch is fixed, so bake their local orientation into the rotor rig.
  for(const blade of [...rotor.children])if(blade.isGroup){blade.updateMatrix();for(const part of [...blade.children]){part.applyMatrix4(blade.matrix);rotor.add(part);}rotor.remove(blade);}
  const blurMaterial=own(new T.MeshBasicMaterial({color:0xa5afb1,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));
  const rotorBlur=mesh(heli,own(new T.RingGeometry(.55,6.2,80)),blurMaterial,0,3.89,0);rotorBlur.rotation.x=-Math.PI/2;
  const tailRotor=group(heli,'tail rotor',-.23,3.1,-6.9);
  bar(heli,trim,[0,3.1,-6.9],[-.30,3.1,-6.9],.07);
  for(let i=0;i<4;i++){const blade=box(tailRotor,paint,0,0,0,.043,1.60,.11);blade.rotation.x=i*Math.PI/2+.3;}
  oval(tailRotor,trim,-.035,0,0,.06,.11,.11);
  // Running lights have their own emissive response in the night scene.
  for(const [x,color] of [[-1.27,0xe65049],[1.27,0x80be90]]){const m=own(new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.25}));m.userData.lamp=true;oval(heli,m,x,2.06,.75,.055,.05,.075);}
  const beacon=own(new T.MeshStandardMaterial({color:0xe46251,emissive:0xe46251,emissiveIntensity:.3}));beacon.userData.lamp=true;
  oval(heli,beacon,0,4.36,-7.06,.062,.072,.062);
  for(const x of [-.37,.37]){oval(heli,trim,x,1.17,2.02,.14,.08,.07);oval(heli,mat(0xe7e5cf,.2,.16),x,1.17,2.075,.11,.059,.014);}
  return {heli,cabinDoor,rotor,tailRotor,rotorBlur};
}
