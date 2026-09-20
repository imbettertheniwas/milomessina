import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

import {TIERS, LADDER_TOTAL, normalizeCode, codeProblem, referralLink}
  from '../fomo/refer/tiers.js';

/* The referral ladder exists in three runtimes — the public page reads
   fomo/refer/tiers.js, the sheet reads REFER_TIERS in the Apps Script,
   and two more copies of the code normaliser live in the browser next
   to the forms. Every one of those copies carries a comment saying to
   change it with the others, and a comment is not a check. This file is
   the check.

   The amounts are the half that matters: a page quoting $25 over a
   sheet writing $5 is a number nobody notices until somebody is
   underpaid and says so. */

function appsScript() {
  const ctx = vm.createContext({
    ContentService:{MimeType:{JSON:'json'}, createTextOutput: body => ({setMimeType: () => JSON.parse(body)})}
  });
  vm.runInContext(fs.readFileSync(new URL('../fomo/setup/apps-script.gs', import.meta.url), 'utf8'), ctx);
  return ctx;
}

test('the sheet prices every rung at exactly what the page quotes', () => {
  const ctx = appsScript();
  assert.deepEqual(
    Object.keys(ctx.REFER_TIERS).sort(),
    TIERS.map(t => t.id).sort(),
    'the page and the sheet disagree about which rungs exist');

  TIERS.forEach(t => {
    assert.equal(ctx.REFER_TIERS[t.id].amount, t.amount,
      t.id + ' is worth a different amount on the sheet than the page says');
    assert.equal(ctx.REFER_TIERS[t.id].level, t.level, t.id + ' is at a different level');
  });
});

test('the console prices every rung the same way too', () => {
  /* referrals.js carries its own copy as the fallback for a deployment
     too old to send `tiers`. It is read as text rather than imported
     because the file wires itself to the DOM on load. */
  const source = fs.readFileSync(new URL('../invoice/referrals.js', import.meta.url), 'utf8');
  TIERS.forEach(t => {
    const row = new RegExp(t.id + ":\\s*\\{level:" + t.level + ",\\s*amount:" + t.amount + "\\b");
    assert.match(source, row, t.id + ' is priced differently in the console');
  });
});

test('every rung the sweep can reach is a rung the sheet can price', () => {
  const ctx = appsScript();
  Object.keys(ctx.REFER_DOORS).forEach(tab => {
    assert.ok(ctx.REFER_TIERS[ctx.REFER_DOORS[tab]],
      'the ' + tab + ' tab is swept into a tier nothing knows the price of');
  });
  /* The chapter rung deliberately has no door: a house crossing 80% is
     not a form somebody fills in, so it is opened by hand. */
  assert.ok(!Object.values(ctx.REFER_DOORS).includes('chapter'));
});

test('the three copies of the code normaliser agree', () => {
  const ctx = appsScript();
  const browser = fs.readFileSync(new URL('../fomo/assets/refer.js', import.meta.url), 'utf8');
  const box = vm.createContext({});
  /* From the cap it reads, so a copy that truncates at a different
     length fails here rather than quietly minting a different code. */
  vm.runInContext(browser.slice(browser.indexOf('var MAX')).split('\n  function read')[0], box);

  const cases = ['  @Jack.D_7 ', 'JACKD', 'jack d', '@@@sigma', '___x___', 'a'.repeat(40),
    'ünïcode', '../../etc', 'code?to=x', ''];
  cases.forEach(raw => {
    const mine = normalizeCode(raw);
    assert.equal(ctx.referCode(raw), mine, 'the sheet normalises ' + JSON.stringify(raw) + ' differently');
    assert.equal(box.normalize(raw), mine, 'the browser normalises ' + JSON.stringify(raw) + ' differently');
  });
});

test('a code cannot carry anything a URL or a formula would argue about', () => {
  /* The code goes into a path segment and into a spreadsheet cell. */
  ['jack/../admin', 'jack?to=x', 'jack#frag', '=SUM(A1)', 'jack d', '<script>']
    .forEach(raw => assert.match(normalizeCode(raw) || 'x', /^[a-z0-9][a-z0-9._-]*$/));
});

test('a username too short or too strange to make a link from is refused', () => {
  assert.equal(codeProblem(normalizeCode('')), 'Enter your fomo username.');
  assert.match(codeProblem(normalizeCode('ab')), /too short/);
  assert.equal(codeProblem(normalizeCode('jackd')), null);
  /* Leading punctuation is stripped rather than refused, so this is the
     case that survives normalising and still has to be caught. */
  assert.equal(codeProblem('_jack'), 'Start with a letter or a number.');
});

test('the link is the shape fomo.family already documents', () => {
  assert.equal(referralLink('https://milomessina.com', 'jackd'),
    'https://milomessina.com/r/jackd');
  assert.equal(referralLink('https://milomessina.com/', 'jackd', 'creator'),
    'https://milomessina.com/r/jackd?to=creator');
  /* The origin is the only thing that changes when this moves across. */
  assert.equal(referralLink('https://fomo.family', 'jackd'), 'https://fomo.family/r/jackd');
});

test('the ceiling quoted on the page is the rungs added up', () => {
  assert.equal(LADDER_TOTAL, TIERS.reduce((n, t) => n + t.amount, 0));
  assert.equal(LADDER_TOTAL, 380);
});

test('every door a referral link may name is a page in this repo', () => {
  /* /r/index.html takes ?to= straight off the URL. Anything not on its
     own list is ignored, which is what stops a referral link being
     turned into somebody else's redirect. */
  const redirect = fs.readFileSync(new URL('../r/index.html', import.meta.url), 'utf8');
  const doors = redirect.slice(redirect.indexOf('var DOORS'), redirect.indexOf('var params'));
  TIERS.forEach(t => assert.ok(doors.includes("'" + t.door + "'"),
    t.id + ' has no door on the redirector'));
  /* Every path it will send somebody to has to exist. */
  [...doors.matchAll(/'(\/[^']+)'/g)].forEach(m => {
    assert.ok(fs.existsSync(new URL('..' + m[1] + 'index.html', import.meta.url)),
      m[1] + ' is a door with no page behind it');
  });
  assert.ok(!/DOORS\[[^\]]*\]\s*\|\|\s*params/.test(redirect),
    'the redirector must never fall back to a value off the URL');
});

test('every page that takes a referred person has the attribution script on it', () => {
  /* A door that forgets refer.js loses attribution silently: the form
     still works, the row still lands, and the referrer is never paid. */
  const ctx = appsScript();
  Object.keys(ctx.REFER_DOORS).forEach(tab => {
    const page = fs.readFileSync(new URL('../fomo/' + tab + '/index.html', import.meta.url), 'utf8');
    assert.match(page, /assets\/refer\.js/, '/fomo/' + tab + '/ cannot attribute anybody');
    /* And it has to run before form.js, which builds its payload out of
       the fields that exist at the moment it reads them. */
    assert.ok(page.indexOf('assets/refer.js') < page.indexOf('assets/form.js'),
      '/fomo/' + tab + '/ loads refer.js after form.js');
  });
});
