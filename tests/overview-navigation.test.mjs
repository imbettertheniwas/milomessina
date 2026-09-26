import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../invoice/index.html',import.meta.url),'utf8');
function lift(name){
  const start=html.indexOf('function '+name+'(');
  assert.ok(start>=0,name);
  let depth=0;
  for(let i=html.indexOf('{',start);i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw Error(name);
}
function page(rows){
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,
      querySelectorAll:()=>[],dispatchEvent(){
        c.filters.who=node('t-who').value;c.filters.cat=node('t-cat').value;
        c.filters.status=node('t-status').value;c.filters.q=node('t-q').value;
      }});
    return nodes.get(id);
  };
  const c=vm.createContext({rows,CARD:'Arya',PAYERS:['Arya','Milo','Bijan'],filters:{who:'',cat:'',status:'',q:'',date:'',cats:[],excludeWho:''},
    period:'',$:node,Event:class{},render(){},setView(view){c.view=view;},
    today:()=> '2026-09-25',avatar:p=>'<span>'+p+'</span>',money:n=>'$'+Number(n).toFixed(2),
    daysBetween:()=>2,agoText:()=> '2 days',pers:p=>p,niceDate:d=>d,cat:id=>({label:id}),
    PERIODS:{'30':'the last 30 days'}});
  for(const name of ['esc','owedBy','reimbursementOut','paintSettle','clearFilters','openLedgerDetail','visible','activeFilters'])vm.runInContext(lift(name),c);
  return {c,node};
}
const rows=[
  {id:'m1',who:'Milo',what:'Lunch',amount:24,date:'2026-09-25',category:'lunch',status:'pending'},
  {id:'b1',who:'Bijan',what:'Coffee',amount:6,date:'2026-09-24',category:'coffee',status:'pending'},
  {id:'m2',who:'Milo',what:'Lunch',amount:18,date:'2026-09-23',category:'lunch',status:'reimbursed'},
  {id:'a1',who:'Arya',what:'Supplies',amount:732.88,date:'2026-09-22',category:'supplies',status:'reimbursed'},
  {id:'a2',who:'Arya',what:'Legacy card row',amount:100,date:'2026-09-20',category:'other',status:'pending'}
];
test('Arya owes out unpaid expenses fronted by other people, excluding his card and settled lines',()=>{
  const {c,node}=page(rows);
  assert.deepEqual(JSON.parse(JSON.stringify(c.reimbursementOut())),{owed:30,lines:2,people:2});
  c.paintSettle();
  const card=node('st-cards').innerHTML.match(/<div class="stcard stcard-out">([\s\S]*?)<\/div><\/div>/)[0];
  assert.match(card,/owes out/);assert.match(card,/\$30\.00/);assert.match(card,/2 people · 2 expenses/);
  assert.doesNotMatch(card,/square|fronted all up|data-settle/);
});
test('Arya shows all paid out only when no team reimbursements remain',()=>{
  const {c,node}=page(rows.map(r=>({...r,status:'reimbursed'})));
  c.paintSettle();assert.match(node('st-cards').innerHTML,/all paid out/);
  assert.equal(c.reimbursementOut().owed,0);
});
test('person, category and day drilldowns drop stale filters and select the intended rows',()=>{
  const {c,node}=page(rows);
  Object.assign(c.filters,{who:'Bijan',cat:'coffee',status:'reimbursed',date:'2020-01-01',q:'nothing',cats:['other'],excludeWho:'Milo'});
  c.period='30';
  c.openLedgerDetail({who:'Milo'});
  assert.deepEqual(Array.from(c.visible(),r=>r.id),['m1','m2']);
  assert.equal(c.period,'');assert.equal(c.view,'ledger');assert.equal(node('t-who').value,'Milo');
  c.openLedgerDetail({date:'2026-09-24'});
  assert.deepEqual(Array.from(c.visible(),r=>r.id),['b1']);
  c.openLedgerDetail({cat:'lunch',status:'pending'});
  assert.deepEqual(Array.from(c.visible(),r=>r.id),['m1']);
});
test('remaining categories and Arya outstanding list retain exact scope then reset cleanly',()=>{
  const {c}=page(rows);
  c.openLedgerDetail({cats:['coffee','supplies']});
  assert.deepEqual(Array.from(c.visible(),r=>r.id),['b1','a1']);
  assert.ok(c.activeFilters().includes('coffee, supplies'));
  c.openLedgerDetail({status:'pending',excludeWho:'Arya'});
  assert.deepEqual(Array.from(c.visible(),r=>r.id),['m1','b1']);
  assert.ok(c.activeFilters().includes('expenses to reimburse to the team'));
  c.openLedgerDetail({q:''});assert.equal(c.visible().length,5);
});
