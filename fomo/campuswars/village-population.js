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
  // Center the sign in front of the left academic building, on the upper
  // lawn and behind the foreground trees. Keep the FOMO facade clear.
  const site={x:-31,z:-84.7},scale=.85;
  const ground=campusGroundHeight(site.x,site.z-.9*scale)+.052;
  root.position.set(site.x,ground,site.z);root.scale.setScalar(scale);
  const resources=new Set(),own=value=>(resources.add(value),value);
  const box=own(new T.BoxGeometry(1,1,1));
  const metal=own(new T.MeshStandardMaterial({color:0xaeb5bc,roughness:.6,metalness:.6}));
  const rim=own(new T.MeshStandardMaterial({color:0x25272b,roughness:.75,metalness:.15}));
  function block(x,y,z,w,h,d,material){const mesh=new T.Mesh(box,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;}
  // Two slim galvanized posts are embedded in the hillside, with no pedestal.
  for(const x of [-2.7,2.7])block(x,.85,0,.16,2.9,.16,metal);
  const board=block(0,4.85,0,8.4,5.3,.18,rim);board.name='population-sign-board';
  const canvas=typeof document==='undefined'?null:document.createElement('canvas');
  let texture=null;
  if(canvas){
    canvas.width=1536;canvas.height=960;
    texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    const material=own(new T.MeshStandardMaterial({map:texture,roughness:.78,metalness:.08,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.1}));
    // Print directly on both faces of the solid panel. Overlay planes and
    // full-height posts used to sit almost coplanar and could flicker.
    board.material=[rim,rim,rim,rim,material,material];
  }
  let totals=villagePopulation(chapters),feedStatus={...status},lastKey='';
  function refresh(now=Date.now()){
    const label=populationStatus(feedStatus,now),key=JSON.stringify([totals,label]);
    if(key===lastKey)return false;lastKey=key;
    root.userData={...totals,status:label,updatedAt:feedStatus.updatedAt||null};
    if(!canvas)return true;
    const c=canvas.getContext('2d'),w=canvas.width;
    c.fillStyle='#294b68';c.fillRect(0,0,w,960);
    c.strokeStyle='#f0e6c9';c.lineWidth=9;c.strokeRect(27,27,w-54,906);
    c.strokeStyle='#bfa773';c.lineWidth=2;c.strokeRect(44,44,w-88,872);
    c.textBaseline='middle';c.textAlign='center';
    c.fillStyle='#dbcaa1';c.font='500 34px Aeonik, Arial, sans-serif';c.fillText('WELCOME TO',w/2,112);
    c.fillStyle='#fff5db';c.font='700 107px Aeonik, Arial, sans-serif';c.fillText('GREEK VILLAGE',w/2,230,w-160);
    c.fillStyle='#bfa773';c.fillRect(180,323,w-360,3);
    c.fillStyle='#e2d4b1';c.font='500 50px Aeonik, Arial, sans-serif';c.fillText('POPULATION',w/2,404);
    c.fillStyle='#fff5db';c.font='700 296px Aeonik, Arial, sans-serif';c.fillText(totals.members.toLocaleString('en-US'),w/2,599,w-190);
    c.font='500 42px Aeonik, Arial, sans-serif';c.fillText(`${totals.chapters.toLocaleString('en-US')} ${totals.chapters===1?'chapter':'chapters'}`,w/2,805);
    c.fillStyle='#c7cfcf';c.font='500 24px Aeonik, Arial, sans-serif';c.fillText(label==='LIVE REGISTRATIONS'?'LIVE MEMBER COUNT':label,w/2,882,w-160);
    for(const x of [77,w-77])for(const y of [78,882]){c.fillStyle='#bac1c2';c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fill();c.fillStyle='#727e83';c.fillRect(x-4,y-1,8,2);}
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
