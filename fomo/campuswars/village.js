import {createLiveArrivals} from './village-arrivals.js?v=106';
import {createPedestrianSpacing} from './village-pedestrian-spacing.js?v=103';
import {createFramePacer} from './village-frame-pacing.js?v=92';
import {villageQuality} from './village-quality.js?v=97';
import {createStreetNavigation,streetStops,streetStep} from './village-street-navigation.js?v=53';
import * as THREE from './vendor/three.module.min.js';
import {createVillageRendererAsync} from './village-renderer.js?v=106';
import {createDistricts} from './village-districts.js?v=105';
import {clampCampusTarget} from './village-campus-bounds.js?v=1';
import {INTRO_DURATION,openingView,introViewAt,introCaptionAt} from './village-intro.js?v=70';
import {createMoneyRain} from './village-money-rain.js?v=105';
import {prewarmVillage} from './village-prewarm.js?v=105';
import {createFomoBlimp,DISCORD_INVITE} from './village-blimp.js?v=75';
import {createPointerHover,releasedMouseDrag} from './village-pointer-hover.js?v=87';

const shell=document.getElementById('village');
const viewport=document.getElementById('village-viewport');
const loading=document.getElementById('village-loading');
let chapters=JSON.parse(document.getElementById('chapters-data').textContent).chapters;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_ZOOM_RADIUS=320;

const quality=villageQuality();
const STREET_FOV=quality.mobile?82:48;
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:quality.antialias,alpha:false,powerPreference:'high-performance'});}catch(error){
  loading.textContent='This device can’t open the 3D village. Open Chapters to see progress, or join Greek Wars.';
  shell.classList.add('village-unavailable');
}
if(renderer)startVillage().catch(error=>{console.error('Unable to start Greek village:',error);loading.textContent='The village couldn’t load. Open Chapters to browse progress or join Greek Wars.';shell.classList.add('village-unavailable');});
async function startVillage(){
  const pedestrianSpacing=createPedestrianSpacing(),arrivals=createLiveArrivals();
  let ready=false,pendingChapterUpdate=null;
  const queueChapterUpdate=event=>{arrivals.enqueue(event.detail.arrivals);pendingChapterUpdate=event;};
  document.addEventListener('chapters:update',queueChapterUpdate);
  const flightKeys=new Set();
  let renderScale=Math.min(devicePixelRatio,quality.pixelRatio);
  renderer.setPixelRatio(renderScale);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  viewport.prepend(renderer.domElement);const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','3D Greek village. Use W A S D to fly the viewpoint forward, left, backward and right. Drag or use arrow keys to rotate, shift-drag to pan, or select a house. Scroll, pinch, or use plus and minus to zoom around the viewpoint. Click the FOMO blimp to join Discord, or use the Discord link in the village controls. Use Street view to click along the block. In Street view, W and S or up and down move, A and D or left and right look around. Escape resets the view.');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x98a7ba);scene.fog=new THREE.FogExp2(0x98a7ba,.0022);
  const camera=new THREE.PerspectiveCamera(48,1,1,650);
  const ambient=new THREE.HemisphereLight(0xd4e2ed,0x857768,1.55);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffe5c6,2.6);sun.position.set(-35,55,30);sun.castShadow=true;sun.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);sun.shadow.radius=1.4;Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:150});sun.shadow.normalBias=.05;sun.shadow.bias=-.00015;scene.add(sun);scene.add(sun.target);
  const fill=new THREE.DirectionalLight(0xc4d2e0,.5);fill.position.set(30,15,-25);scene.add(fill);
  let village=await createVillageRendererAsync(THREE,chapters,{aspect:viewport.clientWidth/viewport.clientHeight,attachStreet:true,arrivals});scene.add(village.world);
  const blimp=createFomoBlimp(THREE);scene.add(blimp.root);
  const pointerHover=createPointerHover(THREE,canvas,camera,blimp);
  const discordLink=document.getElementById('village-discord');discordLink.href=DISCORD_INVITE;
  const moneyRain=createMoneyRain(THREE,chapters,village.renderAnchors||village.anchors);scene.add(moneyRain.root);
  let streetNav=createStreetNavigation(THREE,village.extension);scene.add(streetNav.root);
  let streetMode=false,streetZ=28.5,streetWantedZ=28.5;
  const streetButton=document.getElementById('village-street'),streetControls=document.getElementById('street-controls');
  let districts=createDistricts(THREE,village.extension,village.streetTotal,{incremental:quality.mobile});scene.add(districts.root);
  const dusk={sky:new THREE.Color(0x25233f),ambient:new THREE.Color(0x9a9fdc),ground:new THREE.Color(0x453649),sun:new THREE.Color(0xc49ab1),fill:new THREE.Color(0x858dff)};
  let litAtNight=false;
  function applyLighting(amount){
    scene.background.set(0x98a7ba).lerp(dusk.sky,amount);scene.fog.color.copy(scene.background);scene.fog.density=.0022+amount*.001;
    // Lift dusk's indirect light so brickwork and people retain detail at
    // street level, using the existing lights and the same daylight exposure.
    ambient.color.set(0xd4e2ed).lerp(dusk.ambient,amount);ambient.groundColor.set(0x857768).lerp(dusk.ground,amount);ambient.intensity=1.55-amount*.72;
    sun.color.set(0xffe5c6).lerp(dusk.sun,amount);sun.intensity=2.6-amount*2.18;
    fill.color.set(0xc4d2e0).lerp(dusk.fill,amount);fill.intensity=.5-amount*.07;
    const night=amount>.45;
    if(night!==litAtNight){litAtNight=night;village.nightLife.setNight(night);districts.setNight(night);}
  }
  const intro=document.getElementById('village-intro');
  let autoOrbit=!reduced,entrancePending=true,entranceActive=false,entrancePaused=false,entranceTime=0,captionIndex=-1;
  function paintIntro(){
    const caption=introCaptionAt(entranceTime);
    if(captionIndex!==caption.index){
      captionIndex=caption.index;
      document.getElementById('intro-title').textContent=caption.title;
      document.getElementById('intro-description').textContent=caption.description;
      document.getElementById('intro-join').hidden=!caption.join;
    }
    intro.style.setProperty('--intro-opacity',caption.opacity);
    intro.style.setProperty('--copy-opacity',reduced||entrancePaused?1:caption.copyOpacity);
    intro.style.setProperty('--copy-lift',`${reduced||entrancePaused?0:caption.lift}px`);
    intro.style.setProperty('--copy-scale',reduced||entrancePaused?1:caption.scale);
  }
  let introRoll=0,introNight=0;
  function applyIntroView(){
    const view=reduced?openingView:introViewAt(entranceTime);
    target.set(...view.target);theta=view.theta;phi=view.phi;radius=view.radius;
    wantedTarget.copy(target);wantedTheta=theta;wantedPhi=phi;wantedRadius=radius;
    introRoll=view.roll||0;introNight=view.night||0;
    const fov=view.fov||48;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
    if(!reduced)applyLighting(view.night);
  }
  function finishIntro(){
    const wasPlaying=entranceActive;
    entrancePending=false;entranceActive=false;intro.hidden=true;shell.classList.remove('intro-playing');
    moneyRain.clear();introRoll=0;camera.fov=streetMode?camera.fov:48;camera.updateProjectionMatrix();
    applyLighting(document.getElementById('night-toggle').getAttribute('aria-pressed')==='true'?1:0);
    if(['intro-skip','intro-pause','intro-join'].some(id=>document.activeElement===document.getElementById(id)))canvas.focus({preventScroll:true});
    if(wasPlaying)document.dispatchEvent(new CustomEvent('village:introend'));
  }
  function beginIntro(){
    if(!ready)return;
    flightKeys.clear();
    if(village.streaming&&!village.residentIndices.has(0)){village.focus(village.anchors[0].id,beginIntro);wake();return;}
    leaveStreet();
    entrancePending=false;entranceActive=true;entrancePaused=false;entranceTime=0;captionIndex=-1;lastTime=0;
    document.getElementById('intro-pause').textContent='Pause intro';
    document.getElementById('intro-pause').setAttribute('aria-pressed','false');
    autoOrbit=!reduced;intro.hidden=false;shell.classList.add('intro-playing');
    document.dispatchEvent(new CustomEvent('village:introstart'));
    applyIntroView();paintIntro();wake();
  }
  function takeControl(){
    stadiumView=false;
    village.cancelFocus?.();
    autoOrbit=false;
    if(entranceActive){wantedTarget.copy(target);wantedRadius=radius;wantedPhi=phi;wantedTheta=theta;}
    finishIntro();
  }
  document.getElementById('intro-skip').addEventListener('click',()=>{finishIntro();resetView();wake();});
  document.getElementById('intro-pause').addEventListener('click',()=>{
    entrancePaused=!entrancePaused;lastTime=0;
    document.getElementById('intro-pause').textContent=entrancePaused?'Resume intro':'Pause intro';
    document.getElementById('intro-pause').setAttribute('aria-pressed',String(entrancePaused));wake();
  });
  document.addEventListener('village:replay',beginIntro);
  document.addEventListener('village:artwork',()=>{viewDirty=true;wake();});
  let selected='sigma-chi-sdsu',paused=reduced||document.getElementById('party-toggle').getAttribute('aria-pressed')==='true',visible=false,drag=null,dragDistance=0,raf=0,lastTime=0,partyTime=0,lastRender=0,viewDirty=true,shadowX=NaN,shadowZ=NaN,stadiumView=false;
  const target=new THREE.Vector3(...openingView.target),wantedTarget=new THREE.Vector3(...openingView.target),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let {theta,phi,radius}=openingView;let wantedTheta=theta,wantedPhi=phi,wantedRadius=radius;
  if(!reduced)applyIntroView();
  const nightToggle=document.getElementById('night-toggle');
  nightToggle.addEventListener('click',()=>{
    const night=nightToggle.getAttribute('aria-pressed')!=='true';
    nightToggle.setAttribute('aria-pressed',String(night));shell.classList.toggle('village-night',night);
    applyLighting(night?1:0);viewDirty=true;wake();
  });
  function snapLongJump(){if(target.distanceTo(wantedTarget)>180){target.copy(wantedTarget);radius=wantedRadius;phi=wantedPhi;theta=wantedTheta;}}
  function resetView(){flightKeys.clear();leaveStreet();const aim=()=>{wantedTarget.set(...openingView.target);wantedRadius=openingView.radius;wantedPhi=openingView.phi;wantedTheta=openingView.theta;snapLongJump();viewDirty=true;wake();};if(village.focus&&Math.abs(target.x)>180)village.focus(village.anchors[0].id,aim);else aim();wake();}
  function choose(id,focus=false,emit=true){
    const anchor=village.anchors.find(a=>a.id===id);if(!anchor)return;selected=id;viewDirty=true;
    // Frame the house from its own street's centre line, whichever street that is.
    // On phones the chapter sheet takes the bottom of the screen, so stand back and aim low: the whole house fits above it.
    if(focus){takeControl();leaveStreet();const aim=()=>{if(selected!==id)return;const ox=anchor.lot.originX||0,side=anchor.lot.x-ox,phone=viewport.clientWidth<650,far=Math.abs(target.x-anchor.lot.x)>180;wantedTarget.set(ox+side*.69,phone?-.5:2,anchor.lot.z);wantedRadius=phone?46:30;wantedPhi=.67;wantedTheta=side<0?1.08:-1.08;if(far){target.copy(wantedTarget);radius=wantedRadius;phi=wantedPhi;theta=wantedTheta;camera.position.set(target.x+Math.sin(theta)*Math.cos(phi)*radius,target.y+Math.sin(phi)*radius,target.z+Math.cos(theta)*Math.cos(phi)*radius);camera.lookAt(target);camera.updateMatrixWorld();}viewDirty=true;wake();};if(village.focus)village.focus(id,aim);else aim();}
    if(emit)document.dispatchEvent(new CustomEvent('village:select',{detail:{id,interactive:focus}}));wake();
  }
  document.addEventListener('chapter:select',e=>choose(e.detail.id,Boolean(e.detail.focus)));
  let chapterBuildRevision=0;
  async function updateChapters(event){
    const buildRevision=++chapterBuildRevision,previous=village;
    const next=await createVillageRendererAsync(THREE,event.detail.chapters,{streets:previous.streets,houseFinishes:previous.houseFinishes,camera,arrivals});
    if(buildRevision!==chapterBuildRevision){next.dispose();return;}
    chapters=event.detail.chapters;arrivals.start(chapters,partyTime,reduced);scene.remove(previous.world);scene.add(next.world);next.world.add(next.streets);village=next;previous.dispose();
    // A new street opens its own Greek block, so the campus around it restreams.
    if(previous.extension!==next.extension||previous.streetTotal!==next.streetTotal){scene.remove(districts.root);districts.dispose();districts=createDistricts(THREE,next.extension,next.streetTotal,{incremental:quality.mobile});scene.add(districts.root);}
    if(previous.extension!==next.extension){
      scene.remove(streetNav.root);streetNav.dispose();streetNav=createStreetNavigation(THREE,next.extension);scene.add(streetNav.root);streetNav.root.visible=streetMode;
      const stops=streetStops(next.extension);streetWantedZ=Math.max(stops[0],Math.min(stops.at(-1),streetWantedZ));
    }
    moneyRain.setChapters(chapters,village.renderAnchors||village.anchors);
    village.nightLife.setNight(litAtNight);
    districts.setNight(litAtNight);
    village.animateCrowd(partyTime);village.animateEffects(partyTime);
    const requested=event.detail.selectedId||selected;
    choose(village.anchors.some(a=>a.id===requested)?requested:chapters[0]?.id||'empty',false);
    renderer.shadowMap.needsUpdate=true;viewDirty=true;wake();
  }
  document.removeEventListener('chapters:update',queueChapterUpdate);
  document.addEventListener('chapters:update',event=>{
    arrivals.enqueue(event.detail.arrivals);
    // Do not dispose materials while their asynchronous compilation is pending.
    if(!ready){pendingChapterUpdate=event;return;}
    updateChapters(event).catch(showLoadingError);
  });
  document.addEventListener('party:pause',e=>{paused=e.detail.paused;wake();});
  document.getElementById('village-overview').addEventListener('click',()=>{takeControl();resetView();});
  const stadiumDistance=()=>136/Math.min(1,camera.aspect);
  document.getElementById('village-stadium').addEventListener('click',()=>{
    takeControl();leaveStreet();wantedTarget.copy(districts.stadium.root.position);wantedTarget.y=2;
    stadiumView=true;wantedTheta=-2.42;wantedPhi=.6;wantedRadius=stadiumDistance();snapLongJump();viewDirty=true;wake();
  });
  document.getElementById('village-leaderboard').addEventListener('click',()=>{
    takeControl();leaveStreet();const board=village.competition.board;
    wantedTarget.set(board.position.x,5,board.position.z);
    wantedTheta=board.rotation.y;wantedPhi=.08;
    wantedRadius=Math.max(16,7/(Math.tan(camera.fov*Math.PI/360)*camera.aspect));wake();
  });
  function leaveStreet(){
    if(!streetMode)return;
    streetMode=false;streetNav.root.visible=false;streetControls.hidden=true;streetButton.setAttribute('aria-pressed','false');streetButton.textContent='Street view';
    shell.classList.remove('street-view');canvas.style.cursor='';
    camera.fov=48;camera.updateProjectionMatrix();
    target.set(0,2,streetZ);wantedTarget.copy(target);radius=wantedRadius=30;phi=wantedPhi=.45;
  }
  function moveStreet(z){
    flightKeys.clear();
    takeControl();
    if(!streetMode){
      streetMode=true;streetNav.root.visible=true;streetControls.hidden=false;streetButton.setAttribute('aria-pressed','true');streetButton.textContent='Exit street view';shell.classList.add('street-view');
      camera.fov=STREET_FOV;camera.updateProjectionMatrix();
      streetZ=z;theta=wantedTheta=0;phi=wantedPhi=0;canvas.focus({preventScroll:true});
    }
    const stops=streetStops(village.extension);streetWantedZ=Math.max(stops[0],Math.min(stops.at(-1),z));viewDirty=true;wake();
  }
  function stepStreet(forward){moveStreet(streetStep(streetWantedZ,(Math.cos(wantedTheta)>=0?-1:1)*(forward?1:-1),village.extension));}
  streetButton.addEventListener('click',()=>{if(streetMode){resetView();return;}const stops=streetStops(village.extension);moveStreet(stops.reduce((a,b)=>Math.abs(b-target.z)<Math.abs(a-target.z)?b:a));});
  document.getElementById('street-forward').addEventListener('click',()=>stepStreet(true));
  document.getElementById('street-back').addEventListener('click',()=>stepStreet(false));
  document.getElementById('street-exit').addEventListener('click',()=>{resetView();streetButton.focus();});
  function zoomView(factor){
    takeControl();
    if(streetMode){camera.fov=Math.max(40,Math.min(100,2*Math.atan(Math.tan(camera.fov*Math.PI/360)*factor)*180/Math.PI));camera.updateProjectionMatrix();}
    else wantedRadius=Math.max(20,Math.min(MAX_ZOOM_RADIUS,wantedRadius*factor));
    viewDirty=true;wake();
  }
  document.getElementById('village-zoom-in').addEventListener('click',()=>zoomView(.8));
  document.getElementById('village-zoom-out').addEventListener('click',()=>zoomView(1.25));
  const touchPoints=new Map();let pinchDistance=0;
  const touchDistance=()=>{const [a,b]=[...touchPoints.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
  function endTouch(event){
    if(!touchPoints.delete(event.pointerId))return false;
    const wasPinching=pinchDistance>0;pinchDistance=touchPoints.size>1?touchDistance():0;
    if(wasPinching){
      const remaining=touchPoints.size===1?[...touchPoints.entries()][0]:null;
      drag=remaining?{id:remaining[0],...remaining[1],pan:false,blimp:false}:null;
      dragDistance=9;
    }
    if(wasPinching&&canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    return wasPinching;
  }
  const expand=document.getElementById('village-expand');expand.hidden=!shell.requestFullscreen;
  expand.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await shell.requestFullscreen();}catch{expand.disabled=true;expand.title='Full screen is unavailable in this browser.';}});
  document.addEventListener('fullscreenchange',()=>{expand.textContent=document.fullscreenElement?'Exit full screen ↙':'Full screen ↗';resize();});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;
    pointerHover.clear();
    if(e.pointerType==='touch'){touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(touchPoints.size>1){takeControl();pinchDistance=touchDistance();drag=null;dragDistance=9;return;}}
    takeControl();canvas.focus({preventScroll:true});rayAt(e);
    const hit=raycaster.intersectObjects([...blimp.pickables,...village.pickables],false)[0];
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.shiftKey,blimp:hit?.object.userData.action==='discord'};dragDistance=0;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{
    if(drag&&releasedMouseDrag(e)){drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
    if(touchPoints.has(e.pointerId)){touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size>1){const distance=touchDistance();if(pinchDistance>0&&distance>0)zoomView(pinchDistance/distance);pinchDistance=distance;return;}}
    if(!drag){pointerHover.move(e);return;}
    if(e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;dragDistance+=Math.abs(dx)+Math.abs(dy);if(drag.pan&&!streetMode){const scale=radius*.0015;wantedTarget.x+=(-dx*Math.cos(theta)+dy*Math.sin(theta))*scale;wantedTarget.z+=(dx*Math.sin(theta)+dy*Math.cos(theta))*scale;}else{wantedTheta-=dx*.006;wantedPhi=Math.max(streetMode?-.65:.22,Math.min(streetMode?.65:1.3,wantedPhi+dy*.004));}drag.x=e.clientX;drag.y=e.clientY;wake();});
  function rayAt(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);}
  canvas.addEventListener('pointerup',e=>{
    if(endTouch(e))return;
    if(!drag||drag.id!==e.pointerId)return;const startedOnBlimp=drag.blimp;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(dragDistance>8)return;
    // The canvas keeps the pointer for the whole gesture, so a tap that started
    // beside a control and drifted onto it would still pick the house behind it.
    if(document.elementFromPoint(e.clientX,e.clientY)!==canvas)return;
    rayAt(e);
    // Remember a blimp press so its gentle motion cannot outrun a touch tap.
    if(startedOnBlimp){discordLink.click();return;}
    const hit=raycaster.intersectObjects([...blimp.pickables,...village.pickables],false)[0];
    if(hit?.object.userData.action==='discord'){discordLink.click();return;}
    if(streetMode){const step=raycaster.intersectObjects(streetNav.pickables.filter(o=>o.parent.visible),false)[0];if(step){moveStreet(step.object.userData.streetZ);return;}}
    if(hit){if(hit.object.userData.action==='register'){document.getElementById('panel-claim').click();return;}choose(hit.object.userData.chapter,!streetMode);return;}
  });
  canvas.addEventListener('pointerleave',()=>pointerHover.clear());
  canvas.addEventListener('pointercancel',e=>{endTouch(e);if(drag?.id===e.pointerId)drag=null;});canvas.addEventListener('lostpointercapture',e=>{endTouch(e);if(drag?.id===e.pointerId)drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoomView(Math.exp(e.deltaY*.001));},{passive:false});
  function handleViewKey(event){
    if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
    if(!['KeyW','KeyA','KeyS','KeyD','Equal','Minus','NumpadAdd','NumpadSubtract','Escape','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code))return;
    event.preventDefault();
    takeControl();
    if(event.code==='Escape'||event.code==='Home'){resetView();return;}
    if(['Equal','NumpadAdd','Minus','NumpadSubtract'].includes(event.code)){zoomView(['Equal','NumpadAdd'].includes(event.code)?.8:1.25);return;}
    if(['KeyW','KeyA','KeyS','KeyD'].includes(event.code)){
      if(streetMode){
        if(event.code==='KeyW'||event.code==='KeyS'){stepStreet(event.code==='KeyW');return;}
        wantedTheta+=event.code==='KeyA'?-.13:.13;
      }else flightKeys.add(event.code);
      wake();return;
    }
    if(streetMode&&(event.code==='ArrowUp'||event.code==='ArrowDown')){stepStreet(event.code==='ArrowUp');return;}
    if(event.code==='ArrowLeft')wantedTheta-=.13;
    if(event.code==='ArrowRight')wantedTheta+=.13;
    if(event.code==='ArrowUp')wantedPhi=Math.min(1.3,wantedPhi+.07);
    if(event.code==='ArrowDown')wantedPhi=Math.max(.22,wantedPhi-.07);
    wake();
  }
  canvas.addEventListener('keydown',handleViewKey);
  // The village fills the page: normal flight should also work before the canvas
  // has focus, and after pressing a view control such as Reset or Zoom.
  document.addEventListener('keydown',event=>{
    if(!ready||!visible||document.hidden||streetMode||event.defaultPrevented||event.target===canvas)return;
    if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
    if(!['KeyW','KeyA','KeyS','KeyD','Equal','Minus','NumpadAdd','NumpadSubtract'].includes(event.code))return;
    if(document.getElementById('about-dialog').open||event.target?.closest?.('input,textarea,select,[contenteditable],dialog,#village-drawer'))return;
    canvas.focus({preventScroll:true});handleViewKey(event);
  });
  addEventListener('keyup',event=>flightKeys.delete(event.code));
  for(const control of [streetControls,streetButton])control.addEventListener('keydown',event=>{if(streetMode)handleViewKey(event);});
  function releasePointer(){flightKeys.clear();pointerHover.clear();drag=null;touchPoints.clear();pinchDistance=0;}
  canvas.addEventListener('blur',releasePointer);addEventListener('blur',releasePointer);
  let viewportWidth=0,viewportHeight=0,resizeFrame=0;
  function resize(){
    if(resizeFrame)return;
    resizeFrame=requestAnimationFrame(()=>{
      resizeFrame=0;
      const w=viewport.clientWidth,h=viewport.clientHeight;
      if(!w||!h||(w===viewportWidth&&h===viewportHeight))return;
      viewportWidth=w;viewportHeight=h;viewDirty=true;
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
      if(stadiumView)wantedRadius=stadiumDistance();wake();
    });
  }
  new ResizeObserver(resize).observe(viewport);
  new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;lastTime=0;
    if(visible&&entrancePending)beginIntro();
    if(!visible){releasePointer();lastTime=0;}wake();
  },{threshold:0}).observe(shell);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releasePointer();lastTime=0;wake();});
  const framePacer=createFramePacer(quality.frameRate);
  let slowFrames=0,overlayOpen=quality.mobile&&(!document.getElementById('village-drawer').hidden||document.getElementById('village-more').getAttribute('aria-expanded')==='true'||Boolean(document.getElementById('about-dialog').open));
  document.addEventListener('village:overlay',event=>{overlayOpen=quality.mobile&&event.detail.open;lastTime=0;viewDirty=true;wake();});
  function wake(){if(ready&&!raf&&!document.hidden)raf=requestAnimationFrame(frame);}
  function frame(now){
    raf=0;
    if(!visible||document.hidden){lastTime=0;return;}
    const activityPaused=paused||overlayOpen;
    // Bound GPU and animation work on high-refresh phones as well as 60 Hz displays.
    const interval=1000/quality.frameRate;
    if(!framePacer.due(now)){wake();return;}
    const frameGap=lastRender?now-lastRender:0;
    const frameStarted=performance.now();
    const elapsed=lastTime?Math.max(0,(now-lastTime)/1000):0;
    const dt=Math.min(elapsed,.05);lastTime=now;
    if(autoOrbit&&!entranceActive&&!activityPaused&&visible&&!document.hidden)wantedTheta+=dt*.06;
    const cameraDt=visible&&!document.hidden?dt:0;
    if(!streetMode&&flightKeys.size){
      // Move the orbit anchor on the ground plane in the current viewing direction.
      // Translate both ends of the camera easing so releasing a key stops travel.
      const forward=Number(flightKeys.has('KeyW'))-Number(flightKeys.has('KeyS'));
      const right=Number(flightKeys.has('KeyD'))-Number(flightKeys.has('KeyA'));
      const distance=Math.min(90,Math.max(12,radius*.65))*cameraDt/(Math.hypot(forward,right)||1);
      const dx=(right*Math.cos(theta)-forward*Math.sin(theta))*distance;
      const dz=(-right*Math.sin(theta)-forward*Math.cos(theta))*distance;
      target.x+=dx;target.z+=dz;wantedTarget.x+=dx;wantedTarget.z+=dz;
    }
    if(entranceActive){
      if(visible&&!document.hidden&&!entrancePaused)entranceTime=Math.min(INTRO_DURATION,entranceTime+elapsed);
      applyIntroView();paintIntro();
      if(!reduced)moneyRain.update(entranceTime,introNight);
      if(entranceTime>=INTRO_DURATION)finishIntro();
    }else{
      clampCampusTarget(wantedTarget,village.streetTotal,village.extension);
      clampCampusTarget(target,village.streetTotal,village.extension);
      const ease=reduced?1:1-Math.exp(-cameraDt*7);target.lerp(wantedTarget,ease);theta+=(wantedTheta-theta)*ease;phi+=(wantedPhi-phi)*ease;radius+=(wantedRadius-radius)*ease;
    }
    if(streetMode){
      const ease=reduced?1:1-Math.exp(-cameraDt*7);streetZ+=(streetWantedZ-streetZ)*ease;
      camera.position.lerp(new THREE.Vector3(0,2.6,streetZ),ease);
      target.set(camera.position.x-Math.sin(theta)*Math.cos(phi)*10,camera.position.y-Math.sin(phi)*10,camera.position.z-Math.cos(theta)*Math.cos(phi)*10);wantedTarget.copy(target);
      streetNav.update(streetZ,theta);
      const direction=Math.cos(wantedTheta)>=0?-1:1;
      document.getElementById('street-forward').disabled=streetStep(streetWantedZ,direction,village.extension)===streetWantedZ;
      document.getElementById('street-back').disabled=streetStep(streetWantedZ,-direction,village.extension)===streetWantedZ;
    }else camera.position.set(target.x+Math.sin(theta)*Math.cos(phi)*radius,target.y+Math.sin(phi)*radius,target.z+Math.cos(theta)*Math.cos(phi)*radius);
    camera.lookAt(target);if(introRoll)camera.rotateZ(introRoll);camera.updateMatrixWorld();
    const housesChanged=village.updateView?.(camera)||false;
    if(housesChanged){moneyRain.setChapters(chapters,village.renderAnchors||village.anchors);renderer.shadowMap.needsUpdate=true;viewDirty=true;}
    // Keep nearby rank labels from covering an entire house when the camera approaches.
    for(const badge of village.competition.badges){
      const width=Math.min(badge.userData.width,camera.position.distanceTo(badge.position)*2*Math.tan(camera.fov*Math.PI/360)*112/viewport.clientHeight);
      badge.scale.set(width,width/2,1);badge.updateMatrix();
    }
    // The whole flight fits inside one shadow box, so hold the map where the
    // village settles. The intro then costs no shadow pass of its own, and the
    // handover to the resting view needs none either.
    const shadowX0=entranceActive?openingView.target[0]:target.x,shadowZ0=entranceActive?openingView.target[2]:target.z;
    const districtChanged=districts.update(target.x,target.z),lightX=Math.round(shadowX0/12)*12,lightZ=Math.round(shadowZ0/12)*12;
    if(districtChanged||lightX!==shadowX||lightZ!==shadowZ){
      shadowX=lightX;shadowZ=lightZ;sun.position.set(lightX-35,55,lightZ+30);sun.target.position.set(lightX,0,lightZ);renderer.shadowMap.needsUpdate=true;
    }
    if(!activityPaused&&!(entranceActive&&entrancePaused)&&visible&&!document.hidden){
      if(!entranceActive&&!reduced)moneyRain.updateRewards(dt,nightToggle.getAttribute('aria-pressed')==='true'?1:0);
      partyTime+=dt;blimp.update(partyTime);village.animateEffects(partyTime);
    }
    // Refresh newly visible crowds even while activity is paused; their pose
    // must match the frozen clock when the user turns or moves the camera.
    arrivals.advance(partyTime);
    const pedestrianPoses=pedestrianSpacing.update(partyTime,[...village.pedestrians,...districts.pedestrians]);
    village.animateCrowd(partyTime,camera,pedestrianPoses);
    districts.animate(partyTime,target.x,target.z,camera,pedestrianPoses);
    renderer.render(scene,camera);lastRender=now;
    if(quality.mobile){
      slowFrames=performance.now()-frameStarted>interval*.8||(frameGap>interval*1.45&&frameGap<250)?slowFrames+1:Math.max(0,slowFrames-1);
      if(slowFrames>=20&&renderScale>quality.minPixelRatio){
        renderScale=Math.max(quality.minPixelRatio,renderScale-.25);renderer.setPixelRatio(renderScale);slowFrames=0;
      }
    }
    viewDirty=false;
    const settling=(streetMode&&(Math.abs(streetZ-streetWantedZ)>.01||camera.position.distanceTo(new THREE.Vector3(0,2.6,streetWantedZ))>.01))||target.distanceTo(wantedTarget)>.01||Math.abs(radius-wantedRadius)>.01||Math.abs(theta-wantedTheta)>.001||Math.abs(phi-wantedPhi)>.001;
    if(visible&&!document.hidden&&((!activityPaused&&!(entranceActive&&entrancePaused))||flightKeys.size||settling||(entranceActive&&!entrancePaused)||village.building||districts.building))wake();
  }
  canvas.addEventListener('webglcontextlost',event=>{
    releasePointer();
    event.preventDefault();ready=false;cancelAnimationFrame(raf);raf=0;
    loading.hidden=false;loading.textContent='Restoring the village… You can still open Chapters.';
    shell.classList.remove('village-ready','intro-playing');shell.classList.add('village-unavailable');
  });
  canvas.addEventListener('webglcontextrestored',()=>{prepare().catch(showLoadingError);});
  viewportWidth=viewport.clientWidth;viewportHeight=viewport.clientHeight;
  renderer.setSize(viewportWidth,viewportHeight,false);camera.aspect=viewportWidth/viewportHeight;camera.updateProjectionMatrix();resetView();
  // Do not overwrite a new chapter's deep link before its first live response.
  const initial=new URLSearchParams(location.hash.slice(1)).get('chapter');choose(village.anchors.some(a=>a.id===initial)?initial:selected,false,false);
  camera.position.set(0,104,104);camera.lookAt(target);camera.updateMatrixWorld();
  async function prepare(){
    while(districts.building){await new Promise(resolve=>requestAnimationFrame(resolve));districts.update(target.x,target.z);}
    return prewarmVillage(THREE,renderer,scene,camera,applyLighting,moneyRain,{mobile:quality.mobile||Boolean(village.streaming),variantRoots:[districts.stadium.root]}).then(()=>{
    if(pendingChapterUpdate){
      const event=pendingChapterUpdate;pendingChapterUpdate=null;
      return updateChapters(event).then(()=>prepare());
    }
    if(renderer.getContext?.().isContextLost())return;
    ready=true;lastTime=0;lastRender=0;framePacer.reset();
    applyLighting(nightToggle.getAttribute('aria-pressed')==='true'?1:0);
    loading.hidden=true;shell.classList.remove('village-unavailable');shell.classList.add('village-ready');
    if(entranceActive)shell.classList.add('intro-playing');
    if(visible&&entrancePending){if(overlayOpen){finishIntro();resetView();}else beginIntro();}
    wake();
  });}
  function showLoadingError(error){
    console.error('Unable to prepare Greek village:',error);
    loading.textContent='The village couldn’t load. Open Chapters to browse progress or join Greek Wars.';
    loading.hidden=false;shell.classList.add('village-unavailable');
  }
  prepare().catch(showLoadingError);
}
