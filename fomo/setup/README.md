# Taking the fomo forms live

Right now `/fomo/apply`, `/fomo/submit` and `/fomo/report` validate, then tell
the person plainly that there is nowhere to deliver to yet. Nothing is
silently dropped. These nine steps give all three a real destination: rows in
a Google Sheet you own.

You do steps 1–8 once, in your own Google account. Nobody else needs an
account to apply — the forms stay public.

---

**1. Make the sheet.** Go to [sheets.new](https://sheets.new) and name it
something like `fomo campus — submissions`. Leave it empty; the script builds
its own tabs and headers.

**2. Open the script editor.** In that sheet: **Extensions → Apps Script**.

**3. Paste the code.** Delete whatever is in `Code.gs` and paste the whole of
[`apps-script.gs`](apps-script.gs) in its place.

**4. Fill in CONFIG** at the top. Leave `SHEET_ID` blank — the script is
inside the sheet, so it already knows. Put your address in `NOTIFY_EMAIL` if
you want a mail on every submission. `SHARED_SECRET` is optional; see step 9.

> **If Extensions → Apps Script won't open** — it throws "Sorry, unable to
> open the file at this time" for some accounts — you don't need a bound
> script. Go to [script.google.com/home](https://script.google.com/home) →
> **New project**, paste the code there, and set `SHEET_ID` in CONFIG to the
> long id out of your sheet's URL, the part between `/d/` and `/edit`. Then
> carry on from step 5; nothing else changes. A standalone script writes into
> the sheet by id, so update `SHEET_ID` if you ever rebuild the sheet.

**5. Save**, then **Deploy → New deployment**. Click the gear next to "Select
type" and choose **Web app**.

**6. Set the two dropdowns** — this is the step everything hinges on:

| Field | Set it to |
| --- | --- |
| Execute as | **Me** |
| Who has access | **Anyone** |

"Anyone" — *not* "Anyone with a Google account". Applicants aren't signed in
to Google, and that second option turns their submission into a login page.

**7. Authorise it.** Google will warn you the app is unverified because you
just wrote it. **Advanced → Go to (project name)** → **Allow**. It needs your
sheet (to write rows), Drive (to store report uploads) and Gmail (only if you
set `NOTIFY_EMAIL`).

**8. Copy the Web app URL.** It ends in `/exec`. Paste it into
[`fomo/assets/form.js`](../assets/form.js), line 20:

```js
const ENDPOINT = 'https://script.google.com/macros/s/AKfy…/exec';
```

Deploy the site, submit one test application, and check the sheet. That's it.

**9. Optional — a turnstile.** Pick any string, put it in `SHARED_SECRET` in
the script *and* in `FORM_KEY` in `form.js`, and the endpoint ignores POSTs
that don't carry it. It travels in the page source, so it stops bots hitting
the URL directly; it is not a password.

---

## What lands where

Each form writes to its own tab, named after its URL:

| Tab | From | Holds |
| --- | --- | --- |
| `apply` | `/fomo/apply` | Seat, name, email, university, grad year, socials, both long answers, hours, the two confirmations |
| `submit` | `/fomo/submit` | Video URL, platform, post date, handle, payout details, the four rule checkboxes |
| `report` | `/fomo/report` | School, name, seat, week, and a link to the uploaded file |

Every row starts with `received` (server time) and `page`. Add a field to any
form's HTML and the script adds the column on the next submission — you never
edit the sheet by hand.

`/fomo/onboard` posts the same way, into an `onboard` tab — but the receiver
only accepts the three above, so it is answered with `unknown form` and nothing
is kept. Adding `'onboard'` to `FORM_INBOX` near the top of the script and
redeploying is the whole fix; `/internal`'s **Portals** view shows it as a door
with no inbox until then.

All three tabs are readable from `/internal`'s **Portals** view, which is where
`submit` and `report` are read from — they have no view of their own. It only
ever reads: no columns added, no tabs built, every cell matched to the header
above it. Arya and Milo only, because the rows hold payout handles and phone
numbers.

The internal console at `/internal` reads the `apply` tab as its **Applicants**
view, and adds four columns of its own on the far right of it — `id`, `status`,
`team notes` and `decided` — without touching the form's own. Hiring somebody
there writes them into a `campus_team` tab, which the script builds on the first
hire. Both are the same deployment as the forms: nothing extra to set up, but a
script pasted without a redeploy leaves those two views saying so.

Report uploads go to a Drive folder called **fomo campus — report uploads**,
private to your account. The sheet stores the link, not the file.

Spam gets a hidden field no human can see. If anything is typed into it, the
script answers normally and writes nothing.

## When something breaks

The form never claims to have sent. If a submission fails the person sees why,
their answers stay in the fields, and they can retry.

- **"Sorry, unable to open the file at this time"** — Google could not resolve
  the address under the account it thinks you are. Nearly always more than one
  Google account signed in at once.
  - *At step 2 (Extensions → Apps Script).* Find the index in your sheet's own
    URL — `docs.google.com/spreadsheets/u/1/d/…` means index 1 — and put the
    same one into the failed address: `script.google.com/u/1/home/projects/…`.
    No `/u/N/` in the sheet URL means index 0, so this is not the cause. The
    blunt alternative is an incognito window signed into one account only.
  - *At step 8 (opening the `/exec` URL).* Try it in incognito, which is the
    state an applicant is in. Works there? Nothing is wrong — paste the URL
    into `ENDPOINT` and carry on. Fails there too? You copied the Deployment ID
    rather than the Web app URL, or "Select type" was not set to **Web app**.
  - *Signed into only one account and it still fails.* An ad blocker or privacy
    extension is blocking `script.google.com`, or the account is a school or
    work one whose admin has Apps Script switched off. A personal `@gmail.com`
    account avoids both; the sheet can be shared with anyone afterwards.
- **"the endpoint answered, but not with a confirmation"** — "Who has access"
  is not set to **Anyone**. Redeploy (step 6).
- **"the sheet answered HTTP 401/403"** — the deployment was never authorised.
  Redo step 7.
- **Changed the script and nothing changed?** Apps Script serves the last
  *deployed* version, not the saved one. **Deploy → Manage deployments →**
  pencil icon **→ Version: New version → Deploy**. The `/exec` URL stays the
  same.
- **Nothing at all happens on submit** — open the browser console. If the error
  mentions CORS, the URL in `ENDPOINT` is probably the `/dev` one. It must end
  in `/exec`.

## Limits

Free Google accounts allow roughly 20,000 script calls and 100 emails a day —
far past anything these forms will see. Uploads are capped at 10MB in the
browser before they're ever sent.
