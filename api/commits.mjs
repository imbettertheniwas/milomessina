import {createHash} from 'node:crypto';

/* ══════════════════════════════════════════════════════════════════════
   public commit counts, read once for everybody

   The console used to read GitHub straight from the browser. That worked
   for one person and quietly failed for a team: GitHub allows an
   anonymous caller 60 requests an hour **per IP**, and a refresh costs a
   repo listing per account plus a page of commits per repo — call it
   forty. Four interns on one office network share one IP, so the second
   refresh of the hour is the one that starts returning 403, and the panel
   reads as empty rather than as rate-limited.

   Moving the reads here fixes the arithmetic rather than hiding it. One
   warm instance does the work, the CDN hands the same JSON to everyone,
   and a browser spends exactly one request on the whole panel. Where an
   office of four used to cost 160 requests an hour against one IP, it now
   costs one refresh against this function's.

   GITHUB_TOKEN, if it is set in the environment, raises this function's
   own ceiling from 60 to 5,000 an hour. It is optional on purpose: the
   cache alone is enough for a team this size, and nothing here is
   private, so the panel must not go dark because a token expired. The
   token is never sent to the browser.
   ══════════════════════════════════════════════════════════════════════ */

const WEEKS = 13;
const FRESH_MS = 10 * 60 * 1000;    // a warm instance re-reads this often
const STALE_MS = 6 * 60 * 60 * 1000; // past this, an old answer is no answer
const RETRY_MS = 30 * 1000, MAX_RETRY_MS = 10 * 60 * 1000;
const MAX_REPOS = 6, MAX_PAGES = 20, MAX_READS = 60;

/* The roster the console ships with. A caller may ask for different
   handles, but only these are cached and only these are read without one:
   an open proxy onto GitHub's API is not what this is for. */
const ROSTER = {
  Milo:  ['koolkid696969'],
  Bijan: ['Code-Atreides'],
  Jesse: ['jsebaiz', 'jessebaiz'],
  Luchi: ['ouchip']
};

function dayKey(d){
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' +
         String(d.getUTCDate()).padStart(2,'0');
}

/* The window the console draws: the Sunday that opens the first of WEEKS
   weeks. Computed in UTC here and in local time in the browser, which can
   put the boundary a day apart — harmless, because the browser only ever
   reads days it asked for and an extra day at the far edge is dropped. */
function since(now){
  const d = new Date(now);
  d.setUTCHours(0,0,0,0);
  d.setUTCDate(d.getUTCDate() - (WEEKS * 7 - 1));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString();
}

export function createCommitHandler({fetchImpl=fetch, now=Date.now, env=process.env}={}){
  let latest = null, pending = null, retryAt = 0, failures = 0, lastError = 'unknown';

  function headers(){
    const h = {'Accept':'application/vnd.github+json','User-Agent':'fomo-bootcamp-console'};
    if (env.GITHUB_TOKEN) h.Authorization = 'Bearer ' + env.GITHUB_TOKEN;
    return h;
  }

  async function gh(url, budget){
    if (budget.reads >= MAX_READS) { budget.truncated = true; return null; }
    budget.reads++;
    const res = await fetchImpl(url, {headers: headers()});
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const err = new Error('rate-limited');
      err.resetAt = reset || 0;
      throw err;
    }
    if (res.status === 404) return null;         // no such user, or an empty repo
    if (res.status === 409) return null;         // an empty repository
    if (!res.ok) throw new Error('GitHub answered ' + res.status);
    return res.json();
  }

  /* One person: their owned repos pushed inside the window, then the
     commits in each authored by any of their logins. Commits to somebody
     else's repository are invisible here, exactly as they were in the
     browser — this moved where the reads happen, not what they count. */
  async function readPerson(logins, from, budget){
    const set = {}, days = {};
    logins.forEach(l => { set[l.toLowerCase()] = true; });
    const repos = [], seen = {};
    for (const login of logins) {
      const list = await gh('https://api.github.com/users/' + encodeURIComponent(login) +
                            '/repos?per_page=100&sort=pushed&type=owner', budget);
      if (!Array.isArray(list)) continue;
      for (const r of list) {
        if (!r || r.fork || !r.pushed_at || r.pushed_at < from) continue;
        if (seen[r.full_name]) continue;
        seen[r.full_name] = true; repos.push(r);
      }
    }
    const live = repos.slice(0, MAX_REPOS);
    let truncated = repos.length > live.length;
    for (const repo of live) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const list = await gh('https://api.github.com/repos/' + repo.full_name + '/commits?since=' +
                              encodeURIComponent(from) + '&per_page=100&page=' + page, budget);
        if (!Array.isArray(list)) break;
        for (const c of list) {
          const when = c?.commit?.author?.date;
          const by = (c?.author?.login || '').toLowerCase();
          if (!when || !by || !set[by]) continue;
          const k = dayKey(new Date(when));
          days[k] = (days[k] || 0) + 1;
        }
        if (list.length < 100) break;
        if (page === MAX_PAGES || budget.reads >= MAX_READS) truncated = true;
      }
      if (budget.reads >= MAX_READS) { truncated = true; break; }
    }
    /* the logins these counts were actually read from, so a browser whose
       "Manage accounts" names differ can tell and read those itself */
    return {logins, days, truncated: truncated || budget.truncated, repos: live.length};
  }

  async function refresh(){
    pending ??= (async () => {
      const from = since(now());
      const people = {}, budget = {reads: 0, truncated: false};
      for (const [who, logins] of Object.entries(ROSTER)) {
        try { people[who] = await readPerson(logins, from, budget); }
        catch (e) {
          people[who] = {logins, error: e.message === 'rate-limited'
            ? 'GitHub is rate limiting this server' + (e.resetAt
                ? ' — it clears at ' + new Date(e.resetAt).toISOString().slice(11,16) + ' UTC' : '')
            : e.message};
        }
      }
      const answered = Object.values(people).some(p => !p.error);
      if (!answered) throw new Error(Object.values(people)[0]?.error || 'GitHub did not answer');
      const snapshot = {since: from, weeks: WEEKS, people,
                        updatedAt: new Date(now()).toISOString(),
                        authenticated: !!env.GITHUB_TOKEN};
      const body = JSON.stringify(snapshot);
      latest = {snapshot, body, at: now(),
                etag: `W/"${createHash('sha256').update(body).digest('base64url')}"`};
      failures = 0; retryAt = 0;
    })().catch(error => {
      lastError = error.message || 'unknown';
      retryAt = now() + Math.min(MAX_RETRY_MS, RETRY_MS * 2 ** Math.min(failures++, 4));
    }).finally(() => { pending = null; });
    return pending;
  }

  return async function handler(req, res){
    res.setHeader('X-Content-Type-Options','nosniff');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow','GET, HEAD');
      return res.status(405).json({error:'Method not allowed'});
    }

    const started = now();
    let cache = 'HIT';
    if (!latest || now() - latest.at >= FRESH_MS) {
      cache = pending ? 'COALESCED' : now() < retryAt ? 'BACKOFF' : 'REFRESH';
      if (pending) await pending;
      else if (now() >= retryAt) await refresh();
    }
    res.setHeader('Server-Timing', `commits;dur=${Math.max(0, now()-started)};desc="${cache}"`);

    if (!latest) {
      res.setHeader('Cache-Control','no-store');
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((retryAt - now())/1000))));
      return res.status(503).json({error:'Commit counts are temporarily unavailable', detail:lastError});
    }

    const age = now() - latest.at;
    /* An old count is still a true count of an older moment, and the panel
       says when it was taken. Only past STALE_MS is it worth nothing. */
    if (age >= STALE_MS) {
      res.setHeader('Cache-Control','no-store');
      return res.status(503).json({error:'Commit counts are stale', detail:lastError});
    }

    const ttl = Math.max(30, Math.floor((FRESH_MS - Math.min(age, FRESH_MS))/1000));
    res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=600`);
    res.setHeader('X-Commits-Cache', cache);
    res.setHeader('ETag', latest.etag);
    res.setHeader('Content-Type','application/json; charset=utf-8');

    const tags = String(req.headers?.['if-none-match'] || '').split(',');
    if (tags.some(t => t.trim() === '*' || t.trim().replace(/^W\//,'') === latest.etag.replace(/^W\//,'')))
      return res.status(304).end();

    res.status(200);
    return req.method === 'HEAD' ? res.end() : res.end(latest.body);
  };
}

export default createCommitHandler();
