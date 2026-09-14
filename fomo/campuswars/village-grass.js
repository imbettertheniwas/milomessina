import {villageQuality} from './village-quality.js?v=92';
import {hash} from './village-district-layout.js?v=80';
import {lawnGround,toWorld} from './village-layout.js?v=80';
const textures=new WeakMap();
export const GRASS_COLOR=0x718753;
// Numeric, periodic noise makes the small grass tile seamless without an asset download.
function noiseHash(x,y){let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function noise(x,y,period){const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v),at=(i,j)=>noiseHash((i+period)%period,(j+period)%period);return (at(a,b)*(1-s)+at(a+1,b)*s)*(1-t)+(at(a,b+1)*(1-s)+at(a+1,b+1)*s)*t;}
export function grassTexture(T){
  if(textures.has(T))return textures.get(T);
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const patch=noise(x/64,y/64,8),grain=noiseHash(x,y),small=noise(x/8,y/8,64),dry=Math.max(0,(patch-.55)*2),i=(y*512+x)*4;
    pixels.data[i]=76+small*27+grain*24+dry*30;pixels.data[i+1]=102+small*29+grain*22+dry*13;pixels.data[i+2]=41+small*20+grain*15+dry*19;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);ctx.lineCap='round';
  for(let i=0;i<22000;i++){
    const x=noiseHash(i,9)*512,y=noiseHash(i,17)*512,length=2+noiseHash(i,23)*7,dx=(noiseHash(i,31)-.5)*length;
    const hue=noiseHash(i,47);ctx.strokeStyle=hue>.88?'#b1a474aa':hue>.45?'#9eb96ca0':'#415b2b80';ctx.lineWidth=.55+noiseHash(i,51)*.5;
    for(const ox of x<8?[0,512]:x>504?[0,-512]:[0])for(const oy of y<10?[0,512]:y>502?[0,-512]:[0]){
      ctx.beginPath();ctx.moveTo(x+ox,y+oy);ctx.quadraticCurveTo(x+ox+dx*.2,y+oy-length*.65,x+ox+dx,y+oy-length);ctx.stroke();
    }
  }
  const map=new T.CanvasTexture(canvas);map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=villageQuality().mobile?4:16;map.minFilter=T.LinearMipmapLinearFilter;map.colorSpace=T.NoColorSpace;
  textures.set(T,map);return map;
}
export function createGrassMaterial(T,map=null,mask=null,bounds=null){
  const mobile=villageQuality().mobile;
  const detail=grassTexture(T),material=new T.MeshStandardMaterial({roughness:1,color:map?0xffffff:GRASS_COLOR,...(map?{map}:{}),transparent:false,alphaTest:0,depthWrite:true});
  material.name=mask?'campus-grass-and-pavement':'chapter-lawn-grass';
  if(!detail)return material;
  material.defines={...(material.defines||{}),...(mask?{USE_GRASS_MASK:1}:{})};
  material.customProgramCacheKey=()=>`grass-v2-${Boolean(mask)}-${mobile}-${Boolean(bounds)}`;
  material.onBeforeCompile=shader=>{
    shader.uniforms.grassDetail={value:detail};shader.uniforms.grassMask={value:mask};
    shader.uniforms.campusBounds={value:bounds||new T.Vector4(-1e6,1e6,-1e6,1e6)};
    shader.vertexShader='varying vec3 vGrassWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 grassWorld=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
      grassWorld=instanceMatrix*grassWorld;
      #endif
      vGrassWorld=(modelMatrix*grassWorld).xyz;`);
    shader.fragmentShader='uniform sampler2D grassDetail;\nuniform sampler2D grassMask;\nuniform vec4 campusBounds;\nvarying vec3 vGrassWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float grassAmount=1.0;
      #ifdef USE_GRASS_MASK
      grassAmount=texture2D(grassMask,vMapUv).r;
      float outside=max(max(campusBounds.x-vGrassWorld.x,vGrassWorld.x-campusBounds.y),max(campusBounds.z-vGrassWorld.z,vGrassWorld.z-campusBounds.w));
      float edge=smoothstep(0.0,24.0,outside);
      grassAmount=mix(grassAmount,1.0,edge);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.165,.247,.086),edge);
      #endif
      vec2 grassUv=vGrassWorld.xz/2.8;
      vec3 grassSample=texture2D(grassDetail,grassUv).rgb;
      vec3 grassLinear=pow(grassSample,vec3(2.2));
      // Broad variation and soft mowing direction survive at the overview scale.
      float meadow=1.0+.06*sin(vGrassWorld.x*.41+sin(vGrassWorld.z*.27))+.045*sin(vGrassWorld.z*.73+vGrassWorld.x*.32);
      float mowing=1.0+.027*sin((vGrassWorld.x+vGrassWorld.z*.22)*1.12);
      vec3 grassTint=clamp(diffuseColor.rgb/vec3(.165,.247,.086),vec3(.68),vec3(1.32));
      diffuseColor.rgb=mix(diffuseColor.rgb,grassLinear*grassTint*meadow*mowing,grassAmount);`);
    if(!mobile)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float grassX=texture2D(grassDetail,grassUv+vec2(1.0/512.0,0.0)).g;
      float grassZ=texture2D(grassDetail,grassUv+vec2(0.0,1.0/512.0)).g;
      normal=normalize(normal+mat3(viewMatrix)*vec3(grassSample.g-grassX,0.0,grassSample.g-grassZ)*grassAmount*.65);`);
  };
  return material;
}

export function createLawnBlades(T,lots){
  const positions=[],colors=[];
  for(let blade=0;blade<5;blade++){
    const angle=blade*Math.PI*.76,x=Math.sin(angle)*.045,z=Math.cos(angle)*.045,dx=Math.cos(angle)*.014,dz=-Math.sin(angle)*.014,height=.065+blade*.012,bend=.025;
    const verts=[[x-dx,0,z-dz],[x+dx,0,z+dz],[x-dx*.45+bend,height*.57,z-dz*.45],[x+dx*.45+bend,height*.57,z+dz*.45],[x+bend*1.7,height,z]];
    for(const index of [0,1,2,1,3,2,2,3,4]){positions.push(...verts[index]);colors.push(...(index<2?[.24,.31,.11]:index===4?[.52,.63,.26]:[.37,.48,.17]));}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const count=lots.length*220,mesh=new T.InstancedMesh(geometry,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}),count),dummy=new T.Object3D();
  mesh.name='foreground-grass-blades';mesh.receiveShadow=true;mesh.castShadow=false;
  lots.forEach((lot,index)=>{for(let i=0;i<220;i++){
    const seed=lot.sourceIndex??index;
    let x=(hash(seed,i,'blade-x')-.5)*14.4,z=7.1+hash(seed,i,'blade-z')*6.6;
    if(Math.abs(x)<1.1)x+=(x<0?-1:1)*1.2;
    const pos=toWorld(lot,x,z),size=.65+hash(seed,i,'blade-size')*.7;
    dummy.position.set(pos.x,lawnGround(x,z)+.008,pos.z);dummy.rotation.y=hash(seed,i,'blade-angle')*Math.PI*2;dummy.scale.setScalar(size);dummy.updateMatrix();mesh.setMatrixAt(index*220+i,dummy.matrix);
  }});
  mesh.computeBoundingSphere();return mesh;
}
