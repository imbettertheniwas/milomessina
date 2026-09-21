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

const SNAP = {url:'https://script.google.com/exec', full:true, rows:[], payers:['Milo','Arya']};

test('a stored head start is kept whatever it says about the card', () => {
  /* The card is one line of a snapshot that is otherwise all facts about
     the sheet. Throwing the whole thing away over it costs the load its
     head start and puts the browser through a probe whose other answers
     were never in doubt — so the snapshot stands and the one question is
     asked on its own. */
  assert.ok(page({stored:SNAP}).seenSnapshot(), 'a snapshot older than the field is still a head start');
  assert.equal(page({stored:{...SNAP, card:true}}).seenSnapshot().card, true);
  assert.equal(page({stored:{...SNAP, card:false}}).seenSnapshot().card, false);
  // Another deployment's snapshot is still no head start at all.
  assert.equal(page({stored:{...SNAP, url:'https://script.google.com/other'}}).seenSnapshot(), null);
  assert.equal(page({stored:{...SNAP, full:false}}).seenSnapshot(), null);
});

/* refreshCard is the ask. It reaches for fetch, repaints, and writes the
   answer down, so all three are watched here. */
function asking(answer, over = {}){
  const ctx = page({answer, asked:0, saved:0, ...over});
  vm.runInContext([
    'function saveSeen(){ saved++; }',
    'function fetch(){ asked++; return Promise.resolve(' +
      'answer === null ? {ok:false} : {ok:true, json:function(){ return Promise.resolve(answer); }}); }',
    lift('refreshCard')
  ].join('\n'), ctx);
  return ctx;
}
const settled = () => new Promise(r => setTimeout(r, 0));

test('a browser whose head start cannot vouch for the card asks, and comes back knowing', async () => {
  const c = asking({cardSpends:true});
  c.refreshCard();
  await settled();
  assert.equal(c.asked, 1, 'the deployment has to actually be asked');
  assert.equal(c.sheetCard, true);
  assert.equal(c.canPay(CARD), true);
  assert.ok(c.painted > 0, 'the chip is greyed on screen and has to be repainted');
  assert.equal(c.saved, 1, 'the answer is written down so the next load opens knowing');
});

test('a deployment that really will not lend the card is left saying so', async () => {
  const c = asking({cardSpends:false});
  c.refreshCard();
  await settled();
  assert.equal(c.asked, 1);
  assert.equal(c.sheetCard, false);
  assert.equal(c.canPay(CARD), false);
  assert.equal(c.saved, 0, 'nothing was learned, so nothing is written');
  // An endpoint that could not be reached is not a refusal either.
  const off = asking(null);
  off.refreshCard();
  await settled();
  assert.equal(off.sheetCard, false);
  assert.equal(off.saved, 0);
});

test('a page that already knows the card is lendable does not ask again', async () => {
  const c = asking({cardSpends:true}, {sheetCard:true});
  c.refreshCard();
  await settled();
  assert.equal(c.asked, 0);
  // Nor does the browser keeping its own ledger, which has no deployment to ask.
  const local = asking({cardSpends:true}, {mode:'device'});
  local.refreshCard();
  await settled();
  assert.equal(local.asked, 0);
});

test('the fast path is the one that asks — it is the one that skipped the probe', () => {
  const at = html.indexOf('goSheet(seen);');
  assert.ok(at > -1, 'the short way round should still open from the snapshot');
  assert.ok(html.slice(at, at + 400).includes('refreshCard()'),
    'the load that opened from a snapshot has to ask about the card');
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
