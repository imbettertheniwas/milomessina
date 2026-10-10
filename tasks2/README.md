# Campus tasks, bound

`/tasks2` is the book edition of `/tasks`. It uses the same accounts, sessions, backend and task data, so a member who signs in at one URL is signed in at the other.

`node tasks2/build.mjs` generates `index.html` from the same `offers.json`, `companies.json` and `icons.json` as `/tasks`. Every page is one chapter: contents, your campus, the five tasks, the $100 bonus, referrals, begin, a colophon and the end.

- `book.js` runs the book: the cover, page turns (arrow keys, dragging a page edge, the side tabs and the contents), the pencil that writes "start here" on first open, and the status shown beside each chapter in the contents.
- `tasks.js` and the other modules are copies of the `/tasks` versions. The only change: the sign-in dialog opens in place on the page (`dialog.show()`), not as a modal, and task cards are pages instead of collapsible cards.
- Assets and fonts load from `/tasks/assets`.

Logic changes made to `/tasks` modules need to be copied here too.

Under 820px wide the book shows one page at a time.
