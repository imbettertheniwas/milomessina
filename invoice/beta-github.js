// Public activity only. Counts exclude private repos, forks and other owners'
// repos, and are never used as a substitute for an intern's written recap.
const FRESH_MS = 10 * 60 * 1000;
const MAX_REPOS = 6, MAX_PAGES = 20, MAX_DETAILS = 40;
const cache = new Map();
let sharedSnapshot = null, sharedSnapshotAt = 0;
const day = value => new Date(value).toISOString().slice(0, 10);
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && day(value) === value;
const scope = 'Public authored commits in owned, non-fork repositories. Private work and work in other owners’ repositories are not included.';

export function betaGithubUsername(value) {
  let name = String(value || '').trim().replace(/^@/, '');
  if (/^https?:\/\//i.test(name)) {
    try {
      const url = new URL(name);
      if (url.hostname.toLowerCase() !== 'github.com' || url.search || url.hash) return '';
      name = url.pathname.replace(/^\/+|\/+$/g, '');
    } catch { return ''; }
  }
  return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(name) ? name : '';
}

function windowFor({startDate, endDate, now = Date.now} = {}) {
  const today = day(typeof now === 'function' ? now() : now);
  if (!validDay(startDate) || !validDay(endDate) || startDate > endDate)
    throw new Error('Choose a valid GitHub activity date range.');
  return {startDate, endDate, throughDate: endDate < today ? endDate : today, ongoing: endDate >= today};
}

export function betaGithubInitial(members, options) {
  const range = windowFor(options);
  return members.map(member => {
    const raw = member.github || member.githubUsername || '';
    const username = betaGithubUsername(raw);
    const status = !raw ? 'missing' : !username || range.startDate > range.throughDate ? 'error' : 'loading';
    const message = !raw ? 'No GitHub username linked.' : !username ? 'Check the GitHub username.' :
      range.startDate > range.throughDate ? 'This activity period has not started yet.' : 'Loading public commits…';
    return {memberId: member.id || member.memberId, name: member.name || '', username, status,
      total: null, days: {}, commits: [], updatedAt: null, partial: false, reasons: [],
      source: null, profileUrl: username ? 'https://github.com/' + encodeURIComponent(username) : '',
      scope, message, ...range};
  });
}

function projectFeed(person, snapshot, state, now) {
  if (!person || person.error || !Array.isArray(person.logins) || person.logins.length !== 1 ||
    String(person.logins[0]).toLowerCase() !== state.username.toLowerCase()) return null;
  const stamp = Date.parse(snapshot.updatedAt), from = String(snapshot.since || '').slice(0, 10);
  if (!Number.isFinite(stamp) || stamp > now + 60000 || now - stamp > FRESH_MS ||
    !validDay(from) || from > state.startDate || day(stamp) < state.throughDate ||
    !person.days || typeof person.days !== 'object') return null;
  const days = {}, commits = [];
  for (const [date, count] of Object.entries(person.days)) {
    if (!validDay(date) || !Number.isSafeInteger(count) || count < 0) return null;
    if (date >= state.startDate && date <= state.throughDate) days[date] = count;
  }
  for (const [date, entries] of Object.entries(person.commitsByDay || {})) {
    if (date < state.startDate || date > state.throughDate || !Array.isArray(entries)) continue;
    for (const entry of entries) {
      const clean = commitDetail(entry, state);
      if (clean) commits.push(clean);
    }
  }
  return counted(state, {days, commits, updatedAt: snapshot.updatedAt, source: 'shared',
    reasons: person.truncated ? ['The shared counter reached a repository or request limit.'] : []});
}

function commitDetail(entry, state) {
  const stamp = Date.parse(entry.date);
  if (!Number.isFinite(stamp) || day(stamp) < state.startDate || day(stamp) > state.throughDate ||
    !/^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(String(entry.repo || '')) || !/^[a-f\d]{7,64}$/i.test(String(entry.sha || ''))) return null;
  return {sha: entry.sha, repo: entry.repo, message: String(entry.message || '').split('\n')[0].slice(0, 240),
    date: new Date(stamp).toISOString(), url: 'https://github.com/' + entry.repo + '/commit/' + entry.sha};
}

function counted(state, data) {
  const total = Object.values(data.days).reduce((sum, count) => sum + count, 0);
  const reasons = [...new Set(data.reasons || [])];
  const partial = reasons.length > 0;
  const commits = data.commits.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_DETAILS);
  return {...state, ...data, total, commits, partial, reasons, status: partial ? 'partial' : 'ready',
    detailsLimited: commits.length < total,
    message: partial ? reasons.join(' ') : total ? 'Public commits loaded.' : 'No public commits found in this period.'};
}

async function directRead(state, context) {
  const {fetchImpl, signal, budget, now} = context;
  const days = {}, commits = [], reasons = [], seen = new Set();
  let successfulPages = 0;
  async function get(path) {
    if (budget.left <= 0) throw new Error('The batch reached its public GitHub request limit. Try again later.');
    budget.left--;
    const response = await fetchImpl('https://api.github.com' + path,
      {headers: {Accept: 'application/vnd.github+json'}, signal});
    if (response.status === 404) throw new Error('GitHub could not find this account or repository. Check the linked username.');
    if (response.status === 403 || response.status === 429) throw new Error('GitHub is limiting requests from this network. Try again later.');
    if (response.status === 409 && path.startsWith('/repos/')) return [];
    if (!response.ok) throw new Error('GitHub activity is unavailable right now.');
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error('GitHub returned an unreadable response.');
    return result;
  }
  const listing = await get('/users/' + encodeURIComponent(state.username) + '/repos?per_page=100&sort=pushed&type=owner');
  if (listing.some(repo => !repo || typeof repo.private !== 'boolean' || typeof repo.fork !== 'boolean' ||
    !/^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(String(repo.full_name || '')) ||
    (repo.pushed_at !== null && !Number.isFinite(Date.parse(repo.pushed_at)))))
    throw new Error('GitHub returned unreadable repository information.');
  if (listing.length >= 100) reasons.push('Only the first 100 owned repositories were checked.');
  const repos = listing.filter(repo => repo && !repo.private && !repo.fork &&
    /^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(String(repo.full_name || '')) &&
    typeof repo.pushed_at === 'string' && repo.pushed_at >= state.startDate);
  if (repos.length > MAX_REPOS) reasons.push('Only the six most recently pushed repositories were checked.');
  try {
    for (const repo of repos.slice(0, MAX_REPOS)) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const entries = await get('/repos/' + repo.full_name + '/commits?since=' +
          encodeURIComponent(state.startDate + 'T00:00:00Z') + '&per_page=100&page=' + page);
        successfulPages++;
        for (const entry of entries) {
          if (String(entry.author?.login || '').toLowerCase() !== state.username.toLowerCase()) continue;
          const detail = commitDetail({sha: entry.sha, repo: repo.full_name, message: entry.commit?.message, date: entry.commit?.author?.date}, state);
          if (!detail || seen.has(detail.repo + ':' + detail.sha)) continue;
          seen.add(detail.repo + ':' + detail.sha);
          const date = day(detail.date);
          days[date] = (days[date] || 0) + 1;
          commits.push(detail);
        }
        if (entries.length < 100) break;
        if (page === MAX_PAGES) reasons.push('A repository reached the commit-page limit.');
      }
    }
  } catch (error) {
    if (error.name === 'AbortError' || !successfulPages) throw error;
    reasons.push(error.message);
  }
  return counted(state, {days, commits, reasons, source: 'github', updatedAt: new Date(now()).toISOString()});
}

// Calls are sequential and share a request allowance across the whole batch.
// The cache holds public counts only and never persists member data to disk.
export async function loadBetaGithub(members, {startDate, endDate, fetchImpl = globalThis.fetch,
  onProgress, signal, now = Date.now, maxReads = 40, force = false} = {}) {
  const states = betaGithubInitial(members, {startDate, endDate, now});
  const cacheKey = state => [state.username.toLowerCase(), state.startDate, state.throughDate].join('|');
  const liveFetch = fetchImpl === globalThis.fetch;
  // A ready in-memory result should not wait for a network request before
  // it can be used. In particular, selecting/searching the manager roster
  // often asks for the same public activity again.
  if (liveFetch && !force) states.forEach((state, index) => {
    const cached = state.status === 'loading' && cache.get(cacheKey(state));
    if (cached && now() - Date.parse(cached.updatedAt) < FRESH_MS) states[index] = {...state, ...cached};
  });
  const publish = () => { if (typeof onProgress === 'function') onProgress(states.slice()); };
  publish();
  if (!states.some(state => state.status === 'loading')) return states;
  let snapshot = liveFetch && !force && now() - sharedSnapshotAt < 60000 ? sharedSnapshot : null;
  if (!snapshot) {
    try {
      const response = await fetchImpl('/api/commits', {cache: 'no-store', signal});
      if (response.ok) {
        snapshot = await response.json();
        if (liveFetch && snapshot) { sharedSnapshot = snapshot; sharedSnapshotAt = now(); }
      }
    } catch (error) { if (error.name === 'AbortError') throw error; }
  }
  const budget = {left: Math.max(1, Math.min(48, Math.floor(maxReads) || 40))};
  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    if (state.status !== 'loading') continue;
    const key = cacheKey(state);
    // Injected fetchers are isolated so tests and local previews never reuse
    // a real response, or make a mock response appear to be live.
    const cached = liveFetch && !force && cache.get(key);
    try {
      if (cached && now() - Date.parse(cached.updatedAt) < FRESH_MS) {
        states[i] = {...state, ...cached};
      } else {
        const person = Object.values(snapshot?.people || {}).find(person =>
          person?.logins?.length === 1 && String(person.logins[0]).toLowerCase() === state.username.toLowerCase());
        states[i] = projectFeed(person, snapshot || {}, state, now()) || await directRead(state, {fetchImpl, signal, budget, now});
        if (fetchImpl === globalThis.fetch && states[i].status === 'ready') {
          if (cache.size >= 100) cache.delete(cache.keys().next().value);
          const {days, commits, total, updatedAt, partial, status, reasons, message, source, detailsLimited} = states[i];
          cache.set(key, {days, commits, total, updatedAt, partial, status, reasons, message, source, detailsLimited});
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      states[i] = {...state, status: 'error', message: error.message || 'Public GitHub activity could not be loaded.'};
    }
    publish();
  }
  return states;
}
