import test from 'node:test';
import assert from 'node:assert/strict';
import {crowdMembers,activityPose} from '../village-layout.js';
import {appearance} from '../village-district-layout.js';
import {greekPartyStyle} from '../village-human-style.js';
import {schoolWardrobePalette} from '../village-school-wardrobe.js';
const chapters=Array.from({length:6},(_,i)=>({id:`social-${i}`,name:'Alpha Beta',joined:80,active:100}));
const people=crowdMembers(chapters);
test('most guests socialize, a minority dance, and visitors have distinct schedules',()=>{
  assert.equal(people.length,480);
  const dancers=people.filter(p=>p.danceGuest),visitors=people.filter(p=>p.social);
  assert(dancers.length>40&&dancers.length<110);
  assert(visitors.length>60&&visitors.length<200);
  assert.equal(new Set(visitors.map(p=>p.social.offset)).size,visitors.length);
  for(const p of visitors)assert(!p.danceGuest);
});
test('visitors walk between conversations, enter houses and return without teleporting',()=>{
  for(const p of people.filter(p=>p.social)){
    const s=p.social,period=s.homeWait+s.out.duration+s.awayWait+s.back.duration;
    const home=activityPose(p,-s.offset+1),away=activityPose(p,-s.offset+s.homeWait+s.out.duration+1);
    assert(Math.hypot(away.x-home.x,away.z-home.z)>.2);
    assert.equal(Boolean(away.hidden),Boolean(s.door));
    const again=activityPose(p,-s.offset+period+1);assert(Math.hypot(again.x-home.x,again.z-home.z)<1e-9);
    for(const boundary of [0,s.homeWait,s.homeWait+s.out.duration,s.homeWait+s.out.duration+s.awayWait,period]){
      const a=activityPose(p,boundary-s.offset-1e-5),b=activityPose(p,boundary-s.offset+1e-5);
      assert(Math.hypot(a.x-b.x,a.z-b.z)<.0001);
      assert(Math.abs(a.ground-b.ground)<.0001);
    }
    for(let t=0;t<period;t+=.7){const a=activityPose(p,t),b=activityPose(p,t+.001);assert(Math.hypot(a.x-b.x,a.z-b.z)<.0012);assert.equal(a.dance,undefined);}
  }
});
test('each school gets its own majority wardrobe with neutral variety and stable identities',()=>{
  for(const school of ['San Diego State University','Coastal Carolina University','Western University','Duke University','University of Kansas','The University of Alabama']){
    const palette=schoolWardrobePalette({school}),styles=Array.from({length:1000},(_,i)=>greekPartyStyle(appearance('same-guests',i),{school}));
    const spirit=styles.filter(p=>p.schoolSpirit);assert(spirit.length>780&&spirit.length<860);
    assert(spirit.every(p=>palette.includes(p.schoolBaseColor)));
    assert(new Set(spirit.map(p=>p.shirtColor)).size>50,'fabric shades vary between people');
    for(const p of spirit)for(const shift of [0,8,16])assert(Math.abs((p.shirtColor>>shift&255)-(p.schoolBaseColor>>shift&255))<=32,'fabric keeps the school color family');
    assert(new Set(styles.map(p=>p.outfit)).size>=9);
    assert.deepEqual(styles[12],greekPartyStyle(appearance('same-guests',12),{school}));
  }
  assert.notDeepEqual(schoolWardrobePalette('Western University'),schoolWardrobePalette('Coastal Carolina University'));
  assert.equal(schoolWardrobePalette('An unlisted school'),null);
});
