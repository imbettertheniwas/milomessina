import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {houseStandings,createCompetition} from '../village-competition.js';

test('percentage ties award higher ranks to larger joined totals, with stable genuine ties',()=>{
  const input=[{id:'small',joined:40,active:50},{id:'large',joined:80,active:100},{id:'equal',joined:80,active:100},{id:'higher',joined:9,active:10},{id:'empty',joined:0,active:0}];
  const expected=[['higher',1],['equal',2],['large',2],['small',4]];
  assert.deepEqual(houseStandings(input).map(c=>[c.id,c.rank]),expected);
  assert.deepEqual(houseStandings([...input].reverse()).map(c=>[c.id,c.rank]),expected);
  const changed=input.map(c=>c.id==='small'?{...c,joined:81,active:100}:c);
  assert.equal(houseStandings(changed)[1].id,'small');
});

test('scroll cycles all ten chapters seamlessly, freezes at the same time, and exposes all rows with reduced motion',t=>{
  // Use real Three.js textures and UV transforms; only the canvas painter is stubbed.
  const context=new Proxy({},{get:()=>()=>{}});
  const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),originalPath=Object.getOwnPropertyDescriptor(globalThis,'Path2D');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>context})}});
  Object.defineProperty(globalThis,'Path2D',{configurable:true,value:class{}});
  t.after(()=>{for(const [key,descriptor] of [['document',originalDocument],['Path2D',originalPath]]){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const chapters=Array.from({length:12},(_,i)=>({id:`chapter-${i}`,name:`Chapter ${i}`,joined:100-i,active:100}));
  const competition=createCompetition(T,chapters,[]),map=competition.board.getObjectByName('leaderboard-scrolling-rows').material.map;
  assert.equal(competition.topChapters.length,10);
  assert.deepEqual(competition.topChapters.map(c=>c.id),chapters.slice(0,10).map(c=>c.id));
  const rowAtTop=()=>{map.updateMatrix();return Math.floor(map.transformUv(new T.Vector2(.5,.999999)).y*10);};
  for(let row=0;row<10;row++){competition.animate(row*3.2);assert.equal(rowAtTop(),row);}
  competition.animate(0);const start=map.offset.y;
  competition.animate(32);assert.equal(map.offset.y,start);
  competition.animate(13);const frozen=map.offset.y,version=map.version;
  competition.animate(13);assert.equal(map.offset.y,frozen);assert.equal(map.version,version,'scrolling must not reupload the canvas');
  competition.animate(13,true);assert.equal(map.repeat.y,1);assert.equal(map.offset.y,0);
  competition.animate(25,true);assert.equal(map.offset.y,0);
  const back=competition.board.getObjectByName('leaderboard-fomo-graffiti');
  assert(back.position.z<-.255,'artwork sits behind the rear support posts');
  assert.equal(back.rotation.y,Math.PI);
  const single=createCompetition(T,chapters.slice(0,1),[]),singleMap=single.board.getObjectByName('leaderboard-scrolling-rows').material.map;
  single.animate(12);assert.equal(singleMap.offset.y,0);assert.equal(singleMap.repeat.y,1);
  const empty=createCompetition(T,[],[]);empty.animate(100);assert.equal(empty.topChapters.length,0);assert.equal(empty.board.getObjectByName('leaderboard-scrolling-rows').visible,false);
});
