/* ══════════ referral attribution ══════════

   One script, added to every page that has a form on it, and the whole
   of the tracking half of /fomo/refer.

   It does three things and nothing else: notice a code on the way in,
   remember it, and put it in the box when a form is sent. There is no
   call home, no beacon and no cookie — a referral is only ever recorded
   at the moment somebody actually submits something, which is the same
   moment we would have a row about them anyway. A click that goes
   nowhere is not worth a row and is not worth knowing about.

   Load it with `defer` alongside form.js:

     <script defer src="/fomo/assets/refer.js"></script>

   and the form gains a `ref` column in its tab with nothing else
   touched. A page that forgets to include it loses attribution on that
   door and keeps working, which is the right way round.

   ---- first link wins ----

   The rules page promises the earliest referrer is the one credited, so
   the stored code is written once and not overwritten: someone who opens
   Jack's link on Monday and Priya's on Friday is Jack's. `?ref=` on the
   URL only replaces it when nothing is held. The one exception is an
   explicit `?ref=` with `?refnew` beside it, which is how a person who
   genuinely wants to switch does so — it is undocumented on purpose and
   exists for us, not for them. */
(function () {
  var HELD = 'fomo.refer.seen';
  var MAX = 24;

  /* Mirrors normalizeCode in fomo/refer/tiers.js — change both together.
     Written out rather than imported because this file has to be a
     classic script: it loads next to form.js on pages that are not
     modules. */
  function normalize(value) {
    return String(value == null ? '' : value)
      .trim().toLowerCase()
      .replace(/^@+/, '')
      .replace(/[^a-z0-9._-]+/g, '')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, MAX);
  }

  function read() {
    try {
      var held = JSON.parse(localStorage.getItem(HELD) || 'null');
      if (!held || !held.code) return null;
      var code = normalize(held.code);
      return code ? {code: code, at: String(held.at || '')} : null;
    } catch (e) { return null; }
  }

  function write(code) {
    var entry = {code: code, at: new Date().toISOString()};
    try { localStorage.setItem(HELD, JSON.stringify(entry)); } catch (e) {}
    return entry;
  }

  var params = new URLSearchParams(location.search);
  /* `r` as well as `ref` because /r/<code> hands one of them over and a
     person retyping a link by hand will use whichever they remember. */
  var incoming = normalize(params.get('ref') || params.get('r') || '');
  var held = read();
  if (incoming && (!held || params.has('refnew'))) held = write(incoming);

  /* Nothing to attribute: leave every form exactly as it was. */
  if (!held) return;

  /* A hidden input rather than a value stapled on at submit time,
     because form.js builds its payload out of FormData and anything not
     in the form does not exist to it. `ref` and `ref seen` become two
     columns on the tab, added by writeRow the first time one arrives. */
  function tag(form) {
    if (form.elements.ref) {
      form.elements.ref.value = held.code;
      return;
    }
    var code = document.createElement('input');
    code.type = 'hidden';
    code.name = 'ref';
    code.value = held.code;
    form.appendChild(code);

    var at = document.createElement('input');
    at.type = 'hidden';
    at.name = 'ref_seen';
    at.value = held.at;
    form.appendChild(at);
  }

  function tagAll() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) tag(forms[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tagAll);
  } else {
    tagAll();
  }

  /* A form built by script after this ran — the onboard page swaps its
     step in — would otherwise go out untagged. Cheap insurance: tag
     again on the way into any submit, before form.js reads the fields.
     Capture phase, because form.js calls preventDefault on its own. */
  document.addEventListener('submit', function (ev) {
    if (ev.target && ev.target.tagName === 'FORM') tag(ev.target);
  }, true);

  /* So a page can say who sent them, if it wants to. Nothing reads this
     today; it costs one line and saves the next page from re-deriving
     it out of localStorage by hand. */
  window.FOMO_REFERRER = held.code;
})();
