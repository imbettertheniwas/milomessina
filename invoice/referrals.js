/* ══════════ the referral mainframe ══════════

   Who is sending people, who they sent, how far each of those people
   got, and what that has cost us.

   The console already had a view per door — Applicants, Portals, Visit
   requests — and every one of them answers "who came through here".
   None of them could answer "who sent them", because until /fomo/refer
   there was nothing to answer it with. This is that question and the
   money hanging off it.

   Two screens, and the order is deliberate. **The queue** is first and
   is what this view is opened for: the referrals somebody has to make a
   decision about, oldest first, because the oldest unanswered one is
   the one costing us a referrer's patience. **The people** is second:
   one row per code, what it has brought in and what it is owed.

   Nothing here pays anybody by itself. A row arrives at `pending`,
   which means only that a submission carrying a code landed on a form
   tab. Someone reads the submission and says the person actually
   finished — that is `completed`, and it is the judgement. Then someone
   says the money has left, which is `paid`, and that is a statement of
   fact about a transfer that has already happened somewhere else. The
   two are separate steps because they are two separate claims, and a
   console that collapsed them would be a console where clicking
   "completed" quietly moved money.

   Arya and Milo only, and the script behind the endpoint refuses the
   read from anybody else regardless of what the rail shows: these rows
   carry referrers' emails beside the amounts owed to them. */

const $ = id => document.getElementById(id);
const bridge = () => window.FOMO_SHEET || {};

/* Mirrors TIERS in fomo/refer/tiers.js and REFER_TIERS in the Apps
   Script — three copies of four numbers, which is three too many, so
   the sheet's own answer wins wherever it has one. This is the fallback
   for a deployment too old to send `tiers`, and the labels, which only
   this console has any use for. */
const TIERS = {
  clan:    {level:1, amount:5,   label:'Joined their clan',   door:'/fomo/onboard/'},
  creator: {level:2, amount:25,  label:'Approved as creator', door:'/fomo/submit/'},
  intern:  {level:3, amount:100, label:'Hired onto a team',   door:'/fomo/apply/'},
  chapter: {level:4, amount:250, label:'Chapter qualified',   door:'/fomo/onboard/'}
};

/* The stages, in the order a referral walks them. `pending` and
   `completed` are the two that want a decision; the other two are
   where a row goes to stop moving. */
const STAGES = {
  pending:   {label:'Pending',   pill:'',       verb:'arrived'},
  completed: {label:'Completed', pill:'blue',   verb:'finished'},
  paid:      {label:'Paid',      pill:'good',   verb:'paid'},
  rejected:  {label:'Rejected',  pill:'red',    verb:'turned down'}
};
const OPEN_STAGES = ['pending', 'completed'];

/* Which tab of the sheet a referral was swept off, as a path somebody
   can actually click. `by hand` is the chapter rung, which has no form
   behind it. */
const DOOR_PATH = {apply:'/fomo/apply/', submit:'/fomo/submit/', onboard:'/fomo/onboard/'};

/* ---------- helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function money(n){
  const v = Number(n || 0);
  return '$' + (Math.round(v) === v ? v.toLocaleString('en-US')
    : v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}));
}
function niceDate(stamp){
  const p = String(stamp || '').slice(0,10).split('-');
  if (p.length !== 3 || !Number(p[1])) return '—';
  const out = MONTHS[Number(p[1])-1] + ' ' + Number(p[2]);
  return Number(p[0]) === new Date().getFullYear() ? out : out + ' ' + p[0];
}
function ago(stamp){
  const t = Date.parse(String(stamp || '').slice(0,10) + 'T00:00:00');
  if (!t) return '';
  const d = Math.max(0, Math.round((Date.now() - t) / 86400000));
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
}
function plural(n, one, many){ return n + ' ' + (n === 1 ? one : many); }
function tierOf(id){
  const sent = (state.tiers || {})[id];
  const known = TIERS[id] || {level:0, amount:0, label:id || 'unknown', door:''};
  /* The sheet is the authority on the money, this file on the wording. */
  return sent ? Object.assign({}, known, {level:sent.level, amount:sent.amount}) : known;
}
function note(msg, bad){
  const el = $('rf-msg');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('err', !!bad);
}
function csv(name, head, lines){
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
  const body = head.join(',') + '\r\n' +
    lines.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob(['﻿' + body], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = name + '-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- state ----------

   Not written to localStorage, for the same reason the applicants and
   the portals are not: these are other people's email addresses next to
   what we owe them, and a faster second open is not worth leaving that
   in a browser after the tab is shut. */
const state = {
  referrers: null,
  referrals: null,
  tiers: null,
  tab: 'queue',      // 'queue' | 'people'
  from: 'queue',     // which of the two a referrer was opened from
  open: null,        // a referrer's code, or null
  stage: 'open',     // 'open' | one of STAGES | 'all'
  adding: false,
  busy: false,
  q: ''
};

/* ---------- the sheet ---------- */
async function callRefer(action, payload){
  const cfg = bridge();
  if (!cfg.identity || !cfg.identity()) throw new Error('Sign in first.');
  if (!cfg.endpoint) throw new Error('this console has no sheet endpoint set — see invoice/README.md');
  const body = Object.assign({_api:'refer', action, _key:cfg.key || '',
    _session:cfg.session ? cfg.session() : ''}, payload || {});
  const res = await fetch(cfg.endpoint, {method:'POST', body:JSON.stringify(body)});
  if (!res.ok) throw new Error('the sheet answered HTTP ' + res.status);
  let out = null;
  try { out = JSON.parse(await res.text()); } catch (e) {}
  if (!out) throw new Error('the endpoint answered, but not with the referrals. ' +
    'Its deployment access is probably not set to "Anyone"');
  /* A deployment made before this namespace existed reads `refer` as a
     form submission and says so. Name the fix rather than leaving the
     page blaming the passcode. */
  if (out.ok !== true) {
    if (/unknown form/i.test(out.error || '')) throw new Error('the Apps Script behind this endpoint is an ' +
      'older version — it does not know about referrals yet. Redeploy fomo/setup/apps-script.gs ' +
      '(Deploy → Manage deployments → New version)');
    throw new Error(out.error || 'the sheet turned it away');
  }
  return out;
}

async function load(force){
  const cfg = bridge();
  if (!cfg.identity || !cfg.identity()) return;
  if (state.busy || (state.referrals && !force)) return;
  state.busy = true;
  note(state.referrals ? 'Re-reading the sheet…' : 'Reading the referrals…');
  render();
  try {
    const out = await callRefer('list');
    state.referrers = out.referrers || [];
    state.referrals = out.referrals || [];
    state.tiers = out.tiers || null;
    note('Up to date with the sheet.');
  } catch (err) {
    state.referrers = state.referrers || [];
    state.referrals = state.referrals || [];
    note(err.message, true);
  }
  state.busy = false;
  render();
}

/* ---------- the money ----------

   Owed is what has been earned and not yet sent: `completed` and
   nothing else. `pending` is not owed — nobody has yet said the person
   finished — and a total that counted it would be a number promising
   money we have not agreed to. */
function sums(rows){
  const out = {n:rows.length, pending:0, completed:0, paid:0, rejected:0, owed:0, spent:0};
  rows.forEach(r => {
    const stage = String(r.stage || 'pending');
    const amount = Number(r.amount || 0);
    if (Object.hasOwn(out, stage)) out[stage]++;
    if (stage === 'completed') out.owed += amount;
    if (stage === 'paid') out.spent += amount;
  });
  return out;
}
function forCode(code){
  return (state.referrals || []).filter(r => String(r.code) === String(code));
}
function referrerOf(code){
  return (state.referrers || []).find(r => String(r.code) === String(code)) || null;
}

/* ---------- what is in view ---------- */
function matches(r, q){
  return [r.code, r.who, r.contact, r.tier, r.via, r.note]
    .some(v => String(v || '').toLowerCase().indexOf(q) > -1);
}
function queue(){
  const q = state.q.trim().toLowerCase();
  let rows = (state.referrals || []).slice();
  if (state.open) rows = rows.filter(r => String(r.code) === state.open);
  if (state.stage === 'open') rows = rows.filter(r => OPEN_STAGES.indexOf(String(r.stage)) > -1);
  else if (state.stage !== 'all') rows = rows.filter(r => String(r.stage) === state.stage);
  if (q) rows = rows.filter(r => matches(r, q));
  /* Oldest first while a decision is outstanding — the queue is a
     backlog, and a backlog sorted newest-first hides its own age.
     Everything else newest first, the way every other table here is. */
  const old = state.stage === 'open' || state.stage === 'pending' || state.stage === 'completed';
  rows.sort((a, b) => old
    ? String(a.created).localeCompare(String(b.created))
    : String(b.created).localeCompare(String(a.created)));
  return rows;
}
function people(){
  const q = state.q.trim().toLowerCase();
  let rows = (state.referrers || []).map(r => {
    const mine = forCode(r.code);
    return Object.assign({}, r, {stats: sums(mine)});
  });

  /* A code that has brought somebody in but was never claimed. The
     sweep records these rather than dropping them, because it is a real
     referral we cannot pay until we know whose it is — most often a
     person who claimed while the sheet was unreachable. It has to be on
     this list or it is invisible everywhere. */
  const claimed = new Set(rows.map(r => String(r.code)));
  const orphans = {};
  (state.referrals || []).forEach(r => {
    const code = String(r.code);
    if (claimed.has(code)) return;
    orphans[code] = orphans[code] || [];
    orphans[code].push(r);
  });
  Object.keys(orphans).forEach(code => {
    rows.push({code, claimed:'', 'full name':'', email:'', school:'',
      status:'unclaimed', note:'never claimed at /fomo/refer', stats: sums(orphans[code])});
  });

  if (q) rows = rows.filter(r =>
    [r.code, r['full name'], r.email, r.school].some(v => String(v || '').toLowerCase().indexOf(q) > -1));

  /* Owed first: the list is read to find out who to pay. */
  rows.sort((a, b) => (b.stats.owed - a.stats.owed) ||
    (b.stats.n - a.stats.n) || String(a.code).localeCompare(String(b.code)));
  return rows;
}

/* ---------- drawing ---------- */
function stagePill(stage){
  const s = STAGES[stage] || {label:stage || '—', pill:''};
  return '<span class="pill' + (s.pill ? ' ' + s.pill : '') + '"><i></i>' + esc(s.label) + '</span>';
}

function renderQueue(){
  const rows = queue();
  const open = (state.referrals || []).filter(r => OPEN_STAGES.indexOf(String(r.stage)) > -1).length;

  $('rf-showing').textContent = state.referrals === null ? ''
    : plural(rows.length, 'referral', 'referrals') +
      (state.stage === 'open' ? ' waiting on a decision' : '') +
      (state.open ? ' on ' + state.open : '');

  if (state.referrals === null) return '<div class="empty"><b>Reading the referrals…</b>The form tabs are swept for codes on every open.</div>';
  if (!rows.length) {
    if (state.q.trim()) return '<div class="empty"><b>Nothing matches that.</b>Searched across the code, the person, the contact and the rung.</div>';
    if (state.stage === 'open' && !open && (state.referrals || []).length)
      return '<div class="empty"><b>Nothing is waiting.</b>Every referral has been decided. Switch the filter to see the ones already paid or turned down.</div>';
    if (!(state.referrals || []).length)
      return '<div class="empty"><b>No referrals yet.</b>One arrives here the moment somebody submits a form carrying a code — nothing needs to be entered by hand.</div>';
    return '<div class="empty"><b>Nothing at that stage.</b>Try a different filter.</div>';
  }

  return '<div class="tbl-scroll"><table class="rf-tbl"><thead><tr>' +
    '<th>Referred</th><th>Code</th><th>Rung</th><th>Came in</th><th class="r">Worth</th>' +
    '<th>Stage</th><th class="r">Decide</th></tr></thead><tbody>' +
    rows.map(r => {
      const t = tierOf(r.tier), stage = String(r.stage || 'pending');
      const flagged = String(r.note || '');
      return '<tr>' +
        '<td><b>' + esc(r.who || '—') + '</b>' +
          (r.contact ? '<small>' + esc(r.contact) + '</small>' : '') +
          (flagged ? '<small class="warn">' + esc(flagged) + '</small>' : '') + '</td>' +
        '<td><button class="rf-code" type="button" data-code="' + esc(r.code) + '">' +
          esc(r.code) + '</button></td>' +
        '<td>' + esc(t.label) + '<small>level ' + esc(String(t.level)) + '</small></td>' +
        '<td>' + esc(niceDate(r.created)) + '<small>' +
          (DOOR_PATH[r.via] ? esc(r.via) + ' · ' + esc(ago(r.created)) : esc(r.via || 'by hand')) +
          '</small></td>' +
        '<td class="r num">' + esc(money(r.amount)) + '</td>' +
        '<td>' + stagePill(stage) +
          (r['moved by'] ? '<small>' + esc(r['moved by']) + '</small>' : '') + '</td>' +
        '<td class="r">' + actions(r.id, stage) + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
}

/* The buttons on a row are only the moves that row can actually make.
   `paid` has none: the money has gone, and a console that could walk a
   row back out of paid is a console that can pay twice. */
function actions(id, stage){
  const btn = (to, cls, text) => '<button class="mini ' + cls + '" type="button" ' +
    'data-move="' + esc(id) + '" data-to="' + to + '">' + text + '</button>';
  if (stage === 'pending') return btn('completed', '', 'They finished') + btn('rejected', 'danger', 'No');
  if (stage === 'completed') return btn('paid', '', 'Mark paid') + btn('pending', 'ghost', 'Undo');
  if (stage === 'rejected') return btn('pending', 'ghost', 'Reopen');
  return '<span class="hint">settled</span>';
}

function renderPeople(){
  const rows = people();
  $('rf-showing').textContent = state.referrers === null ? ''
    : plural(rows.length, 'referrer', 'referrers');

  if (state.referrers === null) return '<div class="empty"><b>Reading the referrers…</b></div>';
  if (!rows.length) return '<div class="empty"><b>Nobody has claimed a link yet.</b>' +
    'They claim one at /fomo/refer, and the code is their fomo username.</div>';

  return '<div class="tbl-scroll"><table class="rf-tbl"><thead><tr>' +
    '<th>Code</th><th>Who</th><th class="r">Sent</th><th class="r">Waiting</th>' +
    '<th class="r">Owed</th><th class="r">Paid</th><th></th></tr></thead><tbody>' +
    rows.map(r => {
      const s = r.stats, unclaimed = String(r.status) === 'unclaimed';
      const blocked = String(r.status) === 'blocked';
      return '<tr>' +
        '<td><button class="rf-code" type="button" data-code="' + esc(r.code) + '">' +
          esc(r.code) + '</button>' +
          (blocked ? ' <span class="pill red"><i></i>Blocked</span>' : '') +
          (unclaimed ? ' <span class="pill amber"><i></i>No claim</span>' : '') + '</td>' +
        '<td><b>' + esc(r['full name'] || (unclaimed ? '—' : '')) + '</b>' +
          (r.email ? '<small>' + esc(r.email) + '</small>' : '') +
          (r.school ? '<small>' + esc(r.school) + '</small>' : '') +
          (unclaimed ? '<small class="warn">never claimed at /fomo/refer</small>' : '') + '</td>' +
        '<td class="r num">' + s.n + '</td>' +
        '<td class="r num">' + (s.pending || '—') + '</td>' +
        '<td class="r num' + (s.owed ? ' owed' : '') + '">' + (s.owed ? esc(money(s.owed)) : '—') + '</td>' +
        '<td class="r num">' + (s.spent ? esc(money(s.spent)) : '—') + '</td>' +
        '<td class="r">' + (unclaimed ? '' :
          '<button class="mini ' + (blocked ? 'ghost' : 'danger') + '" type="button" ' +
          'data-block="' + esc(r.code) + '" data-to="' + (blocked ? 'active' : 'blocked') + '">' +
          (blocked ? 'Unblock' : 'Block') + '</button>') + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
}

/* One referrer, above whichever table is showing. Their link is on it
   because the commonest thing to do from here is send it back to them. */
function renderHead(){
  if (!state.open) return '';
  const r = referrerOf(state.open);
  const s = sums(forCode(state.open));
  const link = location.origin + '/r/' + encodeURIComponent(state.open);
  return '<div class="rf-head">' +
    '<div class="rf-head-t"><h2>' + esc(state.open) +
      (r && String(r.status) === 'blocked' ? ' <span class="pill red"><i></i>Blocked</span>' : '') +
      (r ? '' : ' <span class="pill amber"><i></i>Never claimed</span>') + '</h2>' +
      '<p>' + esc(r ? [r['full name'], r.email, r.school].filter(Boolean).join(' · ')
        : 'This code has brought people in but was never claimed at /fomo/refer. ' +
          'Nothing on it can be paid until we know whose it is.') + '</p></div>' +
    '<div class="rf-head-k">' +
      '<span><b>Link</b><a href="' + esc(link) + '" target="_blank" rel="noopener">/r/' + esc(state.open) + '</a></span>' +
      '<span><b>Sent</b>' + plural(s.n, 'person', 'people') + '</span>' +
      '<span><b>Owed</b>' + esc(money(s.owed)) + '</span>' +
      '<span><b>Paid</b>' + esc(money(s.spent)) + '</span>' +
      (r && r.claimed ? '<span><b>Claimed</b>' + esc(niceDate(r.claimed)) + '</span>' : '') +
    '</div>' +
  '</div>';
}

/* The chapter rung, opened by hand. It is the one rung with no form
   behind it — a house crossing 80% happens in the campus admin, so the
   sweep has nothing to find and somebody has to say so here. */
function renderAdd(){
  if (!state.adding) return '';
  const opts = Object.keys(TIERS).map(id =>
    '<option value="' + id + '"' + (id === 'chapter' ? ' selected' : '') + '>' +
    esc(tierOf(id).label) + ' — ' + esc(money(tierOf(id).amount)) + '</option>').join('');
  return '<div class="rf-add">' +
    '<h3>Open a referral by hand</h3>' +
    '<p>For a rung with no form behind it — a chapter crossing 80%, or a referral somebody ' +
      'made before the link existed. It lands at <b>pending</b> like any other, so it still ' +
      'takes two decisions before it is paid.</p>' +
    '<div class="rf-add-g">' +
      '<label><span>Referrer’s code</span><input id="rf-a-code" type="text" maxlength="24" ' +
        'placeholder="jackd" spellcheck="false" autocapitalize="none"></label>' +
      '<label><span>Rung</span><select id="rf-a-tier">' + opts + '</select></label>' +
      '<label><span>Who was referred</span><input id="rf-a-who" type="text" maxlength="120" ' +
        'placeholder="Sigma Chi — San Diego State"></label>' +
      '<label><span>Contact <em>optional</em></span><input id="rf-a-contact" type="text" maxlength="254"></label>' +
      '<label class="wide"><span>Why <em>optional</em></span><input id="rf-a-note" type="text" maxlength="500" ' +
        'placeholder="crossed 80% on 12 March"></label>' +
    '</div>' +
    '<div class="rf-add-b">' +
      '<button class="mini" id="rf-a-save" type="button">Open it</button>' +
      '<button class="mini ghost" id="rf-a-cancel" type="button">Cancel</button>' +
    '</div>' +
  '</div>';
}

function renderAgg(){
  const box = $('rf-agg');
  if (!box) return;
  if (state.referrals === null) { box.innerHTML = ''; return; }
  const all = sums(state.referrals);
  const codes = new Set((state.referrers || []).map(r => String(r.code)));
  (state.referrals || []).forEach(r => codes.add(String(r.code)));
  box.innerHTML =
    '<span class="agg">' + plural(codes.size, 'code', 'codes') + '<b>' +
      (state.referrers || []).length + '</b><span class="pl">claimed</span></span>' +
    '<span class="agg">Referrals<b>' + all.n + '</b></span>' +
    '<span class="agg">Waiting<b>' + (all.pending + all.completed) + '</b></span>' +
    '<span class="agg owed">Owed<b>' + money(all.owed) + '</b></span>' +
    '<span class="agg good">Paid out<b>' + money(all.spent) + '</b></span>';
}

function render(){
  const box = $('rf-body');
  if (!box) return;

  $('rf-back').hidden = !state.open;
  $('rf-tab-queue').classList.toggle('on', state.tab === 'queue');
  $('rf-tab-people').classList.toggle('on', state.tab === 'people');
  $('rf-stage').hidden = state.tab !== 'queue';
  /* Opening a referrer widens the filter to every stage, so the control
     has to say so — a box reading "waiting on a decision" over a table
     showing paid ones is the page lying about its own filter. */
  $('rf-stage').value = state.stage;
  $('rf-q').placeholder = state.tab === 'queue' ? 'Search the referrals' : 'Search the referrers';

  box.innerHTML = renderHead() + renderAdd() +
    (state.tab === 'queue' ? renderQueue() : renderPeople());
  renderAgg();
}

/* ---------- moving a row ---------- */
async function move(id, to){
  const row = (state.referrals || []).find(r => String(r.id) === String(id));
  const t = row ? tierOf(row.tier) : null;
  if (to === 'paid' && row && !confirm('Mark ' + money(row.amount) + ' to ' + row.code +
    ' as paid?\n\nThis says the money has already reached their fomo account. ' +
    'It cannot be undone here.')) return;

  note(to === 'paid' ? 'Recording the payout…' : 'Saving…');
  try {
    await callRefer('stage', {id, stage:to});
    await load(true);
    note(to === 'paid' && row ? money(row.amount) + ' recorded as paid to ' + row.code + '.'
      : to === 'completed' && t ? 'Marked finished — ' + money(t.amount) + ' is now owed.'
      : 'Saved.');
  } catch (err) {
    note(err.message, true);
  }
}

async function block(code, to){
  if (to === 'blocked' && !confirm('Block ' + code + '?\n\nTheir link keeps working, but every ' +
    'referral it brings in from now on is flagged, and nothing on it should be paid.')) return;
  note('Saving…');
  try {
    await callRefer('block', {code, blocked: to === 'blocked'});
    await load(true);
    note(to === 'blocked' ? code + ' is blocked.' : code + ' is active again.');
  } catch (err) {
    note(err.message, true);
  }
}

async function add(){
  const code = $('rf-a-code').value.trim().toLowerCase();
  const who = $('rf-a-who').value.trim();
  if (!code || !who) { note('A code and who was referred are both needed.', true); return; }
  note('Opening it…');
  try {
    await callRefer('open', {
      code, tier: $('rf-a-tier').value, who,
      contact: $('rf-a-contact').value.trim(),
      note: $('rf-a-note').value.trim()
    });
    state.adding = false;
    await load(true);
    note('Opened at pending against ' + code + '.');
  } catch (err) {
    note(err.message, true);
  }
}

/* ---------- the controls ----------

   Opening a referrer means "show me what they sent", so it lands on the
   queue filtered to them at every stage — not on the list of referrers
   with one name written above it, which is what it used to do and which
   answered a question nobody had asked. Going back returns to whichever
   of the two screens they opened it from. */
function goto(code){
  if (code) {
    if (!state.open) state.from = state.tab;
    state.tab = 'queue';
    state.stage = 'all';
  } else {
    state.tab = state.from || 'queue';
    state.stage = 'open';
  }
  state.open = code || null;
  state.q = '';
  $('rf-q').value = '';
  render();
}

$('rf-body').addEventListener('click', ev => {
  const code = ev.target.closest('[data-code]');
  if (code) { goto(code.getAttribute('data-code')); return; }
  const mv = ev.target.closest('[data-move]');
  if (mv) { move(mv.getAttribute('data-move'), mv.getAttribute('data-to')); return; }
  const bl = ev.target.closest('[data-block]');
  if (bl) { block(bl.getAttribute('data-block'), bl.getAttribute('data-to')); return; }
  if (ev.target.closest('#rf-a-save')) { add(); return; }
  if (ev.target.closest('#rf-a-cancel')) { state.adding = false; render(); }
});
$('rf-back').addEventListener('click', () => goto(null));
/* The referrers screen is the whole estate by definition, so pressing
   it is a way out of one referrer as well as a way to the other list. */
$('rf-tab-queue').addEventListener('click', () => { state.tab = 'queue'; render(); });
$('rf-tab-people').addEventListener('click', () => {
  state.open = null; state.tab = 'people'; render();
});
$('rf-stage').addEventListener('change', function(){ state.stage = this.value; render(); });
$('rf-q').addEventListener('input', function(){ state.q = this.value; render(); });
$('rf-new').addEventListener('click', () => { state.adding = !state.adding; render(); });
$('rf-refresh').addEventListener('click', () => load(true));
$('rf-csv').addEventListener('click', () => {
  if (state.tab === 'people') {
    const rows = people();
    if (!rows.length) { note('Nothing in view to export.', true); return; }
    csv('fomo-referrers', ['code','name','email','school','status','referrals','waiting','owed','paid'],
      rows.map(r => [r.code, r['full name'], r.email, r.school, r.status,
        r.stats.n, r.stats.pending, r.stats.owed, r.stats.spent]));
    return;
  }
  const rows = queue();
  if (!rows.length) { note('Nothing in view to export.', true); return; }
  csv('fomo-referrals', ['created','code','referred','contact','rung','level','came in','stage','amount','moved','moved by','note'],
    rows.map(r => [r.created, r.code, r.who, r.contact, r.tier, tierOf(r.tier).level,
      r.via, r.stage, r.amount, r.moved, r['moved by'], r.note]));
});

/* ---------- when it reads ----------

   Not until the view is opened, the way the portals and the campus
   tables are not: the ledger is what the console is opened for, and
   Apps Script answers one request at a time. */
function activated(){
  if (/^#\/referrals(\/|$)/.test(location.hash || '')) load(false);
}
window.addEventListener('hashchange', activated);
window.addEventListener('fomo:view-change', activated);
window.addEventListener('fomo:identity', () => {
  state.referrers = null; state.referrals = null; state.tiers = null;
  state.open = null; state.adding = false; state.tab = 'queue'; state.from = 'queue';
  state.stage = 'open';
  activated();
});
activated();
