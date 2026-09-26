import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../invoice/schedules.js', import.meta.url), 'utf8');
const people = ['Milo','Jesse','Luchi','Arya'];
const fixtures = [
  {id:'lecture', who:'Milo', kind:'class', label:'Design <studio>', days:[1], start:'09:00', end:'10:15', week:'every'},
  {id:'shift', who:'Jesse', kind:'work', label:'Library shift', days:[1,2], start:'10:00', end:'12:00', week:'every'},
  {id:'nothing', who:'Luchi', kind:'none', days:[], week:'every'},
  {id:'break', who:'Milo', kind:'break', label:'Reading week', days:[], from:'2026-09-28', to:'2026-10-02'}
];

function harness({admin = false, blocks = fixtures} = {}) {
  const nodes = new Map(), listeners = new Map(), requests = [], storageWrites = [];
  function node(id = '') {
    return {id, value:'', hidden:false, disabled:false, textContent:'', innerHTML:'', dataset:{}, style:{},
      classList:{toggle(){}, add(){}, remove(){}}, setAttribute(){}, getAttribute(){return null;},
      addEventListener(type, fn){listeners.set(id + ':' + type, fn);},
      querySelector(){return null;}, querySelectorAll(){return [];}, closest(){return null;},
      focus(){}, scrollIntoView(){}};
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id,node(id));return nodes.get(id); };
  const document = {getElementById:get, querySelectorAll(){return [];}, createElement:node};
  const window = {FOMO_SHEET:{people, tone:()=> '--s1', endpoint:'https://example.invalid/sheet',
    identity:()=>({who:'Milo'}), admin:()=>admin}, addEventListener(){}};
  const location = {hash:'#/ledger'};
  const context = vm.createContext({document, window, location, Date, AbortSignal,
    fetch:async (...args) => {requests.push(args);throw new Error('Unexpected request');},
    localStorage:{getItem(){return null;},setItem(...args){storageWrites.push(args);}}});
  vm.runInContext(source, context, {filename:'schedules.js'});
  const run = code => vm.runInContext(code, context);
  const out = code => JSON.parse(run('JSON.stringify(' + code + ')'));
  context.fixtures = blocks;
  run("state.blocks=fixtures;state.loaded=true;state.week='2026-09-28';state.boardDay=1;");
  location.hash='#/schedules';run('render()');
  const click = async attrs => {
    const button = {getAttribute:name => Object.hasOwn(attrs,name) ? String(attrs[name]) : null};
    await listeners.get('sc-board:click')({target:{closest:selector => selector === 'button' ? button : null}});
  };
  const change = async (id,value) => listeners.get('sc-weeks:change')({target:{id,value}});
  return {get,run,out,click,change,requests,storageWrites,listeners};
}

const slot = (day,start,end,extra={}) => ({'data-sc-day':day,'data-sc-start':start,'data-sc-end':end,...extra});

test('selected time separates fully free, overlapping busy blocks, and unsubmitted people', () => {
  const h=harness();
  const result=h.out('rangePeople(1, 600, 660)');
  assert.deepEqual(result.free,['Luchi']);
  assert.deepEqual(result.busy.map(row=>row.who),['Milo','Jesse']);
  assert.deepEqual(result.missing,['Arya']);
  assert.equal(result.busy[0].blocks[0].label,'Design <studio>');
  assert.deepEqual(h.out('rangePeople(1, 615, 630)').free,['Milo','Luchi'],'a block ending at the range start does not overlap');
  assert.equal(h.out('rangePeople(1, 600, 615)').busy.length,2,'quarter-hour endings still occupy the 10 AM half-hour');
});

test('suggested windows are buttons with duration and counts and open read-only details', async () => {
  const h=harness();
  assert.match(h.get('sc-best').innerHTML,/<button[^>]+data-sc-window="true"/);
  assert.match(h.get('sc-best').innerHTML,/3\/3 free/);
  assert.match(h.get('sc-best').innerHTML,/1 not submitted/);
  await h.click(slot(1,720,1260,{'data-sc-window':'true'}));
  assert.deepEqual(h.out('state.boardSelection'),{day:1,start:720,end:1260});
  assert.match(h.get('sc-heat').innerHTML,/Monday · 12 PM–9 PM/);
  assert.match(h.get('sc-heat').innerHTML,/Free throughout <b>3<\/b>/);
  assert.match(h.get('sc-heat').innerHTML,/Not submitted <b>1<\/b>/);
  assert.match(h.get('sc-heat').innerHTML,/Availability unknown/);
  assert.equal(h.out('state.tab'),'board');
  assert.equal(h.out('state.who'),'Milo');
  assert.equal(h.requests.length,0);
  assert.equal(h.storageWrites.length,0);
});

test('week overview slots expose accessible labels and precise busy titles without edit controls', async () => {
  const h=harness();await h.click({'data-sc-mode':'week'});
  assert.match(h.get('sc-heat').innerHTML,/aria-label="Monday 10 AM–10:30 AM · 1 free · 1 not submitted"/);
  await h.click(slot(1,600,630));
  assert.equal(h.out('state.boardMode'),'week');
  assert.match(h.get('sc-heat').innerHTML,/Busy during this time <b>2<\/b>/);
  assert.match(h.get('sc-heat').innerHTML,/Design &lt;studio&gt; · 9 AM–10:15 AM/);
  assert.match(h.get('sc-heat').innerHTML,/Library shift · 10 AM–12 PM/);
  assert.doesNotMatch(h.get('sc-heat').innerHTML,/data-drop|data-edit|sc-add/);
});

test('person exploration is separate from the editing identity and supports other days and missing schedules', async () => {
  const h=harness();await h.click({'data-sc-person':'Jesse'});
  assert.equal(h.out('state.boardPerson'),'Jesse');
  assert.equal(h.out('state.boardMode'),'person');
  assert.equal(h.out('state.who'),'Milo');
  assert.match(h.get('sc-heat').innerHTML,/Jesse · Monday/);
  assert.match(h.get('sc-heat').innerHTML,/Library shift/);
  await h.click({'data-sc-pick-day':2});
  assert.match(h.get('sc-heat').innerHTML,/Jesse · Tuesday/);
  assert.match(h.get('sc-heat').innerHTML,/10 AM–12 PM/);
  await h.change('sc-explore-person','Arya');
  assert.match(h.get('sc-heat').innerHTML,/Schedule not submitted/);
  assert.match(h.get('sc-heat').innerHTML,/Availability unknown/);
  assert.doesNotMatch(h.get('sc-heat').innerHTML,/sc-range-status free/);
  assert.equal(h.out('state.who'),'Milo');
  assert.equal(h.requests.length,0);
});

test('changing week updates rotating commitments and clears the prior selection', async () => {
  const h=harness();
  h.run("state.blocks[0].week=cycleFor('2026-09-28',2);drawBoard()");
  await h.click(slot(1,540,600));
  assert.equal(h.out('rangePeople(1,540,600)').busy.some(row=>row.who==='Milo'),true);
  await h.click({'data-sc-week-shift':1});
  assert.equal(h.out('state.week'),'2026-10-05');
  assert.equal(h.out('state.boardSelection'),null);
  assert.equal(h.out('rangePeople(1,540,600)').busy.some(row=>row.who==='Milo'),false);
  await h.change('sc-week-date','2026-10-01');
  assert.equal(h.out('state.week'),'2026-09-28','date selection aligns with its Monday');
  assert.equal(h.out('rangePeople(1,540,600)').busy.some(row=>row.who==='Milo'),true);
});

test('school-break caveats use the selected date while keeping the existing term-time availability calculation', async () => {
  const h=harness();await h.click(slot(1,540,600));
  assert.equal(h.get('sc-away').hidden,false);
  assert.match(h.get('sc-away').innerHTML,/Reading week/);
  assert.match(h.get('sc-heat').innerHTML,/Milo: Reading week/);
  assert.match(h.get('sc-heat').innerHTML,/term-time blocks; confirm availability during school breaks/);
  assert.equal(h.out('rangePeople(1,540,600)').busy[0].who,'Milo');
  await h.click({'data-sc-week-shift':1});await h.click(slot(1,540,600));
  assert.equal(h.get('sc-away').hidden,true);
  assert.doesNotMatch(h.get('sc-heat').innerHTML,/sc-break-caveat/);
});

test('threshold stays user-selected as the explorer changes and read clicks never mutate schedules for either role', async () => {
  for(const admin of [false,true]){
    const h=harness({admin});
    await h.listeners.get('sc-need:change')({target:{value:'2'}});
    const before=h.out('state.blocks');
    await h.click({'data-sc-mode':'week'});
    await h.click(slot(1,600,630));
    await h.click({'data-sc-person':'Jesse'});
    await h.click({'data-sc-pick-day':3});
    await h.change('sc-explore-person','Luchi');
    assert.equal(h.out('state.need'),2);
    assert.deepEqual(h.out('state.blocks'),before);
    assert.equal(h.requests.length,0);
    assert.equal(h.storageWrites.length,0);
  }
});
