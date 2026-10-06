import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdleMotion,signalStrength,SIGNAL_SECONDS} from '../scene-motion.mjs';

function advance(clock,seconds,options){let t;for(let i=0;i<seconds*60;i++)t=clock.advance(1/60,options);return t;}
test('idle motion eases in, settles while interacting, then resumes after a quiet delay',()=>{
 const clock=createIdleMotion();
 const initial=advance(clock,4);assert.ok(initial>2&&initial<4);
 clock.activity();const settled=advance(clock,2,{held:true});
 assert.ok(settled-initial<.2,'interaction should coast less than a fifth of a second');
 assert.ok(advance(clock,2,{held:true})-settled<.00001);
 clock.activity();const waiting=advance(clock,1);assert.ok(waiting-settled<.00001);
 assert.ok(advance(clock,4)-waiting>2,'motion resumes after the idle delay');
});
test('pause, reduced motion, and disabled drift freeze the clock without a catch-up jump',()=>{
 for(const options of [{paused:true},{reduced:true},{enabled:false}]){
  const clock=createIdleMotion(),before=advance(clock,4);
  assert.equal(advance(clock,60,options),before);
  assert.ok(clock.advance(1/60)-before<=1/60);
 }
});
test('arrival signals appear immediately, pulse slowly, and expire without residual glow',()=>{
 assert.equal(signalStrength(0),1);
 assert.ok(signalStrength(1)<signalStrength(2));
 assert.ok(signalStrength(3)<signalStrength(4));
 for(let age=0;age<SIGNAL_SECONDS;age+=.01){assert.ok(signalStrength(age)>=0&&signalStrength(age)<=1);}
 assert.ok(signalStrength(SIGNAL_SECONDS-.001)<.001);
 assert.equal(signalStrength(SIGNAL_SECONDS),0);
 assert.equal(signalStrength(-1),0);
});
test('calm arrivals remain a static highlight until they expire',()=>{
 assert.equal(signalStrength(0,true),signalStrength(6,true));
 assert.equal(signalStrength(SIGNAL_SECONDS,true),0);
});
