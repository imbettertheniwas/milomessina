import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../invoice/overview-details.js', import.meta.url), 'utf8');

function fixture() {
  return {
    people:['A','B'], ghPeople:['A','B'], since:'2026-06-21', today:'2026-09-25', weekStart:'2026-09-21',
    attendanceSource:'device',
    days:[{who:'A',day:'2026-09-21',marked:'2026-09-22T12:00:00Z'}, {who:'B',day:'2026-09-21'}, {who:'A',day:'2026-09-18'}],
    logins:{A:'alice', B:'bob'}, ghErrors:{}, ghData:{A:{from:'2026-06-21',through:'2026-09-25',days:{'2026-09-21':3},commitsByDay:{
      '2026-09-21':[
        {message:'Actual <change>',url:'https://github.com/a/b/commit/1',repo:'a/b',date:'2026-09-21T04:00:00+03:00'},
        {message:'Spoofed host',url:'https://github.com.evil.test/commit/1'},
        {message:'Unsafe scheme',url:'javascript:alert(1)'},
        {message:'Unexpected credentials',url:'https://user@github.com/a/b/commit/1'}
      ]
    }}},
    subs:[{id:'first',what:'Same description',amount:20,who:'A',active:'yes',day:3,next:'2026-10-03'},
      {id:'second',what:'Same description',amount:40,who:'B',active:'no',day:15,next:'2026-10-15',note:'Read <only>'}],
    rows:[{id:'charge',what:'Same description',who:'B',amount:40,date:'2026-09-15'}],
    quiet:[{who:'A',day:'2026-09-21',commits:3,spend:20,lines:1}], skipped:['B'],
    attention:'<div class="att-i"><a href="#/settle">View reimbursements</a></div>'
  };
}

function harness(data = fixture()) {
  const handlers = new Map(), triggers = [], classes = new Set();
  const on = (name, fn) => { if (!handlers.has(name)) handlers.set(name, []);handlers.get(name).push(fn); };
  const emit = (name, event = {}) => { for (const fn of handlers.get(name) || []) fn(event); };
  let active = null, dialog;
  const body = {innerHTML:'',scrollTop:0,contains:() => false,querySelectorAll:() => []};
  const title = {textContent:''};
  const closeButton = {focus(){active=this;}};
  const app = {appendChild(node){dialog=node;}};
  const document = {
    get activeElement(){return active;},
    documentElement:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},
    body:app,
    getElementById:id => id === 'app' ? app : dialog,
    querySelectorAll:() => triggers,
    addEventListener:(name, fn) => on('document:' + name, fn),
    createElement(tag) {
      assert.equal(tag,'dialog');
      return {
        open:false,setAttribute(){},innerHTML:'',
        querySelector(selector){return selector === '.ov-detail-body' ? body : selector === 'h2' ? title : closeButton;},
        addEventListener:(name, fn) => on('dialog:' + name, fn),
        showModal(){this.open=true;active=closeButton;},
        close(){this.open=false;emit('dialog:close');},
        contains:node => node.insideDialog === true,
        getBoundingClientRect:() => ({left:100,right:600,top:100,bottom:600})
      };
    }
  };
  const window = {FOMO_OVERVIEW:{snapshot:() => data},addEventListener:(name,fn) => on('window:' + name,fn)};
  const context = vm.createContext({document,window,URL,Date,
    fetch(){throw new Error('A read-only detail must not fetch.');},
    localStorage:{setItem(){throw new Error('A read-only detail must not write.');}}});
  vm.runInContext(source,context,{filename:'overview-details.js'});
  function open(kind, values = {}, insideDialog = false) {
    const node = {dataset:{ovDetail:kind,...values},isConnected:true,insideDialog,
      closest:selector => selector.includes('[data-ov-detail]') ? node : null,
      focus(){active=node;}};
    triggers.push(node);
    emit('document:click',{target:node,preventDefault(){},stopPropagation(){}});
    return node;
  }
  function navigate(attribute) {
    const node = {closest:selector => selector.includes('[' + attribute + ']') ? node : null};
    emit('dialog:click',{target:node});
  }
  return {data,open,navigate,emit,body,title,classes,get dialog(){return dialog;},get active(){return active;}};
}

test('attendance drilldowns select exact person/date or week and retain source provenance', () => {
  const h=harness();
  h.open('attendance',{detailWho:'A',detailPeriod:'week'});
  assert.match(h.body.innerHTML,/1 person-day/);
  assert.match(h.body.innerHTML,/Sep 21, 2026/);
  assert.doesNotMatch(h.body.innerHTML,/Sep 18, 2026/);
  assert.match(h.body.innerHTML,/kept in this browser only/);
  assert.match(h.body.innerHTML,/records days, not hours/);
  h.open('attendance',{detailDate:'2026-09-18'});
  assert.match(h.body.innerHTML,/1 person-day/);
  h.open('attendance',{detailWho:'B',detailDate:'2026-09-18'});
  assert.match(h.body.innerHTML,/No attendance days are recorded/);
});

test('commit drilldown uses selected UTC date and renders only safe available links', () => {
  const h=harness();h.open('commits',{detailWho:'A',detailDate:'2026-09-21'});
  assert.match(h.body.innerHTML,/3 public commits/);
  assert.match(h.body.innerHTML,/Showing 1 of 3/);
  assert.match(h.body.innerHTML,/01:00 UTC/);
  assert.match(h.body.innerHTML,/Actual &lt;change&gt;/);
  assert.doesNotMatch(h.body.innerHTML,/Spoofed host|Unsafe scheme|Unexpected credentials|github\.com\.evil|javascript:/);
  assert.match(h.body.innerHTML,/rel="noopener noreferrer"/);
});

test('missing, failed, truncated, and uncovered commit data never becomes a definite zero', () => {
  const h=harness();h.open('commits',{detailWho:'B'});
  assert.match(h.body.innerHTML,/not available yet/);
  h.data.ghErrors.B='Rate limited';h.emit('window:fomo:overview-updated');
  assert.match(h.body.innerHTML,/unavailable: Rate limited/);
  h.open('commits',{detailWho:'A',detailDate:'2025-01-01'});
  assert.match(h.body.innerHTML,/outside the loaded activity range/);
  h.data.ghData.A.truncated=true;
  h.open('commits',{detailWho:'A',detailDate:'2026-09-22'});
  assert.match(h.body.innerHTML,/No commits returned in this partial result/);
  assert.doesNotMatch(h.body.innerHTML,/No public commits returned for this selection/);
  h.open('commits',{detailWho:'A',detailDate:'2026-09-21'});
  assert.match(h.body.innerHTML,/3\+ public commits/);
});

test('recurring details select exact ids and never infer charges from matching names', () => {
  const h=harness();h.open('subscription',{detailId:'second'});
  assert.match(h.body.innerHTML,/\$40\.00 per month/);
  assert.match(h.body.innerHTML,/Paused/);
  assert.match(h.body.innerHTML,/Read &lt;only&gt;/);
  assert.doesNotMatch(h.body.innerHTML,/\$20\.00|Linked charges/);
  h.data.rows[0].sub_id='second';h.emit('window:fomo:overview-updated');
  assert.match(h.body.innerHTML,/Linked charges/);
  assert.match(h.body.innerHTML,/#\/charge\/charge/);
  h.data.subs=[];h.emit('window:fomo:overview-updated');
  assert.match(h.body.innerHTML,/no longer in the loaded records/);
});

test('open, refresh, and nested drilldowns are read-only and close restores the original opener', () => {
  const h=harness(), before=JSON.stringify(h.data);
  const opener=h.open('quiet');
  assert.equal(h.dialog.open,true);
  assert.match(h.body.innerHTML,/Not counted for B/);
  assert.match(h.body.innerHTML,/data-ledger-query=""/);
  h.open('commits',{detailWho:'A',detailDate:'2026-09-21'},true);
  h.body.scrollTop=30;h.emit('window:fomo:overview-updated');
  assert.equal(h.body.scrollTop,30);
  assert.equal(JSON.stringify(h.data),before);
  h.dialog.close();
  assert.equal(h.active,opener);
  assert.equal(h.classes.has('ov-detail-open'),false);
});

test('navigation closes the modal before parent ledger actions handle the click', () => {
  const h=harness();
  for (const attribute of ['data-ledger-who','data-ledger-cats','data-ledger-date','data-go2','data-review']) {
    h.open('attention');h.navigate(attribute);
    assert.equal(h.dialog.open,false,attribute);
    assert.equal(h.classes.has('ov-detail-open'),false);
  }
});
