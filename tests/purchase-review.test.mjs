import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createCommitHandler} from '../api/commits.mjs';

const html=fs.readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8');
function reviewContext(){
 const ctx=vm.createContext({
   ghData:{},ghErrors:{},ghBusy:false,ghAt:Date.parse('2026-09-17T12:00:00Z'),
   sharedOf:r=>String(r.shared||'').split(',').map(n=>n.trim()).filter(Boolean),
   ghNames:p=>p==='Arya'?[]:[p.toLowerCase()],
   esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
   niceDate:d=>d,dayKey:d=>d.toISOString().slice(0,10),calStart:()=>new Date('2026-06-14'),
   avatar:p=>p,safeUrl:u=>u,commitLabel:(n,c)=>n+(c?'+':'')+' commits'
 });
 vm.runInContext(html.slice(html.indexOf('function purchasePeople('),html.indexOf('function paintChargeGit(')),ctx);
 return ctx;
}

test('purchase review shows every distinct participant and counts only the purchase date',()=>{
 const c=reviewContext();
 c.ghData.Milo={from:'2026-06-14',through:'2026-09-17',days:{'2026-09-16':4,'2026-09-17':20},commitsByDay:{'2026-09-16':[{sha:'a',repo:'milo/app',message:'Actual day change',date:'2026-09-16T10:00:00Z',url:'https://github.com/milo/app/commit/a'}]}};
 c.ghData.Bijan={from:'2026-06-14',through:'2026-09-17',days:{'2026-09-16':2},commitsByDay:{}};
 const r={who:'Milo',shared:'Milo, Bijan, Milo, Arya',date:'2026-09-16'};
 assert.deepEqual(Array.from(c.purchasePeople(r)),['Milo','Bijan','Arya']);
 const output=c.purchaseGitHtml(r);
 assert.match(output,/4 commits/);assert.match(output,/2 commits/);assert.doesNotMatch(output,/20 commits/);
 assert.match(output,/Actual day change/);assert.match(output,/No GitHub account linked/);
 assert.match(output,/from=2026-09-16&amp;to=2026-09-16/);
});

test('missing, failed, partial and out-of-range GitHub reads are never reported as a definite zero',()=>{
 const c=reviewContext(),r={who:'Milo',shared:'',date:'2026-09-16'};
 assert.match(c.purchaseGitHtml(r),/not available yet/);
 c.ghErrors.Milo='rate limited';assert.match(c.purchaseGitHtml(r),/unavailable: rate limited/);
 delete c.ghErrors.Milo;
 c.ghData.Milo={days:{},from:'2026-06-14',through:'2026-09-17',truncated:true};
 assert.match(c.purchaseGitHtml(r),/partial result/);
 assert.match(c.purchaseGitHtml({...r,date:'2025-01-01'}),/outside the loaded activity range/);
});

test('commit API returns real details grouped by UTC author date and excludes another author or private repo',async()=>{
 const handler=createCommitHandler({now:()=>Date.parse('2026-09-17T12:00:00Z'),env:{},fetchImpl:async url=>{
   const repos=url.match(/\/users\/([^/]+)\/repos/);
   if(repos)return {ok:true,json:async()=>repos[1]==='imbettertheniwas'?[
     {full_name:'imbettertheniwas/public',pushed_at:'2026-09-17T00:00:00Z'},
     {full_name:'imbettertheniwas/private',private:true,pushed_at:'2026-09-17T00:00:00Z'}
   ]:[]};
   assert.ok(!url.includes('/private/'));
   return {ok:true,json:async()=>[
     {sha:'abc123',author:{login:'imbettertheniwas'},commit:{author:{date:'2026-09-16T23:30:00-04:00'},message:'Real commit title\nMore text'}},
     {sha:'other',author:{login:'somebody-else'},commit:{author:{date:'2026-09-17T00:00:00Z'},message:'Not theirs'}}
   ]};
 }});
 let status=200,body;
 const res={setHeader(){},status(n){status=n;return this;},end(v){body=v;return this;},json(v){body=JSON.stringify(v);return this;}};
 await handler({method:'GET',headers:{}},res);
 assert.equal(status,200);
 const milo=JSON.parse(body).people.Milo;
 assert.deepEqual(milo.days,{'2026-09-17':1});
 assert.equal(milo.commitsByDay['2026-09-17'][0].message,'Real commit title');
 assert.equal(milo.commitsByDay['2026-09-17'][0].url,'https://github.com/imbettertheniwas/public/commit/abc123');
});
