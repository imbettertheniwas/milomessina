import * as T from '../campuswars/vendor/three.module.min.js';
import {FOMO_MARK_PATHS} from '../campuswars/village-floor-logo.js';
export {FOMO_MARK_PATHS};
export function eyeSvg(){return `<svg viewBox="0 18 100 64" aria-hidden="true">${FOMO_MARK_PATHS.map(d=>`<path d="${d}" fill="currentColor"/>`).join('')}</svg>`;}
function shapeFromPath(path){
 const tokens=path.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g),shape=new T.Shape();let i=0,x=0,y=0;const n=()=>Number(tokens[i++]);
 while(i<tokens.length){const c=tokens[i++];if(c==='M'){x=n();y=n();shape.moveTo(x,y);}else if(c==='C'){const a=n(),b=n(),d=n(),e=n();x=n();y=n();shape.bezierCurveTo(a,b,d,e,x,y);}else if(c==='H'){x=n();shape.lineTo(x,y);}else if(c==='L'){x=n();y=n();shape.lineTo(x,y);}else if(c==='Z')shape.closePath();else throw Error('Unsupported brand path');}return shape;
}
export function createEyes(){
 const group=new T.Group(),shells=[],scanners=[];group.scale.x=-1;
 for(const path of FOMO_MARK_PATHS){
  const shape=shapeFromPath(path),geo=new T.ExtrudeGeometry(shape,{depth:6,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.35,bevelThickness:.45,curveSegments:36});geo.translate(-50,-50,-3);geo.scale(.115,-.115,.115);
  const material=new T.MeshBasicMaterial({color:0x7262ff,transparent:true,opacity:.11,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});const shell=new T.Mesh(geo,material);group.add(shell);shells.push(shell);
  const edge=new T.LineSegments(new T.EdgesGeometry(geo,30),new T.LineBasicMaterial({color:0xb4abff,transparent:true,opacity:.85,blending:T.AdditiveBlending}));group.add(edge);
  const outline=shape.getPoints(140).map(p=>new T.Vector3((p.x-50)*.115,-(p.y-50)*.115,.42));
  for(let layer=0;layer<5;layer++){const l=new T.Line(new T.BufferGeometry().setFromPoints(outline),new T.LineBasicMaterial({color:layer%2?0x7061ff:0xc2baff,transparent:true,opacity:.11+.055*(4-layer),blending:T.AdditiveBlending}));l.position.z=-layer*.22;group.add(l);}
 }
 const canvas=document.createElement('canvas');canvas.width=400;canvas.height=400;const ctx=canvas.getContext('2d');ctx.scale(4,4);ctx.fillStyle='#fff';FOMO_MARK_PATHS.forEach(p=>ctx.fill(new Path2D(p)));const pixels=ctx.getImageData(0,0,400,400).data,samples=[];
 for(let y=94;y<306;y+=3)for(let x=34;x<366;x+=3)if(pixels[(y*400+x)*4+3]>200)samples.push([-(x/4-50)*.115,-(y/4-50)*.115]);
 for(let i=0;i<3;i++){const g=new T.TorusGeometry(6.6+i*.48,.012,4,240),m=new T.Mesh(g,new T.MeshBasicMaterial({color:i===1?0x8a77ff:0x7768b6,transparent:true,opacity:i===1?.34:.16,blending:T.AdditiveBlending}));m.rotation.set(.12+i*.12,.22+i*.15,i*.3);group.add(m);scanners.push(m);}
 const scan=new T.LineSegments(new T.BufferGeometry().setFromPoints([new T.Vector3(-6,0,.5),new T.Vector3(6,0,.5)]),new T.LineBasicMaterial({color:0xc7c0ff,transparent:true,opacity:.32,blending:T.AdditiveBlending}));group.add(scan);
 return {group,samples,animate(t,energy=1){group.rotation.y=Math.sin(t*.32)*.065;group.rotation.x=Math.sin(t*.25)*.025;scanners.forEach((r,i)=>{r.rotation.z=t*(.04+i*.015);r.rotation.y=.22+i*.15+Math.sin(t*.2+i)*.15;});scan.position.y=Math.sin(t*.6)*3;shells.forEach((s,i)=>s.material.opacity=.10+Math.sin(t*.9+i)*.025+energy*.012);}};
}
