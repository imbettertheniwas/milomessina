// Same qualifying-view estimate as /fomo/submit/. The approval bonus is separate.
export function viewsAt(position){
 const x=1000*Math.pow(3000,Math.max(0,Math.min(1000,Number(position)||0))/1000);
 const step=x<10000?500:x<100000?1000:x<1000000?5000:10000;
 return Math.round(x/step)*step;
}
export const earningsFor=views=>Math.min(Math.round(Math.max(0,views)/1000*200)/100,5000);
export const formatViews=x=>x>=1e6?(x/1e6).toFixed(2).replace(/\.?0+$/,'')+'M':(x/1000).toFixed(x>=1e5?0:1).replace(/\.0$/,'')+'K';
