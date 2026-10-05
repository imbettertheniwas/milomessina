// Synthesized locally: no audio downloads or external services.
export const CHIMES={
 arrival:[{frequency:783.99,at:0,duration:.55,gain:.028},{frequency:1046.5,at:.13,duration:.68,gain:.022}],
 goal:[{frequency:523.25,at:0,duration:.7,gain:.06},{frequency:659.25,at:.16,duration:.8,gain:.06},{frequency:783.99,at:.32,duration:1,gain:.06},{frequency:1046.5,at:.52,duration:1.2,gain:.065},{frequency:1318.51,at:.76,duration:1.4,gain:.055},{frequency:1046.5,at:1.06,duration:2.6,gain:.045},{frequency:1318.51,at:1.06,duration:2.6,gain:.033},{frequency:1567.98,at:1.06,duration:2.6,gain:.025}]
};
export function playChime(context,kind='arrival',voices=new Set()){
 for(const note of CHIMES[kind]||CHIMES.arrival){
  const osc=context.createOscillator(),gain=context.createGain(),start=context.currentTime+note.at;
  osc.type='sine';osc.frequency.value=note.frequency;
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(note.gain,start+.018);gain.gain.exponentialRampToValueAtTime(.0001,start+note.duration);
  osc.connect(gain);gain.connect(context.destination);voices.add(osc);
  osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};
  osc.start(start);osc.stop(start+note.duration+.03);
 }
}
export function createChimePlayer(){
 let context=null,enabled=false;const voices=new Set();
 function stop(){for(const voice of voices)try{voice.stop();}catch{}voices.clear();}
 return {
  get enabled(){return enabled;},
  async enable(){try{context??=new (window.AudioContext||window.webkitAudioContext)();await context.resume();enabled=context.state==='running';}catch{enabled=false;}return enabled;},
  disable(){enabled=false;stop();},
  play(kind='arrival'){if(enabled&&context?.state==='running')playChime(context,kind,voices);},
  dispose(){enabled=false;stop();context?.close().catch(()=>{});}
 };
}
