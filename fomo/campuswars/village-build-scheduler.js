// Yield to input and rendering without waiting for the next display refresh.
// Startup must also finish when a tab is hidden and animation frames are paused.
export function yieldVillageBuild(host=globalThis){
  if(typeof host.scheduler?.yield==='function')return host.scheduler.yield();
  if(typeof host.MessageChannel==='function')return new Promise(resolve=>{
    const channel=new host.MessageChannel();
    channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};
    channel.port2.postMessage(null);
  });
  return new Promise(resolve=>host.setTimeout(resolve,0));
}
