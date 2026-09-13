import {hash} from './village-district-layout.js?v=80';

// Traditional masonry and subdued exterior paint, independent of rank or fraternity.
const finishes=[
  {name:'Red brick',color:0xb76b51,brick:true},
  {name:'Warm ivory',color:0xe6dfcd,brick:false},
  {name:'Slate blue',color:0x7b8d9a,brick:false},
  {name:'Sage green',color:0x929b83,brick:false},
  {name:'Sandstone',color:0xc6aa83,brick:true},
  {name:'Warm gray',color:0xaaa69c,brick:false},
  {name:'Brown brick',color:0x926b56,brick:true},
  {name:'Cream',color:0xdbcea9,brick:false},
  {name:'Dusty olive',color:0x898b6f,brick:false},
  {name:'Pale blue gray',color:0xb6c2c5,brick:false},
  {name:'Terracotta brick',color:0xc18c6d,brick:true},
  {name:'Taupe',color:0xb29b8d,brick:false}
];
const originals=['sigma-chi-sdsu','kappa-sigma-coastal','phi-delta-theta-tampa','phi-kappa-psi-vt','tau-kappa-epsilon-tampa'];
export function assignHouseFinishes(chapters,previous=new Map()){
  const result=new Map(previous),used=new Set([...result.values()].map(f=>f.color));
  // Once a candidate has been used it cannot become available in this pass.
  // Keep a cursor per palette start instead of rescanning all previous houses.
  const cursors=Array(finishes.length).fill(0);
  const pending=chapters.filter(c=>!result.has(c.id)).sort((a,b)=>{
    const ai=originals.indexOf(a.id),bi=originals.indexOf(b.id);
    return (ai<0?99:ai)-(bi<0?99:bi)||a.id.localeCompare(b.id);
  });
  for(const chapter of pending){
    const original=originals.indexOf(chapter.id),start=original<0?Math.floor(hash(chapter.id,'exterior')*finishes.length):original;
    let chosen;
    for(let i=cursors[start];!chosen;i++){
      const base=finishes[(start+i)%finishes.length],round=Math.floor(i/finishes.length);
      // Additional chapters get small natural shade variations, never neon hues.
      const shift=round?Math.ceil(round/2)*(round%2?1:-1):0;
      const rgb=[base.color>>16,(base.color>>8)&255,base.color&255].map(c=>Math.max(40,Math.min(245,c+shift)));
      const color=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2];
      if(!used.has(color)){chosen={...base,color};cursors[start]=i+1;}
    }
    result.set(chapter.id,chosen);used.add(chosen.color);
  }
  return result;
}
