/* The chip that greyed itself out and would not come back.

   Arya's name goes on somebody else's line only if the script behind the
   endpoint will take it, so the page has to be told. The probe tells it —
   but a browser that has read the ledger once before skips the probe and
   opens from its stored head start instead, and a head start written
   before the card was lendable has nothing to say about it. Read as a no,
   that silence was permanent: the page saved the same no on the way past,
   so every load after the first refused the one thing the ledger is
   opened for and blamed a script that was already current.

   Three ways out, all of them here: a snapshot that cannot answer is not
   a head start, a snapshot may raise the answer but never lower it, and
   the roster that comes back with every sign-in carries the answer too. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../invoice/index.html', import.meta.url), 'utf8');

/* The inline script is one file's worth of page, most of it reaching for a
   document. Pulled a function at a time, the pieces that decide this run
   on their own — the same way the purchase review's do. */
function lift(name){
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at > -1, 'no function ' + name + ' in invoice/index.html');
  let depth = 0, i = html.indexOf('{', at);
  for (let j = i; j < html.length; j++){
    if (html[j] === '{') depth++;
    else if (html[j] === '}' && --depth === 0) return html.slice(at, j + 1);
  }
  throw new Error('unterminated ' + name);
}

const CARD = 'Arya';
function page(over = {}){
  const ctx = vm.createContext({
    ENDPOINT:'https://script.google.com/exec', LS_SEEN:'fomo.seen',
    CARD, roster:null, mode:'sheet', sheetCard:false, sheetPayers:null,
    identity:{who:'Milo'}, stored:null, painted:0, rebuilt:0,
    PEOPLE:[], LEADS:[], PAYERS:[], SHARERS:[], GH_PEOPLE:[], KNOWN:[],
    ...over
  });
  vm.runInContext([
    'function lsGet(k){ return stored; }',
    'function rosterFill(list, next){ list.length = 0; next.forEach(function(n){ list.push(n); }); }',
    'function rebuildRosterUi(){ rebuilt++; }',
    'function applyRosterUi(){ painted++; }',
    'function isAdmin(){ return !!identity && identity.who === CARD; }',
    lift('seenSnapshot'), lift('applyRoster'), lift('cardLendable'),
    lift('own'), lift('canPay')
  ].join('\n'), ctx);
  return ctx;
}

const team = card => [
  {name:'Milo', role:'intern', ...(card ? {card:false} : {})},
  {name:'Arya', role:'lead', ...(card ? {card:true} : {})}
];

test('a stored head start with no answer about the card is not a head start', () => {
  const before = {url:'https://script.google.com/exec', full:true, rows:[], payers:['Milo','Arya']};
  assert.equal(page({stored:before}).seenSnapshot(), null);
  // One that does answer still opens the short way round, either way it answers.
  assert.equal(page({stored:{...before, card:true}}).seenSnapshot().card, true);
  assert.equal(page({stored:{...before, card:false}}).seenSnapshot().card, false);
});

test('a snapshot may raise the card answer, never lower one already given', () => {
  /* Signing in happens before the snapshot is read, so this is the live
     order of events, not a hypothetical one. */
  const lines = html.split('\n').filter(l => /sheetCard\s*=/.test(l) && /seen\./.test(l));
  assert.equal(lines.length, 1, 'the snapshot should set the card answer in one place');
  const c = page({sheetCard:true});
  vm.runInContext('var seen = {card:false};\n' + lines[0], c);
  assert.equal(c.sheetCard, true);
  const cold = page({sheetCard:false});
  vm.runInContext('var seen = {card:true};\n' + lines[0], cold);
  assert.equal(cold.sheetCard, true);
});

test('the roster a sign-in comes back with says whether the card is lendable', () => {
  const c = page();
  assert.equal(c.canPay(CARD), false);
  c.applyRoster(team(true));
  assert.equal(c.sheetCard, true);
  assert.equal(c.canPay(CARD), true);
  assert.ok(c.painted > 0, 'the chip has to be repainted where it became pickable');
});

test('a roster too old to carry the answer is not read as a refusal, or as permission', () => {
  const c = page();
  c.applyRoster(team(false));
  assert.equal(c.sheetCard, false);
  assert.equal(c.canPay(CARD), false);
  // It is still no evidence when the roster has not changed since last time.
  c.applyRoster(team(false));
  assert.equal(c.sheetCard, false);
  // And the answer arrives the moment a current deployment sends one.
  c.applyRoster(team(true));
  assert.equal(c.canPay(CARD), true);
});

test('an unchanged roster still repaints the chips it has just unlocked', () => {
  const c = page();
  c.applyRoster(team(true));
  const rebuilt = c.rebuilt, painted = c.painted;
  assert.equal(c.applyRoster(team(true)), false, 'an unchanged roster rebuilds nothing');
  assert.equal(c.rebuilt, rebuilt);
  assert.ok(painted > 0);
});

test('everyone is still free to log their own line, and the card is nobody else’s', () => {
  const c = page();
  assert.equal(c.canPay('Milo'), true);
  assert.equal(c.canPay('Bijan'), false);
  c.applyRoster(team(true));
  assert.equal(c.canPay('Bijan'), false);
  // On this browser's own ledger there is no deployment to disagree with.
  const local = page({mode:'device'});
  assert.equal(local.canPay(CARD), true);
});
