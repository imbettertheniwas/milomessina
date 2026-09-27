import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const api=(h,token,action,p={})=>h.ctx.doPost({postData:{contents:JSON.stringify({_api:'beta',_session:token,action,...p})}});
const setup=()=>{const h=harness(),operator=h.login('Arya');api(h,operator,'list');return {...h,operator};};
const join=(h,name='Maya',extra={})=>h.ctx.internalSessionApi({action:'betajoin',invite:'beta',name,email:name.toLowerCase()+'@example.com',phone:'+1 212 555 0100',github:name.toLowerCase()+'-builds',...extra});
const evidence=(h,id='portfolio',extra={})=>({challengeId:id,liveUrl:'https://demo.example.com',repoUrl:'https://github.com/maya-builds/demo',notes:'I built and deployed this work. My before and after changes are documented here.',checks:Array.from(h.ctx.BETA_CHALLENGES.find(c=>c.id===id).checklist,c=>c.id),iterationLinks:id==='spend-portal'?['a','b','c'].map(hash=>'https://github.com/maya-builds/demo/commit/'+hash.repeat(40)):[],submit:true,...extra});
const submit=(h,person,id='portfolio',extra={})=>api(h,person.token,'challengesave',evidence(h,id,extra));
const approve=(h,person,id='portfolio')=>api(h,h.operator,'challengereview',{memberId:person.member.id,challengeId:id,status:'approved',feedback:'Looks good.'});
const complete=(h,person,id='portfolio')=>{assert.equal(submit(h,person,id).ok,true);assert.equal(approve(h,person,id).ok,true);};
const row=(h,person,id='portfolio')=>h.ctx.betaChallengeRows().find(r=>r.memberId===person.member.id&&r.challengeId===id);

test('new and existing beta interns start at portfolio with later details and peer work withheld',()=>{
 const h=setup(),a=join(h),b=join(h,'Riley',{website:'riley.example.com'});
 api(h,b.token,'recap',{learned:'Private learning notes',accomplished:'Private accomplishments',links:['https://riley-secret.example.com'],submit:true});
 api(h,h.operator,'challengereference',{challengeId:'spend-portal',title:'Team spend demo',url:'https://team-spend.example.com',notes:'A shareable demo with invented data.'});
 const output=api(h,a.token,'list');
 assert.equal(output.betaRoadmap,true);assert.equal(h.ctx.doGet().betaRoadmap,true);
 assert.equal(output.roadmap.completed,0);assert.equal(output.roadmap.total,4);assert.equal(output.roadmap.currentChallengeId,'portfolio');
 assert.deepEqual(output.roadmap.unlocks,{peerWork:false,teamReferences:false});
 assert.equal(output.roadmap.challenges[0].locked,false);assert.ok(output.roadmap.challenges[0].checklist.length);
 for(const challenge of output.roadmap.challenges.slice(1)) {
  assert.equal(challenge.locked,true);assert.ok(challenge.title);assert.ok(challenge.teaser);
  assert.equal(challenge.brief,undefined);assert.equal(challenge.checklist,undefined);assert.equal(challenge.submission,null);
 }
 const peer=output.peers.find(p=>p.id===b.member.id);assert.equal(peer.website,'');assert.equal(peer.github,'');
 assert.equal(output.peers.find(p=>p.id===a.member.id).github,a.member.github);
 for(const secret of ['riley-builds','riley.example.com','riley-secret.example.com','Private learning notes','team-spend.example.com'])assert.equal(JSON.stringify(output).includes(secret),false,secret);
 for(const field of ['challengeProgress','challengeCatalog','challengeReferences','roadmaps'])assert.equal(output[field],undefined);
 assert.deepEqual(output.roadmap.peerWork,[]);assert.deepEqual(output.roadmap.references,[]);
 assert.equal(h.sheets.internal_beta_challenge_progress,undefined,'a read does not create a progress table');
});

test('submission requirements, draft recovery and approval unlock only the next challenge',()=>{
 const h=setup(),a=join(h);
 assert.equal(submit(h,a,'spend-portal').ok,false);
 assert.equal(submit(h,a,'portfolio',{checks:[]}).ok,false);
 assert.equal(submit(h,a,'portfolio',{notes:''}).ok,false);
 assert.equal(submit(h,a,'portfolio',{liveUrl:''}).ok,false);
 assert.equal(submit(h,a,'portfolio',{repoUrl:''}).ok,false);
 const draft=submit(h,a,'portfolio',{submit:false,notes:'Draft',liveUrl:'',repoUrl:'',checks:['domain']});
 assert.equal(draft.ok,true);assert.equal(draft.roadmap.challenges[0].submission.status,'draft');assert.equal(draft.roadmap.completed,0);
 const restored=api(h,h.ctx.internalSessionApi({action:'betalogin',code:a.code}).token,'list');
 assert.equal(restored.roadmap.challenges[0].submission.notes,'Draft');
 const submitted=submit(h,a);assert.equal(submitted.ok,true);assert.equal(submitted.roadmap.completed,0);assert.equal(submitted.roadmap.challenges[1].locked,true);
 assert.equal(row(h,a).status,'submitted');assert.ok(row(h,a).submittedAt);
 assert.equal(approve(h,a).ok,true);
 const approved=api(h,a.token,'list');assert.equal(approved.roadmap.completed,1);assert.equal(approved.roadmap.currentChallengeId,'spend-portal');
 assert.equal(approved.roadmap.challenges[1].locked,false);assert.equal(approved.roadmap.challenges[2].locked,true);
 assert.deepEqual(approved.roadmap.unlocks,{peerWork:true,teamReferences:false});
 assert.equal(row(h,a).reviewedBy,'Arya');assert.ok(row(h,a).reviewedAt);
});

test('work belongs to the session and beta users cannot spoof reviews, references or manager views',()=>{
 const h=setup(),a=join(h),b=join(h,'Arya');
 const output=submit(h,a,'portfolio',{memberId:b.member.id,id:'spoofed',status:'approved',reviewedBy:'Arya',operator:true,manager:true,unlocks:{peerWork:true}});
 assert.equal(output.ok,true);assert.equal(output.manager,false);assert.equal(row(h,a).status,'submitted');assert.equal(row(h,b),undefined);
 for(const who of [a.token,b.token,h.login('Bijan'),'']) {
  assert.equal(api(h,who,'challengereview',{memberId:a.member.id,challengeId:'portfolio',status:'approved'}).ok,false);
  assert.equal(api(h,who,'challengereference',{challengeId:'portfolio',title:'Fake',url:'https://fake.example.com'}).ok,false);
 }
 assert.equal(submit(h,{token:h.operator},'portfolio',{memberId:a.member.id}).code,'FORBIDDEN');
 assert.equal(api(h,b.token,'list').roadmap.completed,0);assert.equal(api(h,b.token,'list').challengeProgress,undefined);
 for(const table of ['internal_beta_challenge_progress','internal_beta_challenge_references']) {
  const result=h.ctx.doPost({postData:{contents:JSON.stringify({_page:'/'+table,name:'Injection'})}});assert.equal(result.ok,false);
 }
});

test('submitted and approved evidence cannot be rewritten; requested changes can be fixed and resubmitted',()=>{
 const h=setup(),a=join(h);
 assert.equal(approve(h,a).ok,false);
 assert.equal(submit(h,a,'portfolio',{submit:false}).ok,true);assert.equal(approve(h,a).ok,false);
 assert.equal(submit(h,a).ok,true);const saved=JSON.stringify(row(h,a));
 assert.equal(submit(h,a,'portfolio',{notes:'Swapped while reviewing',submit:false}).ok,false);assert.equal(JSON.stringify(row(h,a)),saved);
 assert.equal(api(h,h.operator,'challengereview',{memberId:a.member.id,challengeId:'portfolio',status:'changes_requested',feedback:''}).ok,false);
 const changes=api(h,h.operator,'challengereview',{memberId:a.member.id,challengeId:'portfolio',status:'changes_requested',feedback:'Make the contact link usable on mobile.'});
 assert.equal(changes.ok,true);assert.equal(api(h,a.token,'list').roadmap.challenges[0].submission.feedback,'Make the contact link usable on mobile.');
 assert.equal(submit(h,a,'portfolio',{notes:'Fixed the contact link.'}).ok,true);assert.equal(row(h,a).notes,'Fixed the contact link.');
 assert.equal(api(h,h.login('Milo'),'challengereview',{memberId:a.member.id,challengeId:'portfolio',status:'approved',feedback:'Checked on mobile.'}).ok,true);
 const approved=JSON.stringify(row(h,a));
 assert.equal(submit(h,a,'portfolio',{liveUrl:'https://replaced.example.com'}).ok,false);assert.equal(approve(h,a).ok,false);
 assert.equal(api(h,h.operator,'challengereview',{memberId:a.member.id,challengeId:'portfolio',status:'changes_requested',feedback:'Undo'}).ok,false);
 assert.equal(JSON.stringify(row(h,a)),approved);
});

test('spend portal needs three distinct follow-up links in the submitted GitHub repository',()=>{
 const h=setup(),a=join(h);complete(h,a);
 const one='https://github.com/maya-builds/demo/commit/'+'a'.repeat(40);
 for(const iterationLinks of [[],[one,one,one+'/'],[one,one.toUpperCase(),one],['https://github.com/maya-builds/other/commit/'+'b'.repeat(40)],['https://evil.example.com/commit/'+'c'.repeat(40)],['https://github.com/maya-builds/demo'],['javascript:alert(1)'],'not-an-array']) {
  assert.equal(submit(h,a,'spend-portal',{iterationLinks}).ok,false,JSON.stringify(iterationLinks));
 }
 const links=[one,'https://github.com/maya-builds/demo/commit/'+'b'.repeat(40),'https://github.com/maya-builds/demo/compare/v1...v2'];
 assert.equal(submit(h,a,'spend-portal',{iterationLinks:links}).ok,true);assert.equal(approve(h,a,'spend-portal').ok,true);
 const output=api(h,a.token,'list');assert.equal(output.roadmap.completed,2);assert.equal(output.roadmap.challenges[2].locked,false);
 assert.equal(output.roadmap.challenges[3].locked,true);assert.deepEqual(output.roadmap.unlocks,{peerWork:true,teamReferences:true});
 assert.deepEqual(output.roadmap.challenges[1].submission.iterationLinks,links);
});

test('unsafe evidence, unknown checklist items and overlong input cannot write a submission',()=>{
 const h=setup(),a=join(h);
 for(const override of [{liveUrl:'javascript:alert(1)'},{liveUrl:'https://user:pass@example.com'},{repoUrl:'https://github.com.evil.example/you/repo'},{repoUrl:'https://github.com/you'},{repoUrl:'https://github.com/you/.git'},{repoUrl:'https://github.com/you/repo/issues/1'},{repoUrl:'http://github.com/you/repo'},{checks:['domain','unknown']},{checks:'domain'},{notes:'x'.repeat(5001)},{challengeId:'arbitrary'}]) {
  assert.equal(submit(h,a,'portfolio',override).ok,false,JSON.stringify(override).slice(0,150));
  assert.equal(row(h,a),undefined);
 }
 assert.equal(submit(h,a,'portfolio',{notes:'=IMPORTXML("example")'}).ok,true);
 const cells=h.sheets.internal_beta_challenge_progress.rows[1];assert.ok(cells.filter(v=>typeof v==='string').every(v=>v.startsWith('\u200b')));
});

test('peer projects are approved, cohort scoped, and exclude drafts, notes, recaps, and review feedback',()=>{
 const h=setup(),a=join(h),b=join(h,'Riley',{website:'riley.example.com'}),draft=join(h,'Jordan'),outside=join(h,'Taylor');
 complete(h,b);
 assert.equal(submit(h,draft,'portfolio',{notes:'Private draft notes',submit:false}).ok,true);
 complete(h,outside);
 const outsider=h.ctx.betaRead('internal_beta_members',h.ctx.BETA_MEMBERS).find(m=>m.id===outside.member.id);outsider.batchId='another-cohort';h.ctx.betaWrite('internal_beta_members',h.ctx.BETA_MEMBERS,outsider);
 api(h,b.token,'recap',{learned:'Private Riley recap',accomplished:'Built a site',links:['https://private-recap.example.com'],submit:true});
 complete(h,a);
 const output=api(h,a.token,'list');assert.equal(output.roadmap.peerWork.length,1);
 assert.equal(output.roadmap.peerWork[0].memberId,b.member.id);assert.equal(output.roadmap.peerWork[0].challengeId,'portfolio');
 assert.equal(output.peers.find(p=>p.id===b.member.id).website,'https://riley.example.com');
 assert.equal(output.peers.find(p=>p.id===b.member.id).github,b.member.github);
 for(const secret of ['Private draft notes','Private Riley recap','private-recap.example.com','Taylor','taylor-builds'])assert.equal(JSON.stringify(output).includes(secret),false,secret);
 for(const key of ['notes','feedback','checks','reviewedBy','email','phone'])assert.equal(output.roadmap.peerWork[0][key],undefined);
 api(h,h.operator,'memberupdate',{id:b.member.id,status:'paused'});assert.equal(api(h,a.token,'list').roadmap.peerWork.length,0);
});

test('team references remain server-side until two approvals and can be safely configured or removed',()=>{
 const h=setup(),a=join(h),manager=h.login('Milo');
 const reference={challengeId:'spend-portal',title:'Our sample spend portal',url:'https://spend-reference.example.com',notes:'Sample data only.'};
 assert.equal(api(h,manager,'challengereference',reference).ok,true);
 assert.equal(api(h,manager,'challengereference',{...reference,url:'javascript:alert(1)'}).ok,false);
 assert.equal(api(h,manager,'challengereference',{...reference,url:'https://milomessina.com/internal#/spend'}).ok,false);
 assert.equal(api(h,manager,'challengereference',{...reference,url:'https://milomessina.com/invoice/'}).ok,false);
 complete(h,a);
 assert.equal(JSON.stringify(api(h,a.token,'list')).includes(reference.url),false);
 complete(h,a,'spend-portal');assert.deepEqual(api(h,a.token,'list').roadmap.references,[reference]);
 const changed={...reference,title:'Updated demo',notes:'Look at its filters.'};
 const managerOutput=api(h,manager,'challengereference',changed);assert.deepEqual(managerOutput.challengeReferences,[changed]);
 assert.equal(managerOutput.challengeCatalog.length,4);assert.equal(managerOutput.challengeProgress.length,2);
 assert.equal(managerOutput.roadmaps[a.member.id].completed,2);assert.equal(managerOutput.roadmap,undefined);
 assert.equal(h.sheets.internal_beta_challenge_references.rows.length,2,'upsert updates the existing reference');
 assert.equal(api(h,manager,'challengereference',{challengeId:'spend-portal',url:''}).ok,true);assert.deepEqual(api(h,a.token,'list').roadmap.references,[]);
});

test('contiguous approval is required even when a historical row claims a later challenge is approved',()=>{
 const h=setup(),a=join(h),b=join(h,'Riley');
 h.ctx.betaWrite('internal_beta_challenge_progress',h.ctx.BETA_CHALLENGE_PROGRESS,{id:'legacy',memberId:a.member.id,challengeId:'spend-portal',status:'approved',liveUrl:'https://hidden.example.com',repoUrl:'https://github.com/maya-builds/secret'});
 const output=api(h,a.token,'list');assert.equal(output.roadmap.completed,0);assert.equal(output.roadmap.challenges[1].submission,null);assert.equal(output.roadmap.unlocks.teamReferences,false);
 assert.equal(submit(h,a,'iterate').ok,false);
 complete(h,b);assert.deepEqual(api(h,b.token,'list').roadmap.peerWork,[]);
 const malformed=row(h,a,'spend-portal');malformed.status='submitted';h.ctx.betaWrite('internal_beta_challenge_progress',h.ctx.BETA_CHALLENGE_PROGRESS,malformed);
 assert.equal(approve(h,a,'spend-portal').ok,false);
});

test('four reviewed challenges complete the starter path and deleting a member removes their progress only',()=>{
 const h=setup(),a=join(h),b=join(h,'Riley');
 for(const id of ['portfolio','spend-portal','iterate','feature'])complete(h,a,id);
 assert.equal(submit(h,b,'portfolio',{submit:false}).ok,true);
 const final=api(h,a.token,'list').roadmap;assert.equal(final.completed,4);assert.equal(final.currentChallengeId,null);assert.ok(final.challenges.every(c=>!c.locked&&c.submission.status==='approved'));
 assert.equal(api(h,h.operator,'memberdelete',{id:a.member.id}).ok,true);
 assert.equal(h.ctx.betaChallengeRows().some(r=>r.memberId===a.member.id),false);assert.equal(h.ctx.betaChallengeRows().length,1);assert.equal(row(h,b).status,'draft');
 assert.equal(api(h,a.token,'list').code,'AUTH_REQUIRED');
});

test('challenge writes and reviews share the request lock and stale sessions cannot submit',()=>{
 const h=setup(),a=join(h);let locked=false,acquired=0;
 h.ctx.LockService.getScriptLock=()=>({waitLock(){assert.equal(locked,false);locked=true;acquired++;},releaseLock(){assert.equal(locked,true);locked=false;}});
 const write=h.ctx.betaWrite;h.ctx.betaWrite=(...args)=>{assert.equal(locked,true);return write(...args);};
 assert.equal(submit(h,a).ok,true);assert.equal(approve(h,a).ok,true);assert.equal(acquired,2);assert.equal(locked,false);
 assert.equal(api(h,h.operator,'memberupdate',{id:a.member.id,status:'paused'}).ok,true);
 assert.equal(submit(h,a,'spend-portal').code,'AUTH_REQUIRED');assert.equal(row(h,a,'spend-portal'),undefined);assert.equal(locked,false);
});

test('lost-response submission retries preserve reviewed evidence, timestamps and unlocks without accepting stale drafts',()=>{
 const h=setup(),a=join(h),b=join(h,'Riley');
 assert.equal(submit(h,a).ok,true);
 const submitted=JSON.stringify(row(h,a));
 const retry=submit(h,a,'portfolio',{memberId:b.member.id,status:'approved',reviewedBy:'Milo'});
 assert.equal(retry.ok,true);assert.equal(retry.roadmap.completed,0);assert.equal(JSON.stringify(row(h,a)),submitted);assert.equal(row(h,b),undefined);
 assert.equal(submit(h,a,'portfolio',{submit:false}).ok,false);assert.equal(JSON.stringify(row(h,a)),submitted);
 assert.equal(approve(h,a).ok,true);const approved=JSON.stringify(row(h,a));
 const lateRetry=submit(h,a,'portfolio',{status:'submitted',reviewedAt:'',feedback:'Replace the feedback'});
 assert.equal(lateRetry.ok,true);assert.equal(lateRetry.roadmap.completed,1);assert.equal(JSON.stringify(row(h,a)),approved);
 assert.equal(submit(h,a,'portfolio',{submit:false}).ok,false);
 assert.equal(submit(h,a,'portfolio',{notes:'Different evidence'}).ok,false);assert.equal(JSON.stringify(row(h,a)),approved);
 assert.equal(h.ctx.betaChallengeRows().length,1);
});

test('roadmap reads share request snapshots without locking and deletion responses invalidate cached rows',()=>{
 const h=setup(),a=join(h),b=join(h,'Riley');
 complete(h,a);complete(h,a,'spend-portal');complete(h,b);
 assert.equal(api(h,h.operator,'challengereference',{challengeId:'spend-portal',title:'Demo',url:'https://reference.example.com',notes:'Sample data.'}).ok,true);
 const reads={};let locks=0;
 for(const name of ['internal_beta_challenge_progress','internal_beta_challenge_references']) {
  reads[name]=0;const sheet=h.sheets[name],getRange=sheet.getRange;
  sheet.getRange=(...args)=>{const range=getRange(...args),getValues=range.getValues;range.getValues=()=>{reads[name]++;return getValues.call(range);};return range;};
 }
 h.ctx.LockService.getScriptLock=()=>({waitLock(){locks++;},releaseLock(){}});
 const view=api(h,a.token,'list');assert.equal(view.ok,true);assert.equal(view.roadmap.completed,2);assert.equal(view.roadmap.peerWork.length,1);assert.equal(view.roadmap.references.length,1);
 assert.equal(locks,0);assert.deepEqual(reads,{internal_beta_challenge_progress:1,internal_beta_challenge_references:1});
 const removed=api(h,h.operator,'challengereference',{challengeId:'spend-portal',url:''});
 assert.equal(removed.ok,true);assert.deepEqual(removed.challengeReferences,[]);assert.deepEqual(removed.roadmaps[a.member.id].references,[]);
 const deleted=api(h,h.operator,'memberdelete',{id:b.member.id});
 assert.equal(deleted.ok,true);assert.equal(deleted.challengeProgress.some(item=>item.memberId===b.member.id),false);assert.deepEqual(deleted.roadmaps[a.member.id].peerWork,[]);
 assert.equal(locks,2);
});
