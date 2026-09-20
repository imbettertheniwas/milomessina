# The referral programme

**`/fomo/refer`** is where somebody claims a link. **`/internal#/referrals`**
is where the money hanging off it is decided. Between them is the part that
does the actual work and has no page at all: a `ref` column on the forms we
already had.

Nothing here pays on a signup. Every rung pays when the person who was
referred **finished something**, and each of those four things is an event
this console could already see.

---

## What it pays

| | | |
| --- | --- | --- |
| **Level 1** | They join their chapter on fomo | **$5** |
| **Level 2** | They get approved as a creator | **$25** |
| **Level 3** | They are hired onto a campus team | **$100** |
| **Level 4** | A chapter they brought in qualifies | **$250** |

The rungs stack, so one person can pay a referrer more than once — **$380**
if they go the whole way. Referral money is separate from what the referred
person earns: their $500 chapter payout, their $25 creator bonus and their pay
per view are theirs in full.

**The amounts live in [`tiers.js`](tiers.js).** Change them there, change
`REFER_TIERS` in [`fomo/setup/apps-script.gs`](../setup/apps-script.gs) and
`TIERS` in [`invoice/referrals.js`](../../invoice/referrals.js) to match, and
`tests/referral-ladder.test.mjs` will tell you if you missed one. Three
copies is three too many — they exist because the three runtimes cannot
import from each other — so the test is what keeps them honest rather than
the comments.

## How a referral actually gets tracked

Four steps, and only the first has a page of its own.

1. **They claim.** `/fomo/refer` posts to the `refer` namespace and gets a
   code back. The code is their fomo username, lowercased, with anything a
   URL would argue about taken out. It lands on the **`referrers`** tab.
2. **They send `/r/<code>`.** [`r/index.html`](../../r/index.html) writes the
   code into the opener's browser and forwards them to the right door.
   `?to=creator` picks which. A `?to=` that is not on its own list is
   ignored — it takes a value off the URL, and that is how a referral link
   would otherwise become somebody else's redirect.
3. **They fill a form in.** [`fomo/assets/refer.js`](../assets/refer.js) is
   on `/fomo/apply`, `/fomo/submit` and `/fomo/onboard` — the three doors a
   referred person can walk through — and puts the held code into the form
   as a hidden `ref` field. The submission lands on its usual tab with two
   more columns on it, `ref` and `ref seen`. Nothing else about those forms
   changes. `/fomo/report` deliberately does not have it: the weekly report
   is filed by somebody already on a campus team, so a `ref` column on that
   tab would be one nothing ever reads.
4. **The sweep finds it.** `referSweep` runs on every console read: it walks
   the form tabs, finds rows with a `ref` on them, and opens a **`referrals`**
   row for each one it has not seen. Referrals are *derived*, never typed —
   so one cannot exist without a real submission behind it.

There is no click tracking and no beacon. A click that never becomes a
submission is not a referral and is not worth a row.

### The one rung with no form behind it

A chapter crossing 80% happens in the campus admin, not on a form, so the
sweep has nothing to find. **Open one by hand** in the console does it, and
lands at `pending` like everything else.

## How money moves

```
pending ─── somebody read the submission ──▶ completed ─── the transfer happened ──▶ paid
   └────────────────────────────────────────────────────────────────▶ rejected
```

**Two steps on purpose.** `completed` is a judgement about the referral —
*this person really did finish*. `paid` is a statement of fact about a
transfer that has already happened in their fomo account. Collapsing them
would make "they finished" a button that moves money.

**`paid` is the end of the line.** The endpoint refuses every move out of it.
A console that can undo a payout is a console that can pay twice.

**Owed is `completed` and nothing else.** A pending referral is not owed —
nobody has yet said the person finished — so the totals never promise money
we have not agreed to.

### Paying into a fomo account

The console records the payout; it does not make it. Wiring the transfer is
the same seam [`fomo/onboard`](../onboard/README.md) documents — fomo's side
needs an endpoint before anything here can call it. Until then `Mark paid`
means *somebody sent it and is saying so*, which is why it asks for
confirmation and names the amount and the code in the question.

## What the sweep refuses

| | |
| --- | --- |
| **Self-referral** | Their own code on their own application. Recorded as `rejected`, not deleted — a thing we refused to pay is worth being able to point at. |
| **A code nobody claimed** | Still gets a row, flagged *no claim on this code*. Usually somebody who claimed while the sheet was unreachable. Dropping it would lose the referral and the evidence at once. |
| **A blocked code** | Still gets a row, flagged. Blocking never touches what a code has already earned. |
| **Two links** | The first link somebody opens is the one that holds. `/r/` and `refer.js` both refuse to overwrite a code already in the browser. |

## Where it saves

Two tabs on the same sheet as everything else, through the same deployment.
No new credentials and no new infrastructure.

**`referrers`** — `code`, `claimed`, `full name`, `email`, `school`,
`status`, `note`. One row per claim.

**`referrals`** — `id`, `created`, `code`, `tier`, `who`, `contact`, `via`,
`source`, `stage`, `amount`, `moved`, `moved by`, `note`. One row per
attributed submission. `source` is `<tab>:<row>`, which is what makes the
sweep idempotent and what lets the console point back at the submission.

## Who can see it

Arya and Milo, and the endpoint enforces it rather than the rail — these rows
put referrers' email addresses beside the amounts owed to them. Claiming a
code is the one public action, because a stranger is doing it.

## Moving it to fomo.family

The link shape is already the one fomo.family documents for its own invites,
so the origin is the only thing that changes:

- `referralLink()` in [`tiers.js`](tiers.js) takes the origin as an argument
  and the page passes `location.origin` — nothing to edit.
- `/r/:code` needs the same rewrite on the new host; ours is in
  [`vercel.json`](../../vercel.json).
- The doors in `r/index.html` are same-origin paths. Point them at wherever
  the forms end up.

## Running the tests

```bash
node --test "tests/*.test.mjs"
```

`tests/referral-ladder.test.mjs` checks the three copies of the ladder and
of the code normaliser agree, that every door on the redirector is a real
page, and that every form that can be referred through actually loads
`refer.js` **before** `form.js`. `tests/referrals-sheet.test.mjs` runs the
namespace against a fake spreadsheet: the sweep, the stages, and who is
allowed to move money.
