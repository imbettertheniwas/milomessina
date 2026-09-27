// Feed ordering, derived ranks and object-key ordering do not change a house.
// Keep every source field in the key so real roster/artwork changes still build.
export function chapterSceneKey(chapters){
  return JSON.stringify(chapters.map(chapter=>Object.fromEntries(
    Object.keys(chapter).filter(key=>key!=='rank'&&key!=='progress').sort().map(key=>[key,chapter[key]])
  )).sort((a,b)=>a.id.localeCompare(b.id)));
}
