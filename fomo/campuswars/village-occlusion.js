// Conservative whole-house occlusion. Only a solid wall that covers the entire
// projected lot (including its lawn and badge) can hide a distant house. A
// nearer building's screen bounding box alone is NOT an occluder: its corners
// can contain empty sky. Use a rectangle inscribed in the projected wall hull.
function hull(points){
  const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  return [...half(sorted).slice(0,-1),...half(sorted.slice().reverse()).slice(0,-1)];
}
function rectangle(projected){
  const points=hull(projected.points);if(points.length<3)return null;
  const cx=(projected.left+projected.right)/2,cy=(projected.bottom+projected.top)/2,hw=(projected.right-projected.left)/2,hh=(projected.top-projected.bottom)/2;
  let scale=1;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],nx=-(b[1]-a[1]),ny=b[0]-a[0];
    const distance=nx*(cx-a[0])+ny*(cy-a[1]),extent=Math.abs(nx)*hw+Math.abs(ny)*hh;
    if(extent>0)scale=Math.min(scale,distance/extent);
  }
  if(scale<=0)return null;scale*=.97;
  return {left:cx-hw*scale,right:cx+hw*scale,bottom:cy-hh*scale,top:cy+hh*scale,far:projected.far};
}
export function unoccludedHouses(T,layout,camera,indices){
  const projection=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),point=new T.Vector3();
  function project(min,max){
    const out={left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity,near:Infinity,far:-Infinity,points:[]};
    for(let i=0;i<8;i++){
      point.set(i&1?max[0]:min[0],i&2?max[1]:min[1],i&4?max[2]:min[2]);
      const z=-point.clone().applyMatrix4(camera.matrixWorldInverse).z;if(z<=camera.near)return null;
      out.near=Math.min(out.near,z);out.far=Math.max(out.far,z);point.applyMatrix4(projection);
      out.left=Math.min(out.left,point.x);out.right=Math.max(out.right,point.x);out.bottom=Math.min(out.bottom,point.y);out.top=Math.max(out.top,point.y);out.points.push([point.x,point.y]);
    }
    return out;
  }
  const candidates=[...indices].map(index=>{
    const lot=layout.lots[index],chapter=layout.chapters[index],size=chapter&&layout.houseSizes.get(chapter.id);
    const bounds=project([lot.x-17,0,lot.z-10],[lot.x+17,chapter?chapter.joined>=15?size.roofline+5:9:26,lot.z+10]);
    return {index,lot,chapter,size,bounds};
  }).sort((a,b)=>(a.bounds?.near||0)-(b.bounds?.near||0));
  const keep=new Set(),occluders=[];
  for(const {index,lot,chapter,size,bounds} of candidates){
    const hidden=index!==0&&bounds&&bounds.near>100&&occluders.some(r=>r.far<bounds.near&&r.left<bounds.left&&r.right>bounds.right&&r.bottom<bounds.bottom&&r.top>bounds.top);
    if(hidden)continue;keep.add(index);
    if(chapter?.joined>=15){
      const x=lot.x+Math.sin(lot.rotation)*size.offsetZ,dx=7.5*size.depthScale/2,dz=size.width*size.scaleX/2;
      const wall=project([x-dx,.6*size.scaleY,lot.z-dz],[x+dx,(size.height+.6)*size.scaleY,lot.z+dz]);
      if(wall){const rect=rectangle(wall);if(rect)occluders.push(rect);}
    }
  }
  return keep;
}
