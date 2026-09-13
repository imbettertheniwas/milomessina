// Local synthetic CPU benchmark; not a GPU, CDN or production capacity test.
// Run from the repository root: node fomo/campuswars/tests/benchmark-scalability.mjs
import {performance} from 'node:perf_hooks';
import * as T from '../vendor/three.module.min.js';
import {createVillage} from '../village-world.js';
import {createChapterHandler} from '../../../api/campuswars.mjs';

const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const rows=Array.from({length:60},(_,i)=>({id:`benchmark-${i}`,name:'Alpha Beta',letters:'ΑΒ',school:`School ${i}`,shortSchool:`School ${i}`,joined:20,active:100}));
const camera=new T.PerspectiveCamera(48,16/9,1,650);camera.position.set(0,8,38);camera.lookAt(0,2,-50);camera.updateMatrixWorld();
const start=performance.now(),village=createVillage(T,rows),buildMs=performance.now()-start;
let clock=1,visibleMembers=0;
function sample(cull,frames=60){
  const start=performance.now();
  for(let i=0;i<frames;i++){
    const updated=village.animateCrowd(clock++/60,cull?camera:undefined);if(cull)visibleMembers=updated;
    // Model the renderer consuming update ranges after each draw. No GPU work
    // is performed or included in this benchmark.
    for(const mesh of Object.values(village.parts))mesh.instanceMatrix.clearUpdateRanges();
  }
  return (performance.now()-start)/frames;
}
try{
  sample(false,30);sample(true,30);
  const full=[],culled=[];
  for(let i=0;i<6;i++){
    if(i%2){culled.push(sample(true));full.push(sample(false));}
    else{full.push(sample(false));culled.push(sample(true));}
  }
  console.log(JSON.stringify({chapterCount:rows.length,memberCount:village.members.length,animatedMembers:visibleMembers,buildMs:Number(buildMs.toFixed(2)),allMembersMedianMs:Number(median(full).toFixed(3)),visibleMembersMedianMs:Number(median(culled).toFixed(3)),cpuReductionPercent:Number(((1-median(culled)/median(full))*100).toFixed(1))},null,2));
}finally{village.dispose();}

let calls=0;
const handler=createChapterHandler({env:{CAMPUSWARS_ADMIN_PASSWORD:'synthetic-only'},load:async()=>{calls++;return {live:true,updatedAt:new Date().toISOString(),chapters:rows};}});
const latencies=[],responses=[];
const started=performance.now();
await Promise.all(Array.from({length:1000},async()=>{
  const start=performance.now();
  const response={setHeader(){},status(code){this.code=code;return this;},end(body){responses.push({code:this.code,bytes:Buffer.byteLength(body||'')});},json(){throw Error('Unexpected error response');}};
  await handler({method:'GET'},response);latencies.push(performance.now()-start);
}));
latencies.sort((a,b)=>a-b);
console.log(JSON.stringify({syntheticConcurrentRequests:1000,upstreamReads:calls,successfulResponses:responses.filter(r=>r.code===200).length,totalMs:Number((performance.now()-started).toFixed(2)),p95HandlerMs:Number(latencies[Math.floor(latencies.length*.95)].toFixed(2))},null,2));
