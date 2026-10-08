import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../invoice/campus-tasks.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function ui(){
 const nodes=new Map(),events={},requests=[],confirmations=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',classList:{toggle(){}},addEventListener(event,handler){this[event]=handler;},querySelectorAll(){return[];},replaceChildren(){this.innerHTML='';}});return nodes.get(id);};
 const member=(id,name,schoolName)=>({id,name,schoolName});
 const initial={ok:true,members:[member('one','Alex','Duke'),member('two','Sam','NYU')],tasks:[],steps:[],audit:[]};
 const state={confirm:true,fail:false,session:'admin'};
 const context=vm.createContext({stepTitles:{},downloadTaskFile(){},document:{body:{dataset:{consoleView:'tasks'}},getElementById:node},window:{FOMO_SHEET:{operator:()=>true,session:()=>state.session,endpoint:'/test'},addEventListener:(name,handler)=>events[name]=handler,confirm:text=>{confirmations.push(text);return state.confirm;}},AbortSignal,fetch:async(url,options)=>{const body=JSON.parse(options.body);requests.push(body);return{json:async()=>body.action==='list'?structuredClone(initial):state.fail?{ok:false,error:'Service unavailable'}:{...initial,members:initial.members.filter(m=>m.id!==body.memberId)}};}});
 vm.runInContext(source,context);
 const click=()=>node('ct-detail').click({target:{closest:()=>({dataset:{ctDelete:'one'}})}});
 return{context,node,state,requests,confirmations,click};
}
test('delete confirmation cancellation sends no write; success refreshes member list, filters and totals',async()=>{
 const h=ui();await new Promise(setImmediate);h.node('ct-school').value='Duke';h.node('ct-school').change();assert.match(h.node('ct-detail').innerHTML,/Delete signup/);
 h.state.confirm=false;await h.click();assert.equal(h.requests.length,1);assert.match(h.confirmations[0],/Alex at Duke/);
 h.state.confirm=true;await h.click();assert.equal(h.requests[1].action,'deleteSignup');assert.equal(h.requests[1].memberId,'one');assert.equal(h.requests[1]._session,'admin');
 assert.doesNotMatch(h.node('ct-members').innerHTML,/Alex/);assert.match(h.node('ct-detail').innerHTML,/Sam/);assert.match(h.node('ct-summary').innerHTML,/<strong>1<\/strong>/);assert.doesNotMatch(h.node('ct-school').innerHTML,/Duke/);assert.equal(h.node('ct-message').textContent,'Signup deleted.');
});
test('failed deletion keeps the selected member and displays the error',async()=>{
 const h=ui();await new Promise(setImmediate);h.state.fail=true;await h.click();assert.match(h.node('ct-detail').innerHTML,/Alex/);assert.match(h.node('ct-members').innerHTML,/Alex/);assert.equal(h.node('ct-message').textContent,'Service unavailable');
});
