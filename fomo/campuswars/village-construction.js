import {constructionPlan,constructionStation} from './village-construction-layout.js?v=80';
import {createChapterBanner} from './village-banners.js?v=87';
import {createSchoolBanner} from './village-school-banners.js?v=87';

export function createConstructionSite(T,chapter,{box,cylinder,sign,pickables,artworkOptions={}}){
  const site=new T.Group(),plan=constructionPlan(chapter);
  site.name=`chapter-construction-${chapter.id}`;
  site.userData={chapter:chapter.id,joined:chapter.joined,state:'construction',plan};
  const {width:w,depth:d,timber,masonry,side,progress:p,wallHeight:h}=plan;
  const steel=0x708286,concrete=0xbcb7a9;
  const beam=(a,b,size=.14,color=timber)=>{
    const direction=new T.Vector3().subVectors(new T.Vector3(...b),new T.Vector3(...a));
    const m=box(site,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,size,direction.length(),size,color);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());return m;
  };
  const slab=(x,z,sw,sd)=>{
    box(site,x,.24,z,sw,.22,sd,concrete);
    for(const edge of [-1,1]){box(site,x,.4,z+edge*sd/2,sw+.18,.22,.14,timber);box(site,x+edge*sw/2,.4,z,.14,.22,sd,timber);}
    for(let x0=-sw/2+.4;x0<sw/2;x0+=.8)box(site,x+x0,.36,z,.035,.035,sd-.2,steel);
  };
  box(site,0,.14,0,w+.65,.06,d+.6,0x9d8d74);
  // Distinct footprints, voids and structural systems, not recolored copies.
  if(plan.form==='courtyard'){
    slab(-w*.36,0,w*.28,d);slab(w*.36,0,w*.28,d);slab(0,-d*.32,w*.44,d*.36);
    box(site,0,.18,d*.10,w*.40,.04,d*.52,0x8d8068);
  }else if(plan.form==='twin-wing'){
    slab(-w*.27,-d*.12,w*.46,d*.76);slab(w*.27,d*.12,w*.46,d*.76);slab(0,0,w*.16,d*.32);
  }else if(plan.form==='townhouse'){
    slab(0,0,w*.74,d);slab(side*w*.43,d*.28,w*.14,d*.44);
  }else if(plan.form==='pavilion'){
    slab(0,0,w*.60,d);slab(0,0,w,d*.60);
  }else slab(0,0,w,d);

  if(chapter.joined===0){
    // Unstaffed site preparation: large silhouettes visible from the row overview.
    const staging=new T.Group();staging.name=`site-preparation-${plan.staging}`;site.add(staging);
    const part=(x,y,z,sw,sh,sd,color=plan.accent)=>box(staging,x,y,z,sw,sh,sd,color);
    if(plan.staging==='excavator'){
      for(const x of [-.68,.68])part(x,.52,0,.43,.45,2.25,0x353b40);
      part(0,.85,0,1.65,.45,1.7);part(-.35,1.53,-.25,.82,1.05,1.05);
      part(-.35,1.63,.29,.62,.65,.04,0x375361);part(-.35,2.1,-.25,.98,.12,1.2);
      beam([.55,1.2,.3],[.6,2.6,1.3],.28,plan.accent);beam([.6,2.6,1.3],[.6,.73,2.3],.23,plan.accent);
      part(.6,.52,2.3,.82,.4,.65,0x586068);
    }else if(plan.staging==='gantry'){
      for(const x of [-2.6,2.6]){part(x,1.85,0,.22,3.0,.24);part(x,.5,0,1.25,.22,1.6,steel);}
      part(0,3.35,0,5.6,.32,.36);part(side,3.05,0,.7,.36,.62,steel);
      part(side,2.3,0,.045,1.3,.045,steel);part(side,1.6,0,1.4,.16,.62,timber);
      for(let i=0;i<4;i++)part(-side*1.4,.55+i*.20,-1.15,1.7,.17,.6,timber);
    }else if(plan.staging==='pipe-yard'){
      for(const x of [-2,0,2]){
        const ring=new T.Mesh(new T.TorusGeometry(.62,.19,8,16),new T.MeshStandardMaterial({color:concrete,roughness:.95}));
        ring.position.set(x,1.13,0);staging.add(ring);
        part(x,.47,0,1.6,.17,1.3,timber);
      }
      for(let i=0;i<3;i++)part(-1+i,.6,1.7,.7,.4,.7,masonry);
    }else if(plan.staging==='site-office'){
      part(-side*1.4,1.2,-.6,2.5,1.75,1.8);part(-side*1.4,2.13,-.6,2.75,.14,2.05,0xe4ddcb);
      part(-side*1.4,1.45,.32,1.5,.64,.06,0x324e62);
      part(side*1.6,.9,.8,1.8,.13,1.15,timber);
      for(const x of [side*1.6-.7,side*1.6+.7])part(x,.62,.8,.1,.55,.8,steel);
      part(side*1.6,.98,.8,1.5,.025,.95,0x6887a0);
    }else{
      for(let i=0;i<3;i++){
        const x=-2.4+i*2.4;
        part(x,.75,0,1.7,.8,1.8,timber);part(x,.77,0,1.4,.82,1.5,0x62584a);
        for(const dx of [-.8,.8])part(x+dx,1.35,0,.07,1.2,1.7,steel);
      }
    }
    // Survey stakes and bright strings outline a different inset on each plan.
    for(const x of [-w*.42,w*.42]){
      for(const z of [-d*.38,d*.38])box(site,x,.73,z,.06,.7,.06,plan.accent);
      box(site,x,1.02,0,.025,.025,d*.76,0xf3cc68);
    }
  }
  // Common edge work stations remain accessible around every footprint.
  for(const face of [-1,1])box(site,0,.4,face*d/2,w,.34,.24,concrete);
  const frameTop=chapter.joined?1.55+p*(h+1.1):.75;
  for(let bay=0;bay<=plan.bays;bay++){
    const x=-w/2+bay*w/plan.bays;
    for(const face of [-1,1]){
      beam([x,.5,face*d/2],[x,frameTop,face*d/2],.16);
      if(chapter.joined>=4)beam([x,frameTop,face*d/2],[x,frameTop+.65+(plan.form==='longhouse'?.6:0),0],.13);
    }
  }
  if(chapter.joined){
    for(const face of [-1,1])box(site,0,frameTop,face*d/2,w+.2,.17,.18,timber);
    const divider=(plan.split-.5)*w;
    if(plan.form==='twin-wing'){
      beam([divider,.4,-d/2],[divider,frameTop+1.2,-d/2],.22);
      beam([divider,frameTop+1.2,-d/2],[side*w*.35,frameTop+.25,d/2],.2);
    }else if(plan.form==='courtyard'){
      for(const x of [-w*.22,w*.22]){beam([x,.4,-d*.1],[x,frameTop,-d*.1]);box(site,x,frameTop,d*.15,.18,.18,d*.5,timber);}
    }else if(plan.form==='townhouse'){
      for(const x of [-w*.30,w*.30]){beam([x,.4,0],[x,frameTop+1.6,0],.22);beam([x,frameTop+1.6,0],[x,frameTop,d/2]);}
    }else if(plan.form==='pavilion'){
      for(const face of [-1,1])beam([face*w/2,frameTop,0],[0,frameTop+1.4,0],.22);
    }else box(site,0,frameTop+.75,0,w+.15,.19,.22,timber);
  }
  // Onboarding, not elapsed animation time, controls permanent building progress.
  for(let i=0;i<chapter.joined;i++){
    const station=constructionStation(plan,i);
    if(station.role==='masonry'){
      for(let row=0;row<2+Math.floor(p*4);row++)for(let b=0;b<2;b++)box(site,station.x+(b-.5)*.33+(row%2)*.07,.56+row*.24,station.wallZ,.31,.21,.22,masonry);
    }else{
      box(site,station.x,1.02,station.wallZ,.14,1.16,.16,timber);
      if(i<Math.floor(chapter.joined*.48))box(site,station.x,1.22,station.wallZ-station.side*.12,.76,1.6,.055,0xbca077);
    }
    // Each worker has their own supply stack and a clear path to the wall.
    for(let layer=0;layer<3;layer++)box(site,station.x,.22+layer*.12,station.supplyZ+station.side*.43,
      station.role==='masonry'?.6:.82,.10,.27,station.role==='masonry'?masonry:timber);
    if(station.role==='saw'){
      box(site,station.x,.97,station.wallZ+station.side*.17,.85,.08,.32,timber);
      for(const dx of [-.30,.30])beam([station.x+dx,.13,station.wallZ+station.side*.17],[station.x+dx,.94,station.wallZ+station.side*.17],.07,steel);
    }
  }
  // Side yard: asymmetrical scaffold, hoist, ladder and chapter-specific stock racks.
  const sx=side*(w/2+.65),sz=plan.scaffoldZ,platform=plan.scaffoldHeight+p*1.45;
  for(const dx of [-.34,.34])for(const dz of [-1.5,1.5])beam([sx+dx,.13,sz+dz],[sx+dx,platform+1.05,sz+dz],.055,steel);
  box(site,sx,platform,sz,.85,.10,3.25,0x978a73);
  for(const dx of [-.34,.34]){beam([sx+dx,.25,sz-1.5],[sx+dx,platform+1.0,sz+1.5],.045,steel);beam([sx+dx,platform+1.0,sz-1.5],[sx+dx,.25,sz+1.5],.045,steel);}
  for(const dx of [-.22,.22])beam([sx+dx,.13,sz+2],[sx+dx,platform+.1,sz+1.35],.05,steel);
  for(let i=0;i<6;i++)beam([sx-.22,.25+i*platform/6,sz+1.93-i*.10],[sx+.22,.25+i*platform/6,sz+1.93-i*.10],.035,steel);
  const yard=-side*(w/2+.65);
  for(let i=0;i<3;i++){box(site,yard,.25+i*.18,-.9,.70,.15,2.2-i*.2,timber);}
  if(plan.form==='twin-wing'||plan.form==='townhouse'){
    beam([yard,.15,1],[yard,3.8,1],.13,steel);beam([yard,3.8,1],[yard,3.8,-.5],.12,steel);beam([yard,3.8,-.5],[yard,1.8,-.5],.025,0x333839);
    box(site,yard,1.65,-.5,.4,.3,.4,0xd19b44);
  }else{
    for(const z of [-.4,.4])cylinder(site,yard,.57,z,.32,.82,0x50636d);
  }
  for(const x of [-5.8,5.8]){
    cylinder(site,x,.47,6.55,.12,.7,0xe39443);cylinder(site,x,.57,6.55,.13,.12,0xeee5ce);
    box(site,x,.16,6.55,.45,.08,.45,steel);
  }
  for(const x of [-2.4,2.4])box(site,x,1.6,7.25,.1,3,.1,steel);
  const banner=createChapterBanner(T,chapter,4.8,artworkOptions);banner.position.set(0,1.66,7.35);site.add(banner);pickables.push(banner);
  box(site,0,2.8,7.25,5.1,.1,.12,steel);
  sign(site,`UNDER CONSTRUCTION · ${chapter.joined} / 15`,0,3.12,7.35,4.8,.42,'#d6b26d','#2c3038');
  for(const face of [-1,1]){
    const schoolBanner=createSchoolBanner(T,chapter,artworkOptions);schoolBanner.rotation.y=face*Math.PI/2;
    schoolBanner.position.set(face*6.25,2.55,-.5);site.add(schoolBanner);pickables.push(schoolBanner);
    for(const z of [-2.25,1.25])cylinder(site,face*6.25,2.45,z,.055,4.9,steel);
  }
  const hit=box(site,0,2.8,0,12.5,6,12,new T.MeshBasicMaterial({visible:false}));hit.userData.chapter=chapter.id;pickables.push(hit);
  return site;
}

// Five instance batches for the entire crew, irrespective of member count.
export function createConstructionEquipment(T,members){
  const workers=members.filter(m=>m.action==='build'),root=new T.Group();root.name='construction-equipment';
  const slots=new Map(workers.map((m,i)=>[m,i])),meshes={};
  if(!workers.length)return {root,meshes,update(){},finish(){}};
  const box=new T.BoxGeometry(1,1,1),helmet=new T.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI/2);
  const helmetBrim=new T.CylinderGeometry(1,1,.09,16);
  const geometries={helmet,brim:helmetBrim,handle:box,head:box,load:box};
  for(const [name,geometry] of Object.entries(geometries)){
    const material=new T.MeshStandardMaterial({color:0xffffff,roughness:name==='head'?.4:.8,metalness:name==='head'?.55:0});
    const mesh=new T.InstancedMesh(geometry,material,workers.length);mesh.name=`construction-${name}`;mesh.frustumCulled=false;root.add(mesh);meshes[name]=mesh;
    workers.forEach((m,i)=>mesh.setColorAt(i,new T.Color(name==='helmet'||name==='brim'?m.construction.helmet:name==='load'?(m.construction.role==='masonry'?0xb98768:0xcaa16e):name==='head'?0x9fa9ac:0x785234)));
  }
  const dummy=new T.Object3D();
  function update(member,state,rig,transform){
    const i=slots.get(member);if(i===undefined)return;
    const h=member.height,build=state.construction;
    const part=(name,point,size,pitch=0)=>{dummy.position.set(...transform(point));dummy.rotation.set(pitch,state.rotation,0,'YXZ');dummy.scale.set(...size.map(n=>n*h));dummy.updateMatrix();meshes[name].setMatrixAt(i,dummy.matrix);};
    part('helmet',[rig.head[0],rig.head[1]+.07,rig.head[2]],[.165,.19,.175]);
    part('brim',[rig.head[0],rig.head[1]+.075,rig.head[2]+.015],[.20,.13,.225]);
    const grip=rig.arms[1].hand,tool=build.mode==='work'?build.effort:0;
    const role=build.role,pitch=role==='hammer'?-.25-build.stroke*.8:Math.PI/2;
    part('handle',grip,[.035,.28*tool,.04],pitch);
    const head=[grip[0],grip[1]+Math.cos(pitch)*.14,grip[2]+Math.sin(pitch)*.14];
    part('head',head,role==='hammer'?[.17,.08*tool,.07]:role==='drill'?[.09,.14*tool,.18]:role==='saw'?[.025,.12*tool,.30]:[.16,.03*tool,.18],role==='hammer'?pitch:0);
    const hands=rig.arms.map(a=>a.hand),load=hands[0].map((n,k)=>(n+hands[1][k])/2);load[1]+=.025;
    const material=Math.max(build.carry,build.delivered);
    part('load',load,role==='masonry'?[.40,.20*material,.24]:[.84,.11*material,.20]);
    if(build.delivered){
      const job=member.construction,a=member.lot.rotation,z=job.wallZ+job.side*.18;
      const destination=new T.Vector3(member.lot.x+job.x*Math.cos(a)+z*Math.sin(a),role==='saw'?1.04:role==='masonry'?.99:1.28,member.lot.z-job.x*Math.sin(a)+z*Math.cos(a));
      dummy.position.lerp(destination,build.delivered);dummy.rotation.set(0,a,0);dummy.updateMatrix();meshes.load.setMatrixAt(i,dummy.matrix);
    }
  }
  return {root,meshes,update,finish(){Object.values(meshes).forEach(m=>{m.instanceMatrix.needsUpdate=true;});}};
}
