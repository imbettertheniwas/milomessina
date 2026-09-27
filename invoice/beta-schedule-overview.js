const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const statusLabels = {manual:'Weekly schedule', clear:'No recurring commitments', file:'File to review', missing:'No schedule provided', pending:'Saving unfinished', review:'Schedule needs review'};
const byName = (a, b) => a.name.localeCompare(b.name);
const validTimezone = value => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try { new Intl.DateTimeFormat('en-US', {timeZone:value}).format(); return value; }
  catch { return ''; }
};

export function scheduleClock(value) {
  const [hour, minute] = value.split(':');
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? 'AM' : 'PM'}`;
}

// Weekly wall-clock times stay in their submitted zones: converting them without
// a particular date would silently assume a daylight-saving offset.
export function buildBetaScheduleOverview(data, {batch = 'all', timezone = 'all'} = {}) {
  if (data?.manager !== true) return null;
  const batches = new Map((data.batches || []).map(item => [item.id, item]));
  const schedules = new Map((data.schedules || []).map(item => [item.memberId, item]));
  const rows = (data.members || []).map(member => {
    const schedule = schedules.get(member.id);
    const zone = validTimezone(schedule?.timezone);
    const blocks = (Array.isArray(schedule?.blocks) ? schedule.blocks : []).filter(block =>
      block && Number.isInteger(block.day) && block.day >= 0 && block.day <= 6 &&
      clockPattern.test(block.start) && clockPattern.test(block.end) && block.start < block.end
    ).map(block => ({day:block.day, start:block.start, end:block.end, label:String(block.label || 'Commitment')}));
    let status = 'missing';
    if (schedule) {
      status = schedule.ready !== true ? 'pending' : 'review';
      if (schedule.ready === true && schedule.mode === 'file' && schedule.file) status = 'file';
      if (schedule.ready === true && schedule.mode === 'manual') {
        if (schedule.noCommitments === true && Array.isArray(schedule.blocks) && !schedule.blocks.length) status = 'clear';
        else if (schedule.noCommitments !== true && zone && blocks.length && blocks.length === schedule.blocks.length) status = 'manual';
      }
    }
    return {memberId:member.id, name:String(member.name || 'Unnamed intern'), accessStatus:String(member.status || ''),
      batchId:member.batchId || '', batchName:String(batches.get(member.batchId)?.name || data.group?.name || 'Beta group'),
      timezone:zone, status, statusLabel:statusLabels[status], blocks:status === 'manual' ? blocks : []};
  }).sort(byName);
  const batchOptions = Array.from(new Map(rows.map(row => [row.batchId, {id:row.batchId, name:row.batchName}])).values()).sort(byName);
  const currentBatch = batchOptions.some(item => item.id === batch) ? batch : 'all';
  const inBatch = rows.filter(row => currentBatch === 'all' || row.batchId === currentBatch);
  const timezoneOptions = Array.from(new Set(inBatch.map(row => row.timezone))).sort((a, b) => a.localeCompare(b));
  const currentTimezone = timezoneOptions.includes(timezone) ? timezone : 'all';
  const filtered = inBatch.filter(row => currentTimezone === 'all' || row.timezone === currentTimezone);
  const counts = {manual:0, clear:0, file:0, missing:0, pending:0, review:0};
  const lanes = new Map();
  for (const row of filtered) {
    counts[row.status]++;
    if (row.status !== 'manual') continue;
    if (!lanes.has(row.timezone)) lanes.set(row.timezone, {timezone:row.timezone, days:days.map((name, index) => ({name, day:(index + 1) % 7, blocks:[]}))});
    const lane = lanes.get(row.timezone);
    for (const block of row.blocks) lane.days[(block.day + 6) % 7].blocks.push({...block, memberId:row.memberId, name:row.name});
  }
  for (const lane of lanes.values()) for (const day of lane.days) day.blocks.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || byName(a, b));
  return {rows:filtered, total:rows.length, counts, batch:currentBatch, timezone:currentTimezone, batchOptions, timezoneOptions,
    lanes:Array.from(lanes.values()).sort((a, b) => a.timezone.localeCompare(b.timezone))};
}

export function betaScheduleOverviewHTML(view) {
  if (!view) return '';
  const {rows, counts, lanes} = view;
  const memberButton = row => `<button type="button" class="bt-overview-person bt-overview-${row.status}" data-overview-member="${esc(row.memberId)}"><span><strong>${esc(row.name)}</strong>${row.accessStatus && row.accessStatus !== 'active' ? `<small>${esc(row.accessStatus)}</small>` : ''}</span><span class="bt-overview-state">${esc(row.statusLabel)}</span></button>`;
  const filters = [
    view.batchOptions.length > 1 ? `<label>Beta group<select data-overview-filter="batch"><option value="all">All beta groups</option>${view.batchOptions.map(item => `<option value="${esc(item.id)}"${item.id === view.batch ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>` : '',
    view.timezoneOptions.length > 1 ? `<label>Schedule time zone<select data-overview-filter="timezone"><option value="all">All time zones</option>${view.timezoneOptions.map(zone => `<option value="${esc(zone)}"${zone === view.timezone ? ' selected' : ''}>${esc(zone || 'Time zone not provided')}</option>`).join('')}</select></label>` : ''
  ].filter(Boolean).join('');
  const stats = [[counts.manual, 'weekly schedules'], [counts.clear, 'no recurring commitments'], [counts.file, 'files to review'], [counts.missing + counts.pending + counts.review, 'missing or need attention']];
  return `<div class="bt-card-head"><div><h3>Group schedules</h3><p>Weekly commitments across the beta group · Only Arya and Milo</p></div><span>${rows.length}${rows.length !== view.total ? ` of ${view.total}` : ''} interns</span></div>${filters ? `<div class="bt-overview-filters">${filters}</div>` : ''}${view.total ? `<div class="bt-overview-summary">${stats.map(([count, label]) => `<span><strong>${count}</strong> ${label}</span>`).join('')}</div><p class="bt-foot bt-overview-note">Times use each schedule’s time zone. Empty days mean no recorded commitments, not confirmed availability. Select an intern or a block to open their private schedule.</p>${lanes.length ? lanes.map(lane => `<section class="bt-overview-zone" aria-label="Weekly commitments in ${esc(lane.timezone)}"><h4>${esc(lane.timezone.replaceAll('_', ' '))}</h4><div class="bt-overview-week">${lane.days.map(day => `<section class="bt-overview-day"><h5>${day.name}</h5>${day.blocks.length ? day.blocks.map(block => `<button type="button" class="bt-overview-block" data-overview-member="${esc(block.memberId)}"><strong>${esc(block.name)}</strong><span>${esc(scheduleClock(block.start))} – ${esc(scheduleClock(block.end))}</span><small>${esc(block.label)}</small></button>`).join('') : '<p>No recorded commitments</p>'}</section>`).join('')}</div></section>`).join('') : '<p class="bt-muted bt-overview-empty">No weekly time blocks to show for this selection. Check the schedule status for each intern below.</p>'}<div class="bt-overview-members" aria-label="Schedule status by intern">${rows.map(memberButton).join('') || '<p class="bt-muted">No interns match these filters.</p>'}</div>${counts.file ? '<p class="bt-foot">Uploaded schedules are listed as files to review; their contents are not included in the weekly overview.</p>' : ''}` : '<p class="bt-muted">Group schedules will appear here when interns join and share their schedules.</p>'}`;
}
