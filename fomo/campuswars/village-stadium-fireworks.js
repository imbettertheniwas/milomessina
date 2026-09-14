// A fixed particle pool follows the village clock, including pause and catch-up.
export function createStadiumFireworks(T){
  const shells=4,sparks=64,trails=3,rocketTrail=14,perShell=sparks*trails+rocketTrail,count=shells*perShell;
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('color',new T.BufferAttribute(colors,3).setUsage(T.DynamicDrawUsage));
  geometry.boundingSphere=new T.Sphere(new T.Vector3(0,32,0),63);
  const pixels=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const i=(y*32+x)*4,r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
    pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(255*Math.max(0,1-r)**2);
  }
  const texture=new T.DataTexture(pixels,32,32);texture.needsUpdate=true;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;
  const material=new T.PointsMaterial({size:1.45,map:texture,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,fog:false});
  const root=new T.Points(geometry,material);root.name='stadium-fireworks';root.visible=false;
  const palette=[0xffce65,0x65dfff,0xff75ba,0xbca0ff].map(hex=>new T.Color(hex));
  let lastTime=NaN;
  function particle(index,x,y,z,tint,light){
    const offset=index*3;positions[offset]=x;positions[offset+1]=y;positions[offset+2]=z;
    colors[offset]=tint.r*light;colors[offset+1]=tint.g*light;colors[offset+2]=tint.b*light;
  }
  function animate(time){
    if(!root.visible||time===lastTime)return;lastTime=time;
    for(let shell=0;shell<shells;shell++){
      const age=((time+shell*1.5)%6+6)%6,launchX=shell%2?27:-27,launchZ=shell<2?-23:23;
      const apex=38+shell%2*5,tint=palette[shell],base=shell*perShell,rise=1.35;
      // Comets climb from the stadium roof before opening into falling sparks.
      for(let trail=0;trail<rocketTrail;trail++){
        const t=age-trail*.025,progress=Math.max(0,Math.min(1,t/rise));
        particle(base+trail,launchX*(1-progress*.18),11.8+(apex-11.8)*progress,launchZ,tint,t>=0&&t<rise?(1-trail/rocketTrail)*3:0);
      }
      for(let spark=0;spark<sparks;spark++){
        const vertical=1-2*(spark+.5)/sparks,radial=Math.sqrt(1-vertical*vertical),angle=spark*2.39996323+shell;
        const speed=6+(spark%7)*.45;
        for(let trail=0;trail<trails;trail++){
          const t=age-rise-trail*.055,elapsed=Math.max(0,Math.min(3,t)),spread=speed*elapsed;
          const fade=t>=0&&t<3?Math.pow(1-t/3,1.4)*(1-trail/trails)*2.6:0;
          particle(base+rocketTrail+spark*trails+trail,launchX*.82+Math.cos(angle)*radial*spread,apex+vertical*spread-.65*elapsed*elapsed,launchZ+Math.sin(angle)*radial*spread,tint,fade);
        }
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
  }
  return {root,animate,setEnabled(enabled,time){root.visible=Boolean(enabled);if(root.visible){lastTime=NaN;animate(time);}},dispose(){geometry.dispose();material.dispose();texture.dispose();root.removeFromParent();}};
}
