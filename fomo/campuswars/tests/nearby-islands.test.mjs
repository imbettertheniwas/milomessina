import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {schoolSeparation,nearbySchools,nearbyIslandLayout,createNearbyIslands} from '../village-nearby-islands.js';

const school=(id,lat,lon,chapters=[{id:'chapter'}])=>({id,name:id,lat,lon,chapters});
const origin=school('home',32.77525,-117.071228);
const spec={x:0,z:20,rx:70,rz:100,depth:45};

test('real campus coordinates produce the correct distance and northwestern bearing',()=>{
 const result=schoolSeparation(origin,school('ucsd',32.879243,-117.231124));
 assert(result.km>18&&result.km<21);assert(result.bearing<0&&result.bearing>-Math.PI/2);
 const dateline=schoolSeparation(school('west',0,179.9),school('east',0,-179.9));
 assert(dateline.km<23);assert(dateline.bearing>0);
});

test('only the nearest registered schools with verified coordinates become destinations',()=>{
 const near=school('near',32.8,-117.1),far=school('far',34,-118),closerEmpty=school('empty',32.78,-117.07,[]);
 const input=[origin,far,near,near,closerEmpty,school('missing',null,null),school('invalid',95,0)];
 assert.deepEqual(nearbySchools(origin,input).map(n=>n.school.id),['near','far']);
 assert.equal(nearbySchools(origin,input,1).length,1);
 assert.deepEqual(nearbySchools(school('unknown',undefined,undefined),input),[]);
});

test('layout keeps real directions, separates collinear islands, and stays beyond large campuses',()=>{
 const home=school('home',0,0),others=Array.from({length:6},(_,i)=>school('north'+i,.01+i*.01,0));
 for(const bounds of [spec,{...spec,rx:400,rz:600}]){
  const layout=nearbyIslandLayout(home,others,bounds);
  assert.equal(layout.length,6);
  for(let i=0;i<layout.length;i++){
   const p=layout[i];assert(Math.abs(p.x-bounds.x)<1e-8);assert(p.z<bounds.z-bounds.rz-p.radius);
   for(const q of layout.slice(i+1))assert(Math.hypot(p.x-q.x,p.z-q.z)>p.radius+q.radius+50);
  }
 }
});

test('island meshes are raycastable school destinations and update without retaining old destinations',()=>{
 const neighbors=createNearbyIslands(T,{documentRef:null});
 neighbors.setSchool(origin,[school('ucsd',32.879243,-117.231124)],spec);
 assert.equal(neighbors.schools.length,1);assert(neighbors.pickables.length<=12);
 neighbors.root.updateMatrixWorld(true);
 const island=neighbors.root.children[0],ray=new T.Raycaster(new T.Vector3(island.position.x,200,island.position.z),new T.Vector3(0,-1,0));
 assert.equal(ray.intersectObjects(neighbors.pickables,false)[0].object.userData.school,'ucsd');
 const previous=island;neighbors.setSchool(origin,[school('ucsd',32.879243,-117.231124)],spec);assert.equal(neighbors.root.children[0],previous,'unchanged data reuses geometry');
 neighbors.setSchool(null,[],spec);assert.equal(neighbors.pickables.length,0);assert.equal(neighbors.root.children.length,0);
 neighbors.setSchool(origin,[school('next',34,-118)],spec);assert(neighbors.pickables.every(m=>m.userData.school==='next'));assert(neighbors.farDistance>2000);
 let disposed=0;neighbors.pickables[0].geometry.addEventListener('dispose',()=>disposed++);neighbors.dispose();assert.equal(disposed,1);assert.equal(neighbors.pickables.length,0);
});

test('accessible school labels use literal names and activate the same destination as the island',()=>{
 const make=()=>({children:[],style:{},dataset:{},setAttribute(k,v){this[k]=v;},append(...children){this.children.push(...children);},addEventListener(k,fn){this[k]=fn;},remove(){}});
 const host=make(),destinations=[],name='<img onerror=alert(1)>';
 const neighbors=createNearbyIslands(T,{host,documentRef:{createElement:make},onTravel:id=>destinations.push(id)});
 neighbors.setSchool(origin,[{...school('near',33,-117),name}],spec);
 const button=host.children[0].children[0];assert.equal(button.children[0].textContent,name);assert(button['aria-label'].includes(name));button.click();assert.deepEqual(destinations,['near']);neighbors.dispose();
});
