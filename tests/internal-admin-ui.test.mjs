import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../invoice/' + file, import.meta.url), 'utf8');
const html = read('index.html');
function lift(source, name) {
  const at = source.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'Missing function ' + name);
  let depth = 0;
  for (let i = source.indexOf('{', at); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(at, i + 1);
  }
  throw Error('Unterminated function ' + name);
}
function page(identity = null) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {textContent:'', hidden:false, innerHTML:'', querySelectorAll:() => []});
    return nodes.get(id);
  };
  const storage = new Map();
  const context = vm.createContext({
    identity, OPERATORS:['Arya','Milo'], CARD:'Arya', sheetAdmin:null, mode:'sheet', sheetCard:true,
    rows:[], subs:[], days:[], PEOPLE:['Milo','Jesse','Arya'],
    document:{body:{dataset:{}}}, sessionStorage:{setItem:(key,value) => storage.set(key,value)},
    $:node, buildNav(){}, applyRoster(){}, resetSplit(){}, open_(){},
    whoBox:{children:[]}, bfWho:{}, view:'overview', personOf:'', initialBetaRoute:false,
    window:{dispatchEvent(){}}, Event:class {}, location:{replace(url){context.redirect = url;}},
    byId:(list,id) => list.find(row => row.id === id), saveAll:() => true, setLive(){}, hideBanner(){}, render(){},
    reviewedCharge:r => JSON.stringify([r.id,r.who,r.amount]),
  });
  for (const name of ['isAdmin','isOperator','own','canPay','cardLendable','onCard','settledStatus','loggerOf',
    'ownRow','canEdit','purchaseApprover','purchaseApproved','purchaseApprovalText','canApprove','permission',
    'requirePermission','esc','approvalHtml','signedIn','apiLocal']) vm.runInContext(lift(html,name),context);
  return {context,node,storage};
}
const confirmed = who => ({who,token:'verified-session',admin:true,operator:true,beta:false});

test('Milo and Arya receive all core admin actions only after server confirmation', () => {
  for (const who of ['Milo','Arya']) {
    const {context:c} = page(confirmed(who));
    assert.equal(c.isAdmin(),true); assert.equal(c.isOperator(),true);
    assert.equal(c.own('Jesse'),true);
    assert.equal(c.canEdit({who:'Jesse',status:'reimbursed'}),true);
    for (const action of ['profileupdate','daymark','dayclear','daydelete','dayimport','subadd','subpause','subdelete',
      'edit','delete','settle','update','purchaseapprove','purchaseunapprove']) {
      assert.equal(c.permission(action,{who:'Jesse',id:'someone-elses-record'}),'',who + ': ' + action);
    }
  }
  for (const identity of [null,{who:'Milo'},{who:'Arya'}, {...confirmed('Milo'),admin:false},
    {...confirmed('Arya'),admin:'true'}, {...confirmed('Milo'),beta:true}, confirmed('Jesse')]) {
    const {context:c} = page(identity);
    assert.equal(c.isAdmin(),false); assert.equal(c.isOperator(),false);
    assert.notEqual(c.permission('purchaseapprove',{}),'');
  }
});

test('revalidated sign-in replaces cached roles, enables module controls, and retains verified flags', () => {
  for (const who of ['Milo','Arya']) {
    const {context:c,node,storage} = page({who,token:'old',admin:false});
    c.signedIn({...confirmed(who),token:undefined},'revalidated-session');
    assert.equal(c.isAdmin(),true); assert.equal(c.isOperator(),true);
    assert.equal(c.document.body.dataset.role,'admin'); assert.equal(c.document.body.dataset.operator,'yes');
    assert.match(node('identity-switch').textContent,new RegExp(who + ' · Admin'));
    assert.equal(JSON.parse(storage.get('fomo.identity')).token,'revalidated-session');
    assert.equal(JSON.parse(storage.get('fomo.identity')).admin,true);
    c.signedIn({who,token:'older-server'});
    assert.equal(c.isAdmin(),false); assert.equal(c.isOperator(),false);
    assert.equal(c.document.body.dataset.role,'intern');
  }
  const {context:c,storage} = page();
  c.signedIn({...confirmed('Milo'),beta:true});
  assert.equal(c.redirect,'/internal/beta'); assert.equal(c.identity,null); assert.equal(storage.size,0);
  // Saved flags are never applied without asking the server to validate the saved token.
  assert.match(html,/signedIn\(await sessionCall\(\{action:"session",_session:saved.token\}\),saved.token\)/);
});

test('admin access does not make Milo the card payer or auto-settle his purchases', () => {
  const {context:c} = page(confirmed('Milo'));
  assert.equal(c.onCard({who:'Milo'}),false); assert.equal(c.settledStatus('Milo','pending'),'pending');
  assert.equal(c.onCard({who:'Arya'}),true); assert.equal(c.settledStatus('Arya','pending'),'reimbursed');
});

test('approvals show the real administrator and preserve legacy approval attribution', async () => {
  for (const who of ['Milo','Arya']) {
    const {context:c} = page(confirmed(who));
    const row = {id:'purchase',who:'Jesse',amount:20,status:'pending'}; c.rows.push(row);
    await c.apiLocal('purchaseapprove',{id:row.id,reviewed:c.reviewedCharge(row)});
    assert.equal(row.approvedBy,who); assert.equal(row.status,'pending');
    assert.match(c.approvalHtml(row),new RegExp('Approved by ' + who));
    c.identity = confirmed(who === 'Milo' ? 'Arya' : 'Milo');
    await c.apiLocal('purchaseapprove',{id:row.id,reviewed:c.reviewedCharge(row)});
    assert.equal(row.approvedBy,who,'a second administrator does not overwrite the original approver');
    await c.apiLocal('purchaseunapprove',{id:row.id});
    assert.equal(row.approvedBy,''); assert.equal(c.canApprove(row),true);
  }
  const {context:c} = page(confirmed('Milo'));
  assert.equal(c.purchaseApproved({approvedBy:'Arya',approvedAt:'2026-09-01'}),true);
  assert.equal(c.purchaseApproved({approvedBy:'Someone else'}),false);
});

test('posts, schedules, campus, and visits use the confirmed admin bridge for both administrators', async () => {
  for (const who of ['Milo','Arya','Jesse']) {
    const {context:c,node} = page(confirmed(who));
    const calls=[];
    c.window.FOMO_SHEET = {admin:c.isAdmin,identity:() => c.identity,people:c.PEOPLE,
      endpoint:'https://example.invalid',session:() => c.identity.token};
    c.fetch = async (url,options) => { calls.push({url,options}); return {ok:true,
      json:async() => ({ok:true}),text:async() => JSON.stringify({ok:true,posts:[],applicants:[]})}; };
    vm.runInContext(`const bridge=()=>window.FOMO_SHEET; const current=()=>bridge().identity();
      const PEOPLE=()=>bridge().people; const admin=()=>bridge().admin();
      const canManage=p=>!!current() && (admin() || p.who===current().who);
      const state={who:'Jesse',posts:[{id:'other-post',who:'Bijan'}]};
      const toneOf=()=>'', av=()=>'', filledIn=()=>true;
      ${lift(read('posts.js'),'drawWho')}
      ${lift(read('schedules.js'),'drawWhobar')}
      const postCall=async ${lift(read('posts.js'),'call')};
      const campusCall=async ${lift(read('campus.js'),'call')};
      ${read('visits.js').match(/^const mayEdit=.*$/m)[0]}
      const visitCall=async ${lift(read('visits.js'),'api')};
      globalThis.moduleApi={postCall,campusCall,visitCall};`,c);
    c.drawWho(); c.drawWhobar();
    const admin = who !== 'Jesse';
    assert.equal(node('po-who').innerHTML.includes('data-me="Arya"'),admin);
    assert.equal(node('sc-whobar').hidden,!admin);
    for (const [method,action,payload] of [
      ['postCall','delete',{id:'other-post'}],['campusCall','teamadd',{name:'test'}],['visitCall','update',{id:'test'}]
    ]) {
      if (admin) await c.moduleApi[method](action,payload);
      else await assert.rejects(c.moduleApi[method](action,payload));
    }
    assert.equal(calls.length,admin ? 3 : 0);
  }
});
