import {hash} from './village-district-layout.js?v=80';
import {smooth} from './village-human-motion.js?v=80';

const clockCache=new WeakMap();

// Integrate a smooth stop/start envelope. Absolute time makes streaming, paused
// camera changes and different frame rates produce exactly the same person.
export function personalClock(person,time){
  const profile=person.motionProfile;
  if(!profile)return {time,motion:1,attention:0};
  const period=24+profile.idlePeriod*1.8,offset=profile.idleOffset;
  let cached=clockCache.get(person);if(!cached){cached={};clockCache.set(person,cached);}
  const sample=t=>{
    const cycle=Math.floor((t+offset)/period),u=t+offset-cycle*period;
    const rest=person.temperament==='purposeful'?1.6:person.temperament==='curious'?5:3.2;
    if(cached.cycle!==cycle){cached.cycle=cycle;cached.start=5+hash(person.identity,cycle,'pause')*(period-rest-8);cached.look=(hash(person.identity,cycle,'look')-.5)*1.1;}
    const start=cached.start,ramp=.8;
    const integral=v=>{const x=Math.max(0,Math.min(1,v));return x*x*x-.5*x*x*x*x;};
    let lost=0,motion=1;
    if(u>start){const v=u-start;
      if(v<ramp){lost=ramp*integral(v/ramp);motion=1-smooth(v/ramp);}
      else if(v<ramp+rest){lost=ramp/2+v-ramp;motion=0;}
      else if(v<2*ramp+rest){const w=v-ramp-rest;lost=ramp/2+rest+w-ramp*integral(w/ramp);motion=smooth(w/ramp);}
      else lost=rest+ramp;
    }
    return {time:cycle*(period-rest-ramp)+u-lost,motion,attention:(1-motion)*cached.look};
  };
  if(cached.origin===undefined)cached.origin=sample(0).time;
  const now=sample(time);
  return {...now,time:now.time-cached.origin};
}

export function conversation(person,time){
  const duration=person.turnDuration??(4.4+hash(person.groupPhase,'cadence')*3.8);
  const turn=(time+(person.groupPhase||0))/duration,index=Math.floor(turn),u=turn-index;
  const size=person.groupSize||3;
  // Shared group seed gives one speaker, occasional silence and uneven turns.
  const seat=Math.floor(hash(person.groupPhase,index,'speaker')*size);
  const speaking=seat===person.seat&&u>.08&&u<.85;
  return {speaking,gesture:speaking?smooth((u-.08)/.2)*smooth((.85-u)/.24)*(.25+.24*Math.sin(time*2+person.phase)**2):0};
}
