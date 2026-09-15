import {houseStandings} from './village-competition.js?v=111';
// Local effects share the village's clock, visibility and reduced-motion controls.
export function createLotBeacon(T,lot){
  const root=new T.Group();root.name='empty-lot-beacon';root.position.set(lot.x,0,lot.z);root.rotation.y=lot.rotation;
  const gradient=new Uint8Array(64*4);
  for(let i=0;i<64;i++){const alpha=Math.round(255*Math.pow(1-i/63,1.6));gradient.set([alpha,alpha,alpha,255],i*4);}
  const alphaMap=new T.DataTexture(gradient,1,64);alphaMap.magFilter=T.LinearFilter;alphaMap.needsUpdate=true;
  const beam=new T.Mesh(new T.CylinderGeometry(6.4,5.3,22,48,1,true),new T.MeshBasicMaterial({color:0xaba5ff,alphaMap,transparent:true,opacity:.14,blending:T.AdditiveBlending,side:T.BackSide,depthWrite:false}));
  beam.name='claim-light-shaft';beam.position.set(0,11.16,3);root.add(beam);
  const rings=[0,1].map(i=>{
    const ring=new T.Mesh(new T.RingGeometry(.96,1,64),new T.MeshBasicMaterial({color:0xc8c2ff,transparent:true,opacity:.3,blending:T.AdditiveBlending,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.set(0,.17+i*.005,3);root.add(ring);return ring;
  });
  const stakeMaterial=new T.MeshStandardMaterial({color:0xcfc1a2,roughness:.8}),capMaterial=new T.MeshStandardMaterial({color:0xffbc6c,emissive:0xff822e,emissiveIntensity:.5});
  for(const x of [-7,7])for(const z of [-5.5,11.5]){
    const stake=new T.Mesh(new T.BoxGeometry(.13,1.3,.13),stakeMaterial);stake.position.set(x,.7,z);root.add(stake);
    const cap=new T.Mesh(new T.BoxGeometry(.19,.24,.19),capMaterial);cap.position.set(x,1.25,z);root.add(cap);
  }
  let map;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=384;const ctx=canvas.getContext('2d');
    const paint=()=>{ctx.fillStyle='#22223f';ctx.fillRect(0,0,1536,384);ctx.strokeStyle='#bfc4ff';ctx.lineWidth=6;ctx.strokeRect(18,18,1500,348);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.font='700 124px Aeonik, Arial, sans-serif';ctx.fillText('CLAIM THIS LOT',768,160,1390);ctx.fillStyle='#c9caff';ctx.font='500 45px Aeonik, Arial, sans-serif';ctx.fillText('YOUR CHAPTER STARTS HERE  ↗',768,280);if(map)map.needsUpdate=true;};
    paint();map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;document.fonts?.ready.then(()=>{paint();document.dispatchEvent(new Event('village:artwork'));});
  }
  // A plane in the lot's local +Z faces the street, just like the chapter banners.
  const board=new T.Mesh(new T.PlaneGeometry(8.4,2.1),new T.MeshBasicMaterial({...(map?{map}:{}),color:map?0xffffff:0xbfc4ff,side:T.DoubleSide}));
  board.name='claim-lot-board';board.position.set(0,4.2,10);board.userData={chapter:'empty',action:'register'};root.add(board);
  function animate(time){
    const beat=time/2.6;beam.material.opacity=.14+.025*Math.sin(beat*Math.PI*2);
    rings.forEach((ring,i)=>{const phase=(beat+i*.5)%1;ring.scale.setScalar(1.9+phase*5);ring.material.opacity=.42*Math.sin(Math.PI*phase);});
    board.position.y=4.2+Math.sin(time*1.4)*.16;
  }
  animate(0);return {root,beam,rings,board,animate};
}

export function createNightLife(T,world,anchors,chapters){
  const root=new T.Group();root.name='village-night-life';root.visible=false;
  const biggest=houseStandings(chapters).find(c=>c.joined>=15),anchor=anchors.find(a=>a.id===biggest?.id);
  const uplights=[];
  if(anchor){
    const house=new T.Group();house.position.set(anchor.lot.x,0,anchor.lot.z);house.rotation.y=anchor.lot.rotation;root.add(house);
    for(const [x,color] of [[-4.6,0xb28aff],[4.6,0xffb86b]]){
      const light=new T.SpotLight(color,310,24,.48,.65,1.5);light.position.set(x,.4,7);light.target.position.set(x*.5,10,1);house.add(light,light.target);uplights.push(light);
      const fixture=new T.Mesh(new T.CylinderGeometry(.2,.28,.28,12),new T.MeshStandardMaterial({color:0x222735}));fixture.position.copy(light.position);house.add(fixture);
    }
  }
  // At the open end of the row, clear of chapter lawns and the boulevard.
  const fire=new T.Group();fire.name='village-bonfire';fire.position.set(-15,.12,35);root.add(fire);
  const stones=new T.MeshStandardMaterial({color:0x6a6870,roughness:1});
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2,stone=new T.Mesh(new T.DodecahedronGeometry(.36,0),stones);stone.position.set(Math.cos(a)*1.5,.2,Math.sin(a)*1.5);stone.scale.set(1,.75,1);fire.add(stone);}
  const wood=new T.MeshStandardMaterial({color:0x38241b,roughness:1,emissive:0xb5370c,emissiveIntensity:.22});
  for(let i=0;i<5;i++){const log=new T.Mesh(new T.CylinderGeometry(.18,.23,2.5,8),wood);log.rotation.set(Math.PI/2,0,i*Math.PI/5);log.position.y=.35+i*.05;fire.add(log);}
  const flames=[];
  for(let i=0;i<7;i++){
    const flame=new T.Mesh(new T.SphereGeometry(1,10,8),new T.MeshBasicMaterial({color:i%2?0xffd777:0xff762c,transparent:true,opacity:.82,blending:T.AdditiveBlending,depthWrite:false}));
    const a=i*2.4;flame.position.set(Math.cos(a)*.52,1,Math.sin(a)*.52);fire.add(flame);flames.push(flame);
  }
  const light=new T.PointLight(0xff8c38,100,21,2);light.position.set(0,2,0);fire.add(light);
  const windows=new Map();
  world.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m?.userData.nightWindow&&!windows.has(m))windows.set(m,{color:m.color.clone(),emissive:m.emissive.clone(),intensity:m.emissiveIntensity});});
  function setNight(enabled){root.visible=enabled;for(const [m,day] of windows){m.color.copy(day.color);m.emissive.copy(day.emissive);m.emissiveIntensity=day.intensity;if(enabled){m.color.set(0xffdda2);m.emissive.set(0xffb65c);m.emissiveIntensity=3.4;}}}
  function animate(time){flames.forEach((f,i)=>{const flicker=Math.sin(time*5+i*2.1)*.12+Math.sin(time*8.3+i)*.07;f.scale.set(.34+flicker*.4,.8+i%3*.22+flicker,.34);f.position.y=.72+f.scale.y*.5;f.rotation.z=Math.sin(time*3+i)*.15;});light.intensity=100+Math.sin(time*7)*11+Math.sin(time*11.7)*7;}
  animate(0);return {root,uplights,fire,flames,light,windows,setNight,animate};
}
