// Authored likenesses from assets/helipad/rasmr-orangie-reference.webp.
// The front of each head has its own portrait UVs; hair, ears and glasses stay
// modeled when the caller adds the local portrait atlas.
export function createHelipadGuests(kit){
  const {T,root,own,mat,group,mesh,bar,label}=kit;
  const smallSphere=own(new T.SphereGeometry(1,14,10));
  const detailSphere=own(new T.SphereGeometry(1,10,7));
  const oval=(p,m,x,y,z,w,h,d,small=false)=>mesh(p,small?detailSphere:smallSphere,m,x,y,z,w,h,d);
  const darkRubber=mat(0x24272a,0,.89),sole=mat(0xcac9c3,0,.85);
  const seams=mat(0x14171b,0,.98),laces=mat(0xd7d4cb,0,.94);

  // Elliptical garment cross sections retain a smooth silhouette without
  // overlapping toy cylinders. All geometry carries UVs for the scene bake.
  function loft(rows,segments=24,fold=0){
    const positions=[],uv=[],indices=[];
    rows.forEach(([y,rx,rz,zc=0],j)=>{
      for(let k=0;k<=segments;k++){
        const a=k/segments*Math.PI*2;
        const wrinkle=1+fold*Math.sin(a*7+j*.62)*Math.sin(Math.PI*j/(rows.length-1));
        positions.push(Math.sin(a)*rx*wrinkle,y,Math.cos(a)*rz*wrinkle+zc);
        uv.push(k/segments,j/(rows.length-1));
      }
    });
    for(let j=0;j<rows.length-1;j++)for(let k=0;k<segments;k++){
      const a=j*(segments+1)+k,b=a+1,c=a+segments+1,d=c+1;
      indices.push(a,b,c,b,d,c);
    }
    const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function tube(p,m,points,r=.003,segments=16){
    const curve=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)));
    return mesh(p,own(new T.TubeGeometry(curve,segments,r,5,false)),m,0,0,0);
  }
  function textMap(text,color){
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
    const c=canvas.getContext('2d');c.clearRect(0,0,1024,256);c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';
    c.font='700 148px Aeonik, Arial, sans-serif';c.fillText(text,512,130,982);
    const map=own(new T.CanvasTexture(canvas));map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return map;
  }
  function print(p,text,color,w,y,rz,rx){
    const map=textMap(text,color);if(!map)return;
    const points=[],uv=[],indices=[],steps=18;
    for(let row=0;row<2;row++)for(let i=0;i<=steps;i++){
      const x=(i/steps-.5)*w;
      points.push(x,y+(row-.5)*.093,rz*Math.sqrt(Math.max(0,1-x*x/(rx*rx)))+.0035);
      uv.push(i/steps,row);
    }
    for(let i=0;i<steps;i++)indices.push(i,i+1,i+steps+1,i+1,i+steps+2,i+steps+1);
    const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const m=own(new T.MeshStandardMaterial({map,transparent:true,alphaTest:.12,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
    const o=mesh(p,g,m,0,0,0);o.name='printed garment lettering';return o;
  }
  function headSurface(isOrangie,frontOnly=false){
    const s=isOrangie?1.11:1;
    // y, width, front depth, atlas vertical coordinate. A small central relief
    // models the brow, nose and lips so the portrait does not read as a sticker.
    const rows=[
      [-.142,.043,.051,isOrangie?.862:.830],[-.131,.068,.072,isOrangie?.839:.807],
      [-.112,.086,.085,isOrangie?.799:.768],[-.089,.099,.092,isOrangie?.743:.712],
      [-.068,.108,.096,isOrangie?.700:.671],[-.045,.114,.099,isOrangie?.642:.615],
      [-.025,.117,.101,isOrangie?.597:.567],[-.004,.119,.101,isOrangie?.548:.520],
      [.019,.118,.101,isOrangie?.496:.467],[.044,.117,.099,isOrangie?.452:.421],
      [.073,.114,.094,isOrangie?.405:.369],[.100,.108,.083,isOrangie?.365:.317],
      [.126,.095,.064,isOrangie?.325:.274],[.143,.071,.036,isOrangie?.296:.248]
    ];
    const positions=[],uv=[],indices=[],steps=frontOnly?30:32;
    rows.forEach(([y,rx,rz,v],j)=>{
      for(let i=0;i<=steps;i++){
        const a=frontOnly?(-Math.PI/2+i/steps*Math.PI):(i/steps*Math.PI*2);
        const x=Math.sin(a)*rx*s,forward=Math.max(0,Math.cos(a));
        const nose=Math.exp(-Math.pow(x/.022,2))*(.031*Math.exp(-Math.pow((y+.024)/.036,2)));
        const lips=.009*Math.exp(-Math.pow(x/.046,4))*Math.exp(-Math.pow((y+.087)/.014,2));
        const z=Math.cos(a)*(Math.cos(a)>=0?rz:.105)+(nose+lips)*forward+(frontOnly?.0012:0);
        positions.push(x,y,z);
        uv.push((isOrangie?.75:.25)+x/(.119*s)*(isOrangie?.228:.231),1-v);
      }
    });
    for(let j=0;j<rows.length-1;j++)for(let i=0;i<steps;i++){
      const a=j*(steps+1)+i,b=a+1,c=a+steps+1,d=c+1;indices.push(a,b,c,b,d,c);
    }
    const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    if(frontOnly){const fade=[];for(let row=0;row<rows.length;row++)for(let i=0;i<=steps;i++){const edge=Math.abs(Math.sin(-Math.PI/2+i/steps*Math.PI));fade.push(1-T.MathUtils.smoothstep(edge,.80,1));}g.setAttribute('portraitBlend',new T.Float32BufferAttribute(fade,1));}
    return g;
  }
  function glasses(p){
    const frame=mat(0x151414,.08,.30);
    const lensMaterial=own(new T.MeshPhysicalMaterial({color:0xc8d2ca,transparent:true,opacity:.10,roughness:.1,metalness:0,depthWrite:false}));
    for(const side of [-1,1]){
      const cx=side*.069,cy=.019,z=.120;
      tube(p,frame,[[-.052+cx,.030+cy,z],[-.055+cx,.020+cy,z],[-.050+cx,-.020+cy,z],[-.037+cx,-.028+cy,z],[.037+cx,-.028+cy,z],[.050+cx,-.020+cy,z],[.055+cx,.020+cy,z],[.052+cx,.030+cy,z],[-.052+cx,.030+cy,z]],.0043,40);
      const lens=mesh(p,own(new T.PlaneGeometry(.098,.046)),lensMaterial,cx,cy,.119);lens.name='clear eyeglass lens';
      tube(p,frame,[[side*.124,.041,.120],[side*.138,.047,.084],[side*.144,.053,-.027],[side*.137,.027,-.044]],.0038,12);
      oval(p,mat(0x9b9b8b,.65,.35),side*.125,.037,.121,.004,.002,.0015,true);
    }
    tube(p,frame,[[-.015,.042,.122],[0,.047,.136],[.015,.042,.122]],.004,10);
  }
  function hair(p,isOrangie){
    const base=mat(isOrangie?0x573b2b:0x25201c,0,.98);
    const mid=mat(isOrangie?0x684934:0x30271f,0,.97);
    const light=mat(isOrangie?0x78573d:0x3b2d23,0,.98);
    // A close haircut at the temples, with curls concentrated above the crown.
    const cap=mesh(p,loft([[-.012,.113,.098,-.016],[.043,.120,.101,-.014],[.094,.122,.099,-.015],[.130,.113,.086,-.016],[.157,.086,.062,-.016],[.170,.012,.009,-.016]],28),base,0,0,-.016);
    // Crop the front hairline back, keeping the face and forehead unobscured.
    const a=cap.geometry.attributes.position;
    for(let i=0;i<a.count;i++)if(a.getZ(i)>.01&&a.getY(i)<.10)a.setY(i,.108+(a.getY(i)+.012)*.18+Math.sin(a.getX(i)*59)*.006);
    a.needsUpdate=true;cap.geometry.computeVertexNormals();cap.name='sculpted hair and tapered temples';
    if(isOrangie)oval(p,base,0,.145,-.010,.129,.048,.108);
    const count=isOrangie?43:24;
    for(let i=0;i<count;i++){
      const angle=i*2.399963,r=Math.sqrt((i+.5)/count),x=Math.cos(angle)*r*(isOrangie?.126:.106),z=Math.sin(angle)*r*.100-.008;
      const h=(isOrangie?.159:.142)+(1-r*r)*(isOrangie?.031:.022),q=.85+.14*Math.sin(i*4.1);
      const o=oval(p,i%11===0?light:i%3===0?mid:base,x,h,z,(isOrangie?.024:.033)*q,(isOrangie?.016:.012)*q,(isOrangie?.025:.024)*q,true);
      o.rotation.set(Math.sin(i)*.45,angle,isOrangie?Math.cos(i)*.3:-.4);
      if(isOrangie&&i%3===0){
        const pts=[];for(let k=0;k<8;k++){const b=k/7*Math.PI*1.75;pts.push([x+Math.cos(b)*.015,h+.012+Math.sin(b)*.002,z+Math.sin(b)*.016]);}
        tube(p,i%2?mid:light,pts,.0017,12);
      }
    }
    if(isOrangie)for(let i=0;i<8;i++){
      const x=(i-3.5)*.027;
      oval(p,i%4?base:mid,x,.135+Math.sin(i*1.8)*.006,.082,.019,.018,.020,true);
    }
    else for(let i=0;i<7;i++){
      const x=(i-3)*.026;
      const lock=oval(p,i%3?base:mid,x,.122+Math.sin(i*2.1)*.007,.079,.025,.012,.021,true);lock.rotation.z=-.25;
    }
  }
  function hand(p,skin,side){
    oval(p,skin,0,-.049,.004,.032,.055,.023);
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.015;
      tube(p,skin,[[x,-.077,.012],[x,-.110+.008*Math.abs(i-1.5),.017],[x,-.119+.010*Math.abs(i-1.5),.010]],.007,6);
    }
    tube(p,skin,[[side*.027,-.020,.008],[side*.043,-.056,.023],[side*.036,-.074,.029]],.010,8);
  }
  function person(index){
    const isOrangie=index===1;
    const skin=mat(isOrangie?0xc79778:0xb78a6c,0,.94),skinShade=mat(isOrangie?0xb77d65:0xa8775e,0,.94);
    const shirt=mat(isOrangie?0x27272a:0x303e50,0,.98),shirtFold=mat(isOrangie?0x323235:0x3a495b,0,.98);
    const pants=mat(isOrangie?0x282c31:0x34363b,0,.97),pantsFold=mat(isOrangie?0x34383d:0x43454a,0,.97);
    const actor=group(root,isOrangie?'Orangie':'Rasmr'),body=group(actor,'body',0,1.00,0);
    const w=isOrangie?.286:.220,d=isOrangie?.183:.144;
    mesh(body,loft([[.013,w*.91,d*.88],[.031,w,d*.99],[.11,w*1.015,d],[.23,w*.99,d],[.36,w*.99,d*.98],[.47,w,d*.90],[.515,w*.91,d*.81],[.565,w*.68,d*.66],[.591,.069,.068]],32,.017),shirt,0,0,0);
    mesh(body,loft([[.014,w*.90,d*.87],[.025,w*.99,d*.98],[.045,w*.99,d*.98]],28),shirtFold,0,0,0);
    // Cloth creases follow the drape; they do not stand proud like trim tubes.
    for(const side of [-1,1]){
      tube(body,shirtFold,[[side*w*.93,.085,.06],[side*w*.95,.15,.085],[side*w*.91,.235,.084]],.0024,12);
      tube(body,shirtFold,[[side*w*.50,.060,d*.87],[side*w*.60,.12,d*.82],[side*w*.65,.17,d*.77]],.002,12);
    }
    if(!isOrangie){
      oval(body,shirt,0,.546,-.078,.137,.093,.100);
      tube(body,shirtFold,[[-.108,.545,.071],[-.077,.594,.051],[0,.601,.043],[.077,.594,.051],[.108,.545,.071]],.014,24);
      for(const side of [-1,1]){
        tube(body,laces,[[side*.067,.551,.101],[side*.064,.467,.149],[side*.059,.409,.151]],.003,14);
        bar(body,mat(0xa3a097,.20,.75),[side*.059,.412,.151],[side*.059,.395,.151],.0037);
      }
      tube(body,shirtFold,[[-.138,.196,.113],[-.101,.239,.133],[.101,.239,.133],[.138,.196,.113]],.003,22);
      tube(body,shirtFold,[[-.116,.163,.123],[0,.156,.147],[.116,.163,.123]],.002,16);
    }else{
      tube(body,seams,[[-.068,.589,.044],[-.056,.574,.061],[0,.569,.073],[.056,.574,.061],[.068,.589,.044]],.007,22);
    }
    print(body,isOrangie?'BALENCIAGA':'DEGODS',isOrangie?'#b3a170':'#cbc9c0',isOrangie?.47:.31,isOrangie?.365:.361,d*.992,w);
    mesh(body,loft([[.568,.070,.063],[.62,.068,.063],[.678,.064,.057]],20),skin,0,0,-.014);
    const head=group(body,'portrait',0,.761,.008);
    const faceShell=mesh(head,headSurface(isOrangie),skin,0,0,0);faceShell.name='faceShell';
    const portraitSurface=mesh(head,headSurface(isOrangie,true),skin,0,0,0);portraitSurface.name='portraitSurface';portraitSurface.visible=false;
    // The isolated surface group keeps the caller's bake from combining the
    // atlas face with anatomy or changing which fallback parts are hidden.
    const surfaceHolder=group(head,'portrait surface');portraitSurface.removeFromParent();surfaceHolder.add(portraitSurface);
    const faceDetails=group(head,'modeled facial features');
    const eyeWhite=mat(0xbeb5a3,0,.82),iris=mat(isOrangie?0x625b45:0x51432b,0,.81),lip=mat(isOrangie?0xa46662:0x905a50,0,.95);
    for(const side of [-1,1]){
      const ex=side*(isOrangie?.066:.058),ez=isOrangie?.093:.091;
      oval(faceDetails,eyeWhite,ex,.021,ez,.025,.009,.006,true);
      oval(faceDetails,iris,ex,.021,ez+.005,.007,.008,.002,true);
      oval(faceDetails,mat(0x231f1a,0,.85),ex,.021,ez+.007,.0035,.0048,.0015,true);
      tube(faceDetails,skinShade,[[ex-.024,.022,ez],[ex,.031,ez+.005],[ex+.025,.022,ez]],.0024,12);
      tube(faceDetails,mat(isOrangie?0x755638:0x3d2c21,0,.98),[[ex-.023,.054,.086],[ex,.061,.091],[ex+.024,.053,.084]],isOrangie?.004:.0058,14);
      oval(head,skin,side*(isOrangie?.134:.120),.005,-.003,.020,.038,.022);
      oval(head,skinShade,side*(isOrangie?.147:.133),.006,.004,.006,.024,.012,true);
      oval(head,skin,side*(isOrangie?.143:.129),-.007,.018,.006,.012,.006,true);
      oval(faceDetails,skinShade,side*.016,-.048,.127,.009,.004,.003,true);
    }
    oval(faceDetails,skin,0,-.023,.122,.018,.037,.019);
    tube(faceDetails,lip,[[-.033,-.083,.104],[-.012,-.080,.108],[0,-.083,.109],[.012,-.080,.108],[.033,-.083,.104]],.003,18);
    oval(faceDetails,lip,0,-.091,.105,.028,.004,.004,true);
    if(!isOrangie){
      const stubble=mat(0x74604f,0,.98);
      for(let i=0;i<46;i++){
        const x=Math.sin(i*2.399963)*(.070+.018*Math.sin(i)),y=-.113+.019*Math.cos(i*1.713);
        oval(faceDetails,stubble,x,y,.074+(.026*(1-Math.abs(x)/.10)),.0012,.0019,.0007,true);
      }
    }
    hair(head,isOrangie);if(isOrangie)glasses(head);
    const arms=[],forearms=[],legs=[],knees=[];
    for(const side of [-1,1]){
      const arm=group(body,'upper arm',side*(w*.99),.491,-.006);arm.rotation.z=side*.095;arms.push(arm);
      const sleeveRadius=isOrangie?.086:.071;
      mesh(arm,loft([[-.290,sleeveRadius*.75,sleeveRadius*.75],[-.269,sleeveRadius*.88,sleeveRadius*.88],[-.13,sleeveRadius,sleeveRadius],[.005,sleeveRadius*.9,sleeveRadius*.88],[.045,sleeveRadius*.44,sleeveRadius*.47]],20,.022),shirt,0,isOrangie?.070:0,0);
      if(isOrangie){
        // Short T-shirt sleeves stop above the elbow and reveal upper arms.
        const sleeve=arm.children[0];sleeve.scale.y=.66;sleeve.position.y=.003;
        mesh(arm,loft([[-.305,.051,.055],[-.21,.063,.064],[-.145,.069,.070]],18),skin,0,0,0);
        tube(arm,shirtFold,[[-.066,-.176,.015],[0,-.182,.077],[.066,-.176,.015]],.003,18);
      }
      const forearm=group(arm,'forearm',0,-.288,0);forearm.rotation.x=-.085;forearms.push(forearm);
      mesh(forearm,loft([[-.253,isOrangie?.038:.034,isOrangie?.035:.033],[-.235,isOrangie?.040:.038,isOrangie?.038:.036],[-.17,isOrangie?.050:.046,isOrangie?.046:.044],[-.071,isOrangie?.055:.052,isOrangie?.054:.049],[.016,isOrangie?.050:.052,isOrangie?.053:.051]],20,isOrangie?0:.020),isOrangie?skin:shirt,0,0,0);
      if(!isOrangie)mesh(forearm,loft([[-.258,.036,.033],[-.234,.039,.037],[-.212,.043,.041]],18),shirtFold,0,0,0);
      const wrist=group(forearm,'hand',0,-.251,.004);hand(wrist,skin,side);
      if(side===-1){
        const watch=mat(0x777d80,.65,.32);
        mesh(forearm,loft([[-.238,.043,.039],[-.216,.043,.039]],18),watch,0,0,0);
        oval(forearm,mat(0x1b2023,.32,.26),0,-.226,.043,.027,.017,.004,true);
      }
      const leg=group(actor,'upper leg',side*(isOrangie?.143:.115),.997,0);legs.push(leg);
      mesh(leg,loft([[-.414,isOrangie?.079:.070,.079],[-.380,isOrangie?.088:.076,.088],[-.23,isOrangie?.106:.091,.104],[-.067,isOrangie?.119:.103,.109],[.022,isOrangie?.123:.108,.108]],22,.017),pants,0,0,0);
      const knee=group(leg,'lower leg',0,-.400,.005);knees.push(knee);
      mesh(knee,loft([[-.378,isOrangie?.067:.058,.066],[-.355,isOrangie?.068:.060,.068],[-.28,isOrangie?.074:.062,.074],[-.15,isOrangie?.080:.067,.081],[-.034,isOrangie?.079:.070,.081],[.021,isOrangie?.078:.070,.078]],22,.018),pants,0,0,0);
      for(const y of [-.072,-.29])tube(knee,pantsFold,[[-.049,y,.059],[0,y+.010,.078],[.049,y+.016,.059]],.002,14);
      const shoe=group(knee,'leather sneaker',0,-.426,.041);
      oval(shoe,darkRubber,0,-.016,.027,.073,.039,.142);
      oval(shoe,sole,0,-.031,.031,.075,.021,.144);
      oval(shoe,mat(isOrangie?0x777777:0xa7a6a0,0,.81),0,.012,.022,.067,.052,.127);
      oval(shoe,mat(0x45494c,0,.87),0,.029,-.040,.052,.043,.061);
      for(let i=0;i<4;i++)bar(shoe,laces,[-.029,.054-i*.004,-.018+i*.018],[.029,.054-i*.004,-.011+i*.018],.0024);
      tube(shoe,seams,[[-.060,.001,.065],[-.043,.025,.113],[0,.029,.137],[.043,.025,.113],[.060,.001,.065]],.002,18);
    }
    const name=label(actor,isOrangie?'ORANGIE':'RASMR',0,2.21,0,isOrangie?.95:.79,.19,'#fff',isOrangie?'#634d39':'#303e50',true);
    return {root:actor,body,head,arms,forearms,legs,knees,name,faceShell,portraitSurface,faceDetails,skinTint:skin.color.clone()};
  }
  const guests=[person(0),person(1)];
  // Skin, cloth and hair retain their authored colors in vertex attributes.
  // Sharing three physical finishes lets the caller merge each articulated
  // part into one draw, including the many small hair and finger details.
  const finishes=new Map(),coloredGeometry=new WeakMap();
  for(const guest of guests)guest.root.traverse(o=>{
    if(!o.isMesh||o===guest.portraitSurface||o.material.map||o.material.transparent)return;
    const source=o.material,finish=source.metalness>.4?'metal':source.roughness<.55?'polished':'matte';
    if(!finishes.has(finish))finishes.set(finish,own(new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:finish==='matte'?.94:finish==='polished'?.32:.36,metalness:finish==='metal'?.65:0})));
    let colors=coloredGeometry.get(o.geometry);if(!colors){colors=new Map();coloredGeometry.set(o.geometry,colors);}
    const key=source.color.getHex();
    if(!colors.has(key)){
      const geometry=own(o.geometry.clone()),count=geometry.attributes.position.count,data=new Float32Array(count*3);
      for(let i=0;i<count;i++){data[i*3]=source.color.r;data[i*3+1]=source.color.g;data[i*3+2]=source.color.b;}
      geometry.setAttribute('color',new T.BufferAttribute(data,3));colors.set(key,geometry);
    }
    o.geometry=colors.get(key);o.material=finishes.get(finish);
  });
  return guests;
}
