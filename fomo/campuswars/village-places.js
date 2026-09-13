import {hash,pick} from './village-district-layout.js?v=77';
import {marketPaths,greenTrail} from './village-place-layout.js?v=77';

export function buildPlace(T,k,g,s){
  const {box,bar,cylinder,mesh,sign,roof,bench,material}=k,{width:w,depth:d,height:h}=s;
  const shop=s.type==='storefront',wall=shop?s.color:pick([0x9eafa5,0xc9b995,0x9d6450,0x818e9b],s.seed);
  g.name=shop?`place-${s.label.toLowerCase().replaceAll(' ','-')}`:'neighborhood-home';
  box(g,0,.32,0,w+.5,.55,d+.5,0xb7ad98,'stone');
  box(g,0,h/2+.55,0,w,h,d,wall,shop?'brick':'');
  // Side and rear elevations matter when the town is explored from any angle.
  for(let face=1;face<4;face++){
    const elevation=new T.Group();elevation.rotation.y=face*Math.PI/2;g.add(elevation);
    const span=face%2?d:w,depth=face%2?w:d;
    for(let y=shop?5.8:2.1;y<h;y+=3.1)for(let x=-span/2+2.6;x<span/2-1;x+=3.8){
      box(elevation,x,y,depth/2+.08,1.65,1.9,.12,0xd5c5a8);
      box(elevation,x,y,depth/2+.16,1.38,1.65,.04,hash(s.seed,face,x,y)>.75?material(0xe1b87e,'homeLight'):0x4e6871);
      box(elevation,x,y-1,depth/2+.2,1.9,.12,.3,0xab9980);
    }
    if(shop&&face===1){box(elevation,0,2.7,depth/2+.1,span*.7,2,.14,s.awning);sign(elevation,s.label,0,2.7,depth/2+.19,span*.64,.7);}
  }
  if(shop){
    box(g,0,h+.7,0,w+.7,.4,d+.7,0xd3c2a6);
    box(g,0,h+1.1,d/2,w+.6,.5,.5,wall);box(g,0,h+.91,0,w-.6,.08,d-.6,0x515c5f);
    for(const side of [-1,1]){
      box(g,side*w*.29,2.05,d/2+.08,w*.35,2.8,.1,0x304b51);
      box(g,side*w*.29,2.08,d/2+.15,w*.31,2.4,.04,0xf2c588,'shopLight');
      for(let i=0;i<3;i++){box(g,side*w*.29+(i-1)*.8,1.1,d/2+.21,.45,.48,.18,[0x787c51,0xc17e50,0x846587][i]);}
    }
    box(g,0,1.9,d/2+.2,1.8,2.7,.13,0x31484b);box(g,0,2.2,d/2+.28,1.45,1.8,.03,0xcba775,'shopLight');bar(g,[.58,1.3,d/2+.35],[.58,1.8,d/2+.35],.025,0xc4b498);
    box(g,0,3.83,d/2+.2,w-.5,.87,.18,s.awning);sign(g,s.label,0,3.84,d/2+.31,w-1,.65);
    const awning=box(g,0,3.24,d/2+1.05,w-.3,.12,1.8,s.awning);awning.rotation.x=.12;
    for(let x=-w/2+.6;x<w/2;x+=1.25)box(g,x,3.11,d/2+1.93,.43,.3,.08,0xe8d7b8);
    for(let y=5.8;y<h;y+=3.1)for(let x=-w/2+2;x<w/2;x+=3.2){
      box(g,x,y,d/2+.09,1.65,2,.12,0xe3cfaf);box(g,x,y,d/2+.17,1.36,1.75,.04,hash(s.seed,x,y)>.6?material(0xe1b87e,'homeLight'):0x49616a);
      box(g,x,y-1.03,d/2+.25,1.9,.13,.35,0xbdaa88);
    }
    // Back doors, drainpipes, roof vents and a fire escape face the service lane.
    box(g,w*.26,1.7,-d/2-.09,1.5,2.6,.12,0x4c5b59);
    for(const x of [-w*.43,w*.43])bar(g,[x,.4,-d/2-.15],[x,h+.3,-d/2-.15],.045,0x536665);
    box(g,-w*.2,h+1.4,0,2,.7,1.6,0x72817c);
    for(let y=4.5;y<h;y+=3){box(g,-w*.24,y,-d/2-.8,4,.1,1.5,0x454f4d);bar(g,[-w*.24-2,y+1,-d/2-1.5],[-w*.24+2,y+1,-d/2-1.5],.035,0x454f4d);}
    for(let y=.7;y<h;y+=.45)bar(g,[-w*.24-.4,y,-d/2-1.6],[-w*.24+.4,y,-d/2-1.6],.035,0x454f4d);
    for(const x of [-w*.24-.4,-w*.24+.4])bar(g,[x,.5,-d/2-1.6],[x,h,-d/2-1.6],.04,0x454f4d);
  }else{
    roof(g,w+1,d+1,h+.65,2.6);
    box(g,-w*.27,h+1.5,-2,.9,2.8,.9,0x875e4c,'brick');
    for(const side of [-1,1])for(const y of [2.1,5.1]){
      box(g,side*w*.29,y,d/2+.08,2,1.85,.15,0xe1d8bd);box(g,side*w*.29,y,d/2+.17,1.7,1.58,.05,side<0&&y>3?material(0xebc68e,'homeLight'):0x526b75);
      for(const dx of [-1.25,1.25])box(g,side*w*.29+dx,y,d/2+.13,.4,1.9,.16,0x3c5552);
    }
    box(g,0,1.8,d/2+.13,1.7,2.7,.16,0x384e59);
    box(g,0,.5,d/2+1.9,w-2,.35,3.6,0xab967b);
    for(let i=0;i<3;i++)box(g,0,.13+i*.13,d/2+4-i*.45,3.2,.23,1,0xbcad91);
    box(g,0,3.6,d/2+1.6,w-1,.25,4,0xe2d3b6);
    for(const x of [-w/2+1.1,w/2-1.1]){box(g,x,2,d/2+3,.16,3.1,.16,0xe2d3b6);bar(g,[x,.9,d/2+.3],[x,.9,d/2+3.3],.04,0xe2d3b6);}
    const chairs=new T.Group();chairs.position.y=.68;g.add(chairs);bench(chairs,-w*.27,d/2+1.6);bench(chairs,w*.26,d/2+1.6,.18);
    box(g,1.6,.88,d/2+.5,.65,.42,.5,0xad8254);box(g,1.6,1.1,d/2+.5,.68,.03,.52,0xd1b185);
    cylinder(g,-1.7,.86,d/2+2,.28,.4,0xad7457);mesh(g,'leaf',-1.7,1.25,d/2+2,.5,.55,.5,0x627449);
  }
}

export function dressNeighborhood(T,k,p,kind,cx,cz){
  const {box,bar,cylinder,mesh,path,tree,bench,table,sign,bins,lamp}=k;
  const chain=(points,width,color)=>{for(let i=1;i<points.length;i++)path(p,points[i-1],points[i],width,color);};
  const fence=(a,b)=>{bar(p,[a[0],1,a[1]],[b[0],1,b[1]],.045,0xb4a68c);const length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let i=0;i<=length;i++){const t=i/length;box(p,a[0]+(b[0]-a[0])*t,.6,a[1]+(b[1]-a[1])*t,.12,1.15,.12,0xc3b295);}};
  function board(x,z,title){for(const dx of [-1,1])box(p,x+dx,1.1,z,.12,2,.12,0x71614d);box(p,x,1.65,z,2.6,1.5,.16,0x635a46);sign(p,title,x,2.07,z+.1,2.35,.35);for(let i=0;i<6;i++){const flyer=box(p,x-.8+(i%3)*.78,1.66-Math.floor(i/3)*.5,z+.1,.55,.38,.025,[0xc69368,0xdcd6b2,0x919ead][i%3]);flyer.rotation.z=(hash(cx,cz,i)-.5)*.2;}}
  function bicycle(x,z){const g=new T.Group();g.position.set(x,0,z);g.rotation.set(0,.4,-.16);p.add(g);for(const v of [-.65,.65]){const wheel=mesh(g,'wheel',0,.4,v,1,1,1,0x384648);wheel.rotation.y=Math.PI/2;}for(const [a,b] of [[[0,.4,-.65],[0,.95,-.2]],[[0,.95,-.2],[0,.4,.65]],[[0,.4,-.65],[0,.4,.65]],[[0,.4,.65],[0,1,.4]]])bar(g,a,b,.035,0xa9704b);box(g,0,1,-.2,.28,.07,.32,0x394445);bar(g,[-.22,1.06,.4],[.22,1.06,.4],.025,0x697675);}
  function festoon(a,b){for(const point of [a,b])cylinder(p,point[0],2.6,point[1],.055,5.2,0x4a5550);for(let i=0;i<12;i++){const t=i/12,u=(i+1)/12,y=v=>5.2-Math.sin(v*Math.PI)*.7;bar(p,[a[0]+(b[0]-a[0])*t,y(t),a[1]+(b[1]-a[1])*t],[a[0]+(b[0]-a[0])*u,y(u),a[1]+(b[1]-a[1])*u],.012,0x38423f);mesh(p,'sphere',a[0]+(b[0]-a[0])*t,y(t)-.1,a[1]+(b[1]-a[1])*t,.085,.11,.085,0xffc37a,'lampLight');}}
  if(kind==='town'){
    p.userData.placeName='Market Lane';
    for(const points of marketPaths)chain(points,3.2,0xb7ac95);
    box(p,26,.16,28,25,.22,17,0xa48c72); // Brick beer-garden terrace, clear of shops.
    for(const [x,z] of [[19,24],[28,24],[20,32],[31,32]]){table(p,x,z,z===24);box(p,x,.89,z,.4,.04,.35,0xd1b57b);cylinder(p,x+.28,.97,z,.055,.22,0xb76a46);}
    fence([14,36],[39,36]);fence([39,20],[39,36]);festoon([15,21],[38,34]);festoon([15,34],[38,21]);
    chain([[32,17],[32,20]],2.4);sign(p,'THE BACK PATIO',27,2,36.15,8,.6);
    box(p,-27,.13,22,24,.16,22,0x809065);
    chain([[-10,17],[-27,17],[-34,30]],2.1,0xc5b797);
    for(const [x,z] of [[-23,23],[-34,25]]){table(p,x,z,true);tree(p,x-2,z+5,Math.abs(x),1.15);}
    bench(p,-18,30,-.25);board(-34,13,'ON THIS WEEK');
    for(const x of [-41,41])chain([[x,-35],[x,18]],2.2,0x92928a);
    for(const [x,z] of [[39,-28],[-39,-25],[38,-8]]){bins(p,x,z);for(let i=0;i<3;i++){box(p,x+(i%2)*.8,.3+Math.floor(i/2)*.5,z+1.6,.7,.5,.65,0xb29061);box(p,x+(i%2)*.8,.56+Math.floor(i/2)*.5,z+1.6,.08,.025,.68,0xd8c49b);}}
    bicycle(14,-20);bicycle(-15,8);board(12,37,'MARKET LANE');
    for(const z of [-38,17,37])for(const x of [-11,11])lamp(p,x,z);
    for(const [x,z] of [[-38,33],[-39,7],[39,13],[42,34]])tree(p,x,z,x+z,1.25);
  }else if(kind==='green'){
    p.userData.placeName='Willow Green';
    chain(greenTrail,2.4,0xb7aa87);chain([[9,-39],[15,-26],[23,-15],[29,3],[21,25],[9,39]],2.5,0xc2b894);
    chain([[-9,39],[9,39]],2.5);chain([[9,7],[39,7]],2.1);
    // Low planted landforms create relief without lifting roads or walkways.
    for(const [x,z,sx,sz,h] of [[-33,-21,14,18,4],[-36,21,12,15,3],[37,-26,9,12,2.5]]){
      mesh(p,'sphere',x,-1,z,sx,h+1,sz,0x718753);
      for(let i=0;i<7;i++){const a=i*2.4,r=2+i*.5,dx=Math.sin(a)*r,dz=Math.cos(a)*r,grove=new T.Group();grove.position.y=-1+(h+1)*Math.sqrt(1-(dx/sx)**2-(dz/sz)**2)-.3;p.add(grove);tree(grove,x+dx,z+dz,cx+cz+i,1.2+i%3*.15);}
    }
    box(p,-24,.65,-6,15,1.2,.8,0x9d9a80,'stone');bench(p,-23,-4);bench(p,-27,8,.3);
    for(const [x,z] of [[19,-17],[35,4],[22,20]]){box(p,x,.11,z,3,.08,2.5,0xbca17f);table(p,x,z);}
    // A shallow pond and an open timber pavilion give the trails destinations.
    mesh(p,'cylinder',35,.15,-10,9.6,.15,6.6,0xaaa68a);mesh(p,'cylinder',35,.24,-10,9,.045,6,0x648d8a);
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2,x=35+Math.cos(a)*9.3,z=-10+Math.sin(a)*6.3;mesh(p,'sphere',x,.3,z,.55,.3,.4,0x9c9d88);if(i%2===0)for(let j=0;j<3;j++)bar(p,[x+j*.15,.35,z],[x+j*.16,1.1+hash(i,j)*.5,z+.15],.025,0x677947);}
    const shelter=new T.Group();shelter.position.set(-33,0,1);p.add(shelter);box(shelter,0,.23,0,10,.35,7,0xa49c83);
    for(const x of [-4,4])for(const z of [-2.5,2.5])box(shelter,x,1.9,z,.2,3.5,.2,0x74624b);
    const roof=mesh(shelter,'cone',0,4.2,0,7,1.5,5,0x546d63);roof.rotation.y=Math.PI/4;
    bench(shelter,0,-1.8);bench(shelter,-3,0,Math.PI/2);chain([[-21,9],[-29,9],[-29,1]],2,0xb7aa87);
    for(let i=0;i<4;i++)box(p,32,.11,17+i*3,4,.035,2,[0xad795f,0x8f9caa,0xcaba85,0x728d83][i]);
    for(const x of [15,40]){bar(p,[x,.15,-33],[x,2.2,-33],.06,0xe2dbc4);bar(p,[x,.15,-27],[x,2.2,-27],.06,0xe2dbc4);bar(p,[x,2.2,-33],[x,2.2,-27],.055,0xe2dbc4);}
    board(12,35,'WILLOW GREEN');sign(p,'INTRAMURAL LAWN',27,1.4,-24,12,.55);
    for(const [x,z] of [[-11,-35],[-13,33],[12,9]])lamp(p,x,z);
  }else if(kind==='residential'){
    p.userData.placeName=cx<0?'Maple Court':'Porch Lane';
    for(const side of [-1,1]){
      chain([[side*10,-39],[side*10,39]],2.1);
      for(const z of [-23,20]){chain([[side*10,z],[side*16,z]],1.8);fence([side*17,z-12],[side*42,z-12]);
        bicycle(side*19,z+7);bins(p,side*41,z+6);tree(p,side*40,z-6,z+cx,1.05);
        box(p,side*12,.8,z+3,.12,1.5,.12,0x666852);box(p,side*12,1.55,z+3,.65,.38,.45,0x566d74);
      }
      // Laundry and a shared side yard sit in the gap between the houses.
      bar(p,[side*22,2.8,-8],[side*39,2.8,-8],.016,0x77766b);
      for(const x of [side*22,side*39])cylinder(p,x,1.4,-8,.045,2.8,0x7f8173);
      for(let i=0;i<5;i++)box(p,side*(24+i*2.2),2.2,-8,.9,1.15,.04,[0xc1c2ac,0x97a7ae,0xb08971][i%3]);
      table(p,side*29,0);tree(p,side*38,5,side+cz,1.35);
    }
    board(-12,36,p.userData.placeName.toUpperCase());
  }else if(kind==='library'||kind==='commons'){
    board(10,39,'CAMPUS LIFE');
    for(const [x,z] of [[-25,25],[24,30]]){bicycle(x,z);box(p,x+1,.14,z+1,1.3,.12,.9,0xb49e76);}
    chain([[-7,39],[-18,25]],1.3,0xb9ad8e);
  }
}
