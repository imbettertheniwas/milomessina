// One opaque AE jet shot, followed by a clean cut to the live door/jump.
export const SCHOOL_FILM_DURATION=.85;
export function createSchoolFilm(host,{enabled=true,doc=document}={}){
 const noop={begin(){},update(){return false;},pause(){},finish(){},dispose(){}};
 if(!enabled)return noop;
 const video=doc.createElement('video');video.className='school-flight-film';video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';video.setAttribute('aria-hidden','true');video.setAttribute('playsinline','');video.hidden=true;
 Object.assign(video.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none',zIndex:'1'});
 let active=false,mode='',playPending=false,generation=0,pausedByClock=false;
 function prepare(){const next=host.clientWidth<host.clientHeight?'phone':'wide';if(next!==mode){mode=next;video.src=`/fomo/campuswars/media/school-flight-${mode}-ae-v154.mp4`;video.load();}}
 function pause(){pausedByClock=true;video.pause();}
 function finish(){generation++;active=false;playPending=false;video.hidden=true;pause();}
 function play(){pausedByClock=false;if(!video.paused||playPending)return;playPending=true;const attempt=generation;Promise.resolve(video.play()).then(()=>{if(attempt!==generation)return;playPending=false;if(!active)pause();},error=>{if(attempt!==generation)return;playPending=false;if(error?.name!=='AbortError'||!pausedByClock)finish();});}
 video.addEventListener('error',finish);host.appendChild(video);prepare();
 return {begin(){finish();prepare();active=video.readyState>=3;if(active){if(video.currentTime>.02)video.currentTime=0;video.hidden=false;play();}},update(time,paused=false){
  if(!active)return false;
  if(time>=SCHOOL_FILM_DURATION){finish();return false;}
  // Never seek backwards during playback: that visibly repeats the jet shot
  // when video decoding runs ahead of a busy WebGL frame.
  if(paused)pause();else play();
  if(time-video.currentTime>.12)video.currentTime=time;
  return true;
 },pause,finish,dispose(){finish();video.removeAttribute('src');video.load();video.remove();}};
}
