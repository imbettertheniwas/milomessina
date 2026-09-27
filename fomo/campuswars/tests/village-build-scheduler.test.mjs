import test from 'node:test';
import assert from 'node:assert/strict';
import {yieldVillageBuild} from '../village-build-scheduler.js';

test('startup yields through the browser scheduler without waiting for a display frame',async()=>{
  let resume,called=0,finished=false;
  const scheduler={yield(){assert.equal(this,scheduler);called++;return new Promise(resolve=>{resume=resolve;});}};
  const pending=yieldVillageBuild({scheduler}).then(()=>{finished=true;});
  assert.equal(called,1);await Promise.resolve();assert.equal(finished,false);
  resume();await pending;assert.equal(finished,true);
});

test('startup falls back to a browser task and releases both message ports',async()=>{
  let channel,posted=false,closed=0,finished=false;
  class TaskChannel{
    constructor(){channel=this;this.port1={close(){closed++;}};this.port2={close(){closed++;},postMessage(){posted=true;}};}
  }
  const pending=yieldVillageBuild({MessageChannel:TaskChannel}).then(()=>{finished=true;});
  assert.equal(posted,true);await Promise.resolve();assert.equal(finished,false);
  channel.port1.onmessage();await pending;
  assert.equal(finished,true);assert.equal(closed,2);
});

test('startup remains usable without browser scheduling APIs',async()=>{
  let resume,finished=false;
  const pending=yieldVillageBuild({setTimeout(callback,delay){assert.equal(delay,0);resume=callback;}}).then(()=>{finished=true;});
  await Promise.resolve();assert.equal(finished,false);
  resume();await pending;assert.equal(finished,true);
});
