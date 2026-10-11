const mod=(x,n)=>(x%n+n)%n;
// One-way lane following. Distances are kept on the road, including corners.
export function createTrafficSpacing(loops,cars){
  const distances=cars.map((c,i)=>mod((Math.floor(i/2)+.15)*loops[c.loop].length/4,loops[c.loop].length));
  const samples=loops.map(loop=>Array.from({length:Math.ceil(loop.length*2)},(_,i)=>({distance:i/2,...loop.sample(i/2)})));
  let lastTime;
  function update(time,obstacles=[]){
    const dt=lastTime===undefined?0:Math.max(0,Math.min(.2,time-lastTime));lastTime=time;
    const projected=loops.map((loop,index)=>obstacles.flatMap(o=>{let best,d2=Infinity;for(const p of samples[index]){const d=(p.x-o.x)**2+(p.z-o.z)**2;if(d<d2){d2=d;best=p;}}return d2<16?[{distance:best.distance,length:o.length||5}]:[];}));
    const next=distances.map((d,i)=>d+cars[i].speed*dt);
    for(let i=0;i<cars.length;i++){
      const c=cars[i],length=loops[c.loop].length;
      for(const o of projected[c.loop]){
        const gap=(c.length+o.length)/2+2.5,delta=mod(o.distance-distances[i]+length/2,length)-length/2;
        if(delta>=0&&delta<gap+c.speed*dt)next[i]=Math.min(next[i],distances[i]+delta-gap);
        // A moving priority car can catch a car ahead; that car moves forward
        // with it instead of letting the two bodies intersect.
        else if(delta<0&&delta>-gap)next[i]=Math.max(next[i],distances[i]+delta+gap);
      }
    }
    // Resolve downstream queues before publishing any poses. The fixed order
    // on each circular lane prevents overtaking and preserves bumper gaps.
    for(let pass=0;pass<cars.length;pass++)for(let i=0;i<cars.length;i++)for(let j=0;j<cars.length;j++){
      if(i===j||cars[i].loop!==cars[j].loop)continue;
      const length=loops[cars[i].loop].length,delta=mod(distances[j]-distances[i],length);
      if(delta>length/2)continue;
      const gap=(cars[i].length+cars[j].length)/2+2.5;
      next[i]=Math.min(next[i],distances[i]+delta+(next[j]-distances[j])-gap);
    }
    next.forEach((d,i)=>distances[i]=mod(d,loops[cars[i].loop].length));
    return distances.map((distance,i)=>({...loops[cars[i].loop].sample(distance),distance}));
  }
  return {update,distances};
}
