import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {islandFootprint,islandOutline,islandFloorGeometry,islandOverview,createFloatingIsland} from '../village-island.js';
import {createLots} from '../village-layout.js';
import {createVillage} from '../village-world.js';
import {schoolTheme,createSchoolDistricts} from '../village-school-theme.js';
import {createSchoolDrop,SCHOOL_DROP_DURATION} from '../village-school-drop.js';
const chapters=(n,joined=20)=>Array.from({length:n},(_,i)=>({id:'c'+i,name:'Chapter '+i,letters:'ABC',school:'Test University',joined,active:100}));
const area=s=>s.rx*s.rz;
test('island grows with chapter count and joined members, including a starter island',()=>{
 let previous=0;for(const n of [0,1,2,6,19,20,40,100]){const spec=islandFootprint(chapters(n));assert(area(spec)>previous);previous=area(spec);}
 const small=islandFootprint(chapters(6,10)),big=islandFootprint(chapters(6,100));assert(big.rx>small.rx);assert(big.rz>small.rz);assert(big.depth>small.depth);
 assert.deepEqual(small,islandFootprint(chapters(6,10).map(c=>({...c,active:1000}))),'roster targets never substitute for joined members');
});
function inside([x,z],polygon){let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,zi]=polygon[i],[xj,zj]=polygon[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)result=!result;}return result;}
test('houses and claim lots remain supported as islands expand to multiple streets',()=>{
 for(const count of [0,1,6,19,20,40,100]){const spec=islandFootprint(chapters(count)),outline=islandOutline(spec,'test');for(const lot of createLots(count))for(const dx of [-20,20])for(const dz of [-9,9])assert(inside([lot.x+dx,lot.z+dz],outline),`unsupported corner on ${count} chapters`);}
});
test('island floors end at the rock outline and face upward without an infinite terrain plane',()=>{
 const input=chapters(6),theme=schoolTheme({id:'school-test',name:'Test University'}),village=createVillage(T,input,{theme,metric:'members'}),spec=islandFootprint(input);
 const floor=village.streets;assert(floor.userData.island);floor.geometry.computeBoundingBox();assert(floor.geometry.boundingBox.max.x<spec.x+spec.rx*1.05);assert(floor.geometry.boundingBox.min.x>spec.x-spec.rx*1.05);assert.equal(floor.geometry.attributes.normal.getZ(0),1);assert(!village.world.getObjectByName('fomo-row-entrance'));village.dispose();
});
test('floating campus has a deep rocky underside, bounded cloud instances and disposes resources',()=>{
 const island=createSchoolDistricts(T,{id:'school-test',name:'Test University'},0,chapters(6));const rock=island.root.getObjectByName('island-rock-undercut');rock.geometry.computeBoundingBox();assert(rock.geometry.boundingBox.min.y<-50);assert.equal(island.root.getObjectByName('island-clouds').count,60);let released=0;rock.geometry.addEventListener('dispose',()=>released++);island.dispose();assert.equal(released,1);
});
test('parachute arrival ends at the full island overview with a continuous orbit handoff',()=>{
 for(const aspect of [.46,1.78]){const overview=islandOverview(islandFootprint(chapters(6,50)),aspect),drop=createSchoolDrop(T,new T.Scene()),camera=new T.PerspectiveCamera(48,aspect);drop.begin({anchor:{lot:{z:-19}},aspect,overview});const pose=drop.update(SCHOOL_DROP_DURATION,camera);assert.deepEqual(pose,overview);const target=new T.Vector3(...pose.target),expected=target.clone().add(new T.Vector3(Math.sin(pose.theta)*Math.cos(pose.phi)*pose.radius,Math.sin(pose.phi)*pose.radius,Math.cos(pose.theta)*Math.cos(pose.phi)*pose.radius));assert(camera.position.distanceTo(expected)<1e-8);
 const island=createFloatingIsland(T,{id:'school-test'},chapters(6,50)),vertices=island.root.getObjectByName('island-rock-undercut').geometry.attributes.position;
 for(let i=0;i<vertices.count;i++){const point=new T.Vector3().fromBufferAttribute(vertices,i).project(camera);assert(Math.abs(point.x)<1&&Math.abs(point.y)<1,'the entire island must fit the viewport');}
 island.dispose();drop.dispose();}
});

test('school islands and their roads are centered on the occupied and claim rows',()=>{
 for(const count of [0,1,2,3,6,19,20,40]){
  const lots=createLots(count),first=Math.min(...lots.map(l=>l.z)),last=Math.max(...lots.map(l=>l.z)),spec=islandFootprint(chapters(count));
  assert.equal(spec.z,(first+last)/2,'equal land on both ends of the chapter row');
  assert.equal((spec.streetStart+spec.streetEnd)/2,spec.z,'the road follows the same center');
  assert.equal(first-spec.streetStart,spec.streetEnd-last,'equal road beyond the first and last plots');
 }
});
