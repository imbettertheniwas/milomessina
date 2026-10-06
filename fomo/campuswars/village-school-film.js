// Native After Effects plates cover the jet/cabin, then reveal the live school jump.
export const SCHOOL_FILM_DURATION=2.55;
export function createSchoolFilm(host,{enabled=true,doc=document}={}){
 const noop={begin(){},update(){},pause(){},finish(){},dispose(){}};
 if(!enabled)return noop;
 const video=doc.createElement('video');video.className='school-flight-film';video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';video.setAttribute('aria-hidden','true');video.setAttribute('playsinline','');video.hidden=true;
 Object.assign(video.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none',zIndex:'1'});
 let active=false,mode='',playPending=false,generation=0,pausedByClock=false;
 function prepare(){const next=host.clientWidth<host.clientHeight?'phone':'wide';if(next!==mode){mode=next;video.src=`/fomo/campuswars/media/school-flight-${mode}-ae-v151.mp4`;video.load();}}
 function pause(){pausedByClock=true;video.pause();}
 function finish(){generation++;active=false;playPending=false;video.hidden=true;pause();}
 function play(){pausedByClock=false;if(!video.paused||playPending)return;playPending=true;const attempt=generation;Promise.resolve(video.play()).then(()=>{if(attempt!==generation)return;playPending=false;if(!active)pause();},error=>{if(attempt!==generation)return;playPending=false;if(error?.name!=='AbortError'||!pausedByClock)finish();});}
 video.addEventListener('error',finish);host.appendChild(video);prepare();
 return {begin(){finish();prepare();active=video.readyState>=3;if(active){if(video.currentTime>.02)video.currentTime=0;video.style.opacity='1';video.hidden=false;play();}},update(time,paused=false){
  if(!active)return;
  if(time>=SCHOOL_FILM_DURATION){finish();return;}
  if(paused){pause();if(Math.abs(video.currentTime-time)>.02)video.currentTime=time;}else{if(Math.abs(video.currentTime-time)>.12)video.currentTime=time;play();}
  const u=Math.max(0,Math.min(1,(time-2.3)/.25));video.style.opacity=String(1-u*u*(3-2*u));
 },pause,finish,dispose(){finish();video.removeAttribute('src');video.load();video.remove();}};
}
