/* ══════════ /fomo/refer ══════════

   The referrer's side of the programme: the ladder drawn from one list,
   and the form that turns a fomo username into a link.

   It is the only public form on the domain that has to answer with
   something rather than confirm something. Every other one can say
   "thanks, we have it" and be done; this one is pointless unless the
   code comes back, because the code is what the person came for. So it
   takes the `refer` namespace on the Apps Script rather than the plain
   form receiver, which only ever answers {ok:true}.

   A claim that cannot reach the sheet still hands them their link and
   says plainly that it is not registered yet. That is deliberate: the
   link is derived from their own username, so it is correct whether or
   not the sheet has heard of it, and a person who has already pasted it
   into a group chat must not find out later that we dropped it. The
   console shows an unregistered code the moment a referral arrives on
   it — see the orphan note in invoice/referrals.js. */

import {TIERS, LADDER_TOTAL, normalizeCode, codeProblem, referralLink} from './tiers.js';

/* The same web app the rest of the forms post to — ENDPOINT at the top
   of fomo/assets/form.js. Written out again rather than imported
   because that file is a classic script and this one is a module;
   change them together. */
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyeQIRm2DezB1fYi0B03pnbuorco5eQAAJtxioVClgB4xyMVWGlvVmAFQqFdwbI3UnZfA/exec';
/* Matches FORM_KEY in the same file. Blank unless SHARED_SECRET is set
   on the script, and a turnstile against drive-by junk rather than a
   password — it rides along in the page source. */
const FORM_KEY = '';

/* Where a claimed code is remembered, so coming back to this page does
   not mean filling the form in again. It holds a code and an email and
   nothing else worth protecting — the code is public by definition,
   since it travels in every link they send. */
const HELD = 'fomo.refer.mine';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '$' + Number(n || 0).toLocaleString('en-US');

/* ---------- the ladder ---------- */
function drawLadder(){
  const rows = $('ladder-rows');
  if (!rows) return;
  rows.innerHTML = TIERS.map(t =>
    '<div class="rung' + (t.level === TIERS.length ? ' top' : '') + '">' +
      '<span class="lvl">level ' + t.level + '</span>' +
      '<div>' +
        '<h4>' + esc(t.label) + '</h4>' +
        '<p>' + esc(t.blurb) + '</p>' +
        '<span class="when">' + esc(t.completes) + '</span>' +
      '</div>' +
      '<span class="amt">' + money(t.amount) + '</span>' +
    '</div>').join('');

  const foot = $('ladder-foot');
  if (foot) foot.textContent = 'The rungs stack. One person who joins their clan, gets approved as a ' +
    'creator and then gets hired pays out at each one as they reach it — ' + money(LADDER_TOTAL) +
    ' in total if they go the whole way. Nothing here is paid on a signup, and nothing is taken out ' +
    'of what the person you referred earns.';

  const hero = $('hero-total');
  if (hero) hero.textContent = money(LADDER_TOTAL);
}

/* ---------- the links ----------

   One short link, plus one per door, because "send this to a creator"
   and "send this to a whole house" are different messages and pasting
   the same URL into both loses the difference. */
function drawLinks(code){
  const origin = location.origin;
  $('my-link').textContent = referralLink(origin, code);

  /* Two tiers share the onboard door, so the list is by door rather than
     by tier — otherwise it offers the same URL twice under two names. */
  const doors = [];
  TIERS.forEach(t => {
    if (doors.some(d => d.door === t.door)) return;
    doors.push({door:t.door, to:t.id, name:t.label});
  });
  $('doors').innerHTML = doors.map((d, i) =>
    '<div class="door">' +
      '<span>' + esc(d.name) + '</span>' +
      '<code id="door-' + i + '">' + esc(referralLink(origin, code, d.to)) + '</code>' +
      '<button class="btn btn-g btn-sm" type="button" data-copy="door-' + i + '">copy</button>' +
    '</div>').join('');
}

function showClaimed(code){
  drawLinks(code);
  $('claim-form').hidden = true;
  $('claim-form').style.display = 'none';
  $('claimed').hidden = false;
}

/* ---------- copy ----------

   Clipboard access is refused often enough — an insecure origin, a
   browser that wants a gesture it did not see — that falling back to
   selecting the text is not a nicety. A button that silently does
   nothing is worse than no button. */
async function copy(el, btn){
  const text = el.textContent;
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (e) {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      ok = document.execCommand('copy');
    } catch (e2) { ok = false; }
  }
  const was = btn.textContent;
  btn.textContent = ok ? 'copied' : 'select it';
  setTimeout(() => { btn.textContent = was; }, 1600);
}
document.addEventListener('click', ev => {
  const btn = ev.target.closest('[data-copy]');
  if (!btn) return;
  const el = $(btn.getAttribute('data-copy'));
  if (el) copy(el, btn);
});

/* ---------- the form ---------- */
function banner(msg, kind){
  const el = $('banner');
  el.className = 'banner' + (kind ? ' ' + kind : '') + (msg ? ' on' : '');
  el.textContent = msg || '';
  if (msg) el.scrollIntoView({behavior:'smooth', block:'center'});
}
function fieldError(input, msg){
  input.setAttribute('aria-invalid', 'true');
  const err = input.closest('.f')?.querySelector('.err');
  if (err) { err.textContent = msg; err.classList.add('on'); }
}
function clearError(input){
  input.removeAttribute('aria-invalid');
  const err = input.closest('.f')?.querySelector('.err');
  if (err) err.classList.remove('on');
}

function wire(){
  const form = $('claim-form'), user = $('username'), preview = $('preview');

  /* The link is shown forming as they type, so the normalising — the @
     coming off, the capitals going down — happens in front of them
     rather than surprising them on the next screen. */
  user.addEventListener('input', () => {
    clearError(user);
    const code = normalizeCode(user.value);
    preview.textContent = code
      ? location.host + '/r/' + code
      : '…/r/your-username';
  });
  form.addEventListener('input', ev => {
    if (ev.target.hasAttribute('aria-invalid')) clearError(ev.target);
  });

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    banner('');

    const code = normalizeCode(user.value);
    const name = $('name').value.trim();
    const email = $('email').value.trim();
    const school = $('school').value.trim();

    let bad = null;
    const problem = codeProblem(code);
    if (problem) { fieldError(user, problem); bad = bad || user; }
    if (!name) { fieldError($('name'), 'Enter your name.'); bad = bad || $('name'); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldError($('email'), 'Enter an email we can reach you on.');
      bad = bad || $('email');
    }
    if (bad) {
      banner('Some answers still need fixing — the fields are marked below.', 'bad');
      bad.focus();
      return;
    }
    /* Honeypot: a field no human can see has been filled in. Show them
       the same screen everyone else gets and write nothing. */
    if ($('website').value) { showClaimed(code); return; }

    const btn = $('submit'), label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'claiming…';

    try {
      const res = await fetch(ENDPOINT, {
        method:'POST',
        body: JSON.stringify({
          _api:'refer', action:'claim',
          code, full_name:name, email, school,
          _page: location.pathname,
          _submitted: new Date().toISOString(),
          _key: FORM_KEY
        })
      });
      if (!res.ok) throw new Error('the sheet answered HTTP ' + res.status);
      let out = null;
      try { out = JSON.parse(await res.text()); } catch (e) {}
      if (!out) throw new Error('the endpoint answered, but not with a code. ' +
        'Its deployment access is probably not set to "Anyone"');
      if (out.ok !== true) throw new Error(out.error || 'the sheet turned it away');

      /* The sheet is the authority on the code, not this browser: a
         username somebody else already holds comes back as a different
         one, and the link has to be built from what it actually says. */
      const mine = normalizeCode(out.code) || code;
      try { localStorage.setItem(HELD, JSON.stringify({code:mine, email})); } catch (e) {}
      if (out.taken === true) {
        banner('That username was already claimed, so your code is ' + mine +
          '. The link below is the one that works.', 'warn');
      }
      showClaimed(mine);
    } catch (err) {
      /* The link is theirs either way — it is built from their own
         username — so hand it over and be precise about what did not
         happen, rather than losing them at the last step. */
      try { localStorage.setItem(HELD, JSON.stringify({code, email, unsent:true})); } catch (e) {}
      showClaimed(code);
      banner('Your link is below and it is yours. What did not work was registering it with us — ' +
        err.message + '. Send it to the campus team so we can add it by hand, and anything that ' +
        'comes through it in the meantime is still recorded against the code.', 'warn');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}

/* ---------- on open ---------- */
drawLadder();
wire();

/* Somebody who has claimed before gets their link back rather than the
   form. `?again` is the way out for a person claiming a second code. */
if (!/(^|[?&])again(=|&|$)/.test(location.search)) {
  try {
    const held = JSON.parse(localStorage.getItem(HELD) || 'null');
    const code = held && normalizeCode(held.code);
    if (code && !codeProblem(code)) {
      showClaimed(code);
      if (held.unsent) banner('This link was never registered with us — it was claimed while the ' +
        'form could not reach us. It still works, but tell the campus team about it.', 'warn');
    }
  } catch (e) {}
}

/* The reveal, same as the other campus pages. */
const seen = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}), {threshold:0, rootMargin:'0px 0px -80px 0px'});
document.querySelectorAll('.rv').forEach(el => seen.observe(el));

