import {readLeads, updateLead, seedDemo, hasDemo, clearDemo, toCsv, isLive,
        INTERESTS, NICHES, PLATFORMS, STATUSES,
        formatReach, formatCount, formatDate, reachOf} from '/alex/store.js';

seedDemo();

const el = id => document.getElementById(id);
const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

if (!isLive) el('not-live').hidden = false;

el('f-status').append(...STATUSES.map(s => new Option(s.label, s.id)));
el('f-interest').append(...INTERESTS.map(i => new Option(i.label, i.id)));
el('f-niche').append(...NICHES.map(n => new Option(n, n)));

let sort = {key: 'createdAt', dir: -1};

function filtered() {
  const q = el('q').value.trim().toLowerCase();
  const status = el('f-status').value, interest = el('f-interest').value;
  const niche = el('f-niche').value, ny = el('f-ny').value;

  return readLeads().filter(lead => {
    if (status && lead.status !== status) return false;
    if (interest && !(lead.interests || []).includes(interest)) return false;
    if (niche && lead.niche !== niche) return false;
    if (ny === 'yes' && !lead.newToNy) return false;
    if (ny === 'no' && lead.newToNy) return false;
    if (!q) return true;
    const haystack = [lead.name, lead.email, lead.city, lead.niche,
      ...PLATFORMS.map(p => lead.platforms?.[p.id]?.handle)].join(' ').toLowerCase();
    return haystack.includes(q);
  }).sort((a, b) => {
    const {key, dir} = sort;
    if (key === 'reach') return (reachOf(a) - reachOf(b)) * dir;
    if (key === 'status') return (STATUSES.findIndex(s => s.id === a.status) -
                                  STATUSES.findIndex(s => s.id === b.status)) * dir;
    return String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * dir;
  });
}

/* ── tiles: the number is the chart ───────────────────────── */
function renderTiles(rows) {
  const reach = rows.reduce((sum, r) => sum + reachOf(r), 0);
  const booked = rows.filter(r => r.status === 'booked').length;
  const fresh = rows.filter(r => r.newToNy).length;
  const median = (() => {
    if (!rows.length) return 0;
    const sorted = rows.map(reachOf).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  })();

  el('tiles').innerHTML = [
    ['Submissions', formatCount(rows.length), rows.length === 1 ? 'creator' : 'creators in view'],
    ['Combined reach', formatReach(reach), formatCount(reach) + ' followers'],
    ['Median reach', formatReach(median), 'typical creator'],
    ['Booked', formatCount(booked), booked ? 'confirmed so far' : 'none yet'],
    ['New to New York', formatCount(fresh), 'just arrived']
  ].map(([k, v, s]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
}

/* ── single-series bars: one hue for every bar ─────────────── */
function bars(target, items, format) {
  const max = Math.max(1, ...items.map(i => i.value));
  el(target).innerHTML = items.length && items.some(i => i.value)
    ? items.map(i => `
      <div class="bar-row" title="${escapeHtml(i.label)}: ${format(i.value)}">
        <div class="lab"><span>${escapeHtml(i.label)}</span><span class="n">${format(i.value)}</span></div>
        <div class="bar-track" role="img" aria-label="${escapeHtml(i.label)}: ${format(i.value)}">
          <div class="bar-fill" style="width:${(i.value / max * 100).toFixed(1)}%"></div>
        </div>
      </div>`).join('')
    : '<p class="bars empty">Nothing to show for these filters.</p>';
}

function renderBars(rows) {
  bars('bars-interest', INTERESTS.map(i => ({
    label: i.label,
    value: rows.filter(r => (r.interests || []).includes(i.id)).length
  })).sort((a, b) => b.value - a.value), formatCount);

  bars('bars-platform', PLATFORMS.map(p => ({
    label: p.label,
    value: rows.reduce((sum, r) => sum + (Number(r.platforms?.[p.id]?.followers) || 0), 0)
  })).sort((a, b) => b.value - a.value), formatReach);
}

/* ── table ────────────────────────────────────────────────── */
function renderRows(rows) {
  el('empty').hidden = rows.length > 0;
  el('rows').innerHTML = rows.map(lead => {
    const handles = PLATFORMS
      .filter(p => lead.platforms?.[p.id]?.handle)
      .map(p => `@${escapeHtml(lead.platforms[p.id].handle)}`).join(' · ');
    const tags = (lead.interests || [])
      .map(id => INTERESTS.find(i => i.id === id)?.label)
      .filter(Boolean)
      .map(l => `<span class="tag">${escapeHtml(l)}</span>`).join('');
    return `<tr>
      <td>${formatDate(lead.createdAt)}</td>
      <td>
        <span class="who">${escapeHtml(lead.name)}${lead.demo ? '<span class="demo-flag">demo</span>' : ''}</span>
        <span class="sub">${escapeHtml(lead.email)}</span>
        <span class="sub">${handles || '—'}</span>
      </td>
      <td>${escapeHtml(lead.city)}${lead.newToNy ? '<span class="sub">new to NY</span>' : ''}<span class="sub">${escapeHtml(lead.niche)}</span></td>
      <td class="num">${formatReach(reachOf(lead))}</td>
      <td><div class="tags">${tags || '—'}</div></td>
      <td>
        <label class="sr" for="st-${lead.id}">Status for ${escapeHtml(lead.name)}</label>
        <select class="status ${lead.status}" id="st-${lead.id}" data-id="${lead.id}">
          ${STATUSES.map(s => `<option value="${s.id}"${s.id === lead.status ? ' selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </td>
    </tr>`;
  }).join('');
}

function render() {
  const rows = filtered();
  renderTiles(rows);
  renderBars(rows);
  renderRows(rows);
  el('count').textContent = `${rows.length} of ${readLeads().length} shown`;
  el('clear-demo').hidden = !hasDemo();
  document.querySelectorAll('th').forEach(th => {
    const key = th.querySelector('button')?.dataset.sort;
    if (key === sort.key) th.setAttribute('aria-sort', sort.dir === 1 ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  });
  el('stamp').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
}

/* ── wiring ───────────────────────────────────────────────── */
['q', 'f-status', 'f-interest', 'f-niche', 'f-ny'].forEach(id =>
  el(id).addEventListener('input', render));

document.querySelectorAll('th button[data-sort]').forEach(button =>
  button.addEventListener('click', () => {
    const key = button.dataset.sort;
    sort = {key, dir: sort.key === key ? -sort.dir : (key === 'name' ? 1 : -1)};
    render();
  }));

el('rows').addEventListener('change', event => {
  const select = event.target.closest('select.status');
  if (!select) return;
  updateLead(select.dataset.id, {status: select.value});
  render();
});

el('export').addEventListener('click', () => {
  const rows = filtered();
  if (!rows.length) return;
  const blob = new Blob([toCsv(rows)], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `nyfw-influencers-${new Date().toISOString().slice(0, 10)}.csv`
  });
  link.click();
  URL.revokeObjectURL(url);
});

el('clear-demo').addEventListener('click', () => {
  if (confirm('Remove the twelve demo records? Anything submitted through the portal stays.')) {
    clearDemo();
    render();
  }
});

render();
