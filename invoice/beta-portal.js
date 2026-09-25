import {loadBetaGithub, betaGithubInitial} from './beta-github.js';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyeQIRm2DezB1fYi0B03pnbuorco5eQAAJtxioVClgB4xyMVWGlvVmAFQqFdwbI3UnZfA/exec';
const SESSION_KEY = 'fomo.beta.session';
const ACCESS_KEY = 'fomo.beta.access';
const JOIN_KEY = 'fomo.beta.pendingJoins';
const BETA_SETUP_MESSAGE = 'Beta access is not available yet. Ask Arya to finish setup.';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
let token = '', workspace = null, busy = false, generation = 0, invite = '', inviteBatch = null;
let recapDraft = null, githubStates = [], githubKey = '', githubGeneration = 0, accessCapability = '', showReturnLink = false, attendanceDay = '';
let joinStep = 0, gateBusy = false;
function savedSession() { try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; } }
function forgetSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {} }
function sessionAccess() { try { return sessionStorage.getItem(ACCESS_KEY) || ''; } catch (_) { return ''; } }
function savedAccess() { const paired = sessionAccess(); if (paired) return paired; try { return localStorage.getItem(ACCESS_KEY) || ''; } catch (_) { return ''; } }
function rememberIdentity(session, access) {
  try { sessionStorage.setItem(SESSION_KEY, session); } catch (_) {}
  if (access) { try { localStorage.setItem(ACCESS_KEY, access); } catch (_) {} try { sessionStorage.setItem(ACCESS_KEY, access); } catch (_) {} }
}
function forgetIdentity() {
  try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(ACCESS_KEY); } catch (_) {}
  try { localStorage.removeItem(ACCESS_KEY); } catch (_) {}
}
let pendingJoins = {};
try { const stored = JSON.parse(sessionStorage.getItem(JOIN_KEY) || '{}'); if (stored && typeof stored === 'object' && !Array.isArray(stored)) pendingJoins = stored; } catch (_) {}
function writePendingJoins() { try { sessionStorage.setItem(JOIN_KEY, JSON.stringify(pendingJoins)); } catch (_) {} }
function pendingJoin(invitation) {
  const pending = pendingJoins[invitation];
  return pending && /^[a-f0-9]{32}$/.test(pending.joinRequest || '') && pending.fields && ['name','email','phone','github'].every(key => typeof pending.fields[key] === 'string') ? pending : null;
}
function joinFields() { return Object.fromEntries(['name','email','phone','github'].map(key => [key, $('beta-join-' + key).value.trim()])); }
function restoreJoinFields(fields) { ['name','email','phone','github'].forEach(key => { $('beta-join-' + key).value = fields[key] || ''; }); }
function makeJoinAttempt(invitation, fields) {
  const previous = pendingJoin(invitation);
  if (previous) return previous;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const pending = {joinRequest: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''), fields: {...fields}};
  pendingJoins[invitation] = pending; writePendingJoins(); return pending;
}
function clearJoinAttempt(invitation) { delete pendingJoins[invitation]; writePendingJoins(); }
function returnLink(access = accessCapability) { return access ? location.origin + '/internal/beta#access=' + encodeURIComponent(access) : ''; }
function clearRouteFragment() { history.replaceState(null, '', location.pathname + location.search); invite = ''; inviteBatch = null; }
function validIdentity(out, session) { return out?.beta === true && typeof session === 'string' && Boolean(session) && Boolean(out.member?.id); }
const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return get('year') + '-' + get('month') + '-' + get('day');
};
const allowed = module => workspace && workspace.permissions.includes(module);
function dateLabel(value, withTime = false) {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value);
  if (!Number.isFinite(date.getTime())) return '';
  const options = {month: 'short', day: 'numeric'};
  if (withTime) Object.assign(options, {hour: 'numeric', minute: '2-digit'});
  else if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
  return date.toLocaleString(undefined, options);
}
function batchDays() {
  const start = new Date(workspace.batch.startDate + 'T12:00:00Z');
  const end = new Date(workspace.batch.endDate + 'T12:00:00Z');
  const days = [];
  for (let value = +start; value <= +end && days.length < 31; value += 86400000) days.push(new Date(value).toISOString().slice(0, 10));
  return days;
}
function setError(message = '') { $('beta-error').textContent = message; $('beta-error').hidden = !message; }
function setBusy(value, preserveEditor = false) {
  busy = value; $('beta-refresh').disabled = value;
  $('beta-refresh').textContent = value ? 'Updating…' : 'Refresh';
  $('beta-sections').querySelectorAll('select, textarea, input, button').forEach(element => { element.disabled = value && !(preserveEditor && element.matches('#beta-recap-form textarea')); });
  $('beta-main').setAttribute('aria-busy', String(value));
}
function setGateBusy(value, message = '') {
  gateBusy = value;
  $('beta-join-form').querySelectorAll('input,button').forEach(element => { element.disabled = value; });
  $('beta-join').textContent = value ? message || 'Opening…' : 'Join this group ↗';
}
function setJoinStep(step, focus = true) {
  joinStep = step;
  ['beta-join-welcome', 'beta-join-details', 'beta-join-review'].forEach((id, index) => { $(id).hidden = index !== step; });
  $('beta-join-progress').querySelectorAll('li').forEach((item, index) => {
    item.classList.toggle('completed', index < step);
    if (index === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
  });
  const titles = ['Arya’s two-week beta internship.', 'Let’s get to know you.', 'You’re ready to join.'];
  const intros = ['A small group, two weeks, and room to build. Here’s how your beta internship works.', 'Add your contact details and the GitHub account you’ll use for your internship projects.', 'Check your details below. Your place in the group is saved when you join.'];
  $('beta-gate-eyebrow').textContent = 'Step ' + (step + 1) + ' of 3';
  $('beta-gate-title').textContent = titles[step];
  $('beta-gate-intro').textContent = intros[step];
  $('beta-login-error').textContent = '';
  if (step === 2) {
    $('beta-review-details').innerHTML = [['Name', 'name'], ['Email', 'email'], ['Phone', 'phone'], ['GitHub', 'github']].map(([label, field]) => '<div><dt>' + label + '</dt><dd>' + esc((field === 'github' ? '@' : '') + $('beta-join-' + field).value.trim()) + '</dd></div>').join('');
  }
  if (focus) $('beta-gate-title').focus({preventScroll: false});
}
function setGateMode(mode) {
  const joining = mode === 'join' && Boolean(invite);
  $('beta-join-form').hidden = !joining; $('beta-join-progress').hidden = !joining;
  $('beta-invite-needed').hidden = joining;
  if (joining) setJoinStep(joinStep, false);
  else {
    $('beta-gate-eyebrow').textContent = 'Two weeks to learn and build';
    $('beta-gate-title').textContent = 'Arya’s two-week beta internship.';
    $('beta-gate-intro').textContent = 'Join a small group, track your attendance, build public internship projects on GitHub, and share what you learned at the end.';
  }
}
function validateJoinDetails() {
  const phone = $('beta-join-phone'), digits = phone.value.replace(/\D/g, '');
  const validPhone = /^\+?[0-9\s().-]+$/.test(phone.value.trim()) && digits.length >= 7 && digits.length <= 15;
  phone.setCustomValidity(validPhone ? '' : 'Enter a phone number with 7 to 15 digits, including your country code if needed.');
  const github = $('beta-join-github');
  github.setCustomValidity(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(github.value.trim()) ? '' : 'Enter your GitHub username using letters, numbers, and single hyphens between them.');
  const email = $('beta-join-email');
  email.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : 'Enter a complete email address, including its domain.');
  const inputs = Array.from($('beta-join-details').querySelectorAll('input'));
  const invalid = inputs.find(input => !input.checkValidity() || !input.value.trim());
  if (invalid) {
    setJoinStep(1, false); invalid.focus(); invalid.reportValidity();
    if (!invalid.value.trim()) $('beta-login-error').textContent = 'Fill in your ' + ({name: 'name', email: 'email address', phone: 'phone number', github: 'GitHub username'}[invalid.name] || 'details') + ' to continue.';
    return false;
  }
  return true;
}
function showGate(message = '', join = false, forget = false) {
  generation++; githubGeneration++;
  token = ''; workspace = null; recapDraft = null; githubStates = []; githubKey = ''; accessCapability = ''; showReturnLink = false; attendanceDay = '';
  if (forget) forgetIdentity();
  $('beta-workspace').hidden = true; $('beta-gate').hidden = false;
  ['beta-summary', 'beta-sections', 'beta-nav', 'beta-profile'].forEach(id => $(id).replaceChildren());
  ['beta-batch-side', 'beta-batch', 'beta-avatar', 'beta-updated', 'beta-notice'].forEach(id => { $(id).textContent = ''; });
  $('beta-profile').hidden = true; $('beta-greeting').textContent = 'Your workspace';
  $('beta-recovery').hidden = true; $('beta-return-link').value = '';
  setGateMode(join ? 'join' : 'intro'); $('beta-login-error').textContent = message;
  setError(); setBusy(false); setGateBusy(false);
}
const isAccessError = error => ['AUTH_REQUIRED', 'FORBIDDEN', 'BETA_UNCONFIGURED'].includes(error.code);
function handleError(error, fallback = '') {
  if (isAccessError(error)) { if (error.code !== 'BETA_UNCONFIGURED') forgetSession(); showGate(error.message || 'Your access has changed. Ask Arya about your group.'); return; }
  setError(fallback || error.message || 'Could not connect. Try again.');
}
async function api(namespace, action, fields = {}, requestToken = '') {
  const body = {...fields, _api: namespace, action};
  if (requestToken) body._session = requestToken;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(ENDPOINT, {method: 'POST', body: JSON.stringify(body), signal: controller.signal, cache: 'no-store'});
    if (!response.ok) throw new Error('The workspace is unavailable right now. Please try again.');
    let out;
    try { out = await response.json(); }
    catch (_) { throw new Error(BETA_SETUP_MESSAGE); }
    if (!out || out.ok !== true) {
      const oldService = /\bunknown\s+(?:beta\s+)?(?:action|form)\b/i.test(String(out?.error || ''));
      const expiredSession = namespace === 'internal' && action === 'session' && /session expired|invalid session|passcode|select your name/i.test(String(out?.error || ''));
      const code = oldService ? 'BETA_UNCONFIGURED' : expiredSession ? 'AUTH_REQUIRED' : out?.code;
      const error = new Error(code === 'BETA_UNCONFIGURED' ? BETA_SETUP_MESSAGE : expiredSession ? 'Your saved session ended. Your personal return link can reopen your profile.' : out?.error || 'The request could not be completed. Please try again.');
      error.code = code; error.joinSaved = out?.joinSaved; throw error;
    }
    return out.data || out;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The connection took too long. Please try again.');
    if (error instanceof TypeError) throw new Error('Could not connect. Check your connection and try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function betaCall(action, fields, requestGeneration) {
  try { return await api('beta', action, fields, token); }
  catch (error) {
    const access = savedAccess();
    if (error.code !== 'AUTH_REQUIRED' || !access || requestGeneration !== generation) throw error;
    const renewed = await api('internal', 'betalogin', {code: access});
    if (requestGeneration !== generation) return null;
    if (!validIdentity(renewed, renewed.token) || (workspace && renewed.member.id !== workspace.member.id)) throw error;
    token = renewed.token; accessCapability = access; rememberIdentity(token, accessCapability);
    return api('beta', action, fields, token);
  }
}
function normalize(out) {
  if (out.manager !== false || !out.member?.id || out.member.status !== 'active' || !out.batch || out.batch.active === false) {
    const error = new Error('This beta workspace is unavailable. Ask Arya about your access.'); error.code = 'AUTH_REQUIRED'; throw error;
  }
  const permissions = Array.isArray(out.permissions) ? out.permissions.filter(value => ['attendance', 'github', 'recap'].includes(value)) : [];
  return {...out, permissions, peers: Array.isArray(out.peers) ? out.peers : [], attendance: Array.isArray(out.attendance) ? out.attendance : [], recaps: (out.recaps || []).filter(recap => recap.memberId === out.member.id)};
}
function emptyState(title, description) { return '<div class="empty-state"><h3>' + esc(title) + '</h3><p>' + esc(description) + '</p></div>'; }
function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase(); }
function heading(id, title, detail, aside = '') { return '<div class="section-head"><div><h2 id="beta-heading-' + id + '">' + title + '</h2><p class="section-description">' + detail + '</p></div>' + aside + '</div>'; }
function attendanceSection() {
  const days = batchDays(), currentDay = today();
  const lastAllowedDay = workspace.batch.endDate < currentDay ? workspace.batch.endDate : currentDay;
  if (!days.includes(attendanceDay) || attendanceDay > lastAllowedDay) attendanceDay = lastAllowedDay;
  const present = workspace.attendance.some(record => record.memberId === workspace.member.id && record.day === attendanceDay);
  const peers = workspace.peers.slice().sort((a, b) => Number(b.id === workspace.member.id) - Number(a.id === workspace.member.id) || a.name.localeCompare(b.name));
  const dates = days.map(day => '<th scope="col" class="attendance-day' + (day === currentDay ? ' current-day' : '') + '"><span>' + esc(new Date(day + 'T12:00:00Z').toLocaleDateString(undefined, {weekday: 'narrow', timeZone: 'UTC'})) + '</span>' + Number(day.slice(-2)) + '</th>').join('');
  const rows = peers.map(peer => {
    const peerDays = new Set(workspace.attendance.filter(record => record.memberId === peer.id).map(record => record.day));
    return '<tr><th scope="row"><span class="peer-name">' + esc(peer.name) + (peer.id === workspace.member.id ? ' <span class="you-pill">You</span>' : '') + '</span>' + (peer.github ? '<span class="peer-handle">@' + esc(peer.github) + '</span>' : '') + '</th>' + days.map(day => '<td class="attendance-cell' + (day > currentDay ? ' upcoming' : '') + (day === currentDay ? ' current-day' : '') + '"><span class="attendance-mark' + (peerDays.has(day) ? ' attended' : '') + '" aria-label="' + esc(peer.name + ', ' + dateLabel(day) + ': ' + (peerDays.has(day) ? 'attended' : day > currentDay ? 'upcoming' : 'no attendance recorded')) + '">' + (peerDays.has(day) ? '✓' : '·') + '</span></td>').join('') + '<td class="attendance-total">' + days.filter(day => peerDays.has(day)).length + '</td></tr>';
  }).join('');
  const action = lastAllowedDay >= workspace.batch.startDate ? '<div class="attendance-tools"><label class="sr-only" for="beta-attendance-day">Your attendance date</label><input type="date" id="beta-attendance-day" value="' + esc(attendanceDay) + '" min="' + esc(workspace.batch.startDate) + '" max="' + esc(lastAllowedDay) + '"><button class="button' + (present ? '' : ' primary') + '" id="beta-today" data-present="' + present + '" type="button">' + (present ? '✓ Attended · Undo' : 'Mark attended') + '</button></div>' : '<span class="section-count">Starts ' + esc(dateLabel(workspace.batch.startDate)) + '</span>';
  const table = '<div class="attendance-scroll" role="region" tabindex="0" aria-label="Group attendance, scroll to see every day"><table class="attendance-table"><thead><tr><th scope="col">Beta group</th>' + dates + '<th scope="col" class="attendance-total">Days</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  return '<section class="section" id="beta-section-attendance" aria-labelledby="beta-heading-attendance">' + heading('attendance', 'Show up together.', 'Everyone in your beta group, across the two weeks.', action) + (peers.length && days.length ? table : emptyState('Your group is getting started.', 'Attendance will appear here as people join.')) + '<div class="section-footnote"><span><span class="legend-dot"></span> Attended</span><span>Attendance dates use New York time.</span></div></section>';
}
function githubCards() {
  if (!githubStates.length) return emptyState('Your group’s builds go here.', 'Public GitHub activity appears as your group connects their accounts.');
  return '<div class="github-grid">' + githubStates.map(state => {
    const hasCount = ['ready', 'partial'].includes(state.status) && Number.isFinite(state.total);
    const status = {missing: 'No GitHub account connected', loading: 'Loading public activity…', ready: 'Public commits in this period', partial: 'Partial public activity', error: 'Activity could not be loaded'}[state.status] || 'Activity unavailable';
    const href = /^https:\/\/github\.com\/[A-Za-z0-9-]+\/?$/.test(state.profileUrl || '') ? state.profileUrl : '';
    const detail = state.message || (Array.isArray(state.reasons) ? state.reasons.join(' · ') : '');
    const commits = Array.isArray(state.commits) ? state.commits.slice(0, 2) : [];
    return '<article class="github-card"><div class="github-person"><span class="peer-avatar">' + esc(initials(state.name)) + '</span><div><h3>' + esc(state.name) + '</h3><span>' + esc(state.username ? '@' + state.username : 'No account connected') + '</span></div>' + (href ? '<a class="github-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" aria-label="Open ' + esc(state.name) + ' on GitHub">↗</a>' : '') + '</div><div class="github-count">' + (hasCount ? state.total + (state.status === 'partial' ? '+' : '') : '<span class="count-pending">—</span>') + '<small>commits</small></div><p class="github-status' + (['partial', 'error'].includes(state.status) ? ' uncertain' : '') + '">' + esc(status) + '</p>' + (detail && ['partial', 'error', 'missing'].includes(state.status) ? '<p class="github-reason">' + esc(detail) + '</p>' : '') + (commits.length ? '<div class="github-commits">' + commits.map(commit => '<p>' + esc(commit.message || 'Commit') + '</p>').join('') + '</div>' : '') + (state.updatedAt ? '<span class="github-updated">Checked ' + esc(dateLabel(state.updatedAt, true)) + '</span>' : '') + '</article>';
  }).join('') + '</div>';
}
function githubSection() {
  return '<section class="section" id="beta-section-github" aria-labelledby="beta-heading-github">' + heading('github', 'What the group is building.', 'Public GitHub activity during your beta period.', '<button class="button" type="button" id="beta-github-refresh">Refresh GitHub</button>') + '<div id="beta-github-cards">' + githubCards() + '</div><p class="section-footnote">Public authored commits in owned repositories, by UTC date. Private work and work in other people’s repositories may not appear.</p></section>';
}
function recapSection() {
  const recap = workspace.recaps[0], submitted = Boolean(recap?.submitted);
  const status = submitted ? 'Submitted ' + (dateLabel(recap.submittedAt, true) || '') : recap ? 'Draft saved ' + (dateLabel(recap.updatedAt, true) || '') : 'Your recap is private to you and your managers.';
  return '<section class="section" id="beta-section-recap" aria-labelledby="beta-heading-recap">' + heading('recap', 'Two weeks. What changed?', 'Look back on what you learned and what you made.', '<span class="pill">Due ' + esc(dateLabel(workspace.batch.endDate)) + '</span>') + '<form id="beta-recap-form" class="recap-form"><div class="recap-fields"><div><label for="beta-learned"><span class="field-number">01</span> What did you learn?</label><textarea id="beta-learned" name="learned" maxlength="12000" placeholder="New skills, ideas, and things you understand better now…"></textarea></div><div><label for="beta-accomplished"><span class="field-number">02</span> What did you accomplish?</label><textarea id="beta-accomplished" name="accomplished" maxlength="12000" placeholder="What you shipped, contributed, or moved forward…"></textarea></div></div><div class="recap-links"><label for="beta-recap-links">Links to your work <span>(optional)</span></label><textarea id="beta-recap-links" name="links" maxlength="6000" placeholder="One https:// link per line"></textarea></div><div class="recap-footer"><p id="beta-recap-status">' + esc(status) + '</p><div><button class="button" type="submit" value="draft">Save draft</button><button class="button primary" type="submit" value="submit">' + (submitted ? 'Update recap' : 'Submit recap') + ' ↗</button></div></div></form></section>';
}
function render() {
  const member = workspace.member;
  $('beta-greeting').textContent = 'Hey, ' + String(member.name || 'there').trim().split(/\s+/)[0] + '.';
  $('beta-batch').textContent = workspace.batch.name || member.batch || 'Beta group';
  $('beta-batch-side').textContent = workspace.batch.name || member.batch || 'Beta group'; $('beta-avatar').textContent = initials(member.name);
  $('beta-nav').innerHTML = [['attendance', 'Group attendance'], ['github', 'GitHub activity'], ['recap', 'Your recap']].filter(([module]) => allowed(module)).map(([module, label]) => '<a href="#beta-section-' + module + '">' + label + '<span aria-hidden="true">↗</span></a>').join('');
  const myDays = new Set(workspace.attendance.filter(record => record.memberId === member.id).map(record => record.day));
  $('beta-summary').innerHTML = '<div class="summary-card"><span>Your beta period</span><div class="summary-dates">' + esc(dateLabel(workspace.batch.startDate)) + '<span>—</span>' + esc(dateLabel(workspace.batch.endDate)) + '</div><p>Two weeks to learn and build</p></div><div class="summary-card"><span>In your group</span><div class="summary-value">' + workspace.peers.length + '<small> ' + (workspace.peers.length === 1 ? 'intern' : 'interns') + '</small></div><p>Progress happens together</p></div>' + (allowed('attendance') ? '<div class="summary-card"><span>You showed up</span><div class="summary-value">' + myDays.size + '<small> ' + (myDays.size === 1 ? 'day' : 'days') + '</small></div><p>Your recorded attendance</p></div>' : '');
  $('beta-sections').innerHTML = (allowed('attendance') ? attendanceSection() : '') + (allowed('github') ? githubSection() : '') + (allowed('recap') ? recapSection() : '') || emptyState('Your group is being set up.', 'Arya can open the sections you need when the batch is ready.');
  if (allowed('recap')) {
    const recap = recapDraft || workspace.recaps[0] || {};
    $('beta-learned').value = recap.learned || ''; $('beta-accomplished').value = recap.accomplished || '';
    $('beta-recap-links').value = Array.isArray(recap.links) ? recap.links.join('\n') : recap.links || '';
  }
  $('beta-updated').textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
  $('beta-gate').hidden = true; $('beta-workspace').hidden = false;
  $('beta-recovery').hidden = !(showReturnLink && accessCapability); $('beta-return-link').value = returnLink();
  $('beta-profile').hidden = false;
  $('beta-profile').innerHTML = '<div><span class="eyebrow">Your profile</span><h2>' + esc(member.name) + '</h2><p>' + esc(workspace.batch.name || member.batch) + '</p></div><div class="profile-contact"><span>' + esc(member.email) + '</span><span>' + esc(member.phone) + '</span></div><div class="profile-links">' + (member.github ? '<a href="https://github.com/' + encodeURIComponent(member.github) + '" target="_blank" rel="noopener noreferrer">@' + esc(member.github) + ' ↗</a>' : '') + (accessCapability ? '<button class="button subtle" id="beta-show-link" type="button">Personal return link</button>' : '') + '</div>';

}
function refreshGithub(force = false) {
  if (!allowed('github')) return;
  const key = JSON.stringify([workspace.peers.map(peer => [peer.id, peer.github]), workspace.batch.startDate, workspace.batch.endDate]);
  if (!force && githubKey === key) return;
  githubKey = key;
  const requestGeneration = ++githubGeneration;
  const options = {startDate: workspace.batch.startDate, endDate: workspace.batch.endDate};
  const showStates = states => { if (requestGeneration !== githubGeneration || !allowed('github')) return; githubStates = states; if ($('beta-github-cards')) $('beta-github-cards').innerHTML = githubCards(); };
  showStates(betaGithubInitial(workspace.peers, options));
  loadBetaGithub(workspace.peers, {...options, onProgress: showStates}).then(showStates).catch(() => showStates(githubStates.map(state => state.status === 'loading' ? {...state, status: 'error', total: null} : state)));
}
async function fetchWorkspace(requestGeneration, preserveEditor = false) {
  const out = await betaCall('list', {}, requestGeneration);
  if (requestGeneration !== generation) return false;
  const previousMember = workspace?.member.id, previousBatch = workspace?.batch.id;
  workspace = normalize(out);
  if (!allowed('recap')) recapDraft = null;
  if (!allowed('github')) { githubGeneration++; githubStates = []; githubKey = ''; }
  // An automatic access check must leave a focused recap and its cursor intact.
  // Changed identity, access, or a failed session still clears the old view.
  if (!(preserveEditor && allowed('recap') && previousMember === workspace.member.id && previousBatch === workspace.batch.id && $('beta-recap-form')?.contains(document.activeElement))) render();
  refreshGithub(); return true;
}
async function refresh(preserveEditor = false) {
  if (!token || busy) return;
  const requestGeneration = generation;
  const keepEditor = preserveEditor && Boolean($('beta-recap-form')?.contains(document.activeElement));
  setError(); $('beta-notice').textContent = ''; setBusy(true, keepEditor);
  try { await fetchWorkspace(requestGeneration, keepEditor); }
  catch (error) { if (requestGeneration === generation) handleError(error); }
  finally { if (requestGeneration === generation) setBusy(false); }
}
async function readRememberedIdentity(requestGeneration) {
  const session = savedSession(), access = savedAccess();
  if (session) {
    try {
      const out = await api('internal', 'session', {}, session);
      if (requestGeneration !== generation) return null;
      if (validIdentity(out, session)) return {out, session, access: sessionAccess()};
    } catch (error) { if (requestGeneration !== generation) return null; if (!isAccessError(error)) throw error; }
  }
  if (access) {
    const out = await api('internal', 'betalogin', {code: access});
    if (requestGeneration !== generation) return null;
    if (!validIdentity(out, out.token)) throw new Error(BETA_SETUP_MESSAGE);
    return {out, session: out.token, access};
  }
  return null;
}
async function openIdentity(identity, requestGeneration, joined = false) {
  const out = await api('beta', 'list', {}, identity.session);
  if (requestGeneration !== generation) return false;
  const data = normalize(out);
  if (data.member.id !== identity.out.member.id) throw new Error('Your profile could not be verified. Open your personal return link again.');
  workspace = data; token = identity.session; accessCapability = identity.access || ''; showReturnLink = joined;
  rememberIdentity(token, accessCapability); render(); refreshGithub(); clearRouteFragment();
  $('beta-join-form').reset(); $('beta-review-details').replaceChildren(); $('beta-greeting').focus({preventScroll: true});
  return true;
}
async function signInWithAccess(access) {
  showGate(); const requestGeneration = generation; setGateBusy(true, 'Opening your profile…');
  try {
    const out = await api('internal', 'betalogin', {code: access});
    if (requestGeneration !== generation) return;
    if (!validIdentity(out, out.token)) throw new Error(BETA_SETUP_MESSAGE);
    await openIdentity({out, session: out.token, access}, requestGeneration);
  } catch (error) { if (requestGeneration === generation) { showGate(error.message || 'This return link could not be opened. Ask Arya for a new link.'); } }
  finally { if (requestGeneration === generation) setGateBusy(false); }
}
async function submitJoin(fields) {
  const invitation = invite, requestGeneration = ++generation;
  const attempt = makeJoinAttempt(invitation, fields);
  let confirmed = null;
  setGateBusy(true, 'Joining your group…'); $('beta-login-error').textContent = '';
  try {
    const out = await api('internal', 'betajoin', {...attempt.fields, invite: invitation, joinRequest: attempt.joinRequest});
    if (requestGeneration !== generation) return;
    if (!validIdentity(out, out.token) || !/^BETA-[a-f0-9]{32}$/i.test(String(out.code || ''))) throw new Error(BETA_SETUP_MESSAGE);
    confirmed = {out, session: out.token, access: out.code};
    // A confirmed account is recoverable even if the following group read fails.
    rememberIdentity(out.token, out.code); clearJoinAttempt(invitation);
    await openIdentity(confirmed, requestGeneration, true);
  } catch (error) {
    if (requestGeneration !== generation) return;
    if (confirmed && !isAccessError(error)) {
      token = confirmed.session; accessCapability = confirmed.access; showReturnLink = true;
      $('beta-gate').hidden = true; $('beta-workspace').hidden = false;
      $('beta-return-link').value = returnLink(); $('beta-recovery').hidden = false;
      setError('Your profile is saved. Use Refresh to load your group, or save your personal return link.');
    } else {
      if (error.joinSaved === false) clearJoinAttempt(invitation);
      restoreJoinFields(attempt.fields); setJoinStep(error.joinSaved === false ? 1 : 2, false);
      $('beta-login-error').textContent = (error.message || 'Your join was not confirmed.') + (!error.code ? ' Retry to safely reopen the same profile.' : '');
    }
  } finally { if (requestGeneration === generation) setGateBusy(false); }
}
async function mutate(action, fields, successMessage) {
  if (!token || busy) return;
  const requestGeneration = generation;
  setError(); $('beta-notice').textContent = ''; setBusy(true);
  try {
    const out = await betaCall(action, fields, requestGeneration);
    if (requestGeneration !== generation) return;
    workspace = normalize(out);
    if (action === 'recap') recapDraft = null;
    render(); refreshGithub(); $('beta-notice').textContent = successMessage;
  } catch (error) { if (requestGeneration === generation) handleError(error); }
  finally { if (requestGeneration === generation) setBusy(false); }
}
async function loadInvite(invitation) {
  invite = invitation; inviteBatch = null; joinStep = 0; showGate('', true);
  const requestGeneration = generation; setGateBusy(true, 'Checking invitation…');
  $('beta-invite-summary').replaceChildren(); $('beta-join-form').reset(); $('beta-review-details').replaceChildren();
  try {
    const out = await api('internal', 'betainvite', {invite: invitation});
    if (requestGeneration !== generation) return;
    if (!out.batch || out.batch.active === false) throw new Error('This group is not accepting new interns. Ask Arya for the current invitation.');
    inviteBatch = out.batch;
    let remembered = null, resumeError = '';
    try { remembered = await readRememberedIdentity(requestGeneration); }
    catch (error) { resumeError = isAccessError(error) ? '' : 'Your saved profile could not be checked. You can retry this invite to reopen it.'; }
    if (requestGeneration !== generation) return;
    if (remembered?.out.member.batchId === inviteBatch.id) { await openIdentity(remembered, requestGeneration); return; }
    $('beta-invite-summary').innerHTML = '<strong>' + esc(inviteBatch.name) + '</strong><span>' + esc(dateLabel(inviteBatch.startDate)) + ' — ' + esc(dateLabel(inviteBatch.endDate)) + '</span>';
    $('beta-recap-due').textContent = dateLabel(inviteBatch.endDate) || 'the end of your two weeks';
    const pending = pendingJoin(invitation);
    if (pending) { restoreJoinFields(pending.fields); setJoinStep(2); $('beta-login-error').textContent = 'Your previous join was not confirmed. Retry with these details to safely reopen the same profile.'; }
    else { setJoinStep(0); $('beta-login-error').textContent = resumeError; }
  } catch (error) { if (requestGeneration === generation) showGate(error.message || 'This invitation could not be opened. Please try the link again.'); }
  finally { if (requestGeneration === generation) setGateBusy(false); }
}
async function restoreProfile() {
  invite = ''; inviteBatch = null; showGate(); const requestGeneration = generation;
  if (!savedSession() && !savedAccess()) return;
  setGateBusy(true, 'Opening your profile…');
  try { const identity = await readRememberedIdentity(requestGeneration); if (requestGeneration === generation && identity) await openIdentity(identity, requestGeneration); }
  catch (error) { if (requestGeneration === generation) { if (error.code === 'AUTH_REQUIRED') forgetSession(); showGate(error.message || 'Your profile could not be opened. Try your personal return link.'); } }
  finally { if (requestGeneration === generation) setGateBusy(false); }
}
function handleLocationChange() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const invitation = fragment.get('invite'), access = fragment.get('access');
  if (invitation) return loadInvite(invitation);
  if (access) return signInWithAccess(access);
  if (!location.hash || !workspace) return restoreProfile();
}
$('beta-join-form').addEventListener('submit', event => {
  event.preventDefault(); if (!invite || !inviteBatch || gateBusy) return;
  if (joinStep === 0) { setJoinStep(1); return; }
  if (!validateJoinDetails()) return;
  if (joinStep === 1) { setJoinStep(2); return; }
  const fields = joinFields(), pending = pendingJoin(invite);
  if (pending && Object.keys(fields).some(key => fields[key] !== pending.fields[key])) {
    restoreJoinFields(pending.fields); setJoinStep(2, false);
    $('beta-login-error').textContent = 'Your previous join may already be saved. Retry with the original details shown here so we can safely reopen that profile.';
    return;
  }
  try { submitJoin(fields).catch(error => { $('beta-login-error').textContent = error.message || 'Your browser could not prepare a secure join. Please try again.'; setGateBusy(false); }); }
  catch (error) { $('beta-login-error').textContent = 'Your browser could not prepare a secure join. Please try again.'; }
});
$('beta-join-start').addEventListener('click', () => { if (!gateBusy && inviteBatch) setJoinStep(1); });
$('beta-details-back').addEventListener('click', () => { if (!gateBusy) setJoinStep(0); });
$('beta-details-next').addEventListener('click', () => { if (!gateBusy && validateJoinDetails()) setJoinStep(2); });
$('beta-review-back').addEventListener('click', () => { if (!gateBusy) setJoinStep(1); });
$('beta-refresh').addEventListener('click', () => refresh());
$('beta-signout').addEventListener('click', () => {
  const previousToken = token; showGate('', false, true); invite = ''; inviteBatch = null; clearRouteFragment();
  pendingJoins = {}; writePendingJoins(); $('beta-join-form').reset(); $('beta-review-details').replaceChildren(); $('beta-gate-title').focus({preventScroll: false});
  if (previousToken) api('internal', 'logout', {}, previousToken).catch(() => {});
});
$('beta-copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(returnLink()); $('beta-copy-link').textContent = 'Copied'; }
  catch (_) { $('beta-return-link').focus(); $('beta-return-link').select(); $('beta-copy-link').textContent = 'Select and copy the link'; }
});
$('beta-hide-link').addEventListener('click', () => { showReturnLink = false; $('beta-return-link').value = ''; $('beta-recovery').hidden = true; });
$('beta-profile').addEventListener('click', event => { if (event.target.closest('#beta-show-link')) { showReturnLink = true; $('beta-return-link').value = returnLink(); $('beta-recovery').hidden = false; } });
$('beta-sections').addEventListener('click', event => {
  if (event.target.closest('#beta-github-refresh')) { refreshGithub(true); return; }
  const button = event.target.closest('#beta-today');
  if (button && allowed('attendance') && !busy) mutate(button.dataset.present === 'true' ? 'attendanceremove' : 'attendance', {day: attendanceDay}, button.dataset.present === 'true' ? 'Your attendance was removed for ' + dateLabel(attendanceDay) + '.' : 'You’re marked as attended on ' + dateLabel(attendanceDay) + '.');
});
$('beta-sections').addEventListener('change', event => {
  if (event.target.id !== 'beta-attendance-day' || !workspace || busy) return;
  const value = event.target.value;
  if (!batchDays().includes(value) || value > today()) { setError('Choose a date within your beta period, up to today.'); return; }
  attendanceDay = value; setError(); render();
});
$('beta-sections').addEventListener('input', event => { if (event.target.closest('#beta-recap-form')) recapDraft = {learned: $('beta-learned').value, accomplished: $('beta-accomplished').value, links: $('beta-recap-links').value}; });
$('beta-sections').addEventListener('submit', event => {
  if (event.target.id !== 'beta-recap-form') return;
  event.preventDefault(); if (!allowed('recap') || busy) return;
  const submit = event.submitter?.value === 'submit';
  const learned = $('beta-learned').value.trim(), accomplished = $('beta-accomplished').value.trim();
  const links = $('beta-recap-links').value.split('\n').map(link => link.trim()).filter(Boolean);
  if (submit && (!learned || !accomplished)) { setError('Add what you learned and accomplished before submitting your recap.'); return; }
  if (links.length > 12 || links.some(link => { try { return link.length > 2000 || /\s/.test(link) || !['https:', 'http:'].includes(new URL(link).protocol); } catch (_) { return true; } })) { setError('Add up to 12 complete http:// or https:// links, one per line.'); return; }
  mutate('recap', {learned, accomplished, links, submit}, submit ? 'Your recap was submitted to Arya.' : 'Your recap draft is saved.');
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
setInterval(() => { if (!document.hidden) refresh(true); }, 90000);

window.addEventListener('hashchange', handleLocationChange);
handleLocationChange();
