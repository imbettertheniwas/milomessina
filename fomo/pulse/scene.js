import * as T from '../campuswars/vendor/three.module.min.js';
import {COLORS,hash} from './model.mjs';
import {createEyes} from './eyes.js';
import {createIdleMotion,signalStrength,SIGNAL_SECONDS} from './scene-motion.mjs';
const TAU=Math.PI*2, clamp=T.MathUtils.clamp;
export function createScene({container,labels,tooltip,onSelect,reduced=false}){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));container.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.1,200),root=new T.Group();scene.add(root);
 // Additive glows accumulate alpha into gray on a white page. Use colored
 // transparency in light mode; keep the original luminous blend in dark mode.
 const originalBlending=new WeakMap();
 function syncTheme(){
  const light=document.documentElement.dataset.theme==='light';
  scene.traverse(object=>{for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){
   if(!originalBlending.has(material))originalBlending.set(material,material.blending);
   const original=originalBlending.get(material),blend=light&&original===T.AdditiveBlending?T.NormalBlending:original;
   if(material.blending!==blend){material.blending=blend;material.needsUpdate=true;}
  }});
 }
 const themeObserver=new MutationObserver(syncTheme);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 let width=1,height=1,chapters=[],nodes=[],particles=null,filaments=null,mode='eyes',paused=reduced,time=0,last=performance.now(),yaw=.1,pitch=.23,zoom=24,drag=null,selected=null,hover=-1,frame,disposed=false,arrivals=new Map();
 const idle=createIdleMotion();let orbitTime=0;const localCamera=new T.Vector3();
 const raycaster=new T.Raycaster(),pointer=new T.Vector2(),temp=new T.Object3D(),v=new T.Vector3(),color=new T.Color();
 let nuclei=null,halos=null,particleInfo=[],labelItems=[];
 const sphere=new T.IcosahedronGeometry(1,1),haloGeo=new T.SphereGeometry(1,12,8);
 const eyes=createEyes();root.add(eyes.group);let spread=1,focus=false,drift=true;const core=new T.Group();root.add(core);core.visible=false;
 const coreMaterial=new T.MeshBasicMaterial({color:0xcce99b,wireframe:true,transparent:true,opacity:.18,blending:T.AdditiveBlending,depthWrite:false});
 const knot=new T.Mesh(new T.TorusKnotGeometry(1.4,.34,160,12,3,5),coreMaterial);core.add(knot);
 const inner=new T.Mesh(new T.IcosahedronGeometry(.79,2),new T.MeshBasicMaterial({color:0xd7ff73,wireframe:true,transparent:true,opacity:.24,blending:T.AdditiveBlending}));core.add(inner);
 const coreRings=[];
 const weave=new T.Group();core.add(weave);
 for(let strand=0;strand<18;strand++){
  const points=[];for(let j=0;j<=210;j++){const a=j/210*TAU,phase=strand/18*TAU,r=1.95+.4*Math.sin(a*3+phase);points.push(new T.Vector3(r*Math.cos(a),.82*Math.sin(a*3+phase),r*Math.sin(a)));}
  const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:COLORS[strand%COLORS.length],transparent:true,opacity:.18,blending:T.AdditiveBlending,depthWrite:false}));weave.add(line);
 }
 for(let i=0;i<3;i++){const r=new T.Mesh(new T.TorusGeometry(2.1+i*.19,.009,4,180),new T.MeshBasicMaterial({color:COLORS[i],transparent:true,opacity:.26,blending:T.AdditiveBlending}));r.rotation.set(i*.8,.4+i*.8,.3);core.add(r);coreRings.push(r);}
 const dustGeo=new T.BufferGeometry(),dustPos=new Float32Array(750*3);for(let i=0;i<750;i++){dustPos[i*3]=(hash('dust-x'+i)-.5)*36;dustPos[i*3+1]=(hash('dust-y'+i)-.5)*25;dustPos[i*3+2]=(hash('dust-z'+i)-.5)*30;}
 dustGeo.setAttribute('position',new T.BufferAttribute(dustPos,3));const dust=new T.Points(dustGeo,new T.PointsMaterial({color:0x87a571,size:.019,transparent:true,opacity:.4,depthWrite:false}));scene.add(dust);
 const orbitLines=new T.Group();root.add(orbitLines);
 for(let i=0;i<4;i++){const p=[];for(let j=0;j<=180;j++){const a=j/180*TAU;p.push(new T.Vector3(Math.cos(a)*(8.3+i*.5),Math.sin(a*3)*.25,Math.sin(a)*(8.3+i*.5)));}const l=new T.Line(new T.BufferGeometry().setFromPoints(p),new T.LineBasicMaterial({color:0x69775c,transparent:true,opacity:i? .085:.2}));l.rotation.set(.35+i*.28,0,i*.25);orbitLines.add(l);}
 const helixRails=new T.Group();helixRails.visible=false;root.add(helixRails);
 for(let strand=0;strand<5;strand++){
  const points=[];for(let j=0;j<=400;j++){const f=j/400,a=f*TAU*2.6,r=3.35+strand*.38;points.push(new T.Vector3(Math.cos(a)*r,(f-.5)*12,Math.sin(a)*r));}
  helixRails.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:COLORS[strand],transparent:true,opacity:strand===2?.35:.14,blending:T.AdditiveBlending,depthWrite:false})));
 }
 const reticle=new T.Group();for(let i=0;i<2;i++){const m=new T.Mesh(new T.TorusGeometry(.62+i*.15,.012,4,80),new T.MeshBasicMaterial({color:0xd7ff73,transparent:true,opacity:.8,depthWrite:false}));m.rotation.x=i*Math.PI/2;reticle.add(m);}root.add(reticle);reticle.visible=false;
 function resize(){width=container.clientWidth;height=container.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}const observer=new ResizeObserver(resize);observer.observe(container);resize();
 function targets(){
  const schools=[...new Set(chapters.map(c=>c.school))].sort(),dates=chapters.map(c=>Date.parse(c.registered)),first=Math.min(...dates),span=Math.max(86400000,Math.max(...dates)-first);
  nodes.forEach((n,i)=>{
   const c=n.chapter,h=hash(c.id),a=i*2.399963229728653,r=4+Math.sqrt(i/Math.max(1,nodes.length-1))*4;
   if(mode==='eyes'){const angle=i/Math.max(1,nodes.length)*TAU*3.0,ring=6.4+hash(c.id+'ring')*2.6;n.target.set(Math.cos(angle)*ring,Math.sin(angle)*ring*.55,(h-.5)*4.0-1.2);}
   if(mode==='organism'){const tilt=(hash(c.id+'tilt')-.5)*4.5;n.target.set(Math.cos(a)*r,tilt+Math.sin(a*2)*1.3,Math.sin(a)*r*.65);}
   if(mode==='constellation'){const s=schools.indexOf(c.school),phi=Math.acos(1-2*(s+.5)/schools.length),theta=s*2.39996;const base=new T.Vector3(Math.sin(phi)*Math.cos(theta),Math.cos(phi)*.75,Math.sin(phi)*Math.sin(theta)).multiplyScalar(7);n.target.copy(base).add(new T.Vector3(Math.cos(h*TAU),Math.sin(h*TAU),Math.sin(h*TAU*2)).multiplyScalar(.48));}
   if(mode==='helix'){const t=(dates[i]-first)/span,angle=t*TAU*2.6+h*.6;n.target.set(Math.cos(angle)*(3.4+h*1.7),(t-.5)*12+(h-.5)*.65,Math.sin(angle)*(3.4+h*1.7));}
   n.target.multiplyScalar(spread);
  });
 }
 function update(ch){
  const old=new Map(nodes.map(n=>[n.chapter.id,n]));chapters=ch;nodes=ch.map((c,i)=>({chapter:c,index:i,position:old.get(c.id)?.position.clone()??new T.Vector3(0,0,0),display:new T.Vector3(),target:new T.Vector3(),color:new T.Color(COLORS[Math.floor(hash(c.school)*COLORS.length)]),size:.06+Math.sqrt(c.joined)*.022,phase:hash(c.id)*TAU}));targets();
  for(const obj of [nuclei,halos,particles,filaments])if(obj){root.remove(obj);if(obj===particles||obj===filaments)obj.geometry.dispose();obj.material.dispose();}
  nuclei=new T.InstancedMesh(sphere,new T.MeshBasicMaterial({color:0xffffff}),nodes.length);halos=new T.InstancedMesh(haloGeo,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.065,depthWrite:false,blending:T.AdditiveBlending}),nodes.length);root.add(nuclei,halos);nuclei.instanceMatrix.setUsage(T.DynamicDrawUsage);halos.instanceMatrix.setUsage(T.DynamicDrawUsage);
  nodes.forEach((n,i)=>{nuclei.setColorAt(i,n.color);halos.setColorAt(i,n.color);});
  particleInfo=[];const total=ch.reduce((s,c)=>s+c.joined,0),step=Math.max(1,Math.ceil(total/18000));
  nodes.forEach((n,i)=>{for(let j=0;j<n.chapter.joined;j+=step)particleInfo.push({node:i,phase:hash(n.chapter.id+j)*TAU,r:.22+hash('r'+n.chapter.id+j)*(.25+Math.sqrt(n.chapter.joined)*.04),inclination:hash('y'+n.chapter.id+j)*TAU,eye:eyes.samples[Math.floor(hash('eye'+n.chapter.id+j)*eyes.samples.length)]});});
  const geo=new T.BufferGeometry(),pos=new Float32Array(particleInfo.length*3),colors=new Float32Array(pos.length);particleInfo.forEach((p,i)=>{nodes[p.node].color.toArray(colors,i*3);});geo.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));geo.setAttribute('color',new T.BufferAttribute(colors,3));
  geo.setAttribute('alpha',new T.BufferAttribute(new Float32Array(particleInfo.length).fill(1),1));
  particles=new T.Points(geo,new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexColors:true,uniforms:{pixelRatio:{value:renderer.getPixelRatio()}},vertexShader:'attribute float alpha; varying float vAlpha; varying vec3 vColor; uniform float pixelRatio; void main(){vColor=color;vAlpha=alpha; vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(65./-p.z,1.8,5.)*pixelRatio;}',fragmentShader:'varying float vAlpha; varying vec3 vColor; void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=pow(1.-d*2.,1.6);gl_FragColor=vec4(vColor*1.3,a*vAlpha);}' }));root.add(particles);
  const linePos=new Float32Array(nodes.length*24*6),lineColors=new Float32Array(linePos.length);nodes.forEach((n,i)=>{for(let j=0;j<48;j++)n.color.clone().multiplyScalar(.72).toArray(lineColors,i*144+j*3);});const lg=new T.BufferGeometry();lg.setAttribute('position',new T.BufferAttribute(linePos,3).setUsage(T.DynamicDrawUsage));lg.setAttribute('color',new T.BufferAttribute(lineColors,3));filaments=new T.LineSegments(lg,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.36,blending:T.AdditiveBlending,depthWrite:false}));root.add(filaments);
  labels.replaceChildren();labelItems=[];const top=[...nodes].sort((a,b)=>b.chapter.joined-a.chapter.joined).slice(0,6);top.forEach(n=>{const el=document.createElement('span');el.className='scene-label';el.textContent=n.chapter.letters+' / '+n.chapter.joined;labels.append(el);labelItems.push({id:n.chapter.id,el});});
  for(const a of arrivals.values())labels.append(a.label);
  if(selected)select(selected);syncTheme();return {particleStep:step};
 }
 function select(id){selected=id;const n=nodes.find(n=>n.chapter.id===id);if(n){reticle.visible=true;labelItems.forEach(l=>l.el.classList.toggle('selected',l.id===id));}}
 function setMode(value){mode=value;eyes.group.visible=mode==='eyes';targets();core.visible=mode==='organism';orbitLines.visible=mode!=='helix';helixRails.visible=mode==='helix';}
 function removeArrival(id,a){
  for(const ring of a.rings){root.remove(ring);ring.geometry.dispose();ring.material.dispose();}
  a.label.remove();arrivals.delete(id);
 }
 function pulse(id,count=1,{preview=false}={}){
  const n=nodes.find(n=>n.chapter.id===id);if(!n||!Number.isSafeInteger(count)||count<1)return;
  let a=arrivals.get(id);
  if(a&&preview&&!a.preview)return;
  if(!a){
   const rings=[0,1].map(()=>{const ring=new T.Mesh(new T.TorusGeometry(1,.018,6,80),new T.MeshBasicMaterial({color:n.color,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));root.add(ring);return ring;});
   const label=document.createElement('span');label.className='scene-arrival';labels.append(label);
   a={age:0,count:0,preview,rings,label};arrivals.set(id,a);syncTheme();
  }
  a.count=a.preview===preview?a.count+count:count;a.preview=preview;a.age=0;
  a.label.textContent=n.chapter.letters+' · '+(preview?'PREVIEW':'+'+a.count.toLocaleString('en-US')+' JOINED');
  a.label.title=n.chapter.name+' · '+n.chapter.school;
 }
 function pick(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return nuclei?raycaster.intersectObject(nuclei)[0]?.instanceId:undefined;}
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{idle.activity();hover=-1;drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{idle.activity();if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;yaw+=dx*.006;pitch=clamp(pitch+dy*.004,-1.1,1.1);drag.moved ||=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5;drag.x=e.clientX;drag.y=e.clientY;tooltip.hidden=true;return;}const i=pick(e);hover=i??-1;canvas.style.cursor=i===undefined?'grab':'pointer';tooltip.hidden=i===undefined;if(i!==undefined){const c=nodes[i].chapter;tooltip.replaceChildren();const title=document.createElement('div');title.textContent=c.name;const school=document.createElement('small');school.textContent=c.school;const count=document.createElement('b');count.textContent=c.joined+' joined / '+c.active+' roster';tooltip.append(title,school,count);const rect=container.getBoundingClientRect();tooltip.style.left=Math.min(width-230,Math.max(6,e.clientX-rect.left+12))+'px';tooltip.style.top=Math.max(40,e.clientY-rect.top-60)+'px';}});
 canvas.addEventListener('pointerup',e=>{idle.activity();if(drag&&!drag.moved){const i=pick(e);if(i!==undefined)onSelect(nodes[i].chapter.id);}drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;idle.activity();});canvas.addEventListener('lostpointercapture',()=>drag=null);canvas.addEventListener('pointerleave',()=>{tooltip.hidden=true;hover=-1;});canvas.addEventListener('wheel',e=>{idle.activity();e.preventDefault();zoom=clamp(zoom+e.deltaY*.013,12,40);},{passive:false});
 function animate(now){
  if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
  const t=idle.advance(dt,{held:!!drag||hover>=0,paused,reduced});if(drift)orbitTime+=t-time;time=t;
  const distance=zoom*Math.max(1,.88/camera.aspect);camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(0,0,0);
  root.rotation.set(Math.sin(orbitTime*.075)*.055,Math.sin(orbitTime*.1)*.24,Math.sin(orbitTime*.06)*.018);eyes.animate(t);eyes.group.visible=mode==='eyes';
  weave.rotation.set(t*.08,-t*.06,t*.04);knot.rotation.set(t*.08,t*.1,t*.04);inner.rotation.set(-t*.11,t*.16,0);coreRings.forEach((r,i)=>r.rotation.z=t*.04*(i%2?-1:1));dust.rotation.y=t*.003;
  const lerp=reduced?1:1-Math.exp(-dt*3.2);
  nodes.forEach((n,i)=>{
   n.position.lerp(n.target,lerp);n.display.copy(n.position);
   if(!reduced){n.display.x+=Math.sin(orbitTime*.3+n.phase)*.12;n.display.y+=Math.sin(orbitTime*.42+n.phase)*.16;n.display.z+=Math.cos(orbitTime*.28+n.phase)*.09;}
   const arrival=arrivals.get(n.chapter.id),signal=arrival?signalStrength(arrival.age,paused||reduced):0;
   temp.position.copy(n.display);temp.rotation.set(t*.08+n.phase,t*.12,0);
   const emphasis=signal>0?1:focus&&n.chapter.id!==selected?.35:1;
   temp.scale.setScalar(n.size*(i===hover?1.65:1)*(1+signal*.85)*emphasis);
   temp.updateMatrix();nuclei.setMatrixAt(i,temp.matrix);
   color.copy(n.color).multiplyScalar(1+signal*.45);nuclei.setColorAt(i,color);
   temp.scale.multiplyScalar(3.3+signal*2.2);temp.updateMatrix();halos.setMatrixAt(i,temp.matrix);
  });
  if(nuclei){nuclei.instanceMatrix.needsUpdate=true;if(nuclei.instanceColor)nuclei.instanceColor.needsUpdate=true;halos.instanceMatrix.needsUpdate=true;nuclei.computeBoundingSphere();}
  if(particles){const pos=particles.geometry.attributes.position,alphas=particles.geometry.attributes.alpha;particleInfo.forEach((p,i)=>{const n=nodes[p.node],a=p.phase+t*.24;let x=n.display.x+Math.cos(a)*p.r,y=n.display.y+Math.sin(a+p.inclination)*p.r*.7,z=n.display.z+Math.sin(a)*p.r;if(mode==='eyes'){x=p.eye[0]+Math.sin(a)*.022;y=p.eye[1]+Math.cos(a*1.4)*.022;z=Math.sin(p.phase+t*.65)*.35;}const k=reduced?1:1-Math.exp(-dt*4);pos.setXYZ(i,T.MathUtils.lerp(pos.getX(i),x,k),T.MathUtils.lerp(pos.getY(i),y,k),T.MathUtils.lerp(pos.getZ(i),z,k));alphas.setX(i,focus&&n.chapter.id!==selected?.06:1);});alphas.needsUpdate=true;pos.needsUpdate=true;particles.geometry.computeBoundingSphere();}
  if(filaments){const array=filaments.geometry.attributes.position.array;nodes.forEach((n,i)=>{for(let j=0;j<24;j++){for(let k=0;k<2;k++){const f=(j+k)/24,o=i*144+j*6+k*3,bend=Math.sin(f*Math.PI);array[o]=n.display.x*f+Math.sin(n.phase+f*3+t*.06)*bend*.85;array[o+1]=n.display.y*f+Math.cos(n.phase+f*2)*bend*1.2;array[o+2]=n.display.z*f+Math.cos(n.phase+f*3+t*.06)*bend*.85;}}});filaments.geometry.attributes.position.needsUpdate=true;filaments.geometry.computeBoundingSphere();filaments.visible=mode==='organism'||mode==='eyes';filaments.material.opacity=mode==='eyes'?.14:.36;}
  const selectedNode=nodes.find(n=>n.chapter.id===selected);if(selectedNode){reticle.position.copy(selectedNode.display);reticle.rotation.set(t*.1,t*.2,t*.12);reticle.scale.setScalar(.65+selectedNode.size*2);}
  root.updateMatrixWorld();localCamera.copy(camera.position);root.worldToLocal(localCamera);
  const occupied=[];
  for(const [id,a] of arrivals){
   const n=nodes.find(n=>n.chapter.id===id);a.age+=dt;
   if(!n||a.age>=SIGNAL_SECONDS){removeArrival(id,a);continue;}
   a.rings.forEach((ring,i)=>{
    const age=a.age-i*1.2,cycle=((age%2.4)+2.4)%2.4/2.4;
    ring.visible=age>=0&&!reduced&&!paused;ring.position.copy(n.display);ring.lookAt(localCamera);
    ring.scale.setScalar(n.size*1.8+cycle*1.65);
    ring.material.opacity=(1-cycle)*.72*Math.min(1,(SIGNAL_SECONDS-a.age)/1.5);
   });
   v.copy(n.display).applyMatrix4(root.matrixWorld).project(camera);
   const x=(v.x*.5+.5)*width,y=(-v.y*.5+.5)*height;
   const hidden=v.z>1||v.z<-1||x<0||x>width||y<0||y>height;
   a.label.style.display=hidden?'none':'';
   a.label.style.opacity=paused||reduced?'1':String(Math.min(1,(SIGNAL_SECONDS-a.age)/1.5));
   const labelX=clamp(x+14,8,Math.max(8,width-a.label.offsetWidth-8)),labelY=clamp(y-26,72,height-110);
   a.label.style.transform=`translate(${labelX}px,${labelY}px)`;
   if(!hidden)occupied.push({x:labelX,y:labelY});
  }
  [...labelItems].sort((a,b)=>Number(b.id===selected)-Number(a.id===selected)).forEach(l=>{const n=nodes.find(n=>n.chapter.id===l.id);if(!n)return;v.copy(n.display).applyMatrix4(root.matrixWorld).project(camera);const x=(v.x*.5+.5)*width,y=(-v.y*.5+.5)*height;l.el.style.transform=`translate(${x+9}px,${y-12}px)`;const collides=occupied.some(p=>Math.abs(p.x-x)<110&&Math.abs(p.y-y)<24);const hidden=arrivals.has(l.id)||v.z>1||x<0||x>width-90||y<72||y>height-108||collides;l.el.style.display=hidden?'none':'';if(!hidden)occupied.push({x,y});});
  renderer.render(scene,camera);
 }
 syncTheme();frame=requestAnimationFrame(animate);
 return {update,select,setMode,pulse,setFocus(v){focus=v;},setSpread(v){spread=v;targets();},setDrift(v){drift=v;},setPaused(v){paused=v;},reset(){yaw=.1;pitch=.23;zoom=24;},dispose(){for(const [id,a] of arrivals)removeArrival(id,a);disposed=true;cancelAnimationFrame(frame);observer.disconnect();themeObserver.disconnect();renderer.dispose();}};
}
