# arya's fomo bootcamp — the internal tool

**`milomessina.com/internal`** is the internal tool for arya's fomo bootcamp,
and `/invoice` is the same page under the name it started with — one file, two
paths, so every existing link and bookmark still works.
Milo, Bijan, Jesse and Luchi log what they front — lunches, API credits, coffee
— and mark the days they were in; the page totals what's been spent, who is
still owed, where the money went, and how many days each of them has been here. Anything that
goes out every month, a subscription rather than a one-off, is set up once and
puts itself on the ledger from then on.

It works the moment it loads. Nothing to deploy, nothing to configure.

## How it is laid out

It is a console rather than a page: a rail of views down the left, one of
them on screen at a time, each with its own toolbar along the top and its
own strip of totals along the foot. The rail carries a count beside each
name, so the thing most worth knowing — how much somebody is owed, how many
days have been marked this week — is on screen before you have opened
anything.

| View | What is on it |
| --- | --- |
| **Overview** | The four headline figures, what needs somebody's attention, spend by month, who has been in, and the newest activity across all three tables |
| **Ledger** | Every line, with sub-tabs for *all / still owed / reimbursed*, filters for who, category and period, search, and CSV |
| **Reimbursements** | A settle-up card per person, the who-fronted-it chart, and the lines that have been waiting longest |
| **On repeat** | The monthly rules, what they cost a month and a year, and when the next one lands |
| **The week** | The feed each of them posts their week into — a few lines on what they worked on, with the links and screenshots, newest week first |
| **Attendance** | The board you press your name on, the backfill, days per week, and the full record |
| **Commits** | The contribution map, together and one each |
| **Breakdown** | Where the money went by category, and who it was spent on |
| **Chapters** | Every house that has onboarded: the map, the funnel, who and where they are, and the full table — read from the campus admin, not the sheet |
| **Applicants** | Everyone who has applied to run a campus at `/fomo/apply`: the table, the whole application beside it, and where each one has got to |
| **Campus team** | The interns actually running a campus, grouped by state and then by campus |
| A person | One page each: fronted, still owed, spent on them, days in, commits, their lines and their days |

The view lives in the URL — `/internal#/ledger`, `/internal#/chapters`,
`/internal#/person/Bijan` —
so the back button works, a page can be bookmarked, and a link to somebody's
page is a link to somebody's page.

**Logging a spend is a drawer**, opened from **New spend** in the corner or
by pressing `n`, and it is the same form it always was — who paid, who it
was for, the photo, the repeat toggle. It closes itself on a line that
actually saved and stays open on one that didn't, which is the only way to
tell the two apart without reading the toast.

**⌘K** opens a jump-to: the views, the five names, and the last forty
spends. Picking a spend puts it in the ledger's search box rather than
pretending to open a record that doesn't exist.

There are three themes, and the button in the corner of the rail cycles
them: dark, light, and **fomo** — the bootcamp's own colours off
fomo.family, down to the commit map leaving GitHub's green for the brand
indigo. Left alone it follows the system's light or dark.

### What the numbers on each page are counted from

**Overview is always the whole ledger.** The other pages are not: the
breakdown draws from the same filtered list the ledger is showing, because
*where did coffee money go in the last 30 days* is a real question. What it
must not do is answer it under a caption saying "every line" — so it names
the filters that are narrowing it, wherever they were set, and offers to
drop them. The ledger's own strip of totals along its foot is filtered by
definition and says so: *N lines in view*.

## Where it saves

`BACKEND` at the top of the page's script decides, and it ships as `'auto'`.

**`'device'`** keeps everything in that browser's own storage. It is instant and
private, and the catch is in the name: **the ledger lives on whichever computer
it was typed on.** Arya's laptop and Milo's laptop hold different ledgers, and
clearing site data clears it. This is also why **nobody sees anybody else's
attendance** on device storage: a day marked on one laptop is a row in that
browser and has never left it. Treat the CSV exports as the way anything leaves
one machine.

**`'sheet'`** is the shared version: one ledger in a Google Sheet that everyone
reads and writes, surviving any one browser. It is what makes the cards mean
*who has been in* rather than *who has been in on this laptop*. It
costs one deploy — see below.

**`'auto'`**, the default, is both in the only order that is safe. The page
opens on this browser's own store — never blank, never waiting — and then asks
the endpoint whether the version actually deployed behind it carries the
ledger. If it does, the page moves itself over and the board goes live for
everyone. If it does not, it stays on device storage and says
so in a banner naming the fix, rather than breaking on a URL that cannot answer
it.

That last part is the point. Apps Script serves the last *deployed* version, so
`'sheet'` set before the redeploy is a page that loads to an error; `'sheet'`
set after means someone has to edit and ship this file at exactly the right
moment. `'auto'` removes the ordering: deploy the page whenever, deploy the
script whenever, and the board comes on by itself on the next load.

Nothing else changes. All three answer the same calls, so every button on the
page behaves identically either way.

### How long the switch takes

There is a spreadsheet at the end of every call, so none of them are fast, and
`'auto'` used to need two before anything shared could go on screen: one asking
the deployment what it is, another asking the sheet what is on it. Back to
back, on a cold script, that is the several seconds the ledger spent looking
empty on every single load. Two things shorten it, and neither changes what any
of the answers mean.

**The two questions go out together.** The probe and the first read do not need
each other's answer, so they are sent in the same breath and the wait is one
round trip rather than two. If the probe comes back saying there is nothing to
move onto, the read in flight is dropped unread.

**A load that has been here before skips the probe.** Every successful read is
written down under `fomo.ledger.seen` — the ledger, the days, the rules, the
roster, and the minute it was taken. A browser holding one from *this* endpoint,
from a deployment that carried everything, opens straight onto it in shared
mode: the full board is up in the first frame, stamped `shared · from 4:31pm`
with its own age, and the read that replaces it is the session's only call.

The snapshot is never treated as true. It is what the sheet last said, kept so
the wait happens under a board instead of under nothing, and every load replaces
it a second later. It is dropped on sight if the `/exec` URL has changed, and a
page that took the short way onto a deployment that has since been rolled back
finds out on that same read — it steps back onto device storage and says so, the
same sentence the probe would have said. An unchanged ledger is not rewritten,
so the 30-second poll is not also a 30-second write.

### The first load after the switch

Whatever was typed while the page was on device storage is still in that
browser — but the sheet has never seen it, so the switch is what takes it off
the screen. The page notices, counts it, and offers one button:

> **The clocks are shared from now on.** 3 shifts and 2 spends logged on this
> browser are not on the shared sheet yet, including 2 shifts still running.
> Still saved here either way — send them up and everyone sees them.

Nothing goes up until that is pressed, and nothing local is deleted either way.
A day carries **its own date** — this is why the Apps Script needs a
`dayimport` action rather than reusing `daymark`, which is about today and
would turn a Tuesday marked three weeks ago into a day nobody was here. Anything already on the
sheet is skipped rather than written twice, so pressing it again after a
half-finished send costs nothing. Receipt photos stay behind, since the sheet
holds a 500-character cell and not an image; the page says how many.

## Starting out

The ledger starts empty and only ever holds what someone actually logs. Nothing
is seeded, so the totals and charts stay at zero until the first spend goes in
and the first day is marked.

Every control writes straight through: adding a spend, marking one paid, settling
a whole person, marking a day and taking it back, and both deletes — which ask once before they
go, so a mis-click costs nothing. **Refresh** re-reads the store, which matters
when the page is open in more than one tab on the same browser.

## The passcode

`PASSCODE` at the top of `index.html` is `monkey`. Change it to whatever the
four of them should type; it is remembered per browser afterwards.

It travels in the page source, so it is a turnstile that keeps the ledger off
the open web — **not** a password. Anyone who reads the source can find it. Set
it to `''` to drop the gate entirely.

`INVOICE_KEY` in the Apps Script is set to the same string, so the **endpoint**
turns away requests that don't carry it, not just the page. That matters more
than it looks: the `/exec` URL is open to anyone who has it, and without the key
a stranger could read the ledger and mark people in and out without ever
loading `/invoice`. Change one and change the other, or the page locks itself
out of its own sheet.

## Switching on the shared sheet

The ledger endpoint lives in `fomo/setup/apps-script.gs`, alongside the receiver
the fomo forms already use. It writes an `invoice` tab and a `days` tab in the
same sheet, through the same deployment, so there is no second URL.

1. Open the sheet → **Extensions → Apps Script**.
2. Replace `Code.gs` with the current `fomo/setup/apps-script.gs`.
3. **Deploy → Manage deployments →** pencil icon **→ Version: New version → Deploy**.
4. Nothing. On `'auto'` the page picks it up by itself on the next load, and
   offers to carry that browser's ledger up with it.

> **Everything is deployed, and the URL moved.** The site now calls the
> deployment named **live** (`AKfycbyFhq…`), which serves the current script — `ledger`, `clock`,
> `shiftimport`, `subs` and `days` all true, Arya in `payers`. `ENDPOINT` in
> `invoice/index.html` names it.
>
> **`fomo/assets/form.js` still points at the old `AKfycbxDR…`, deliberately.**
> Both deployments belong to the same script project and write the same sheet,
> so nothing is split by it but the URL, and the three fomo forms were working
> where they were. If you ever consolidate, move the forms onto the new one
> rather than the page back onto the old.
>
> **Why the URL moved is the part worth keeping.** That script project has
> **three active deployments, all named "Untitled"**, distinguishable only by
> the seventh character of their id — `AKfycb**x**DR…`, `AKfycb**y**Fhq…`,
> `AKfycb**z**y4…`. Four separate attempts to cut a new version of the one the
> site called landed on the other two instead, each time looking exactly like
> a deploy that did nothing. The code was correct every time. In the end it
> was easier to point `ENDPOINT` at the deployment that already had the code
> than to keep hunting the right row.
>
> It is called **live** now, which is the fix. Two "Untitled" rows remain
> beside it and neither is the one to touch. Renaming cost nothing and moved
> nothing — description and version are separate fields in that dialog, so
> changing the description while leaving the Version dropdown alone keeps both
> the URL and the served code exactly as they were, which was checked against
> the endpoint straight afterwards.
>
> Before touching anything, still: check the ID in **Manage deployments**
> against `ENDPOINT`. If a redeploy ever looks like it did nothing, that is
> the first thing to look at, not the code.
>
> The reason it was needed is worth remembering, because it will happen again.
> The project had **two active deployments**. Somebody pasted the ledger code
> and cut a new version on Sep 9 — but that version went to the *other*
> deployment, and the URL this site actually calls stayed on Sep 7's forms-only
> code. From the outside it looked exactly like nothing had been deployed. When
> a redeploy seems to have no effect, check the deployment ID against `ENDPOINT`
> before touching anything else.

Step 3 is the one that matters. Apps Script serves the last *deployed* version,
not the last saved one, so pasting the code and hitting save changes nothing.

**Use Manage deployments, not New deployment.** "New deployment" mints a
*different* `/exec` URL and leaves the original — the one this site points at —
serving the old code, which looks exactly like nothing happened.

### Checking whether it took

Open the `/exec` URL itself in a browser:

    {"ok":true,"hint":"fomo campus form receiver is live","ledger":true,"clock":true,"shiftimport":true,"subs":true,"days":true,"payers":["Milo","Bijan","Jesse","Luchi","Arya"]}

`ledger` is the money half and `clock` is the attendance half, `shiftimport` is
the carry-over described above, `subs` is monthly subscriptions, `days` is the
attendance board counting days rather than hours, and `payers` is the roster
that deployment will actually put on a line. **All five `true` and Arya in
`payers` means the deployed version is the current one** — and every one of
them is read by the page itself on each load, which is how it knows to grey a
name out instead of losing a line to it, and to keep days in the browser
instead of pretending they are shared. If any is missing or `false`, that URL
is still serving older code. Either you ended up with a second deployment, or
the paste went into a different script project than the one this URL belongs to.

If you do end up with a new URL, paste it into `ENDPOINT` in both
`invoice/index.html` and `fomo/assets/form.js`, and make sure its **Who has
access** is set to **Anyone** — a fresh deployment defaults to *Only myself*,
which locks out the ledger and all three fomo forms alike.

## What the sheet holds

The `invoice` tab:

| Column | Holds |
| --- | --- |
| `id` | 8 characters, generated server-side; how a row is found again |
| `logged` | when it was added |
| `date` | the day of the spend, `YYYY-MM-DD` |
| `who` | Milo, Bijan, Jesse or Luchi — anything else is refused |
| `what` | the description |
| `category` | lunch, coffee, ai, software, travel, supplies, other |
| `amount` | USD |
| `status` | `pending` or `reimbursed` |
| `note` | optional |
| `receipt` | a link, if one was pasted in — see below |
| `reimbursed` | when it was marked paid |
| `shared` | who the line was *for* — see below. Blank on anything logged before this column existed |

The `subs` tab — one row per monthly subscription, and none of them a spend:

| Column | Holds |
| --- | --- |
| `id` | 8 characters, generated server-side |
| `created` | when the rule was set up |
| `who`, `what`, `category`, `amount`, `note`, `shared` | what each line it writes will say |
| `day` | the day of the month it lands on, 1–31 |
| `next` | the day the next line is due — the one field the whole thing turns on |
| `active` | `yes`, or `no` while it is paused |
| `last` | the day of the last line it wrote |

The `days` tab — one row per person per day they were here:

| Column | Holds |
| --- | --- |
| `id` | 8 characters, generated server-side |
| `who` | which intern |
| `day` | the day they were in, `YYYY-MM-DD` |
| `marked` | when the row was written — the same day, or later if it was filled in afterwards |

There is no start, no end and no duration, which is the point of the whole tab:
a day either happened or it didn't. `marked` is not a second opinion about when
somebody arrived, it is the audit trail — a Tuesday written down on Thursday
says `marked` Thursday, and the table shows it as *added sep 17* rather than
letting it pass for a Tuesday marked on Tuesday.

The old `hours` tab is left exactly where it is. It is the archive of the clock
this replaced — `start`, `end` and `minutes` per shift — and nothing reads it
any more. The first time the script is asked for a `days` tab that does not
exist yet, it creates one and carries every distinct person-and-day in `hours`
across, so the history survives the change. That runs once, on the tab's
creation, and cannot double up.

The `apply` tab is the form's, not the console's: `/fomo/apply` writes a
column per question it asks and adds one whenever it gains a question. The
console appends four of its own on the far right and touches nothing else —
`id` (8 characters, filled in on the first read of a row that has none),
`status`, `team notes`, and `decided`, the day the status was last moved.

The `campus_team` tab — one row per intern on a campus:

| Column | Holds |
| --- | --- |
| `id` | 8 characters, generated server-side |
| `added` | when the row was written |
| `name`, `email`, `phone` | how to reach them |
| `seat` | `pres`, `growth`, `partner`, `content` or `culture` — the same five the form offers |
| `campus` | the school they run, as it is written on their application |
| `state` | the two-letter code. It is what the roster is grouped by |
| `status` | `active`, `paused` or `alumni` |
| `started` | the day they started, `YYYY-MM-DD` |
| `notes` | optional |
| `from` | the `id` of the application they were hired out of, or blank if they were typed in by hand |

Edit any of these tabs by hand if you like — the page re-reads them every 30
seconds. Just leave the `id` columns alone; the page uses them to find rows.

## Receipt photos

The receipt field takes a photo, not a link. On a phone it opens the camera
or the camera roll; on a laptop, the file picker. Tap the thumbnail in the
ledger to see the full shot, and Escape or a click outside closes it.

Photos are never stored at full size. A phone snap is two to five megabytes
and a browser's whole store is about five, so each one is drawn down to
1000px on its long edge and re-encoded as JPEG — a 260KB receipt lands
around 20KB, and a real camera photo around 100KB. That is roughly forty
receipts before the store fills.

When it does fill, the line is **not** added: the store is rolled back to
what was last written and the page says which. Nothing appears on screen
that was not saved. Deleting a line with a photo on it frees the room again.

Where the photo ends up depends on where the ledger lives, but it is taken
the same way either way and the button is on in both.

On **device storage** it stays in that browser as a data URI, and the ledger
shows it as a thumbnail you can tap.

On the **shared sheet** it goes to Drive — the `fomo campus — receipts`
folder — and the sheet holds the link, which is what the report form has
always done with its uploads. Each receipt file is set to *anyone with the
link can view*, because a ledger four people read is no use if only one of
them can open the photo proving a line. Sharing is set per file, so the
folder itself and the rest of your Drive are untouched, and the private
`fomo campus — report uploads` folder is deliberately kept separate. If your
account forbids link sharing the upload still succeeds and the link simply
asks the viewer for access, rather than losing the whole spend over a
thumbnail.

Rows carrying an old `https://` receipt link still render as a link, either
way.

The file input is deliberately **not** `display:none`. Safari on iOS will not
open the picker for an input it is not rendering, so it is moved off-screen
instead — a hidden-attribute file input is the classic reason "add a photo"
does nothing on an iPhone.

## Who a spend was for

Who paid and who a spend was *for* are two different questions, and the form
asks them separately. Both rows list the same five names — the four interns
and **Arya**. Most lines are an intern's card, and those are the ones owed
money back, but Arya fronts spends too and they belong on the ledger the same
way. **who it was for** is a row of toggles underneath, because a good deal
of what gets bought is bought for Arya.

The board is the one place the roster is shorter: **Attendance** and
**Commits** are the four interns only. Arya is not on either, and their page
says so in place of the two figures that would be blank.

Whoever is paying starts ticked, since the usual case is buying your own along
with everyone else's. Untick yourself and the line reads as bought purely for
someone else — that is how "I got Arya a coffee and nothing for me" is
recorded rather than fudged into the note.

The page then shows the per-head figure: a $14 coffee run ticked for Milo and
Arya reads **2 ways · $7.00 each** in the ledger's own split column, and in
the CSV. **Breakdown → who it was spent on** totals it per person across the
ledger, and each person's page carries their own share of it.

**None of this changes what anybody is owed.** Whoever fronted the money is
owed all of it, split or not — the bootcamp is what reimburses them, so the
split is a record of where the money went, not a claim on anyone. The
who-fronted-it panel and the settle buttons are untouched by it.

Lines with nobody ticked are left out of the per-person totals rather than
guessed at. A spend that does not say who it was for is not evidence that the
payer had it alone, and the panel's caption says how many lines it is actually
describing so a chart drawn from three of forty is not read as all forty.

## Spends that repeat

Cursor, Claude, a gym membership — the things that go out on the same day
every month and get typed in again every month until somebody forgets. The
**repeat monthly** toggle beside *Add to ledger* turns the form into a rule
instead of a line: same fields, same split, and from then on it writes itself.

The day of the month comes from the date field, so a subscription set up on
the 3rd lands on the 3rd. The date's usual ceiling of *today* lifts while the
toggle is on, because a subscription can perfectly well start next week even
though a spend cannot have happened next week. A receipt photo is refused for
the same reason in reverse: the rule is not one purchase, and each month's
receipt belongs on the line that month.

**On repeat** in the rail is the list of them, with the next date, a pause
and a delete for each, and along the foot what they cost a month and a year.
**Pausing stops the next line; deleting stops the next line.** Neither touches the
lines already written — that money was actually spent, and the ledger is
the record of it. A rule resumed after a month off writes the month it
missed as soon as it comes back.

### What actually writes the line

A rule is not a spend. What it puts on the ledger each month is an ordinary
line — reimbursable, splittable, deletable, indistinguishable from one
somebody typed — which is why the totals, the charts, the CSV and the settle
buttons all needed no changes at all.

Who writes it depends on where the rules live:

- **On the shared sheet**, the endpoint does, inside the script lock it
  already holds for every write. That lock is the point: four laptops opening
  the page on the 14th all ask whether Cursor is due, and exactly one of them
  is allowed to answer. The same loop running in four browsers would write
  the month four times.
- **In this browser** — device storage, or a sheet whose deployment predates
  `subs` — the page does, and the rules are that browser's. A line it writes
  still goes to the shared ledger like any other spend.

Either way it is **the page being opened** that makes a month's line appear.
Nothing runs while the tab is shut: there is no server here but a
spreadsheet, and a spreadsheet does not wake up on the 14th. In practice
somebody opens the ledger most days, and a rule that has been waiting three
months writes all three the moment one of them does. Behind by more than a
year, it catches up twelve lines at a time and says so, rather than
unrolling two years of ledger in one go.

A rule kept in two places — set up on a laptop, then carried up to a sheet
too old to hold it — could write the same month twice. It doesn't: a line
already on the ledger for the same person, day, description and amount *is*
that line, and the rule steps over it.

## The days

Press your name on a day you were in. That is the whole of it — the card turns
green, the count goes up, and pressing it again takes it back off.

**It records days, not hours, and that is deliberate.** This used to be a clock:
a start, an end, and the minutes between. It measured the wrong thing. Nobody
here is paid by the hour, the ends were guessed at by whoever remembered to
press the button, and a shift left open overnight turned an ordinary day into
sixteen red hours that then had to be explained to somebody. What anyone
actually wanted off this board was who has been in, and on which days. A day is
the unit now, and the only unit: there is nothing finer to get wrong, and the
record cannot drift just because a tab got closed.

The card shows that person's days **this week**, always — the old board flipped
the same figure between a running timer and a weekly total depending on whether
somebody happened to be clocked in, so the number in that spot meant two
different things an hour apart. Underneath it is their all-time count, and
under the cards a bar per week for the last eight, stacked by person.

The **days on record** table is the second tab of the same view, and exports
to CSV separately from the money. It is behind a tab rather than under the
cards on purpose: it is the audit trail rather than the thing anybody opens
the page to do, and the cards already answer who has been in.

### Missed a day

**Missed a day?** under the cards takes a name and a date and marks it. With
hours this was impossible — you had to be at the keyboard to record anything —
but a day is different: you notice on Thursday that Tuesday was never marked,
and Tuesday is not in dispute. Without it the only fix is hand-editing the
sheet, which is how attendance stops being trustworthy.

The date cannot be in the future, and a day already marked says so rather than
writing a second row for it.

### Everybody's, or this browser's

On the shared sheet these are everybody's days: the page re-reads them every 30
seconds, so a name pressed in on somebody else's laptop turns green here without
anyone reloading. A tab in the background stops the re-reading — not worth doing
to a screen nobody is looking at — and catches up the instant it comes back to
the front.

On device storage they are only that browser's, and the line above the cards
says so rather than letting four empty cards read as four people who haven't
been in. The same line appears on a *shared* sheet whose deployed script is too
old to keep days, because that case looks identical and isn't: everything else
on the page is the team's, and these would silently be one phone's. It names the
redeploy that ends it.

Nothing ticks. There is no running number to move, so the only thing on a timer
is the date itself, checked once a minute — a page left open overnight would
otherwise go on offering to mark yesterday.

### When the sheet says no

Marking a day is idempotent on both sides: two people pressing the same name on
the same morning are not in conflict, they agree, and the answer either way is
that the day is recorded. Unmarking a day that isn't marked is the same.

What the sheet can still refuse is a name it doesn't carry or a date that hasn't
happened. **A refusal leaves the board live.** It says which press was turned
down and why, holds the synced stamp where it was, and re-reads the sheet so
anything out of date corrects itself. Only an endpoint that cannot be reached at
all takes the status light down and puts up the connection banner — the two used
to look identical, which made one refused press read as the whole board being
broken.

## The week

**The week** in the rail, under *The team*. Commits say what was pushed;
this is the half a commit log cannot tell you — the calls taken, the
campuses talked to, the thing that took three days and produced no code. A
few lines a week from each of them, so Arya can scroll one page instead of
asking four people what they have been up to.

Writing one is the top of the page rather than a button: pick your name,
type, press **Post the week** (or ⌘/Ctrl + Enter). Your name is remembered
on the device afterwards.

- **Links** are not a separate field. Paste them into what you are writing
  and they come out as links in the feed, stripped of their `https://www.`
  so a note stays readable.
- **Photos** — up to four a note. They are shrunk in the page the way a
  receipt is, then saved to the same shared Drive folder receipts go to, and
  the sheet holds the link. They appear as tiles rather than full-width
  photos, because a note with four screenshots should still be one note
  long. A Drive link is a viewer page, not an image file, which is the other
  reason they are tiles and not thumbnails.
- **Notes are grouped by the week they were posted into** — *This week*,
  *Last week*, then the date — newest first, so scrolling the feed is
  scrolling back through the weeks.
- The tabs across the top filter to one person. The count in the rail is
  how many have posted *this* week, out of five — the useful question on a
  Friday.
- Anybody in the console can delete any note, the same way anybody can
  delete any line of the ledger. The × is on hover.

The `posts` tab on the sheet:

| Column | Holds |
| --- | --- |
| `id` | 8 characters, generated server-side |
| `posted` | when it was written |
| `who` | whose note it is |
| `week` | the Monday of the week it was posted into, recomputed server-side |
| `body` | the note, up to 2,000 characters |
| `links` | the http(s) links found in the body, one per line |
| `photos` | the Drive links, one per line |

> **This one needs the Apps Script redeployed.** The feed is new actions on
> the same deployment as everything else, so until `fomo/setup/apps-script.gs`
> is pasted in again and deployed as a **new version**, the view says so in
> as many words rather than failing quietly. Deploy → Manage deployments →
> the pencil → New version. `doGet` reports `posts: true` once it has taken.

## What everyone's pushing

**Commits** in the rail. A GitHub-style contribution map — week columns, days down, the same green ramp
— for the team together and then one each. Above it: the quarter's total,
today's, and the busiest single day. Hovering a square names the day and its
count.

`GH_DEFAULTS` at the top of the pushing code holds the usernames already known,
so nobody has to type them on their own machine. The handles are not
printed anywhere on the page — the cards carry names and counts only, and the
fields that hold them sit behind **Manage accounts**, closed by default and
closed again on save.

> That is tidiness, not secrecy. `GH_DEFAULTS` lives in this page's source, and
> this repository is public, so anyone who opens either can read the handles.
> Treat them as public, because they are. They seed the fields on a first
visit only; once someone edits or clears one in their browser, that stands.
Anyone not listed shows a dash rather than a zero, and no caption: no username
means nothing was measured, which is not the same as having pushed nothing.

Each person's default is applied to a browser once, and once more if it later
changes. Seeding only browsers that had never opened the page was wrong — anyone
already using it kept the roster from their first visit, so a name added to
`GH_DEFAULTS` never reached them. A username somebody deliberately clears still
stays cleared, and picking up a new name drops the cached counts so the next read
includes them.

### Where the numbers come from

Each linked account's **public repositories** are listed, the ones pushed inside
the window are read, and their commits are counted by day.

The public events feed looked like the obvious source and was the wrong one. It
no longer carries commit counts, it stops at 300 events, and — the reason it had
to go — it never backfills: commits pushed while a repo was private stay missing
from it permanently. An intern who had just made their repo public read as a
flat zero while committing daily.

### Who does the reading

`/api/commits` does, and that is the whole reason the panel works for four
people instead of one. GitHub allows an anonymous caller **60 requests an hour
per IP** — not per site, per *network* — and one full refresh costs a repo
listing per account plus a page of commits per repo, call it forty. Four interns
on one office WiFi share one IP, so the second refresh of the hour came back 403
for everybody, which the panel drew as nothing at all.

The reads happen on the server now. One warm instance does them, the CDN hands
the same JSON to every browser, and a browser spends exactly **one** request on
the whole panel instead of forty. An office of four that used to cost 160
requests an hour against one IP now costs one refresh against the function's.

Two cases still read from the browser, on its own allowance, which is the right
size for one person asking about one name:

- **A username somebody typed into Manage accounts.** The server only knows the
  roster in its own `ROSTER`, which mirrors `GH_DEFAULTS`. A browser compares
  the handles it asked about against the `logins` the server says it read, and
  where they differ it does that person itself rather than showing somebody
  else's count under their name.
- **An endpoint that isn't answering.** The old path is still there and still
  correct; the panel falls back to it rather than going blank.

The status line under the panel says which of the two it was.

`GITHUB_TOKEN` is optional. Set it in the Vercel environment and the function's
own ceiling goes from 60 an hour to 5,000; leave it unset and the cache alone is
enough for a team this size. It is never sent to the browser. The panel must not
go dark because a token expired, which is why nothing depends on it.

Still no OAuth and no token in the page. Public commits need neither, and a token
in source this public would be a liability. The limits that come with that,
stated rather than papered over:

- **Private repositories are invisible.** Nothing counts until a repo is public,
  though making it public later does bring its whole history in.
- **Commits to someone else's repository don't count** — only repos one of the
  linked accounts owns.
- **A person can hold more than one account.** Jesse's repository is owned by one
  login while every commit in it is authored by another, so either name alone
  counts nothing. Separate them with a comma and both are read: repositories are
  taken from all of them, and a commit counts when its author is any of them.
- **Very long histories are a floor.** Six repos per account, twenty pages of
  commits each — two thousand per repo — and a ceiling on the reads any single
  refresh may spend, whatever it finds. A page is only asked for once the one
  before it came back full, so the cost follows what was actually pushed rather
  than the cap. Past any of the three the number carries a `+` and the footer
  says why, and more active repos than six does the same: a seventh left out of
  the count is a floor like any other. It was three pages until recently, which
  is three hundred commits, and a quarter's work in a single repo runs past
  that — the panel read `300+` while the true figure sat five commits above it.

Results cache in the browser for fifteen minutes and survive a reload —
failures included, so a mistyped username reads as a mistake rather than a quiet
zero. The server keeps its own ten-minute cache in front of that. If a limit is
hit anywhere the panel says so and names the minute it resets, rather than
showing a zero it cannot stand behind.

## The chapters

**Chapters** in the rail is the campus the bootcamp is selling to: every house
that has come through onboarding, where it is, how far it is toward the 80%
target. It is the one view that is not about the four of them or their money,
which is why it sits under its own heading rather than beside the ledger.

It reads `/api/campuswars` — the public projection of the campus admin — and not
the sheet. Nothing on it is typed in by hand, and nothing on it can be edited
here; the map, the counts and the table are recomputed from the feed every time
it loads, and again every two minutes while the tab is in front.

### One board, two places

The same board is also a page of its own at `/invoice/data/`, and both are the
same code: `invoice/chapters.js` holds the projection, the feed, the counting
and every panel, and `invoice/chapters.css` holds the styles. A host supplies
the chrome around it and calls `Chapters.markup(prefix)` then
`Chapters.mount(opts)`. **Fix a miscount in `chapters.js` and both are fixed.**

Two details are what make one file serve both:

- **Every id carries a prefix.** The console already owns a `#tbody`, a
  `#live-txt` and a `#foot-count`, and a second set under the same names would
  have the two boards writing into each other. The console mounts with `ch-`;
  the standalone page, having nothing to collide with, mounts with none.
- **Every style is scoped to `.chapters`.** The console also owns `.panel`,
  `.pill`, `.row` and a bare `table`, and they mean different things there.
  Unscoped, the stylesheet would repaint half the ledger.

The board is fetched **the first time somebody opens the view**, not on load.
The map data alone is most of a hundred kilobytes, and the ledger — which is
what the console is opened for — should not wait on it to draw.

### Adding a school

`SCHOOLS` at the top of `chapters.js`: name, latitude, longitude, state. The
feed names schools but does not place them, and no geocoder is called from the
page — a map that silently drops a house because a lookup failed is worse than
one that says which houses it could not place. Anything missing from that table
is still counted, still in every total, and named under the map.

## Applicants, and who is on which campus

Two views under **The campus**, and two tabs of the same sheet the ledger is
on. They are read through the same Apps Script deployment, so there is nothing
new to deploy and nothing new to configure — but the script does have to be the
*current* one. A deployment that predates them answers a list without the
campus tables in it, and both views say so in as many words, naming the redeploy
rather than sitting there empty.

**Applicants** is the `apply` tab, read rather than copied: an application is on
the board the moment it lands. Sub-tabs for *everyone / still open / hired /
passed*, filters for seat and campus, and a search that reaches into the long
answers as well as the names. Clicking a row opens the whole application beside
the table — both essay answers, the socials, the portfolio link, and anything
the form has gained since — with the two things the team writes back: where it
has got to, and what the team thinks. Nobody is emailed by any of it.

**Campus team** is the `campus_team` tab, grouped the way the question is
usually asked: which states are we on, which campuses in them, and who is on
each. The rail across the top counts the interns, the campuses, the states and
the seats filled out of five per campus. **Add an intern** writes a row by hand;
the filter defaults to the people on a campus *now*, so alumni stay on the sheet
without crowding the board.

### Hiring somebody off an application

**Put them on a campus →**, on an open application, takes you to the roster form
with their name, email, phone, seat and campus already in it — and the state
guessed from the campus where the name is one the board already knows. Saving it
is **one call**: the roster row and the `hired` on their application are written
together or not at all. A roster row nobody is running, or an application
reading *hired* with nobody on the campus, is worse than a refusal.

The row remembers which application it came from, so the same person cannot be
hired onto a second campus by accident, and taking them off the roster later
leaves their application exactly as it was.

## Changing the team

`PEOPLE` at the top of the page's script, and `INVOICE_PEOPLE` in the Apps
Script, are the same four names. Change both — the endpoint refuses a name it
doesn't recognise, on a spend and on a day alike.
