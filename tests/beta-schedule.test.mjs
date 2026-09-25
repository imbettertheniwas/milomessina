import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/internal-harness.mjs';

const api=(h,token,action,p={})=>h.ctx.betaApi({_session:token,action,...p});
const auth=(h,action,p={})=>h.ctx.internalSessionApi({action,...p});
const manual=(over={})=>({timezone:'America/New_York',mode:'manual',blocks:[{day:1,start:'09:00',end:'10:00',label:'Class'}],...over});
const pdf=(over={})=>({name:'classes.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.7\nSchedule').toString('base64'),...over});
const uploaded=(file=pdf(),over={})=>({timezone:'America/New_York',mode:'file',blocks:[],file,...over});
const join=(h,name='Maya',over={})=>auth(h,'betajoin',{invite:'beta',name,email:name.toLowerCase()+'@example.com',phone:'+1 212 555 0100',github:name.toLowerCase()+'-builds',joinRequest:(name==='Maya'?'a':'b').repeat(32),...over});
function setup(){
 const h=harness(),files=new Map();let nextId=0;
 const blob=(bytes,type='',name='')=>{const data=Buffer.from(bytes);return {getBytes:()=>Array.from(data),getDataAsString:()=>data.toString('utf8'),getName:()=>name,getContentType:()=>type};};
 h.ctx.Utilities.base64Decode=value=>Array.from(Buffer.from(value,'base64'));
 h.ctx.Utilities.base64Encode=bytes=>Buffer.from(bytes).toString('base64');
 h.ctx.Utilities.newBlob=blob;
 h.ctx.DriveApp={
  createFile(input){const id='private-'+(++nextId),file={id,name:input.getName(),bytes:input.getBytes(),type:input.getContentType(),trashed:false,
    getId(){return id;},getName(){return this.name;},getBlob(){return blob(this.bytes,this.type,this.name);},isTrashed(){return this.trashed;},
    setTrashed(value){this.trashed=value;return this;},setSharing(){throw new Error('Schedule files must never be shared publicly');}};files.set(id,file);return file;},
  getFileById(id){if(!files.has(id))throw new Error('File not found');return files.get(id);},
  getFilesByName(name){const matches=Array.from(files.values()).filter(f=>f.name===name);let index=0;return {hasNext:()=>index<matches.length,next:()=>matches[index++]};}
 };
 h.operator=h.login('Arya');api(h,h.operator,'list');h.files=files;return h;
}

test('manual onboarding schedules are private to their owner and both administrators',()=>{
 const h=setup(),maya=join(h,'Maya',{schedule:manual()}),riley=join(h,'Riley');
 assert.equal(maya.ok,true);assert.equal(riley.ok,true);
 const own=api(h,maya.token,'list');
 assert.equal(own.betaSchedules,true);assert.equal(own.schedules.length,1);assert.equal(own.schedules[0].ready,true);
 assert.deepEqual(own.schedules[0].blocks,manual().blocks);assert.equal(own.schedules[0].file,null);
 assert.equal(own.schedules[0].memberId,maya.member.id);
 const peer=api(h,riley.token,'list');assert.equal(peer.schedules.length,0);assert.equal(JSON.stringify(peer).includes('Class'),false);
 for(const name of ['Milo','Arya'])assert.equal(api(h,h.login(name),'list').schedules.length,1);
 assert.equal(api(h,h.login('Bijan'),'list').ok,false);
 assert.equal(h.ctx.doGet().betaSchedules,true);assert.equal(h.files.size,0);
});

test('manual schedule validation rejects malformed blocks and requires explicit no commitments',()=>{
 const invalid=[null,{},manual({blocks:[]}),manual({timezone:'Not/A_Timezone'}),manual({timezone:'../bad'}),manual({blocks:[{day:7,start:'09:00',end:'10:00'}]}),manual({blocks:[{day:'1',start:'09:00',end:'10:00'}]}),manual({blocks:[{day:1,start:'09:00',end:'09:00'}]}),manual({blocks:[{day:1,start:'23:00',end:'24:00'}]}),manual({blocks:[{day:1,start:'9:00',end:'10:00'}]}),manual({blocks:[{day:1,start:'09:00',end:'10:00',label:'x'.repeat(101)}]}),manual({blocks:Array.from({length:81},()=>manual().blocks[0])}),manual({noCommitments:true}),manual({file:pdf()})];
 for(const schedule of invalid){const h=setup(),out=join(h,'Maya',{schedule});assert.equal(out.ok,false,JSON.stringify(schedule));assert.equal(out.joinSaved,false);assert.equal(api(h,h.operator,'list').members.length,0);}
 const h=setup(),out=join(h,'Maya',{schedule:manual({blocks:[],noCommitments:true})});
 assert.equal(out.ok,true);assert.equal(api(h,out.token,'list').schedules[0].noCommitments,true);
 const blocks=[{day:5,start:'13:00',end:'14:00',label:'Research'},{day:1,start:'09:00',end:'10:00',label:'Class'}];
 assert.equal(api(h,out.token,'schedulesave',{schedule:manual({blocks:blocks.concat(blocks[0])})}).schedules[0].blocks.length,2);
});

test('PDF, PNG, JPEG and ICS files remain private and only authenticated owners or admins retrieve their bytes',()=>{
 const fixtures=[pdf(),{name:'classes.png',type:'image/png',data:Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')},{name:'classes.jpg',type:'image/jpeg',data:Buffer.from([255,216,255,224,0]).toString('base64')},{name:'classes.ics',type:'text/plain',data:Buffer.from('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n').toString('base64')}];
 for(const fixture of fixtures){
  const h=setup(),maya=join(h,'Maya',{schedule:uploaded(fixture)}),riley=join(h,'Riley');assert.equal(maya.ok,true,fixture.name);
  const own=api(h,maya.token,'list'),stored=own.schedules[0];
  assert.equal(stored.file.name,fixture.name);assert.equal(stored.ready,true);assert.equal(stored.file.data,undefined);assert.equal(stored.file.id,undefined);
  for(const token of [maya.token,h.login('Milo'),h.login('Arya')]){
   const got=api(h,token,'schedulefile',{id:maya.member.id});assert.equal(got.ok,true);assert.equal(got.file.data,fixture.data);assert.equal(got.file.size,Buffer.from(fixture.data,'base64').length);
  }
  for(const token of ['',h.login('Bijan'),riley.token])assert.equal(api(h,token,'schedulefile',{id:maya.member.id}).ok,false);
  assert.equal(api(h,riley.token,'list').schedules.length,0);
  assert.equal(Array.from(h.files.values())[0].name.startsWith('internal-beta-schedule-'),true);
  assert.equal(JSON.stringify(own).includes('private-1'),false);assert.equal(JSON.stringify(own).includes(fixture.data),false);
  assert.equal(h.files.size,1);assert.equal(Array.from(h.files.values())[0].trashed,false);
 }
});

test('file validation enforces formats, magic bytes and the 2 MiB limit before signup',()=>{
 const invalid=[pdf({name:'classes.exe'}),pdf({type:'image/png'}),pdf({data:Buffer.from('<script>bad</script>').toString('base64')}),pdf({data:'bad!'}),pdf({data:'A==='}),pdf({name:'../classes.pdf'}),pdf({name:'x'.repeat(181)+'.pdf'}),pdf({data:Buffer.from('%PDF-'+ 'x'.repeat(2*1024*1024)).toString('base64')}),{name:'classes.ics',type:'text/calendar',data:Buffer.from('BEGIN:VEVENT\nEND:VEVENT').toString('base64')}];
 const h=setup();for(const file of invalid){const out=join(h,'Maya',{schedule:uploaded(file)});assert.equal(out.ok,false,file.name);assert.equal(out.joinSaved,false);}
 assert.equal(h.files.size,0);assert.equal(api(h,h.operator,'list').members.length,0);
 const bytes=Buffer.alloc(2*1024*1024);bytes.write('%PDF-');
 const maximum=join(h,'Maya',{schedule:uploaded(pdf({data:bytes.toString('base64')}))});assert.equal(maximum.ok,true);
 assert.equal(api(h,maximum.token,'list').schedules[0].file.size,2*1024*1024);
});

test('schedule save ignores spoofed identity and keepFile uses only the current owned attachment',()=>{
 const h=setup(),maya=join(h,'Maya',{schedule:uploaded()}),riley=join(h,'Riley',{schedule:manual()});
 const before=h.ctx.betaRead('internal_beta_members',h.ctx.BETA_MEMBERS).find(m=>m.id===maya.member.id);
 const saved=api(h,maya.token,'schedulesave',{id:riley.member.id,memberId:riley.member.id,name:'Arya',schedule:{mode:'file',timezone:'America/Los_Angeles',blocks:[],keepFile:true,file:{id:'arbitrary',name:'ignore',data:'invalid'}}});
 assert.equal(saved.ok,true);assert.equal(saved.schedules[0].timezone,'America/Los_Angeles');assert.equal(saved.schedules[0].file.name,'classes.pdf');assert.equal(h.files.size,1);
 assert.deepEqual(api(h,riley.token,'list').schedules[0].blocks,manual().blocks);
 assert.equal(JSON.stringify(h.ctx.betaRead('internal_beta_members',h.ctx.BETA_MEMBERS).find(m=>m.id===maya.member.id)),JSON.stringify(before));
 assert.equal(api(h,riley.token,'schedulesave',{schedule:{mode:'file',timezone:'America/New_York',blocks:[],keepFile:true}}).ok,false);
 assert.equal(api(h,h.operator,'schedulesave',{id:maya.member.id,schedule:manual()}).ok,false);
 assert.equal(api(h,maya.token,'schedulefile',{id:riley.member.id,fileId:'arbitrary'}).ok,false);
});

test('exact signup retries reuse schedules and uploads, while schedule changes require a fresh signup attempt',()=>{
 const h=setup(),schedule=uploaded(),first=join(h,'Maya',{schedule}),retry=join(h,'Maya',{schedule});
 assert.equal(first.ok,true);assert.equal(retry.ok,true);assert.equal(retry.code,first.code);assert.equal(retry.member.id,first.member.id);assert.equal(h.files.size,1);
 assert.equal(join(h,'Maya',{schedule:manual()}).ok,false);assert.equal(join(h,'Maya').ok,false);
 const changed=api(h,first.token,'schedulesave',{schedule:manual({blocks:[],noCommitments:true})});assert.equal(changed.ok,true);
 assert.equal(join(h,'Maya',{schedule}).ok,true);assert.equal(api(h,first.token,'list').schedules[0].mode,'manual','retry must never overwrite a later edit');
 assert.equal(h.files.size,1);assert.equal(Array.from(h.files.values())[0].trashed,true);
 const legacy=join(h,'Riley');assert.equal(legacy.ok,true);assert.equal(join(h,'Riley').code,legacy.code);
});

test('lost Drive create responses recover one staged upload without duplicating the profile or file',()=>{
 const h=setup(),create=h.ctx.DriveApp.createFile;let lost=true;
 h.ctx.DriveApp.createFile=blob=>{const saved=create(blob);if(lost){lost=false;throw new Error('Lost Drive confirmation');}return saved;};
 const first=join(h,'Maya',{schedule:uploaded()});assert.equal(first.ok,false);assert.equal(first.joinSaved,undefined);assert.equal(h.files.size,1);
 assert.equal(api(h,h.operator,'list').schedules[0].ready,false);
 const retry=join(h,'Maya',{schedule:uploaded()});assert.equal(retry.ok,true);assert.equal(retry.recovered,true);assert.equal(h.files.size,1);
 assert.equal(api(h,h.operator,'list').members.length,1);assert.equal(api(h,retry.token,'schedulefile',{id:retry.member.id}).ok,true);
});

test('lost schedule finalization or session responses are retryable without replacing saved uploads',()=>{
 for(const failure of ['schedule','cache']){
  const h=setup(),write=h.ctx.betaWrite,cache=h.ctx.CacheService.getScriptCache;let failed=false;
  if(failure==='schedule')h.ctx.betaWrite=(table,cols,row)=>{if(table==='internal_beta_schedules'&&row.ready===true&&!failed){failed=true;throw new Error('Lost finalization');}return write(table,cols,row);};
  else h.ctx.CacheService.getScriptCache=()=>({...cache(),put:(key,value)=>{if(key.startsWith('beta:')&&!failed){failed=true;throw new Error('Lost session');}return cache().put(key,value);}});
  const first=join(h,'Maya',{schedule:uploaded()});assert.equal(first.ok,false);assert.equal(first.joinSaved,undefined);assert.equal(h.files.size,1);
  const retry=join(h,'Maya',{schedule:uploaded()});assert.equal(retry.ok,true);assert.equal(h.files.size,1);assert.equal(api(h,retry.token,'list').schedules[0].ready,true);
 }
});

test('replacing an attachment trashes only its old owned file and manual replacement clears the attachment',()=>{
 const h=setup(),maya=join(h,'Maya',{schedule:uploaded()}),riley=join(h,'Riley',{schedule:uploaded()});
 const old=Array.from(h.files.values())[0],other=Array.from(h.files.values())[1];
 const replacement=pdf({name:'revised.pdf',data:Buffer.from('%PDF-1.7\nRevised').toString('base64')});
 const out=api(h,maya.token,'schedulesave',{schedule:uploaded(replacement)});assert.equal(out.ok,true);assert.equal(old.trashed,true);assert.equal(other.trashed,false);
 assert.equal(api(h,maya.token,'schedulefile',{id:maya.member.id}).file.data,replacement.data);
 assert.equal(api(h,maya.token,'schedulesave',{schedule:manual()}).ok,true);
 assert.equal(Array.from(h.files.values())[2].trashed,true);assert.equal(other.trashed,false);
 assert.equal(api(h,maya.token,'schedulefile',{id:maya.member.id}).ok,false);assert.equal(api(h,riley.token,'schedulefile',{id:riley.member.id}).ok,true);
});

test('deletion revokes access before trashing owned schedule uploads and interrupted deletion retries safely',()=>{
 const h=setup(),maya=join(h,'Maya',{schedule:uploaded()}),riley=join(h,'Riley',{schedule:uploaded()});
 const target=Array.from(h.files.values())[0],other=Array.from(h.files.values())[1],trash=target.setTrashed;
 target.setTrashed=()=>{assert.equal(api(h,maya.token,'list').ok,false);throw new Error('Temporary trash failure');};
 assert.equal(api(h,h.operator,'memberdelete',{id:maya.member.id}).ok,false);assert.equal(api(h,maya.token,'schedulefile',{id:maya.member.id}).ok,false);
 assert.equal(api(h,h.operator,'list').schedules.length,2);assert.equal(other.trashed,false);
 target.setTrashed=trash;
 assert.equal(api(h,h.operator,'memberdelete',{id:maya.member.id}).ok,true);assert.equal(target.trashed,true);assert.equal(other.trashed,false);
 assert.equal(api(h,h.operator,'list').schedules.length,1);assert.equal(api(h,h.operator,'memberdelete',{id:maya.member.id}).ok,true);
 assert.equal(join(h,'Maya',{schedule:uploaded()}).ok,false,'deletion tombstone still rejects original attempt');
});

test('deletion finds an upload staged before its Drive ID was saved',()=>{
 const h=setup(),create=h.ctx.DriveApp.createFile;
 h.ctx.DriveApp.createFile=blob=>{create(blob);throw new Error('Lost create response');};
 assert.equal(join(h,'Maya',{schedule:uploaded()}).ok,false);
 const member=api(h,h.operator,'list').members[0];
 assert.equal(api(h,h.operator,'memberdelete',{id:member.id}).ok,true);
 assert.equal(Array.from(h.files.values())[0].trashed,true);assert.equal(api(h,h.operator,'list').schedules.length,0);
});

test('the appended signup schedule hash preserves previous rows and retry capability',()=>{
 const h=setup(),maya=join(h),sheet=h.sheets.internal_beta_members,index=h.ctx.BETA_MEMBERS.indexOf('joinScheduleHash');
 sheet.rows.forEach((row,n)=>{sheet.rows[n]=row.slice(0,index);});const before=sheet.rows.map(row=>[...row]);
 assert.equal(join(h).code,maya.code);assert.equal(sheet.rows[0][index],'joinScheduleHash');
 assert.deepEqual(sheet.rows[0].slice(0,index),before[0]);assert.deepEqual(sheet.rows.slice(1),before.slice(1));
 assert.equal(api(h,maya.token,'list').member.joinScheduleHash,undefined);
});

test('keepFile edits recover a lost finalization only when the stored owned bytes still match',()=>{
 const h=setup(),maya=join(h,'Maya',{schedule:uploaded()}),write=h.ctx.betaWrite;
 const change={mode:'file',timezone:'America/Los_Angeles',blocks:[],keepFile:true};let fail=true;
 h.ctx.betaWrite=(table,columns,row)=>{if(table==='internal_beta_schedules' && row.ready===true && fail){fail=false;throw new Error('Lost finalization');}return write(table,columns,row);};
 assert.equal(api(h,maya.token,'schedulesave',{schedule:change}).ok,false);
 assert.equal(api(h,maya.token,'list').schedules[0].ready,false);
 assert.equal(api(h,maya.token,'schedulesave',{schedule:change}).ok,true);
 assert.equal(api(h,maya.token,'list').schedules[0].ready,true);assert.equal(h.files.size,1);
 const file=Array.from(h.files.values())[0];file.bytes=Array.from(Buffer.from('%PDF-altered'));
 assert.equal(api(h,maya.token,'schedulesave',{schedule:change}).ok,false);
});
