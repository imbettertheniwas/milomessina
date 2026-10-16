// Synthesized locally: no audio downloads or external services.
export const CHIMES={
 arrival:[{frequency:783.99,at:0,duration:.55,gain:.028},{frequency:1046.5,at:.13,duration:.68,gain:.022}],
 goal:[{frequency:523.25,at:0,duration:.7,gain:.06},{frequency:659.25,at:.16,duration:.8,gain:.06},{frequency:783.99,at:.32,duration:1,gain:.06},{frequency:1046.5,at:.52,duration:1.2,gain:.065},{frequency:1318.51,at:.76,duration:1.4,gain:.055},{frequency:1046.5,at:1.06,duration:2.6,gain:.045},{frequency:1318.51,at:1.06,duration:2.6,gain:.033},{frequency:1567.98,at:1.06,duration:2.6,gain:.025}]
};
// Windows output buffers are larger than macOS; notes scheduled at exactly
// currentTime start mid-envelope and click. Schedule slightly ahead instead.
const LEAD=.06;
export function playChime(context,kind='arrival',voices=new Set(),destination=context.destination,lead=0){
 const t0=context.currentTime+lead;
 for(const note of CHIMES[kind]||CHIMES.arrival){
  const osc=context.createOscillator(),gain=context.createGain(),start=t0+note.at;
  osc.type='sine';osc.frequency.value=note.frequency;
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(note.gain,start+.018);gain.gain.exponentialRampToValueAtTime(.0001,start+note.duration);
  osc.connect(gain);gain.connect(destination);voices.add(osc);
  osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};
  osc.start(start);osc.stop(start+note.duration+.03);
 }
}
function createContext(){
 const Ctx=window.AudioContext||window.webkitAudioContext;
 // Chimes don't need low latency; the larger 'playback' buffer avoids
 // crackle on Windows while the 3D scene and arrival animations are busy.
 try{return new Ctx({latencyHint:'playback'});}catch{return new Ctx();}
}
export function createChimePlayer(){
 let context=null,enabled=false;const voices=new Set();
 function stop(){for(const voice of voices)try{voice.stop();}catch{}voices.clear();}
 // Windows can suspend/interrupt the context after sleep or an output device
 // change; resume before playing instead of silently dropping the chime.
 async function ready(){if(!context)return false;if(context.state!=='running')try{await context.resume();}catch{}return context.state==='running';}
 function onVisible(){if(enabled&&document.visibilityState==='visible')ready();}
 return {
  get enabled(){return enabled;},
  async enable(){try{if(!context){context=createContext();document.addEventListener('visibilitychange',onVisible);}enabled=await ready();}catch{enabled=false;}return enabled;},
  disable(){enabled=false;stop();},
  async play(kind='arrival'){if(enabled&&await ready()&&enabled)playChime(context,kind,voices,context.destination,LEAD);},
  dispose(){enabled=false;stop();document.removeEventListener('visibilitychange',onVisible);context?.close().catch(()=>{});}
 };
}
