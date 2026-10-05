import * as T from './vendor/three.module.min.js';

// Albers equal-area projection keeps the continental silhouette recognizable.
function project(lon,lat){
 if(lon>0)lon-=360;
 if(lat>50)return {x:-91+(lon+152)*.55,y:-49+(lat-64)*.6};
 if(lon<-140)return {x:-58+(lon+157)*1.15,y:-47+(lat-20)*1.15};
 const rad=Math.PI/180,p1=29.5*rad,p2=45.5*rad,n=(Math.sin(p1)+Math.sin(p2))/2,c=Math.cos(p1)**2+2*n*Math.sin(p1),r=Math.sqrt(c-2*n*Math.sin(lat*rad))/n,r0=Math.sqrt(c-2*n*Math.sin(37.5*rad))/n,a=n*(lon+96)*rad;
 return {x:235*r*Math.sin(a),y:235*(r0-r*Math.cos(a))};
}
export async function createNationalMap(host,{onSelect}){
 const response=await fetch(new URL('./data/us-states.json',import.meta.url));if(!response.ok)throw Error('US map unavailable');const topology=await response.json();
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.prepend(renderer.domElement);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.domElement.setAttribute('aria-label','Raised United States map. Drag to tilt, pinch or scroll to zoom. School pins and the search list are keyboard accessible.');
 const overlay=document.createElement('div');overlay.className='national-pins';host.append(overlay);
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-130,130,80,-80,1,1000),root=new T.Group();scene.add(root);root.rotation.set(-.55,0,-.035);
 scene.add(new T.HemisphereLight(0xeaf6ff,0x274078,1.8));const light=new T.DirectionalLight(0xffffff,2.0);light.position.set(-60,130,180);scene.add(light);
 const decoded=topology.arcs.map(arc=>{let x=0,y=0;return arc.map(p=>{x+=p[0];y+=p[1];return [x*topology.transform.scale[0]+topology.transform.translate[0],y*topology.transform.scale[1]+topology.transform.translate[1]];});});
 const ring=ids=>ids.flatMap((id,i)=>{const a=id<0?[...decoded[~id]].reverse():decoded[id];return i?a.slice(1):a;});
 const land=new T.Group();root.add(land);const side=new T.MeshStandardMaterial({color:0x4475ba,roughness:.65}),edge=new T.LineBasicMaterial({color:0x879baf,transparent:true,opacity:.5});
 for(const state of topology.objects.states.geometries){if(+state.id>56)continue;
  const top=new T.MeshStandardMaterial({color:[0xd7e1df,0xe3e7df,0xdce5e4,0xcfdcdd,0xe5e8e3][+state.id%5],roughness:.85});
  for(const polygon of state.type==='Polygon'?[state.arcs]:state.arcs){const points=ring(polygon[0]).map(([lon,lat])=>project(lon,lat));if(points.length<3)continue;
   const shape=new T.Shape(points.map(p=>new T.Vector2(p.x,p.y))),geometry=new T.ExtrudeGeometry(shape,{depth:3.6,bevelEnabled:false,curveSegments:1});land.add(new T.Mesh(geometry,[top,side]));
   const line=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(p.x,p.y,3.64)));land.add(new T.LineLoop(line,edge));
  }
 }
 // A restrained navigation grid beneath the physical map, with no animation loop.
 const gridPoints=[];for(let x=-150;x<=150;x+=10)gridPoints.push(x,-85,-3,x,85,-3);for(let y=-80;y<=80;y+=10)gridPoints.push(-150,y,-3,150,y,-3);
 const gridGeometry=new T.BufferGeometry();gridGeometry.setAttribute('position',new T.Float32BufferAttribute(gridPoints,3));root.add(new T.LineSegments(gridGeometry,new T.LineBasicMaterial({color:0x6494cb,transparent:true,opacity:.13})));
 const houses=new T.Group();root.add(houses);const box=new T.BoxGeometry(1,1,1),roof=new T.ConeGeometry(1,1,4),disc=new T.CircleGeometry(1,24),wall=new T.MeshStandardMaterial({color:0xf5f5eb,roughness:.75}),blue=new T.MeshStandardMaterial({color:0x3659ed,roughness:.45}),gold=new T.MeshStandardMaterial({color:0xe8b65b,roughness:.55});
 let markers=[],selected='',disposed=false,zoomLevel=1,width=1,height=1,drag=null,pinch=0;const pointers=new Map(),pan=new T.Vector2();
 function clear(){houses.clear();markers=[];overlay.replaceChildren();}
 function setSchools(schools){clear();for(const school of schools){if(!Number.isFinite(school.lat)||!Number.isFinite(school.lon))continue;
  const p=project(school.lon,school.lat),group=new T.Group();group.position.set(p.x,p.y,3.8);houses.add(group);
  const pad=new T.Mesh(disc,blue);pad.scale.setScalar(1.85);group.add(pad);
  const body=new T.Mesh(box,wall);body.scale.set(2,1.7,1.7);body.position.z=1;group.add(body);
  const cap=new T.Mesh(roof,school.rank<=3?gold:blue);cap.rotation.set(Math.PI/2,Math.PI/4,0);cap.scale.set(1.7,1.3,1.7);cap.position.z=2.4;group.add(cap);
  const button=document.createElement('button');button.type='button';button.className='national-pin';button.dataset.school=school.id;button.setAttribute('aria-label',`${school.name}, ${school.members} members`);button.title=school.name;overlay.append(button);
  const label=document.createElement('span');label.className='national-pin-label';button.append(label);
  const marker={school,group,pad,button,label,x:0,y:0,nearby:[]};button.addEventListener('click',()=>{const nearby=[...marker.nearby];if(nearby.length>1)zoomLevel=Math.min(3.8,zoomLevel*1.6);pan.set(0,0);onSelect(school.id,nearby);});button.addEventListener('focus',()=>button.classList.add('pin-focused'));button.addEventListener('blur',()=>button.classList.remove('pin-focused'));markers.push(marker);
 }select(selected);}
 function positionPins(){root.updateMatrixWorld(true);const ordered=[...markers].sort((a,b)=>(b.school.id===selected)-(a.school.id===selected)||a.school.rank-b.school.rank),placed=[],labels=[];
  for(const m of ordered){const v=m.group.localToWorld(new T.Vector3(0,0,3)).project(camera);m.x=(v.x+1)*width/2;m.y=(1-v.y)*height/2;m.nearby=[m.school.id];m.button.hidden=m.x<12||m.x>width-12||m.y<16||m.y>height-20;
   const neighbor=placed.find(p=>Math.hypot(p.x-m.x,p.y-m.y)<(width<500?22:19));if(neighbor){neighbor.nearby.push(m.school.id);m.button.hidden=true;}else if(!m.button.hidden)placed.push(m);
   m.button.style.left=m.x+'px';m.button.style.top=m.y+'px';m.button.classList.toggle('is-selected',m.school.id===selected);m.button.setAttribute('aria-pressed',String(m.school.id===selected));m.pad.material=m.school.id===selected?gold:blue;
  }
  for(const m of placed){const isSelected=m.school.id===selected,candidate=isSelected||m.school.rank<=5;const name=m.school.name.replace(/^University of /,'').replace(/ University$/,'').replace(' - Bloomington','').replace(' at Boulder',' Boulder');
   m.label.textContent=isSelected?name:candidate?`${name} · ${m.school.members}`:m.nearby.length>1?String(m.nearby.length):'';
   const w=Math.min(200,name.length*6+45),x=Math.max(4,Math.min(width-w-4,m.x-w/2)),y=m.y-42;
   const collides=labels.some(r=>x<r.x+r.w+10&&x+w+10>r.x&&y<r.y+35&&y+35>r.y);
   const named=candidate&&(isSelected||(!collides&&y>40));m.button.classList.toggle('is-named',named);m.button.classList.toggle('is-cluster',m.nearby.length>1&&!named);m.label.style.setProperty('--label-shift',Math.max(w/2+4-m.x,Math.min(0,width-w/2-4-m.x))+'px');if(named)labels.push({x,y,w});
   if(!named)m.label.textContent=m.nearby.length>1?String(m.nearby.length):name;
   m.button.setAttribute('aria-label',`${m.school.name}, ${m.school.members} members${m.nearby.length>1?', '+m.nearby.length+' nearby schools':''}`);
  }
 }
 function render(){if(disposed||!host.clientWidth||!host.clientHeight)return;root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(land),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),aspect=width/height,half=Math.max(size.y/2+13,(size.x/2+12)/aspect)/zoomLevel;
  const focus=markers.find(m=>m.school.id===selected);if(focus){const p=focus.group.getWorldPosition(new T.Vector3());center.lerp(p,Math.min(1,Math.max(0,zoomLevel-1)));}center.x+=pan.x;center.y+=pan.y;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.position.set(center.x,center.y,320);camera.lookAt(center.x,center.y,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();positionPins();renderer.render(scene,camera);
 }
 function resize(){width=host.clientWidth;height=host.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);render();}
 function select(id){if(selected!==id)pan.set(0,0);selected=id;render();}
 function zoom(f){zoomLevel=Math.max(.8,Math.min(3.8,zoomLevel/f));render();}
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,rx:root.rotation.x,rz:root.rotation.z,px:pan.x,py:pan.y};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
 canvas.addEventListener('pointermove',e=>{if(!drag||!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(d>0){zoomLevel=Math.max(.8,Math.min(3.8,zoomLevel*d/Math.max(1,pinch)));pinch=d;}}else if(zoomLevel>1.05){pan.x=drag.px-(e.clientX-drag.x)*(camera.right-camera.left)/width;pan.y=drag.py+(e.clientY-drag.y)*(camera.top-camera.bottom)/height;}else{root.rotation.x=Math.max(-.95,Math.min(-.12,drag.rx+(e.clientY-drag.y)*.004));root.rotation.z=Math.max(-.35,Math.min(.35,drag.rz+(e.clientX-drag.x)*.002));}render();});
 const release=e=>{pointers.delete(e.pointerId);drag=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001));},{passive:false});
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 return {setSchools,select,resize,zoom,reset(){zoomLevel=1;pan.set(0,0);root.rotation.set(-.55,0,-.035);render();},dispose(){disposed=true;observer.disconnect();const resources=new Set([box,roof,disc,wall,blue,gold]);scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[]))resources.add(m);});resources.forEach(r=>r.dispose());renderer.dispose();renderer.domElement.remove();overlay.remove();}};
}
