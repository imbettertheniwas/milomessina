import {hash,pick} from './village-district-layout.js?v=80';

// Coordinated real-world materials, with a stable finish for every address.
const finishes=[
  [0xa9543c,0xf0d6ac,0x36584d,0x443c38], // red brick / limestone / green joinery
  [0xc47d52,0xf3dfbb,0x365367,0x5a4035], // terracotta / cream / navy
  [0xe4c58b,0xffebc9,0x527065,0x80543c], // ochre stucco / sage / clay tile
  [0x8a4439,0xe5cba4,0x3a5155,0x393b40], // oxblood brick / sandstone
  [0x91a58a,0xf1e4c8,0x3b5b50,0x46514e], // sage render / ivory
  [0xd6a08b,0xf6dfc4,0x5c555b,0x6c4b40], // dusty rose / warm white
  [0xe7d5ac,0xffecd0,0x42647a,0x47616a], // limestone / blue metal
  [0x71919e,0xe4dbc3,0x314b61,0x343e4a], // coastal blue / sand
  [0xba925f,0xefdfbb,0x465f51,0x5d4b3a], // buff brick / forest green
  [0xc16845,0xf3cca2,0x5d665b,0x714b37], // burnt sienna / cream
  [0x77845d,0xebd8ac,0x364e48,0x44483c], // olive / natural stone
  [0xd2b696,0xf4e4c8,0x596373,0x544b47], // sandstone / indigo
];
const styles=['brick','stucco','warehouse','terrace','modern','mansion'];

export function skylineAppearance(T,seed){
  const [wall,trim,accent,roof]=pick(finishes,seed,'finish');
  const color=new T.Color(wall).offsetHSL((hash(seed,'hue')-.5)*.025,(hash(seed,'chroma')-.5)*.07,(hash(seed,'tone')-.5)*.06);
  return {wall:color.getHex(),trim,accent,roof,style:pick(styles,seed,'architecture')};
}

export function buildSkylineBuilding(T,kit,parent,s){
  const {box,roof}=kit,{width:w,depth:d,height:h,seed}=s;
  const finish=skylineAppearance(T,seed),{wall,trim,accent,roof:roofColor,style}=finish;
  const g=new T.Group();g.name=`outer-campus-${seed}-${style}`;g.position.set(s.x,0,s.z);
  g.userData.skylineFinish=finish;parent.add(g);
  const masonry=style==='brick'||style==='warehouse'||style==='mansion';
  box(g,0,.3,0,w+.4,.6,d+.4,trim,'stone');
  box(g,0,h/2+.5,0,w,h,d,wall,masonry?'facadeBrick':'stone');
  const floors=Math.max(2,Math.floor(h/3.2)),floorHeight=h/floors;
  // Four complete elevations keep the skyline convincing from every viewpoint.
  for(let side=0;side<4;side++){
    const face=new T.Group();face.rotation.y=side*Math.PI/2;g.add(face);
    const span=side%2?d:w,depth=side%2?w:d,z=depth/2;
    const columns=Math.max(2,Math.floor(span/(style==='warehouse'?3.6:3.1))),bay=(span-1.6)/columns;
    if(style==='modern'){
      box(face,-span*.28,h/2+.5,z+.055,span*.24,h,.1,accent);
      box(face,span*.38,h/2+.5,z+.08,.32,h,.14,trim);
    }
    for(let row=0;row<floors;row++){
      const y=.65+(row+.5)*floorHeight;
      if(style==='brick'||style==='warehouse')box(face,0,.52+(row+1)*floorHeight,z+.09,span+.18,.13,.19,trim);
      for(let col=0;col<columns;col++){
        const x=(col-(columns-1)/2)*bay,ww=bay*(style==='warehouse'?.78:.57),wh=Math.min(2.05,floorHeight*.62);
        // Clear the central ground-floor bay for a properly framed front door.
        if(side===0&&row===0&&Math.abs(x)<1.2)continue;
        box(face,x,y,z+.08,ww+.24,wh+.25,.16,style==='modern'?accent:trim);
        const glass=pick([0x416171,0x547987,0x314f60,0x789298,0xc9ab77],seed,side,row,col,'glass');
        box(face,x,y,z+.175,ww,wh,.045,glass);
        box(face,x,y,z+.21,.055,wh,.035,trim);
        if(style!=='modern')box(face,x,y+.13,z+.21,ww,.06,.035,trim);
        box(face,x,y-wh/2-.16,z+.19,ww+.38,.13,.36,trim);
        if(style==='stucco'||style==='mansion')for(const direction of [-1,1]){
          box(face,x+direction*(ww/2+.29),y,z+.13,.32,wh+.13,.12,accent);
        }
        if(style==='terrace'&&row>0&&(col+side)%2===0){
          box(face,x,y-wh/2-.2,z+.53,ww+.6,.13,1.05,trim);
          box(face,x,y-wh/2+.48,z+1.02,ww+.6,.08,.065,accent);
          for(const dx of [-.5,0,.5])box(face,x+dx*ww,y-wh/2+.12,z+1.02,.055,.7,.055,accent);
          for(const direction of [-1,1])box(face,x+direction*(ww/2+.27),y-wh/2+.15,z+.58,.055,.65,.9,accent);
        }
      }
    }
    if(style==='warehouse'||style==='mansion')for(const direction of [-1,1]){
      box(face,direction*(span/2-.25),h/2+.5,z+.1,.48,h,.22,style==='warehouse'?accent:trim);
    }
  }
  // Doors, stone steps and individual canopies establish a believable street scale.
  box(g,0,1.55,d/2+.11,1.8,2.5,.2,trim);
  box(g,0,1.5,d/2+.24,1.45,2.3,.08,accent);
  box(g,0,1.94,d/2+.29,1.13,1.12,.035,0x8da6a6);
  box(g,.47,1.28,d/2+.35,.045,.28,.05,0xd8b67a);
  box(g,0,.16,d/2+.64,2.7,.3,1.25,trim);
  box(g,0,2.99,d/2+.66,3,.16,1.45,style==='stucco'?roofColor:accent);
  box(g,0,h+.65,0,w+.65,.3,d+.65,trim);
  if(style==='stucco'||style==='mansion'){
    roof(g,w+.9,d+.9,h+.85,Math.min(3.2,w*.2),roofColor);
    box(g,-w*.24,h+1.55,-d*.15,.72,2,.85,wall,'facadeBrick');
    box(g,-w*.24,h+2.58,-d*.15,.93,.15,1.05,trim);
  }else{
    box(g,0,h+.84,0,w-.3,.08,d-.3,roofColor);
    for(const direction of [-1,1]){
      box(g,0,h+1,direction*(d/2-.1),w,.48,.22,wall);
      box(g,direction*(w/2-.1),h+1,0,.22,.48,d,wall);
    }
    if(style==='modern'){
      box(g,-w*.15,h+1.62,-d*.16,w*.42,1.6,d*.4,accent);
      box(g,-w*.15,h+2.48,-d*.16,w*.44,.14,d*.42,trim);
    }else{
      box(g,w*.22,h+1.23,-d*.15,1.5,.7,1.3,0x726e5f);
      for(let i=0;i<3;i++)box(g,w*.22,h+1.62,-d*.15+(i-1)*.32,1.3,.055,.12,trim);
    }
    if(style==='terrace'){
      for(const x of [-w*.3,w*.3]){box(g,x,h+1.15,d*.27,1.7,.55,.7,0xa26a47);box(g,x,h+1.51,d*.27,1.6,.34,.65,0x647b48);}
    }
  }
  return g;
}
