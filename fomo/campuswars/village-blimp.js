// Official Discord Clyde symbol: https://discord.com/branding
const DISCORD_SYMBOL_PATH='M40.9051 0C40.2863 1.09866 39.7306 2.2352 39.2255 3.397C34.4268 2.67719 29.5396 2.67719 24.7283 3.397C24.2358 2.2352 23.6675 1.09866 23.0487 0C18.5404 0.770324 14.1458 2.12155 9.97847 4.02841C1.71959 16.2652 -0.51561 28.1863 0.595677 39.9432C5.4323 43.517 10.8498 46.2447 16.6209 47.9874C17.9216 46.2447 19.0708 44.3883 20.0558 42.4562C18.1868 41.7616 16.381 40.8903 14.6509 39.88C15.1055 39.5517 15.5475 39.2107 15.9769 38.8824C26.1174 43.6559 37.8617 43.6559 48.0148 38.8824C48.4441 39.236 48.8861 39.577 49.3407 39.88C47.6107 40.9029 45.8048 41.7616 43.9232 42.4688C44.9082 44.4009 46.0574 46.2573 47.3581 48C53.1292 46.2573 58.5467 43.5422 63.3834 39.9684C64.6967 26.3299 61.1355 14.5099 53.9753 4.04104C49.8206 2.13418 45.426 0.782952 40.9177 0.0252565L40.9051 0ZM21.4702 32.7072C18.351 32.7072 15.7622 29.8785 15.7622 26.3804C15.7622 22.8824 18.25 20.041 21.4576 20.041C24.6651 20.041 27.216 22.895 27.1655 26.3804C27.115 29.8658 24.6525 32.7072 21.4702 32.7072ZM42.5089 32.7072C39.3771 32.7072 36.8135 29.8785 36.8135 26.3804C36.8135 22.8824 39.3013 20.041 42.5089 20.041C45.7164 20.041 48.2547 22.895 48.2042 26.3804C48.1537 29.8658 45.6912 32.7072 42.5089 32.7072Z';

export const DISCORD_INVITE='https://discord.gg/FhvKtyvFJp';
export const BLIMP_LAP_SECONDS=110;

// A closed ellipse with a matching heading and no reset at the lap boundary.
export function blimpPose(seconds){
  const angle=seconds/BLIMP_LAP_SECONDS*Math.PI*2;
  return {x:-20+28*Math.sin(angle),y:23.5+.65*Math.sin(angle*2),z:105+10*Math.cos(angle),heading:Math.atan2(10*Math.sin(angle),28*Math.cos(angle))};
}

function createBranding(T){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=388;
  const c=canvas.getContext('2d');
  function paint(){
    // Transparent ink follows the hull lighting with no rectangular sign behind it.
    c.clearRect(0,0,2048,388);c.fillStyle='#fff';
    c.save();c.translate(292,63);c.scale(5.4,5.4);c.fill(new Path2D(DISCORD_SYMBOL_PATH));c.restore();
    c.font='700 292px Aeonik, Arial, sans-serif';c.textBaseline='middle';c.letterSpacing='-12px';
    c.fillText('fomo',805,203,945);
  }
  paint();
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  if(document.fonts)document.fonts.load('700 292px Aeonik').then(()=>{paint();map.needsUpdate=true;document.dispatchEvent(new Event('village:artwork'));});
  return map;
}

export function createFomoBlimp(T){
  const root=new T.Group();root.name='fomo-discord-blimp';root.scale.set(1.35,1.1,1.1);
  const purple=new T.MeshPhysicalMaterial({color:0x6875f5,roughness:.4,metalness:.06,clearcoat:.4,clearcoatRoughness:.35,emissive:0x364bc7,emissiveIntensity:.16});
  const dark=new T.MeshStandardMaterial({color:0x151e3d,roughness:.35,metalness:.25});
  const glass=new T.MeshPhysicalMaterial({color:0x335c8b,roughness:.16,metalness:.35,clearcoat:.8,emissive:0x619ee6,emissiveIntensity:.36});
  const white=new T.MeshStandardMaterial({color:0xf0f2ff,roughness:.38,metalness:.12,emissive:0x9aa8e1,emissiveIntensity:.12});
  const map=createBranding(T),branding=new T.MeshStandardMaterial({color:0xffffff,map,transparent:true,opacity:map?1:0,alphaTest:.08,depthWrite:false,emissive:0xffffff,emissiveMap:map,emissiveIntensity:map?.65:0,roughness:.55,side:T.DoubleSide});
  function mesh(name,geometry,material,x=0,y=0,z=0,parent=root){
    const item=new T.Mesh(geometry,material);item.name=name;item.position.set(x,y,z);parent.add(item);return item;
  }
  const sphere=new T.SphereGeometry(1,20,12),box=new T.BoxGeometry(1,1,1);
  // Two paint finishes share one watertight hull, so their edges cannot flicker.
  const hullGeometry=new T.SphereGeometry(1,48,28),hullIndices=hullGeometry.index,hullPositions=hullGeometry.attributes.position;
  hullGeometry.clearGroups();let groupStart=0,lastFinish=-1;
  for(let i=0;i<hullIndices.count;i+=3){
    const highest=Math.max(...[0,1,2].map(j=>hullPositions.getY(hullIndices.getX(i+j))));
    const finish=highest<-.38?1:0;
    if(finish!==lastFinish){if(i>0)hullGeometry.addGroup(groupStart,i-groupStart,lastFinish);groupStart=i;lastFinish=finish;}
  }
  hullGeometry.addGroup(groupStart,hullIndices.count-groupStart,lastFinish);
  mesh('blimp-envelope',hullGeometry,[purple,white]).scale.set(9,3,3);
  // Curved decals follow the envelope; both sides read forwards.
  for(const side of [-1,1]){
    const geometry=new T.PlaneGeometry(13.4,3.1,32,12),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i)+.35;
      positions.setXYZ(i,x*side,y,side*(3*Math.sqrt(Math.max(0,1-x*x/81-y*y/9))+.035));
    }
    geometry.computeVertexNormals();mesh(`blimp-brand-${side}`,geometry,branding);
  }
  // Four swept tail fins, with the nose facing local +X.
  const finShape=new T.Shape();finShape.moveTo(-5.7,0);finShape.lineTo(-7.4,2.9);finShape.quadraticCurveTo(-7.7,3.5,-8.4,3.5);finShape.lineTo(-9.6,3.5);finShape.quadraticCurveTo(-10,3.5,-9.85,3.1);finShape.lineTo(-8.5,0);finShape.closePath();
  const finGeometry=new T.ExtrudeGeometry(finShape,{depth:.12,bevelEnabled:true,bevelThickness:.045,bevelSize:.055,bevelSegments:2,curveSegments:5});finGeometry.translate(0,0,-.06);
  for(let i=0;i<4;i++){const fin=mesh(`blimp-tail-${i}`,finGeometry,i%2?white:purple);fin.rotation.x=i*Math.PI/2;}
  const collar=mesh('blimp-tail-collar',new T.TorusGeometry(1,.024,6,48),white,-6.7);collar.rotation.y=Math.PI/2;collar.scale.set(2.01,2.01,1);
  // A small passenger cabin and twin propeller pods give the silhouette depth.
  mesh('blimp-gondola',sphere,white,.9,-2.95,0).scale.set(2.2,.75,.82);
  for(const side of [-1,1]){
    mesh(`blimp-windows-${side}`,sphere,glass,1.3,-2.89,side*.68).scale.set(1.7,.43,.2);
    mesh(`blimp-strut-${side}`,box,dark,-1.7,-2.8,side*1.3).scale.set(.18,.18,2.6);
    mesh(`blimp-engine-${side}`,sphere,white,-1.7,-2.8,side*2.6).scale.set(.75,.33,.33);
  }
  const propellers=[];
  for(const side of [-1,1]){
    const propeller=new T.Group();propeller.position.set(-2.48,-2.8,side*2.6);root.add(propeller);propellers.push(propeller);
    for(let i=0;i<2;i++){const blade=mesh('blimp-propeller',box,white,0,0,0,propeller);blade.scale.set(.08,1.65,.13);blade.rotation.x=i*Math.PI/2;}
  }
  const lampMaterial=new T.MeshBasicMaterial({color:0xccddff});
  mesh('blimp-nose-light',sphere,lampMaterial,8.93,0,0).scale.set(.12,.16,.16);
  for(const side of [-1,1]){
    const light=new T.MeshBasicMaterial({color:side<0?0xff698d:0x80ffcc});
    mesh(`blimp-navigation-light-${side}`,sphere,light,-8.65,0,side*3.44).scale.set(.16,.1,.1);
  }
  const pickables=[];root.traverse(object=>{if(object.isMesh){object.userData.action='discord';pickables.push(object);}});
  function update(seconds){
    const pose=blimpPose(seconds);root.position.set(pose.x,pose.y,pose.z);root.rotation.y=pose.heading;
    root.rotation.z=.018*Math.sin(seconds*.35);
    for(const propeller of propellers)propeller.rotation.x=seconds*18;
  }
  update(0);
  return {root,pickables,update,dispose(){
    const geometries=new Set(),materials=new Set();
    root.traverse(object=>{if(object.isMesh){geometries.add(object.geometry);for(const material of [].concat(object.material))materials.add(material);}});
    geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());map?.dispose();
  }};
}
