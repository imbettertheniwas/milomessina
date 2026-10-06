// Lightweight, reusable jet and cabin geometry for the school-arrival film.
export function createPrivateJet(T){
 const root=new T.Group();root.name='fomo-private-jet';
 const exterior=new T.Group(),cabin=new T.Group();exterior.name='jet-exterior';cabin.name='jet-cabin';root.add(exterior,cabin);cabin.visible=false;
 const resources=new Set();
 const material=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.4,metalness:.12,...extra});resources.add(m);return m;};
 const pearl=material(0xf4f1e9),lavender=material(0x516af6),ink=material(0x24253d),glass=material(0x263b51,{roughness:.15,metalness:.6}),chrome=material(0xafb6bd,{roughness:.23,metalness:.8}),leather=material(0xe5d8c5,{roughness:.85,metalness:0}),wood=material(0x664d3e,{roughness:.25}),carpet=material(0xaaa092,{roughness:1,metalness:0});
 const mesh=(parent,geometry,mat,position=[0,0,0],scale=[1,1,1])=>{resources.add(geometry);const m=new T.Mesh(geometry,mat);m.position.set(...position);m.scale.set(...scale);parent.add(m);return m;};
 const box=(parent,pos,size,mat)=>mesh(parent,new T.BoxGeometry(...size),mat,pos);
 const round=(parent,pos,size,mat)=>mesh(parent,new T.SphereGeometry(1,24,16),mat,pos,size);
 const ring=(parent,pos,r,t,mat)=>{const m=mesh(parent,new T.TorusGeometry(r,t,8,32),mat,pos);return m;};
 function cushion(parent,pos,w,h,d,r,mat){
  const x=-w/2,y=-h/2,s=new T.Shape();s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  const geometry=new T.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:.035,bevelThickness:.035,curveSegments:6});geometry.translate(0,0,-d/2);return mesh(parent,geometry,mat,pos);
 }
 function foil(points,height,thickness,mat){
  const vertices=[],indices=[],n=points.length;
  for(const y of [height-thickness/2,height+thickness/2])for(const [x,z] of points)vertices.push(x,y,z);
  for(let i=1;i<n-1;i++)indices.push(0,i+1,i,n,n+i,n+i+1);
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+i,j,n+j,n+i);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(exterior,geometry,mat);
 }
 const profile=[[-14,0],[-13.2,.55],[-11.8,1.15],[-9,1.65],[-6,1.8],[5.9,1.8],[8.5,1.45],[11.8,.6],[13.3,.12],[13.6,0]].map(([z,r])=>new T.Vector2(r,z));
 const hull=mesh(exterior,new T.LatheGeometry(profile,40),pearl);hull.rotation.x=Math.PI/2;
 const belly=round(exterior,[0,-.76,.2],[1.55,.99,10.2],lavender);
 for(const side of [-1,1]){
  foil([[side*1.1,-2],[side*13.7,3.1],[side*14.2,5.2],[side*3.5,3.4],[side*1.1,4.5]],-.55,.14,pearl);
  const winglet=box(exterior,[side*14,0,4.7],[.13,1.7,1.4],lavender);winglet.rotation.z=-side*.16;
  foil([[side*.55,9],[side*5.5,10.7],[side*5.4,12.3],[side*.6,11.5]],1.1,.1,pearl);
  box(exterior,[side*2.05,.35,7.5],[1.9,.16,2.2],pearl);
  const engine=mesh(exterior,new T.CylinderGeometry(.95,.78,4.2,32),pearl,[side*2.7,.35,7.1]);engine.rotation.x=Math.PI/2;
  ring(exterior,[side*2.7,.35,5],.85,.09,chrome);
  const intake=mesh(exterior,new T.CircleGeometry(.79,32),ink,[side*2.7,.35,4.97]);intake.rotation.y=Math.PI;
  round(exterior,[side*2.7,.35,4.9],[.2,.2,.22],chrome);
  for(let i=0;i<10;i++){const blade=box(exterior,[side*2.7,.35,4.94],[.06,1.3,.015],chrome);blade.rotation.z=i*Math.PI/5;}
  for(let i=0;i<7;i++){const window=round(exterior,[side*1.74,.58,-6.3+i*1.5],[.065,.43,.31],glass);window.rotation.z=side*.17;}
  const cockpit=round(exterior,[side*.87,.93,-10.05],[.66,.48,1.13],glass);cockpit.rotation.y=side*.16;
  box(exterior,[side*1.79,-.15,-.4],[.025,.13,12.5],lavender);
 }
 const finShape=new T.Shape();finShape.moveTo(7.8,.7);finShape.lineTo(10.2,5.9);finShape.lineTo(12.2,6.1);finShape.lineTo(12.9,.6);finShape.closePath();
 const fin=mesh(exterior,new T.ExtrudeGeometry(finShape,{depth:.2,bevelEnabled:false}),lavender);fin.rotation.y=-Math.PI/2;fin.position.x=.1;
 function wordmark(parent,width,height,position,rotation,color='#302b45'){
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1024,256);ctx.fillStyle=color;ctx.font='700 225px Aeonik, Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('fomo',512,132,940);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;resources.add(texture);
  const mat=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:T.DoubleSide});resources.add(mat);
  const label=mesh(parent,new T.PlaneGeometry(width,height),mat,position);label.rotation.set(...rotation);return label;
 }
 for(const side of [-1,1])wordmark(exterior,5.4,1.35,[side*1.805,-.63,-3.8],[0,side*Math.PI/2,0]);
 wordmark(exterior,2.1,.6,[.13,3.25,10.9],[0,Math.PI/2,0],'#ffffff');
 wordmark(exterior,2.1,.6,[-.13,3.25,10.9],[0,-Math.PI/2,0],'#ffffff');
 // An open cabin with actual oval window apertures and warm indirect lighting.
 box(cabin,[0,-1.35,0],[3.5,.16,15],carpet);box(cabin,[0,1.55,0],[3.2,.2,15],pearl);
 for(const side of [-1,1]){
  for(let i=0;i<7;i++)if(side!==-1||i!==1)box(cabin,[side*1.65,-.95,-6.3+i*2.1],[.15,.7,2.1],leather);
  box(cabin,[side*1.57,1.23,0],[.24,.58,15],pearl);
  for(let i=0;i<7;i++){
   if(side===-1&&i===1){
    for(const z of [-5.2,-3.2])box(cabin,[-1.7,0,z],[.16,2.7,.13],chrome);
    box(cabin,[-1.7,1.3,-4.2],[.16,.12,2.1],chrome);
    continue;
   }
   const shape=new T.Shape();shape.moveTo(-1.06,-.6);shape.lineTo(1.06,-.6);shape.lineTo(1.06,.99);shape.lineTo(-1.06,.99);shape.closePath();
   const hole=new T.Path();hole.absellipse(0,.26,.35,.51,0,Math.PI*2,true);shape.holes.push(hole);
   const wall=mesh(cabin,new T.ShapeGeometry(shape,24),new T.MeshStandardMaterial({color:0xeee7dc,roughness:.85,side:T.DoubleSide}),[side*1.7,0,-6.3+i*2.1]);resources.add(wall.material);wall.rotation.y=side*Math.PI/2;
   const rim=ring(cabin,[side*1.685,.26,-6.3+i*2.1],.42,.045,chrome);rim.scale.set(.84,1.23,1);rim.rotation.y=side*Math.PI/2;
  }
  for(const z of [-3.4,.3,4]){
   const seat=new T.Group();seat.position.set(side*.94,-.87,z);cabin.add(seat);
   cushion(seat,[0,0,0],.94,.23,1.05,.1,leather);const back=cushion(seat,[0,.55,.48],.96,1.18,.22,.17,leather);back.rotation.x=-.1;cushion(seat,[0,1.05,.40],.63,.28,.26,.1,leather);
   for(const x of [-.48,.48])cushion(seat,[x,.25,.06],.16,.15,.86,.06,leather);
   box(seat,[0,-.27,.08],[.36,.42,.38],chrome);
  }
  box(cabin,[side*1.13,-.24,-1.3],[1.0,.08,1.28],wood);
  const strip=material(0xffe2b6,{emissive:0xffd2a0,emissiveIntensity:1.2,metalness:0});box(cabin,[side*1.38,1.37,0],[.045,.04,14.6],strip);
 }
 box(cabin,[0,.0,-7.15],[3.4,2.7,.15],wood);
 wordmark(cabin,1.3,.35,[0,.67,-7.05],[0,0,0],'#eee7de');
 const door=new T.Group();door.name='jet-exit-door';door.position.set(-1.7,0,-5.4);cabin.add(door);
 // The aisle camera turns toward the forward exit before the freefall cut.
 const light=new T.PointLight(0xffedcf,9,18,1);light.position.set(0,.9,-1);cabin.add(light);
 const fill=new T.PointLight(0xe3ecff,5,18,1);fill.position.set(0,.8,5);cabin.add(fill);
 return {root,exterior,cabin,dispose(){root.removeFromParent();for(const resource of resources)resource.dispose();}};
}
