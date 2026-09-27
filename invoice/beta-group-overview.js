import {betaGithubUsername} from './beta-github.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const list = value => Array.isArray(value) ? value : [];
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const statusLabels = {ready:'Ready to start', draft:'In progress', submitted:'Awaiting review', changes_requested:'Changes requested', approved:'Approved', locked:'Locked'};
const dateLabel = value => validDay(value) ? new Date(value + 'T12:00:00Z').toLocaleDateString('en-US', {month:'short', day:'numeric', timeZone:'UTC'}) : 'Dates unavailable';
const latestStamp = row => Math.max(0, ...['updatedAt', 'reviewedAt', 'submittedAt'].map(key => Date.parse(row?.[key]) || 0));

function githubFor(member, states, range) {
  const raw = member.github || member.githubUsername || '', username = betaGithubUsername(raw);
  const base = {status:'loading', total:null, partial:false, message:'Loading public commits…'};
  if (!raw) return {...base, status:'missing', message:'No GitHub linked'};
  if (!username) return {...base, status:'error', message:'Check GitHub username'};
  if (!range.valid) return {...base, status:'error', message:'Dates unavailable'};
  if (range.startDate > range.throughDate) return {...base, status:'future', message:'Period has not started'};
  const candidates = states.filter(state => state?.memberId === member.id &&
    String(state.username || '').toLowerCase() === username.toLowerCase() &&
    state.startDate === range.startDate && state.endDate === range.endDate && state.throughDate === range.throughDate);
  const state = candidates.at(-1);
  if (!state) return base;
  if (state.status === 'loading') return base;
  if (!['ready', 'partial'].includes(state.status) || !Number.isSafeInteger(state.total) || state.total < 0)
    return {...base, status:'error', message:state.message || 'Public activity unavailable'};
  // Counts must agree with the dated entries emitted by the public activity reader.
  // A result from another range, or an incomplete malformed result, is never a zero.
  const entries = state.days && typeof state.days === 'object' && !Array.isArray(state.days) ? Object.entries(state.days) : null;
  if (!entries || entries.some(([day, count]) => !validDay(day) || day < range.startDate || day > range.throughDate || !Number.isSafeInteger(count) || count < 0) ||
    entries.reduce((sum, [, count]) => sum + count, 0) !== state.total)
    return {...base, status:'error', message:'Public activity unavailable'};
  const partial = state.status === 'partial' || state.partial === true;
  return {status:partial ? 'partial' : 'ready', total:state.total, partial,
    message:partial ? 'Partial public activity' : state.total ? 'Public authored commits' : 'No public commits found'};
}

export function buildBetaGroupOverview(data, githubStates = [], {now = Date.now} = {}) {
  if (data?.manager !== true) return null;
  const time = new Date(typeof now === 'function' ? now() : now);
  const today = Number.isFinite(time.getTime()) ? time.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const members = [...new Map(list(data.members).filter(member => member?.id).map(member => [member.id, member])).values()];
  const memberIds = new Set(members.map(member => member.id));
  const catalog = [...new Map(list(data.challengeCatalog).filter(challenge => challenge?.id).map(challenge => [challenge.id, challenge])).values()];
  const roadmapEnabled = data.betaRoadmap === true && catalog.length > 0;
  const challengeIds = new Set(catalog.map(challenge => challenge.id)), progress = new Map();
  if (roadmapEnabled) for (const row of list(data.challengeProgress)) {
    if (!row || !memberIds.has(row.memberId) || !challengeIds.has(row.challengeId) || !['draft', 'submitted', 'changes_requested', 'approved'].includes(row.status)) continue;
    const key = JSON.stringify([row.memberId, row.challengeId]), old = progress.get(key);
    if (!old || latestStamp(row) >= latestStamp(old)) progress.set(key, row);
  }
  const attendance = new Map(members.map(member => [member.id, new Set()]));
  for (const row of list(data.attendance)) if (row && memberIds.has(row.memberId) && validDay(row.day)) attendance.get(row.memberId).add(row.day);
  const batches = new Map(list(data.batches).filter(Boolean).map(batch => [batch.id, batch]));
  const totals = {memberCount:members.length, activeCount:0, attendanceDays:0, attendanceUnknown:0,
    approvedAssignments:0, awaitingReview:0, changesRequested:0, recapsSubmitted:new Set(list(data.recaps).filter(recap => memberIds.has(recap?.memberId) && recap.submittedAt).map(recap => recap.memberId)).size, assignmentSlots:roadmapEnabled ? members.length * catalog.length : 0,
    publicCommits:null, githubCounted:0, githubReady:0, githubPartial:0, githubMissing:0, githubLoading:0, githubUnavailable:0};
  const assignments = roadmapEnabled ? catalog.map(challenge => ({id:challenge.id, title:String(challenge.title || 'Untitled challenge'), approved:0, submitted:0, changes_requested:0, draft:0, ready:0, locked:0, total:members.length})) : [];
  const rows = members.map(member => {
    const startDate = member.startDate, endDate = member.endDate;
    const valid = validDay(startDate) && validDay(endDate) && startDate <= endDate;
    const range = {startDate, endDate, throughDate:valid && endDate < today ? endDate : today, valid};
    const days = valid ? [...attendance.get(member.id)].filter(day => day >= startDate && day <= range.throughDate).sort() : [];
    const github = githubFor(member, list(githubStates), range);
    const batch = batches.get(member.batchId) || data.group;
    const accessStatus = member.status === 'active' && batch?.active === false ? 'Group closed' : String(member.status || 'Unknown');
    const active = member.status === 'active' && batch?.active !== false;
    const saved = catalog.map(challenge => progress.get(JSON.stringify([member.id, challenge.id])));
    const firstOpen = saved.findIndex(row => row?.status !== 'approved');
    const steps = roadmapEnabled ? catalog.map((challenge, index) => {
      const record = saved[index], status = record?.status || (index === firstOpen ? 'ready' : 'locked');
      assignments[index][status]++;
      // Submitted definitions stay pinned when an admin changes the catalog.
      const definition = ['approved', 'submitted'].includes(status) ? record?.definition : null;
      return {id:challenge.id, title:String(definition?.title || challenge.title || 'Untitled challenge'), status};
    }) : [];
    const approved = steps.filter(step => step.status === 'approved').length;
    const awaitingReview = steps.filter(step => step.status === 'submitted').length;
    const changesRequested = steps.filter(step => step.status === 'changes_requested').length;
    const current = steps.find(step => step.status === 'submitted') || steps.find(step => step.status === 'changes_requested') || steps.find(step => step.status !== 'approved');
    totals.activeCount += Number(active);
    totals.attendanceDays += days.length;
    totals.attendanceUnknown += Number(!valid);
    totals.approvedAssignments += approved;
    totals.awaitingReview += awaitingReview;
    totals.changesRequested += changesRequested;
    const coverage = {ready:'githubReady', partial:'githubPartial', missing:'githubMissing', loading:'githubLoading'}[github.status] || 'githubUnavailable';
    totals[coverage]++;
    if (github.total !== null) {totals.githubCounted++; totals.publicCommits = (totals.publicCommits || 0) + github.total;}
    return {memberId:member.id, name:String(member.name || 'Unnamed intern'), accessStatus, active, range,
      attendance:{days, count:valid ? days.length : null}, github,
      approved, awaitingReview, changesRequested, assignmentTotal:steps.length, current, steps};
  }).sort((a, b) => a.name.localeCompare(b.name) || String(a.memberId).localeCompare(String(b.memberId)));
  return {rows, totals, assignments, roadmapEnabled};
}

export function betaGroupOverviewHTML(view) {
  if (!view) return '';
  const {rows, totals, assignments, roadmapEnabled} = view;
  const button = (row, section, content, extra = '') => `<button type="button" class="bt-group-link ${extra}" data-group-member="${esc(row.memberId)}" data-group-section="${section}" aria-label="${esc(`${section === 'github' ? 'Public commits' : section === 'roadmap' ? 'Assignments' : section === 'profile' ? 'Profile' : 'Attendance'} for ${row.name}`)}">${content}</button>`;
  const incomplete = totals.githubCounted < totals.memberCount || totals.githubPartial > 0;
  const coverage = [totals.githubReady ? `${totals.githubReady} checked` : '', totals.githubPartial ? `${totals.githubPartial} partial` : '', totals.githubLoading ? `${totals.githubLoading} loading` : '', totals.githubMissing ? `${totals.githubMissing} not linked` : '', totals.githubUnavailable ? `${totals.githubUnavailable} unavailable` : ''].filter(Boolean).join(' · ');
  const stats = [
    {label:'Attendance days', value:totals.attendanceDays, note:`Total days recorded across interns${totals.attendanceUnknown ? ` · ${totals.attendanceUnknown} missing dates` : ''}`},
    {label:'Public commits', value:totals.publicCommits === null ? '—' : `${incomplete ? '≥ ' : ''}${totals.publicCommits}`, note:coverage || 'No activity loaded'},
    {label:'Approved assignments', value:roadmapEnabled ? `${totals.approvedAssignments} / ${totals.assignmentSlots}` : '—', note:roadmapEnabled ? 'Approved work across the whole group' : 'Roadmap unavailable'},
    {label:'Awaiting review', value:roadmapEnabled ? totals.awaitingReview : '—', note:roadmapEnabled ? `${totals.changesRequested} ${totals.changesRequested === 1 ? 'submission needs' : 'submissions need'} changes` : 'Roadmap unavailable', review:true}
  ];
  const title = `<div class="bt-card-head bt-group-head"><div><span class="bt-eyebrow">BETA AT A GLANCE</span><h3>Whole-group overview</h3><p>Attendance and public commits use each intern’s own two-week period, through today (UTC). Assignment progress includes all saved work.</p></div><span>${totals.memberCount} ${totals.memberCount === 1 ? 'intern' : 'interns'} · ${totals.activeCount} active</span></div>`;
  if (!rows.length) return `${title}<div class="bt-group-empty"><strong>The group starts here</strong><p>As interns join, their attendance, public commits, and assignment progress will appear together.</p></div>`;
  const table = `<div class="bt-group-table-wrap"><table class="bt-group-table"><caption>Every intern · select a metric to open the details</caption><thead><tr><th scope="col">Intern</th><th scope="col">Attendance</th><th scope="col">Public commits</th><th scope="col">Assignments</th><th scope="col">Review status</th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${button(row, 'profile', `<strong>${esc(row.name)}</strong><span class="bt-group-access ${row.active ? 'is-active' : ''}">${esc(row.accessStatus)}</span><small>${row.range.valid ? `${esc(dateLabel(row.range.startDate))} – ${esc(dateLabel(row.range.endDate))}` : 'Dates unavailable'}` + '</small>')}</th><td data-label="Attendance">${button(row, 'attendance', `<strong>${row.attendance.count === null ? '—' : `${row.attendance.count} ${row.attendance.count === 1 ? 'day' : 'days'}`}</strong><small>${row.attendance.count === null ? 'Dates unavailable' : row.attendance.days.length ? `Last ${esc(dateLabel(row.attendance.days.at(-1)))}` : 'No days recorded'}</small>`)}</td><td data-label="Public commits">${button(row, 'github', `<strong>${row.github.total === null ? row.github.status === 'loading' ? 'Loading…' : row.github.status === 'missing' ? 'Not linked' : row.github.status === 'future' ? 'Not started' : 'Unavailable' : `${row.github.partial ? '≥ ' : ''}${row.github.total}`}</strong><small>${esc(row.github.message)}</small>`, row.github.partial ? 'is-partial' : '')}</td><td data-label="Assignments">${roadmapEnabled ? button(row, 'roadmap', `<strong>${row.approved} / ${row.assignmentTotal} approved</strong><span class="bt-group-progress" aria-hidden="true"><i style="width:${row.assignmentTotal ? Math.round(row.approved / row.assignmentTotal * 100) : 0}%"></i></span><small>${esc(row.current ? row.current.title : 'All assignments approved')}</small>`) : '<span class="bt-group-unavailable">Roadmap unavailable</span>'}</td><td data-label="Review status">${roadmapEnabled ? button(row, 'roadmap', `<strong>${row.awaitingReview ? `${row.awaitingReview} awaiting review` : row.changesRequested ? 'Changes requested' : row.current ? statusLabels[row.current.status] : 'Complete'}</strong><small>${row.awaitingReview ? 'Open submitted work' : row.changesRequested ? 'Waiting on the intern' : row.current ? 'No review needed yet' : 'All work approved'}</small>`, row.awaitingReview ? 'is-review' : row.changesRequested ? 'is-partial' : '') : '<span class="bt-group-unavailable">—</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  const breakdown = roadmapEnabled ? `<details class="bt-group-assignments" data-group-assignments><summary>Progress by assignment <span>${assignments.length} roadmap steps</span></summary><div class="bt-group-assignment-grid">${assignments.map((assignment, index) => `<article><span class="bt-group-step">${index + 1}</span><div><h4>${esc(assignment.title)}</h4><p><strong>${assignment.approved} / ${assignment.total}</strong> approved</p><div class="bt-group-assignment-counts"><span>${assignment.submitted} awaiting review</span><span>${assignment.changes_requested} need changes</span><span>${assignment.draft + assignment.ready} in progress / ready</span><span>${assignment.locked} locked</span></div></div></article>`).join('')}</div></details>` : '<p class="bt-foot">Assignment totals will appear when the challenge roadmap is available.</p>';
  return `${title}<div class="bt-group-stats">${stats.map(stat => `<div${stat.review && totals.awaitingReview ? ' class="has-review"' : ''}><span>${stat.label}</span><strong>${esc(stat.value)}</strong><small>${esc(stat.note)}</small></div>`).join('')}</div><p class="bt-foot bt-group-scope">Public commits show authored work in owned, non-fork repositories. They are not push-event counts; private work and other owners’ repositories are excluded.${incomplete ? ' The group total is incomplete while activity is partial, loading, unavailable, or not linked.' : ''} Attendance counts recorded days, not an attendance rate.</p>${table}${breakdown}<p class="bt-foot bt-group-recaps">${totals.recapsSubmitted} of ${totals.memberCount} interns have submitted their two-week recap.</p>`;
}
