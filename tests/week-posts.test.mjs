import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const post=(h,token,body,over={})=>h.call(token,'add',{who:'Milo',body,week:'2026-09-14',...over},'posts');
const list=(h,token)=>h.call(token,'list',{},'posts').posts;
const one=out=>out.posts[out.posts.length-1];

test('a note tags the interns it names, and only those on the roster',()=>{
 const h=harness(),m=h.login('Milo');
 const p=one(post(h,m,'Shot the campus reel with @bijan and @Jesse. Ask @nobody or milo@fomo.com about it.'));
 assert.deepEqual(p.tags,['Bijan','Jesse']);
 assert.equal(p.body,'Shot the campus reel with @bijan and @Jesse. Ask @nobody or milo@fomo.com about it.');
});

test('a note that opens on a tag keeps its @ and is not read as a formula',()=>{
 const h=harness(),m=h.login('Milo');
 const p=one(post(h,m,'@Bijan and I finished the deck.'));
 assert.equal(p.body,'@Bijan and I finished the deck.');
 assert.deepEqual(p.tags,['Bijan']);
});

test('an intern edits their own note; the words, links and tags all follow',()=>{
 const h=harness(),m=h.login('Milo');
 const p=one(post(h,m,'Worked on the site with @bijan'));
 assert.equal(p.edited,'');
 const out=h.call(m,'edit',{id:p.id,body:'Worked on the site with @jesse https://fomo.com/site',
   links:['https://fomo.com/site']},'posts');
 assert.equal(out.ok,true);
 const after=out.posts.filter(x=>x.id===p.id)[0];
 assert.equal(after.body,'Worked on the site with @jesse https://fomo.com/site');
 assert.deepEqual(after.tags,['Jesse']);
 assert.deepEqual(after.links,['https://fomo.com/site']);
 assert.ok(after.edited);
 assert.equal(after.who,'Milo');
 assert.equal(after.week,p.week);
 assert.equal(after.posted,p.posted);
});

test('only the author or Arya can edit a note, and it cannot be emptied',()=>{
 const h=harness(),m=h.login('Milo'),b=h.login('Bijan'),a=h.login('Arya');
 const p=one(post(h,m,'Ran the Thursday calls'));
 assert.equal(h.call(b,'edit',{id:p.id,body:'mine now'},'posts').ok,false);
 assert.equal(h.call('','edit',{id:p.id,body:'mine now'},'posts').ok,false);
 assert.equal(h.call('','list',{},'posts').ok,false);
 assert.equal(list(h,m).filter(x=>x.id===p.id)[0].body,'Ran the Thursday calls');
 assert.equal(h.call(m,'edit',{id:p.id,body:'   '},'posts').ok,false);
 assert.equal(h.call(m,'edit',{id:'nope',body:'hi'},'posts').ok,false);
 assert.equal(h.call(a,'edit',{id:p.id,body:'Ran the Thursday calls with @Milo'},'posts')
   .posts.filter(x=>x.id===p.id)[0].body,'Ran the Thursday calls with @Milo');
});

test('a tab written before tags existed still reads, edits and keeps its notes',()=>{
 const h=harness(),m=h.login('Milo');
 const p=one(post(h,m,'The old note'));
 const sh=h.sheets.posts;
 sh.rows[0]=['id','posted','who','week','body','links','photos'];   /* the header it used to have */
 sh.rows[1]=sh.rows[1].slice(0,7);
 const old=list(h,m).filter(x=>x.id===p.id)[0];
 assert.deepEqual(old.tags,[]);
 assert.equal(old.edited,'');
 const out=h.call(m,'edit',{id:p.id,body:'The old note, with @Bijan'},'posts');
 assert.deepEqual(out.posts.filter(x=>x.id===p.id)[0].tags,['Bijan']);
 assert.deepEqual(sh.rows[0],['id','posted','who','week','body','links','photos','tags','edited']);
});
