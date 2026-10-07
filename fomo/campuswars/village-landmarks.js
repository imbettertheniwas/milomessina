// National-village amenities sit behind the house backyards. The outer road
// encloses both sites; school islands use their own compact street layout.
export const OUTER_ROAD_X=150;
export const STADIUM_SITE={x:-88,z:70,width:82,depth:84,extensionFactor:.2};
export const HELIPAD_SITE={x:72,z:62,radius:24,extensionFactor:.25};
export const landmarkX=(site,streets=1)=>site.x+(site.x<0?-Math.floor((streets-1)/2):Math.ceil((streets-1)/2))*100;
export const landmarkZ=(site,extension=0)=>site.z+extension*site.extensionFactor;

// Cheap invisible hit volumes keep hover work independent of model detail.
export function landmarkTarget(T,root,resources,action,width,height,depth,y=height/2){
  const geometry=new T.BoxGeometry(width,height,depth),material=new T.MeshBasicMaterial({visible:false});
  resources.add(geometry);resources.add(material);
  const target=new T.Mesh(geometry,material);target.position.y=y;
  target.name=`${action}-click-target`;target.userData.action=action;root.add(target);
  return target;
}
