import test from 'node:test';
import assert from 'node:assert/strict';
import {chapterSceneKey} from '../village-startup.js';

test('scene identity ignores ordering and derived ranks but preserves every source field',()=>{
  const a={id:'a',name:'Alpha',joined:14,active:30,school:'School'},b={id:'b',joined:0};
  const key=chapterSceneKey([a,b]);
  assert.equal(key,chapterSceneKey([{joined:0,id:'b',rank:2,progress:0},{...a,rank:1,progress:14/30}]));
  for(const patch of [{joined:15},{active:31},{name:'Beta'},{school:'Other'},{letters:'Α'},{house:2}]){
    assert.notEqual(key,chapterSceneKey([{...a,...patch},b]));
  }
  assert.notEqual(key,chapterSceneKey([a]));
  assert.deepEqual(a,{id:'a',name:'Alpha',joined:14,active:30,school:'School'},'does not reorder or mutate feed objects');
});
