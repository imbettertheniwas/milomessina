/* ══════════ the schedules ══════════

   The tab at /internal#/schedules. Four interns on four campuses with four
   timetables nobody else has seen, and one question that comes up every
   week: when could we all actually be in the office at the same time.
   Asking on a group chat gets three answers and a week of drift, so the
   hours each of them is already spoken for go on the sheet once a term,
   and the board over there works the rest out.

   What is stored is a normal week, not a calendar: a block is "Mon, Wed,
   Fri 9:00–10:15, CS 106", one row, repeating. That is the shape the
   question is asked in — nobody wants to know whether the 14th is free,
   they want to know whether Tuesday afternoons are — and it is the shape
   that stays true for a whole term instead of needing a sync.

   The board is a guess and says so. It knows the classes people typed in;
   it does not know about the dentist, the drive, or the week somebody goes
   home. It narrows "when is everyone free" down from a blank page to two or
   three windows worth putting to the group, which is all it is for.

   One more tab of the same Google Sheet, behind the same Apps Script
   deployment as the ledger and the week notes — and, when that deployment
   is a version behind, this browser's own storage instead, so the tab is
   usable the moment it loads rather than after somebody redeploys. */

const $ = id => document.getElementById(id);
const bridge = () => window.FOMO_SHEET || {};
const PEOPLE = () => bridge().people || [];
const toneOf = n => (bridge().tone ? bridge().tone(n) : '--s7');
const current = () => (bridge().identity ? bridge().identity() : null);
const admin = () => !!(bridge().admin && bridge().admin());
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* Monday first. The week people plan around starts on a Monday and the
   weekend belongs at the end of it, not split across both ends. */
const DAYS = [
  {n:1, short:'Mon', long:'Monday'},
  {n:2, short:'Tue', long:'Tuesday'},
  {n:3, short:'Wed', long:'Wednesday'},
  {n:4, short:'Thu', long:'Thursday'},
  {n:5, short:'Fri', long:'Friday'},
  {n:6, short:'Sat', long:'Saturday'},
  {n:7, short:'Sun', long:'Sunday'}
];

/* Half an hour. Classes land on the hour and the half hour almost without
   exception, a quarter-hour grid is twice the cells for the same answer,
   and an hour grid loses the 9:30 start that makes a window work. A block
   that runs 9:00–10:15 is read as busy through the 10:00 slot: the
   fifteen minutes it spills over are not a window anybody can use. */
const STEP = 30;
const SLOTS = (24 * 60) / STEP;

/* What the board shows by default, and what it shows when somebody wants
   the whole thing. Nobody is deciding to come into the office at four in
   the morning, and thirteen hours of grid is already a tall panel. */
const HOURS = {day:[8, 21], wide:[6, 24]};

const KINDS = {
  class: {label:'Class', v:'--s6'},
  work:  {label:'Work',  v:'--s2'},
  busy:  {label:'Busy',  v:'--s7'},
  none:  {label:'Nothing fixed', v:'--s3'},
  /* A break is dated rather than weekly: spring break, reading week, the
     Monday nobody has class. It does not go on the grid — it is the weeks
     the grid does not apply — so it is listed beside it instead. */
  break: {label:'Break', v:'--s4'}
};
const kindOf = k => KINDS[k] || KINDS.busy;

const MAX_BLOCKS = 80, MAX_LABEL = 80;

const state = {
  blocks: [], loaded: false, busy: false, saving: false,
  tab: 'board', who: '', need: 0, needSet: false, wide: false,
  days: [], local: false, at: 0
};

/* ---------- where it saves ----------

   The same two-step the ledger does, for the same reason. The sheet is the
   point — four people's weeks over each other is not a thing one browser
   can know — but a deployment that has never heard of this tab should cost
   the page its sharing, not its usefulness. So: talk to the sheet, and if
   what answers is a version behind, fall back to this browser and say so
   in a sentence that names the fix. */
const CACHE = 'fomo.schedules.cache';
const LOCAL = 'fomo.schedules.local';

function remember(){
  try { localStorage.setItem(CACHE, JSON.stringify({at: Date.now(), blocks: state.blocks})); }
  catch (e) {}
}

function recall(){
  try {
    const was = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (!was || !Array.isArray(was.blocks)) return false;
    state.blocks = was.blocks;
    state.at = was.at || 0;
    return true;
  } catch (e) { return false; }
}

const localRead = () => {
  try { const v = JSON.parse(localStorage.getItem(LOCAL) || '[]'); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
};
const localWrite = list => {
  try { localStorage.setItem(LOCAL, JSON.stringify(list)); } catch (e) {}
};
const newId = () => Math.random().toString(36).slice(2, 10);

/* ---------- times ---------- */

const pad2 = n => (n < 10 ? '0' : '') + n;

function mins(hhmm){
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? (+m[1]) * 60 + (+m[2]) : -1;
}

function hhmm(total){
  const t = Math.max(0, Math.min(24 * 60, Math.round(total)));
  return pad2(Math.floor(t / 60) % 24 === 0 && t === 24 * 60 ? 24 : Math.floor(t / 60)) + ':' + pad2(t % 60);
}

/* 14:30 as "2:30 PM". The grid is read at a glance and a college timetable
   is spoken in twelve-hour time, whatever it is stored in. */
function clock(total){
  const t = Math.max(0, Math.round(total)), h = Math.floor(t / 60), m = t % 60;
  const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
  let show = h % 12; if (show === 0) show = 12;
  return show + (m ? ':' + pad2(m) : '') + ' ' + ampm;
}

const span = (a, b) => clock(a) + '–' + clock(b);

/* 'YYYY-MM-DD' out of a date or a string, and '' out of anything else. */
function day10(v){
  if (v && typeof v.getFullYear === 'function') {
    return v.getFullYear() + '-' + pad2(v.getMonth() + 1) + '-' + pad2(v.getDate());
  }
  const s = String(v == null ? '' : v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

const today10 = () => day10(new Date());

/* "Mar 16" and "Mar 16 – Mar 20", read off the two dates. */
function breakSay(b){
  const one = iso => {
    const d = new Date(iso + 'T12:00:00');
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
  };
  if (!b.from) return '';
  return b.to && b.to !== b.from ? one(b.from) + ' – ' + one(b.to) : one(b.from);
}

function ago(stamp){
  const t = Date.parse(String(stamp || '').replace(' ', 'T'));
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  if (m < 60 * 24) return Math.round(m / 60) + 'h ago';
  const d = Math.round(m / (60 * 24));
  if (d < 7) return d + 'd ago';
  return new Date(t).toLocaleDateString('en-US', {month:'short', day:'numeric'});
}

/* A list of day numbers as the sentence somebody would say it in: three in
   a row become "Mon–Wed", the weekdays become "weekdays", and everything
   else is just listed. */
function daysSay(days){
  const d = (days || []).slice().sort((a, b) => a - b);
  if (!d.length) return '';
  if (d.length === 7) return 'every day';
  if (d.length === 5 && d.join() === '1,2,3,4,5') return 'weekdays';
  if (d.length === 2 && d.join() === '6,7') return 'weekends';
  const runs = [];
  d.forEach(n => {
    const last = runs[runs.length - 1];
    if (last && n === last[last.length - 1] + 1) last.push(n);
    else runs.push([n]);
  });
  return runs.map(r => r.length > 2
    ? DAYS[r[0] - 1].short + '–' + DAYS[r[r.length - 1] - 1].short
    : r.map(n => DAYS[n - 1].short).join(', ')).join(', ');
}

/* ---------- the sheet, or this browser ---------- */

function clean(b){
  const who = String(b.who || '').trim();
  if (PEOPLE().indexOf(who) < 0) return {error:'that name is not on the bootcamp'};
  if (b.kind === 'none') return {who, label:'', kind:'none', days:[], start:'', end:'', source:'typed',
    from:'', to:''};
  if (b.kind === 'break') {
    const from = day10(b.from), to = day10(b.to) || from;
    if (!from) return {error:'a break needs the day it starts'};
    const name = String(b.label || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
    if (!name) return {error:'a break needs a name'};
    return {who, label:name, kind:'break', days:[], start:'', end:'',
      source:['typed','ics','pasted'].indexOf(b.source) >= 0 ? b.source : 'typed',
      from, to: to < from ? from : to};
  }
  const days = (b.days || []).map(Number).filter(n => n >= 1 && n <= 7)
    .filter((n, i, all) => all.indexOf(n) === i).sort((a, b2) => a - b2);
  if (!days.length) return {error:'pick at least one day'};
  const start = mins(b.start), end = mins(b.end);
  if (start < 0 || end < 0) return {error:'give a start and an end, like 09:00 and 10:15'};
  if (end <= start) return {error:'that block ends before it starts'};
  return {
    who, days, start:hhmm(start), end:hhmm(end),
    label: String(b.label || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL),
    kind: KINDS[b.kind] ? b.kind : 'busy',
    source: ['typed','ics','pasted'].indexOf(b.source) >= 0 ? b.source : 'typed',
    from:'', to:''
  };
}

async function call(action, payload){
  const cfg = bridge();
  if (!cfg.endpoint) { const e = new Error('no endpoint'); e.old = true; throw e; }
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    body: JSON.stringify(Object.assign({_api:'schedules', action, _key:cfg.key || '',
      _session: cfg.session ? cfg.session() : ''}, payload || {}))
  });
  if (!res.ok) throw new Error('the sheet answered HTTP ' + res.status);
  let out = null;
  try { out = JSON.parse(await res.text()); } catch (e) {}
  if (!out) throw new Error('the endpoint answered, but not with the schedules. ' +
    'Its deployment access is probably not set to "Anyone"');
  if (out.ok !== true) {
    /* "unknown form" is what the router says to an _api it has never heard
       of, and "unknown action" is what this tab says to one it cannot do
       yet. Both mean the same thing standing in front of it: the script
       behind the URL predates this tab. */
    if (out.error === 'unknown form' || out.error === 'unknown action') {
      const e = new Error('old deployment'); e.old = true; throw e;
    }
    throw new Error(out.error || 'the sheet turned it away');
  }
  if (!out.schedules) { const e = new Error('old deployment'); e.old = true; throw e; }
  return out;
}

/* The same five actions against this browser's own storage, so everything
   above the store can be written once and not care which one it got. */
function localCall(action, payload){
  const list = localRead(), p = payload || {};
  const me = current() ? current().who : '';
  const mine = id => admin() || (list.filter(b => b.id === String(id))[0] || {}).who === me;

  if (action === 'add') {
    if (!admin() && p.who !== me) throw new Error('You can only change your own week.');
    const c = clean(p);
    if (c.error) throw new Error(c.error);
    const rest = list.filter(b => b.who !== c.who ||
      (c.kind === 'none' ? false : b.kind !== 'none'));
    rest.push(Object.assign({id:newId(), updated:new Date().toISOString().slice(0, 19)}, c));
    localWrite(rest);
  } else if (action === 'edit') {
    if (!mine(p.id)) throw new Error('You can only change your own week.');
    const was = list.filter(b => b.id === String(p.id))[0];
    if (!was) throw new Error('that block is already gone');
    if (was.kind === 'none') throw new Error('there is nothing on that line to edit');
    const c = clean(Object.assign({}, was, p, {who:was.who, source:was.source}));
    if (c.error) throw new Error(c.error);
    localWrite(list.map(b => b.id === was.id
      ? Object.assign({}, b, c, {updated:new Date().toISOString().slice(0, 19)}) : b));
  } else if (action === 'delete') {
    if (!mine(p.id)) throw new Error('You can only change your own week.');
    localWrite(list.filter(b => b.id !== String(p.id)));
  } else if (action === 'import') {
    if (!admin() && p.who !== me) throw new Error('You can only change your own week.');
    const kept = list.filter(b => b.who !== p.who || (b.source !== p.source && b.kind !== 'none'));
    const taken = (p.blocks || []).map(b => clean(Object.assign({}, b, {who:p.who, source:p.source})))
      .filter(c => !c.error)
      .map(c => Object.assign({id:newId(), updated:new Date().toISOString().slice(0, 19)}, c));
    if (!taken.length) throw new Error('nothing in that file looked like a weekly commitment');
    localWrite(kept.concat(taken));
  } else if (action === 'clear') {
    if (!admin() && p.who !== me) throw new Error('You can only change your own week.');
    localWrite(list.filter(b => b.who !== p.who));
  }
  return {schedules: localRead()};
}

/* One door for everything above: the sheet while it can answer, this
   browser once it has proved it cannot. A write that finds an old
   deployment is not lost — it is replayed against local storage, so the
   block somebody just typed lands somewhere either way. */
async function store(action, payload){
  if (state.local) return localCall(action, payload);
  try {
    return await call(action, payload);
  } catch (err) {
    if (!err.old) throw err;
    state.local = true;
    return localCall(action, payload);
  }
}

/* ---------- reading a calendar ---------- */

/* A .ics is folded at 75 characters, and a continuation line starts with a
   space or a tab. Unfolding first means everything below can read a line
   as a line. */
function icsLines(text){
  return String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function icsUnescape(v){
  return String(v || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/\s+/g, ' ').trim();
}

/* 20260914T093000, 20260914T133000Z, or a date with no time. A Z is real
   UTC and is turned into local time; everything else is wall-clock where
   it was written, which is what a timetable means by nine o'clock. */
function icsWhen(value, params){
  const s = String(value || '').trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(s);
  if (!m) return null;
  if (/VALUE=DATE(?!-TIME)/i.test(params || '') || !m[4]) return {allDay:true, date:new Date(+m[1], +m[2] - 1, +m[3])};
  if (m[7]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    return {allDay:false, date:d, at:d.getHours() * 60 + d.getMinutes(), day:((d.getDay() + 6) % 7) + 1};
  }
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  return {allDay:false, date:d, at:(+m[4]) * 60 + (+m[5]), day:((d.getDay() + 6) % 7) + 1};
}

const ICS_DAY = {MO:1, TU:2, WE:3, TH:4, FR:5, SA:6, SU:7};

/* What somebody's school calendar says, in the two shapes it says it in.

   **The classes.** Two kinds of export have to come out the same. Some
   portals write one event with a weekly rule on it — read the rule. Others
   write out every single meeting as its own dated event, forty of them —
   so those are folded onto the weekday they fall on and the duplicates
   collapse. A dated event is only counted if it is in the next couple of
   months, or a file with a year of history in it would have somebody busy
   at every hour of the week.

   **The breaks.** An academic calendar's other half is all-day: spring
   break, reading week, the Monday after Thanksgiving. Those are not hours
   in a week and never go on the grid — marking a whole day busy from one
   would be wrong in the direction that costs a window — but they are
   exactly what somebody wants to see when they upload the file, so they
   come back beside the classes as dated breaks rather than being thrown
   away. Only the ones that have not already finished: last spring's break
   is not news. */
function icsBlocks(text){
  const lines = icsLines(text), out = [], breaks = [];
  const now = new Date(), horizon = new Date(now.getTime() + 70 * 864e5);
  const gone = today10();
  let ev = null;

  const field = line => {
    const at = line.indexOf(':');
    if (at < 0) return null;
    const head = line.slice(0, at), body = line.slice(at + 1);
    const semi = head.indexOf(';');
    return {name:(semi < 0 ? head : head.slice(0, semi)).toUpperCase(),
            params:semi < 0 ? '' : head.slice(semi + 1), value:body};
  };

  lines.forEach(line => {
    const f = field(line);
    if (!f) return;
    if (f.name === 'BEGIN' && f.value.toUpperCase() === 'VEVENT') { ev = {}; return; }
    if (!ev) return;
    if (f.name === 'END' && f.value.toUpperCase() === 'VEVENT') { take(ev); ev = null; return; }
    if (f.name === 'DTSTART') ev.start = icsWhen(f.value, f.params);
    else if (f.name === 'DTEND') ev.end = icsWhen(f.value, f.params);
    else if (f.name === 'DURATION') ev.dur = icsDuration(f.value);
    else if (f.name === 'RRULE') ev.rrule = f.value;
    else if (f.name === 'SUMMARY') ev.summary = icsUnescape(f.value);
    else if (f.name === 'LOCATION') ev.where = icsUnescape(f.value);
  });

  function take(e){
    if (!e.start) return;

    /* an all-day event: a break, or whatever else the school has put on
       the calendar without an hour attached */
    if (e.start.allDay) {
      const from = day10(e.start.date);
      /* DTEND on an all-day event is the morning after it finishes, so the
         last day it actually covers is the day before that. */
      let to = from;
      if (e.end && e.end.allDay) {
        const back = new Date(e.end.date.getTime() - 864e5);
        to = day10(back);
        if (to < from) to = from;
      }
      if (!from || to < gone) return;                 /* already over */
      if (breaks.length >= 40) return;
      const name = (e.summary || 'Break').slice(0, MAX_LABEL);
      if (breaks.some(x => x.label === name && x.from === from)) return;
      breaks.push({kind:'break', label:name, from, to, days:[], start:'', end:''});
      return;
    }

    /* How long it runs, from the two dates rather than the two clock
       times: an event ending at midnight ends at 00:00 the following day,
       and read as a clock time alone that is a block running backwards. */
    let long = e.end && !e.end.allDay ? Math.round((e.end.date - e.start.date) / 60000)
             : (e.dur || 60);
    if (!(long > 0)) long = 60;
    if (long > 12 * 60) return;                    /* an all-day event in disguise */
    /* One that runs into the small hours is cut at midnight rather than
       wrapping onto a day it was never on. */
    const endAt = Math.min(24 * 60, e.start.at + long);

    const rule = {};
    String(e.rrule || '').split(';').forEach(part => {
      const bits = part.split('=');
      if (bits.length === 2) rule[bits[0].toUpperCase()] = bits[1];
    });

    let days = [];
    if (rule.FREQ) {
      const until = rule.UNTIL ? icsWhen(rule.UNTIL, '') : null;
      if (until && until.date < now) return;        /* a term that is over */
      const freq = String(rule.FREQ).toUpperCase();
      if (freq !== 'WEEKLY' && freq !== 'DAILY') return;
      const by = String(rule.BYDAY || '').split(',')
        .map(t => ICS_DAY[t.replace(/^[-+]?\d+/, '').toUpperCase()]).filter(Boolean);
      days = by.length ? by : (freq === 'DAILY' ? [1, 2, 3, 4, 5, 6, 7] : [e.start.day]);
    } else {
      if (e.start.date < new Date(now.getTime() - 864e5) || e.start.date > horizon) return;
      days = [e.start.day];
    }

    const label = (e.summary || e.where || 'Busy').slice(0, MAX_LABEL);
    days.forEach(d => out.push({day:d, start:e.start.at, end:endAt, label, kind:guessKind(label)}));
  }

  return {blocks:fold(out),
          breaks:breaks.sort((a, b) => a.from.localeCompare(b.from))};
}

/* PT1H30M, and the shapes around it. */
function icsDuration(v){
  const m = /^-?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/i.exec(String(v || ''));
  if (!m) return 0;
  return (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

/* A timetable names what it is. Reading the kind off the title is a guess,
   and a wrong one costs a colour rather than a window. */
function guessKind(label){
  const s = String(label || '').toLowerCase();
  if (/\b(shift|work|job|intern|office hours)\b/.test(s)) return 'work';
  if (/\b(lec|lecture|lab|seminar|section|class|discussion|studio|recitation|exam|quiz|tutorial)\b/.test(s) ||
      /\b[a-z]{2,5}\s?-?\s?\d{2,4}[a-z]?\b/.test(s)) return 'class';
  return 'busy';
}

/* Forty dated meetings of the same class are one block on three days. Same
   hours and same name fold together, and the days pile up on the one that
   is kept. */
function fold(list){
  const byKey = {};
  list.forEach(b => {
    const key = b.start + '|' + b.end + '|' + b.label.toLowerCase();
    if (!byKey[key]) byKey[key] = {days:[], start:b.start, end:b.end, label:b.label, kind:b.kind};
    if (byKey[key].days.indexOf(b.day) < 0) byKey[key].days.push(b.day);
  });
  return Object.keys(byKey).map(k => byKey[k])
    .map(b => ({days:b.days.sort((x, y) => x - y), start:hhmm(b.start), end:hhmm(b.end),
                label:b.label, kind:b.kind}))
    .sort((a, b) => (a.days[0] - b.days[0]) || (mins(a.start) - mins(b.start)))
    .slice(0, MAX_BLOCKS);
}

/* ---------- reading it typed out ---------- */

/* Not everybody can export a calendar, and a timetable copied off a portal
   is four lines of text that already say everything: the days, the hours
   and what it is. So the same four lines are read here rather than made
   into a form somebody fills in eight times.

   "CS 106 MWF 9:00-10:15" and "Shift at the library Tue Thu 2pm-6pm" both
   come out the same. What cannot be read is handed back by line, because a
   parser that silently drops the line somebody typed is worse than one
   that admits it. */
const NAMED = {
  monday:1, mon:1, tuesday:2, tues:2, tue:2, wednesday:3, weds:3, wed:3,
  thursday:4, thurs:4, thur:4, thu:4, friday:5, fri:5,
  saturday:6, sat:6, sunday:7, sun:7,
  weekdays:0, daily:0, everyday:0
};

/* MWF, TTh, MW, TuTh — the compact form a registrar writes. Read left to
   right, the two-letter days first so the T in "Th" is not taken as
   Tuesday on its own. */
function compactDays(token){
  const s = String(token).replace(/[\s./,]/g, '');
  if (!s || !/^[MTWRFSUuhae]+$/i.test(s)) return null;
  const out = [];
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2).toLowerCase(), one = s[i].toLowerCase();
    if (two === 'th' || two === 'tu' || two === 'sa' || two === 'su' || two === 'mo' || two === 'we' || two === 'fr') {
      out.push({th:4, tu:2, sa:6, su:7, mo:1, we:3, fr:5}[two]); i += 2; continue;
    }
    const single = {m:1, t:2, w:3, r:4, f:5, s:6, u:7}[one];
    if (!single) return null;
    out.push(single); i += 1;
  }
  return out.filter((n, k, all) => all.indexOf(n) === k);
}

function pasteLine(line){
  let text = ' ' + String(line).replace(/\s+/g, ' ').trim() + ' ';
  if (!text.trim()) return null;

  /* the hours first, so the words around them are what is left */
  const time = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|—|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i.exec(text);
  if (!time) return {error:'no hours on it'};

  const half = v => String(v || '').toLowerCase().replace(/\./g, '').slice(0, 2);
  let sh = +time[1], sm = +(time[2] || 0), eh = +time[4], em = +(time[5] || 0);
  const sMer = half(time[3]), eMer = half(time[6]);

  const put = (h, mer) => {
    if (mer === 'pm') return h === 12 ? 12 : h + 12;
    if (mer === 'am') return h === 12 ? 0 : h;
    return h;
  };
  sh = put(sh, sMer); eh = put(eh, eMer);
  let start = sh * 60 + sm, end = eh * 60 + em;

  /* Half a timetable is written without an am or a pm on it, and the half
     that is says enough to work the other out. Whichever end is spelled
     out fixes the other: "1–2:20pm" is the afternoon because 1am to 2:20pm
     is not a class, and "6:30–8am" is the morning for the same reason
     backwards. With neither end spelled out it is the working day that
     decides — nobody on this team has a two in the morning commitment —
     and "11–1" is read as running through lunch rather than backwards. */
  if (sMer && !eMer) { while (end <= start) end += 12 * 60; }
  else if (!sMer && eMer) { while (end - start > 12 * 60) start += 12 * 60; }
  else if (!sMer && !eMer) {
    if (sh >= 1 && sh <= 7) { start += 12 * 60; end += 12 * 60; }
    else if (end <= start) end += 12 * 60;
  }
  if (end <= start) return {error:'it ends before it starts'};
  if (end > 24 * 60) return {error:'those hours run past midnight'};

  text = (text.slice(0, time.index) + ' ' + text.slice(time.index + time[0].length)).replace(/\s+/g, ' ');

  /* then the days, by name and then by the compact form */
  let days = [];
  text = text.replace(/\b([a-z]+)\b/gi, (m0, word) => {
    const hit = NAMED[word.toLowerCase()];
    if (hit === undefined) return m0;
    if (hit === 0) days = days.concat(word.toLowerCase() === 'weekdays' ? [1,2,3,4,5] : [1,2,3,4,5,6,7]);
    else days.push(hit);
    return ' ';
  });
  if (!days.length) {
    text = text.replace(/(^|\s)([MTWRFSUmtwrfsuhaeo.,/]{1,12})(?=\s|$)/g, (m0, lead, token) => {
      if (days.length) return m0;
      const hit = compactDays(token);
      if (!hit || !hit.length) return m0;
      days = hit;
      return lead;
    });
  }
  if (!days.length) return {error:'no days on it'};

  const label = text.replace(/[\s,;:·—–-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
  days = days.filter((n, i, all) => all.indexOf(n) === i).sort((a, b) => a - b);
  return {days, start:hhmm(start), end:hhmm(end), label:label || 'Busy', kind:guessKind(label)};
}

function pasteBlocks(text){
  const good = [], bad = [];
  String(text).split('\n').forEach(line => {
    if (!line.trim()) return;
    const one = pasteLine(line);
    if (!one) return;
    if (one.error) { bad.push({line:line.trim(), why:one.error}); return; }
    good.push(one);
  });
  return {good, bad};
}

/* ---------- who is free when ---------- */

const blocksOf = who => state.blocks.filter(b => b.who === who && b.kind !== 'none' && b.kind !== 'break');
/* Soonest first, and the ones already over are not shown at all — a break
   list is a list of what is coming. */
const breaksOf = who => state.blocks
  .filter(b => b.who === who && b.kind === 'break' && (b.to || b.from) >= today10())
  .sort((a, b) => String(a.from).localeCompare(String(b.from)));
const onBreak = (who, when) => breaksOf(who)
  .filter(b => b.from <= (when || today10()) && (b.to || b.from) >= (when || today10()));
/* Somebody counts once they have said something — blocks, or the standing
   "nothing fixed". Silence is not the same as being free, and the board
   would be a lie if it read it that way. */
const filledIn = who => state.blocks.some(b => b.who === who);

function knownPeople(){
  return PEOPLE().filter(filledIn);
}

/* A busy map per person: 7 days of half-hour slots, true where a block
   covers any part of the slot. */
function busyOf(who){
  const grid = DAYS.map(() => new Array(SLOTS).fill(false));
  blocksOf(who).forEach(b => {
    const from = mins(b.start), to = mins(b.end);
    if (from < 0 || to <= from) return;
    (b.days || []).forEach(d => {
      if (!(d >= 1 && d <= 7)) return;
      const first = Math.floor(from / STEP), last = Math.ceil(to / STEP);
      for (let i = first; i < last && i < SLOTS; i++) grid[d - 1][i] = true;
    });
  });
  return grid;
}

/* For every slot of the week: who, of the people who have filled theirs
   in, has nothing on. */
function freeGrid(){
  const who = knownPeople(), maps = who.map(busyOf);
  return DAYS.map((d, di) => {
    const row = [];
    for (let s = 0; s < SLOTS; s++) row.push(who.filter((p, i) => !maps[i][di][s]));
    return row;
  });
}

/* The windows worth putting to the group: a run of slots where at least
   `need` people are free, an hour or longer, inside the hours the board is
   showing. Ranked by how many people, then how long, then how early in the
   week — a Tuesday afternoon everybody can make beats a Saturday morning
   three of them can. */
function windows(grid, need, from, to){
  const out = [];
  const first = Math.floor(from * 60 / STEP), last = Math.ceil(to * 60 / STEP);
  DAYS.forEach((day, di) => {
    let run = null;
    for (let s = first; s <= last; s++) {
      const here = s < last ? grid[di][s] : [];
      const ok = s < last && here.length >= need;
      if (ok) {
        /* A run is only the same window while the same people are in it —
           somebody leaving at two ends the window that had everybody. */
        const names = here.map(p => p).sort().join('|');
        if (run && run.names === names) { run.to = s + 1; continue; }
        if (run) out.push(run);
        run = {day:day.n, from:s, to:s + 1, names, who:here.slice()};
      } else if (run) { out.push(run); run = null; }
    }
    if (run) out.push(run);
  });
  /* Ranked the way somebody would pick one, which is not the same as
     longest first. Past about four hours a window has stopped getting more
     useful — everybody is coming in for an afternoon, not for thirteen
     hours — so length is scored with a ceiling on it. Without one, "free
     all Saturday" wins every time it is true, which it usually is, and the
     Tuesday afternoon that is the actual answer ends up fifth. Weekdays
     come first for the same reason: the office is a weekday place, and
     anybody who wants the weekend can read it further down. */
  return out
    .map(w => ({day:w.day, who:w.who, start:w.from * STEP, end:w.to * STEP,
                span:(w.to - w.from) * STEP}))
    .filter(w => w.span >= 60)
    .sort((a, b) => (b.who.length - a.who.length) ||
                    ((a.day > 5 ? 1 : 0) - (b.day > 5 ? 1 : 0)) ||
                    (Math.min(b.span, 240) - Math.min(a.span, 240)) ||
                    (a.day - b.day) || (a.start - b.start));
}

/* Two windows an hour apart on the same day are one answer, not two. Keep
   the best of each day until the list has enough in it. */
function pickWindows(list, howMany){
  const out = [], perDay = {};
  list.forEach(w => {
    if (out.length >= howMany) return;
    perDay[w.day] = (perDay[w.day] || 0);
    if (perDay[w.day] >= 2) return;
    if (out.some(o => o.day === w.day && o.start < w.end && o.end > w.start)) return;
    perDay[w.day]++;
    out.push(w);
  });
  return out;
}

/* ---------- drawing it ---------- */

function message(text, bad){
  const el = $('sc-msg');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('err', !!bad);
}

const av = p => '<span class="av" aria-hidden="true" style="background:var(' + toneOf(p) + ')">' +
  esc(String(p).charAt(0).toUpperCase()) + '</span>';

function hoursNow(){ return state.wide ? HOURS.wide : HOURS.day; }

function render(){
  drawTabs();
  drawBoard();
  drawMine();
  drawAll();
  drawAgg();
}

function drawTabs(){
  const mineCount = state.who ? blocksOf(state.who).length : 0;
  const n = $('sc-n');
  if (n) n.textContent = mineCount || '';
  [].forEach.call(document.querySelectorAll('#sc-tabs .vtab'), b =>
    b.classList.toggle('on', b.getAttribute('data-sc') === state.tab));
  ['board', 'mine', 'all'].forEach(id => {
    const el = $('sc-' + id);
    if (el) el.hidden = state.tab !== id;
  });
}

function drawBoard(){
  const known = knownPeople(), all = PEOPLE(), missing = all.filter(p => !filledIn(p));
  const grid = freeGrid(), [from, to] = hoursNow();

  const sel = $('sc-need');
  if (sel) {
    const top = Math.max(2, known.length);
    /* "Everybody" is the question this tab gets opened for, so it is what
       the box starts on — but only until somebody moves it. It used to be
       worked out on the first draw, which happens before anything has been
       read, so it settled on two and stayed there however many weeks
       landed afterwards. */
    const want = state.needSet && state.need <= top ? state.need : top;
    state.need = want;
    sel.innerHTML = [];
    let html = '';
    for (let n = 2; n <= top; n++) {
      html += '<option value="' + n + '"' + (n === want ? ' selected' : '') + '>' +
        n + (n === known.length && known.length > 1 ? ' — everybody in' : '') + '</option>';
    }
    sel.innerHTML = html;
    sel.disabled = top < 3;
  }

  $('sc-guess-say').innerHTML = !known.length
    ? 'Nobody has filled a week in yet. The board starts working the moment somebody does.'
    : 'A guess, not a calendar. It knows the weeks <b>' + known.length + ' of ' + all.length +
      '</b> have filled in' +
      (missing.length ? ' — nothing here is waiting on ' + missing.map(esc).join(', ') + ' being free, it simply does not know them yet' : '') +
      '. Put the window to the group before anybody drives in.';

  /* A week on the grid is a term week. Somebody whose school is on break
     is not in any of the classes drawn on it, and that changes the answer
     in their favour rather than against it — so it is said out loud here
     instead of being silently baked into cells nobody would know to
     distrust. */
  const away = PEOPLE().filter(p => onBreak(p).length);
  const note = $('sc-away');
  if (note) {
    note.hidden = !away.length;
    note.innerHTML = away.map(p => '<b>' + esc(p) + '</b> is on ' +
      esc(onBreak(p)[0].label.toLowerCase()) + ' until ' +
      esc(breakSay({from:onBreak(p)[0].to || onBreak(p)[0].from}))).join(', and ') +
      (away.length ? ' — the classes below are term-time, so there is more room than the grid shows.' : '');
  }

  drawBest(grid, known, from, to);
  drawHeat(grid, known, from, to);

  $('sc-hours').textContent = state.wide ? 'Just the working day' : 'Show the whole day';
  $('sc-free-note').textContent = known.length
    ? clock(from * 60) + ' to ' + clock(to * 60) + ' · solid where ' + state.need +
      ' or more are free, faint where fewer are'
    : '';
}

function drawBest(grid, known, from, to){
  const box = $('sc-best'), note = $('sc-best-note');
  if (!box) return;
  if (!known.length) {
    note.textContent = '';
    box.innerHTML = '<div class="sc-none">Nothing to work out yet. Open <b>My week</b> and put yours in — ' +
      'a calendar export does it in one go.</div>';
    return;
  }

  let need = state.need, found = windows(grid, need, from, to), eased = 0;
  /* Four people, four timetables: the hour all four are free may simply
     not exist. Saying "no windows" and stopping would be technically true
     and useless, so the bar comes down a person at a time and the panel
     says what it settled for. */
  while (!found.length && need > 2) { need--; eased++; found = windows(grid, need, from, to); }

  const best = pickWindows(found, 6);
  note.textContent = best.length
    ? (eased ? 'nobody is free all at once — these are the closest' : 'an hour or more, ' + need + ' or more of them free')
    : 'nothing an hour long in these hours';

  if (!best.length) {
    box.innerHTML = '<div class="sc-none">No window of an hour where ' + need +
      ' of them are free' + (state.wide ? '' : ' between ' + clock(from * 60) + ' and ' + clock(to * 60) +
      ' — try <b>the whole day</b>') + '.</div>';
    return;
  }

  box.innerHTML = best.map(w => {
    const out = known.filter(p => w.who.indexOf(p) < 0);
    const hours = Math.round(w.span / 60 * 10) / 10;
    return '<div class="sc-win' + (w.who.length === known.length && known.length > 1 ? ' all' : '') + '">' +
      '<div class="sc-win-when"><b>' + DAYS[w.day - 1].long + '</b>' +
        '<span>' + span(w.start, w.end) + '</span></div>' +
      '<div class="sc-win-who">' + w.who.map(p => av(p) + '<i>' + esc(p) + '</i>').join('') + '</div>' +
      '<div class="sc-win-tail">' +
        '<span class="sc-win-len">' + (hours >= 1 ? hours + (hours === 1 ? ' hour' : ' hours') : w.span + ' min') + '</span>' +
        (out.length ? '<span class="sc-win-out">' + esc(out.join(', ')) + ' busy</span>' : '<span class="sc-win-ok">everybody free</span>') +
      '</div></div>';
  }).join('');
}

function drawHeat(grid, known, from, to){
  const box = $('sc-heat');
  if (!box) return;
  if (!known.length) { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;

  const first = Math.floor(from * 60 / STEP), last = Math.ceil(to * 60 / STEP);
  let h = '<div class="sc-hcol sc-htimes"><span class="sc-hhead"></span>';
  for (let s = first; s < last; s++) {
    const at = s * STEP;
    h += '<span class="sc-htime">' + (at % 60 === 0 ? clock(at).replace(':00', '') : '') + '</span>';
  }
  h += '</div>';

  DAYS.forEach((day, di) => {
    h += '<div class="sc-hcol"><span class="sc-hhead">' + day.short + '</span>';
    for (let s = first; s < last; s++) {
      const free = grid[di][s], n = free.length;
      const share = known.length ? n / known.length : 0;
      const on = n >= state.need;
      h += '<span class="sc-cell' + (on ? ' on' : '') + (n === known.length && n > 1 ? ' all' : '') +
        '" style="--fill:' + share.toFixed(2) + '" title="' +
        esc(day.long + ' ' + span(s * STEP, s * STEP + STEP) + ' · ' +
          (n ? free.join(', ') + ' free' : 'nobody free')) + '"></span>';
    }
    h += '</div>';
  });

  box.innerHTML = h;
}

/* ---------- my week ---------- */

function drawMine(){
  drawWhobar();
  drawDayPicker();
  drawWeek();
  drawBreaks();
  drawList();
}

/* ---------- the week, laid out ----------

   A list of blocks says what is on it; it does not say what the week looks
   like. Somebody who has just uploaded a term wants to see the term — the
   Tuesday that is three classes back to back, the Friday that is empty, and
   the two hours in the middle of Wednesday that are the only time anything
   else could go. So the blocks are drawn where they fall, and the gaps
   between them are labelled, because the gaps are the half of a timetable
   nobody writes down and everybody plans around. */
function drawWeek(){
  const panel = $('sc-week-panel'), box = $('sc-week');
  if (!box) return;
  const mine = blocksOf(state.who);
  panel.hidden = !mine.length;
  if (!mine.length) { box.innerHTML = ''; return; }

  /* The hours this person's week actually occupies, rounded out to the
     hour and with a little air either side — a 9-to-3 timetable should
     not be drawn on a scale that runs to midnight. */
  const starts = mine.map(b => mins(b.start)), ends = mine.map(b => mins(b.end));
  const from = Math.max(0, Math.floor(Math.min.apply(null, starts) / 60) * 60 - 60);
  const to = Math.min(24 * 60, Math.ceil(Math.max.apply(null, ends) / 60) * 60 + 60);
  const tall = Math.max(60, to - from);
  const at = m => ((m - from) / tall * 100).toFixed(3) + '%';

  let h = '<div class="sc-wcol sc-wtimes"><span class="sc-whead"></span><div class="sc-wbody">';
  for (let m = Math.ceil(from / 60) * 60; m < to; m += 60) {
    h += '<span class="sc-wtime" style="top:' + at(m) + '">' + clock(m).replace(' ', '') + '</span>';
  }
  h += '</div></div>';

  const gaps = [];
  DAYS.forEach(day => {
    const onDay = mine.filter(b => (b.days || []).indexOf(day.n) >= 0)
      .sort((a, b) => mins(a.start) - mins(b.start));
    h += '<div class="sc-wcol"><span class="sc-whead' + (onDay.length ? '' : ' off') + '">' +
      day.short + '</span><div class="sc-wbody">';
    for (let m = Math.ceil(from / 60) * 60; m < to; m += 60) {
      h += '<i class="sc-wline" style="top:' + at(m) + '"></i>';
    }

    /* the gaps between one thing and the next, which is what a break in a
       school day actually is */
    onDay.forEach((b, i) => {
      const next = onDay[i + 1];
      if (!next) return;
      const open = mins(next.start) - mins(b.end);
      if (open < 45) return;
      gaps.push(open);
      h += '<span class="sc-wgap" style="top:' + at(mins(b.end)) +
        ';height:' + (open / tall * 100).toFixed(3) + '%"><i>' +
        (open >= 60 ? Math.round(open / 60 * 10) / 10 + 'h' : open + 'm') + ' free</i></span>';
    });

    onDay.forEach(b => {
      const k = kindOf(b.kind), long = mins(b.end) - mins(b.start);
      h += '<span class="sc-wblock' + (long <= 60 ? ' tight' : '') +
        '" style="top:' + at(mins(b.start)) + ';height:' + (long / tall * 100).toFixed(3) +
        '%;background:var(' + k.v + ')" title="' +
        esc((b.label || k.label) + ' · ' + span(mins(b.start), mins(b.end))) + '">' +
        '<b>' + esc(b.label || k.label) + '</b><i>' + esc(clock(mins(b.start))) + '</i></span>';
    });
    h += '</div></div>';
  });
  box.innerHTML = h;

  const days = DAYS.filter(d => mine.some(b => (b.days || []).indexOf(d.n) >= 0)).length;
  const free = DAYS.length - days;
  $('sc-week-note').textContent = days + (days === 1 ? ' day with something on it' : ' days with something on it') +
    (free ? ' · ' + free + ' clear' : '') +
    (gaps.length ? ' · ' + gaps.length + (gaps.length === 1 ? ' gap' : ' gaps') + ' between classes' : '');
}

/* ---------- the breaks ---------- */

function drawBreaks(){
  const panel = $('sc-breaks-panel'), box = $('sc-breaks');
  if (!box) return;
  const list = breaksOf(state.who);
  panel.hidden = !list.length;
  if (!list.length) { box.innerHTML = ''; return; }

  const now = today10();
  $('sc-breaks-note').textContent = list.length + (list.length === 1 ? ' ahead' : ' ahead') +
    ' · off the weekly grid';
  box.innerHTML = '<div class="sc-rows">' + list.map(b => {
    const here = b.from <= now && (b.to || b.from) >= now;
    const days = Math.round((Date.parse((b.to || b.from) + 'T12:00:00') -
      Date.parse(b.from + 'T12:00:00')) / 864e5) + 1;
    return '<div class="sc-row' + (here ? ' now' : '') + '" data-id="' + esc(b.id) + '">' +
      '<i class="sc-swatch" style="background:var(' + KINDS.break.v + ')" aria-hidden="true"></i>' +
      '<span class="sc-row-what"><b>' + esc(b.label) + '</b>' +
        '<span class="sc-row-sub">' + (here ? 'on now' : 'coming up') +
        (days > 1 ? ' · ' + days + ' days' : '') +
        (b.source === 'ics' ? ' · from a calendar' : '') + '</span></span>' +
      '<span class="sc-row-when">' + esc(breakSay(b)) + '</span>' +
      '<button type="button" class="sc-x" data-drop="' + esc(b.id) +
        '" aria-label="Remove ' + esc(b.label) + '">' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>' +
      '</button></div>';
  }).join('') + '</div>';
}

function drawWhobar(){
  const box = $('sc-whobar');
  if (!box) return;
  const me = current();
  const can = admin() ? PEOPLE() : (me ? [me.who] : []);
  box.hidden = can.length < 2;
  box.innerHTML = can.map(p => '<button type="button" class="sc-me' + (p === state.who ? ' on' : '') +
    '" data-me="' + esc(p) + '">' + av(p) + esc(p) +
    (filledIn(p) ? '' : '<i class="sc-dot" aria-hidden="true"></i>') + '</button>').join('');
}

function drawDayPicker(){
  const box = $('sc-days');
  if (!box) return;
  box.innerHTML = DAYS.map(d => '<button type="button" class="sc-day' +
    (state.days.indexOf(d.n) >= 0 ? ' on' : '') + '" data-day="' + d.n + '" ' +
    'aria-pressed="' + (state.days.indexOf(d.n) >= 0 ? 'true' : 'false') + '">' +
    d.short + '</button>').join('') +
    '<button type="button" class="sc-day sc-day-set" data-set="weekdays">Weekdays</button>';
}

function drawList(){
  const box = $('sc-list'), note = $('sc-mine-note'), clear = $('sc-clear');
  if (!box) return;
  const who = state.who;
  const mine = blocksOf(who).slice().sort((a, b) =>
    ((a.days || [])[0] - (b.days || [])[0]) || (mins(a.start) - mins(b.start)));
  const openWeek = who && filledIn(who) && !mine.length;

  clear.hidden = !who || !filledIn(who);
  clear.textContent = openWeek ? 'Take that back' : 'Clear the week';

  if (!who) {
    note.textContent = '';
    box.innerHTML = '<div class="sc-none">Sign in to put your week in.</div>';
    return;
  }
  if (openWeek) {
    note.textContent = 'nothing fixed';
    box.innerHTML = '<div class="sc-none"><b>' + esc(who) + ' has nothing fixed this week.</b> ' +
      'The board counts ' + esc(who) + ' free at every hour until a block goes on here.</div>';
    return;
  }
  if (!mine.length) {
    note.textContent = 'empty';
    box.innerHTML = '<div class="sc-none"><b>Nothing on record for ' + esc(who) + '.</b> ' +
      'Until there is, the board leaves ' + esc(who) + ' out rather than guessing — ' +
      'add the classes above, drop a calendar in, or ' +
      '<button type="button" class="linkish" id="sc-open">say there is nothing fixed</button>.</div>';
    return;
  }

  const hours = mine.reduce((sum, b) =>
    sum + (mins(b.end) - mins(b.start)) * (b.days || []).length, 0) / 60;
  note.textContent = mine.length + (mine.length === 1 ? ' block · ' : ' blocks · ') +
    (Math.round(hours * 10) / 10) + 'h a week';

  box.innerHTML = '<div class="sc-rows">' + mine.map(b => {
    const k = kindOf(b.kind);
    return '<div class="sc-row" data-id="' + esc(b.id) + '">' +
      '<i class="sc-swatch" style="background:var(' + k.v + ')" aria-hidden="true"></i>' +
      '<span class="sc-row-what"><b>' + esc(b.label || k.label) + '</b>' +
        '<span class="sc-row-sub">' + esc(daysSay(b.days)) + ' · ' + esc(k.label.toLowerCase()) +
        (b.source && b.source !== 'typed' ? ' · from ' + (b.source === 'ics' ? 'a calendar' : 'a paste') : '') +
        '</span></span>' +
      '<span class="sc-row-when">' + esc(span(mins(b.start), mins(b.end))) + '</span>' +
      '<button type="button" class="sc-x" data-drop="' + esc(b.id) + '" aria-label="Remove ' +
        esc(b.label || 'this block') + '">' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>' +
      '</button></div>';
  }).join('') + '</div>';
}

/* ---------- everyone ---------- */

function drawAll(){
  const box = $('sc-people');
  if (!box) return;
  const [from, to] = hoursNow();
  const first = Math.floor(from * 60 / STEP), last = Math.ceil(to * 60 / STEP);

  box.innerHTML = PEOPLE().map(p => {
    const mine = blocksOf(p), has = filledIn(p);
    const map = busyOf(p);
    const hours = mine.reduce((sum, b) =>
      sum + (mins(b.end) - mins(b.start)) * (b.days || []).length, 0) / 60;
    const last2 = state.blocks.filter(b => b.who === p)
      .map(b => b.updated).sort().slice(-1)[0];

    /* The same hours down the side as the board has. Without them the
       strip is a shape you can compare with the person above it but cannot
       read a time off, which is half of what it is for. */
    let strip = '<div class="sc-pcol sc-ptimes"><span class="sc-phead"></span>';
    for (let s2 = first; s2 < last; s2++) {
      const at = s2 * STEP;
      strip += '<span class="sc-ptime">' + (at % 120 === 0 ? clock(at).replace(' ', '') : '') + '</span>';
    }
    strip += '</div>';
    DAYS.forEach((d, di) => {
      strip += '<div class="sc-pcol"><span class="sc-phead">' + d.short + '</span>';
      for (let s = first; s < last; s++) {
        strip += '<span class="sc-pcell' + (map[di][s] ? ' busy' : '') +
          '" style="background:' + (map[di][s] ? 'var(' + toneOf(p) + ')' : '') + '"></span>';
      }
      strip += '</div>';
    });

    return '<div class="panel sc-person">' +
      '<div class="panel-h">' + av(p) + '<h2>' + esc(p) + '</h2>' +
        '<span class="note">' + (!has ? 'nothing on record yet'
          : !mine.length ? 'nothing fixed this week'
          : mine.length + (mine.length === 1 ? ' block · ' : ' blocks · ') +
            (Math.round(hours * 10) / 10) + 'h a week' +
            (last2 ? ' · ' + ago(last2) : '')) + '</span></div>' +
      '<div class="panel-b">' + (has && mine.length
        ? '<div class="sc-pstrip">' + strip + '</div>'
        : '<div class="sc-none">' + (has
            ? 'Free at every hour the board knows about.'
            : esc(p) + ' has not filled a week in, so the board leaves ' + esc(p) + ' out of it.') +
          '</div>') +
      '</div></div>';
  }).join('');
}

function drawAgg(){
  const box = $('sc-agg');
  if (!box) return;
  const known = knownPeople().length, all = PEOPLE().length;
  const blocks = state.blocks.filter(b => b.kind !== 'none' && b.kind !== 'break').length;
  const breaks = state.blocks.filter(b => b.kind === 'break').length;
  box.innerHTML = '<span class="agg">' + known + ' of ' + all + ' weeks filled in</span>' +
    '<span class="agg">' + blocks + (blocks === 1 ? ' block' : ' blocks') +
      (breaks ? ' · ' + breaks + (breaks === 1 ? ' break' : ' breaks') : '') + '</span>' +
    '<span class="agg">' + (state.local
      ? 'this device only'
      : 'shared sheet' + (state.at ? ' · read ' + ago(new Date(state.at).toISOString()) : '')) + '</span>';
}

/* ---------- reading and writing ---------- */

function take(out){
  state.blocks = (out.schedules || []).map(b => Object.assign({}, b, {
    days: (b.days || []).map(Number).filter(n => n >= 1 && n <= 7),
    kind: KINDS[b.kind] ? b.kind : 'busy'
  }));
  state.loaded = true;
  state.at = Date.now();
  render();
  remember();
}

const LOCAL_SAY = 'The schedules are not shared yet — this browser is keeping its own. ' +
  'Redeploy fomo/setup/apps-script.gs (Deploy → Manage deployments → New version) and ' +
  'this page moves itself over next time it loads.';

async function load(force){
  if (state.busy || (state.loaded && !force)) return;
  state.busy = true;
  message(state.loaded ? 'Re-reading the schedules…' : 'Reading the schedules…');
  try {
    take(await call('list'));
    state.local = false;
    message(said());
  } catch (err) {
    if (err.old) {
      /* Not an error anybody can act on from this page except by redeploying,
         so it reads as what it is: a smaller version of the tab, working. */
      state.local = true;
      take(localCall('list'));
      message(LOCAL_SAY, true);
    } else {
      message(err.message, true);
    }
  } finally {
    state.busy = false;
    drawAgg();
  }
}

function said(){
  const known = knownPeople().length, all = PEOPLE().length;
  if (!known) return 'Nobody has put a week in yet.';
  if (known < all) return known + ' of ' + all + ' have put a week in.';
  return 'All ' + all + ' weeks are in.';
}

async function act(action, payload, saying){
  if (state.saving) return false;
  if (!current()) { message('Sign in first.', true); return false; }
  state.saving = true;
  message(saying || 'Saving…');
  try {
    take(await store(action, payload));
    message(state.local ? LOCAL_SAY : said(), state.local);
    return true;
  } catch (err) {
    message(err.message, true);
    return false;
  } finally {
    state.saving = false;
    drawAgg();
  }
}

/* ---------- the buttons ---------- */

$('sc-tabs').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-sc]');
  if (!b) return;
  state.tab = b.getAttribute('data-sc');
  drawTabs();
});

$('sc-refresh').addEventListener('click', () => load(true));

$('sc-need').addEventListener('change', ev => {
  state.need = +ev.target.value || 2;
  state.needSet = true;
  drawBoard();
});

$('sc-hours').addEventListener('click', () => {
  state.wide = !state.wide;
  drawBoard();
  drawAll();
});

$('sc-whobar').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-me]');
  if (!b) return;
  state.who = b.getAttribute('data-me');
  drawMine();
  drawTabs();
});

$('sc-days').addEventListener('click', ev => {
  const set = ev.target.closest('button[data-set]');
  if (set) {
    const weekdays = [1, 2, 3, 4, 5];
    const on = weekdays.every(n => state.days.indexOf(n) >= 0);
    state.days = on ? [] : weekdays;
    drawDayPicker();
    return;
  }
  const b = ev.target.closest('button[data-day]');
  if (!b) return;
  const n = +b.getAttribute('data-day');
  const at = state.days.indexOf(n);
  if (at >= 0) state.days.splice(at, 1); else state.days.push(n);
  state.days.sort((x, y) => x - y);
  drawDayPicker();
});

$('sc-add').addEventListener('click', async () => {
  const block = {
    who: state.who, label: $('sc-label').value, kind: $('sc-kind').value,
    days: state.days.slice(), start: $('sc-start').value, end: $('sc-end').value, source: 'typed'
  };
  const c = clean(block);
  if (c.error) { $('sc-form-hint').textContent = c.error; return; }
  $('sc-form-hint').textContent = '';
  if (await act('add', block, 'Adding it…')) {
    $('sc-label').value = '';
    state.days = [];
    drawDayPicker();
  }
});

$('sc-breaks').addEventListener('click', ev => {
  const drop = ev.target.closest('button[data-drop]');
  if (drop) act('delete', {id:drop.getAttribute('data-drop')}, 'Removing it…');
});

$('sc-list').addEventListener('click', async ev => {
  const open = ev.target.closest('#sc-open');
  if (open) { act('add', {who:state.who, kind:'none'}, 'Noted…'); return; }
  const drop = ev.target.closest('button[data-drop]');
  if (!drop) return;
  act('delete', {id:drop.getAttribute('data-drop')}, 'Removing it…');
});

$('sc-clear').addEventListener('click', () => {
  const who = state.who;
  if (!who) return;
  const what = blocksOf(who).length;
  if (what && !confirm('Take all ' + what + ' of ' + who + '’s blocks off the board?')) return;
  act('clear', {who}, 'Clearing…');
});

/* ---------- a calendar, dropped in ---------- */

async function readCalendar(file){
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { message('That calendar is enormous — export one term rather than the year.', true); return; }
  message('Reading ' + file.name + '…');
  let text = '';
  try { text = await file.text(); }
  catch (e) { message('That file could not be read.', true); return; }
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    message('That does not look like a calendar file. Export a .ics and try again.', true);
    return;
  }
  const {blocks, breaks} = icsBlocks(text);
  const all = blocks.concat(breaks);
  if (!all.length) {
    message('Nothing in that calendar repeats weekly, happens soon, or runs for a day, ' +
      'so there was nothing to take from it.', true);
    return;
  }
  const say = n => (n === 1 ? '1 class' : n + ' classes');
  if (await act('import', {who:state.who, source:'ics', blocks:all},
      'Reading ' + all.length + ' things in…')) {
    message(say(blocks.length) + (breaks.length
      ? ' and ' + breaks.length + (breaks.length === 1 ? ' break' : ' breaks')
      : '') + ' read out of ' + file.name + '. Anything wrong comes off below.');
  }
}

$('sc-pick').addEventListener('change', ev => {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  readCalendar(file);
});

/* A file dragged onto the panel is the same thing as one picked, and it is
   the gesture somebody with the .ics already downloaded will reach for. */
const dropZone = () => $('sc-mine');
['dragover', 'dragleave', 'drop'].forEach(kind => {
  dropZone().addEventListener(kind, ev => {
    if (kind !== 'drop' && !(ev.dataTransfer && ev.dataTransfer.types &&
        [].indexOf.call(ev.dataTransfer.types, 'Files') >= 0)) return;
    ev.preventDefault();
    dropZone().classList.toggle('sc-dragging', kind === 'dragover');
    if (kind === 'drop') readCalendar(ev.dataTransfer.files && ev.dataTransfer.files[0]);
  });
});

$('sc-paste-go').addEventListener('click', async () => {
  const text = $('sc-paste').value;
  const {good, bad} = pasteBlocks(text);
  if (!good.length) {
    $('sc-paste-hint').textContent = bad.length
      ? 'Could not read any of that. A line needs days and hours: "CS 106 MWF 9:00-10:15".'
      : 'Nothing typed in yet.';
    return;
  }
  $('sc-paste-hint').textContent = bad.length
    ? bad.length + (bad.length === 1 ? ' line was' : ' lines were') + ' left out (' +
      bad.map(b => b.why).filter((w, i, a) => a.indexOf(w) === i).join(', ') + '): ' +
      bad.map(b => b.line).join(' · ')
    : good.length + (good.length === 1 ? ' line read.' : ' lines read.');
  if (await act('import', {who:state.who, source:'pasted', blocks:good}, 'Reading it in…')) {
    if (!bad.length) $('sc-paste').value = '';
  }
});

/* ---------- coming and going ---------- */

function activated(){
  if (!location.hash.startsWith('#/schedules')) return;
  load(false);
}
window.addEventListener('hashchange', activated);
window.addEventListener('fomo:view-change', activated);

/* Same reasoning as the week notes: Apps Script serves one request at a
   time, so this goes after the ledger has had its turn rather than racing
   it, and by the time anybody clicks through it is usually in hand. */
window.addEventListener('fomo:ledger-ready', () => load(false));

window.addEventListener('fomo:identity', () => {
  const me = current();
  if (me && (!state.who || !admin())) state.who = me.who;
  render();
  activated();
});

if (current()) state.who = current().who;
recall();
render();
activated();
