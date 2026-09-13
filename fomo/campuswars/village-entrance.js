import {createEntranceEyesTexture} from './village-floor-logo.js?v=36';
import {districtSpecs} from './village-district-layout.js?v=77';

export function createVillageEntrance(T,extension=0){
  const buildings=districtSpecs(0,1),gym=buildings.find(b=>b.type==='gym'),residence=buildings.find(b=>b.type==='residence');
  const left=gym.x+gym.width/2,right=residence.x-residence.width/2,span=(right-left)/2;
  const width=Math.min(15.2,right-left-2),half=width/2,height=Math.min(gym.height,residence.height)-1.35;
  const root=new T.Group();root.name='fomo-row-entrance';
  root.position.set((left+right)/2,0,Math.max(gym.z-gym.depth/2,residence.z-residence.depth/2)+5+extension);
  const metal=new T.MeshStandardMaterial({color:0x344350,roughness:.52,metalness:.6});
  function add(geometry,material,x,y,z=0){const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;}
  const geometry=new T.PlaneGeometry(width,3.4,32,4),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),sag=1-(x/half)**2;
    positions.setY(i,y-.32*sag);
    positions.setZ(i,.055*Math.sin(x*1.7)*sag+.018*Math.sin(y*3+x));
  }
  geometry.computeVertexNormals();
  const map=createEntranceEyesTexture(T);
  const fabric=new T.MeshStandardMaterial({color:map?0xffffff:0x626cf3,map,roughness:.9,metalness:0,emissive:0xffffff,emissiveMap:map,emissiveIntensity:map?.14:0});
  // Two outward faces preserve the original eyes' orientation from either approach.
  for(const side of [-1,1]){
    const banner=add(geometry,fabric,0,height,side*.012);banner.rotation.y=side<0?Math.PI:0;banner.name=side<0?'fomo-eyes-banner-front':'fomo-eyes-banner-back';
    banner.userData.ownedGeometry=true;
  }
  const cableGeometry=new T.CylinderGeometry(.023,.023,1,6);
  function cable(a,b){const start=new T.Vector3(...a),end=new T.Vector3(...b),direction=end.clone().sub(start);const mesh=add(cableGeometry,metal,...start.clone().add(end).multiplyScalar(.5).toArray());mesh.scale.y=direction.length();mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());}
  const bracketGeometry=new T.BoxGeometry(.08,.16,.24);
  for(const side of [-1,1]){
    for(const [mountY,edgeY] of [[height+2.05,height+1.7],[height-1.35,height-1.7]]){
      const bracket=add(bracketGeometry,metal,side*span,mountY);bracket.name='building-banner-anchor';
      bracket.userData.ownedGeometry=true;
      cable([side*span,mountY,0],[side*half,edgeY,0]);
    }
  }
  return root;
}
