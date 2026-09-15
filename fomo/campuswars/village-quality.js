// Keep the full village within phone graphics and canvas memory budgets.
export function villageQuality(mobile=typeof matchMedia==='function'&&(matchMedia('(pointer: coarse)').matches||matchMedia('(max-width: 700px)').matches)){
  return mobile?{mobile:true,pixelRatio:1.25,maxPixelRatio:1.5,minPixelRatio:1,frameRate:30,antialias:false,shadowSize:1024,bannerResolution:1024,terrainResolution:1024}:{mobile:false,pixelRatio:2,maxPixelRatio:2,minPixelRatio:1.25,frameRate:60,antialias:true,shadowSize:2048,bannerResolution:2048,terrainResolution:2048};
}

// Start conservatively, recover detail only after sustained spare frame time.
// Slow display callbacks catch GPU pressure that JS timing alone cannot see.
export function createResolutionBudget(quality,deviceRatio=1){
  const max=Math.min(deviceRatio,quality.maxPixelRatio),min=Math.min(deviceRatio,quality.minPixelRatio);
  const interval=1000/quality.frameRate;
  let ratio=Math.min(deviceRatio,quality.pixelRatio),slow=0,healthy=0,nextRecovery=0,lastChange=-Infinity;
  return {
    get ratio(){return ratio;},
    sample(now,cost,gap,{busy=false}={}){
      if(!quality.mobile)return ratio;
      // A resumed/idle view and scene construction are not steady-state samples.
      if(busy||gap<=0){slow=healthy=0;return ratio;}
      const overloaded=cost>interval*.8||gap>interval*1.45;
      slow=overloaded?slow+1:Math.max(0,slow-1);
      healthy=!overloaded&&cost<interval*.45&&gap<interval*1.2?healthy+1:0;
      if(slow>=12&&ratio>min&&now-lastChange>=1000){
        ratio=Math.max(min,ratio-.125);lastChange=now;nextRecovery=now+15000;slow=healthy=0;
      }else if(healthy>=180&&ratio<max&&now>=nextRecovery&&now-lastChange>=6000){
        ratio=Math.min(max,ratio+.125);lastChange=now;slow=healthy=0;
      }
      return ratio;
    }
  };
}
