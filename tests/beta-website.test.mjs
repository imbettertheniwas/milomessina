import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const api=(h,token,action,p={})=>h.ctx.betaApi({_session:token,action,...p});
const join=(h,name='Maya',over={})=>h.ctx.internalSessionApi({action:'betajoin',invite:'beta',name,email:name.toLowerCase()+'@example.com',phone:'+1 212 555 0100',github:name.toLowerCase()+'-builds',...over});
const setup=()=>{const h=harness(),operator=h.login('Arya');api(h,operator,'list');return {...h,operator};};

test('onboarding saves optional public websites and safely exposes name links to the group',()=>{
 const h=setup(),maya=join(h,'Maya',{website:' Portfolio.Example.com/work?view=all#demo '}),riley=join(h,'Riley');
 assert.equal(maya.ok,true);assert.equal(maya.member.website,'https://portfolio.example.com/work?view=all#demo');
 assert.equal(riley.member.website,'');
 api(h,h.operator,'memberupdate',{id:maya.member.id,notes:'Private evaluation'});
 const peer=api(h,riley.token,'list').peers.find(p=>p.id===maya.member.id);
 assert.equal(peer.website,maya.member.website);assert.equal(peer.email,undefined);assert.equal(peer.phone,undefined);assert.equal(peer.notes,undefined);
 assert.equal(api(h,h.operator,'list').members.find(m=>m.id===maya.member.id).website,maya.member.website);
 assert.equal(h.ctx.internalSessionApi({action:'session',_session:maya.token}).member.website,maya.member.website);
 assert.notEqual(maya.member.website,maya.code);
});

test('website updates derive ownership from the beta session and never change another profile field',()=>{
 const h=setup(),maya=join(h,'Maya'),riley=join(h,'Riley',{website:'riley.example.com'});
 const before=h.ctx.betaRead('internal_beta_members',h.ctx.BETA_MEMBERS).find(m=>m.id===maya.member.id);
 const out=api(h,maya.token,'memberprofile',{id:riley.member.id,memberId:riley.member.id,website:'maya.example.com',name:'Arya',email:'stolen@example.com',phone:'1234567',github:'other',status:'graduated',notes:'Visible',admin:true,batchId:'other',createdAt:'2000-01-01',codeHash:'replacement'});
 assert.equal(out.ok,true);assert.equal(out.manager,false);assert.equal(out.member.id,maya.member.id);assert.equal(out.member.website,'https://maya.example.com');
  const after=h.ctx.betaRead('internal_beta_members',h.ctx.BETA_MEMBERS).find(m=>m.id===maya.member.id);
  for(const key of h.ctx.BETA_MEMBERS.filter(k=>!['website','updatedAt'].includes(k)))assert.equal(after[key],before[key],key);
 const missing=api(h,maya.token,'memberprofile',{id:riley.member.id,name:'Arya',status:'graduated'});
 assert.equal(missing.ok,false);
 assert.equal(JSON.stringify(h.ctx.betaRead('internal_beta_members',h.ctx.BETA_MEMBERS).find(m=>m.id===maya.member.id)),JSON.stringify(after));
 assert.equal(api(h,riley.token,'list').member.website,'https://riley.example.com');
 assert.equal(api(h,maya.token,'memberprofile',{website:''}).member.website,'');
 for(const token of ['',h.login('Bijan'),h.operator])assert.equal(api(h,token,'memberprofile',{id:maya.member.id,website:'no.example.com'}).ok,false);
});

test('both administrators can edit websites while an ordinary intern and beta identities cannot edit others',()=>{
 const h=setup(),maya=join(h,'Maya');
 for(const name of ['Milo','Arya']) {
  const output=api(h,h.login(name),'memberupdate',{id:maya.member.id,website:name.toLowerCase()+'.example.com'});
  assert.equal(output.ok,true);assert.equal(output.members[0].website,'https://'+name.toLowerCase()+'.example.com');
  const collision=join(h,name);
  assert.equal(api(h,collision.token,'memberupdate',{id:maya.member.id,website:'stolen.example.com'}).ok,false);
 }
 assert.equal(api(h,h.login('Bijan'),'memberupdate',{id:maya.member.id,website:'stolen.example.com'}).ok,false);
});

test('unsafe or malformed websites fail validation before any profile is saved',()=>{
 const h=setup();
 const invalid=['javascript:alert(1)','data:text/html,hello','ftp://example.com','https://user:pass@example.com','https://user@example.com','https://example.com\\@evil.test','https://example.com/white space','https://example.com/\nscript','https://example.com/<script>','https://example.com/"x','https://example.com/\u0000','https://example..com','https://-example.com','https://example-.com','https://localhost','https://example.com:99999','https://example.com:0','https://example.com:abc','https://example.com.evil@other.test','https://example.com/'+ 'a'.repeat(281),123,{},null];
 for(const website of invalid) {
  const response=join(h,'Maya',{website});
  assert.equal(response.ok,false,JSON.stringify(website));assert.equal(response.joinSaved,false);
 }
 assert.equal(api(h,h.operator,'list').members.length,0);
 const valid=join(h,'Maya',{website:'HTTP://Example.com:8080/project'});
 assert.equal(valid.member.website,'http://example.com:8080/project');
 for(const website of invalid)assert.equal(api(h,valid.token,'memberprofile',{website}).ok,false);
 assert.equal(api(h,valid.token,'list').member.website,valid.member.website);
});

test('join retry binds canonical websites and preserves the earlier no-website attempt format',()=>{
 const h=setup(),joinRequest='1'.repeat(32);
 const first=join(h,'Maya',{joinRequest,website:'Maya.Example.com'});
 const retry=join(h,'Maya',{joinRequest,website:'https://maya.example.com'});
 assert.equal(retry.ok,true);assert.equal(retry.recovered,true);assert.equal(retry.code,first.code);
 for(const website of ['',undefined,'https://other.example.com'])assert.equal(join(h,'Maya',{joinRequest,website}).ok,false);
 const legacy=join(h,'Riley',{joinRequest:'2'.repeat(32)});
 assert.equal(join(h,'Riley',{joinRequest:'2'.repeat(32),website:''}).code,legacy.code);
 assert.equal(join(h,'Riley',{joinRequest:'2'.repeat(32),website:'riley.example.com'}).ok,false);
});

test('website header migration preserves existing rows, sessions and private retry hashes',()=>{
 const h=setup(),maya=join(h,'Maya',{joinRequest:'3'.repeat(32)}),sheet=h.sheets.internal_beta_members,index=h.ctx.BETA_MEMBERS.indexOf('website');
 sheet.rows.forEach((row,n)=>{sheet.rows[n]=row.slice(0,index);});
 const before=sheet.rows.map(row=>[...row]);
 assert.equal(api(h,maya.token,'list').member.website,'');
 assert.equal(sheet.rows[0][index],'website');assert.deepEqual(sheet.rows[0].slice(0,index),before[0]);assert.deepEqual(sheet.rows.slice(1),before.slice(1));
 assert.equal(join(h,'Maya',{joinRequest:'3'.repeat(32)}).code,maya.code);
 const saved=api(h,maya.token,'memberprofile',{website:'maya.example.com'});
 assert.equal(saved.member.website,'https://maya.example.com');
 assert.equal(sheet.rows[1][index],'\u200bhttps://maya.example.com');
});

test('manually corrupted website cells never become unsafe peer links',()=>{
 const h=setup(),maya=join(h,'Maya'),riley=join(h,'Riley');
 const row=h.ctx.betaRead('internal_beta_members',h.ctx.BETA_MEMBERS).find(m=>m.id===maya.member.id);
 row.website='javascript:alert(1)';h.ctx.betaWrite('internal_beta_members',h.ctx.BETA_MEMBERS,row);
 assert.equal(api(h,maya.token,'list').member.website,'');
 assert.equal(api(h,riley.token,'list').peers.find(p=>p.id===maya.member.id).website,'');
 assert.equal(api(h,h.operator,'list').members.find(p=>p.id===maya.member.id).website,'');
});
