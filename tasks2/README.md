# Campus tasks, bound

`/tasks2` is the book edition of `/tasks`. It uses the same accounts, sessions, backend and task data, so a member who signs in at one URL is signed in at the other.

`node tasks2/build.mjs` generates `index.html` from the same `offers.json`, `companies.json` and `icons.json` as `/tasks`.

## Pages

Signed out, the book is a contents page and the sign-in page. Signed in:

- Pages 0–1: contents (your campus, every task with its status) and the $100 bonus with the LinkedIn preview.
- Then one spread per task: the task on the left (what you get, the pitch, the checklist) and its submission on the right (one review box per step, files, notes). The referral is the last spread.

Contents rows expand to show the task's reward, with a button to its page. Under 820px wide the book shows one page at a time and opens straight to sign-in when signed out.

## book.js

- Turning: arrow keys, dragging a page edge, swiping on touch screens, the side tabs, the pager on phones, or clicking empty space on a page (left page or left half goes back, right goes forward).
- Resizing: drag the round handle on the book's corner (arrow keys work on it; double-click resets), the − / + buttons, or the - and = keys. The size changes the real page dimensions, so text reflows.
- The mug, notepad and pad can be dragged around the desk. Double-click one to put it back.
- Book size and object positions are saved in this browser only (`tasks2-book-zoom`, `tasks2-desk-v1`).

## Shared modules

`tasks.js` and the other modules are copies of the `/tasks` versions. The only change: the sign-in dialog opens in place on the page (`dialog.show()`), not as a modal, and task cards are spreads instead of collapsible cards. Logic changes made to `/tasks` modules need to be copied here too. Assets and fonts load from `/tasks/assets`.
