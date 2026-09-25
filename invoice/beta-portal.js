import {loadBetaGithub, betaGithubInitial} from './beta-github.js';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyeQIRm2DezB1fYi0B03pnbuorco5eQAAJtxioVClgB4xyMVWGlvVmAFQqFdwbI3UnZfA/exec';
const SESSION_KEY = 'fomo.beta.session';
const BETA_SETUP_MESSAGE = 'Beta access is not available yet. Ask Arya to finish setup.';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
let token = '', workspace = null, busy = false, generation = 0, invite = '', inviteBatch = null;
let recapDraft = null, githubStates = [], githubKey = '', githubGeneration = 0, recoveryCode = '', attendanceDay = '';
let joinStep = 0, gateBusy = false;
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
  ['beta-login-form', 'beta-join-form'].forEach(id => $(id).querySelectorAll('input,button').forEach(element => { element.disabled = value; }));
  $('beta-use-code').disabled = value;
  $('beta-login').textContent = value ? message || 'Opening…' : 'Open workspace ↗';
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
  const joining = mode === 'join' && Boolean(invite), login = mode === 'login';
  $('beta-join-form').hidden = !joining;
  $('beta-join-progress').hidden = !joining;
  $('beta-login-form').hidden = !login;
  $('beta-invite-needed').hidden = joining || login;
  $('beta-use-code').hidden = login;
  if (joining) setJoinStep(joinStep, false);
  else {
    $('beta-gate-eyebrow').textContent = login ? 'Welcome back' : 'Two weeks to learn and build';
    $('beta-gate-title').textContent = login ? 'Back to your group.' : 'Arya’s two-week beta internship.';
    $('beta-gate-intro').textContent = login ? 'Enter the personal code you saved when you joined. Your attendance, GitHub activity, and recap will be waiting for you.' : 'Join a small group, track your attendance, build public internship projects on GitHub, and share what you learned at the end.';
  }
}
function validateJoinDetails() {
  const phone = $('beta-join-phone'), digits = phone.value.replace(/\D/g, '');
  const validPhone = /^\+?[0-9\s().-]+$/.test(phone.value.trim()) && digits.length >= 7 && digits.length <= 15;
  phone.setCustomValidity(validPhone ? '' : 'Enter a phone number with 7 to 15 digits, including your country code if needed.');
  const github = $('beta-join-github');
  github.setCustomValidity(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(github.value.trim()) ? '' : 'Enter your GitHub username using letters, numbers, and single hyphens between them.');
  const inputs = Array.from($('beta-join-details').querySelectorAll('input'));
  const invalid = inputs.find(input => !input.checkValidity() || !input.value.trim());
  if (invalid) {
    setJoinStep(1, false); invalid.focus(); invalid.reportValidity();
    if (!invalid.value.trim()) $('beta-login-error').textContent = 'Fill in your ' + ({name: 'name', email: 'email address', phone: 'phone number', github: 'GitHub username'}[invalid.name] || 'details') + ' to continue.';
    return false;
  }
  return true;
}
function showGate(message = '', join = false) {
  generation++; githubGeneration++;
  token = ''; workspace = null; recapDraft = null; githubStates = []; githubKey = ''; recoveryCode = ''; attendanceDay = '';
  try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  $('beta-workspace').hidden = true; $('beta-gate').hidden = false;
  ['beta-summary', 'beta-sections', 'beta-nav'].forEach(id => $(id).replaceChildren());
  ['beta-batch-side', 'beta-batch', 'beta-avatar', 'beta-updated', 'beta-notice'].forEach(id => { $(id).textContent = ''; });
  $('beta-greeting').textContent = 'Your workspace';
  $('beta-recovery').hidden = true; $('beta-recovery-code').value = ''; $('beta-code').value = '';
  setGateMode(join ? 'join' : 'intro');
  $('beta-login-error').textContent = message;
  setError(); setBusy(false); setGateBusy(false);
}
const isAccessError = error => ['AUTH_REQUIRED', 'FORBIDDEN', 'BETA_UNCONFIGURED'].includes(error.code);
function handleError(error, fallback = '') {
  if (isAccessError(error)) { showGate(error.message || 'Your access has changed. Ask Arya about your group.'); setGateMode('login'); return; }
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
      const code = oldService ? 'BETA_UNCONFIGURED' : out?.code;
      const error = new Error(code === 'BETA_UNCONFIGURED' ? BETA_SETUP_MESSAGE : out?.error || 'The request could not be completed. Please try again.');
      error.code = code; throw error;
    }
    return out.data || out;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The connection took too long. Please try again.');
    if (error instanceof TypeError) throw new Error('Could not connect. Check your connection and try again.');
    throw error;
  } finally { clearTimeout(timeout); }
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
  $('beta-recovery').hidden = !recoveryCode; $('beta-recovery-code').value = recoveryCode;
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
  const out = await api('beta', 'list', {}, token);
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
async function signIn(action, fields = {}, savedToken = '') {
  const requestGeneration = ++generation;
  let joinConfirmed = false;
  setGateBusy(true, action === 'betajoin' ? 'Joining your group…' : 'Opening your workspace…'); $('beta-login-error').textContent = '';
  try {
    const out = await api('internal', action, fields, savedToken);
    if (requestGeneration !== generation) return;
    const validIdentity = out.beta === true && typeof (out.token || savedToken) === 'string' && Boolean(out.token || savedToken) && out.member?.id;
    const validJoin = action !== 'betajoin' || /^BETA-[a-f0-9]{32}$/i.test(String(out.code || ''));
    if (!validIdentity || !validJoin) {
      const error = new Error(BETA_SETUP_MESSAGE); error.code = 'BETA_UNCONFIGURED'; throw error;
    }
    token = out.token || savedToken;
    if (action === 'betajoin') { recoveryCode = out.code; joinConfirmed = true; }
    if (!await fetchWorkspace(requestGeneration)) return;
    try { sessionStorage.setItem(SESSION_KEY, token); } catch (_) {}
    $('beta-code').value = ''; $('beta-join-form').reset(); $('beta-review-details').replaceChildren();
    if (invite) { history.replaceState(null, '', location.pathname + location.search); invite = ''; }
    $('beta-greeting').focus({preventScroll: true});
  } catch (error) {
    if (requestGeneration !== generation) return;
    // Keep the only copy of a newly issued personal code if the next read fails.
    if (joinConfirmed && recoveryCode && token && !isAccessError(error)) {
      try { sessionStorage.setItem(SESSION_KEY, token); } catch (_) {}
      $('beta-gate').hidden = true; $('beta-workspace').hidden = false;
      $('beta-recovery-code').value = recoveryCode; $('beta-recovery').hidden = false;
      setError('You joined successfully. Save your personal code, then use Refresh to open your group.');
    } else {
      if (savedToken || isAccessError(error)) { showGate(error.message); if (savedToken) setGateMode('login'); }
      else { token = ''; $('beta-login-error').textContent = error.message || 'Could not sign in. Please try again.'; }
    }
  } finally { if (requestGeneration === generation) setGateBusy(false); }
}
async function mutate(action, fields, successMessage) {
  if (!token || busy) return;
  const requestGeneration = generation;
  setError(); $('beta-notice').textContent = ''; setBusy(true);
  try {
    const out = await api('beta', action, fields, token);
    if (requestGeneration !== generation) return;
    workspace = normalize(out);
    if (action === 'recap') recapDraft = null;
    render(); refreshGithub(); $('beta-notice').textContent = successMessage;
  } catch (error) { if (requestGeneration === generation) handleError(error); }
  finally { if (requestGeneration === generation) setBusy(false); }
}
async function loadInvite() {
  joinStep = 0; showGate('', true); setGateBusy(true, 'Checking invitation…');
  try {
    const out = await api('internal', 'betainvite', {invite});
    if (!out.batch || out.batch.active === false) throw new Error('This group is not accepting new interns. Ask Arya for the current invitation.');
    inviteBatch = out.batch;
    $('beta-invite-summary').innerHTML = '<strong>' + esc(inviteBatch.name) + '</strong><span>' + esc(dateLabel(inviteBatch.startDate)) + ' — ' + esc(dateLabel(inviteBatch.endDate)) + '</span>';
    $('beta-recap-due').textContent = dateLabel(inviteBatch.endDate) || 'the end of your two weeks';
    setGateBusy(false); setJoinStep(0);
  } catch (error) { showGate(error.message || 'This invitation could not be opened. Please try the link again.'); }
}
$('beta-login-form').addEventListener('submit', event => { event.preventDefault(); const code = $('beta-code').value.trim(); if (code) signIn('betalogin', {code}); });
$('beta-join-form').addEventListener('submit', event => {
  event.preventDefault(); if (!invite || !inviteBatch || gateBusy) return;
  if (joinStep === 0) { setJoinStep(1); return; }
  if (!validateJoinDetails()) return;
  if (joinStep === 1) { setJoinStep(2); return; }
  signIn('betajoin', {invite, name: $('beta-join-name').value.trim(), email: $('beta-join-email').value.trim(), phone: $('beta-join-phone').value.trim(), github: $('beta-join-github').value.trim().replace(/^@/, '')});
});
$('beta-join-start').addEventListener('click', () => { if (!gateBusy && inviteBatch) setJoinStep(1); });
$('beta-details-back').addEventListener('click', () => { if (!gateBusy) setJoinStep(0); });
$('beta-details-next').addEventListener('click', () => { if (!gateBusy && validateJoinDetails()) setJoinStep(2); });
$('beta-review-back').addEventListener('click', () => { if (!gateBusy) setJoinStep(1); });
$('beta-use-code').addEventListener('click', () => { if (gateBusy) return; setGateMode('login'); $('beta-login-error').textContent = ''; $('beta-code').focus(); });
$('beta-return-join').addEventListener('click', () => { if (gateBusy) return; setGateMode(invite && inviteBatch ? 'join' : 'intro'); $('beta-login-error').textContent = ''; $('beta-gate-title').focus({preventScroll: false}); });
$('beta-refresh').addEventListener('click', () => refresh());
$('beta-signout').addEventListener('click', () => { const previousToken = token; showGate(); $('beta-join-form').reset(); $('beta-review-details').replaceChildren(); $('beta-gate-title').focus({preventScroll: false}); if (previousToken) api('internal', 'logout', {}, previousToken).catch(() => {}); });
$('beta-copy-code').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(recoveryCode); $('beta-copy-code').textContent = 'Copied'; }
  catch (_) { $('beta-recovery-code').focus(); $('beta-recovery-code').select(); $('beta-copy-code').textContent = 'Select and copy the code'; }
});
$('beta-saved-code').addEventListener('click', () => { recoveryCode = ''; $('beta-recovery-code').value = ''; $('beta-recovery').hidden = true; });
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

invite = new URLSearchParams(location.hash.slice(1)).get('invite') || '';
let savedToken = '';
try { savedToken = sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) {}
if (invite) loadInvite(); else if (savedToken) signIn('session', {}, savedToken);
