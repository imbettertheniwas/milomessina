const radians=Math.PI/180;
const coordinates=school=>Number.isFinite(school?.lat)&&Number.isFinite(school?.lon)&&Math.abs(school.lat)<=90&&Math.abs(school.lon)<=180;

export function schoolSeparation(from,to){
 const a=from.lat*radians,b=to.lat*radians,longitude=(to.lon-from.lon)*radians;
 const h=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(longitude/2)**2;
 return {km:6371*2*Math.asin(Math.sqrt(Math.min(1,h))),bearing:Math.atan2(Math.sin(longitude)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(longitude))};
}

// Only real registered destinations with known campus coordinates are eligible.
export function nearbySchools(origin,schools,limit=6){
 if(!coordinates(origin))return [];
 const seen=new Set([origin.id]);
 return schools.filter(school=>{
  if(seen.has(school.id)||!coordinates(school)||!school.chapters?.length)return false;
  seen.add(school.id);return true;
 }).map(school=>({school,...schoolSeparation(origin,school)}))
  .sort((a,b)=>a.km-b.km||a.school.id.localeCompare(b.school.id)).slice(0,limit);
}

export function nearbyIslandLayout(origin,schools,spec,limit=6){
 const base=Math.max(380,Math.max(spec.rx,spec.rz)*2.8),placed=[];
 for(const neighbor of nearbySchools(origin,schools,limit)){
  // Compress geographic distances for visibility while preserving real bearings.
  let distance=base+Math.min(260,Math.sqrt(neighbor.km)*15);
  const radius=44+Math.min(16,Math.sqrt(neighbor.school.chapters.length)*3);
  let x,z;
  for(let attempt=0;attempt<24;attempt++){
   x=spec.x+Math.sin(neighbor.bearing)*distance;z=spec.z-Math.cos(neighbor.bearing)*distance;
   if(placed.every(p=>Math.hypot(x-p.x,z-p.z)>radius+p.radius+55))break;
   distance+=120;
  }
  placed.push({...neighbor,x,z,y:-35,radius,distance});
 }
 return placed;
}

export function nearbyDistanceLabel(neighbor){
 const miles=neighbor.km*.621371,compass=['n','ne','e','se','s','sw','w','nw'];
 const direction=compass[(Math.round(neighbor.bearing/(Math.PI/4))+8)%8];
 return `${miles<1?'<1':Math.round(miles).toLocaleString('en-US')} mi ${direction} · jump ↗`;
}

export function createNearbyIslands(T,{host=null,onTravel=()=>{},onFocus=()=>{},documentRef=globalThis.document}={}){
 const root=new T.Group();root.name='nearby-school-islands';
 const pickables=[],resources=new Set(),own=resource=>(resources.add(resource),resource);
 const overlay=host&&documentRef?.createElement?documentRef.createElement('div'):null;
 if(overlay){overlay.className='nearby-school-labels';overlay.setAttribute('aria-label','Nearby schools in Greek Wars');host.append(overlay);}
 // Shared low-detail silhouettes avoid constructing distant campuses or crowds.
 const segments=24,vertices=[],colors=[],indices=[],stone=new T.Color();
 const rings=[[1,0],[.98,-.13],[.8,-.5],[.4,-.86],[0,-1.05]];
 for(let ring=0;ring<rings.length;ring++)for(let i=0;i<segments;i++){
  const angle=i/segments*Math.PI*2,[scale,y]=rings[ring],edge=1+Math.sin(angle*5)*.045;
  vertices.push(Math.cos(angle)*scale*edge,y,Math.sin(angle)*scale*edge);
  stone.setHex(ring%2?0x797768:0x686a60).multiplyScalar(.92+.1*Math.sin(angle*3+ring));colors.push(stone.r,stone.g,stone.b);
  if(ring<rings.length-1){const a=ring*segments+i,b=ring*segments+(i+1)%segments;indices.push(a,b,a+segments,b,b+segments,a+segments);}
 }
 const rockGeometry=own(new T.BufferGeometry());rockGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));rockGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));rockGeometry.setIndex(indices);rockGeometry.computeVertexNormals();
 const rockMaterial=own(new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));
 const grassGeometry=own(new T.CylinderGeometry(1,1,.035,segments));
 const grassMaterial=own(new T.MeshStandardMaterial({color:0x849767,roughness:1}));
 const buildingGeometry=own(new T.BoxGeometry(1,1,1)),roofGeometry=own(new T.ConeGeometry(1,1,4));
 const walls=own(new T.MeshStandardMaterial({color:0xd5c3a5,roughness:1})),roofs=own(new T.MeshStandardMaterial({color:0x746064,roughness:1}));
 let entries=[],signature='',night=false;
 const point=new T.Vector3(),toward=new T.Vector3(),ray=new T.Ray(),hit=new T.Vector3(),campusBox=new T.Box3();
 function setSchool(school,schools,spec){
  const layout=school?nearbyIslandLayout(school,schools,spec):[];
  const nextSignature=JSON.stringify([school?.id,spec,layout.map(p=>[p.school.id,p.school.name,p.km,p.x,p.z,p.radius])]);
  if(nextSignature===signature)return;signature=nextSignature;
  for(const entry of entries)entry.label?.remove();root.clear();pickables.length=0;entries=[];
  campusBox.min.set(spec.x-spec.rx,-spec.depth*1.25,spec.z-spec.rz);campusBox.max.set(spec.x+spec.rx,1,spec.z+spec.rz);
  for(const item of layout){
   const group=new T.Group();group.position.set(item.x,item.y,item.z);root.add(group);
   const data={action:'school',school:item.school.id,name:item.school.name};
   const rock=new T.Mesh(rockGeometry,rockMaterial);rock.scale.set(item.radius,38,item.radius*.76);group.add(rock);
   const grass=new T.Mesh(grassGeometry,grassMaterial);grass.scale.set(item.radius,1,item.radius*.76);group.add(grass);
   for(const mesh of [rock,grass]){mesh.userData=data;pickables.push(mesh);}
   // Generic campus scenery, not a fabricated count of chapter houses.
   for(let i=0;i<5;i++){
    const x=(i%3-1)*18,z=(Math.floor(i/3)-.5)*21,height=8+(i%3)*3;
    const building=new T.Mesh(buildingGeometry,walls);building.position.set(x,height/2,z);building.scale.set(12,height,9);group.add(building);
    const roof=new T.Mesh(roofGeometry,roofs);roof.position.set(x,height+3,z);roof.rotation.y=Math.PI/4;roof.scale.set(10,6,8);group.add(roof);
    for(const mesh of [building,roof]){mesh.userData=data;pickables.push(mesh);}
   }
   let label=null;
   if(overlay){
    label=documentRef.createElement('button');label.type='button';label.className='nearby-school-label';label.hidden=true;label.dataset.school=item.school.id;
    label.setAttribute('aria-label',`Jump to ${item.school.name}, ${nearbyDistanceLabel(item).replace(' · jump ↗','')}`);
    const name=documentRef.createElement('strong'),distance=documentRef.createElement('span');name.textContent=item.school.name;distance.textContent=nearbyDistanceLabel(item);label.append(name,distance);
    label.addEventListener('pointerenter',onFocus);label.addEventListener('focus',onFocus);label.addEventListener('click',()=>onTravel(item.school.id));overlay.append(label);
   }
   entries.push({...item,group,label});
  }
  root.visible=Boolean(entries.length);setNight(night);
 }
 function setNight(value){night=value;grassMaterial.color.setHex(value?0x586c63:0x849767);walls.color.setHex(value?0x9394ae:0xd5c3a5);}
 function update(camera,width,height,show=true){
  if(overlay)overlay.hidden=!show;
  if(!overlay||!show)return;
  const occupied=[];
  for(const entry of entries){
   const label=entry.label;
   point.set(entry.x,entry.y,entry.z);toward.copy(point).sub(camera.position);const distance=toward.length();ray.set(camera.position,toward.normalize());
   const blocked=ray.intersectBox(campusBox,hit)&&hit.distanceTo(camera.position)<distance-70;
   point.set(entry.x,entry.y-48,entry.z).project(camera);const x=(point.x+1)*width/2,y=(1-point.y)*height/2;
   const labelWidth=Math.min(184,width-24),left=x-labelWidth/2,top=y+6;
   const visible=!blocked&&point.z>-1&&point.z<1&&left>=8&&left+labelWidth<=width-8&&top>=95&&y<height-95&&occupied.every(r=>Math.abs(x-r.x)>labelWidth+8||Math.abs(y-r.y)>72);
   label.hidden=!visible;
   if(visible){label.style.transform=`translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`;label.style.width=`${labelWidth}px`;occupied.push({x,y});}
  }
 }
 return {root,pickables,setSchool,setNight,update,get farDistance(){return entries.length?Math.max(...entries.map(e=>e.distance))+1600:650;},get schools(){return entries.map(e=>e.school);},dispose(){for(const resource of resources)resource.dispose();overlay?.remove();root.clear();root.removeFromParent();entries=[];pickables.length=0;}};
}
