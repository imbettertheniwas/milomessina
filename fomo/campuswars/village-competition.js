import {bannerIdentity} from './village-banner-art.js?v=55';

// These standings use the chapter onboarding totals, not unavailable trading P&L.
export function houseStandings(chapters,metric='progress'){
  const rows=chapters.filter(c=>c.active>0).map(c=>({...c,progress:c.joined/c.active}));
  const score=c=>metric==='members'?c.joined:c.progress;
  rows.sort((a,b)=>score(b)-score(a)||b.joined-a.joined||a.id.localeCompare(b.id));
  rows.forEach((row,i)=>{row.rank=i&&score(row)===score(rows[i-1])?rows[i-1].rank:i+1;});
  return rows;
}
function canvasTexture(T,w,h,paint){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');paint(ctx,w,h);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  if(document.fonts)document.fonts.load('700 80px Aeonik').then(()=>{paint(ctx,w,h);map.needsUpdate=true;document.dispatchEvent(new Event('village:artwork'));});
  return map;
}
export function createCompetition(T,chapters,anchors,lightAnchors=anchors){
  const root=new T.Group();root.name='village-competition';
  const standings=houseStandings(chapters),leader=standings[0]?.joined>0?standings[0]:null,badges=[];
  for(const row of standings){
    const anchor=anchors.find(a=>a.id===row.id);if(!anchor)continue;
    const first=row.id===leader?.id,medal=row.rank===1?'#F1CA70':row.rank===2?'#D7E0E8':row.rank===3?'#D3A37A':'#AABCD3';
    const map=canvasTexture(T,512,256,(ctx,w,h)=>{
      ctx.clearRect(0,0,w,h);ctx.fillStyle=first?'#F1CA70':'#142331';ctx.beginPath();ctx.roundRect(16,18,w-32,h-36,44);ctx.fill();
      ctx.strokeStyle=medal;ctx.lineWidth=7;ctx.stroke();ctx.fillStyle=first?'#172331':'#FFFFFF';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='700 119px Aeonik, Arial, sans-serif';ctx.fillText(`#${row.rank}`,w*.5,h*.43);
      ctx.font='700 28px Aeonik, Arial, sans-serif';ctx.fillText(first?'ROW LEADER':`${Math.round(row.progress*100)}% ONBOARDED`,w*.5,h*.80);
    });
    const badge=new T.Sprite(new T.SpriteMaterial({map,color:map?0xffffff:medal,transparent:true,depthWrite:false,toneMapped:false}));
    badge.name=`house-rank-${row.id}`;badge.position.set(anchor.lot.x,anchor.point.y+1.9,anchor.lot.z);badge.scale.set(first?4.5:3.7,first?2.25:1.85,1);badge.userData={chapter:row.id,rank:row.rank,metric:'onboarding-progress',width:first?4.5:3.7};root.add(badge);badges.push(badge);
  }
  let spotlight=null;
  if(leader){
    const anchor=lightAnchors.find(a=>a.id===leader.id);
    if(anchor){
      spotlight=new T.SpotLight(0xffe3a6,360,40,.48,.8,2);spotlight.name='leading-house-spotlight';spotlight.position.set(anchor.lot.x-2,anchor.point.y+9,anchor.lot.z+3);spotlight.target.position.set(anchor.lot.x,4,anchor.lot.z);root.add(spotlight,spotlight.target);
      // A very faint dust-lit shaft makes the spotlight visible in daylight.
      const beamHeight=spotlight.position.y-3,beam=new T.Mesh(new T.CylinderGeometry(.12,6.5,beamHeight,32,1,true),new T.MeshBasicMaterial({color:0xffdfa2,transparent:true,opacity:.025,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));
      beam.name='leader-light-shaft';beam.position.set(anchor.lot.x,3+beamHeight/2,anchor.lot.z);root.add(beam);
    }
  }
  const board=new T.Group();board.name='intersection-leaderboard';board.position.set(17.5,0,41.8);board.rotation.y=Math.PI+.28;root.add(board);
  const material=new T.MeshStandardMaterial({color:0x1b2830,roughness:.68,metalness:.3});
  const box=(x,y,z,w,h,d,mat=material)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;board.add(mesh);return mesh;};
  box(0,.13,0,12,.26,1.7,new T.MeshStandardMaterial({color:0xb6b3a3,roughness:1}));
  for(const x of [-4.5,4.5])box(x,3.7,-.08,.3,7.3,.35);
  box(0,5.0,0,11.4,7.8,.40);box(0,9.01,0,11.7,.20,.65);
  const map=canvasTexture(T,2048,1376,(ctx,w,h)=>{
    ctx.fillStyle='#101D29';ctx.fillRect(0,0,w,h);ctx.textBaseline='middle';ctx.textAlign='left';
    ctx.fillStyle='#E9C873';ctx.fillRect(0,0,w,12);ctx.font='700 47px Aeonik, Arial, sans-serif';ctx.fillText('FOMO / GREEK WARS',100,91);
    ctx.fillStyle='#FFFFFF';ctx.font='700 121px Aeonik, Arial, sans-serif';ctx.fillText('LEADERBOARD',100,211);
    ctx.fillStyle='#AFC0CD';ctx.font='500 40px Aeonik, Arial, sans-serif';ctx.fillText('CHAPTER',105,315);
    ctx.textAlign='right';ctx.fillText('80% TARGET',w-327,315);ctx.fillText('% ACTIVE',w-110,315);
    standings.slice(0,5).forEach((row,i)=>{
      const y=382+i*166,first=i===0;
      ctx.fillStyle=first?'#263A39':i%2?'#152632':'#12212E';ctx.fillRect(66,y,w-132,148);
      ctx.fillStyle=bannerIdentity(row).primary;ctx.fillRect(66,y,13,148);
      ctx.fillStyle=first?'#E9C873':'#AFC0CD';ctx.textAlign='left';ctx.font='700 67px Aeonik, Arial, sans-serif';ctx.fillText(`#${row.rank}`,107,y+75);
      ctx.fillStyle='#FFFFFF';ctx.font='700 55px Aeonik, Arial, sans-serif';ctx.fillText(row.name.toUpperCase(),260,y+54,1040);
      ctx.fillStyle='#ACBDC8';ctx.font='500 34px Aeonik, Arial, sans-serif';ctx.fillText(row.shortSchool.toUpperCase(),260,y+106,1040);
      ctx.textAlign='right';ctx.fillStyle='#D0DCE4';ctx.font='500 58px Aeonik, Arial, sans-serif';ctx.fillText(`${row.joined} / ${Math.ceil(row.active*.8)}`,w-328,y+76);
      ctx.fillStyle=first?'#E9C873':'#FFFFFF';ctx.font='700 75px Aeonik, Arial, sans-serif';ctx.fillText(`${Math.round(row.progress*100)}%`,w-111,y+76);
    });
    ctx.textAlign='left';ctx.fillStyle='#AFC0CD';ctx.font='500 32px Aeonik, Arial, sans-serif';ctx.fillText(`TOP ${Math.min(5,standings.length)} OF ${standings.length} CHAPTERS · Open Chapters for the full list.`,100,h-74);
    ctx.fillStyle='#E9C873';ctx.font='700 27px Aeonik, Arial, sans-serif';ctx.textAlign='right';ctx.fillText('80% TO QUALIFY',w-100,h-27);
  });
  const face=new T.Mesh(new T.PlaneGeometry(11,7.4),new T.MeshStandardMaterial({color:map?0xffffff:0x152632,map,roughness:.8,emissive:0xffffff,emissiveMap:map,emissiveIntensity:map?.4:0}));
  face.name='leaderboard-display';face.position.set(0,5,.215);face.userData.ownedTexture=true;board.add(face);
  const gold=new T.MeshStandardMaterial({color:0xdcc47a,roughness:.4,metalness:.6});for(const x of [-4.5,0,4.5]){box(x,9.2,.4,.15,.15,1.1);box(x,9.13,.95,1.05,.09,.33,gold);}
  return {root,standings,badges,spotlight,board,leaderId:leader?.id||null};
}
