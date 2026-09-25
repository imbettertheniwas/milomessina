import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const SECRET='private operator access secret 2026';
const beta=(h,token,action,p={})=>h.ctx.betaApi({_session:token,action,...p});
const setup=()=>{
 const h=harness({INTERNAL_LOGIN_SECRET:SECRET});h.operator=h.login('Arya');
 h.invite=beta(h,h.operator,'batchadd',{name:'September trial',startDate:'2026-09-21'}).invite;return h;
};
const login=(h,code)=>h.ctx.internalSessionApi({action:'betalogin',code});
const add=(h,name='Beta One',over={})=>{
 const added=h.ctx.internalSessionApi({action:'betajoin',invite:h.invite,name,phone:'+1 (212) 555-0100',email:name.toLowerCase().replaceAll(' ','')+'@example.com',github:'trial-builder',...over});
 if(!added.ok)return added;
 const managed=beta(h,h.operator,'memberupdate',{id:added.member.id,notes:over.notes||'Private evaluation: promising'});
 return {...managed,code:added.code,createdMemberId:added.member.id};
};
const id=out=>out.createdMemberId;
const post=(h,body)=>h.ctx.doPost({postData:{contents:JSON.stringify(body)}});

test('beta activation requires a real private secret and stays separate from the main roster',()=>{
 const h=harness(),operator=h.login('Arya');
 const list=beta(h,operator,'list');
 assert.equal(list.ok,true);assert.equal(list.configured,false);assert.match(list.setupMessage,/INTERNAL_LOGIN_SECRET/);
 const denied=beta(h,operator,'batchadd',{name:'Trial',startDate:'2026-09-21'});
 assert.equal(denied.code,'BETA_UNCONFIGURED');
 assert.equal(login(h,'BETA-'+ 'A'.repeat(32)).code,'BETA_UNCONFIGURED');
 assert.equal(h.sheets.internal_beta_members,undefined);
 h.properties.INTERNAL_LOGIN_SECRET='too short';
 assert.equal(beta(h,h.login('Arya'),'batchadd',{name:'Trial',startDate:'2026-09-21'}).code,'BETA_UNCONFIGURED');
 h.properties.INTERNAL_LOGIN_SECRET=SECRET;h.operator=h.login('Arya');
 h.invite=beta(h,h.operator,'batchadd',{name:'Trial',startDate:'2026-09-21'}).invite;
 assert.equal(add(h).ok,true);assert.equal(h.ctx.rosterPayers().includes('Beta One'),false);
 assert.equal(h.properties.INTERNAL_PRIVATE_AUTH_REQUIRED,'true');
});

test('private core secret rejects public fallback and invalidates legacy or changed-secret sessions',()=>{
 const h=harness(),weak=h.login('Arya');
 h.properties.INTERNAL_LOGIN_SECRET=SECRET;
 assert.equal(h.ctx.internalActor({_session:weak}),null);
 assert.equal(h.ctx.internalSessionApi({action:'login',who:'Arya',passcode:'monkey'}).ok,false);
 const strong=h.login('Arya');h.operator=strong;
 assert.equal(h.ctx.internalActor({_session:strong}),'Arya');
 h.invite=beta(h,strong,'batchadd',{name:'Trial',startDate:'2026-09-21'}).invite;
 const added=add(h),b=login(h,added.code).token;
 h.properties.INTERNAL_LOGIN_SECRET='a different strong private secret';
 assert.equal(h.ctx.internalActor({_session:strong}),null);
 assert.equal(beta(h,b,'list').code,'AUTH_REQUIRED');assert.equal(login(h,added.code).ok,false);
 for(const insecure of ['', 'monkey', 'too short']) {
   h.properties.INTERNAL_LOGIN_SECRET=insecure;
   assert.equal(h.ctx.internalSessionApi({action:'login',who:'Arya',passcode:insecure||'monkey'}).ok,false);
   assert.equal(h.ctx.internalActor({_session:weak}),null);
   assert.equal(h.ctx.internalActor({_session:strong}),null);
 }
});

test('member codes are random, hashed at rest and disclosed only on join or rotate',()=>{
 const h=setup(),added=add(h),other=add(h,'Beta Two');
 assert.match(added.code,/^BETA-[A-F0-9]{32}$/);assert.notEqual(added.code,other.code);
 assert.equal(JSON.stringify(h.sheets.internal_beta_members.rows).includes(added.code),false);
 const stored=h.ctx.betaRead('internal_beta_members',h.ctx.BETA_MEMBERS)[0];assert.match(stored.codeHash,/^[a-f0-9]{64}$/);
 const list=beta(h,h.operator,'list');
 assert.equal(list.code,undefined);assert.equal(list.members[0].codeHash,undefined);assert.equal(list.members[0].epoch,undefined);
 assert.equal(list.members[0].notes,'Private evaluation: promising');assert.equal(login(h,added.code.toLowerCase()).ok,true);
 const rotated=beta(h,h.operator,'rotatecode',{id:id(added)});
 assert.notEqual(rotated.code,added.code);assert.equal(login(h,added.code).ok,false);assert.equal(login(h,rotated.code).ok,true);
});

test('beta identities cannot read any core namespace or spoof a core operator with a matching name',()=>{
 const h=setup(),added=add(h,'Arya'),signed=login(h,added.code);
 assert.equal(signed.beta,true);assert.equal(signed.operator,undefined);assert.equal(signed.admin,undefined);
 assert.equal(h.ctx.internalActor({_session:signed.token,who:'Arya'}),null);
 for(const namespace of ['invoice','campus','posts','schedules','forms','admin','refer'])for(const session of ['',signed.token]) {
   const result=post(h,{_api:namespace,_key:'monkey',_session:session,action:'list',who:'Arya'});
   assert.equal(result.ok,false,namespace+' must reject beta/public reads');assert.equal(result.rows,undefined);assert.equal(result.members,undefined);
 }
 assert.equal(beta(h,h.login('Bijan'),'list').ok,false);
 assert.equal(beta(h,signed.token,'memberupdate',{id:id(added),name:'Intruder'}).code,'FORBIDDEN');
 for(const target of ['internal_beta_members','internal_beta_batches','internal_beta_attendance','internal_beta_recaps'])assert.equal(post(h,{_page:'/'+target,name:'Injection'}).ok,false);
});

test('beta session exposes own profile and never private notes, codes or core roster',()=>{
 const h=setup(),a=add(h),b=add(h,'Beta Two'),signed=login(h,a.code);
 const list=beta(h,signed.token,'list');
 assert.equal(list.manager,false);assert.equal(list.members.length,1);assert.equal(list.member.id,id(a));
 assert.equal(list.peers.length,2);assert.equal(JSON.stringify(list).includes('Private evaluation'),false);
 assert.equal(list.member.notes,undefined);assert.equal(signed.member.notes,undefined);
 const session=h.ctx.internalSessionApi({action:'session',_session:signed.token});
 assert.equal(session.beta,true);assert.equal(session.roster,undefined);assert.equal(session.member.notes,undefined);
 assert.equal(JSON.stringify(session).includes(b.code),false);
});

test('unsupported onboarding, tasks and checkin endpoints are absent for participants and operators',()=>{
 const h=setup(),a=add(h),token=login(h,a.code).token;
 for(const who of [token,h.operator])for(const action of ['itemadd','itemupdate','checkin','memberadd'])assert.equal(beta(h,who,action,{title:'Unsupported',body:'Unsupported'}).ok,false);
 const list=beta(h,token,'list');
 assert.deepEqual(list.permissions,['attendance','github','recap']);assert.equal(list.items,undefined);assert.equal(list.checkins,undefined);
 assert.equal(h.sheets.internal_beta_items,undefined);assert.equal(h.sheets.internal_beta_checkins,undefined);
});

test('pausing, graduation, rotation and logout immediately revoke beta sessions',()=>{
 for(const status of ['paused','graduated']) {
   const h=setup(),a=add(h),token=login(h,a.code).token;
   assert.equal(beta(h,h.operator,'memberupdate',{id:id(a),status}).ok,true);
   assert.equal(beta(h,token,'list').code,'AUTH_REQUIRED');assert.equal(login(h,a.code).ok,false);
   beta(h,h.operator,'memberupdate',{id:id(a),status:'active'});
   assert.equal(beta(h,token,'list').ok,false);assert.equal(login(h,a.code).ok,true);
 }
 const h=setup(),a=add(h),token=login(h,a.code).token;
 const rotated=beta(h,h.operator,'rotatecode',{id:id(a)});assert.equal(beta(h,token,'list').ok,false);
 const fresh=login(h,rotated.code).token;
 h.ctx.internalSessionApi({action:'logout',_session:fresh});assert.equal(beta(h,fresh,'list').ok,false);
});

test('validation preserves rows and encodes formula-like text safely',()=>{
 const h=setup(),a=add(h,'=Formula',{notes:'=IMPORTXML("https://example.com")'});
 assert.equal(a.ok,true);assert.equal(a.members[0].name,'=Formula');
 const raw=h.sheets.internal_beta_members.rows[1];assert.ok(raw.filter(v=>typeof v==='string').every(v=>v.startsWith('\u200b')));
 assert.equal(add(h,'Beta Duplicate',{email:'=formula@example.com'}).ok,false);
 assert.equal(beta(h,h.operator,'memberupdate',{id:id(a),status:'unknown'}).ok,false);
 assert.equal(beta(h,h.operator,'list').members[0].status,'active');
});
