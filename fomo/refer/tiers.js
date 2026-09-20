/* ══════════ the referral ladder ══════════

   The one definition of what a referral is worth. The landing page reads
   it to draw the table, the console reads it to price a row, and the
   Apps Script mirrors it — see REFER_TIERS in fomo/setup/apps-script.gs,
   which carries the same four amounts and the note to change both
   together. Three runtimes, one ladder; a number typed twice is a number
   that will disagree with itself.

   Nothing here is a signup bounty. Every tier pays on a thing the person
   you referred actually finished, and each of those four things is an
   event this console already sees — an approval on the creator tab, an
   acceptance on the apply tab, a username added to a clan, a chapter
   crossing 80%. That is the whole reason the ladder has these four rungs
   and not four invented ones: a tier nobody can observe completing is a
   tier that never pays, and a referral programme that never pays is
   worse than none.

   `door` is where the person you referred lands, and it is what a
   generated link points at. `via` is the form tab their submission shows
   up on, which is how a completion is matched back to a code. */
export const TIERS = [
  {
    id:'clan', level:1, amount:5,
    label:'They join their chapter on fomo',
    door:'/fomo/onboard/', via:'onboard',
    blurb:'Someone you sent downloads fomo and lands in their house’s clan.',
    completes:'Paid once their fomo username is checked and actually added to the clan — not when they type it in.'
  },
  {
    id:'creator', level:2, amount:25,
    label:'They get approved as a creator',
    door:'/fomo/submit/', via:'submit',
    blurb:'A creator you sent applies at /fomo/submit and passes review.',
    completes:'Paid on approval, the same moment their own $25 approval bonus is. What they go on to earn per view is theirs.'
  },
  {
    id:'intern', level:3, amount:100,
    label:'They are hired onto a campus team',
    door:'/fomo/apply/', via:'apply',
    blurb:'Someone you sent applies for one of the five seats and gets it.',
    completes:'Paid when the application is marked accepted, not when it is submitted.'
  },
  {
    id:'chapter', level:4, amount:250,
    label:'A chapter you brought in qualifies',
    door:'/fomo/onboard/', via:'onboard',
    blurb:'A whole house onboards on your link and crosses the 80% line.',
    completes:'Paid when the chapter qualifies for its own $500 — the same 80% bar, read from the campus admin.'
  }
];

export const tierOf = id => TIERS.find(t => t.id === id) || null;
export const amountOf = id => (tierOf(id) || {amount:0}).amount;

/* What a referrer could make from one person, if that person did
   everything. Quoted on the landing page as the ceiling and nowhere
   claimed as typical. */
export const LADDER_TOTAL = TIERS.reduce((n, t) => n + t.amount, 0);

/* ---------- codes ----------

   A code is the referrer's fomo username, lowercased, with everything a
   URL would argue about taken out. Two people cannot hold the same one,
   which is checked at the sheet rather than here.

   It is deliberately their username and not a random string: the link is
   going into a group chat with their name already on it, and a code you
   can read is a code somebody can retype when the link gets mangled. */
export const CODE_MAX = 24;
export function normalizeCode(value) {
  return String(value == null ? '' : value)
    .trim().toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, CODE_MAX);
}
export function codeProblem(code) {
  if (!code) return 'Enter your fomo username.';
  if (code.length < 3) return 'That is too short — use at least three characters.';
  if (!/^[a-z0-9]/.test(code)) return 'Start with a letter or a number.';
  return null;
}

/* ---------- the link ----------

   `/r/<code>` is the shape, and it is the shape fomo.family already
   documents for its own invite links, so the day this moves across the
   only thing that changes is the origin. `?to=` names which door it
   opens; left off, it opens the one page that explains all four. */
export function referralLink(origin, code, to) {
  const base = String(origin || '').replace(/\/+$/, '') + '/r/' + encodeURIComponent(code);
  return to ? base + '?to=' + encodeURIComponent(to) : base;
}
