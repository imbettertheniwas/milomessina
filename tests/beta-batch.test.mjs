import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const SECRET='private beta operator secret 2026';
const beforeToday=days=>new Date(Date.now()-days*86400000).toISOString().slice(0,10);
const setup=()=>{const h=harness({INTERNAL_LOGIN_SECRET:SECRET});return {...h,operator:h.login('Arya')};};
const api=(h,token,action,p={})=>h.ctx.betaApi({_session:token,action,...p});
const auth=(h,action,p={})=>h.ctx.internalSessionApi({action,...p});
const batch=(h,name='September beta')=>api(h,h.operator,'batchadd',{name,startDate:beforeToday(5)});
const join=(h,invite,name='Maya',over={})=>auth(h,'betajoin',{invite,name,phone:'+1 (212) 555-0100',email:name.toLowerCase().replaceAll(' ','')+'@example.com',github:name.toLowerCase().replaceAll(' ','-')+'-builds',...over});

test('shared invitation supports immediate self-join with private individual recovery codes',()=>{
 const h=setup(),b=batch(h);
 assert.equal(b.ok,true);assert.match(b.invite,/^BATCH-[A-F0-9]{32}$/);assert.ok(b.createdBatchId);
 assert.equal(Date.parse(b.batches[0].endDate)-Date.parse(b.batches[0].startDate),13*86400000);
 assert.equal(auth(h,'betainvite',{invite:b.invite}).batch.name,'September beta');
 const a=join(h,b.invite),other=join(h,b.invite,'Riley');
 assert.equal(a.ok,true);assert.equal(other.ok,true);assert.equal(a.beta,true);assert.ok(a.token);
 assert.equal(a.member.batchId,b.createdBatchId);assert.equal(a.member.status,'active');
 assert.notEqual(a.code,other.code);assert.notEqual(a.member.id,other.member.id);
 assert.equal(auth(h,'betalogin',{code:a.code}).ok,true);
 assert.equal(h.ctx.rosterPayers().includes('Maya'),false);
 assert.equal(api(h,h.operator,'list').members.length,2);
 assert.equal(JSON.stringify(h.sheets.internal_beta_batches.rows).includes(b.invite),false);
 assert.equal(JSON.stringify(h.sheets.internal_beta_members.rows).includes(a.code),false);
 assert.equal(api(h,h.operator,'list').batches[0].inviteHash,undefined);
 assert.equal(api(h,h.operator,'list').invite,undefined);
});

test('invalid or rotated shared invites cannot join and rotation preserves individual access',()=>{
 const h=setup(),b=batch(h),a=join(h,b.invite);
 const rotated=api(h,h.operator,'rotateinvite',{id:b.createdBatchId});
 assert.notEqual(rotated.invite,b.invite);
 assert.equal(auth(h,'betainvite',{invite:b.invite}).ok,false);
 assert.equal(join(h,b.invite,'Riley').ok,false);
 assert.equal(join(h,rotated.invite,'Riley').ok,true);
 assert.equal(api(h,a.token,'list').ok,true);assert.equal(auth(h,'betalogin',{code:a.code}).ok,true);
 assert.equal(join(h,'BATCH-'+'0'.repeat(32),'Intruder').ok,false);
 assert.equal(auth(h,'betainvite',{invite:'bad'}).batch,undefined);
 assert.equal(api(h,a.token,'batchadd',{name:'Intruder',startDate:beforeToday(1)}).code,'FORBIDDEN');
 assert.equal(api(h,a.token,'rotateinvite',{id:b.createdBatchId}).code,'FORBIDDEN');
});

test('duplicate email within a batch cannot recover or replace another person',()=>{
 const h=setup(),b=batch(h),a=join(h,b.invite);
 const duplicate=join(h,b.invite,'Imposter',{email:'MAYA@EXAMPLE.COM'});
 assert.equal(duplicate.ok,false);assert.equal(duplicate.token,undefined);assert.equal(duplicate.code,'INVALID');
 const list=api(h,h.operator,'list');assert.equal(list.members.length,1);assert.equal(list.members[0].name,'Maya');
 assert.equal(auth(h,'betalogin',{code:a.code}).ok,true);
 const second=batch(h,'Second batch');
 assert.equal(join(h,second.invite,'Maya').ok,true);
 assert.equal(join(h,b.invite,'Bad User',{github:'https://evil.example/'}).ok,false);
 assert.equal(join(h,b.invite,'Good User',{github:'https://github.com/good-builder'}).member.github,'good-builder');
});

test('peer roster and attendance are shared only within the member batch',()=>{
 const h=setup(),first=batch(h),second=batch(h,'Separate batch');
 const a=join(h,first.invite),b=join(h,first.invite,'Riley'),outsider=join(h,second.invite,'Jordan');
 api(h,h.operator,'memberupdate',{id:b.member.id,notes:'Private evaluation of Riley'});
 const day=beforeToday(1);
 assert.equal(api(h,a.token,'attendance',{day,memberId:outsider.member.id}).ok,true);
 assert.equal(api(h,b.token,'attendance',{day}).ok,true);
 assert.equal(api(h,outsider.token,'attendance',{day}).ok,true);
 const view=api(h,a.token,'list');
 assert.deepEqual(view.peers.map(p=>p.name).sort(),['Maya','Riley']);
 assert.equal(view.attendance.length,2);assert.equal(view.batches.length,1);assert.equal(view.batch.id,first.createdBatchId);
 assert.equal(view.members.length,1);assert.equal(view.peers[1].email,undefined);assert.equal(view.peers[1].notes,undefined);
 assert.equal(JSON.stringify(view).includes('Private evaluation'),false);
 assert.equal(JSON.stringify(view).includes('Jordan'),false);
 assert.equal(api(h,h.operator,'list').attendance.length,3);
 assert.equal(api(h,h.operator,'list').members.find(m=>m.id===b.member.id).notes,'Private evaluation of Riley');
});

test('attendance marks are idempotent, owned by the session and restricted to valid dates',()=>{
 const h=setup(),b=batch(h),a=join(h,b.invite),other=join(h,b.invite,'Riley'),day=beforeToday(1);
 api(h,a.token,'attendance',{day});api(h,a.token,'attendance',{day});api(h,other.token,'attendance',{day});
 assert.equal(api(h,a.token,'list').attendance.length,2);
 api(h,a.token,'attendanceremove',{day,memberId:other.member.id});
 const rows=api(h,a.token,'list').attendance;
 assert.equal(rows.length,1);assert.equal(rows[0].memberId,other.member.id);
 assert.equal(api(h,a.token,'attendance',{day:beforeToday(-1)}).ok,false);
 assert.equal(api(h,a.token,'attendance',{day:beforeToday(20)}).ok,false);
 assert.equal(api(h,a.token,'attendance',{day:'2026-02-31'}).ok,false);
 assert.equal(api(h,h.operator,'attendance',{day,memberId:a.member.id}).code,'FORBIDDEN');
});

test('recaps save drafts and submissions only for their author; operators see all',()=>{
 const h=setup(),b=batch(h),a=join(h,b.invite),other=join(h,b.invite,'Riley');
 const draft=api(h,a.token,'recap',{learned:'',accomplished:'',links:[],submit:false});
 assert.equal(draft.ok,true);assert.equal(draft.recaps[0].submitted,false);
 assert.equal(api(h,a.token,'recap',{learned:'I learned Git',accomplished:'',submit:true}).ok,false);
 assert.equal(api(h,a.token,'recap',{learned:'I learned Git',accomplished:'A demo',links:['javascript:alert(1)'],submit:true}).ok,false);
 const sent=api(h,a.token,'recap',{memberId:other.member.id,learned:'I learned Git',accomplished:'Shipped my demo',links:['https://github.com/maya-builds/demo'],submit:true});
 assert.equal(sent.recaps.length,1);assert.equal(sent.recaps[0].memberId,a.member.id);assert.equal(sent.recaps[0].submitted,true);assert.ok(sent.recaps[0].submittedAt);
 assert.deepEqual(sent.recaps[0].links,['https://github.com/maya-builds/demo']);
 assert.equal(api(h,other.token,'list').recaps.length,0);
 api(h,other.token,'recap',{learned:'Research',accomplished:'A deck',submit:true});
 assert.equal(api(h,h.operator,'list').recaps.length,2);
 const updated=api(h,a.token,'recap',{learned:'Git and CSS',accomplished:'Shipped two demos',submit:true});
 assert.equal(updated.recaps.length,1);assert.equal(updated.recaps[0].id,sent.recaps[0].id);assert.equal(updated.recaps[0].learned,'Git and CSS');
 assert.equal(api(h,h.operator,'recap',{memberId:a.member.id,learned:'Override',accomplished:'Override',submit:true}).code,'FORBIDDEN');
});

test('pausing a batch denies invite, login and old sessions, including after resume',()=>{
 const h=setup(),b=batch(h),a=join(h,b.invite);
 assert.equal(api(h,h.operator,'batchupdate',{id:b.createdBatchId,active:false}).ok,true);
 assert.equal(api(h,a.token,'list').code,'AUTH_REQUIRED');
 assert.equal(auth(h,'betalogin',{code:a.code}).ok,false);assert.equal(join(h,b.invite,'Riley').ok,false);
 api(h,h.operator,'batchupdate',{id:b.createdBatchId,active:true,name:'Renamed batch'});
 assert.equal(api(h,a.token,'list').ok,false);
 const fresh=auth(h,'betalogin',{code:a.code});assert.equal(fresh.ok,true);assert.equal(fresh.member.batch,'Renamed batch');
 assert.equal(join(h,b.invite,'Riley').ok,true);
});

test('a shared join cannot spoof role, privileges, cohort, code hash or private notes',()=>{
 const h=setup(),b=batch(h),a=join(h,b.invite,'Arya',{role:'admin',operator:true,permissions:['onboarding'],notes:'Injected',batchId:'other',codeHash:'mine',_session:h.operator});
 assert.equal(a.ok,true);assert.equal(a.operator,undefined);assert.equal(a.member.notes,undefined);assert.equal(a.member.batchId,b.createdBatchId);
 assert.deepEqual(a.member.permissions,['attendance','github','recap']);
 assert.equal(h.ctx.internalActor({_session:a.token}),null);
 assert.equal(api(h,a.token,'memberupdate',{id:a.member.id,status:'active'}).ok,false);
 assert.equal(api(h,h.operator,'list').members[0].notes,'');
});

test('joining requires a formatted phone that stays private to its owner and operators',()=>{
 const h=setup(),b=batch(h);
 for(const phone of [undefined,'','123456','1234567890123456','call me','+1 212 555 0100 ext 5',12125550100,'=12125550100']) {
   const denied=join(h,b.invite,'Invalid Phone',{phone});
   assert.equal(denied.ok,false,'reject '+String(phone));assert.match(denied.error,/phone number/);
 }
 const a=join(h,b.invite,'Maya',{phone:' +44 (0)20 7946 0958 '}),other=join(h,b.invite,'Riley',{phone:'020-7946-0100'});
 assert.equal(a.ok,true);assert.equal(a.member.phone,'+44 (0)20 7946 0958');
 const stored=h.sheets.internal_beta_members.rows[1][h.ctx.BETA_MEMBERS.indexOf('phone')];
 assert.equal(stored,'\u200b+44 (0)20 7946 0958');
 const own=api(h,a.token,'list'),peer=api(h,other.token,'list'),manager=api(h,h.operator,'list');
 assert.equal(own.member.phone,a.member.phone);assert.equal(own.members[0].phone,a.member.phone);
 assert.equal(auth(h,'session',{_session:a.token}).member.phone,a.member.phone);
 assert.equal(manager.members.find(m=>m.id===a.member.id).phone,a.member.phone);
 assert.ok(peer.peers.every(p=>p.phone===undefined));assert.equal(JSON.stringify(peer).includes(a.member.phone),false);
 assert.equal(api(h,a.token,'memberupdate',{id:other.member.id,phone:'+1 212 555 9999'}).ok,false);
 assert.equal(api(h,h.operator,'memberupdate',{id:a.member.id,phone:'bad phone'}).ok,false);
 assert.equal(api(h,h.operator,'list').members.find(m=>m.id===a.member.id).phone,a.member.phone);
 assert.equal(api(h,h.operator,'memberupdate',{id:a.member.id,phone:'+1 917 555 0101'}).members.find(m=>m.id===a.member.id).phone,'+1 917 555 0101');
});

test('the earlier beta member schema gains only a phone header and preserves every existing value',()=>{
 const h=setup(),b=batch(h),a=join(h,b.invite);
 api(h,h.operator,'memberupdate',{id:a.member.id,notes:'Keep this evaluation'});
 const sheet=h.sheets.internal_beta_members,phoneIndex=h.ctx.BETA_MEMBERS.indexOf('phone');
 sheet.rows.forEach((row,index)=>{sheet.rows[index]=row.slice(0,phoneIndex);});
 const before=sheet.rows.map(row=>[...row]);
 const resumed=auth(h,'betalogin',{code:a.code});
 assert.equal(resumed.ok,true);assert.equal(resumed.member.phone,'');
 assert.equal(sheet.rows[0][phoneIndex],'phone');
 assert.deepEqual(sheet.rows[0].slice(0,phoneIndex),before[0]);
 assert.deepEqual(sheet.rows.slice(1),before.slice(1));
 const updated=api(h,h.operator,'memberupdate',{id:a.member.id,phone:'001 212 555 0100'});
 assert.equal(updated.ok,true);assert.equal(updated.members[0].phone,'001 212 555 0100');assert.equal(updated.members[0].notes,'Keep this evaluation');
 assert.equal(auth(h,'betalogin',{code:a.code}).member.id,a.member.id);
 assert.equal(h.sheets.internal_beta_members,sheet);
});

test('phone migration refuses mismatched headers or occupied unnamed columns without changing rows',()=>{
 for(const kind of ['wrong header','occupied column']) {
   const h=setup(),b=batch(h);join(h,b.invite);
   const sheet=h.sheets.internal_beta_members,phoneIndex=h.ctx.BETA_MEMBERS.indexOf('phone');
   sheet.rows[0]=sheet.rows[0].slice(0,phoneIndex);
   if(kind==='wrong header'){sheet.rows[0][2]='unexpected';sheet.rows[1]=sheet.rows[1].slice(0,phoneIndex);}
   const before=sheet.rows.map(row=>[...row]);
   assert.throws(()=>h.ctx.betaRead('internal_beta_members',h.ctx.BETA_MEMBERS),/columns do not match/);
   assert.deepEqual(sheet.rows,before);
 }
});
