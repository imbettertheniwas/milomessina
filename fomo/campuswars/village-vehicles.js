import {createVehicleLogoTexture} from './village-floor-logo.js?v=79';

export const FOMO_VEHICLE_COLOR=0x626cf3;

// Shared, baked vehicle parts keep both moving traffic and parked fleets batched.
export function createVehicleKit(T){
  const resources=new Set(),models=new Map(),paints=new Map();
  const keep=value=>(resources.add(value),value);
  const detailMaterial=keep(new T.MeshStandardMaterial({vertexColors:true,roughness:.36,metalness:.22}));
  const wheelMaterial=keep(new T.MeshStandardMaterial({vertexColors:true,roughness:.57,metalness:.18}));
  const logoMap=createVehicleLogoTexture(T);if(logoMap)keep(logoMap);
  const logoMaterial=keep(new T.MeshStandardMaterial({map:logoMap,color:logoMap?0xffffff:0x6975f5,roughness:.3,metalness:.32,alphaTest:.1,polygonOffset:true,polygonOffsetFactor:-1}));
  function paint(color){if(!paints.has(color))paints.set(color,keep(new T.MeshStandardMaterial({color,roughness:.3,metalness:.32})));return paints.get(color);}
  function merge(parts){
    const values={position:[],normal:[],uv:[],color:[]};
    for(const {geometry,color=0xffffff} of parts){
      const g=geometry.index?geometry.toNonIndexed():geometry,c=new T.Color(color);
      for(let i=0;i<g.attributes.position.count;i++){
        for(const key of ['position','normal','uv']){const a=g.attributes[key],size=key==='uv'?2:3;for(let n=0;n<size;n++)values[key].push(a?a.array[i*size+n]:0);}
        values.color.push(c.r,c.g,c.b);
      }
      if(g!==geometry)g.dispose();geometry.dispose();
    }
    const g=keep(new T.BufferGeometry());
    for(const [name,array] of Object.entries(values))g.setAttribute(name,new T.Float32BufferAttribute(array,name==='uv'?2:3));
    g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function part(parts,geometry,color,x=0,y=0,z=0,rx=0,ry=0,rz=0){geometry.rotateX(rx);geometry.rotateY(ry);geometry.rotateZ(rz);geometry.translate(x,y,z);parts.push({geometry,color});}
  function box(parts,color,x,y,z,w,h,d,rx=0,ry=0,rz=0){part(parts,new T.BoxGeometry(w,h,d),color,x,y,z,rx,ry,rz);}
  function profile(points,width,bevel=.035){
    const s=new T.Shape();points.forEach(([z,y],i)=>i?s.lineTo(-z,y):s.moveTo(-z,y));s.closePath();
    const g=new T.ExtrudeGeometry(s,{depth:width,bevelEnabled:Boolean(bevel),bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,curveSegments:5});g.translate(0,0,-width/2);g.rotateY(Math.PI/2);return g;
  }
  function body(length,width,lift=0){
    const h=length/2,a=length*.31,s=new T.Shape();
    // Profile is mirrored into local +Z travel; cutouts leave room above each tire.
    s.moveTo(-h,.53+lift*.4);s.lineTo(-h+.1,.83+lift*.4);s.lineTo(-h+.45,.95+lift);s.lineTo(h-.4,.95+lift);s.lineTo(h-.06,.8+lift*.4);s.lineTo(h,.49);
    for(const center of [a,-a]){s.lineTo(center+.4,.43);s.lineTo(center+.4,.49);s.quadraticCurveTo(center+.37,.88,center,.88);s.quadraticCurveTo(center-.37,.88,center-.4,.49);s.lineTo(center-.4,.43);}
    s.lineTo(-h,.43);s.closePath();
    const g=new T.ExtrudeGeometry(s,{depth:width,bevelEnabled:true,bevelSize:.05,bevelThickness:.045,bevelSegments:3,curveSegments:6});g.translate(0,0,-width/2);g.rotateY(Math.PI/2);
    const pos=g.attributes.position;
    for(let i=0;i<pos.count;i++){const taper=Math.max(0,(Math.abs(pos.getZ(i))-length*.36)/(length*.14));pos.setX(i,pos.getX(i)*(1-.075*taper));}
    g.computeVertexNormals();return g;
  }
  const wheelParts=[];
  part(wheelParts,new T.CylinderGeometry(.345,.345,.21,20),0x20252b,0,0,0,0,0,Math.PI/2);
  for(const side of [-1,1]){
    part(wheelParts,new T.CylinderGeometry(.242,.242,.018,20),0x46505c,side*.113,0,0,0,0,Math.PI/2);
    const rim=new T.TorusGeometry(.236,.018,4,20);part(wheelParts,rim,0xb7c0c9,side*.127,0,0,0,Math.PI/2);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;box(wheelParts,0xcbd1d5,side*.132,Math.cos(a)*.135,Math.sin(a)*.135,.025,.2,.036,a);}
    part(wheelParts,new T.CylinderGeometry(.065,.065,.022,10),0xd7dde0,side*.138,0,0,0,0,Math.PI/2);
  }
  const wheelGeometry=merge(wheelParts);
  function model(style='sedan'){
    if(models.has(style))return models.get(style);
    const shuttle=style==='shuttle',suv=style==='crossover',length=shuttle?6.25:4.1,width=shuttle?1.86:1.7,roof=shuttle?2.38:suv?1.68:1.48;
    const rear=shuttle?-2.72:suv?-1.62:-1.35,front=shuttle?2.2:1.18,roofFront=shuttle?1.8:.48,roofRear=shuttle?-2.62:suv?-1.33:-.83;
    const painted=[],details=[],logos=[],belt=shuttle?1.27:1.0;
    part(painted,body(length,width,shuttle?.3:0));
    // The cabin is a sloped glasshouse, capped by a thin painted roof and pillars.
    part(details,profile([[rear,belt-.04],[front,belt-.04],[roofFront,roof],[roofRear,roof]],width-.17,.025),0x294251);
    part(painted,profile([[roofRear-.04,roof],[roofFront+.04,roof],[roofFront,roof+.065],[roofRear,roof+.065]],width-.13,.025));
    for(const side of [-1,1]){
      const x=side*(width/2-.067);
      box(details,0x9eacb6,x,belt+.02,(rear+front)/2,.025,.035,front-rear);
      // A slim B pillar splits the front and rear side windows.
      box(painted,0xffffff,x,(roof+belt+.02)/2,-.37,.05,roof-belt-.01,.09);
      if(shuttle)for(const z of [-1.55,.7])box(painted,0xffffff,x,1.66,z,.05,1.21,.09);
      for(const [za,ya,zb,yb] of [[rear,belt,roofRear,roof],[front,belt,roofFront,roof]]){
        const dz=zb-za,dy=yb-ya;
        box(painted,0xffffff,x,(ya+yb)/2,(za+zb)/2,.055,Math.hypot(dy,dz),.065,Math.atan2(dz,dy));
      }
      for(const z of [-.85,.45])box(details,0xb9c5cc,side*(width/2+.047),.88,z,.027,.035,.19);
      for(const z of [-.36,shuttle?1.4:1.03])box(details,0x41494f,side*(width/2+.046),.68,z,.018,.39,.013);
      box(details,0x222b33,side*(width/2+.048),.44,0,.025,.07,length*.42);
      box(painted,0xffffff,side*(width/2+.12),belt+.08,front-.11,.22,.13,.24);
      box(details,0x7b97a8,side*(width/2+.13),belt+.095,front-.238,.16,.08,.015);
      // Door decals sit on the flat body panel and face outward on either side.
      const decal=new T.PlaneGeometry(shuttle?2.0:1.16,shuttle?.5:.34);
      part(logos,decal,0xffffff,side*(width/2+.048),shuttle?.93:.68,shuttle?-.65:.1,0,side*Math.PI/2);
      if(suv)box(details,0x333c44,side*.61,roof+.105,-.38,.045,.04,1.45);
    }
    const nose=length/2+.046,tail=-nose;
    box(details,0x16252e,0,.66,nose,.94,.23,.018);
    for(let i=0;i<4;i++)box(details,0x89949d,0,.58+i*.047,nose+.012,.81,.012,.018);
    box(details,0x303c45,0,.46,nose,1.4,.06,.035);
    box(details,0x626e75,0,.45,tail,1.42,.07,.035);
    for(const side of [-1,1]){
      box(details,0xe0eff5,side*.62,.81,nose,.34,.13,.025);
      box(details,0xffffff,side*.62,.86,nose+.015,.3,.024,.015);
      box(details,0xaa2632,side*.63,.8,tail,.31,.16,.027);
      box(details,0xed5360,side*.63,.85,tail-.016,.27,.028,.012);
      box(details,0x18222a,side*.62,.59,nose+.015,.21,.055,.015);
    }
    box(details,0xe6e9e6,0,.61,tail-.02,.36,.14,.014);
    box(details,0x7f8b93,0,.62,tail-.031,.22,.023,.007);
    // Hood crease, rear hatch trim, and subtle windshield reflections.
    box(details,0xb6c1c6,0,1.01,tail+.2,.67,.027,.022);
    const slope=Math.atan2(roof-belt,front-roofFront),midZ=(front+roofFront)/2;
    box(details,0x72919f,0,(roof+belt)/2+.008,midZ+.021,width-.35,.015,.075,-slope);
    for(const side of [-1,1])box(details,0x172832,side*.32,belt+.07,front-.03,.45,.017,.02,0,side*.15);
    // Narrow the upper glasshouse and roof, as on a real passenger car.
    for(const {geometry} of [...painted,...details]){
      const positions=geometry.attributes.position;
      for(let i=0;i<positions.count;i++){const height=Math.max(0,Math.min(1,(positions.getY(i)-1.03)/(roof-1.03)));positions.setX(i,positions.getX(i)*(1-(shuttle?.06:.13)*height));}
      geometry.computeVertexNormals();
    }
    // The long roof lockup follows the car, so the aerial village camera can read it.
    const roofLogoLength=Math.min(roofFront-roofRear-.18,shuttle?3.2:1.5);
    part(logos,new T.PlaneGeometry(roofLogoLength,roofLogoLength*224/768),0xffffff,0,roof+.098,(roofFront+roofRear)/2,-Math.PI/2,Math.PI/2);
    const result={style,length,width,roof,paint:merge(painted),details:merge(details),logos:merge(logos),wheelbase:length*.31};models.set(style,result);return result;
  }
  function create(parent,{style='sedan',color=0xaab4bb,branded=false}={}){
    if(branded)color=FOMO_VEHICLE_COLOR;
    const g=new T.Group(),m=model(style);g.name='refined-campus-vehicle';g.userData={style,branded,length:m.length,width:m.width};parent.add(g);
    for(const [geometry,material,name] of [[m.paint,paint(color),'vehicle-paint'],[m.details,detailMaterial,'vehicle-details'],...(branded?[[m.logos,logoMaterial,'fomo-vehicle-logos']]:[])]){
      const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
    }
    const wheels=[];
    for(const side of [-1,1])for(const front of [-1,1]){const wheel=new T.Mesh(wheelGeometry,wheelMaterial);wheel.name='alloy-wheel';wheel.position.set(side*(m.width/2-.035),.395,front*m.wheelbase);wheel.castShadow=true;g.add(wheel);wheels.push(wheel);}
    return {group:g,wheels,model:m};
  }
  function movingFleet(parent,cars){
    // Moving vehicles use following contact shadows; sun shadows are cached for the campus.
    const pixels=new Uint8Array(64*128*4);
    for(let y=0;y<128;y++)for(let x=0;x<64;x++){const r=Math.hypot((x-31.5)/32,(y-63.5)/64),i=(y*64+x)*4;pixels[i+3]=Math.round(Math.max(0,1-r*r)*100);}
    const shadowMap=keep(new T.DataTexture(pixels,64,128));shadowMap.needsUpdate=true;shadowMap.magFilter=T.LinearFilter;shadowMap.minFilter=T.LinearFilter;
    const shadowMaterial=keep(new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));
    const shadowGeometry=keep(new T.PlaneGeometry(2,2));shadowGeometry.rotateX(-Math.PI/2);
    const groups=new Map(),pose=new T.Object3D(),world=new T.Matrix4(),spin=new T.Object3D();
    cars.forEach((car,index)=>{
      const temp=new T.Group(),vehicle=create(temp,car);
      const contact=new T.Mesh(shadowGeometry,shadowMaterial);contact.position.y=.058;contact.scale.set(vehicle.model.width*.76,1,vehicle.model.length*.59);vehicle.group.add(contact);
      for(const part of vehicle.group.children){
        part.updateMatrix();
        const key=[part.geometry.uuid,part.material.roughness,part.material.metalness,part.material.map?.uuid||''].join(':');
        if(!groups.has(key))groups.set(key,{geometry:part.geometry,material:part.material,records:[]});
        groups.get(key).records.push({index,local:part.matrix.clone(),position:part.position.clone(),wheel:part.name==='alloy-wheel',color:part.material.color.clone()});
      }
    });
    const batches=[...groups.values()].map(group=>{
      const material=group.material.clone();material.color.set(0xffffff);
      const mesh=new T.InstancedMesh(group.geometry,material,group.records.length);mesh.name='refined-moving-vehicles';mesh.userData.ownedMaterial=true;
      mesh.castShadow=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);parent.add(mesh);
      group.records.forEach((r,i)=>mesh.setColorAt(i,r.color));return {...group,mesh};
    });
    function update(positions,time){
      for(const batch of batches){
        batch.records.forEach((r,i)=>{
          const p=positions[r.index];pose.position.set(p.x,0,p.z);pose.rotation.set(0,p.angle,0);pose.updateMatrix();
          let local=r.local;
          if(r.wheel){spin.position.copy(r.position);spin.rotation.order='YXZ';spin.rotation.set(time*cars[r.index].speed/.345,r.position.z>0?(p.steer||0):0,0);spin.updateMatrix();local=spin.matrix;}
          world.multiplyMatrices(pose.matrix,local);batch.mesh.setMatrixAt(i,world);
        });
        batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.computeBoundingSphere();
      }
    }
    return {update,batches};
  }
  return {create,model,movingFleet,resources,wheelGeometry,wheelMaterial,detailMaterial,logoMaterial,paint};
}
