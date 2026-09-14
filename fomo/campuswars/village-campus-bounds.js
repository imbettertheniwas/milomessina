// Keep the original campus and stadium; open columns only as Greek Row grows.
export function campusBounds(streets=1,extension=0){
  const left=-Math.floor((streets-1)/2),right=Math.ceil((streets-1)/2);
  const minColumn=Math.min(-1,left-1),maxColumn=Math.max(1,right+1);
  return {minColumn,maxColumn,minX:minColumn*100-48,maxX:maxColumn*100+48,minZ:-148,maxZ:248+extension};
}
export function campusDistrictExists(x,z,streets=1){
  const bounds=campusBounds(streets);
  return x>=bounds.minColumn&&x<=bounds.maxColumn&&z>=-1&&z<=1||x===0&&z===2;
}
export function clampCampusTarget(target,streets=1,extension=0){
  const bounds=campusBounds(streets,extension);
  target.x=Math.max(bounds.minX,Math.min(bounds.maxX,target.x));
  target.z=Math.max(bounds.minZ,Math.min(bounds.maxZ,target.z));
  return target;
}
