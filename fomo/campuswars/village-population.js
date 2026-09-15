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
  // Keep the sign on the far-left hilltop lawn, away from the FOMO facade
  // and central stairs. Set the posts into the actual terrain.
  const site={x:-44,z:-83},scale=.85;
  const ground=campusGroundHeight(site.x,site.z-.9*scale)+.052;
  root.position.set(site.x,ground,site.z);root.scale.setScalar(scale);
  const resources=new Set(),own=value=>(resources.add(value),value);
  const box=own(new T.BoxGeometry(1,1,1));
  const metal=own(new T.MeshStandardMaterial({color:0xaeb5bc,roughness:.6,metalness:.6}));
  const rim=own(new T.MeshStandardMaterial({color:0x25272b,roughness:.75,metalness:.15}));
  function block(x,y,z,w,h,d,material){const mesh=new T.Mesh(box,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;}
  // Two slim galvanized posts are embedded in the hillside, with no pedestal.
  for(const x of [-2.7,2.7])block(x,3.3,0,.14,7.6,.14,metal);
  block(0,4.85,0,8.4,5.3,.12,rim);
  const canvas=typeof document==='undefined'?null:document.createElement('canvas');
  let texture=null;
  if(canvas){
    canvas.width=1536;canvas.height=960;
    texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    const material=own(new T.MeshBasicMaterial({map:texture,toneMapped:false,alphaTest:.5}));
    const face=own(new T.PlaneGeometry(8.2,5.125));
    for(const side of [-1,1]){const mesh=new T.Mesh(face,material);mesh.name='population-sign-face';mesh.position.set(0,4.85,side*.071);mesh.rotation.y=side<0?Math.PI:0;root.add(mesh);}
  }
  let totals=villagePopulation(chapters),feedStatus={...status},lastKey='';
  function refresh(now=Date.now()){
    const label=populationStatus(feedStatus,now),key=JSON.stringify([totals,label]);
    if(key===lastKey)return false;lastKey=key;
    root.userData={...totals,status:label,updatedAt:feedStatus.updatedAt||null};
    if(!canvas)return true;
    const c=canvas.getContext('2d'),w=canvas.width;
    c.fillStyle='#f4f3ed';c.fillRect(0,0,w,960);
    c.strokeStyle='#24262a';c.lineWidth=5;c.strokeRect(24,24,w-48,912);
    c.textBaseline='middle';c.textAlign='center';c.fillStyle='#24262a';
    c.font='700 107px Aeonik, Arial, sans-serif';c.fillText('GREEK VILLAGE',w/2,164,w-160);
    c.fillRect(96,265,w-192,3);
    c.font='500 57px Aeonik, Arial, sans-serif';c.fillText('POPULATION',w/2,351);
    c.font='700 326px Aeonik, Arial, sans-serif';c.fillText(totals.members.toLocaleString('en-US'),w/2,563,w-190);
    c.font='500 46px Aeonik, Arial, sans-serif';c.fillText(`Across ${totals.chapters.toLocaleString('en-US')} ${totals.chapters===1?'chapter':'chapters'}`,w/2,790);
    c.fillStyle='#66676a';c.font='500 25px Aeonik, Arial, sans-serif';c.fillText(label==='LIVE REGISTRATIONS'?'LIVE MEMBER COUNT':label,w/2,890,w-160);
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
