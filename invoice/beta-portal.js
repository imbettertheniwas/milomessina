import {loadBetaGithub, betaGithubInitial} from './beta-github.js';
import {normalizeSchedule, scheduleFile} from './beta-schedule.js';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyeQIRm2DezB1fYi0B03pnbuorco5eQAAJtxioVClgB4xyMVWGlvVmAFQqFdwbI3UnZfA/exec';
const SESSION_KEY = 'fomo.beta.session';
const ACCESS_KEY = 'fomo.beta.access';
const JOIN_KEY = 'fomo.beta.pendingJoins';
const PERMANENT_INVITE = 'beta';
const JOIN_FIELDS = ['name', 'email', 'phone', 'github', 'website'];
const BETA_SETUP_MESSAGE = 'Beta access is not available yet. Ask Arya to finish setup.';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
let token = '', workspace = null, busy = false, generation = 0, invite = '', inviteBatch = null;
let recapDraft = null, githubStates = [], githubKey = '', githubGeneration = 0, accessCapability = '', showReturnLink = false, attendanceDay = '';
let joinStep = 0, gateBusy = false, websiteDraft = null;
let scheduleDrafts = {join: null, own: null}, scheduleRead = 0, scheduleDirty = false;
const WEBSITE_ERROR = 'Enter a public website such as yourname.com or https://yourname.com, up to 300 characters.';
function websiteUrl(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (!/^[a-z][a-z\d+.-]*:/i.test(url)) url = 'https://' + url;
  const parts = /^(https?):\/\/([^/?#]+)([/?#].*)?$/i.exec(url);
  if (url.length > 300 || /[\s\u0000-\u001f\u007f\\<>"'`]/.test(url) || !parts) return '';
  const authority = /^([a-z\d.-]+)(?::(\d{1,5}))?$/i.exec(parts[2]);
  const hostname = authority ? authority[1].toLowerCase() : '', labels = hostname.split('.');
  if (!authority || hostname.length > 253 || labels.length < 2 || /^\d+$/.test(labels.at(-1)) ||
      labels.some(label => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label)) ||
      authority[2] && (Number(authority[2]) < 1 || Number(authority[2]) > 65535)) return '';
  return parts[1].toLowerCase() + '://' + hostname + (authority[2] ? ':' + authority[2] : '') + (parts[3] || '');
}
const SCHEDULE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCHEDULE_ZONES = [['America/New_York', 'New York / Eastern'], ['America/Chicago', 'Chicago / Central'], ['America/Denver', 'Denver / Mountain'], ['America/Los_Angeles', 'Los Angeles / Pacific'], ['UTC', 'UTC']];
function scheduleDraft(scope) {
  if (!scheduleDrafts[scope]) {
    const saved = scope === 'own' ? workspace?.schedules?.find(item => item.memberId === workspace.member.id) : null;
    scheduleDrafts[scope] = saved ? JSON.parse(JSON.stringify(saved)) : {timezone: 'America/New_York', mode: 'manual', blocks: [], noCommitments: false};
    // The server can finish a staged save after proving the owned file's hash.
    if (saved?.mode === 'file') scheduleDrafts[scope].keepFile = Boolean(saved.file);
  }
  return scheduleDrafts[scope];
}
function scheduleSummary(schedule) {
  if (!schedule) return 'Not provided on this earlier join. You can add it in your profile.';
  if (schedule.mode === 'file') return (schedule.file?.name || 'Schedule file') + ' · ' + schedule.timezone + ' · Private';
  return (schedule.noCommitments ? 'No regular weekly commitments' : (schedule.blocks || []).map(block => SCHEDULE_DAYS[block.day] + ' ' + block.start + '–' + block.end + (block.label ? ' · ' + block.label : '')).join('; ')) + ' · ' + schedule.timezone + ' · Private';
}
function scheduleEditor(scope) {
  const draft = scheduleDraft(scope), prefix = 'beta-' + scope + '-schedule';
  const attrs = field => ' data-schedule-scope="' + scope + '" data-schedule-field="' + field + '"';
  const zones = SCHEDULE_ZONES.slice();
  if (draft.timezone && !zones.some(([value]) => value === draft.timezone)) zones.push([draft.timezone, draft.timezone]);
  const timezone = '<label for="' + prefix + '-timezone">Time zone</label><select id="' + prefix + '-timezone"' + attrs('timezone') + '>' + zones.map(([value, label]) => '<option value="' + esc(value) + '"' + (draft.timezone === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('') + '</select>';
  const mode = '<label for="' + prefix + '-mode">Add your schedule</label><select id="' + prefix + '-mode"' + attrs('mode') + '><option value="manual"' + (draft.mode === 'manual' ? ' selected' : '') + '>Enter weekly times</option><option value="file"' + (draft.mode === 'file' ? ' selected' : '') + '>Upload a schedule file</option></select>';
  const row = (block, index) => '<div class="schedule-row"><div><label for="' + prefix + '-day-' + index + '">Day</label><select id="' + prefix + '-day-' + index + '"' + attrs('day') + ' data-schedule-index="' + index + '">' + SCHEDULE_DAYS.map((day, value) => '<option value="' + value + '"' + (Number(block.day) === value ? ' selected' : '') + '>' + day + '</option>').join('') + '</select></div><div><label for="' + prefix + '-start-' + index + '">From</label><input type="time" id="' + prefix + '-start-' + index + '" value="' + esc(block.start) + '"' + attrs('start') + ' data-schedule-index="' + index + '"></div><div><label for="' + prefix + '-end-' + index + '">To</label><input type="time" id="' + prefix + '-end-' + index + '" value="' + esc(block.end) + '"' + attrs('end') + ' data-schedule-index="' + index + '"></div><div class="schedule-row-label"><label for="' + prefix + '-label-' + index + '">Commitment</label><input id="' + prefix + '-label-' + index + '" maxlength="100" placeholder="Class, work, busy…" value="' + esc(block.label) + '"' + attrs('label') + ' data-schedule-index="' + index + '"></div><button class="button subtle schedule-remove" type="button" data-schedule-action="remove" data-schedule-scope="' + scope + '" data-schedule-index="' + index + '" aria-label="Remove commitment ' + (index + 1) + '">Remove</button></div>';
  const manual = '<div' + (draft.mode === 'manual' ? '' : ' hidden') + '><label class="schedule-none"><input type="checkbox"' + attrs('noCommitments') + (draft.noCommitments ? ' checked' : '') + '> I have no regular weekly commitments</label><div' + (draft.noCommitments ? ' hidden' : '') + '>' + (draft.blocks || []).map(row).join('') + '<button class="button" type="button" data-schedule-action="add" data-schedule-scope="' + scope + '"' + ((draft.blocks || []).length >= 80 ? ' disabled' : '') + '>Add a weekly time</button><p class="schedule-help">Enter the times you’re busy. For an overnight commitment, add a separate time for each day.</p></div></div>';
  const file = '<div' + (draft.mode === 'file' ? '' : ' hidden') + '><div class="schedule-drop" data-schedule-drop="' + scope + '"><label for="' + prefix + '-file">Drop your schedule here, or choose a file</label><input type="file" id="' + prefix + '-file" accept=".pdf,.png,.jpg,.jpeg,.ics,application/pdf,image/png,image/jpeg,text/calendar"' + attrs('file') + '><p>PDF, PNG, JPG, or calendar (.ics) · Up to 2 MB</p></div>' + (draft.file ? '<div class="schedule-selected"><span>' + esc(draft.file.name) + (draft.ready === false ? ' · Saving is incomplete. Try Save schedule again, or choose the file again.' : '') + '</span><button class="button subtle" type="button" data-schedule-action="clear-file" data-schedule-scope="' + scope + '">Remove file</button></div>' : '') + '<p class="schedule-help">The original file is saved privately. Calendar files are kept as uploaded.</p></div>';
  return '<div class="schedule-options"><div>' + timezone + '</div><div>' + mode + '</div></div>' + manual + file + '<p class="schedule-privacy">Only you, Arya, and Milo can see your schedule.</p><p id="' + prefix + '-error" class="schedule-error" role="alert" hidden></p>';
}
function renderScheduleEditor(scope) { const host = $('beta-' + scope + '-schedule-editor'); if (host) host.innerHTML = scheduleEditor(scope); }
function scheduleError(scope, message = '') { const element = $('beta-' + scope + '-schedule-error'); if (element) { element.textContent = message; element.hidden = !message; } }
function scheduleChange(event) {
  const target = event.target, scope = target.dataset.scheduleScope, field = target.dataset.scheduleField;
  if (!scope || !field || (scope === 'join' ? gateBusy : busy)) return;
  if (field === 'file') { readScheduleFile(scope, target.files); return; }
  const draft = scheduleDraft(scope), index = target.dataset.scheduleIndex;
  if (scope === 'own') scheduleDirty = true;
  if (index !== undefined && draft.blocks[Number(index)]) draft.blocks[Number(index)][field] = field === 'day' ? Number(target.value) : target.value;
  else if (field === 'noCommitments') { draft.noCommitments = target.checked; if (target.checked) draft.blocks = []; }
  else draft[field] = target.value;
  scheduleError(scope);
  if (field === 'mode' || field === 'noCommitments') renderScheduleEditor(scope);
}
function scheduleAction(event) {
  const button = event.target.closest('[data-schedule-action]');
  if (!button) return false;
  const scope = button.dataset.scheduleScope;
  if (scope === 'join' ? gateBusy : busy) return true;
  const draft = scheduleDraft(scope), action = button.dataset.scheduleAction;
  if (scope === 'own') scheduleDirty = true;
  if (action === 'add' && draft.blocks.length < 80) { draft.noCommitments = false; draft.blocks.push({day: 1, start: '', end: '', label: ''}); }
  if (action === 'remove') draft.blocks.splice(Number(button.dataset.scheduleIndex), 1);
  if (action === 'clear-file') { delete draft.file; delete draft.keepFile; delete draft.ready; scheduleRead++; }
  renderScheduleEditor(scope); return true;
}
async function readScheduleFile(scope, files) {
  if (scope === 'join' ? gateBusy : busy || !workspace) return;
  if (!files?.length) return;
  if (files.length !== 1) { scheduleError(scope, 'Choose one schedule file at a time.'); return; }
  const requestGeneration = generation, requestRead = ++scheduleRead;
  scheduleError(scope);
  if (scope === 'join') setGateBusy(true, 'Reading your schedule…'); else setBusy(true);
  try {
    const file = await scheduleFile(files[0]);
    if (requestGeneration !== generation || requestRead !== scheduleRead) return;
    const draft = scheduleDraft(scope); draft.mode = 'file'; draft.file = file; delete draft.keepFile; delete draft.ready;
    if (scope === 'own') scheduleDirty = true;
    renderScheduleEditor(scope);
  } catch (error) { if (requestGeneration === generation && requestRead === scheduleRead) scheduleError(scope, error.message || 'This file could not be read. Try again.'); }
  finally { if (requestGeneration === generation && requestRead === scheduleRead) { if (scope === 'join') setGateBusy(false); else setBusy(false); } }
}
function scheduleDrop(event) {
  const drop = event.target.closest('[data-schedule-drop]');
  if (!drop) return;
  event.preventDefault();
  if (event.type === 'drop') readScheduleFile(drop.dataset.scheduleDrop, event.dataTransfer?.files);
}
function validateJoinSchedule() {
  try { normalizeSchedule(scheduleDraft('join')); scheduleError('join'); return true; }
  catch (error) { setJoinStep(2, false); scheduleError('join', error.message); return false; }
}
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
function writePendingJoins() { try { const value = JSON.stringify(pendingJoins); sessionStorage.setItem(JOIN_KEY, value); return sessionStorage.getItem(JOIN_KEY) === value; } catch (_) { return false; } }
function pendingJoin(invitation) {
  const pending = pendingJoins[invitation];
  return pending && /^[a-f0-9]{32}$/.test(pending.joinRequest || '') && pending.fields && ['name','email','phone','github'].every(key => typeof pending.fields[key] === 'string') &&
    (pending.fields.website === undefined || typeof pending.fields.website === 'string') ? {...pending, fields: {website: '', ...pending.fields}} : null;
}
function joinFields() {
  const fields = Object.fromEntries(JOIN_FIELDS.map(key => [key, $('beta-join-' + key).value.trim()]));
  const pending = pendingJoin(invite);
  // A retry from before schedules were added must preserve its original identity.
  if (pending && pending.fields.schedule === undefined) return fields;
  fields.schedule = normalizeSchedule(scheduleDraft('join')); return fields;
}
function restoreJoinFields(fields) {
  JOIN_FIELDS.forEach(key => { $('beta-join-' + key).value = fields[key] || ''; });
  scheduleDrafts.join = fields.schedule ? JSON.parse(JSON.stringify(fields.schedule)) : null;
  renderScheduleEditor('join');
}
function makeJoinAttempt(invitation, fields) {
  const previous = pendingJoin(invitation);
  if (previous) return previous;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const pending = {joinRequest: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''), fields: {website: '', ...fields}};
  pendingJoins[invitation] = pending;
  if (!writePendingJoins() && fields.schedule) {
    delete pendingJoins[invitation];
    throw new Error('This browser could not safely remember your schedule for a retry. Allow site storage, or try a smaller file or manual entry.');
  }
  return pending;
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
  const start = new Date(workspace.period.startDate + 'T12:00:00Z');
  const end = new Date(workspace.period.endDate + 'T12:00:00Z');
  const days = [];
  for (let value = +start; value <= +end && days.length < 31; value += 86400000) days.push(new Date(value).toISOString().slice(0, 10));
  return days;
}
function setError(message = '') { $('beta-error').textContent = message; $('beta-error').hidden = !message; }
function setBusy(value, preserveEditor = false) {
  busy = value; $('beta-refresh').disabled = value;
  $('beta-refresh').textContent = value ? 'Updating…' : 'Refresh';
  $('beta-sections').querySelectorAll('select, textarea, input, button').forEach(element => { element.disabled = value && !(preserveEditor && (element.matches('#beta-recap-form textarea') || element.dataset.scheduleScope === 'own' && element.tagName !== 'BUTTON')); });
  $('beta-profile').querySelectorAll('input,button').forEach(element => { element.disabled = value && !(preserveEditor && element.id === 'beta-website'); });
  $('beta-main').setAttribute('aria-busy', String(value));
}
function setGateBusy(value, message = '') {
  gateBusy = value;
  $('beta-join-form').querySelectorAll('input,select,button').forEach(element => { element.disabled = value; });
  $('beta-join').textContent = value ? message || 'Opening…' : 'Join this group ↗';
}
function setJoinStep(step, focus = true) {
  joinStep = step;
  ['beta-join-welcome', 'beta-join-details', 'beta-join-schedule', 'beta-join-review'].forEach((id, index) => { $(id).hidden = index !== step; });
  $('beta-join-progress').querySelectorAll('li').forEach((item, index) => {
    item.classList.toggle('completed', index < step);
    if (index === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
  });
  const titles = ['Arya’s two-week beta internship.', 'Let’s get to know you.', 'When are you busy?', 'You’re ready to join.'];
  const intros = ['One beta group, your own two weeks, and room to build. The day you join is day 1.', 'Add your contact details and the GitHub account you’ll use for your internship projects.', 'Add your weekly classes, work, or other commitments, or upload a schedule. Only you, Arya, and Milo can see it.', 'Check your details below. Joining starts your two weeks and saves your place in the group.'];
  $('beta-gate-eyebrow').textContent = 'Step ' + (step + 1) + ' of 4';
  $('beta-gate-title').textContent = titles[step];
  $('beta-gate-intro').textContent = intros[step];
  $('beta-login-error').textContent = '';
  if (step === 2) renderScheduleEditor('join');
  if (step === 3) {
    const pending = pendingJoin(invite), reviewSchedule = pending && pending.fields.schedule === undefined ? null : scheduleDrafts.join;
    $('beta-review-details').innerHTML = [['Name', 'name'], ['Email', 'email'], ['Phone', 'phone'], ['GitHub', 'github'], ['Website', 'website']].filter(([, field]) => field !== 'website' || $('beta-join-website').value.trim()).map(([label, field]) => '<div><dt>' + label + '</dt><dd>' + esc((field === 'github' ? '@' : '') + $('beta-join-' + field).value.trim()) + '</dd></div>').join('') + '<div><dt>Schedule</dt><dd>' + esc(scheduleSummary(reviewSchedule)) + '</dd></div>';
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
  const website = $('beta-join-website');
  const validWebsite = !website.value.trim() || Boolean(websiteUrl(website.value));
  website.setCustomValidity(validWebsite ? '' : WEBSITE_ERROR);
  if (!validWebsite) { setJoinStep(1, false); website.focus(); website.reportValidity(); $('beta-login-error').textContent = WEBSITE_ERROR; return false; }
  const phone = $('beta-join-phone'), digits = phone.value.replace(/\D/g, '');
  const validPhone = /^\+?[0-9\s().-]+$/.test(phone.value.trim()) && digits.length >= 7 && digits.length <= 15;
  phone.setCustomValidity(validPhone ? '' : 'Enter a phone number with 7 to 15 digits, including your country code if needed.');
  const github = $('beta-join-github');
  github.setCustomValidity(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(github.value.trim()) ? '' : 'Enter your GitHub username using letters, numbers, and single hyphens between them.');
  const email = $('beta-join-email');
  email.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? '' : 'Enter a complete email address, including its domain.');
  const inputs = Array.from($('beta-join-details').querySelectorAll('input'));
  const invalid = inputs.find(input => !input.checkValidity() || (input.id !== 'beta-join-website' && !input.value.trim()));
  if (invalid) {
    setJoinStep(1, false); invalid.focus(); invalid.reportValidity();
    if (!invalid.value.trim()) $('beta-login-error').textContent = 'Fill in your ' + ({name: 'name', email: 'email address', phone: 'phone number', github: 'GitHub username'}[invalid.name] || 'details') + ' to continue.';
    return false;
  }
  return true;
}
function showGate(message = '', join = false, forget = false) {
  generation++; githubGeneration++;
  token = ''; workspace = null; recapDraft = null; websiteDraft = null; scheduleDrafts = {join: null, own: null}; scheduleDirty = false; scheduleRead++; githubStates = []; githubKey = ''; accessCapability = ''; showReturnLink = false; attendanceDay = '';
  if (forget) forgetIdentity();
  $('beta-workspace').hidden = true; $('beta-gate').hidden = false;
  ['beta-summary', 'beta-sections', 'beta-nav', 'beta-profile'].forEach(id => $(id).replaceChildren());
  $('beta-join-schedule-editor').replaceChildren();
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
  if (out.manager !== false || !out.member?.id || out.member.status !== 'active' || !out.batch || out.batch.active === false || out.group?.active === false) {
    const error = new Error('This beta workspace is unavailable. Ask Arya about your access.'); error.code = 'AUTH_REQUIRED'; throw error;
  }
  const permissions = Array.isArray(out.permissions) ? out.permissions.filter(value => ['attendance', 'github', 'recap'].includes(value)) : [];
  const period = {startDate: out.member.startDate || out.batch.startDate, endDate: out.member.endDate || out.batch.endDate};
  return {...out, group: out.group || out.batch, period, permissions, peers: Array.isArray(out.peers) ? out.peers : [], attendance: Array.isArray(out.attendance) ? out.attendance : [], recaps: (out.recaps || []).filter(recap => recap.memberId === out.member.id), schedules: (Array.isArray(out.schedules) ? out.schedules : []).filter(schedule => schedule.memberId === out.member.id)};
}
function emptyState(title, description) { return '<div class="empty-state"><h3>' + esc(title) + '</h3><p>' + esc(description) + '</p></div>'; }
function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase(); }
function heading(id, title, detail, aside = '') { return '<div class="section-head"><div><h2 id="beta-heading-' + id + '">' + title + '</h2><p class="section-description">' + detail + '</p></div>' + aside + '</div>'; }
function websitesSection() {
  const links = workspace.peers.map(peer => ({peer, url: websiteUrl(peer.website)})).filter(item => item.url);
  const names = links.map(({peer, url}) => '<li><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(peer.name) + '<span aria-hidden="true">↗</span></a></li>').join('');
  return '<section class="section websites-section" id="beta-section-websites" aria-labelledby="beta-heading-websites">' + heading('websites', 'Personal sites', 'Your group’s websites and portfolios.') + (links.length ? '<ul class="portfolio-names">' + names + '</ul>' : '<p class="portfolio-empty">Add your website in your profile to be the first name here.</p>') + '</section>';
}
function scheduleSection() {
  const saved = workspace.schedules[0], download = saved?.mode === 'file' && saved.ready !== false ? '<button type="button" class="button" id="beta-schedule-download">Download saved file ↗</button>' : '';
  return '<section class="section" id="beta-section-schedule" aria-labelledby="beta-heading-schedule">' + heading('schedule', 'Your schedule', 'Your weekly commitments. Visible only to you, Arya, and Milo.', download) + '<form id="beta-schedule-form" class="schedule-form" novalidate><div id="beta-own-schedule-editor">' + scheduleEditor('own') + '</div><div class="schedule-footer"><p>' + (saved ? 'Last saved ' + esc(dateLabel(saved.updatedAt, true) || '') : 'You haven’t added a schedule yet.') + '</p><button class="button primary" type="submit">Save schedule</button></div></form></section>';
}
function attendanceSection() {
  const days = batchDays(), currentDay = today();
  const lastAllowedDay = workspace.period.endDate < currentDay ? workspace.period.endDate : currentDay;
  if (!days.includes(attendanceDay) || attendanceDay > lastAllowedDay) attendanceDay = lastAllowedDay;
  const present = workspace.attendance.some(record => record.memberId === workspace.member.id && record.day === attendanceDay);
  const peers = workspace.peers.slice().sort((a, b) => Number(b.id === workspace.member.id) - Number(a.id === workspace.member.id) || a.name.localeCompare(b.name));
  const dates = days.map(day => '<th scope="col" class="attendance-day' + (day === currentDay ? ' current-day' : '') + '"><span>' + esc(new Date(day + 'T12:00:00Z').toLocaleDateString(undefined, {weekday: 'narrow', timeZone: 'UTC'})) + '</span>' + Number(day.slice(-2)) + '</th>').join('');
  const rows = peers.map(peer => {
    const peerDays = new Set(workspace.attendance.filter(record => record.memberId === peer.id).map(record => record.day));
    return '<tr><th scope="row"><span class="peer-name">' + esc(peer.name) + (peer.id === workspace.member.id ? ' <span class="you-pill">You</span>' : '') + '</span>' + (peer.github ? '<span class="peer-handle">@' + esc(peer.github) + '</span>' : '') + '</th>' + days.map(day => {
      const outside = (peer.startDate && day < peer.startDate) || (peer.endDate && day > peer.endDate);
      return '<td class="attendance-cell' + (day > currentDay || outside ? ' upcoming' : '') + (day === currentDay ? ' current-day' : '') + '"><span class="attendance-mark' + (peerDays.has(day) ? ' attended' : '') + '" aria-label="' + esc(peer.name + ', ' + dateLabel(day) + ': ' + (peerDays.has(day) ? 'attended' : outside ? 'outside their beta period' : day > currentDay ? 'upcoming' : 'no attendance recorded')) + '">' + (peerDays.has(day) ? '✓' : outside ? '—' : '·') + '</span></td>';
    }).join('') + '<td class="attendance-total">' + days.filter(day => peerDays.has(day)).length + '</td></tr>';
  }).join('');
  const action = lastAllowedDay >= workspace.period.startDate ? '<div class="attendance-tools"><label class="sr-only" for="beta-attendance-day">Your attendance date</label><input type="date" id="beta-attendance-day" value="' + esc(attendanceDay) + '" min="' + esc(workspace.period.startDate) + '" max="' + esc(lastAllowedDay) + '"><button class="button' + (present ? '' : ' primary') + '" id="beta-today" data-present="' + present + '" type="button">' + (present ? '✓ Attended · Undo' : 'Mark attended') + '</button></div>' : '<span class="section-count">Starts ' + esc(dateLabel(workspace.period.startDate)) + '</span>';
  const table = '<div class="attendance-scroll" role="region" tabindex="0" aria-label="Group attendance, scroll to see every day"><table class="attendance-table"><thead><tr><th scope="col">Beta group</th>' + dates + '<th scope="col" class="attendance-total">Days</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  return '<section class="section" id="beta-section-attendance" aria-labelledby="beta-heading-attendance">' + heading('attendance', 'Show up together.', 'Your group’s attendance during your 14 days. Everyone starts on their own join date.', action) + (peers.length && days.length ? table : emptyState('Your group is getting started.', 'Attendance will appear here as people join.')) + '<div class="section-footnote"><span><span class="legend-dot"></span> Attended</span><span>Attendance dates use New York time.</span></div></section>';
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
  return '<section class="section" id="beta-section-recap" aria-labelledby="beta-heading-recap">' + heading('recap', 'Two weeks. What changed?', 'Look back on what you learned and what you made.', '<span class="pill">Due ' + esc(dateLabel(workspace.period.endDate)) + '</span>') + '<form id="beta-recap-form" class="recap-form"><div class="recap-fields"><div><label for="beta-learned"><span class="field-number">01</span> What did you learn?</label><textarea id="beta-learned" name="learned" maxlength="12000" placeholder="New skills, ideas, and things you understand better now…"></textarea></div><div><label for="beta-accomplished"><span class="field-number">02</span> What did you accomplish?</label><textarea id="beta-accomplished" name="accomplished" maxlength="12000" placeholder="What you shipped, contributed, or moved forward…"></textarea></div></div><div class="recap-links"><label for="beta-recap-links">Links to your work <span>(optional)</span></label><textarea id="beta-recap-links" name="links" maxlength="6000" placeholder="One https:// link per line"></textarea></div><div class="recap-footer"><p id="beta-recap-status">' + esc(status) + '</p><div><button class="button" type="submit" value="draft">Save draft</button><button class="button primary" type="submit" value="submit">' + (submitted ? 'Update recap' : 'Submit recap') + ' ↗</button></div></div></form></section>';
}
function render() {
  const member = workspace.member;
  $('beta-greeting').textContent = 'Hey, ' + String(member.name || 'there').trim().split(/\s+/)[0] + '.';
  $('beta-batch').textContent = workspace.group.name || member.batch || 'Beta group';
  $('beta-batch-side').textContent = workspace.group.name || member.batch || 'Beta group'; $('beta-avatar').textContent = initials(member.name);
  $('beta-nav').innerHTML = [['websites', 'Personal sites'], ['attendance', 'Group attendance'], ['github', 'GitHub activity'], ['schedule', 'Your schedule'], ['recap', 'Your recap']].filter(([module]) => ['websites', 'schedule'].includes(module) || allowed(module)).map(([module, label]) => '<a href="#beta-section-' + module + '">' + label + '<span aria-hidden="true">↗</span></a>').join('');
  const myDays = new Set(workspace.attendance.filter(record => record.memberId === member.id).map(record => record.day));
  $('beta-summary').innerHTML = '<div class="summary-card"><span>Your beta period</span><div class="summary-dates">' + esc(dateLabel(workspace.period.startDate)) + '<span>—</span>' + esc(dateLabel(workspace.period.endDate)) + '</div><p>Two weeks to learn and build</p></div><div class="summary-card"><span>In your group</span><div class="summary-value">' + workspace.peers.length + '<small> ' + (workspace.peers.length === 1 ? 'intern' : 'interns') + '</small></div><p>Progress happens together</p></div>' + (allowed('attendance') ? '<div class="summary-card"><span>You showed up</span><div class="summary-value">' + myDays.size + '<small> ' + (myDays.size === 1 ? 'day' : 'days') + '</small></div><p>Your recorded attendance</p></div>' : '');
  $('beta-sections').innerHTML = websitesSection() + (allowed('attendance') ? attendanceSection() : '') + (allowed('github') ? githubSection() : '') + scheduleSection() + (allowed('recap') ? recapSection() : '');
  if (allowed('recap')) {
    const recap = recapDraft || workspace.recaps[0] || {};
    $('beta-learned').value = recap.learned || ''; $('beta-accomplished').value = recap.accomplished || '';
    $('beta-recap-links').value = Array.isArray(recap.links) ? recap.links.join('\n') : recap.links || '';
  }
  $('beta-updated').textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
  $('beta-gate').hidden = true; $('beta-workspace').hidden = false;
  $('beta-recovery').hidden = !(showReturnLink && accessCapability); $('beta-return-link').value = returnLink();
  $('beta-profile').hidden = false;
  $('beta-profile').innerHTML = '<div><span class="eyebrow">Your profile</span><h2>' + esc(member.name) + '</h2><p>' + esc(workspace.group.name || member.batch) + '</p></div><div class="profile-contact"><span>' + esc(member.email) + '</span><span>' + esc(member.phone) + '</span></div><div class="profile-links">' + (member.github ? '<a href="https://github.com/' + encodeURIComponent(member.github) + '" target="_blank" rel="noopener noreferrer">@' + esc(member.github) + ' ↗</a>' : '') + (accessCapability ? '<button class="button subtle" id="beta-show-link" type="button">Personal return link</button>' : '') + '</div><form id="beta-website-form" class="profile-website" novalidate><label for="beta-website">Website / portfolio <span>(optional)</span></label><div class="website-input-row"><input id="beta-website" name="website" type="text" inputmode="url" autocomplete="url" autocapitalize="none" spellcheck="false" maxlength="300" placeholder="yourname.com" aria-describedby="beta-website-help beta-website-error"><button class="button" type="submit">Save website</button></div><p id="beta-website-help">Your name links to this site on the beta home page. Leave it blank and save to remove it.</p><p id="beta-website-error" class="website-error" role="alert" hidden></p></form>';
  $('beta-website').value = websiteDraft === null ? member.website || '' : websiteDraft;
}
function refreshGithub(force = false) {
  if (!allowed('github')) return;
  const key = JSON.stringify([workspace.peers.map(peer => [peer.id, peer.github]), workspace.period.startDate, workspace.period.endDate]);
  if (!force && githubKey === key) return;
  githubKey = key;
  const requestGeneration = ++githubGeneration;
  const options = {startDate: workspace.period.startDate, endDate: workspace.period.endDate};
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
  // An automatic access check must leave a focused editor and its cursor intact.
  // Changed identity, access, or a failed session still clears the old view.
  if (previousMember !== workspace.member.id) scheduleDirty = false;
  if (!scheduleDirty) scheduleDrafts.own = null;
  if (!(preserveEditor && previousMember === workspace.member.id && previousBatch === workspace.batch.id && (allowed('recap') && $('beta-recap-form')?.contains(document.activeElement) || $('beta-website-form')?.contains(document.activeElement) || $('beta-schedule-form')?.contains(document.activeElement)))) render();
  refreshGithub(); return true;
}
async function refresh(preserveEditor = false) {
  if (!token || busy) return;
  const requestGeneration = generation;
  const keepEditor = preserveEditor && Boolean($('beta-recap-form')?.contains(document.activeElement) || $('beta-website-form')?.contains(document.activeElement) || $('beta-schedule-form')?.contains(document.activeElement));
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
  $('beta-join-form').reset(); $('beta-review-details').replaceChildren(); $('beta-join-schedule-editor').replaceChildren(); scheduleDrafts.join = null; $('beta-greeting').focus({preventScroll: true});
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
      restoreJoinFields(attempt.fields); setJoinStep(error.joinSaved === false ? 1 : 3, false);
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
async function saveWebsite(value) {
  if (!token || !workspace || busy) return;
  const raw = String(value || '').trim(), website = websiteUrl(raw), requestGeneration = generation;
  websiteDraft = raw;
  $('beta-website-error').textContent = '';
  $('beta-website-error').hidden = true;
  if (raw && !website) {
    $('beta-website-error').textContent = WEBSITE_ERROR; $('beta-website-error').hidden = false;
    $('beta-website').focus(); return;
  }
  setError(); $('beta-notice').textContent = ''; setBusy(true);
  try {
    const out = await betaCall('memberprofile', {website}, requestGeneration);
    if (requestGeneration !== generation) return;
    const next = normalize(out);
    if (next.member.id !== workspace.member.id) throw new Error('Your profile could not be verified. Refresh and try again.');
    workspace = next; websiteDraft = null; render(); refreshGithub();
    $('beta-notice').textContent = website ? 'Your website is saved.' : 'Your website was removed.';
  } catch (error) {
    if (requestGeneration !== generation) return;
    if (isAccessError(error)) handleError(error);
    else { $('beta-website-error').textContent = error.message || 'Your website could not be saved. Please try again.'; $('beta-website-error').hidden = false; }
  } finally { if (requestGeneration === generation) setBusy(false); }
}
async function saveSchedule() {
  if (!token || !workspace || busy) return;
  let schedule;
  try { schedule = normalizeSchedule(scheduleDraft('own'), {allowExistingFile: true}); }
  catch (error) { scheduleError('own', error.message); return; }
  const requestGeneration = generation, memberId = workspace.member.id;
  scheduleError('own'); setError(); $('beta-notice').textContent = ''; setBusy(true);
  try {
    const out = await betaCall('schedulesave', {schedule}, requestGeneration);
    if (requestGeneration !== generation) return;
    const next = normalize(out);
    if (next.member.id !== memberId) throw new Error('Your profile could not be verified. Refresh and try again.');
    workspace = next; scheduleDrafts.own = null; scheduleDirty = false; render(); refreshGithub(); $('beta-notice').textContent = 'Your private schedule is saved.';
  } catch (error) {
    if (requestGeneration !== generation) return;
    if (isAccessError(error)) handleError(error); else scheduleError('own', error.message || 'Your schedule could not be saved. Please try again.');
  } finally { if (requestGeneration === generation) setBusy(false); }
}
async function downloadSchedule() {
  if (!token || !workspace || busy) return;
  const requestGeneration = generation, memberId = workspace.member.id, timezone = workspace.schedules[0]?.timezone || 'America/New_York';
  setBusy(true); scheduleError('own');
  try {
    const out = await betaCall('schedulefile', {id: memberId}, requestGeneration);
    if (requestGeneration !== generation || workspace?.member.id !== memberId) return;
    const file = normalizeSchedule({mode: 'file', timezone, file: out.file}).file;
    const bytes = Uint8Array.from(atob(file.data), character => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], {type: file.type}));
    const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { if (requestGeneration === generation) { if (isAccessError(error)) handleError(error); else scheduleError('own', error.message || 'This file could not be downloaded. Try again.'); } }
  finally { if (requestGeneration === generation) setBusy(false); }
}
async function loadInvite(invitation = PERMANENT_INVITE) {
  invite = invitation; inviteBatch = null; joinStep = 0; showGate('', true);
  const requestGeneration = generation; setGateBusy(true, 'Opening Beta…');
  $('beta-invite-summary').replaceChildren(); $('beta-join-form').reset(); $('beta-review-details').replaceChildren();
  try {
    let remembered = null, resumeError = '';
    const checkRemembered = async () => {
      try { remembered = await readRememberedIdentity(requestGeneration); }
      catch (error) { resumeError = error.message || 'Your saved profile could not be checked. Reload this page to try again.'; }
    };
    // The permanent link first opens an existing profile, including older groups.
    // Opaque invitations still check their destination before restoring a profile.
    if (invitation === PERMANENT_INVITE) {
      await checkRemembered();
      if (requestGeneration !== generation) return;
      if (remembered) { await openIdentity(remembered, requestGeneration); return; }
    }
    const out = invitation === PERMANENT_INVITE
      ? await api('internal', 'betagroup')
      : await api('internal', 'betainvite', {invite: invitation});
    if (requestGeneration !== generation) return;
    if (!out.batch || out.batch.active === false) throw new Error('Beta is not accepting new interns right now. Ask Arya or Milo about joining.');
    inviteBatch = out.batch;
    if (invitation !== PERMANENT_INVITE) await checkRemembered();
    if (requestGeneration !== generation) return;
    if (remembered?.out.member.batchId === inviteBatch.id) { await openIdentity(remembered, requestGeneration); return; }
    $('beta-invite-summary').innerHTML = '<strong>' + esc(out.group?.name || inviteBatch.name || 'Beta') + '</strong><span>14 days, starting the day you join</span>';
    $('beta-recap-due').textContent = 'day 14 of your internship';
    const pending = pendingJoin(invitation);
    if (pending) { restoreJoinFields(pending.fields); setJoinStep(3); $('beta-login-error').textContent = 'Your previous join was not confirmed. Retry with these details to safely reopen the same profile.'; }
    else { setJoinStep(0); $('beta-login-error').textContent = resumeError; }
  } catch (error) { if (requestGeneration === generation) showGate(error.message || 'Beta could not be opened. Please reload to try again.'); }
  finally { if (requestGeneration === generation) setGateBusy(false); }
}
async function restoreProfile() {
  return loadInvite(PERMANENT_INVITE);
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
  if (joinStep === 2) { if (validateJoinSchedule()) setJoinStep(3); return; }
  const pending = pendingJoin(invite);
  if ((!pending || pending.fields.schedule !== undefined) && !validateJoinSchedule()) return;
  let fields;
  try { fields = joinFields(); } catch (error) { scheduleError('join', error.message); return; }
  if (pending && Object.keys(fields).some(key => JSON.stringify(fields[key]) !== JSON.stringify(pending.fields[key]))) {
    restoreJoinFields(pending.fields); setJoinStep(3, false);
    $('beta-login-error').textContent = 'Your previous join may already be saved. Retry with the original details shown here so we can safely reopen that profile.';
    return;
  }
  try { submitJoin(fields).catch(error => { $('beta-login-error').textContent = error.message || 'Your browser could not prepare a secure join. Please try again.'; setGateBusy(false); }); }
  catch (error) { $('beta-login-error').textContent = 'Your browser could not prepare a secure join. Please try again.'; }
});
$('beta-join-start').addEventListener('click', () => { if (!gateBusy && inviteBatch) setJoinStep(1); });
$('beta-details-back').addEventListener('click', () => { if (!gateBusy) setJoinStep(0); });
$('beta-details-next').addEventListener('click', () => { if (!gateBusy && validateJoinDetails()) setJoinStep(2); });
$('beta-schedule-back').addEventListener('click', () => { if (!gateBusy) setJoinStep(1); });
$('beta-schedule-next').addEventListener('click', () => { if (!gateBusy && validateJoinSchedule()) setJoinStep(3); });
$('beta-review-back').addEventListener('click', () => { if (!gateBusy) setJoinStep(1); });
$('beta-join-schedule-editor').addEventListener('input', event => { if (event.target.dataset.scheduleField === 'label' || event.target.dataset.scheduleField === 'start' || event.target.dataset.scheduleField === 'end') scheduleChange(event); });
$('beta-join-schedule-editor').addEventListener('change', scheduleChange);
$('beta-join-schedule-editor').addEventListener('click', scheduleAction);
$('beta-join-schedule-editor').addEventListener('dragover', scheduleDrop);
$('beta-join-schedule-editor').addEventListener('drop', scheduleDrop);
$('beta-refresh').addEventListener('click', () => refresh());
$('beta-signout').addEventListener('click', () => {
  const previousToken = token; showGate('', false, true); invite = ''; inviteBatch = null; clearRouteFragment();
  pendingJoins = {}; writePendingJoins(); $('beta-join-form').reset(); $('beta-review-details').replaceChildren(); $('beta-gate-title').focus({preventScroll: false});
  if (previousToken) api('internal', 'logout', {}, previousToken).catch(() => {});
  restoreProfile();
});
$('beta-copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(returnLink()); $('beta-copy-link').textContent = 'Copied'; }
  catch (_) { $('beta-return-link').focus(); $('beta-return-link').select(); $('beta-copy-link').textContent = 'Select and copy the link'; }
});
$('beta-hide-link').addEventListener('click', () => { showReturnLink = false; $('beta-return-link').value = ''; $('beta-recovery').hidden = true; });
$('beta-profile').addEventListener('click', event => { if (event.target.closest('#beta-show-link')) { showReturnLink = true; $('beta-return-link').value = returnLink(); $('beta-recovery').hidden = false; } });
$('beta-profile').addEventListener('submit', event => { if (event.target.id === 'beta-website-form') { event.preventDefault(); saveWebsite($('beta-website').value); } });
$('beta-profile').addEventListener('input', event => {
  if (event.target.id !== 'beta-website') return;
  websiteDraft = event.target.value; $('beta-website-error').textContent = ''; $('beta-website-error').hidden = true;
});
$('beta-sections').addEventListener('click', event => {
  if (scheduleAction(event)) return;
  if (event.target.closest('#beta-schedule-download')) { downloadSchedule(); return; }
  if (event.target.closest('#beta-github-refresh')) { refreshGithub(true); return; }
  const button = event.target.closest('#beta-today');
  if (button && allowed('attendance') && !busy) mutate(button.dataset.present === 'true' ? 'attendanceremove' : 'attendance', {day: attendanceDay}, button.dataset.present === 'true' ? 'Your attendance was removed for ' + dateLabel(attendanceDay) + '.' : 'You’re marked as attended on ' + dateLabel(attendanceDay) + '.');
});
$('beta-sections').addEventListener('change', event => {
  if (event.target.dataset.scheduleScope) { scheduleChange(event); return; }
  if (event.target.id !== 'beta-attendance-day' || !workspace || busy) return;
  const value = event.target.value;
  if (!batchDays().includes(value) || value > today()) { setError('Choose a date within your beta period, up to today.'); return; }
  attendanceDay = value; setError(); render();
});
$('beta-sections').addEventListener('input', event => { if (event.target.dataset.scheduleScope) { if (['label', 'start', 'end'].includes(event.target.dataset.scheduleField)) scheduleChange(event); return; } if (event.target.closest('#beta-recap-form')) recapDraft = {learned: $('beta-learned').value, accomplished: $('beta-accomplished').value, links: $('beta-recap-links').value}; });
$('beta-sections').addEventListener('dragover', scheduleDrop);
$('beta-sections').addEventListener('drop', scheduleDrop);
$('beta-sections').addEventListener('submit', event => {
  if (event.target.id === 'beta-schedule-form') { event.preventDefault(); saveSchedule(); return; }
  if (event.target.id !== 'beta-recap-form') return;
  event.preventDefault(); if (!allowed('recap') || busy) return;
  const submit = event.submitter?.value === 'submit';
  const learned = $('beta-learned').value.trim(), accomplished = $('beta-accomplished').value.trim();
  const links = $('beta-recap-links').value.split('\n').map(link => link.trim()).filter(Boolean);
  if (submit && (!learned || !accomplished)) { setError('Add what you learned and accomplished before submitting your recap.'); return; }
  if (links.length > 12 || links.some(link => { try { return link.length > 2000 || /\s/.test(link) || !['https:', 'http:'].includes(new URL(link).protocol); } catch (_) { return true; } })) { setError('Add up to 12 complete http:// or https:// links, one per line.'); return; }
  mutate('recap', {learned, accomplished, links, submit}, submit ? 'Your recap was submitted to Arya and Milo.' : 'Your recap draft is saved.');
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
setInterval(() => { if (!document.hidden) refresh(true); }, 90000);

window.addEventListener('hashchange', handleLocationChange);
handleLocationChange();
