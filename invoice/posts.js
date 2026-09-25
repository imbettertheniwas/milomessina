/* ══════════ the week ══════════

   An internal feed. Each of them writes a short note saying what they
   actually worked on that week, with the links and the screenshots to show
   it, and Arya scrolls it instead of asking four people what they have been
   up to. One more tab of the same Google Sheet, behind the same Apps Script
   deployment as the ledger and the campus tables.

   It is its own namespace rather than a fourth table on the ledger's answer
   because the feed only grows and the ledger is read on every page open.
   Nothing is fetched until the view is actually opened. */

const $ = id => document.getElementById(id);
const bridge = () => window.FOMO_SHEET || {};
const PEOPLE = () => bridge().people || [];
const toneOf = n => (bridge().tone ? bridge().tone(n) : '--s7');

const MAX_BODY = 2000, MAX_PHOTOS = 4;

const state = {posts: [], loaded: false, busy: false, sending: false, who: '', shots: [], at: 0,
  edit: {id: '', saving: false, draft: null, caret: null}};

/* Apps Script answers in a second or two, every time, and the feed is the
   same notes it was a minute ago. So the last answer is kept and painted
   in the frame the view opens in, and the read that replaces it happens
   underneath — the page is never blank while the sheet is thinking.

   Only the notes. The campus tables are not cached the same way and say
   why over there. */
const CACHE = 'fomo.posts.cache';

function remember(){
  try {
    localStorage.setItem(CACHE, JSON.stringify({at: Date.now(), posts: state.posts}));
  } catch (e) {}   /* a full store is not worth a broken feed */
}

function recall(){
  try {
    const was = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (!was || !Array.isArray(was.posts)) return false;
    state.posts = was.posts;
    state.at = was.at || 0;
    return true;
  } catch (e) { return false; }
}

const current = () => bridge().identity ? bridge().identity() : null;
const admin = () => bridge().admin && bridge().admin();
const canManage = p => !!current() && (admin() || p.who === current().who);
/* The roster as one canonical spelling per name, so "@bijan" typed in a
   hurry still lands on Bijan's page. */
const rosterHit = word => {
  /* "...with @jesse." ends the sentence, not the name. */
  const want = String(word).replace(/[-_]+$/, '').toLowerCase();
  return PEOPLE().filter(p => p.toLowerCase() === want)[0] || '';
};
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- dates ---------- */

const iso = d => d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' +
  String(d.getDate()).padStart(2, '0');

/* Monday of the week a date falls in. The sheet recomputes this on the way
   in; the page needs it too, to know which week it is writing into. */
function weekOf(date){
  const d = date ? new Date(date + 'T12:00:00') : new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

function weekLabel(key){
  const here = weekOf();
  if (key === here) return 'This week';
  const last = new Date(here + 'T12:00:00');
  last.setDate(last.getDate() - 7);
  if (key === iso(last)) return 'Last week';
  const d = new Date(key + 'T12:00:00');
  if (isNaN(d.getTime())) return 'Undated';
  return 'Week of ' + d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}

function ago(stamp){
  const t = Date.parse(stamp || '');
  if (!t) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  if (mins < 60 * 24) return Math.round(mins / 60) + 'h ago';
  const days = Math.round(mins / (60 * 24));
  if (days < 7) return days + 'd ago';
  return new Date(t).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}

/* ---------- the sheet ---------- */

async function call(action, payload){
  const cfg = bridge();
  if (!current()) throw new Error('Sign in first.');
  if (action === 'add' && !admin() && payload.who !== current().who) throw new Error('You can only post as yourself.');
  if (action === 'edit' && !canManage(state.posts.find(p => p.id === payload.id) || {})) throw new Error('You can only edit your own posts.');
  if (action === 'delete' && !canManage(state.posts.find(p => p.id === payload.id) || {})) throw new Error('You can only delete your own posts.');
  if (!cfg.endpoint) throw new Error('this console has no sheet endpoint set — see invoice/README.md');
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    body: JSON.stringify(Object.assign({_api: 'posts', action, _key: cfg.key || '', _session: cfg.session ? cfg.session() : ''}, payload || {}))
  });
  if (!res.ok) throw new Error('the sheet answered HTTP ' + res.status);
  let out = null;
  try { out = JSON.parse(await res.text()); } catch (e) {}
  if (!out) throw new Error('the endpoint answered, but not with the feed. ' +
    'Its deployment access is probably not set to "Anyone"');
  if (out.ok !== true) {
    /* An endpoint carrying the feed but not this action is a deployment a
       version behind, and "unknown action" on its own says nothing useful
       to whoever is standing in front of it. */
    if (out.error === 'unknown action') throw new Error('the Apps Script behind this endpoint ' +
      'is an older version — it cannot ' + action + ' a note yet. Redeploy ' +
      'fomo/setup/apps-script.gs (Deploy → Manage deployments → New version)');
    throw new Error(out.error || 'the sheet turned it away');
  }
  if (!out.posts) throw new Error('the Apps Script behind this endpoint is an older version — ' +
    'it does not know about the week notes yet. Redeploy fomo/setup/apps-script.gs ' +
    '(Deploy → Manage deployments → New version)');
  return out;
}

function message(text, bad){
  const el = $('po-msg');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('err', !!bad);
}

function take(out){
  /* A read can land while somebody is halfway through fixing a note — the
     refresh button, or the feed being re-read after a post. The sentence
     they are in the middle of is theirs, so it is carried across the
     repaint rather than replaced by what the sheet still holds. */
  const open = document.querySelector('.po-edit-b');
  if (open && state.edit.id) {
    state.edit.draft = open.value;
    state.edit.caret = open.selectionStart;
  }

  /* Newest first, and a post with no timestamp still has to land somewhere
     rather than disappearing off the end of the sort. */
  state.posts = (out.posts || []).slice().sort((a, b) =>
    String(b.posted || '').localeCompare(String(a.posted || '')));
  state.loaded = true;
  state.at = Date.now();
  render();
  remember();
  focusPost();
}

async function load(force){
  if (!current() || state.busy || (state.loaded && !force)) return;
  state.busy = true;
  message(state.loaded ? 'Re-reading the feed…'
        : state.posts.length ? 'Last read a moment ago — checking for newer…'
        : 'Reading the week notes…');
  try {
    take(await call('list'));
    message(state.posts.length
      ? state.posts.length + (state.posts.length === 1 ? ' note' : ' notes') + ' on the sheet.'
      : 'Nothing posted yet — yours would be the first.');
  } catch (err) {
    message(err.message, true);
  } finally {
    state.busy = false;
  }
}

/* ---------- writing one ---------- */

function drawWho(){
  const box = $('po-who');
  if (!box) return;
  box.innerHTML = (admin() ? PEOPLE() : current() ? [current().who] : []).map(p =>
    '<button type="button" class="po-me' + (p === state.who ? ' on' : '') +
      '" data-me="' + esc(p) + '">' +
      '<span class="av" aria-hidden="true" style="background:var(' + toneOf(p) + ')">' +
        esc(p.charAt(0).toUpperCase()) + '</span>' + esc(p) + '</button>').join('');
}

function drawShots(){
  const box = $('po-shots');
  if (!box) return;
  box.hidden = !state.shots.length;
  box.innerHTML = state.shots.map((src, i) =>
    '<span class="po-shot"><img src="' + esc(src) + '" alt="">' +
      '<button type="button" class="po-drop" data-drop="' + i + '" aria-label="Remove this photo">×</button>' +
    '</span>').join('');
}

function drawWrite(){
  const body = $('po-body');
  if (!body) return;
  const left = MAX_BODY - body.value.length;
  const ready = !!state.who && (!!body.value.trim() || state.shots.length > 0);
  $('po-send').disabled = !ready || state.sending;
  $('po-send').textContent = state.sending ? 'Posting…' : 'Post';
  const tagged = tagsIn(body.value);
  $('po-count').textContent = !state.who
    ? 'Pick your name first'
    : (state.shots.length ? state.shots.length + (state.shots.length === 1 ? ' photo · ' : ' photos · ') : '') +
      (tagged.length ? 'tagging ' + tagged.join(', ') + (left < 200 ? ' · ' : '') : '') +
      (left < 200 ? left + ' characters left' : '');
  $('po-pick-l').classList.toggle('off', state.shots.length >= MAX_PHOTOS);
  $('po-week').textContent = 'posting into ' + weekLabel(weekOf()).toLowerCase();
}

async function pick(files){
  const shrink = bridge().shrink;
  if (!shrink) return;
  for (const file of Array.from(files || [])) {
    if (state.shots.length >= MAX_PHOTOS) {
      message('Four photos is the limit on one note.', true);
      break;
    }
    try {
      state.shots.push(await shrink(file));
    } catch (err) {
      message(err.message, true);
    }
  }
  drawShots();
  drawWrite();
}

/* Links are not a separate field. People paste them into what they are
   writing anyway, so the ones in the text are pulled out on the way to the
   sheet and shown as their own row under the note. */
function linksIn(text){
  return (String(text).match(/https?:\/\/[^\s<>"')]+/gi) || [])
    .map(s => s.replace(/[.,;:!?]+$/, ''));
}

/* Tagging is part of the sentence rather than a field of its own, for the
   same reason links are: somebody writing "shot the Palisades reel with
   @bijan" has already said it, and asking them to say it again in a picker
   is asking twice. The names in the text are matched against the roster on
   the way to the sheet — the sheet reads them out of the note itself too,
   so the two can never drift — and come back as links into the feed. */
const AT = /(^|[^A-Za-z0-9@_])@([A-Za-z][A-Za-z0-9_-]*)/g;

function tagsIn(text){
  const out = [];
  String(text).replace(AT, (m, lead, word) => {
    const who = rosterHit(word);
    if (who && !out.includes(who)) out.push(who);
    return m;
  });
  return out;
}

/* ---------- @ someone ---------- */

/* One menu at a time, wherever the caret is — the composer at the top or
   the box inside a note being edited. It hangs off whichever textarea is
   open, so there is nothing to keep in sync when the feed repaints. */
const at = {box: null, from: -1, hits: [], pick: 0, q: null};

function atMenu(box){
  let el = box.parentNode.querySelector('.po-at');
  if (!el) {
    el = document.createElement('div');
    el.className = 'po-at';
    el.hidden = true;
    /* mousedown, not click: the textarea blurs first otherwise and the
       menu is gone before the click lands. */
    el.addEventListener('mousedown', ev => {
      const b = ev.target.closest('button[data-at]');
      if (!b) return;
      ev.preventDefault();
      atTake(b.getAttribute('data-at'));
    });
    box.parentNode.insertBefore(el, box.nextSibling);
  }
  return el;
}

function atShut(){
  const box = at.box;
  at.box = null; at.from = -1; at.hits = []; at.pick = 0; at.q = null;
  if (!box || !box.parentNode) return;
  const el = box.parentNode.querySelector('.po-at');
  if (el) { el.hidden = true; el.innerHTML = ''; }
}

function atDraw(box){
  const el = atMenu(box);
  el.hidden = false;
  el.style.top = (box.offsetTop + box.offsetHeight + 4) + 'px';
  el.style.left = box.offsetLeft + 'px';
  el.innerHTML = at.hits.map((p, i) =>
    '<button type="button" class="po-at-i' + (i === at.pick ? ' on' : '') + '" data-at="' + esc(p) + '">' +
      '<span class="av" aria-hidden="true" style="background:var(' + toneOf(p) + ')">' +
        esc(p.charAt(0).toUpperCase()) + '</span>' + esc(p) + '</button>').join('');
}

/* Called on every keystroke in a box that can tag. It looks only at what is
   behind the caret, so typing in the middle of a note works the same as
   typing at the end. */
function atSync(box){
  const caret = box.selectionStart == null ? box.value.length : box.selectionStart;
  const hit = box.value.slice(0, caret).match(/(^|[^A-Za-z0-9@_])@([A-Za-z0-9_-]*)$/);
  if (!hit) { atShut(); return; }
  const q = hit[2].toLowerCase();
  const hits = PEOPLE().filter(p => p.toLowerCase().startsWith(q));
  if (!hits.length) { atShut(); return; }
  if (at.box !== box || at.q !== q) at.pick = 0;   /* a new word starts at the top */
  at.box = box;
  at.q = q;
  at.from = caret - hit[2].length - 1;
  at.hits = hits;
  at.pick = Math.min(at.pick, hits.length - 1);
  atDraw(box);
}

function atTake(name){
  const box = at.box;
  if (!box) return;
  const caret = box.selectionStart == null ? box.value.length : box.selectionStart;
  const before = box.value.slice(0, at.from), after = box.value.slice(caret);
  box.value = before + '@' + name + (after.startsWith(' ') ? '' : ' ') + after;
  const to = before.length + name.length + 2;
  atShut();
  box.focus();
  box.setSelectionRange(to, to);
  box.dispatchEvent(new Event('input'));
}

/* True when the key belonged to the menu, so the box's own keydown — the
   one where enter posts — knows to stand down. */
function atKey(ev){
  if (!at.box || !at.hits.length) return false;
  if (ev.key === 'Escape')    { atShut(); return true; }
  if (ev.key === 'ArrowDown') { at.pick = (at.pick + 1) % at.hits.length; atDraw(at.box); ev.preventDefault(); return true; }
  if (ev.key === 'ArrowUp')   { at.pick = (at.pick - 1 + at.hits.length) % at.hits.length; atDraw(at.box); ev.preventDefault(); return true; }
  if (ev.key === 'Enter' || ev.key === 'Tab') {
    if (ev.metaKey || ev.ctrlKey) return false;   /* ⌘ + enter still posts */
    atTake(at.hits[at.pick]);
    ev.preventDefault();
    return true;
  }
  return false;
}

/* Every box that can tag somebody behaves the same way. `after` is what the
   plain enter-less keys should do once the menu has had its say. */
function tagBox(box, extra){
  box.addEventListener('input', () => atSync(box));
  box.addEventListener('click', () => atSync(box));
  box.addEventListener('keydown', ev => {
    if (atKey(ev)) return;
    if (extra) extra(ev);
  });
  box.addEventListener('blur', () => setTimeout(() => { if (at.box === box) atShut(); }, 120));
}

async function send(){
  const body = $('po-body');
  if (state.sending || !state.who || (!body.value.trim() && !state.shots.length)) return;
  state.sending = true;
  drawWrite();
  message('Posting…');
  try {
    const out = await call('add', {
      who: state.who,
      body: body.value,
      week: weekOf(),
      links: linksIn(body.value),
      tags: tagsIn(body.value),
      /* The photo goes up the way a receipt does: base64 in, Drive link
         out. The sheet never holds the image itself. */
      photos: state.shots.map((src, i) => ({
        name: 'week-' + weekOf() + '-' + (i + 1) + '.jpg',
        type: 'image/jpeg',
        data: String(src).split(',')[1] || ''
      }))
    });
    body.value = '';
    state.shots = [];
    drawShots();
    take(out);
    message('Posted.');
    if (bridge().toast) bridge().toast('Your week is up.');
  } catch (err) {
    message(err.message, true);
  } finally {
    state.sending = false;
    drawWrite();
  }
}

/* ---------- fixing one ---------- */

/* The editor opens inside the note itself rather than pulling the words
   back up into the composer at the top: the note stays where it is in the
   week it belongs to, and there is no moment where the feed shows one
   version and the box above shows another.

   Only one is open at a time, and the feed does not repaint while it is —
   a repaint mid-sentence would take the caret with it — so the box holds
   the text until Save or Cancel. */
function startEdit(id){
  const post = state.posts.find(p => p.id === id);
  if (!post || !canManage(post) || state.edit.saving) return;
  state.edit = {id, saving: false, draft: null, caret: null};
  render();
}

function stopEdit(){
  if (state.edit.saving) return;
  atShut();
  state.edit = {id: '', saving: false, draft: null, caret: null};
  render();
}

async function saveEdit(){
  const box = document.querySelector('.po-edit-b');
  const post = state.posts.find(p => p.id === state.edit.id);
  if (!box || !post || state.edit.saving) return;

  const text = box.value;
  if (!text.trim() && !(post.photos || []).length && !linksIn(text).length) {
    message('A note cannot be emptied — delete it instead.', true);
    return;
  }

  state.edit.saving = true;
  const save = document.querySelector('[data-edit-save]');
  if (save) { save.disabled = true; save.textContent = 'Saving…'; }
  message('Saving…');
  try {
    const out = await call('edit', {id: post.id, body: text, links: linksIn(text), tags: tagsIn(text)});
    atShut();
    state.edit = {id: '', saving: false, draft: null, caret: null};
    take(out);
    message('Saved.');
    if (bridge().toast) bridge().toast('Note updated.');
  } catch (err) {
    state.edit.saving = false;
    message(err.message, true);
    if (save) { save.disabled = false; save.textContent = 'Save'; }
  }
}

async function remove(id){
  const post = state.posts.find(p => p.id === id);
  if (!post || !canManage(post) || state.busy) return;
  if (!confirm('Delete this note? It goes off the sheet for everyone.')) return;
  state.busy = true;
  message('Deleting…');
  try {
    take(await call('delete', {id}));
    message('Deleted.');
  } catch (err) {
    message(err.message, true);
  } finally {
    state.busy = false;
  }
}

/* ---------- the feed ---------- */

let filter = '';

/* The note as typed, with its links made clickable and nothing else
   interpreted. Everything is escaped first, so the only markup that can
   reach the page is the anchor built here. */
function bodyHtml(text){
  /* One pass over the escaped text, links first, so an @ inside a URL stays
     part of the URL rather than turning into somebody's name. A name the
     roster does not know is left as the words it was. */
  return esc(text)
    .replace(/(https?:\/\/[^\s<]+)|(^|[^A-Za-z0-9@_])@([A-Za-z][A-Za-z0-9_-]*)/g,
      (whole, url, lead, word) => {
        if (url) {
          const trail = (url.match(/[.,;:!?]+$/) || [''])[0];
          const href = url.slice(0, url.length - trail.length);
          return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' +
            href.replace(/^https?:\/\/(www\.)?/, '') + '</a>' + trail;
        }
        const who = rosterHit(word);
        if (!who) return whole;
        return lead + '<a class="po-tag" href="#/person/' + encodeURIComponent(who) + '">@' +
          esc(who) + '</a>';
      })
    .replace(/\n/g, '<br>');
}

function drawTabs(){
  const box = $('po-tabs');
  if (!box) return;
  const n = who => state.posts.filter(p => !who || p.who === who).length;
  box.innerHTML = ['', ...PEOPLE()].map(p =>
    '<button class="vtab' + (filter === p ? ' on' : '') + '" data-po="' + esc(p) + '">' +
      (p ? esc(p) : 'For the team') +
      '<span class="n">' + (n(p) || '') + '</span></button>').join('');
}

/* The rail's own count beside this view, kept by the page that owns the
   rail everywhere else. It counts this week rather than the whole feed:
   the useful question on a Friday is how many of them have written yet. */
function navCount(){
  const el = document.querySelector('#nav [data-ct="posts"]');
  if (!el) return;
  const here = weekOf();
  const n = state.posts.filter(p => p.week === here).length;
  el.textContent = n ? n + '/' + PEOPLE().length : '';
}

function render(){
  /* A note somebody else deleted takes its editor with it. */
  if (state.edit.id && !state.posts.some(p => p.id === state.edit.id))
    state.edit = {id: '', saving: false, draft: null, caret: null};

  drawTabs();
  drawWho();
  drawWrite();
  navCount();

  const box = $('po-feed'), empty = $('po-empty');
  if (!box) return;

  const list = state.posts.filter(p => !filter || p.who === filter);
  empty.hidden = list.length > 0;
  box.hidden = !list.length;
  if (!list.length) {
    empty.innerHTML = state.posts.length
      ? '<b>Nothing from ' + esc(filter) + ' yet.</b>Pick Everyone to see the rest of the feed.'
      : '<b>No notes yet.</b>Write the first one above — a couple of lines on what you shipped is plenty.';
    return;
  }

  /* Grouped by the week each note was written into, newest week first, so
     scrolling the feed reads as scrolling back through the weeks. */
  const weeks = [];
  const byWeek = {};
  list.forEach(p => {
    const k = p.week || 'undated';
    if (!byWeek[k]) { byWeek[k] = []; weeks.push(k); }
    byWeek[k].push(p);
  });
  weeks.sort((a, b) => b.localeCompare(a));

  box.innerHTML = weeks.map(k => {
    const group = byWeek[k];
    return '<div class="po-week">' +
      '<div class="po-week-h"><span class="lbl">' + esc(weekLabel(k)) + '</span><i></i>' +
        '<span class="hint">' + group.length + (group.length === 1 ? ' note' : ' notes') + '</span></div>' +
      group.map(card).join('') +
    '</div>';
  }).join('');

  /* The editor is written by the same innerHTML as everything else, so it is
     a new element every repaint and is wired — and given the caret, at the
     end of what is already there — here. */
  const open = box.querySelector('.po-edit-b');
  if (!open) return;
  tagBox(open, ev => {
    if (ev.key === 'Escape') { stopEdit(); return; }
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); saveEdit(); }
  });
  if (document.activeElement !== open) {
    const caret = state.edit.caret == null ? open.value.length
      : Math.min(state.edit.caret, open.value.length);
    open.focus();
    open.setSelectionRange(caret, caret);
  }
  state.edit.caret = null;
}

/* Drive hands back a viewer page — .../file/d/<id>/view — which is a web
   page and not an image, so it cannot go straight into an <img>. It will
   serve the bytes from its thumbnail endpoint though, for exactly the files
   saveReceipt shares with anyone holding the link, which is every photo
   posted here. So the id comes out of the link and the picture goes in. */
function driveId(url){
  const m = String(url).match(/\/file\/d\/([-\w]{10,})/) ||
            String(url).match(/[?&]id=([-\w]{10,})/);
  return m ? m[1] : '';
}

function imageSrc(url){
  if (/^data:image\//i.test(url)) return url;      /* the device's own copy */
  const id = driveId(url);
  if (id) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600';
  return url;                                       /* already a direct image */
}

function card(p){
  const shots = (p.photos || []).filter(Boolean);
  const editing = state.edit.id === p.id;
  return '<article class="po-card' + (editing ? ' po-editing' : '') + '" id="post-' + esc(p.id) + '">' +
    '<div class="po-head">' +
      '<span class="av" aria-hidden="true" style="background:var(' + toneOf(p.who) + ')">' +
        esc(String(p.who).charAt(0).toUpperCase()) + '</span>' +
      '<a class="po-author" href="#/person/' + encodeURIComponent(p.who) + '"><b>' + esc(p.who) + '</b></a><span class="po-handle">' + (['Milo','Arya'].includes(p.who) ? 'Admin' : 'Intern') + '</span><span class="po-dot">·</span>' +
      '<span class="po-when">' + esc(ago(p.posted)) + '</span>' +
      (p.edited ? '<span class="po-edited" title="Edited ' + esc(ago(p.edited)) + '">· edited</span>' : '') +
      (canManage(p) ? '<button type="button" class="po-pen" data-edit="' + esc(p.id) + '" aria-label="Edit this note">' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.6 3.7a1.7 1.7 0 0 1 2.4 2.4L7.6 14.5l-3.2.8.8-3.2z"/></svg>' +
      '</button>' : '') +
      (canManage(p) ? '<button type="button" class="po-x" data-kill="' + esc(p.id) + '" aria-label="Delete this note">' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5.5 5.5l9 9m0-9-9 9"/></svg>' +
      '</button>' : '') +
    '</div>' +
    (editing
      ? '<div class="po-edit">' +
          '<textarea class="po-edit-b" rows="3" maxlength="' + MAX_BODY + '" ' +
            'aria-label="Edit your note">' +
            esc(state.edit.draft != null ? state.edit.draft : (p.body || '')) + '</textarea>' +
          '<div class="po-edit-foot">' +
            '<span class="hint">@ a name to tag somebody. The week and the photos stay as they are.</span>' +
            '<span class="push"></span>' +
            '<button type="button" class="mini ghost" data-edit-cancel>Cancel</button>' +
            '<button type="button" class="btn btn-p" data-edit-save>Save</button>' +
          '</div>' +
        '</div>'
      : p.body ? '<div class="po-body">' + bodyHtml(p.body) + '</div>' : '') +
    (shots.length
      ? '<div class="po-shots-out' + (shots.length > 1 ? ' many' : '') + '">' + shots.map((u, i) =>
          '<a class="po-photo" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" ' +
            'data-full="' + esc(u) + '" data-n="' + (i + 1) + '">' +
            '<img src="' + esc(imageSrc(u)) + '" alt="Photo ' + (i + 1) + ' on ' + esc(p.who) +
              '\u2019s note">' +
          '</a>').join('') +
        '</div>'
      : '') +
    '<div class="po-actions"><a href="#/person/' + encodeURIComponent(p.who) + '">View profile ↗</a>' +
      '<button type="button" data-copy-post="' + esc(p.id) + '" aria-label="Copy link to this post">↗ Share update</button></div>' +
  '</article>';
}

/* ---------- wiring ---------- */

$('po-tabs').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-po]');
  if (!b) return;
  filter = b.getAttribute('data-po');
  render();
});

$('po-who').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-me]');
  if (!b) return;
  if (!admin() && (!current() || b.getAttribute('data-me') !== current().who)) return;
  state.who = b.getAttribute('data-me');
  drawWho();
  drawWrite();
});

$('po-body').addEventListener('input', drawWrite);
/* ⌘/ctrl + enter posts, the way every other box like this one does — but
   the @ menu, when it is open, gets enter first. */
tagBox($('po-body'), ev => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); send(); }
});
$('po-send').addEventListener('click', send);
$('po-refresh').addEventListener('click', () => load(true));

$('po-pick').addEventListener('change', ev => {
  pick(ev.target.files);
  ev.target.value = '';
});

$('po-shots').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-drop]');
  if (!b) return;
  state.shots.splice(Number(b.getAttribute('data-drop')), 1);
  drawShots();
  drawWrite();
});

$('po-feed').addEventListener('click', ev => {
  const kill = ev.target.closest('button[data-kill]');
  if (kill) { remove(kill.getAttribute('data-kill')); return; }
  const pen = ev.target.closest('button[data-edit]');
  if (pen) { startEdit(pen.getAttribute('data-edit')); return; }
  if (ev.target.closest('[data-edit-cancel]')) { stopEdit(); return; }
  if (ev.target.closest('[data-edit-save]')) saveEdit();
});

/* Sharing can be off — a domain that forbids link sharing, or a file
   somebody locked down in Drive afterwards — and then the thumbnail is a
   404 rather than a picture. The note is worth more than the picture, so
   the broken <img> becomes the link it was standing in for. `error` does
   not bubble, hence the capture. */
$('po-feed').addEventListener('error', ev => {
  const img = ev.target;
  if (!img || img.tagName !== 'IMG') return;
  const a = img.closest('.po-photo');
  if (!a) return;
  a.className = 'po-tile';
  a.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.8" y="4.4" ' +
    'width="14.4" height="11.2" rx="2"/><circle cx="7.2" cy="8.4" r="1.3"/>' +
    '<path d="m3.4 13.4 3.8-3.2 3.3 2.8 2.6-2 3.5 3"/></svg><span>photo ' +
    esc(a.getAttribute('data-n') || '') + '</span>';
}, true);

function activated(){
  if (location.hash.startsWith('#/posts')) { load(false); focusPost(); }
}
window.addEventListener('hashchange', activated);
window.addEventListener('fomo:view-change', activated);

/* The read used to wait for somebody to open the view, which meant every
   first visit paid for the whole round trip. It now starts as soon as the
   ledger has had its turn — Apps Script serves one request at a time, so
   going earlier than that would only put the ledger in a queue. By the
   time anybody clicks through, this is usually already in hand. */
window.addEventListener('fomo:ledger-ready', () => load(false));

/* The last answer goes up first, so the view opens on the notes rather
   than on a blank page waiting for the sheet. */
recall();
render();
activated();

function focusPost(){
  const id=decodeURIComponent(location.hash.split('/')[2] || '');
  const el=id && $('post-'+id);
  if(el){ el.scrollIntoView({block:'center'}); el.classList.add('po-highlight'); }
}
$('po-feed').addEventListener('click', async ev => {
  const b=ev.target.closest('[data-copy-post]'); if(!b) return;
  const url=new URL(location.href); url.hash='/posts/'+encodeURIComponent(b.dataset.copyPost);
  try { await navigator.clipboard.writeText(url.href); bridge().toast('Link copied.'); }
  catch(e){ message('Copy this link: '+url.href); }
});
window.addEventListener('fomo:identity', () => {
  state.who=current() ? current().who : '';
  render(); activated();
});
if (current()) {state.who=current().who;render();}
