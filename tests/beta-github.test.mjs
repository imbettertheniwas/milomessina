import test from 'node:test';
import assert from 'node:assert/strict';
import {betaGithubUsername, betaGithubInitial, loadBetaGithub} from '../invoice/beta-github.js';

const range = {startDate:'2026-09-12', endDate:'2026-09-25', now:()=>Date.parse('2026-09-25T18:00:00Z')};
const person = {id:'beta-one', name:'New intern', github:'new-intern'};
const repo = (name='new-intern/project') => ({full_name:name, private:false, fork:false, pushed_at:'2026-09-25T17:00:00Z'});
const commit = (date, suffix='1', login='new-intern') => ({sha:suffix.repeat(40), author:{login}, commit:{author:{date}, message:'Shipped the page\nMore details'}});
const response = (data, status=200) => ({ok:status>=200&&status<300, status, json:async()=>data});

test('missing, invalid and loading accounts remain distinct from zero commits',()=>{
  const states = betaGithubInitial([person, {...person,id:'two',github:''}, {...person,id:'three',github:'bad/name'}], range);
  assert.deepEqual(states.map(s=>s.status), ['loading','missing','error']);
  assert.ok(states.every(s=>s.total===null));
  assert.equal(betaGithubUsername('https://github.com/new-intern/'), 'new-intern');
  assert.equal(betaGithubUsername('https://evil.example/new-intern'), '');
  assert.equal(betaGithubUsername('@new-intern'), 'new-intern');
});

test('matching shared feed preserves UTC date range and uses no per-user requests',async()=>{
  const calls=[];
  const states = await loadBetaGithub([person], {...range, fetchImpl:async url=>{
    calls.push(url);
    return response({since:'2026-06-20T00:00:00Z',updatedAt:'2026-09-25T17:59:00Z', people:{OtherName:{
      logins:['new-intern'], days:{'2026-09-11':100,'2026-09-12':2,'2026-09-25':3,'2026-09-26':100},
      commitsByDay:{'2026-09-12':[{sha:'a'.repeat(40),repo:'new-intern/project',message:'First',date:'2026-09-12T00:00:00Z',url:'https://evil.example'}]}
    }}});
  }});
  assert.deepEqual(calls,['/api/commits']);
  assert.equal(states[0].status,'ready');
  assert.equal(states[0].total,5);
  assert.equal(states[0].detailsLimited,true);
  assert.equal(states[0].commits[0].url,'https://github.com/new-intern/project/commit/'+'a'.repeat(40));
  assert.deepEqual(states[0].days,{'2026-09-12':2,'2026-09-25':3});
});

test('custom account fallback filters exact UTC period, deduplicates commits and excludes other authors',async()=>{
  const updates=[];
  const states=await loadBetaGithub([person], {...range,onProgress:states=>updates.push(states.map(s=>s.status)),fetchImpl:async url=>{
    if(url==='/api/commits')return response({people:{}});
    if(url.includes('/users/'))return response([repo(),{...repo('new-intern/fork'),fork:true},{...repo('new-intern/private'),private:true}]);
    return response([commit('2026-09-11T23:59:59Z'),commit('2026-09-12T00:00:00Z','2'),
      commit('2026-09-12T00:00:00Z','2'),commit('2026-09-25T19:59:59-04:00','3'),
      commit('2026-09-25T20:00:00-04:00','4'),commit('2026-09-20T10:00:00Z','5','someone-else')]);
  }});
  assert.deepEqual(updates,[['loading'],['ready']]);
  assert.equal(states[0].source,'github');
  assert.equal(states[0].total,2);
  assert.deepEqual(states[0].days,{'2026-09-12':1,'2026-09-25':1});
  assert.equal(states[0].commits.length,2);
  assert.equal(states[0].commits[0].message,'Shipped the page');
});

test('old or insufficient shared feed cannot produce a false zero',async()=>{
  for(const shared of [
    {since:'2026-09-01T00:00:00Z',updatedAt:'2026-09-24T00:00:00Z'},
    {since:'2026-09-20T00:00:00Z',updatedAt:'2026-09-25T17:59:00Z'}
  ]) {
    const states=await loadBetaGithub([person], {...range,fetchImpl:async url=>url==='/api/commits'
      ? response({...shared,people:{Person:{logins:['new-intern'],days:{}}}})
      : response({},503)});
    assert.equal(states[0].status,'error');
    assert.equal(states[0].total,null);
  }
});

test('repository limit and errors after completed pages show partial lower bounds',async()=>{
  let reads=0;
  const states=await loadBetaGithub([person], {...range,fetchImpl:async url=>{
    if(url==='/api/commits')return response({},503);
    if(url.includes('/users/'))return response(Array.from({length:7},(_,i)=>repo('new-intern/repo'+i)));
    return ++reads===1?response([commit('2026-09-15T12:00:00Z')]):response({},429);
  }});
  assert.equal(states[0].status,'partial');
  assert.equal(states[0].total,1);
  assert.equal(states[0].reasons.length,2);
  assert.match(states[0].message,/six most recently/);
  assert.match(states[0].message,/limiting requests/);
});

test('request budget covers the whole batch; unread accounts never become zero',async()=>{
  let publicCalls=0;
  const states=await loadBetaGithub([person,{...person,id:'two',github:'other-intern'}], {...range,maxReads:2,fetchImpl:async url=>{
    if(url==='/api/commits')return response({people:{}});
    publicCalls++;
    return response(url.includes('/users/')?[repo()]:[]);
  }});
  assert.equal(publicCalls,2);
  assert.equal(states[0].status,'ready');
  assert.equal(states[0].total,0);
  assert.equal(states[1].status,'error');
  assert.equal(states[1].total,null);
});

test('a not-found or malformed account is unavailable while a verified empty repository list is zero',async()=>{
  for(const result of [response({},404),response([{}]),response([])]) {
    const [state]=await loadBetaGithub([person], {...range,fetchImpl:async url=>url==='/api/commits'?response({},503):result});
    assert.equal(state.total,result.status===200&&Array.isArray(await result.json())&&(await result.json()).length===0?0:null);
  }
});

test('future days are not reported as observed zero activity',async()=>{
  const [state]=await loadBetaGithub([person], {...range,endDate:'2026-09-28',fetchImpl:async url=>response(url==='/api/commits'?{people:{}}:[])});
  assert.equal(state.throughDate,'2026-09-25');
  assert.equal(state.ongoing,true);
  let calls=0;
  const [future]=await loadBetaGithub([person], {...range,startDate:'2026-10-01',endDate:'2026-10-14',fetchImpl:async()=>{calls++;}});
  assert.equal(future.total,null);
  assert.equal(future.status,'error');
  assert.equal(calls,0);
});
