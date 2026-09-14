import test from 'node:test';
import assert from 'node:assert/strict';
import {createFramePacer} from '../village-frame-pacing.js';

test('jittery 30 Hz Safari callbacks do not turn into a 15 Hz animation',()=>{
  const pacer=createFramePacer(30);let count=0;
  for(let i=0;i<300;i++)if(pacer.due(i*1000/30+(i%2?-.9:.9)))count++;
  assert.equal(count,300);
});
test('120 Hz displays remain capped and a hidden tab resumes immediately',()=>{
  const pacer=createFramePacer(30);let count=0;
  for(let i=0;i<120;i++)if(pacer.due(i*1000/120))count++;
  assert.equal(count,30);assert(pacer.due(10000));
  assert(!pacer.due(10001));pacer.reset();assert(pacer.due(10002));
});
