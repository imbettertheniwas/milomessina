/* The console's behaviour layer — the half of console.css that needs a
   hand on it. Everything here sits on top of what index.html already
   draws and listens for the events it already sends (`fomo:view-change`);
   nothing in it reads or writes a record, so turning this file off leaves
   the console exactly as it was. */

const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion:reduce)');
const store = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch {} }
};
const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
const svg = d => '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';

/* ---------- topbar furniture ---------- */
const topbar = document.querySelector('.topbar');
const title = $('pg-title');
const railBtn = document.createElement('button');
railBtn.className = 'icon-b'; railBtn.id = 'cx-rail'; railBtn.type = 'button';
railBtn.innerHTML = svg('<rect x="3" y="3.6" width="14" height="12.8" rx="2.4"/><path d="M8 3.6v12.8"/>');
const viewIco = document.createElement('span');
viewIco.className = 'cx-ico'; viewIco.setAttribute('aria-hidden', 'true');
title.before(railBtn, viewIco);

const keysBtn = document.createElement('button');
keysBtn.className = 'icon-b'; keysBtn.id = 'cx-keys'; keysBtn.type = 'button';
keysBtn.title = 'Keyboard shortcuts (?)'; keysBtn.setAttribute('aria-label', 'Keyboard shortcuts');
keysBtn.innerHTML = svg('<rect x="2.4" y="5" width="15.2" height="10" rx="2"/><path d="M5.6 8h.01M8.5 8h.01M11.5 8h.01M14.4 8h.01M6.5 12h7"/>');
$('pal-open').before(keysBtn);

/* ---------- the narrow rail ---------- */
function setMini(on){
  document.body.classList.toggle('cx-mini', on);
  railBtn.title = (on ? 'Expand' : 'Collapse') + ' the sidebar ([)';
  railBtn.setAttribute('aria-label', on ? 'Expand the sidebar' : 'Collapse the sidebar');
  railBtn.setAttribute('aria-pressed', String(on));
  store.set('fomo.rail', on ? 'mini' : '');
}
setMini(store.get('fomo.rail') === 'mini');
railBtn.addEventListener('click', () => setMini(!document.body.classList.contains('cx-mini')));

/* With the names gone the rail still says them, beside the icon. */
const tip = document.createElement('div');
tip.id = 'cx-tip'; tip.setAttribute('role', 'presentation');
document.body.append(tip);
const nav = $('nav');
function hideTip(){ tip.classList.remove('on'); }
nav.addEventListener('pointerover', ev => {
  const item = ev.target.closest('.nav-i');
  if (!item || !document.body.classList.contains('cx-mini') || matchMedia('(max-width:860px)').matches) return hideTip();
  const tx = item.querySelector('.tx'), ct = item.querySelector('.ct');
  tip.textContent = (tx ? tx.textContent : '') + (ct && ct.textContent ? '  ·  ' + ct.textContent : '');
  const r = item.getBoundingClientRect();
  tip.style.left = (r.right + 10) + 'px';
  tip.style.top = (r.top + r.height / 2 - 13) + 'px';
  tip.classList.add('on');
});
nav.addEventListener('pointerleave', hideTip);
nav.addEventListener('scroll', hideTip, {passive:true});
nav.addEventListener('click', hideTip);

/* ---------- numbers that count to where they are ---------- */
const NUM = '.rail .v,.stcard .big,.ppgrid .v,.gh-big .v,.spend-summary strong,.spend-purchases-heading>strong';
const RE = /^(\D{0,2}?)(-?)(\d[\d,]*)(\.\d+)?(\D{0,3})$/;
const written = new WeakMap();
const running = new WeakMap();
function parse(text){
  const m = RE.exec(String(text).trim());
  if (!m) return null;
  return {pre:m[1], neg:m[2], val:Number((m[3] + (m[4] || '')).replace(/,/g, '')) * (m[2] ? -1 : 1),
    dec:m[4] ? m[4].length - 1 : 0, comma:m[3].includes(',') || (Number(m[3].replace(/,/g, '')) >= 1000 && m[1] === '$'), post:m[5]};
}
function fmt(n, p){
  const s = Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:p.dec, maximumFractionDigits:p.dec, useGrouping:p.comma});
  return p.pre + (n < 0 ? '-' : '') + s + p.post;
}
function countTo(el, from){
  const final = el.textContent, p = parse(final);
  if (!p || reduce.matches || p.val === from) return;
  cancelAnimationFrame(running.get(el));
  const t0 = performance.now(), dur = Math.min(900, 380 + Math.log10(Math.abs(p.val - from) + 1) * 120);
  const step = now => {
    /* Somebody else wrote here since — a fresh read, an edit. Theirs wins. */
    if (written.has(el) && el.textContent !== written.get(el)) { written.delete(el); return; }
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    const out = k < 1 ? fmt(from + (p.val - from) * e, p) : final;
    written.set(el, out);
    /* Into the text node rather than over it: the page watches #app for
       added and removed nodes, and a count is neither. */
    if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) el.firstChild.data = out;
    else el.textContent = out;
    if (k < 1) running.set(el, requestAnimationFrame(step));
  };
  running.set(el, requestAnimationFrame(step));
}
function countView(root){
  root.querySelectorAll(NUM).forEach(el => { const p = parse(el.textContent); if (p && p.val) countTo(el, 0); });
}
/* A figure that changes under you — a spend saved, a read landing — counts
   from the old number to the new one rather than blinking. */
new MutationObserver(list => {
  for (const m of list) {
    const el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
    if (!el || !el.matches || !el.matches(NUM)) continue;
    if (written.get(el) === el.textContent) continue;
    let old = m.type === 'characterData' ? m.oldValue : [...m.removedNodes].map(n => n.textContent).join('');
    const a = parse(old);
    if (a && parse(el.textContent)) countTo(el, a.val);
  }
}).observe($('views'), {subtree:true, childList:true, characterData:true, characterDataOldValue:true});

/* ---------- a view change ---------- */
let enterTimer = 0;
function onView(){
  const view = document.querySelector('.view.on');
  const on = nav.querySelector('.nav-i.on') || nav.querySelector('.nav-i[data-go="' + document.body.dataset.consoleView + '"]');
  const art = on && (on.querySelector('svg:not(.oa)') || on.querySelector('.av'));
  viewIco.innerHTML = art ? art.outerHTML : '';
  title.style.animation = 'none'; void title.offsetWidth; title.style.animation = '';
  document.querySelectorAll('.view.cx-enter').forEach(v => v.classList.remove('cx-enter'));
  if (!view) return;
  view.classList.remove('cx-scrolled');
  view.classList.add('cx-enter');
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => view.classList.remove('cx-enter'), 1100);
  countView(view);
  syncTop();
}
window.addEventListener('fomo:view-change', onView);
/* The rail is rebuilt on sign-in, after the first view-change has gone. */
new MutationObserver(() => { if (!viewIco.innerHTML) onView(); }).observe(nav, {childList:true});

/* ---------- the spotlight on cards ---------- */
const CARD = '.rail>.overview-stat,.stcard,.gh-big,.ppgrid>div,.clock-card,.panel';
let lit = null, px = 0, py = 0, frame = 0;
document.addEventListener('pointermove', ev => {
  if (ev.pointerType !== 'mouse') return;
  px = ev.clientX; py = ev.clientY;
  lit = ev.target.closest && ev.target.closest(CARD);
  if (lit && !frame) frame = requestAnimationFrame(() => {
    frame = 0; if (!lit) return;
    const r = lit.getBoundingClientRect();
    lit.style.setProperty('--mx', (px - r.left) + 'px');
    lit.style.setProperty('--my', (py - r.top) + 'px');
  });
}, {passive:true});

/* ---------- scrolling ---------- */
const topBtn = document.createElement('button');
topBtn.id = 'cx-top'; topBtn.type = 'button'; topBtn.setAttribute('aria-label', 'Back to the top');
topBtn.innerHTML = svg('<path d="M10 15.5v-11M5 9.4l5-5 5 5"/>');
document.body.append(topBtn);
function scroller(){ return document.querySelector('.view.on>.scroller'); }
function syncTop(){
  const sc = scroller(), y = sc ? sc.scrollTop : 0;
  topBtn.classList.toggle('on', y > 700);
  topBtn.tabIndex = y > 700 ? 0 : -1;
}
document.addEventListener('scroll', ev => {
  const sc = ev.target;
  if (!sc.classList || !sc.classList.contains('scroller')) return;
  const view = sc.closest('.view');
  if (view) view.classList.toggle('cx-scrolled', sc.scrollTop > 4);
  syncTop();
}, {capture:true, passive:true});
topBtn.addEventListener('click', () => {
  const sc = scroller();
  if (sc) sc.scrollTo({top:0, behavior:reduce.matches ? 'auto' : 'smooth'});
});

/* ---------- the keyboard ---------- */
const GO = [
  ['o', 'overview', 'Overview'], ['l', 'ledger', 'Ledger'], ['r', 'settle', 'Reimbursements'],
  ['m', 'subs', 'On repeat'], ['b', 'reporting', 'Breakdown'], ['v', 'visits', 'Visit requests'],
  ['p', 'applicants', 'Applicants'], ['t', 'campus', 'Campus team'], ['h', 'chapters', 'Chapters'],
  ['w', 'posts', 'This week'], ['a', 'attendance', 'Attendance'], ['s', 'schedules', 'Schedules'],
  ['c', 'commits', 'Commits'], ['y', 'me', 'Your page'], ['e', 'eyes', 'Eyes (new tab)']
];
const k = s => '<span class="kbd">' + s + '</span>';
const help = document.createElement('div');
help.id = 'cx-help'; help.hidden = true;
help.setAttribute('role', 'dialog'); help.setAttribute('aria-modal', 'true'); help.setAttribute('aria-labelledby', 'cx-help-t');
help.innerHTML = '<div class="box"><header><h2 id="cx-help-t">Keyboard shortcuts</h2><button class="mini ghost" type="button" data-x>Close</button></header><div class="cols">' +
  '<h3>Anywhere</h3>' +
  '<div class="k"><span>Jump to anything</span><span>' + k('⌘') + k('K') + '</span></div>' +
  '<div class="k"><span>New spend</span><span>' + k('N') + '</span></div>' +
  '<div class="k"><span>Search this view</span><span>' + k('/') + '</span></div>' +
  '<div class="k"><span>Collapse the sidebar</span><span>' + k('[') + '</span></div>' +
  '<div class="k"><span>Next theme</span><span>' + k('⇧') + k('T') + '</span></div>' +
  '<div class="k"><span>This sheet</span><span>' + k('?') + '</span></div>' +
  '<h3>Go to — press G, then</h3>' +
  GO.map(([key, , label]) => '<div class="k"><span>' + label + '</span><span>' + k('G') + k(key.toUpperCase()) + '</span></div>').join('') +
  '</div></div>';
document.body.append(help);
let helpFrom = null;
function openHelp(){ helpFrom = document.activeElement; help.hidden = false; help.querySelector('[data-x]').focus(); }
function closeHelp(){ help.hidden = true; if (helpFrom && helpFrom.focus) helpFrom.focus(); }
help.addEventListener('click', ev => { if (ev.target === help || ev.target.closest('[data-x]')) closeHelp(); });
keysBtn.addEventListener('click', openHelp);

const chord = document.createElement('div');
chord.id = 'cx-chord'; chord.setAttribute('aria-hidden', 'true');
chord.innerHTML = k('G') + ' then a letter — ' + k('?') + ' for the list';
document.body.append(chord);
let gAt = 0, chordTimer = 0;
function endChord(){ gAt = 0; chord.classList.remove('on'); clearTimeout(chordTimer); }

function go(id){
  if (id === 'eyes') { window.open('/eyes', '_blank', 'noopener'); return; }
  if (id === 'me') {
    const mine = [...nav.querySelectorAll('.nav-i[data-go="person"]')].find(b => b.querySelector('.tx').textContent === 'Your page');
    if (mine) location.hash = '#/person/' + encodeURIComponent(mine.dataset.who);
    return;
  }
  location.hash = '#/' + id;
}
function blocked(){
  return !$('app') || $('app').hidden || !$('pal').hidden || $('drawer').classList.contains('on') ||
    document.querySelector('dialog[open]') || ($('shot') && !$('shot').hidden);
}
document.addEventListener('keydown', ev => {
  if (!help.hidden) {
    if (ev.key === 'Escape' || ev.key === '?') { ev.preventDefault(); closeHelp(); }
    return;
  }
  if (ev.metaKey || ev.ctrlKey || ev.altKey || typing(ev.target) || blocked()) return;
  if (gAt && Date.now() - gAt < 1500) {
    const hit = GO.find(([key]) => key === ev.key.toLowerCase());
    endChord();
    if (hit) { ev.preventDefault(); go(hit[1]); }
    return;
  }
  if (ev.key === 'g' || ev.key === 'G') {
    ev.preventDefault(); gAt = Date.now(); chord.classList.add('on');
    clearTimeout(chordTimer); chordTimer = setTimeout(endChord, 1500);
  } else if (ev.key === '?') {
    ev.preventDefault(); openHelp();
  } else if (ev.key === '[') {
    ev.preventDefault(); railBtn.click();
  } else if (ev.key === 'T') {
    ev.preventDefault(); $('theme').click();
  } else if (ev.key === '/') {
    const field = document.querySelector('.view.on input[type="search"]');
    ev.preventDefault();
    if (field) { field.focus(); field.select(); } else $('pal-open').click();
  }
});

/* Signing in can finish before this module runs, so draw once now too. */
onView();
