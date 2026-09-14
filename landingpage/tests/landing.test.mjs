import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {INTRO_DURATION,introCaptionAt} from '../../fomo/campuswars/village-intro.js';

function harness({reduced=false,mobile=false,hash='',blocked=false,frameCallbacks=false,hidden=false,navigationType='navigate',historyState=null}={}) {
  const nodes=new Map(),events=new Map(),timers=new Map();let timerId=0,animation,frameId=0;const frames=new Map();
  function node(id) {
    if(!nodes.has(id))nodes.set(id,{
      hidden:false,inert:false,offsetHeight:800,style:{setProperty(key,value){this[key]=value;}},
      getBoundingClientRect(){return {left:300,top:240,width:600,height:112};},
      classList:{values:new Set(),add(...names){names.forEach(n=>this.values.add(n));},remove(...names){names.forEach(n=>this.values.delete(n));},contains(name){return this.values.has(name);}},
      addEventListener(type,fn){events.set(`${id}:${type}`,fn);},
      setAttribute(key,value){this[key]=value;},getAttribute(key){return this[key]||null;},hasAttribute(key){return this[key]!==undefined;},
      focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}
    });
    return nodes.get(id);
  }
  const video=node('intro-video');
  Object.assign(video,{paused:true,currentTime:0,readyState:2,
    play(){if(blocked)return Promise.reject(new Error('Autoplay blocked'));this.paused=false;events.get('intro-video:playing')?.();return Promise.resolve();},
    pause(){this.paused=true;events.get('intro-video:pause')?.();}
  });
  if(frameCallbacks){video.requestVideoFrameCallback=fn=>{frames.set(++frameId,fn);return frameId;};video.cancelVideoFrameCallback=id=>frames.delete(id);}
  const doc={body:node('body'),documentElement:node('html'),getElementById:node,querySelector:node,hidden,
    addEventListener(type,fn){events.set(`document:${type}`,fn);}};
  const history={state:historyState,replaceState(state){this.state=state;}};
  const win={scrollY:800,scrollTo({top}){this.scrollY=top;},addEventListener(type,fn){events.set(`window:${type}`,fn);}};
  const context=vm.createContext({
    INTRO_DURATION,introCaptionAt,document:doc,history,performance:{getEntriesByType:()=>[{type:navigationType}]},
    window:win,location:{hash},
    matchMedia:query=>({matches:query.includes('reduced-motion')?reduced:query.includes('max-width')&&mobile,addEventListener(type,fn){events.set('media:'+type,fn);}}),
    setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId;},clearTimeout(id){timers.delete(id);},
    requestAnimationFrame(fn){animation=fn;return 1;},cancelAnimationFrame(){animation=null;}
  });
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  vm.runInContext(html.match(/<script id="intro-entry">([\s\S]*?)<\/script>/)[1],context);
  vm.runInContext(fs.readFileSync(new URL('../main.js',import.meta.url),'utf8').replace(/^import .*;\n/,''),context);
  return {node,doc,video,timers,frames,history,win,allowPlayback(){blocked=false;},renderFrame(time){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(0,{mediaTime:time}));},fire(name,event={}){events.get(name)(event);},flush(maxDelay=Infinity){const pending=[...timers].filter(([,t])=>t.delay<=maxDelay);pending.forEach(([id])=>timers.delete(id));pending.forEach(([,t])=>t.fn());},step(time){video.currentTime=time;animation?.();}};
}
test('intro streams a video immediately without constructing the 3D village',()=>{
  const h=harness();assert.equal(h.video.src,'/landingpage/assets/intro-desktop-smooth.mp4');assert.equal(h.video.paused,false);assert.equal(h.node('page').inert,true);
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<video[^>]*muted autoplay playsinline preload="auto"/);
  assert.match(html,/class="opening-poster"/);assert.doesNotMatch(html,/<iframe|Getting campus ready|pause-intro|Play intro/);
});
test('fresh visits open the intro when motion is enabled',()=>{
  for(const options of [{},{hash:'#internship'},{hash:'#greek-wars'}]){const h=harness(options);assert.ok(h.video.src);assert.equal(h.video.paused,false);assert.equal(h.node('opening').hidden,false);assert.equal(h.node('page').inert,true);}
});
test('reduced motion opens the requested content without loading a video, but allows explicit replay',()=>{
  const h=harness({reduced:true,hash:'#internship'});
  assert.equal(h.video.src,undefined);assert.equal(h.video.paused,true);assert.equal(h.node('opening').hidden,true);
  assert.equal(h.node('page').inert,false);assert.equal(h.node('internship').scrolled,true);assert.equal(h.node('internship').focused,true);
  h.fire('replay-intro:click');assert.equal(h.video.paused,false);assert.equal(h.node('opening').hidden,false);
});
test('finishing or skipping the intro honors a requested section',()=>{
  for(const end of [h=>h.fire('skip-intro:click'),h=>{h.fire('intro-video:ended');h.flush();}]){
    const h=harness({hash:'#internship'});end(h);
    assert.equal(h.node('internship').scrolled,true);assert.equal(h.node('internship').focused,true);
    assert.equal(h.node('page').inert,false);
  }
});
test('a malformed section URL falls back to the hero',()=>{
  const h=harness({hash:'#%E0%A4%A'});h.fire('skip-intro:click');assert.equal(h.node('programs').focused,true);
});
test('caption and progress timing follow the actual video clock',()=>{
  const h=harness();h.step(3);assert.equal(h.node('film-title').textContent,"IF YOU'RE IN A CHAPTER.");h.step(6.8);assert.equal(h.node('film-progress').style.transform,'scaleX(0.5)');
});
test('replay starts the video automatically from the beginning',()=>{
  const h=harness();
  h.video.currentTime=13.6;h.fire('intro-video:ended');h.flush();assert.equal(h.node('page').inert,false);h.fire('replay-intro:click');assert.equal(h.video.currentTime,0);assert.equal(h.video.paused,false);
});
test('skip and Escape release the page',()=>{
  for(const action of [h=>h.fire('skip-intro:click'),h=>h.fire('document:keydown',{key:'Escape'})]){const h=harness();action(h);assert.equal(h.node('page').inert,false);assert.equal(h.video.paused,true);assert.equal(h.node('programs').focused,true);}
});
test('an interrupted autoplay keeps the intro visible and retries when ready or tapped',async()=>{
  for(const trigger of ['intro-video:canplay','document:pointerdown','document:visibilitychange']){
    const h=harness({blocked:true});await Promise.resolve();assert.equal(h.node('opening').hidden,false);assert.equal(h.node('page').inert,true);
    h.allowPlayback();h.fire(trigger);assert.equal(h.video.paused,false);
  }
});
test('hidden tabs pause playback and resume automatically',()=>{
  const h=harness();h.doc.hidden=true;h.fire('document:visibilitychange');assert.equal(h.video.paused,true);h.doc.hidden=false;h.fire('document:visibilitychange');assert.equal(h.video.paused,false);
});

test('final shot brings in the logo before revealing the hero without scrolling',()=>{
  const h=harness();h.step(12.2);assert.ok(Number(h.node('intro-transition').style['--outro'])<.01);
  h.step(12.9);assert.ok(Math.abs(Number(h.node('intro-transition').style['--outro'])-.5)<.01);
  h.fire('intro-video:ended');assert.equal(h.node('page').inert,true);assert.equal(h.node('intro-transition').style['--outro'],'1');
  h.flush();assert.equal(h.node('opening').hidden,true);assert.equal(h.node('page').inert,false);assert.equal(h.node('page').scrolled,undefined);
  h.flush();assert.equal(h.node('intro-transition').hidden,true);
});

test('captions follow presented video frames and stop scheduling after skip',()=>{
  const h=harness({frameCallbacks:true});assert.equal(h.frames.size,1);
  h.renderFrame(3);assert.equal(h.node('film-title').textContent,"IF YOU'RE IN A CHAPTER.");assert.equal(h.frames.size,1);
  h.fire('intro-video:playing');assert.equal(h.frames.size,1);
  h.fire('skip-intro:click');assert.equal(h.frames.size,0);
  h.fire('replay-intro:click');h.renderFrame(.5);assert.equal(h.node('film-title').textContent,'GREEK WARS.');assert.equal(h.frames.size,1);
});

test('a visit opened in the background starts playing when brought forward',()=>{
  const h=harness({hidden:true});assert.equal(h.node('opening').hidden,false);assert.equal(h.video.paused,true);
  h.doc.hidden=false;h.fire('document:visibilitychange');assert.equal(h.video.paused,false);
});
test('media errors try the compatible video and release the page if recovery fails',()=>{
  const h=harness();h.fire('intro-video:error');assert.equal(h.video.src,'/landingpage/assets/intro-desktop.mp4');assert.equal(h.node('opening').hidden,false);
  h.fire('intro-video:error');assert.equal(h.node('page').inert,false);
  h.fire('skip-intro:click');assert.equal(h.node('page').inert,false);
});
test('cached Back navigation preserves the completed intro and section position',()=>{
  const h=harness();h.video.currentTime=13.6;h.fire('intro-video:ended');h.flush();h.flush();
  h.win.scrollY=2400;h.fire('window:pagehide');h.fire('window:pageshow',{persisted:true});
  assert.equal(h.node('opening').hidden,true);assert.equal(h.video.currentTime,13.6);assert.equal(h.video.paused,true);assert.equal(h.win.scrollY,2400);
});
test('uncached Back navigation restores the section without loading the video',()=>{
  const h=harness({navigationType:'back_forward',historyState:{otherState:'preserved',campusLanding:{introDone:true,scrollY:1800}}});
  assert.equal(h.node('opening').hidden,true);assert.equal(h.video.src,undefined);assert.equal(h.node('page').inert,false);assert.equal(h.win.scrollY,1800);
  h.fire('window:pageshow',{persisted:false});assert.equal(h.win.scrollY,1800);
  h.fire('window:pagehide');assert.equal(h.history.state.otherState,'preserved');
});
test('reloads and fresh visits still play even if the history entry was previously completed',()=>{
  for(const navigationType of ['reload','navigate']){
    const h=harness({navigationType,historyState:{campusLanding:{introDone:true,scrollY:1800}}});
    assert.equal(h.node('opening').hidden,false);assert.equal(h.video.paused,false);assert.equal(h.history.state.campusLanding.introDone,false);
  }
});
test('a returned visitor can still choose Replay intro',()=>{
  const h=harness({navigationType:'back_forward',historyState:{campusLanding:{introDone:true,scrollY:1800}}});
  h.fire('replay-intro:click');assert.equal(h.node('opening').hidden,false);assert.equal(h.video.paused,false);assert.equal(h.video.currentTime,0);
});


test('startup playback retries without requiring a click and keeps inline muted defaults',async()=>{
  const h=harness({blocked:true});await Promise.resolve();
  assert.equal(h.video.defaultMuted,true);assert.equal(h.video.muted,true);
  assert.equal(h.video.playsInline,true);assert.equal(h.video.controls,false);
  assert.equal(h.timers.size,2);
  h.allowPlayback();h.flush(2000);assert.equal(h.video.paused,false);
});
test('blocked autoplay retries are bounded and cannot restart a skipped intro',async()=>{
  const h=harness({blocked:true});await Promise.resolve();
  for(let i=0;i<4;i++){h.flush(2000);await Promise.resolve();}
  assert.equal(h.timers.size,0);
  const skipped=harness({blocked:true});await Promise.resolve();
  skipped.fire('skip-intro:click');skipped.allowPlayback();skipped.flush();
  assert.equal(skipped.video.paused,true);assert.equal(skipped.node('opening').hidden,true);
});
test('the intro video remains visible during initial autoplay eligibility checks',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.doesNotMatch(html+css,/\.opening-video\{opacity:0\}/);
  assert.match(html,/<video[^>]+poster=/);
});

 test('phones use the smaller compatible movie and recover from media failure',()=>{
  const h=harness({mobile:true});assert.equal(h.video.src,'/landingpage/assets/intro-mobile.mp4');
  h.fire('intro-video:error');assert.equal(h.node('page').inert,false);assert.equal(h.timers.size,0);
 });
 test('a stalled intro releases scrolling, and hidden tabs do not time out',()=>{
  const h=harness();h.fire('intro-video:waiting');h.flush();assert.equal(h.node('page').inert,false);
  const hidden=harness();hidden.doc.hidden=true;hidden.fire('document:visibilitychange');hidden.flush();assert.equal(hidden.node('page').inert,true);
  hidden.doc.hidden=false;hidden.fire('document:visibilitychange');hidden.flush();assert.equal(hidden.node('page').inert,false);
 });
 test('navigating away stops playback and callbacks, and back resumes an unfinished intro',()=>{
  const h=harness({frameCallbacks:true});h.fire('window:pagehide');assert.equal(h.video.paused,true);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
  h.fire('window:pageshow',{persisted:true});assert.equal(h.video.paused,false);assert.equal(h.frames.size,1);
 });
