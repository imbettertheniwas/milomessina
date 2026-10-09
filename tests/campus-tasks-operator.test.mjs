import test from 'node:test';import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';import{harness}from'./support/internal-harness.mjs';
function setup(){const h=harness();h.ctx.ctSchool=()=>({id:'duke',name:'Duke University'});const call=(t,action,p={})=>h.ctx.campusTasksApi({_taskToken:t,action,...p});const join=(email=randomUUID()+'@example.com',name='Alex')=>{const out=call('','signup',{name,schoolId:'duke',email,salt:'a'.repeat(32),proof:'b'.repeat(64)});assert(out.ok,out.error);return{token:out.token,id:out.member.id,email};};return{h,call,join,admin:(action,p={},who='Milo')=>h.ctx.campusTasksApi({_session:h.login(who),action,...p})};}
const referral={checks:[true],chapter:'Example Chapter',notes:'Referred a chapter'};
function payReferral({call,admin},a,reference='transfer test'){assert(call(a.token,'submit',{taskId:'referral',draft:referral}).ok);assert(admin('review',{memberId:a.id,taskId:'referral',revision:1,decision:'approved',rewardAmount:50}).ok);assert(admin('referralpaid',{memberId:a.id,taskId:'referral',revision:2,reference}).ok);}

test('every new operator action is admin-only and the version reports operator tools',()=>{
 const {call,join,admin}=setup(),a=join();
 assert.equal(call('','version').version,5);assert.equal(call('','version').operatorTools,true);
 for(const action of ['restoreSignup','revokeSessions','note','maintenance']){assert.equal(call(a.token,action,{memberId:a.id}).code,'FORBIDDEN',action);assert.equal(admin(action,{memberId:a.id},'Bijan').code,'FORBIDDEN',action);}
});
test('the payment ledger keeps paid rewards of deleted signups and never exposes credentials',()=>{
 const s=setup(),a=s.join(),b=s.join();payReferral(s,a,'first transfer');payReferral(s,b,'second transfer');
 assert(s.admin('deleteSignup',{memberId:a.id}).ok);
 const out=s.admin('list');
 assert.deepEqual(out.payouts.map(p=>[p.reference,p.amount,p.kind,p.deleted]),[['first transfer',50,'referral',true],['second transfer',50,'referral',false]]);
 assert.equal(out.deleted.length,1);assert.equal(out.deleted[0].name,'Alex');assert.equal(out.deleted[0].deletedBy,'Milo');
 assert(!/verifierHash|tokenHash|salt|@example\.com/.test(JSON.stringify(out)));
});
test('restoring a signup brings back its work, keeps old sessions revoked, and audits both actions',()=>{
 const {h,call,join,admin}=setup(),a=join();
 assert(call(a.token,'submitstep',{taskId:'host',step:0,draft:{notes:'Evidence',files:[]}}).ok);
 assert(admin('deleteSignup',{memberId:a.id}).ok);
 let out=admin('restoreSignup',{memberId:a.id},'Arya');assert(out.ok,out.error);
 assert(out.members.some(m=>m.id===a.id));assert.equal(out.steps.length,1);assert.equal(out.deleted.length,0);
 assert.deepEqual(out.audit.filter(r=>r.memberId===a.id&&r.taskId===''&&r.action!=='password_setup').map(r=>[r.action,r.actor]),[['deleted','Milo'],['restored','Arya']]);
 assert.equal(h.ctx.ctRows('deleted',h.ctx.CT_DELETED).length,0);
 assert.equal(call(a.token,'get').code,'AUTH_REQUIRED');
 assert(call('','login',{email:a.email,proof:'b'.repeat(64)}).ok);
 assert(admin('restoreSignup',{memberId:a.id}).ok);assert.equal(admin('restoreSignup',{memberId:'missing'}).ok,false);
});
test('restore refuses when the email already opened a newer account',()=>{
 const {join,admin}=setup(),a=join('shared@example.com');
 assert(admin('deleteSignup',{memberId:a.id}).ok);join('shared@example.com','Fresh');
 const out=admin('restoreSignup',{memberId:a.id});assert.equal(out.ok,false);assert.match(out.error,/newer account/);
 assert.equal(admin('list').deleted.length,1);
});
test('sign out everywhere revokes only that member and reports live device counts',()=>{
 const {call,join,admin}=setup(),a=join(),b=join(),second=call('','login',{email:a.email,proof:'b'.repeat(64)}).token;
 let out=admin('list');assert.equal(out.members.find(m=>m.id===a.id).activeSessions,2);
 out=admin('revokeSessions',{memberId:a.id});assert(out.ok,out.error);
 assert.equal(out.members.find(m=>m.id===a.id).activeSessions,0);assert.equal(out.members.find(m=>m.id===b.id).activeSessions,1);
 for(const t of [a.token,second])assert.equal(call(t,'get').code,'AUTH_REQUIRED');assert(call(b.token,'get').ok);
 assert.equal(out.audit.filter(r=>r.action==='signed_out').length,1);
 assert.equal(admin('revokeSessions',{memberId:a.id}).audit.filter(r=>r.action==='signed_out').length,1);
});
test('operator notes are private to the console and reject stale overwrites',()=>{
 const {call,join,admin}=setup(),a=join();
 let out=admin('note',{memberId:a.id,notes:'Called about the dinner',since:''});assert(out.ok,out.error);
 const note=out.notes[0];assert.equal(note.notes,'Called about the dinner');assert.equal(note.updatedBy,'Milo');
 assert(!JSON.stringify(call(a.token,'get')).includes('Called about'));
 assert.match(admin('note',{memberId:a.id,notes:'Stale edit',since:''},'Arya').error,/changed/);
 out=admin('note',{memberId:a.id,notes:'Paid by Venmo',since:note.updatedAt},'Arya');assert.equal(out.notes[0].notes,'Paid by Venmo');assert.equal(out.notes.length,1);
 assert.equal(admin('note',{memberId:'missing',notes:'x'}).ok,false);
});
test('maintenance prunes expired sessions and stale rate limits while live ones keep working',()=>{
 const {h,call,join,admin}=setup(),a=join(),old=call('','login',{email:a.email,proof:'b'.repeat(64)}).token;
 assert(call(old,'logout').ok);
 h.ctx.ctWrite('auth_limits',h.ctx.CT_AUTH_LIMITS,{id:'stale',attempts:4,windowStart:Date.now()-3600000});
 for(let i=0;i<3;i++)call('','login',{email:'locked@example.com',proof:'c'.repeat(64)});
 const out=admin('maintenance');assert(out.ok,out.error);assert.equal(out.pruned.sessions,1);assert.equal(out.pruned.authLimits,1);
 assert.equal(h.ctx.ctRows('sessions',h.ctx.CT_SESSIONS).length,1);assert(call(a.token,'get').ok);
 const limits=h.ctx.ctRows('auth_limits',h.ctx.CT_AUTH_LIMITS);assert.equal(limits.length,2);assert(!limits.some(r=>r.id==='stale'));assert(limits.some(r=>Number(r.attempts)===3));
 assert.deepEqual(admin('maintenance').pruned,{sessions:0,authLimits:0});
 assert.deepEqual({...h.ctx.campusTasksMaintenance()},{sessions:0,authLimits:0});
});
test('review history keeps the newest hundred records per member instead of a global cap',()=>{
 const {h,join,admin}=setup(),a=join(),b=join();
 for(let i=0;i<350;i++)h.ctx.ctAudit(b.id,'host','note',`Milo`,{i});
 const out=admin('list');assert.equal(out.audit.filter(r=>r.memberId===b.id).length,100);
 assert(out.audit.some(r=>r.memberId===a.id&&r.action==='password_setup'));
 assert.equal(JSON.parse(out.audit.at(-1).detail).i,349);
});
