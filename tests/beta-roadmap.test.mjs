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
const edit=(h,id='portfolio',extra={})=>api(h,h.operator,'challengeupdate',{...h.ctx.betaChallengeCatalog().find(c=>c.id===id),challengeId:id,...extra});
const currentEvidence=(h,id='portfolio',extra={})=>{const definition=h.ctx.betaChallengeCatalog().find(c=>c.id===id);return evidence(h,id,{challengeRevision:definition.revision,checks:Array.from(definition.checklist,item=>item.id),...extra});};

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
 assert.equal(edit(h,'feature',{title:'An updated feature challenge'}).ok,true);
 const reads={};let locks=0;
 for(const name of ['internal_beta_challenge_progress','internal_beta_challenge_references','internal_beta_challenge_definitions']) {
  reads[name]=0;const sheet=h.sheets[name],getRange=sheet.getRange;
  sheet.getRange=(...args)=>{const range=getRange(...args),getValues=range.getValues;range.getValues=()=>{reads[name]++;return getValues.call(range);};return range;};
 }
 h.ctx.LockService.getScriptLock=()=>({waitLock(){locks++;},releaseLock(){}});
 const view=api(h,a.token,'list');assert.equal(view.ok,true);assert.equal(view.roadmap.completed,2);assert.equal(view.roadmap.peerWork.length,1);assert.equal(view.roadmap.references.length,1);
 assert.equal(locks,0);assert.deepEqual(reads,{internal_beta_challenge_progress:1,internal_beta_challenge_references:1,internal_beta_challenge_definitions:1});
 const removed=api(h,h.operator,'challengereference',{challengeId:'spend-portal',url:''});
 assert.equal(removed.ok,true);assert.deepEqual(removed.challengeReferences,[]);assert.deepEqual(removed.roadmaps[a.member.id].references,[]);
 const deleted=api(h,h.operator,'memberdelete',{id:b.member.id});
 assert.equal(deleted.ok,true);assert.equal(deleted.challengeProgress.some(item=>item.memberId===b.member.id),false);assert.deepEqual(deleted.roadmaps[a.member.id].peerWork,[]);
 assert.equal(locks,2);
});

test('only managers edit the existing ordered catalog and edits persist with bounded validated fields',()=>{
 const h=setup(),a=join(h),fake=join(h,'Arya'),initial=api(h,h.operator,'list').challengeCatalog;
 assert.equal(h.ctx.doGet().betaChallengeEditing,true);assert.equal(api(h,a.token,'list').betaChallengeEditing,true);
 assert.equal(initial[0].revision,'');assert.equal(initial[1].minIterations,3);assert.equal(initial[0].minIterations,0);
 assert.equal(h.sheets.internal_beta_challenge_definitions,undefined);
 for(const who of ['',h.login('Bijan'),a.token,fake.token])assert.equal(api(h,who,'challengeupdate',{...initial[0],challengeId:'portfolio',title:'Injected'}).ok,false);
 for(const change of [{challengeId:'new-challenge'},{title:''},{title:'x'.repeat(121)},{teaser:'x'.repeat(241)},{brief:'x'.repeat(6001)},{checklist:[]},{checklist:Array.from({length:21},(_,n)=>({id:'item-'+n,label:'Check'}))},{checklist:[{id:'same',label:'One'},{id:'same',label:'Two'}]},{checklist:[{id:'<script>',label:'Bad'}]},{checklist:[{id:'a',label:''}]},{checklist:[{id:'a',label:'x'.repeat(301)}]},{minIterations:-1},{minIterations:21},{minIterations:1.5},{minIterations:'3'},{title:123}])assert.equal(edit(h,'portfolio',change).ok,false,JSON.stringify(change).slice(0,100));
 assert.equal(h.sheets.internal_beta_challenge_definitions,undefined,'invalid edits do not create storage');
 const changed=edit(h,'portfolio',{title:'Build your web home',teaser:'Start publishing',brief:'Create an about page and ship it.',checklist:[{id:'new-domain',label:'Connect a domain'}],minIterations:1,id:'replace-id',reward:'Injected unlock',order:99});
 assert.equal(changed.ok,true);const saved=changed.challengeCatalog[0];assert.ok(saved.revision);assert.equal(saved.title,'Build your web home');assert.equal(saved.minIterations,1);
 assert.deepEqual(changed.challengeCatalog.map(item=>item.id),initial.map(item=>item.id));assert.equal(saved.reward,initial[0].reward);assert.equal(changed.roadmaps[a.member.id].completed,0);
 const reread=api(h,a.token,'list').roadmap.challenges[0];assert.equal(reread.title,saved.title);assert.equal(reread.revision,saved.revision);
 assert.equal(edit(h,'portfolio',saved).challengeCatalog[0].revision,saved.revision,'same edit retry preserves revision');
 assert.equal(h.sheets.internal_beta_challenge_definitions.rows.length,2);
 const again=edit(h,'portfolio',{title:'Another title'});assert.notEqual(again.challengeCatalog[0].revision,saved.revision);assert.equal(h.sheets.internal_beta_challenge_definitions.rows.length,2);
});

test('editing a challenge preserves submitted and approved definitions, evidence, retries and unlocks',()=>{
 const h=setup(),pending=join(h),approved=join(h,'Riley'),fresh=join(h,'Jordan');
 assert.equal(submit(h,pending).ok,true);complete(h,approved);
 const pendingBefore=JSON.stringify(row(h,pending)),approvedBefore=JSON.stringify(row(h,approved));
 const changed=edit(h,'portfolio',{title:'New portfolio requirements',brief:'A revised challenge.',checklist:[{id:'new-check',label:'A new requirement'}],minIterations:2});assert.equal(changed.ok,true);
 assert.equal(JSON.stringify(row(h,pending)),pendingBefore);assert.equal(JSON.stringify(row(h,approved)),approvedBefore);
 for(const person of [pending,approved]) {
  const view=api(h,person.token,'list').roadmap.challenges[0];assert.equal(view.title,h.ctx.BETA_CHALLENGES[0].title);assert.equal(view.revision,'');assert.equal(view.minIterations,0);assert.equal(view.submission.definition.title,view.title);
  assert.equal(submit(h,person).ok,true,'old submitted evidence retries against its original snapshot');
 }
 const newView=api(h,fresh.token,'list').roadmap.challenges[0];assert.equal(newView.title,'New portfolio requirements');assert.ok(newView.revision);assert.equal(newView.minIterations,2);
 assert.equal(api(h,approved.token,'list').roadmap.completed,1);assert.equal(api(h,approved.token,'list').roadmap.challenges[1].locked,false);
 assert.equal(approve(h,pending).ok,true,'original requirements remain reviewable');assert.equal(api(h,pending.token,'list').roadmap.completed,1);
 const manager=api(h,h.operator,'list');assert.equal(manager.challengeProgress.find(item=>item.memberId===pending.member.id).definition.title,h.ctx.BETA_CHALLENGES[0].title);
});

test('mutable drafts reject stale revisions and resubmit against current checklists and iteration requirements',()=>{
 const h=setup(),a=join(h);
 assert.equal(submit(h,a,'portfolio',{submit:false,checks:['domain']}).ok,true);const draft=JSON.stringify(row(h,a));
 const changed=edit(h,'portfolio',{checklist:[{id:'new-check',label:'Ship the revised task'}],minIterations:1}).challengeCatalog[0];
 const view=api(h,a.token,'list').roadmap.challenges[0];assert.equal(view.revision,changed.revision);assert.equal(view.submission.challengeRevision,'');assert.equal(view.submission.definition,null);
 assert.equal(submit(h,a,'portfolio',{submit:false}).code,'CHALLENGE_CHANGED');assert.equal(submit(h,a).code,'CHALLENGE_CHANGED');assert.equal(JSON.stringify(row(h,a)),draft);
 assert.equal(api(h,a.token,'challengesave',currentEvidence(h)).ok,false,'new minimum applies');
 const links=['https://github.com/maya-builds/demo/commit/'+'d'.repeat(40)];
 assert.equal(api(h,a.token,'challengesave',currentEvidence(h,'portfolio',{iterationLinks:links,submit:false})).ok,true);
 assert.equal(row(h,a).challengeRevision,changed.revision);assert.equal(row(h,a).definition,'');
 assert.equal(api(h,a.token,'challengesave',currentEvidence(h,'portfolio',{iterationLinks:links})).ok,true);const submitted=JSON.parse(row(h,a).definition);assert.equal(submitted.revision,changed.revision);
 assert.equal(api(h,h.operator,'challengereview',{memberId:a.member.id,challengeId:'portfolio',status:'changes_requested',feedback:'Please improve the result.'}).ok,true);
 const newer=edit(h,'portfolio',{checklist:[{id:'third-check',label:'Try the latest task'}],minIterations:0}).challengeCatalog[0];
 const correction=api(h,a.token,'list').roadmap.challenges[0];assert.equal(correction.revision,newer.revision);assert.equal(correction.submission.challengeRevision,changed.revision);assert.equal(correction.submission.definition,null);
 assert.equal(api(h,a.token,'challengesave',currentEvidence(h)).ok,true);assert.equal(JSON.parse(row(h,a).definition).revision,newer.revision);
});

test('feedback-only review keeps pending work and original evidence private without unlocking anything',()=>{
 const h=setup(),a=join(h),peer=join(h,'Riley');complete(h,peer);
 const review=payload=>api(h,h.operator,'challengereview',{memberId:a.member.id,challengeId:'portfolio',status:'submitted',...payload});
 assert.equal(review({feedback:'No work yet'}).ok,false);assert.equal(submit(h,a,'portfolio',{submit:false}).ok,true);assert.equal(review({feedback:'Draft'}).ok,false);
 assert.equal(submit(h,a).ok,true);const before={...row(h,a)};
 assert.equal(review({feedback:''}).ok,false);assert.equal(review({feedback:'x'.repeat(5001)}).ok,false);
 assert.equal(api(h,peer.token,'challengereview',{memberId:a.member.id,challengeId:'portfolio',status:'submitted',feedback:'Spoof'}).code,'FORBIDDEN');
 assert.equal(review({feedback:'Private feedback while I finish reviewing.'}).ok,true);
 const after=row(h,a);for(const key of h.ctx.BETA_CHALLENGE_PROGRESS.filter(key=>!['feedback','reviewedAt','reviewedBy','updatedAt'].includes(key)))assert.equal(after[key],before[key],key);
 assert.equal(after.status,'submitted');assert.equal(after.reviewedBy,'Arya');assert.ok(after.reviewedAt);
 const own=api(h,a.token,'list');assert.equal(own.roadmap.completed,0);assert.equal(own.roadmap.challenges[0].submission.feedback,'Private feedback while I finish reviewing.');
 assert.equal(JSON.stringify(api(h,peer.token,'list')).includes('Private feedback'),false);
 assert.equal(approve(h,a).ok,true);assert.equal(review({feedback:'Already approved'}).ok,false);
});

test('legacy progress header upgrade is locked and original definitions survive the first catalog edit',()=>{
 const h=setup(),pending=join(h),approved=join(h,'Riley');assert.equal(submit(h,pending).ok,true);complete(h,approved);
 const sheet=h.sheets.internal_beta_challenge_progress;sheet.rows.forEach(row=>row.splice(14));const before=sheet.rows.map(row=>row.slice());
 let held=false,locks=0;h.ctx.LockService.getScriptLock=()=>({waitLock(){held=true;locks++;},releaseLock(){held=false;}});
 const getRange=sheet.getRange;sheet.getRange=(...args)=>{const range=getRange(...args),setValues=range.setValues;range.setValues=(...values)=>{assert.equal(held,true,'legacy headers are upgraded only under lock');return setValues.apply(range,values);};return range;};
 const read=api(h,h.operator,'list');assert.equal(read.ok,true);assert.equal(locks,1);assert.equal(read.challengeProgress[0].definition.revision,'');
 assert.deepEqual(sheet.rows.slice(1),before.slice(1));assert.deepEqual(sheet.rows[0],Array.from(h.ctx.BETA_CHALLENGE_PROGRESS));
 const updated=edit(h,'portfolio',{title:'Changed after launch',checklist:[{id:'new-work',label:'New task'}]});assert.equal(updated.ok,true);
 for(const person of [pending,approved]) {
  const saved=row(h,person);assert.equal(JSON.parse(saved.definition).title,h.ctx.BETA_CHALLENGES[0].title);assert.equal(saved.challengeRevision,'');
  const original=before.find(cells=>String(cells[0]).replace(/^\u200b/,'')===saved.id);assert.deepEqual(sheet.rows[saved._row-1].slice(0,14),original);
  assert.equal(submit(h,person).ok,true);
 }
 assert.equal(api(h,approved.token,'list').roadmap.completed,1);
});

test('challenge schema migration refuses occupied or mismatched columns without overwriting progress',()=>{
 for(const corruption of ['occupied appended column','wrong header']) {
  const h=setup(),a=join(h);assert.equal(submit(h,a).ok,true);const sheet=h.sheets.internal_beta_challenge_progress;
  sheet.rows[0]=sheet.rows[0].slice(0,14);
  if(corruption==='wrong header'){sheet.rows.forEach(row=>row.splice(14));sheet.rows[0][3]='other-status';}
  const before=JSON.stringify(sheet.rows);const out=api(h,h.operator,'list');assert.equal(out.ok,false);assert.match(out.error,/columns do not match/);assert.equal(JSON.stringify(sheet.rows),before);
 }
});
