// A compact academic quad opposite the stadium, built from the village's shared parts.
export function createCampusCommons(T,kit,parent,extension=0){
  const {box,cylinder,mesh,bar,path,tree,bench,lamp,table,sign,building,hedge,bins}=kit;
  const root=new T.Group();root.name='campus-commons-quad';parent.add(root);
  const unionZ=-18,libraryZ=24+extension*.7,plazaZ=5+extension*.3;
  function hall(type,x,z,width,depth,height,label){
    const g=building(root,{type,x,z,width,depth,height,label,rotation:Math.PI,seed:481+z},0,0);g.name='commons-'+type;return g;
  }
  const union=hall('union',-3,unionZ,32,20,8,'STUDENT COMMONS');
  // A planted roof terrace and a shaded social wing distinguish the union.
  box(union,0,9.3,0,27,.2,16,0xbdb7a7);
  for(const x of [-11,11]){box(union,x,9.7,0,1.5,.6,14,0xc5bba7);for(const z of [-5,0,5])mesh(union,'leaf',x,10.2,z,.8,.7,1.1,0x647a45);}
  const terrace=new T.Group();terrace.position.y=9.3;union.add(terrace);
  for(const x of [-6,0,6])table(terrace,x,3);
  hall('library',3,libraryZ,32,20,10,'');
  path(root,[-30,-40],[-30,38+extension],3.3);
  path(root,[37,-40],[37,38+extension],3);
  for(const z of [unionZ-16,plazaZ,libraryZ-16])path(root,[-30,z],[37,z],2.5);
  path(root,[-3,unionZ-16],[-3,unionZ-10],5.4);
  path(root,[3,libraryZ-16],[3,libraryZ-10],5.4);
  if(extension>=70){
    const gardenZ=plazaZ+30,garden=new T.Group();garden.name='commons-study-garden';garden.position.set(-3,0,gardenZ);root.add(garden);
    box(garden,0,.18,0,20,.18,14,0xc7c3b4);
    for(const x of [-8,8])for(const z of [-5,5])box(garden,x,2.2,z,.22,4.2,.22,0x94734e);
    for(let x=-9;x<=9;x+=1.5)box(garden,x,4.45,0,.2,.22,12,0x94734e);
    for(const x of [-4,4])table(garden,x,0);
    for(const z of [-7,7]){box(garden,0,.6,z,16,.9,1.4,0xbdb7a7);for(let x=-7;x<=7;x+=1.4){mesh(garden,'leaf',x,1.2,z,.8,.5,.6,0x647a45);mesh(garden,'sphere',x,1.6,z,.16,.2,.16,0x8e80a0);}}
    path(root,[-30,gardenZ],[37,gardenZ],2.5);
  }
  // Round fountain plaza, surrounded by seats and a warm brick paving band.
  cylinder(root,0,.15,plazaZ,11,.16,0xb8977d);cylinder(root,0,.25,plazaZ,9.8,.12,0xc7c3b4);
  cylinder(root,0,.55,plazaZ,3.6,.6,0xc9c2b1);cylinder(root,0,.89,plazaZ,3.1,.06,0x729ca1);
  cylinder(root,0,1.35,plazaZ,.42,.9,0xd6cdb6);mesh(root,'sphere',0,1.98,plazaZ,.65,.65,.65,0xa26e49);
  for(const side of [-1,1]){bench(root,side*7,plazaZ,side*Math.PI/2);lamp(root,side*9,plazaZ-7);}
  // A slender clock tower faces both the houses and the perimeter road.
  const tower=new T.Group();tower.name='commons-clock-tower';tower.position.set(25,0,plazaZ+4);root.add(tower);
  box(tower,0,.3,0,5,.5,5,0xc7c3b4);box(tower,0,5,0,3.2,9.5,3.2,0xb67f62,'brick');
  box(tower,0,10,0,4,.4,4,0xe4deca);mesh(tower,'cone',0,11,0,3,1.7,3,0x64766c);
  for(const side of [-1,1]){
    const face=new T.Group();face.position.z=side*1.64;face.rotation.y=side<0?Math.PI:0;tower.add(face);
    const dial=mesh(face,'cylinder',0,8.5,0,1.04,.09,1.04,0xe9dfc7);dial.rotation.x=Math.PI/2;
    bar(face,[0,8.5,.08],[0,9.24,.08],.04,0x323c46);bar(face,[0,8.5,.08],[.53,8.22,.08],.055,0x323c46);
  }
  if(extension>=50){
    const stageZ=37+extension*.87,stage=new T.Group();stage.name='commons-outdoor-stage';stage.position.set(-1,0,stageZ);root.add(stage);
    box(stage,0,.4,0,24,.7,11,0xb8977d);box(stage,0,.82,0,23,.12,10,0x94734e);
    for(const x of [-10,10])for(const z of [-4,4])box(stage,x,3.2,z,.24,4.8,.24,0x626961);
    for(let x=-11;x<=11;x+=2)box(stage,x,5.65,0,.32,.25,12,0x94734e);
    box(stage,0,3.1,4.8,16,3.1,.12,0x323551);sign(stage,'THE QUAD',0,3.2,-4.9,8,.8);
    for(const z of [-11,-15,-19])for(const x of [-7,0,7])bench(stage,x,z,Math.PI);
    path(root,[-30,stageZ],[37,stageZ],2.5);
  }
  for(const x of [-26,30])for(const z of [-29,plazaZ+13,libraryZ+18]){
    tree(root,x,z,Math.round(x+z+600),.9);box(root,x,.3,z,3,.4,3,0xbdb7a7);lamp(root,x+(x<0?3:-3),z+4);
  }
  for(const x of [-22,20]){hedge(root,x,-36,8);bins(root,x,-32);}
  return root;
}

export function addCampusEdgeDetails(T,kit,parent,side,extension=0){
  const {box,bar,mesh,bench,lamp,sign,bins}=kit;
  const root=new T.Group();root.name='campus-edge-details';parent.add(root);
  for(const z of [-36,35+extension]){
    const x=side*36;
    box(root,x,.18,z,10,.18,6,0xc7c3b4);bench(root,x,z+2,Math.PI);bins(root,x+side*4,z+1);
    // Covered bicycle stands and a campus noticeboard at each walking entrance.
    for(let i=0;i<4;i++){
      const bx=x-3+i*1.4;bar(root,[bx,.1,z-1],[bx,.9,z-1],.035,0x7a898b);bar(root,[bx,.9,z-1],[bx,.9,z],.035,0x7a898b);bar(root,[bx,.9,z],[bx,.1,z],.035,0x7a898b);
      if(i%2===0){for(const bz of [z-1.2,z+.2]){const wheel=mesh(root,'wheel',bx+.18,.42,bz,1,1,1,0x384649);wheel.rotation.y=Math.PI/2;}bar(root,[bx+.18,.42,z-1.2],[bx+.18,1,z-.5],.04,0x6c738e);bar(root,[bx+.18,1,z-.5],[bx+.18,.42,z+.2],.04,0x6c738e);}
    }
    box(root,x-side*5,1.5,z,.12,2.8,.12,0x626961);box(root,x-side*5,2.05,z,2.1,1.35,.14,0x94734e);
    for(let i=0;i<3;i++)box(root,x-side*5-.65+i*.65,2.05,z-.09,.48,.83,.03,[0x736a96,0xe4d6b9,0x74938c][i]);
    lamp(root,side*39,z-3);
  }
  // Repeated small banners give the perimeter the same purple accents as Greek Row.
  for(const z of [-10,15+extension*.55,30+extension]){
    const x=side*40;bar(root,[x,0,z],[x,5,z],.055,0x626961);box(root,x-side*.5,4,z,.8,1.4,.055,0x636491);
    for(let i=0;i<3;i++)box(root,x-side*.5,3.65+i*.3,z-.04,.47,.055,.015,0xe9dfc7);
  }
  return root;
}
