import {campusGroundHeight} from './village-campus-hill.js?v=105';

// This is the sum of chapter registrations, never the decorative campus crowd
// or the full active-roster/qualification denominators.
export function villagePopulation(chapters){
  return {members:chapters.reduce((sum,chapter)=>sum+chapter.joined,0),chapters:chapters.length};
}

export function populationStatus(status={},now=Date.now()){
  const age=now-Date.parse(status.updatedAt);
  if(status.live===true&&Number.isFinite(age)&&age<=90000)return 'LIVE REGISTRATIONS';
  return status.updatedAt?'LAST KNOWN REGISTRATIONS':'CONNECTING · SAVED REGISTRATIONS';
}

export function createVillagePopulation(T,chapters,status={}){
  const root=new T.Group();root.name='greek-village-population';
  // Set the sign on the hill's left lawn beside the central stairs, facing
  // Greek Row. Match the uphill edge of the plinth to the actual terrain.
  const site={x:-12,z:-81},scale=.85;
  const ground=campusGroundHeight(site.x,site.z-.9*scale)+.052;
  root.position.set(site.x,ground,site.z);root.scale.setScalar(scale);
  const resources=new Set(),own=value=>(resources.add(value),value);
  const box=own(new T.BoxGeometry(1,1,1));
  const metal=own(new T.MeshStandardMaterial({color:0x171925,roughness:.38,metalness:.7}));
  const trim=own(new T.MeshStandardMaterial({color:0x8b8caa,roughness:.3,metalness:.8}));
  const violet=own(new T.MeshBasicMaterial({color:0x8670ff,toneMapped:false}));
  function block(x,y,z,w,h,d,material){const mesh=new T.Mesh(box,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;}
  block(0,.17,0,5.8,.34,1.8,metal);
  // Sink a short foundation into the slope so the level plinth never floats.
  block(0,-.25,0,5.8,.5,1.8,metal);
  block(0,.36,0,4.8,.045,1.3,violet);
  block(0,1.45,0,1.5,2.2,.65,metal);
  for(const side of [-1,1])block(side*.65,1.45,-.335,.045,1.7,.035,violet);
  function slab(width,height,depth,radius,material,z){
    const shape=new T.Shape(),x=-width/2,y=-height/2,r=radius;
    shape.moveTo(x+r,y);shape.lineTo(x+width-r,y);shape.quadraticCurveTo(x+width,y,x+width,y+r);
    shape.lineTo(x+width,y+height-r);shape.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
    shape.lineTo(x+r,y+height);shape.quadraticCurveTo(x,y+height,x,y+height-r);
    shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
    const geometry=own(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:8}));
    const mesh=new T.Mesh(geometry,material);mesh.position.set(0,4.85,z-depth/2);mesh.castShadow=true;root.add(mesh);
  }
  // A rounded metal enclosure with a violet light seam, mounted on one plinth.
  slab(8.65,5.6,.32,.48,trim,0);
  slab(8.55,5.5,.36,.44,violet,0);
  slab(8.4,5.35,.44,.39,metal,0);
  const canvas=typeof document==='undefined'?null:document.createElement('canvas');
  let texture=null;
  if(canvas){
    canvas.width=1536;canvas.height=960;
    texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    const material=own(new T.MeshBasicMaterial({map:texture,toneMapped:false,alphaTest:.5}));
    const face=own(new T.PlaneGeometry(8.2,5.125));
    for(const side of [-1,1]){const mesh=new T.Mesh(face,material);mesh.name='population-sign-face';mesh.position.set(0,4.85,side*.231);mesh.rotation.y=side<0?Math.PI:0;root.add(mesh);}
  }
  let totals=villagePopulation(chapters),feedStatus={...status},lastKey='';
  function refresh(now=Date.now()){
    const label=populationStatus(feedStatus,now),key=JSON.stringify([totals,label]);
    if(key===lastKey)return false;lastKey=key;
    root.userData={...totals,status:label,updatedAt:feedStatus.updatedAt||null};
    if(!canvas)return true;
    const c=canvas.getContext('2d'),w=canvas.width;
    c.clearRect(0,0,w,960);
    c.fillStyle='#11121f';c.beginPath();c.roundRect(0,0,w,960,62);c.fill();
    // Fine etched lines give the dark display depth without an extra texture.
    c.strokeStyle='#1e2034';c.lineWidth=1;
    for(let y=30;y<960;y+=24){c.beginPath();c.moveTo(55,y);c.lineTo(w-55,y);c.stroke();}
    c.textBaseline='middle';c.textAlign='left';
    c.fillStyle='#a595ff';c.font='700 64px Aeonik, Arial, sans-serif';c.fillText('fomo',86,102);
    const live=label==='LIVE REGISTRATIONS';
    c.fillStyle=live?'#302650':'#292936';c.beginPath();c.roundRect(w-277,64,191,75,37);c.fill();
    c.fillStyle=live?'#baabff':'#cbcbd8';c.beginPath();c.arc(w-240,102,9,0,Math.PI*2);c.fill();
    c.font='700 29px Aeonik, Arial, sans-serif';c.fillText(live?'LIVE':'SAVED',w-215,103);
    c.textAlign='center';c.fillStyle='#f3f1ff';c.font='700 102px Aeonik, Arial, sans-serif';c.fillText('GREEK VILLAGE',w/2,247,w-160);
    c.shadowColor='#8464ff';c.shadowBlur=42;c.fillStyle='#faf8ff';c.font='700 352px Aeonik, Arial, sans-serif';c.fillText(totals.members.toLocaleString('en-US'),w/2,493,w-190);c.shadowBlur=0;
    c.fillStyle='#bdb4e1';c.font='500 46px Aeonik, Arial, sans-serif';c.fillText('MEMBERS JOINED',w/2,711);
    c.fillStyle='#7e66ee';c.fillRect(w/2-88,785,176,5);
    c.fillStyle='#d4cfee';c.font='500 39px Aeonik, Arial, sans-serif';c.fillText(`${totals.chapters.toLocaleString('en-US')} ${totals.chapters===1?'CHAPTER':'CHAPTERS'}  /  ONE VILLAGE`,w/2,854,w-160);
    if(!live){c.fillStyle='#a7a3b8';c.font='500 22px Aeonik, Arial, sans-serif';c.fillText(label,w/2,918,w-160);}
    texture.needsUpdate=true;return true;
  }
  refresh();
  // Redraw once the site's own typeface is available, reusing the same texture.
  let disposed=false;
  if(canvas)document.fonts?.ready.then(()=>{if(!disposed){lastKey='';refresh();document.dispatchEvent(new CustomEvent('village:artwork'));}});
  return {root,refresh,
    setChapters(next){totals=villagePopulation(next);refresh();},
    setStatus(next){feedStatus={...feedStatus,...next};refresh();},
    dispose(){disposed=true;root.removeFromParent();for(const resource of resources)resource.dispose();resources.clear();}
  };
}
