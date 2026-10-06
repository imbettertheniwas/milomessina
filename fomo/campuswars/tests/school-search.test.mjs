import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeSchoolCatalog,schoolDestinations} from '../village-destinations.js';
import {searchSchools,SCHOOL_PROMPT_DELAY} from '../village-school-search.js';
import {createSchoolPromptTimer} from '../village-school-prompt.js';
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url))).schools;
const us=read('us-college-catalog.json');
const catalog=mergeSchoolCatalog(mergeSchoolCatalog(read('schools.json'),read('school-search-catalog.json')),us,{matchDomains:false});
const schools=schoolDestinations([],catalog);
test('all active federal directory colleges are available without collapsing separate campuses',()=>{
 assert(us.length>5900);
 for(const school of us)assert(catalog.some(s=>s.id===school.id||s.unitid===school.id),school.name+' is missing');
 const shared=mergeSchoolCatalog([],[{id:'1',name:'Community College',aliases:[],website:'cc.edu',city:'Austin'},{id:'2',name:'Community College',aliases:[],website:'cc.edu',city:'Dallas'}],{matchDomains:false});
 assert.equal(shared.length,2);
});
test('official aliases, typed initials, and punctuated initials find colleges',()=>{
 for(const [query,name] of [['SMU','Southern Methodist'],['s.m.u.','Southern Methodist'],['U C L A','Los Angeles'],['UCLA','Los Angeles'],['LSU','Louisiana State University'],['SDSU','San Diego State'],['MIT','Massachusetts Institute'],['UTEP','Texas at El Paso'],['BMCC','Borough of Manhattan'],['UTSA','Texas at San Antonio']]){
  assert(searchSchools(schools,query).some(s=>s.name.includes(name)),query+' should find '+name);
 }
 const noAlias=[{name:'Southern Methodist University',aliases:[]},{name:'University of California Los Angeles',aliases:[]}];
 assert.equal(searchSchools(noAlias,'SMU')[0].name,noAlias[0].name);assert.equal(searchSchools(noAlias,'UCLA')[0].name,noAlias[1].name);
 assert(searchSchools(schools,'Borough of Manhattan').some(s=>s.name.includes('Borough of Manhattan')));
});
function clock(){let time=0,id=0,calls=0;const jobs=new Map();const timer=createSchoolPromptTimer({show:()=>calls++,now:()=>time,schedule:(fn,delay)=>{jobs.set(++id,{fn,at:time+delay});return id;},cancel:id=>jobs.delete(id)});return {timer,get calls(){return calls;},advance(ms){time+=ms;for(const [id,job] of jobs)if(job.at<=time){jobs.delete(id);job.fn();}}};}
const state={ready:true,visible:true,introFinished:true};
test('school prompt waits until six seconds after the intro ends, including a skipped intro',()=>{
 assert.equal(SCHOOL_PROMPT_DELAY,6000);const c=clock();c.timer.update({...state,introFinished:false});c.advance(60000);assert.equal(c.calls,0);
 c.timer.update(state);c.advance(5999);assert.equal(c.calls,0);c.advance(1);assert.equal(c.calls,1);c.timer.update(state);c.advance(10000);assert.equal(c.calls,1);
});
test('school prompt pauses while hidden or not ready and restarts after replayed intro',()=>{
 const c=clock();c.timer.update({...state,ready:false});c.advance(10000);assert.equal(c.calls,0);c.timer.update(state);c.advance(2000);c.timer.update({...state,visible:false});c.advance(10000);assert.equal(c.calls,0);c.timer.update(state);c.advance(3999);assert.equal(c.calls,0);c.advance(1);assert.equal(c.calls,1);
 const replay=clock();replay.timer.update(state);replay.advance(5000);replay.timer.update({...state,introFinished:false});replay.advance(20000);replay.timer.update(state);replay.advance(5999);assert.equal(replay.calls,0);replay.advance(1);assert.equal(replay.calls,1);
});
test('manually opening the school picker consumes its automatic prompt',()=>{const c=clock();c.timer.update(state);c.advance(1000);c.timer.stop();c.advance(10000);c.timer.update(state);c.advance(10000);assert.equal(c.calls,0);});
