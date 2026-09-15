// Reward state is derived from the same public roster used for qualification.
// No chapter-specific catalog, remote images, additional people or saved flags.
export function onboardingGoal(chapter){return Number.isSafeInteger(chapter?.active)&&chapter.active>0?Math.ceil(chapter.active*.8):null;}
export function backyardUnlocked(chapter){const goal=onboardingGoal(chapter);return goal!==null&&Number.isSafeInteger(chapter.joined)&&chapter.joined>=goal;}
export function hasChapterHouse(chapter){return Boolean(chapter&&(chapter.joined>=15||backyardUnlocked(chapter)));}
export function backyardStatus(chapter){
  const goal=onboardingGoal(chapter),unlocked=backyardUnlocked(chapter);
  return {goal,unlocked,message:goal===null?'Active roster needed to set the pool goal.':unlocked?'Backyard pool unlocked.':`${Math.max(0,goal-chapter.joined)} more to unlock your backyard pool.`};
}
export const BACKYARD=Object.freeze({minX:-7.5,maxX:7.5,minZ:-17,maxZ:-5.6,deckY:.82,
  pool:Object.freeze({x:-1.5,z:-10.45,width:7.4,depth:4.4,waterY:.69})});

export function createBackyards(T){
  const yards=[],waters=[],chapterIds=new Set(),materials=new Map(),uniforms={time:{value:0},night:{value:0}};
  let boxGeometry,cylinderGeometry,leafGeometry,waterGeometry,waterMaterial,canopyGeometry,railGeometry;
  const material=(color,kind='stone')=>{
    const key=`${kind}:${color}`;
    if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:kind==='metal'?.24:kind==='fabric'?.94:.82,metalness:kind==='metal'?.72:0}));
    return materials.get(key);
  };
  function mesh(parent,geometry,x,y,z,sx,sy,sz,color,kind){
    const m=new T.Mesh(geometry,typeof color==='object'?color:material(color,kind));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const box=(p,x,y,z,w,h,d,c,k)=>mesh(p,boxGeometry,x,y,z,w,h,d,c,k);
  const pole=(p,x,y,z,r,h,c,k)=>mesh(p,cylinderGeometry,x,y,z,r,h,r,c,k);
  function group(parent,x,y,z,rotation=0){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=rotation;parent.add(g);return g;}
  function init(){
    if(boxGeometry)return;
    boxGeometry=new T.BoxGeometry(1,1,1);cylinderGeometry=new T.CylinderGeometry(1,1,1,12);
    leafGeometry=new T.IcosahedronGeometry(1,1);
    canopyGeometry=new T.ConeGeometry(1.65,.62,12,1,true);
    railGeometry=new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0,.12,.48),new T.Vector3(0,.85,.48),new T.Vector3(0,1.1,.2),new T.Vector3(0,.85,-.3),new T.Vector3(0,-.3,-.5)]),16,.045,6,false);
    waterGeometry=new T.PlaneGeometry(BACKYARD.pool.width,BACKYARD.pool.depth,1,1);waterGeometry.rotateX(-Math.PI/2);
    waterMaterial=new T.MeshPhysicalMaterial({color:0x2596ad,roughness:.18,metalness:.12,clearcoat:1,clearcoatRoughness:.12,transparent:true,opacity:.82,depthWrite:false});
    waterMaterial.onBeforeCompile=shader=>{
      shader.uniforms.poolTime=uniforms.time;shader.uniforms.poolNight=uniforms.night;
      shader.vertexShader='varying vec2 poolCoord;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npoolCoord=position.xz;');
      shader.fragmentShader='uniform float poolTime;\nuniform float poolNight;\nvarying vec2 poolCoord;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
        float waveA=sin(poolCoord.x*5.2+poolCoord.y*3.6+poolTime*.8);
        float waveB=cos(poolCoord.x*3.7-poolCoord.y*6.4-poolTime*.65);
        normal=normalize(normal+vec3(waveA*.075,waveB*.055,waveA*waveB*.035));`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float lattice=pow(max(0.0,sin(poolCoord.x*10.0+sin(poolCoord.y*4.0+poolTime*.5))*cos(poolCoord.y*9.0+sin(poolCoord.x*3.0-poolTime*.4))),7.0);
        float tileX=step(.93,fract((poolCoord.x+3.7)*4.0));
        float tileZ=step(.93,fract((poolCoord.y+2.2)*4.0));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.38,.45),max(tileX,tileZ)*.12);
        diffuseColor.rgb+=vec3(.22,.38,.31)*lattice*(1.0-poolNight*.65);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float poolGlow=exp(-length(poolCoord-vec2(-2.4,-1.8))*1.1)+exp(-length(poolCoord-vec2(2.4,-1.8))*1.1);
        totalEmissiveRadiance+=vec3(.015,.23,.29)*poolNight*(.3+poolGlow);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        float fresnel=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.0);
        outgoingLight=mix(outgoingLight,mix(vec3(.56,.72,.80),vec3(.13,.20,.32),poolNight),fresnel*.48);
        #include <opaque_fragment>`);
    };
    waterMaterial.customProgramCacheKey=()=> 'backyard-water-v1';
  }
  function fence(parent,x,z,width,rotation=0){
    const g=group(parent,x,0,z,rotation),iron=0x303b39;
    for(const y of [.4,1.37])box(g,0,y,0,width,.065,.065,iron,'metal');
    for(let dx=-width/2;dx<=width/2+.01;dx+=.38)pole(g,dx,.87,0,.025,1.25,iron,'metal');
    for(const dx of [-width/2,width/2]){pole(g,dx,.88,0,.065,1.55,iron,'metal');box(g,dx,1.67,0,.18,.08,.18,iron,'metal');}
  }
  function lounger(parent,x,z,color){
    const g=group(parent,x,BACKYARD.deckY,z),frame=0x8b6a47;
    box(g,0,.28,.22,1.1,.13,1.35,frame);box(g,0,.4,.2,.97,.16,1.28,color,'fabric');
    const back=box(g,0,.72,-.69,1.05,.12,1,color,'fabric');back.rotation.x=.53;
    for(const dx of [-.5,.5])for(const dz of [-.55,.66])box(g,dx,.14,dz,.1,.28,.1,frame);
    for(const dx of [-.38,-.19,0,.19,.38])box(g,dx,.491,.2,.016,.008,1.18,0xd5cdbb,'fabric');
    const pillow=box(g,0,.97,-.86,.72,.18,.3,0xf2e9d7,'fabric');pillow.rotation.x=.53;
    box(g,0,.505,.52,.8,.02,.36,0x849aa0,'fabric');
  }
  function umbrella(parent,x,z){
    const g=group(parent,x,BACKYARD.deckY,z);
    box(g,0,.08,0,.65,.16,.65,0x686962);pole(g,0,1.5,0,.045,2.9,0x887359,'metal');
    const fabric=material(0xe3d8bd,'fabric');fabric.side=T.DoubleSide;
    const canopy=mesh(g,canopyGeometry,0,2.95,0,1,1,1,fabric);canopy.castShadow=true;
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2,dx=Math.cos(a)*1.65,dz=Math.sin(a)*1.65;
      const rib=new T.Mesh(cylinderGeometry,material(0xbbae92));rib.position.set(dx/2,2.95,dz/2);
      rib.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(dx,-.62,dz).normalize());rib.scale.set(.015,Math.hypot(1.65,.62),.015);g.add(rib);
    }
    pole(g,0,3.32,0,.045,.13,0x887359);
  }
  function planter(parent,x,z,w=1.4){
    box(parent,x,.38,z,w,.65,.85,0x9e9a88);box(parent,x,.72,z,w-.14,.06,.7,0x55483b);
    for(let i=0;i<5;i++){const dx=(i/4-.5)*(w-.25);mesh(parent,leafGeometry,x+dx,1+.09*(i%2),z,.35,.5,.35,[0x566a40,0x64794d,0x738353][i%3]);}
  }
  function add(parent,chapter){
    if(!backyardUnlocked(chapter))return null;init();
    const root=group(parent,0,0,0);root.name=`chapter-backyard-${chapter.id}`;root.userData={chapter:chapter.id,goal:onboardingGoal(chapter),bounds:BACKYARD};
    const {pool,deckY}=BACKYARD,stone=0xc8c3b3,grout=0xa49f90;
    // Raised terrace: every floor stays above the world's continuous terrain,
    // with a genuine opening between four deck slabs around the recessed basin.
    box(root,0,.08,-11.3,15,.14,11.4,0x68764e);
    const x0=-6.4,x1=6.4,z0=-15.7,z1=-6.55,px0=pool.x-pool.width/2,px1=pool.x+pool.width/2,pz0=pool.z-pool.depth/2,pz1=pool.z+pool.depth/2;
    const slab=(a,b,c,d)=>box(root,(a+b)/2,deckY/2,(c+d)/2,b-a,deckY,d-c,stone);
    slab(x0,px0,z0,z1);slab(px1,x1,z0,z1);slab(px0,px1,z0,pz0);slab(px0,px1,pz1,z1);
    // Fine paver joints, clipped around the pool opening.
    for(let x=x0+.8;x<x1;x+=.8){
      if(x>px0&&x<px1){box(root,x,deckY+.003,(z0+pz0)/2,.018,.009,pz0-z0,grout);box(root,x,deckY+.003,(pz1+z1)/2,.018,.009,z1-pz1,grout);}
      else box(root,x,deckY+.003,(z0+z1)/2,.018,.009,z1-z0,grout);
    }
    for(let z=z0+.8;z<z1;z+=.8){
      if(z>pz0&&z<pz1){box(root,(x0+px0)/2,deckY+.004,z,px0-x0,.009,.018,grout);box(root,(px1+x1)/2,deckY+.004,z,x1-px1,.009,.018,grout);}
      else box(root,0,deckY+.004,z,x1-x0,.009,.018,grout);
    }
    const tile=0x72bbc5;
    box(root,pool.x,.13,pool.z,pool.width,.08,pool.depth,0x408eab);
    for(const x of [px0,px1]){box(root,x,.47,pool.z,.12,.61,pool.depth,tile);box(root,x,deckY+.055,pool.z,.36,.11,pool.depth+.36,0xe9e2cd);}
    for(const z of [pz0,pz1]){box(root,pool.x,.47,z,pool.width,.61,.12,tile);box(root,pool.x,deckY+.055,z,pool.width-.36,.11,.36,0xe9e2cd);}
    // Dark blue waterline mosaics and sunken entry treads remain visible.
    for(const z of [pz0+.065,pz1-.065])box(root,pool.x,.66,z,pool.width-.12,.15,.018,0x287185);
    for(let i=0;i<3;i++)box(root,px1-.28-i*.38,.58-i*.15,pool.z,.42,.12,pool.depth-.2,0xa4d2d2);
    const water=new T.Mesh(waterGeometry,waterMaterial);water.position.set(pool.x,pool.waterY,pool.z);water.name=`backyard-water-${chapter.id}`;water.userData.chapter=chapter.id;water.renderOrder=2;water.receiveShadow=true;root.add(water);waters.push(water);
    // Brushed-steel ladder curves over the coping; submerged rungs below it.
    for(const x of [pool.x-2.7,pool.x-2.12])mesh(root,railGeometry,x,deckY,pz1+.03,1,1,1,0xb6c3c5,'metal');
    for(const y of [.28,.46,.64])box(root,pool.x-2.41,y,pz1-.43,.58,.06,.08,0xb6c3c5,'metal');
    for(const x of [-.6,.6])for(let step=0;step<4;step++)box(root,x,.1+step*.105,-5.75-step*.25,1.2,.2+step*.21,.34,stone);
    // A side path connects the front lawn to the pool terrace.
    box(root,6.9,.16,-.4,1,.13,10.4,0xb8b5a6);
    lounger(root,3.3,-10.2,0xeee6d2);lounger(root,4.85,-10.2,0xeee6d2);
    umbrella(root,4.25,-13.2);
    pole(root,4.05,deckY+.5,-8.45,.42,.09,0x92775b);pole(root,4.05,deckY+.25,-8.45,.065,.5,0x3c4341,'metal');
    pole(root,3.93,deckY+.61,-8.42,.065,.17,0xe5b377);
    // Rear seating and low timber bench face toward the water.
    box(root,-1.5,deckY+.4,-14.65,4,.15,.65,0x977653);
    for(const x of [-3.15,.15])box(root,x,deckY+.2,-14.65,.13,.4,.53,0x394744,'metal');
    box(root,-1.5,deckY+.78,-14.95,4,.58,.12,0x977653);
    fence(root,0,-16.75,14.5);fence(root,-7.25,-11.3,10.9,Math.PI/2);fence(root,7.25,-11.3,10.9,Math.PI/2);
    // Front fence leaves a gate opening aligned with the path on the right.
    fence(root,-4.4,-5.85,5.7);fence(root,3.7,-5.85,4.3);fence(root,6.6,-5.85,1.3);
    box(root,3.3,.16,-5.3,6.6,.13,.6,0xb8b5a6);
    for(const x of [-5.5,5.5])planter(root,x,-16.1,2);
    planter(root,-6.9,-8.3,.65);planter(root,-6.9,-13,.65);
    const yard={chapter:chapter.id,root,water};yards.push(yard);chapterIds.add(chapter.id);return yard;
  }
  return {yards,waters,uniforms,add,has:id=>chapterIds.has(id),
    animate(time){uniforms.time.value=time;},setNight(enabled){uniforms.night.value=Number(Boolean(enabled));},
    contains(id,x,z){return chapterIds.has(id)&&x>BACKYARD.minX-.35&&x<BACKYARD.maxX+.35&&z>BACKYARD.minZ-.35&&z<BACKYARD.maxZ+.35;}
  };
}
