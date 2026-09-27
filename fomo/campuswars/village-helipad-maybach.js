import {createMaybachWheels} from './village-maybach-wheels.js?v=1';
// A compact, articulated long-wheelbase sedan. +Z is the nose; the wheels
// remain 0.39 units in radius so the arrival controller can roll them exactly.
export function createMaybach(kit){
  const {T,root,own,mat,group,mesh,box,oval,round,bar,label,cylinder,silver,rubber,white}=kit;
  const paint=mat(0x101921,.55,.18),champagne=mat(0xa4a6a2,.48,.22);
  const leather=mat(0xcbb99d,.02,.83),stitch=mat(0xa39076,.02,.86);
  const dark=mat(0x0b1014,.18,.53),wood=mat(0x493629,.2,.35),red=mat(0x991d2c,.25,.25);
  const glazing=own(new T.MeshStandardMaterial({color:0x13252f,metalness:.30,roughness:.10,transparent:true,opacity:.90,depthWrite:false,side:T.DoubleSide,envMap:paint.envMap,envMapIntensity:.85}));
  const runningLight=own(new T.MeshStandardMaterial({color:0xdceaf1,emissive:0xdceaf1,emissiveIntensity:.35,roughness:.22}));runningLight.userData.lamp=true;runningLight.userData.dayGlow=.35;
  const car=group(root,'Mercedes-Maybach',-12,.22,10);car.rotation.y=Math.PI;
  const doors=[];

  // Every custom panel has normals and UVs for the caller's material bake.
  function panel(parent,material,vertices,indices,name){
    const geometry=own(new T.BufferGeometry());
    geometry.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap((p)=>[p[2],p[1]]),2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const object=mesh(parent,geometry,material,0,0,0);object.name=name;return object;
  }
  function quad(parent,material,a,b,c,d,name){return panel(parent,material,[a,b,c,d],[0,1,2,0,2,3],name);}
  // Lofted shoulders and roof have rounded cross-sections, not cuboid bodies.
  function crown(material,stations,name,roof=false){
    const profile=roof?[[-1,-.018],[-.985,-.006],[-.93,.008],[-.72,.025],[0,.043],[.72,.025],[.93,.008],[.985,-.006],[1,-.018]]:
      [[-1,-.055],[-.985,-.012],[-.93,.022],[-.72,.045],[0,.055],[.72,.045],[.93,.022],[.985,-.012],[1,-.055]];
    const path=new T.CatmullRomCurve3(stations.map(([z,w,h])=>new T.Vector3(w,h,z)),false,'centripetal');
    const smooth=path.getPoints(roof?36:40),vertices=[],indices=[];
    for(const point of smooth)for(const [x,y] of profile)vertices.push([x*point.x,point.y+y,point.z]);
    for(let s=0;s<smooth.length-1;s++)for(let p=0;p<profile.length-1;p++){
      const a=s*profile.length+p,b=a+profile.length;indices.push(a,b,a+1,b,b+1,a+1);
    }
    const result=panel(car,material,vertices,indices,name);
    if(!roof){for(const side of [-1,1]){const edge=[],faces=[];smooth.forEach((p,i)=>{edge.push([side*p.x,p.y-.055,p.z],[side*(1.088*Math.sqrt(Math.max(0,1-Math.min(.999,Math.max(0,(Math.abs(p.z)-2.40)/.55))**2))-.028),1.04-Math.max(0,(Math.abs(p.z)-2.40)/.55)*.022,p.z]);if(i<smooth.length-1){const a=i*2;faces.push(...(side>0?[a,a+2,a+1,a+1,a+2,a+3]:[a,a+1,a+2,a+1,a+3,a+2]));}});panel(car,paint,edge,faces,'Sealed sculpted shoulder');}}
    return result;
  }
  crown(champagne,[[1.21,1.065,1.045],[1.5,1.095,1.065],[2.1,1.09,1.065],[2.42,1.075,1.045],[2.62,.985,1.025],[2.79,.72,.994],[2.88,.38,.98],[2.925,.035,.96]],'Sculpted long bonnet');
  crown(champagne,[[-2.91,.1,.92],[-2.85,.51,.93],[-2.69,.87,.95],[-2.46,1.055,1.005],[-1.98,1.075,1.015],[-1.49,1.055,1.035]],'Sculpted rear deck');
  crown(champagne,[[-1.215,.765,1.555],[-1.10,.82,1.60],[-.88,.855,1.628],[-.45,.865,1.636],[.13,.86,1.610],[.37,.837,1.588],[.54,.795,1.560]],'Arched champagne roof',true);
  box(car,dark,0,.325,0,1.78,.13,5.12);
  box(car,leather,0,.51,-.08,1.81,.14,2.68);
  for(const side of [-1,1]){
    round(car,paint,side*1.015,.36,0,.15,.13,2.71);
    bar(car,silver,[side*1.085,.406,-1.35],[side*1.085,.406,1.35],.014);
    // Lower contours are clipped to the wheel arch, leaving the tires exposed.
    for(const [from,to,wheelZ] of [[-2.81,-1.35,-1.83],[1.35,2.81,1.83]]){
      const vertices=[],indices=[],steps=32;
      for(let j=0;j<=steps;j++){
        const z=from+(to-from)*j/steps,dz=z-wheelZ;
        const arch=Math.abs(dz)<.465?.39+Math.sqrt(.465**2-dz**2):.38;
        const end=Math.max(0,(Math.abs(z)-2.40)/.55),width=1.088*Math.sqrt(1-end*end),top=1.04-end*.022;
        vertices.push([side*(width-.014),arch,z],[side*width,Math.max(arch+.015,.82),z],[side*(width-.028),top,z]);
        if(j<steps)for(let k=0;k<2;k++){const a=j*3+k,b=a+3;indices.push(...(side<0?[a,b,a+1,b,b+1,a+1]:[a,a+1,b,b,a+1,b+1]));}
      }
      panel(car,paint,vertices,indices,'Pressed fender with open wheel arch');
      // A thin rolled edge follows the arch instead of a solid wheel cover.
      for(let j=0;j<20;j++){
        const a=j*Math.PI/20,b=(j+1)*Math.PI/20;
        bar(car,paint,[side*1.092,.39+Math.sin(a)*.47,wheelZ+Math.cos(a)*.47],[side*1.092,.39+Math.sin(b)*.47,wheelZ+Math.cos(b)*.47],.018);
      }
    }
    for(const z of [-1.83,1.83]){
      const liner=[],indices=[];
      for(let i=0;i<=32;i++){const a=i*Math.PI/32;for(const x of [.83,1.095])liner.push([side*x,.39+Math.sin(a)*.445,z+Math.cos(a)*.445]);if(i<32){const v=i*2;indices.push(...(side>0?[v,v+2,v+1,v+1,v+2,v+3]:[v,v+1,v+2,v+1,v+3,v+2]));}}
      panel(car,dark,liner,indices,'Dark inner wheel housing');
    }
    for(const z of [-1.335,-.040,1.344])box(car,paint,side*1.059,.739,z,.056,.60,.029);
    // Continuous beltline and the rear quarter-light distinguish a long sedan.
    bar(car,silver,[side*1.054,1.055,-2.39],[side*1.065,1.082,-1.37],.014);
    bar(car,silver,[side*1.064,1.082,1.34],[side*.998,1.01,2.58],.014);
    const q0=[side*1.025,1.09,-1.50],q1=[side*.84,1.535,-1.15],q2=[side*.875,1.55,-.99],q3=[side*1.035,1.09,-1.31];
    quad(car,glazing,q0,q1,q2,q3,'Rear quarter glass');
    for(const [a,b] of [[q0,q1],[q1,q2],[q2,q3],[q3,q0]])bar(car,silver,a,b,.016);
    bar(car,paint,[side*1.04,1.07,-.04],[side*.875,1.595,-.04],.036);
    const pillarVertices=[[side*1.04,1.07,-1.63],[side*.80,1.552,-1.22],[side*.854,1.61,-.96],[side*1.04,1.07,-1.28]];
    panel(car,champagne,pillarVertices,side>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],'Sculpted C pillar');
    // Body-coloured roof rail follows the arched window opening.
    const railPoints=[[side*1.045,1.068,1.34],[side*.81,1.56,.54],[side*.86,1.61,.11],[side*.875,1.622,-.65],[side*.82,1.56,-1.18],[side*1.04,1.07,-1.62]];
    const railPath=new T.CatmullRomCurve3(railPoints.map(point=>new T.Vector3(...point)));
    mesh(car,own(new T.TubeGeometry(railPath,40,.022,6,false)),champagne,0,0,0);
    // Small chrome Maybach monogram mounted on the C pillar.
    bar(car,silver,[side*.951,1.29,-1.405],[side*.903,1.41,-1.31],.009);
    bar(car,silver,[side*.903,1.41,-1.31],[side*.961,1.29,-1.27],.009);
  }

  // The glazing is sloped into an actual cabin; cream seats remain visible.
  const wind=[[-.99,1.105,1.285],[.99,1.105,1.285],[.795,1.56,.54],[-.795,1.56,.54]];
  const rear=[[-1.025,1.09,-1.50],[-.79,1.54,-1.21],[.79,1.54,-1.21],[1.025,1.09,-1.50]];
  quad(car,glazing,...wind,'Raked windscreen');quad(car,glazing,...rear,'Rear windscreen');
  for(const points of [wind,rear])for(let i=0;i<4;i++)bar(car,dark,points[i],points[(i+1)%4],.016);
  for(const side of [-1,1])bar(car,champagne,[side*1.005,1.095,1.285],[side*.815,1.562,.54],.025);
  for(const x of [-.38,.38])bar(car,dark,[x-.22,1.13,1.247],[x+.2,1.155,1.21],.013);
  round(car,dark,0,.98,1.055,1.91,.2,.36);
  round(car,wood,0,1.044,1.006,1.80,.034,.27);
  for(const x of [-.49,.49])for(const z of [-.83,.68]){
    round(car,leather,x,.70,z,.72,.19,.63);
    const back=round(car,leather,x,.97,z-.29,.71,.58,.20);back.rotation.x=-.13;
    oval(car,leather,x,1.27,z-.34,.172,.096,.085);
    for(const dx of [-.21,0,.21])bar(car,stitch,[x+dx,.752,z-.2],[x+dx,.758,z+.2],.005);
  }
  round(car,leather,0,.76,-.48,.24,.30,1.6);
  round(car,wood,0,.925,.16,.24,.038,.91);
  for(const z of [-.11,.12]){
    const cup=mesh(car,own(new T.TorusGeometry(.048,.008,5,16)),silver,0,.95,z);cup.rotation.x=Math.PI/2;
    mesh(car,cylinder,dark,0,.945,z,.041,.008,.041);
  }
  const steering=mesh(car,own(new T.TorusGeometry(.16,.021,7,24)),dark,-.49,1.08,.86);steering.rotation.x=-.45;
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;bar(car,silver,[-.49,1.08,.86],[-.49+Math.sin(a)*.135,1.08+Math.cos(a)*.125,.86-Math.cos(a)*.06],.012);}

  for(const side of [-1,1])for(const isFront of [false,true]){
    const hingeZ=isFront?1.325:-.055,length=isFront?1.35:1.275;
    const door=group(car,isFront?'Maybach front passenger door':'Maybach rear passenger door',side*1.047,0,hingeZ);
    // Door inner/outer skins and the window travel as one rigid assembly.
    const skin=[],skinIndices=[],skinRows=[[.428,-.022],[.51,.014],[.73,.049],[.91,.043],[1.033,-.006]];
    for(let j=0;j<=8;j++)for(const [y,x] of skinRows){const z=-.018-(length-.036)*j/8;skin.push([side*(x+.007*Math.sin(j*Math.PI/8)),y,z]);}
    for(let j=0;j<8;j++)for(let k=0;k<4;k++){const a=j*5+k,b=a+5;skinIndices.push(...(side<0?[a,a+1,b,b,a+1,b+1]:[a,b,a+1,b,b+1,a+1]));}
    panel(door,paint,skin,skinIndices,'Subtly convex door skin');
    for(const z of [-.018,-length+.018]){
      const end=[[side*.048,.91,z],[side*.014,.51,z],[-side*.059,.51,z],[-side*.059,.98,z],[side*-.006,1.033,z]];
      const indices=side*(z>-.03?1:-1)>0?[0,1,2,0,2,3,0,3,4]:[0,2,1,0,3,2,0,4,3];
      panel(door,paint,end,indices,'Closed door edge');
    }
    round(door,champagne,0,1.032,-length/2,.083,.064,length-.018);
    round(door,leather,-side*.047,.78,-length/2,.025,.42,length-.12);
    round(door,wood,-side*.062,.932,-length/2,.027,.043,length-.15);
    round(door,leather,-side*.101,.785,-length*.58,.13,.075,length*.56);
    box(door,silver,-side*.071,.928,-length*.29,.035,.024,.16);
    box(door,silver,side*.054,.955,-length+.22,.025,.035,.23);
    const window=isFront?
      [[0,1.089,-.055],[-side*.252,1.557,-.785],[-side*.177,1.59,-length+.053],[0,1.089,-length+.046]]:
      [[0,1.089,-.035],[-side*.177,1.59,-.035],[-side*.177,1.568,-.937],[0,1.089,-length+.049]];
    quad(door,glazing,...window,'Door glazing');
    for(let i=0;i<4;i++)bar(door,silver,window[i],window[(i+1)%4],i===3?.014:.018);
    bar(door,dark,[side*.004,.432,-length+.045],[side*.004,1.066,-length+.045],.012);
    if(isFront){
      bar(door,paint,[0,1.15,-.16],[side*.14,1.13,-.17],.034);
      oval(door,paint,side*.175,1.145,-.18,.155,.071,.195);
      oval(door,glazing,side*.179,1.148,-.347,.115,.05,.012);
      bar(door,white,[side*.28,1.15,-.09],[side*.285,1.15,-.26],.01);
    }
    doors.push({root:door,side});
  }

  // A continuous curved bumper wraps into the fenders. Rounded grille corners
  // and swept lamp lenses avoid the square fascia of an older luxury sedan.
  for(const sign of [-1,1]){
    const vertices=[],indices=[],rows=[[.398,.92,.30],[.47,1.01,.355],[.66,1.06,.36],[.83,1.075,.34],[.98,1.035,.30],[1.022,.93,.25]];
    for(let j=0;j<=32;j++){
      const angle=-Math.PI/2+j*Math.PI/32;
      for(const [y,width,depth] of rows)vertices.push([Math.sin(angle)*width,y,sign*(2.57+Math.cos(angle)*depth)]);
      if(j<32)for(let k=0;k<rows.length-1;k++){const a=j*rows.length+k,b=a+rows.length;indices.push(...(sign>0?[a,b,a+1,b,b+1,a+1]:[a,a+1,b,b,a+1,b+1]));}
    }
    panel(car,paint,vertices,indices,'Continuous wraparound bumper');
    for(let j=0;j<16;j++){
      const a=-1.15+j*2.3/16,b=-1.15+(j+1)*2.3/16;
      bar(car,silver,[Math.sin(a)*.99,.427,sign*(2.582+Math.cos(a)*.349)],[Math.sin(b)*.99,.427,sign*(2.582+Math.cos(b)*.349)],.014);
    }
  }
  // Close the upper rear fascia with one smooth skin under the boot lid.
  const rearSkin=[],rearSkinIndices=[],rearRows=[[.78,.381],[.86,.379],[.94,.353],[1.015,.30]];
  for(let i=0;i<=40;i++){const x=-1.045+i*2.09/40,curve=Math.sqrt(1-(x/1.078)**2);for(const [y,d] of rearRows)rearSkin.push([x,y,-(2.573+d*curve)]);if(i<40)for(let r=0;r<3;r++){const a=i*4+r,b=a+4;rearSkinIndices.push(a,a+1,b,b,a+1,b+1);}}
  panel(car,paint,rearSkin,rearSkinIndices,'Continuous upper rear fascia');
  const grilleShape=new T.Shape();grilleShape.moveTo(-.39,1.032);grilleShape.lineTo(.39,1.032);
  grilleShape.quadraticCurveTo(.567,1.032,.558,.90);grilleShape.lineTo(.530,.690);grilleShape.quadraticCurveTo(.517,.622,.433,.618);
  grilleShape.quadraticCurveTo(0,.600,-.433,.618);grilleShape.quadraticCurveTo(-.517,.622,-.530,.690);grilleShape.lineTo(-.558,.90);grilleShape.quadraticCurveTo(-.567,1.032,-.39,1.032);
  mesh(car,own(new T.ShapeGeometry(grilleShape,16)),dark,0,0,2.948);
  const outline=grilleShape.getPoints(70).map(p=>new T.Vector3(p.x,p.y,2.959));outline.push(outline[0].clone());
  mesh(car,own(new T.TubeGeometry(new T.CatmullRomCurve3(outline),100,.017,6,false)),silver,0,0,0);
  for(let i=-11;i<=11;i++){
    const x=i*.044,edge=Math.abs(i)/11,z=2.967-edge*edge*.006;
    bar(car,silver,[x,.631+edge**4*.016,z],[x*.986,1.011-edge**5*.037,z-.003],.0065);
  }
  round(car,dark,0,.48,2.875,1.27,.13,.061);
  for(const side of [-1,1]){
    const intake=round(car,dark,side*.805,.505,2.818,.33,.108,.045);intake.rotation.y=side*.47;
    bar(car,silver,[side*.675,.505,2.9],[side*.95,.505,2.758],.012);
    const lampDepth=(x,y)=>2.595+(.35-(y-.83)*.35)*Math.sqrt(Math.max(0,1-(x/1.077)**2));
    const lampOutline=[[.58,.87],[.82,.894],[.997,.947],[1.008,.992],[.591,.986]].map(([x,y])=>[side*x,y,lampDepth(x,y)+.012]);
    const lampIndices=side>0?[0,1,2,0,2,3,0,3,4]:[0,2,1,0,3,2,0,4,3];
    panel(car,dark,lampOutline,lampIndices,'Swept headlight housing');
    // Two tiny rectangular optics sit behind one continuous glass lens.
    for(const [x,y] of [[.747,.947],[.871,.961]]){
      const z=lampDepth(x,y)+.022;
      const optic=round(car,runningLight,side*x,y,z,.078,.034,.016);optic.rotation.y=side*.50;
    }
    panel(car,glazing,lampOutline.map(([x,y,z])=>[x,y,z+.011]),lampIndices,'Integrated headlamp lens');
    const drl=[];for(let i=0;i<=12;i++){const x=.597+i*.4/12,y=.986+i*.006/12;drl.push(new T.Vector3(side*x,y,lampDepth(x,y)+.026));}
    mesh(car,own(new T.TubeGeometry(new T.CatmullRomCurve3(drl),12,.009,5,false)),runningLight,0,0,0);
    bar(car,runningLight,[side*.591,.986,lampDepth(.591,.986)+.026],[side*.586,.902,lampDepth(.586,.902)+.026],.008);
    const rearLamp=[];
    for(let i=0;i<=16;i++){const x=.30+i*.73/16,z=-(2.603+.355*Math.sqrt(Math.max(0,1-(x/1.076)**2)));rearLamp.push([side*x,.908+.034*i/16,z],[side*x,.844+.045*i/16,z-.003]);}
    const rearFaces=[];for(let i=0;i<16;i++){const a=i*2;rearFaces.push(...(side>0?[a,a+2,a+1,a+1,a+2,a+3]:[a,a+1,a+2,a+1,a+3,a+2]));}
    panel(car,red,rearLamp,rearFaces,'Wraparound rear LED lens');
    const exhaust=round(car,silver,side*.79,.424,-2.819,.29,.083,.045);exhaust.rotation.y=-side*.53;
    const exhaustInset=round(car,dark,side*.79,.424,-2.846,.225,.041,.013);exhaustInset.rotation.y=-side*.53;
  }
  const rearTrim=[];for(let i=0;i<=32;i++){const x=-.96+i*1.92/32;rearTrim.push(new T.Vector3(x,.783,-(2.605+.350*Math.sqrt(1-(x/1.075)**2))));}
  mesh(car,own(new T.TubeGeometry(new T.CatmullRomCurve3(rearTrim),32,.009,5,false)),silver,0,0,0);
  const bootBadge=mesh(car,own(new T.TorusGeometry(.064,.006,6,24)),silver,0,.946,-2.965);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;bar(car,silver,[0,.946,-2.974],[Math.sin(a)*.058,.946+Math.cos(a)*.058,-2.974],.005);}
  const emblem=mesh(car,own(new T.TorusGeometry(.07,.006,6,24)),silver,0,1.156,2.49);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;bar(car,silver,[0,1.156,2.49],[Math.sin(a)*.065,1.156+Math.cos(a)*.065,2.49],.005);}
  bar(car,silver,[0,1.058,2.49],[0,1.095,2.49],.009);
  const frontPlate=label(car,'MAYBACH',0,.567,2.931,.58,.115,'#15191c','#e6e1d7');
  const rearPlate=label(car,'MAYBACH',0,.672,-2.958,.58,.115,'#15191c','#e6e1d7');rearPlate.rotation.y=Math.PI;

  const wheels=createMaybachWheels(kit,car);
  // Preserve each surface's color while sharing four physically distinct
  // finishes. The caller can then batch all panels within each moving part.
  const finishes=new Map(),coloredGeometry=new Map();
  car.traverse(object=>{
    if(!object.isMesh||object===frontPlate||object===rearPlate)return;
    const source=object.material;
    if(!source.isMeshStandardMaterial||source.map||source.transparent||source.userData.lamp)return;
    const finish=source===paint||source===champagne?'paint':source===silver||source.metalness>.65?'chrome':
      source===leather||source===stitch||source===rubber?'soft':'satin';
    if(!finishes.has(finish)){
      const material=own(new T.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,
        metalness:finish==='paint'?.5:finish==='chrome'?.94:finish==='soft'?.01:.16,
        roughness:finish==='paint'?.2:finish==='chrome'?.18:finish==='soft'?.86:.43,
        clearcoat:finish==='paint'?1:0,clearcoatRoughness:.10,
        ...(['paint','chrome'].includes(finish)?{envMap:paint.envMap,envMapIntensity:.85}:{})}));
      material.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');
      };
      material.customProgramCacheKey=()=>`maybach-vertex-finish-${finish}`;
      finishes.set(finish,material);
    }
    if(!coloredGeometry.has(object.geometry))coloredGeometry.set(object.geometry,new Map());
    const variants=coloredGeometry.get(object.geometry);
    if(!variants.has(source)){
      const geometry=own(object.geometry.clone()),count=geometry.attributes.position.count,colors=new Float32Array(count*3);
      for(let i=0;i<count;i++)source.color.toArray(colors,i*3);
      geometry.setAttribute('color',new T.BufferAttribute(colors,3));variants.set(source,geometry);
    }
    object.geometry=variants.get(source);object.material=finishes.get(finish);
  });
  return {car,doors,wheels};
}
