import {createPedestrianSpacing} from '../village-pedestrian-spacing.js';
import {createFramePacer} from '../village-frame-pacing.js';
import {createPointerHover,releasedMouseDrag} from '../village-pointer-hover.js';
import {villageQuality} from '../village-quality.js';
import {clampCampusTarget} from '../village-campus-bounds.js';
import {createStreetNavigation,streetStops,streetStep} from '../village-street-navigation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.min.js';
import {createFomoBlimp,DISCORD_INVITE} from '../village-blimp.js';
import {createMoneyRain} from '../village-money-rain.js';
import {INTRO_DURATION,openingView,introViewAt,introCaptionAt} from '../village-intro.js';

async function cameraHarness(reduced=false,initialHash='',deferWarmup=false,mobile=false,screen={width:1200,height:650}){
  const elements=new Map(),events=new Map(),selections=[],lighting=[],builds=[],pixelRatios=[];let intersection,frame,camera,finishWarmup,blimp,mockVillage,renders=0;
  function element(id){if(!elements.has(id))elements.set(id,{clientWidth:1200,clientHeight:650,hidden:false,style:{setProperty(){}},querySelectorAll:()=>[],classList:{add(){},remove(){},toggle(){}},getAttribute:()=> 'false',setAttribute(){},prepend(){},focus(){sandbox.document.activeElement=this;},setPointerCapture(){},click(){this.clicks=(this.clicks||0)+1;},addEventListener(type,fn){events.set(id+':'+type,fn);}});return elements.get(id);}
  element('village-drawer').hidden=true;
  element('chapters-data').textContent='{"chapters":[]}';
  Object.assign(element('village-viewport'),{clientWidth:screen.width,clientHeight:screen.height});
  const canvas=element('canvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:1200,height:650});canvas.hasPointerCapture=()=>false;
  // What sits under the finger when the tap ends: the village, unless a test puts a control there.
  let topmost=canvas;
  class Renderer{constructor(){this.domElement=canvas;this.shadowMap={};}setPixelRatio(ratio){pixelRatios.push(ratio);}setSize(){}render(scene,view){renders++;scene.updateMatrixWorld(true);camera=view;}}
  const sandbox={createPedestrianSpacing,createFramePacer,clampCampusTarget,createPointerHover:(...args)=>createPointerHover(...args,{schedule:fn=>{fn();return 1;},cancel(){}}),releasedMouseDrag,DISCORD_INVITE,createFomoBlimp:T=>(blimp=createFomoBlimp(T)),villageQuality:()=>villageQuality(mobile),createStreetNavigation,streetStops,streetStep,prewarmVillage:()=>({then(done){finishWarmup=done;if(!deferWarmup)done();return {catch(){}};}}),createMoneyRain,INTRO_DURATION,openingView,introViewAt,introCaptionAt,THREE:{...THREE,WebGLRenderer:Renderer},createVillage:(_T,input)=>(builds.push(input),mockVillage={pedestrians:[],dispose(){},extension:0,world:new THREE.Group(),pickables:[],anchors:[{id:'sigma-chi-sdsu',lot:{x:-20,z:-19}}],selection:new THREE.Object3D(),competition:{badges:[]},nightLife:{setNight(night){lighting.push(night);}},animateCrowd(){},animateEffects(){}}),createDistricts:()=>({pedestrians:[],stadium:{root:new THREE.Group()},root:new THREE.Group(),update(){return false;},animate(){},setNight(){}}),CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},performance:{now:()=>0},console,document:{removeEventListener(type){events.delete('document:'+type);},getElementById:element,elementFromPoint:()=>topmost,addEventListener(type,fn){events.set('document:'+type,fn);},dispatchEvent(event){if(event.type==='village:select')selections.push(event.detail.id);},hidden:false},matchMedia:query=>({matches:query.includes('reduced-motion')&&reduced}),devicePixelRatio:2,location:{hash:initialHash},URLSearchParams,ResizeObserver:class{observe(){}},IntersectionObserver:class{constructor(fn){intersection=fn;}observe(){}},addEventListener(type,fn){events.set('window:'+type,fn);},requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame(){}};
  sandbox.createVillageRendererAsync=async (...args)=>sandbox.createVillage(...args);
  const source=fs.readFileSync(new URL('../village.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
  vm.runInNewContext(source,sandbox);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  let now=100;
  return {village:()=>mockVillage,blimp:()=>blimp,camera:()=>camera,builds,coverCanvas(id){topmost=id?element(id):canvas;},pixelRatios,renders:()=>renders,finishWarmup:()=>finishWarmup(),selections,lighting,lens:()=>camera.fov,element,fire(name,event){events.get(name)(event);},show(visible){intersection([{isIntersecting:visible}]);},step(seconds,fps=60){for(let t=0;t<seconds;t+=1/fps){now+=1000/fps;const fn=frame;frame=null;fn?.(now);}return camera?.position.clone();},drag(){events.get('canvas:pointerdown')({button:0,pointerId:1,clientX:0,clientY:0});},reset(){events.get('village-overview:click')();}};
}
test('slow frames preserve resolution and hidden villages perform no rendering',async()=>{
  const h=await cameraHarness();h.show(true);h.step(20,10);
  assert.equal(h.pixelRatios.length,1,'Slow frames never resize the drawing buffer');
  const renders=h.renders();h.show(false);h.step(10);assert.equal(h.renders(),renders);
  h.show(true);h.step(.1);assert(h.renders()>renders);
});
test('entrance falls from the campus overview into the row in 13.6 seconds and does not replay',async()=>{
  const h=await cameraHarness();h.show(true);const high=h.step(.02);assert(high.y>75);
  const low=h.step(INTRO_DURATION);assert(low.y<14);assert(low.distanceTo(high)>60);
  h.show(false);h.step(1);h.show(true);assert(h.step(.02).y<14);
});
test('taking control cancels the descent immediately and reset remains usable',async()=>{
  const h=await cameraHarness();h.show(true);h.step(1);h.drag();const at=h.step(.02),later=h.step(5);assert(at.distanceTo(later)<.001);
  h.reset();assert(h.step(2).y<14);
});
test('reduced motion opens directly on the row',async()=>{
  const h=await cameraHarness(true);h.show(true);const a=h.step(.02);assert(a.y<14);assert(a.distanceTo(h.step(5))<.001);
});
test('startup preserves a new chapter deep link while waiting for live registrations',async()=>{
  const h=await cameraHarness(false,'#chapter=chapter-new');h.show(true);h.step(4);
  assert.deepEqual(h.selections,[],'fallback selection must not overwrite the requested live chapter');
});

test('captions follow the tour, clear at 13.6 seconds, and replay on request',async()=>{
  const h=await cameraHarness();h.show(true);h.step(.02);
  assert.equal(h.element('village-intro').hidden,false);
  assert.equal(h.element('intro-title').textContent,'GREEK WARS.');
  h.step(2.8);assert.equal(h.element('intro-title').textContent,"IF YOU'RE IN A FRAT.");
  h.step(3.25);assert.equal(h.element('intro-title').textContent,'$500 ONCE ONBOARDED');
  h.step(4.25);assert.equal(h.element('intro-title').textContent,'YOUR CHAPTER. NEXT.');
  h.step(3.4);assert.equal(h.element('village-intro').hidden,true);
  h.fire('document:village:replay');h.step(.02);
  assert.equal(h.element('village-intro').hidden,false);
  assert.equal(h.element('intro-title').textContent,'GREEK WARS.');
});
test('slow rendering does not stretch the intro beyond 13.6 visible seconds',async()=>{
  const h=await cameraHarness();h.show(true);h.step(.1,10);h.step(INTRO_DURATION,10);
  assert.equal(h.element('village-intro').hidden,true);
});
test('leaving the viewport pauses the intro clock',async()=>{
  const h=await cameraHarness();h.show(true);h.step(1);h.show(false);h.step(10);
  assert.equal(h.element('village-intro').hidden,false);
  h.show(true);h.step(4);assert.equal(h.element('intro-title').textContent,"IF YOU'RE IN A FRAT.");
  h.step(14);assert.equal(h.element('village-intro').hidden,true);
});
test('skip and direct camera interaction both clear the captions',async()=>{
  for(const action of ['skip','drag']){
    const h=await cameraHarness();h.show(true);h.step(1);
    if(action==='skip')h.fire('intro-skip:click');else h.drag();
    assert.equal(h.element('village-intro').hidden,true);
    if(action==='skip')assert(h.step(2).y<14);
  }
});
test('reduced motion keeps the camera still while explaining the game',async()=>{
  const h=await cameraHarness(true);h.show(true);const start=h.step(.02);
  assert.equal(h.element('village-intro').hidden,false);
  assert(start.distanceTo(h.step(INTRO_DURATION+.1))<.001);
  assert.equal(h.element('village-intro').hidden,true);
});

test('pause freezes the tour and captions, resume continues, and replay clears pause',async()=>{
  const h=await cameraHarness();h.show(true);h.step(2);h.fire('intro-pause:click');
  const at=h.step(.02);assert(at.distanceTo(h.step(20))<.001);
  assert.equal(h.element('intro-title').textContent,'GREEK WARS.');
  assert.equal(h.element('intro-pause').textContent,'Resume intro');
  h.fire('intro-pause:click');h.step(3);
  assert.equal(h.element('intro-title').textContent,"IF YOU'RE IN A FRAT.");
  h.fire('intro-pause:click');h.fire('document:village:replay');h.step(5);
  assert.equal(h.element('intro-pause').textContent,'Pause intro');
  assert.equal(h.element('intro-title').textContent,"IF YOU'RE IN A FRAT.");
});
test('the join link appears only on the closing invitation',async()=>{
  const h=await cameraHarness();h.show(true);h.step(1);assert.equal(h.element('intro-join').hidden,true);
  h.step(12);assert.equal(h.element('intro-join').hidden,false);
  h.fire('document:village:replay');h.step(.02);assert.equal(h.element('intro-join').hidden,true);
});
function position(view){return new THREE.Vector3(view.target[0]+Math.sin(view.theta)*Math.cos(view.phi)*view.radius,view.target[1]+Math.sin(view.phi)*view.radius,view.target[2]+Math.cos(view.theta)*Math.cos(view.phi)*view.radius);}
const viewKey=code=>({code,preventDefault(){}});
async function flightHarness(){const h=await cameraHarness(true);h.show(true);h.step(.1);h.fire('intro-skip:click');h.step(.1);return h;}
test('normal-mode flight works without a canvas click and after using view controls',async()=>{
  const h=await cameraHarness(true);h.show(true);const start=h.step(.1);
  h.fire('document:keydown',viewKey('KeyW'));const moved=h.step(1);
  assert(moved.distanceTo(start)>10);assert.equal(h.element('village-intro').hidden,true);
  h.fire('window:keyup',viewKey('KeyW'));
  h.element('village-overview').focus();h.reset();const reset=h.step(.1);
  h.fire('document:keydown',{...viewKey('KeyD'),target:h.element('village-overview')});
  assert(h.step(1).distanceTo(reset)>10);h.fire('window:keyup',viewKey('KeyD'));
  const beforeZoom=h.step(.1);h.element('village-zoom-out').focus();
  h.fire('document:keydown',{...viewKey('Minus'),target:h.element('village-zoom-out')});
  assert(h.step(.1).y>beforeZoom.y);
});
test('normal-mode page shortcuts ignore typing, dialogs, street mode and already-handled events',async()=>{
  const h=await flightHarness(),start=h.step(.1);
  for(const event of [
    {...viewKey('KeyW'),target:{closest:()=>({})}},
    {...viewKey('KeyW'),defaultPrevented:true},
    {...viewKey('KeyW'),metaKey:true},
    {...viewKey('KeyW'),target:h.element('canvas')},
  ])h.fire('document:keydown',{...event,preventDefault(){assert.fail('shortcut was consumed');}});
  h.element('about-dialog').open=true;h.fire('document:keydown',viewKey('KeyW'));h.element('about-dialog').open=false;
  assert(h.step(1).distanceTo(start)<1e-9);
  h.fire('village-street:click');const street=h.step(.1);h.fire('document:keydown',viewKey('KeyW'));
  assert(h.step(1).distanceTo(street)<1e-9);
});
test('scrolling the normal village zooms even when a toolbar button has focus',async()=>{
  const h=await flightHarness(),start=h.step(.1);h.element('village-overview').focus();
  h.fire('canvas:wheel',{deltaY:-180,preventDefault(){}});assert(h.step(.1).y<start.y);
});
test('WASD translates the viewpoint in camera-relative directions without changing its angle or height',async()=>{
  for(const code of ['KeyW','KeyA','KeyS','KeyD']){
    const h=await flightHarness(),start=h.step(.1),rotation=h.camera().quaternion.clone();
    const forward=h.camera().getWorldDirection(new THREE.Vector3());forward.y=0;forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));
    const direction=(code==='KeyW'||code==='KeyS'?forward:right).multiplyScalar(code==='KeyS'||code==='KeyA'?-1:1);
    h.fire('canvas:keydown',viewKey(code));const moved=h.step(1).sub(start);
    assert(moved.length()>10);assert(moved.clone().normalize().distanceTo(direction)<1e-9);
    assert(Math.abs(moved.y)<1e-9);assert(h.camera().quaternion.angleTo(rotation)<1e-7);
    h.fire('window:keyup',viewKey(code));const stopped=h.step(.1);assert(stopped.distanceTo(h.step(1))<1e-9);
  }
});
test('flight has normalized diagonals, cancelling opposite keys and consistent frame-rate speed',async()=>{
  async function travel(codes,fps=60){const h=await flightHarness(),start=h.step(.1);for(const code of codes)h.fire('canvas:keydown',viewKey(code));return h.step(1,fps).distanceTo(start);}
  const straight=await travel(['KeyW']);assert(Math.abs(await travel(['KeyW','KeyD'])-straight)<1e-8);
  assert.equal(await travel(['KeyW','KeyS']),0);
  assert(Math.abs(await travel(['KeyW'],30)-straight)/straight<.04);
});
test('flight interrupts the intro, and blur, hidden views and reset clear held movement',async()=>{
  const intro=await cameraHarness();intro.show(true);intro.step(1);intro.fire('canvas:keydown',viewKey('KeyW'));
  assert.equal(intro.element('village-intro').hidden,true);
  for(const stop of [h=>h.fire('canvas:blur'),h=>h.fire('window:blur'),h=>{h.show(false);h.step(.2);h.show(true);}]){
    const h=await flightHarness();h.fire('canvas:keydown',viewKey('KeyW'));h.step(.5);stop(h);
    const at=h.step(.1);assert(at.distanceTo(h.step(1))<1e-9);
  }
  const h=await flightHarness(),start=h.step(.1);h.fire('canvas:keydown',viewKey('KeyD'));h.step(1);h.reset();
  assert(start.distanceTo(h.step(1))<1e-9);
});
test('zoom stays centered on the translated anchor and supports keys, wheel and buttons',async()=>{
  const h=await flightHarness();h.fire('canvas:keydown',viewKey('KeyW'));h.step(1);h.fire('window:keyup',viewKey('KeyW'));
  const radius=openingView.radius,anchor=h.camera().position.clone().addScaledVector(h.camera().getWorldDirection(new THREE.Vector3()),radius);
  h.fire('canvas:keydown',viewKey('Equal'));let at=h.step(.1);assert(Math.abs(at.distanceTo(anchor)-radius*.8)<1e-8);
  h.fire('village-zoom-out:click');at=h.step(.1);assert(Math.abs(at.distanceTo(anchor)-radius)<1e-8);
  h.element('canvas').focus();
  h.fire('canvas:wheel',{deltaY:Math.log(.8)/.001,preventDefault(){}});at=h.step(.1);assert(Math.abs(at.distanceTo(anchor)-radius*.8)<1e-8);
  h.fire('village-zoom-out:click');h.step(.1);
  h.fire('canvas:keydown',viewKey('Minus'));at=h.step(.1);assert(Math.abs(at.distanceTo(anchor)-radius*1.25)<1e-8);
  const direction=h.camera().getWorldDirection(new THREE.Vector3());assert(direction.distanceTo(anchor.clone().sub(at).normalize())<1e-9);
});
test('unrelated keys and browser shortcuts leave the intro running',async()=>{
  const h=await cameraHarness();h.show(true);h.step(1);
  for(const event of [viewKey('Tab'),{...viewKey('KeyW'),metaKey:true},{...viewKey('Equal'),ctrlKey:true}]){
    h.fire('canvas:keydown',{...event,preventDefault(){assert.fail('shortcut was consumed');}});
    assert.equal(h.element('village-intro').hidden,false);
  }
});
test('flight, bank and lens remain continuous at every shot boundary',async()=>{
  for(const t of [0,2.72,5.44,8.075,10.625,13.6]){
    const before=introViewAt(t-.001),after=introViewAt(t+.001);
    assert(position(before).distanceTo(position(after))<.25);
    for(const key of ['phi','radius','fov','roll','night'])assert(Math.abs(before[key]-after[key])<.2);
    assert(before.target.every((v,i)=>Math.abs(v-after.target[i])<.05));
    const caption=introCaptionAt(t);assert(caption.copyOpacity>=0&&caption.copyOpacity<=1);
  }
  const end=introViewAt(INTRO_DURATION);
  assert(position(end).distanceTo(position(openingView))<1e-9);
  assert.equal(end.fov,48);assert(Math.abs(end.roll)<1e-9);assert.equal(end.night,0);
});
test('the low flight stays on the boulevard, the orbit clears roofs, and captions leave breathing room',async()=>{
  for(let t=0;t<=INTRO_DURATION;t+=.02){
    const view=introViewAt(t),p=position(view);
    assert(p.y>=6);assert(view.fov>=48&&view.fov<=78);assert(Math.abs(view.roll)<=.21);
    if(t>=2.72&&t<=5.44)assert(Math.abs(p.x)<2);
    if(Math.abs(p.x)>10&&Math.abs(p.z)<32)assert(p.y>22,'outside the street corridor the camera must clear houses');
  }
  assert.equal(introCaptionAt(2.6).copyOpacity,0);
  assert.equal(introCaptionAt(5.6).copyOpacity,0);
  assert.equal(introCaptionAt(9.6).copyOpacity,0);
  assert.equal(introViewAt(9).night,1);
});

test('skipping a night flyby restores daylight and the ordinary camera lens',async()=>{
  const h=await cameraHarness();h.show(true);h.step(9);
  assert.equal(h.lighting.at(-1),true);assert(h.lens()>48);
  h.fire('intro-skip:click');h.step(.02);
  assert.equal(h.lighting.at(-1),false);assert.equal(h.lens(),48);
});
test('reduced motion never banks, changes the lens or runs the lighting transition',async()=>{
  const h=await cameraHarness(true);h.show(true);const start=h.step(.02);h.step(9);
  assert.equal(h.lens(),48);assert.equal(h.lighting.length,0);
  assert(start.distanceTo(h.step(8))<.001);
});

test('camera carries nonzero speed through waypoints with matching velocity and acceleration',async()=>{
  const h=.001;
  for(const t of [2.72,5.44,8.075,10.625]){
    const a=position(introViewAt(t-2*h)),b=position(introViewAt(t-h)),c=position(introViewAt(t)),d=position(introViewAt(t+h)),e=position(introViewAt(t+2*h));
    const incoming=c.clone().sub(b).divideScalar(h),outgoing=d.clone().sub(c).divideScalar(h);
    assert(incoming.length()>10,'waypoint must not stop the flight');
    assert(incoming.distanceTo(outgoing)<.02,'velocity must carry through the join');
    const accIn=c.clone().add(a).addScaledVector(b,-2).divideScalar(h*h),accOut=e.clone().add(c).addScaledVector(d,-2).divideScalar(h*h);
    assert(accIn.distanceTo(accOut)<.8,'acceleration must not jump at the join');
  }
});

test('the intro waits for GPU warmup and starts its clock only when ready',async()=>{
  const h=await cameraHarness(false,'',true);h.show(true);
  assert.equal(h.step(20),undefined,'no playback frames may render during warmup');
  assert.equal(h.element('village-loading').hidden,false);
  h.finishWarmup();assert.equal(h.element('village-loading').hidden,true);
  assert(h.step(.02).y>75);
  assert.equal(h.element('intro-title').textContent,'GREEK WARS.');
  h.step(9);assert.equal(h.lighting.at(-1),true);
  h.step(5);assert.equal(h.element('village-intro').hidden,true);
});


test('live rosters arriving during compilation are coalesced and warmed before playback',async()=>{
  const h=await cameraHarness(false,'',true);h.show(true);
  h.fire('document:chapters:update',{detail:{chapters:[{id:'old',joined:0}]}});
  const chapters=[{id:'latest',joined:0}];
  h.fire('document:chapters:update',{detail:{chapters}});
  assert.equal(h.builds.length,1,'the compiling world must remain intact');
  h.finishWarmup();
  assert.equal(h.builds.length,2);assert.equal(h.builds[1],chapters);
  assert.equal(h.element('village-loading').hidden,false,'new materials must warm before playback');
  assert.equal(h.step(1),undefined);
  h.finishWarmup();assert.equal(h.element('village-loading').hidden,true);
  assert(h.step(.02).y>75);
});

test('street navigation moves at eye level, turns around, honors ends and exits to overview',async()=>{
  const h=await cameraHarness();h.show(true);h.step(1);h.fire('village-street:click');
  const start=h.step(4);assert(Math.abs(start.y-2.6)<.01);assert(Math.abs(start.x)<.01);
  assert.equal(h.element('street-controls').hidden,false);
  h.fire('street-forward:click');const forward=h.step(3);assert(forward.z<start.z);assert(Math.abs(forward.y-2.6)<.01);
  for(let i=0;i<24;i++)h.fire('canvas:keydown',{code:'ArrowRight',preventDefault(){}});h.step(2);h.fire('street-forward:click');const back=h.step(3);assert(back.z>forward.z);
  for(let i=0;i<10;i++)h.fire('street-forward:click');assert(h.step(3).z<=28.51);assert.equal(h.element('street-forward').disabled,true);
  h.fire('street-exit:click');assert.equal(h.element('street-controls').hidden,true);assert(h.step(3).y>3);
});
test('street view remains usable with reduced motion and keyboard navigation',async()=>{
  const h=await cameraHarness(true);h.show(true);h.step(.02);h.fire('village-street:click');const at=h.step(.02);assert(Math.abs(at.y-2.6)<1e-9);
  h.fire('canvas:keydown',{code:'ArrowUp',preventDefault(){}});const next=h.step(.02);assert.equal(at.z-next.z,9.5);
  h.fire('canvas:keydown',{code:'KeyS',preventDefault(){}});assert(Math.abs(h.step(.02).z-at.z)<1e-9);
  h.fire('canvas:keydown',{code:'KeyW',preventDefault(){}});assert(Math.abs(h.step(.02).z-next.z)<1e-9);
  h.fire('canvas:keydown',{code:'Escape',preventDefault(){}});assert.equal(h.element('street-controls').hidden,true);
});

test('clicking the unmarked road moves the camera to that street stop',async()=>{
  const h=await cameraHarness(true);h.show(true);h.step(.02);h.fire('village-street:click');const start=h.step(.02);
  const z=streetStep(start.z,-1),point=new THREE.Vector3(0,.25,z).project(h.camera());
  assert(point.x>=-1&&point.x<=1&&point.y>=-1&&point.y<=1,'the road destination is in view');
  const pointer={button:0,pointerId:1,clientX:(point.x+1)*600,clientY:(1-point.y)*325};
  h.fire('canvas:pointerdown',pointer);h.fire('canvas:pointerup',pointer);
  const arrived=h.step(.02);assert(Math.abs(arrived.z-z)<1e-9);assert(Math.abs(arrived.y-2.6)<1e-9);
});

test('a tap that ends on a control leaves the village behind it alone',async()=>{
  const h=await cameraHarness(true);h.show(true);h.step(.02);h.fire('village-street:click');const start=h.step(.02);
  const z=streetStep(start.z,-1),point=new THREE.Vector3(0,.25,z).project(h.camera());
  const pointer={button:0,pointerId:1,clientX:(point.x+1)*600,clientY:(1-point.y)*325};
  h.coverCanvas('village-more');
  h.fire('canvas:pointerdown',pointer);h.fire('canvas:pointerup',pointer);
  const stayed=h.step(.02);assert(Math.abs(stayed.z-start.z)<1e-9,'the More button keeps its own tap');
  h.coverCanvas(null);
  h.fire('canvas:pointerdown',pointer);h.fire('canvas:pointerup',pointer);
  assert(Math.abs(h.step(.02).z-z)<1e-9,'the same tap on open village still travels');
});

test('a lost graphics context shows recovery text and restoration resumes rendering',async()=>{
  const h=await cameraHarness();h.show(true);h.step(.02);let prevented=false;
  h.fire('canvas:webglcontextlost',{preventDefault(){prevented=true;}});
  assert(prevented);assert.equal(h.element('village-loading').hidden,false);
  assert.match(h.element('village-loading').textContent,/Restoring/);
  h.fire('canvas:webglcontextrestored');
  assert.equal(h.element('village-loading').hidden,true);assert(h.step(.02));
});


test('mobile street view stays wide while moving and looking, and restores the overview lens on exit',async()=>{
  const h=await cameraHarness(true,'',false,true);h.show(true);h.step(.02);
  assert.equal(h.lens(),48);h.fire('village-street:click');h.step(.02);assert.equal(h.lens(),82);
  h.drag();h.step(.02);assert.equal(h.lens(),82);
  h.fire('street-forward:click');h.step(.02);assert.equal(h.lens(),82);
  h.fire('canvas:keydown',{code:'KeyS',preventDefault(){}});h.step(.02);assert.equal(h.lens(),82);
  h.fire('street-exit:click');h.step(.02);assert.equal(h.lens(),48);
  const desktop=await cameraHarness(true);desktop.show(true);desktop.step(.02);desktop.fire('village-street:click');desktop.step(.02);assert.equal(desktop.lens(),48);
});


test('pinch and zoom buttons zoom within mobile street view and a pinch never steps down the road',async()=>{
  const h=await cameraHarness(true,'',false,true);h.show(true);h.step(.02);h.fire('village-street:click');const start=h.step(.02);
  const touch=(id,x)=>({pointerType:'touch',pointerId:id,button:0,clientX:x,clientY:300});
  h.fire('canvas:pointerdown',touch(1,100));h.fire('canvas:pointerdown',touch(2,200));
  h.fire('canvas:pointermove',touch(2,300));h.step(.02);assert(h.lens()<82);
  h.fire('canvas:pointermove',touch(2,150));h.step(.02);assert(h.lens()>82);
  h.fire('canvas:pointerup',touch(2,150));h.fire('canvas:pointerup',touch(1,100));assert(h.step(.02).distanceTo(start)<.001);
  h.fire('village-zoom-in:click');h.step(.02);const zoomed=h.lens();assert(zoomed<100);assert.equal(h.element('street-controls').hidden,false);
  h.fire('street-forward:click');h.step(.02);assert.equal(h.lens(),zoomed);
  h.fire('village-zoom-out:click');h.step(.02);assert(h.lens()>zoomed);
  h.fire('street-exit:click');h.step(.02);assert.equal(h.lens(),48);
});
test('pinching the overview changes zoom and cancellation releases the gesture',async()=>{
  const h=await cameraHarness(true,'',false,true);h.show(true);h.step(.02);h.drag();const start=h.step(.02);
  const touch=(id,x)=>({pointerType:'touch',pointerId:id,button:0,clientX:x,clientY:300});
  h.fire('canvas:pointerdown',touch(1,100));h.fire('canvas:pointerdown',touch(2,200));h.fire('canvas:pointermove',touch(2,300));
  const zoomed=h.step(.02);assert(zoomed.y<start.y);
  h.fire('canvas:pointercancel',touch(2,300));h.fire('canvas:pointerup',touch(1,100));
  h.fire('village-zoom-out:click');assert(h.step(.02).y>zoomed.y);
});

test('a phone frames the house above the chapter sheet',async()=>{
  // The phone sheet covers the screen from 380px of 812 downward; the house belongs above it.
  const sheetTop=1-2*380/812,lot=new THREE.Vector3(-20,0,-19),roofline=new THREE.Vector3(-20,15,-19);
  const h=await cameraHarness(false,'',false,true,{width:375,height:812});h.show(true);h.step(.02);
  h.fire('document:chapter:select',{detail:{id:'sigma-chi-sdsu',focus:true}});h.step(4);
  const roof=roofline.clone().project(h.camera()),lawn=lot.clone().project(h.camera());
  assert(roof.y<1,`the tallest roofline sits off screen at ${roof.y}`);
  assert(lawn.y>sheetTop,`the lawn sinks behind the sheet at ${lawn.y}`);
  // The desktop drawer sits beside the village, so that framing stays close in.
  const desktop=await cameraHarness();desktop.show(true);desktop.step(.02);
  desktop.fire('document:chapter:select',{detail:{id:'sigma-chi-sdsu',focus:true}});desktop.step(4);
  assert(roofline.clone().project(desktop.camera()).y>roof.y,'the phone should stand back further than the desktop');
  assert(desktop.camera().position.distanceTo(lot)<h.camera().position.distanceTo(lot));
});


test('the blimp flies continuously and freezes with activity, reduced motion and hidden tabs',async()=>{
  const h=await cameraHarness();h.show(true);h.step(20);h.drag();h.fire('canvas:pointerup',{pointerId:1,clientX:0,clientY:0});
  const start=h.blimp().root.position.clone();h.step(2);assert(h.blimp().root.position.distanceTo(start)>1);
  h.fire('document:party:pause',{detail:{paused:true}});h.step(.1);const paused=h.blimp().root.position.clone();h.step(3);assert(h.blimp().root.position.equals(paused));
  h.fire('document:party:pause',{detail:{paused:false}});h.step(2);assert(h.blimp().root.position.distanceTo(paused)>1);
  h.show(false);const hidden=h.blimp().root.position.clone();h.step(5);assert(h.blimp().root.position.equals(hidden));
  const reduced=await cameraHarness(true);reduced.show(true);const still=reduced.blimp().root.position.clone();reduced.step(20);assert(reduced.blimp().root.position.equals(still));
});

test('clicking or tapping the blimp opens Discord; dragging, pinching and covered taps do not',async()=>{
  const h=await cameraHarness(true);h.show(true);h.step(.02);h.fire('intro-skip:click');h.step(.02);
  const point=h.blimp().root.position.clone().project(h.camera());assert(Math.abs(point.x)<1&&Math.abs(point.y)<1);
  const pointer={button:0,pointerId:1,clientX:(point.x+1)*600,clientY:(1-point.y)*325};
  const link=h.element('village-discord');assert.equal(link.href,DISCORD_INVITE);
  h.fire('canvas:pointerdown',pointer);h.fire('canvas:pointerup',pointer);assert.equal(link.clicks,1);
  const touch={...pointer,pointerType:'touch'};h.fire('canvas:pointerdown',touch);h.fire('canvas:pointerup',touch);assert.equal(link.clicks,2);
  h.fire('canvas:pointerdown',pointer);h.fire('canvas:pointermove',{...pointer,clientX:pointer.clientX+20});h.fire('canvas:pointerup',pointer);assert.equal(link.clicks,2);
  h.coverCanvas('village-more');h.fire('canvas:pointerdown',pointer);h.fire('canvas:pointerup',pointer);assert.equal(link.clicks,2);h.coverCanvas(null);
  h.fire('canvas:pointerdown',touch);const second={...touch,pointerId:2,clientX:touch.clientX+20};h.fire('canvas:pointerdown',second);h.fire('canvas:pointerup',second);h.fire('canvas:pointerup',touch);assert.equal(link.clicks,2);
});

test('paused activity keeps loading a selected distant house until its scene is ready',async()=>{
  const h=await cameraHarness();h.show(true);h.step(20);h.fire('document:party:pause',{detail:{paused:true}});h.step(1);
  const village=h.village();let steps=0,finish;
  village.focus=(_id,ready)=>{village.building=true;finish=ready;};
  village.updateView=()=>{if(village.building&&++steps===3){village.building=false;finish();}return false;};
  h.fire('document:chapter:select',{detail:{id:'sigma-chi-sdsu',focus:true}});h.step(1);
  assert.equal(steps,3);assert.equal(village.building,false);
});

test('street wheel zooms without moving and A/D turn at eye level',async()=>{
  const h=await flightHarness();h.fire('village-street:click');const start=h.step(.1),lens=h.lens();
  h.fire('canvas:wheel',{deltaY:-180,preventDefault(){}});assert(start.distanceTo(h.step(.1))<1e-9);assert(h.lens()<lens);
  const facing=h.camera().quaternion.clone();h.fire('canvas:keydown',viewKey('KeyA'));h.step(.1);assert(h.camera().quaternion.angleTo(facing)>.1);
  h.fire('canvas:keydown',viewKey('KeyD'));h.step(.1);assert(h.camera().quaternion.angleTo(facing)<1e-7);
});

test('phones cap animation work at 30 fps on high-refresh displays',async()=>{
  const h=await cameraHarness(false,'',false,true);h.show(true);h.step(20,120);
  const before=h.renders();h.step(1,120);const count=h.renders()-before;
  assert(count>=28&&count<=31,`expected about 30 rendered frames, received ${count}`);
});
test('phone overlays stop background rendering and closing them resumes activity',async()=>{
  const h=await cameraHarness(false,'',false,true);h.show(true);h.step(20);
  h.fire('document:village:overlay',{detail:{open:true}});h.step(2);
  const before=h.renders();h.step(2);assert.equal(h.renders(),before);
  h.fire('document:village:overlay',{detail:{open:false}});h.step(1);assert(h.renders()>before);
});
test('pausing the intro stops rendering until resumed',async()=>{
  const h=await cameraHarness();h.show(true);h.step(1);h.fire('intro-pause:click');h.step(1);
  const before=h.renders();h.step(3);assert.equal(h.renders(),before);
  h.fire('intro-pause:click');h.step(1);assert(h.renders()>before);
});

test('lifting one finger after a pinch preserves the remaining drag without selecting a house',async()=>{
  const h=await cameraHarness(true,'',false,true);h.show(true);h.step(.1);h.fire('intro-skip:click');
  const touch=(id,x)=>({pointerType:'touch',pointerId:id,button:0,clientX:x,clientY:300});
  h.fire('canvas:pointerdown',touch(1,100));h.fire('canvas:pointerdown',touch(2,200));
  h.fire('canvas:pointermove',touch(2,260));h.step(.1);
  h.fire('canvas:pointerup',touch(2,260));h.fire('canvas:lostpointercapture',touch(2,260));
  const before=h.camera().quaternion.clone(),selected=h.selections.length;
  h.fire('canvas:pointermove',touch(1,160));h.step(.1);
  assert(h.camera().quaternion.angleTo(before)>.1,'the remaining finger must still turn the camera');
  h.fire('canvas:pointerup',touch(1,160));assert.equal(h.selections.length,selected);
});
