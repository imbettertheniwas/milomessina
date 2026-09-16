import {saveLead, isLive, INTERESTS, NICHES, PLATFORMS, formatReach, formatCount, reachOf} from '/alex/store.js';

const form = document.getElementById('lead-form');
const banner = document.getElementById('banner');
const done = document.getElementById('done');
const submitBtn = document.getElementById('submit');

/* The form is built from the same lists the dashboard counts, so a new
   offer only ever has to be added in one place. */
document.getElementById('niche').append(...NICHES.map(n => new Option(n, n)));

const OFFER_BLURB = {
  podcast:    'Come on the show as a guest.',
  content:    'Appear in what we shoot and publish.',
  events:     'Invitations to shows, presentations and parties.',
  brand:      'Paid work with the houses we collaborate with.',
  ambassador: 'An ongoing seat with us, season after season.'
};
document.getElementById('opts').innerHTML = INTERESTS.map(i => `
  <label class="opt">
    <input type="checkbox" name="interests" value="${i.id}">
    <span class="box" aria-hidden="true"></span>
    <span class="txt"><span class="t">${i.label}</span><span class="d">${OFFER_BLURB[i.id]}</span></span>
  </label>`).join('');

if (!isLive) document.getElementById('not-live').hidden = false;

/* live character counter */
document.querySelectorAll('[data-count-for]').forEach(el => {
  const t = document.getElementById(el.dataset.countFor);
  const max = t.getAttribute('maxlength');
  const update = () => el.textContent = t.value.length + (max ? '/' + max : '');
  t.addEventListener('input', update);
  update();
});

/* ── validation ───────────────────────────────────────────── */
const field = id => document.getElementById(id);
const errorFor = id => document.getElementById('err-' + id);

function setError(id, message) {
  const input = field(id), slot = errorFor(id);
  if (slot) slot.textContent = message || '';
  if (input && input.type !== 'checkbox') input.setAttribute('aria-invalid', message ? 'true' : 'false');
  return !message;
}

/* "12,500", "12.5k" and "12500" are all things people type. */
function parseFollowers(raw) {
  const text = String(raw || '').trim().toLowerCase().replace(/[, ]/g, '');
  if (!text) return 0;
  const match = text.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!match) return NaN;
  const n = parseFloat(match[1]) * (match[2] === 'm' ? 1e6 : match[2] === 'k' ? 1e3 : 1);
  return Math.round(n);
}

const cleanHandle = v => String(v || '').trim().replace(/^@+/, '').replace(/^https?:\/\/\S*?\/(@?)/, '');

function collect() {
  const platforms = {};
  for (const p of PLATFORMS) {
    platforms[p.id] = {
      handle: cleanHandle(field(p.id).value),
      followers: parseFollowers(field(p.id + '-followers').value) || 0
    };
  }
  return {
    name: field('name').value.trim(),
    email: field('email').value.trim(),
    phone: field('phone').value.trim(),
    city: field('city').value.trim(),
    newToNy: field('newToNy').checked,
    niche: field('niche').value,
    platforms,
    interests: [...form.querySelectorAll('input[name=interests]:checked')].map(c => c.value),
    availability: field('availability').value.trim(),
    links: field('links').value.trim(),
    notes: field('notes').value.trim()
  };
}

function validate(data) {
  let ok = true;
  ok = setError('name', data.name ? '' : 'Please tell us your name.') && ok;
  ok = setError('email', /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(data.email) ? '' : 'Please enter an email we can reach you at.') && ok;
  ok = setError('city', data.city ? '' : 'Let us know where you are.') && ok;
  ok = setError('niche', data.niche ? '' : 'Pick the closest one.') && ok;

  for (const p of PLATFORMS) {
    const raw = field(p.id + '-followers').value.trim();
    const parsed = parseFollowers(raw);
    ok = setError(p.id + '-followers', raw && isNaN(parsed) ? 'Use a number, like 12500 or 12.5k.' : '') && ok;
    ok = setError(p.id, raw && !cleanHandle(field(p.id).value) ? 'Add the handle too.' : '') && ok;
  }

  const anyPlatform = PLATFORMS.some(p => data.platforms[p.id].handle);
  const slot = document.getElementById('err-platforms');
  slot.textContent = anyPlatform ? '' : 'Add at least one of the three so we can see your work.';
  ok = anyPlatform && ok;

  ok = setError('interests', data.interests.length ? '' : 'Choose at least one thing you’re open to.') && ok;

  if (data.links && !/^(https?:\/\/|www\.)\S+\.\S+/i.test(data.links)) {
    ok = setError('links', 'That doesn’t look like a link — or leave it blank.') && ok;
  } else setError('links', '');

  ok = setError('consent', field('consent').checked ? '' : 'We need your permission before we get in touch.') && ok;
  return ok;
}

/* Running total, so someone can see the number we'll be reading. */
const reachLive = document.getElementById('reach-live');
function updateReach() {
  const total = reachOf({platforms: collect().platforms});
  reachLive.textContent = total ? `Total reach: ${formatCount(total)}` : '';
}
form.addEventListener('input', event => {
  if (event.target.name?.endsWith('followers')) updateReach();
  if (event.target.getAttribute('aria-invalid') === 'true') {
    const data = collect();
    if (event.target.id === 'email' && /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(data.email)) setError('email', '');
    else if (['name', 'city'].includes(event.target.id) && event.target.value.trim()) setError(event.target.id, '');
  }
});

/* ── submit ───────────────────────────────────────────────── */
form.addEventListener('submit', async event => {
  event.preventDefault();
  banner.textContent = '';
  banner.className = 'banner';

  const data = collect();
  if (!validate(data)) {
    banner.textContent = 'Have another look — a few things need fixing.';
    banner.className = 'banner bad';
    form.querySelector('[aria-invalid="true"], .err:not(:empty)')
      ?.scrollIntoView({block: 'center', behavior: 'smooth'});
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  try {
    const {lead, stored} = await saveLead(data);
    showDone(lead, stored);
  } catch {
    banner.textContent = 'That didn’t go through. Please try once more in a moment.';
    banner.className = 'banner bad';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send it over';
  }
});

function showDone(lead, stored) {
  const labels = lead.interests.map(id => INTERESTS.find(i => i.id === id)?.label).filter(Boolean);
  const rows = [
    ['Name', lead.name],
    ['Email', lead.email],
    ['Based', lead.city + (lead.newToNy ? ' — new to New York' : '')],
    ['Makes', lead.niche],
    ...PLATFORMS
      .filter(p => lead.platforms[p.id].handle)
      .map(p => [p.label, '@' + lead.platforms[p.id].handle +
        (lead.platforms[p.id].followers ? ' · ' + formatReach(lead.platforms[p.id].followers) : '')]),
    ['Total reach', formatCount(lead.reach)],
    ['Interested in', labels.join(', ')]
  ];
  document.getElementById('recap').innerHTML = rows
    .map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${escapeHtml(v)}</span></div>`).join('');

  document.getElementById('done-lede').textContent = stored === 'remote'
    ? 'We’ll go through this and reach out by email with the opportunities that fit.'
    : 'This is a preview — your answers are shown back to you below, but nothing has been sent to anyone yet.';

  document.getElementById('form').hidden = true;
  done.hidden = false;
  done.scrollIntoView({behavior: 'smooth', block: 'start'});
}

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

document.getElementById('again').addEventListener('click', () => {
  form.reset();
  form.querySelectorAll('[aria-invalid]').forEach(el => el.setAttribute('aria-invalid', 'false'));
  form.querySelectorAll('.err').forEach(el => el.textContent = '');
  updateReach();
  done.hidden = true;
  document.getElementById('form').hidden = false;
  window.scrollTo({top: 0, behavior: 'smooth'});
});
