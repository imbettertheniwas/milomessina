import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBetaGroupOverview, betaGroupOverviewHTML} from '../invoice/beta-group-overview.js';

const now = () => Date.parse('2026-09-27T18:00:00Z');
const member = (id, over = {}) => ({id, name:'Intern ' + id, github:'intern-' + id, status:'active', batchId:'one', startDate:'2026-09-20', endDate:'2026-10-03', ...over});
const catalog = [{id:'portfolio', title:'Domain & portfolio'}, {id:'spend', title:'Practice spend portal'}, {id:'iterate', title:'Push an improvement'}];
const data = (over = {}) => ({manager:true, betaRoadmap:true, members:[member('a'), member('b')], batches:[{id:'one', active:true}], challengeCatalog:catalog, challengeProgress:[], attendance:[], recaps:[], ...over});
const state = (id, over = {}) => ({memberId:id, username:'intern-' + id, status:'ready', total:2, days:{'2026-09-21':2}, startDate:'2026-09-20', endDate:'2026-10-03', throughDate:'2026-09-27', ...over});
const build = (payload = data(), states = []) => buildBetaGroupOverview(payload, states, {now});

test('overview requires manager access, contains current members only, and does not copy private fields', () => {
  assert.equal(build({...data(), manager:false}), null);
  assert.equal(betaGroupOverviewHTML(null), '');
  const payload = data({members:[member('a', {email:'secret@example.test', phone:'secret phone', notes:'secret notes'})], attendance:[{memberId:'deleted', day:'2026-09-22'}], challengeProgress:[{memberId:'deleted', challengeId:'portfolio', status:'approved'}], recaps:[{memberId:'deleted', submittedAt:'2026-09-22'}]});
  const view = build(payload, [state('deleted', {total:99, days:{'2026-09-21':99}})]);
  assert.equal(view.rows.length, 1);
  assert.equal(view.totals.attendanceDays, 0);
  assert.equal(view.totals.approvedAssignments, 0);
  assert.equal(view.totals.publicCommits, null);
  assert.equal(view.totals.recapsSubmitted, 0);
  assert.doesNotMatch(JSON.stringify(view) + betaGroupOverviewHTML(view), /secret|deleted/);
});

test('attendance deduplicates intern-days and excludes other windows, future dates, and invalid dates', () => {
  const payload = data({members:[member('a'), member('b', {startDate:'2026-09-01', endDate:'2026-09-14'}), member('c', {startDate:'invalid'})], attendance:[
    {memberId:'a', day:'2026-09-20'}, {memberId:'a', day:'2026-09-20'}, {memberId:'a', day:'2026-09-27'},
    {memberId:'a', day:'2026-09-28'}, {memberId:'a', day:'2026-09-19'}, {memberId:'a', day:'2026-02-30'},
    {memberId:'b', day:'2026-09-01'}, {memberId:'b', day:'2026-09-15'}, {memberId:'c', day:'2026-09-24'}
  ]});
  const view = build(payload);
  assert.equal(view.totals.attendanceDays, 3);
  assert.deepEqual(view.rows[0].attendance.days, ['2026-09-20', '2026-09-27']);
  assert.equal(view.rows[1].attendance.count, 1);
  assert.equal(view.rows[2].attendance.count, null);
  assert.equal(view.totals.attendanceUnknown, 1);
});

test('public commits distinguish ready zero, partial lower bound, loading, missing, and failed states', () => {
  const payload = data({members:['a','b','c','d','e'].map(id => member(id, id === 'd' ? {github:''} : {}))});
  const view = build(payload, [state('a', {total:0, days:{}}), state('b', {status:'partial', total:3, days:{'2026-09-22':3}}), state('e', {status:'error', total:null, message:'Rate limited'})]);
  assert.deepEqual(view.rows.map(row => row.github.status), ['ready','partial','loading','missing','error']);
  assert.equal(view.totals.publicCommits, 3);
  assert.equal(view.totals.githubCounted, 2);
  for (const key of ['githubReady','githubPartial','githubLoading','githubMissing','githubUnavailable']) assert.equal(view.totals[key], 1);
  const html = betaGroupOverviewHTML(view);
  assert.match(html, /≥ 3/);
  assert.match(html, /Loading…/);
  assert.match(html, /Not linked/);
  assert.match(html, /Unavailable/);
  assert.match(html, /not push-event counts/);
  assert.match(html, /group total is incomplete/);
});

test('GitHub counts from other handles or windows are ignored; malformed totals never turn into zero', () => {
  for (const over of [{username:'someone-else'}, {startDate:'2026-09-01'}, {endDate:'2026-09-30'}, {throughDate:'2026-09-26'}]) {
    const view = build(data({members:[member('a')]}), [state('a', over)]);
    assert.equal(view.rows[0].github.status, 'loading');
    assert.equal(view.totals.publicCommits, null);
  }
  for (const over of [{total:-1}, {total:2.5}, {total:NaN}, {days:null}, {days:{'2026-09-28':2}}, {days:{'2026-09-19':2}}, {days:{'2026-09-21':1}}, {days:{'2026-09-21':'2'}}]) {
    const view = build(data({members:[member('a')]}), [state('a', over)]);
    assert.equal(view.rows[0].github.status, 'error');
    assert.equal(view.totals.publicCommits, null);
  }
});

test('future windows and invalid GitHub handles remain unknown, while completed windows use their own end date', () => {
  const view = build(data({members:[member('a', {startDate:'2026-10-01', endDate:'2026-10-14'}), member('b', {github:'wrong/name'}), member('c', {startDate:'2026-09-01', endDate:'2026-09-14'})]}), [state('c', {startDate:'2026-09-01', endDate:'2026-09-14', throughDate:'2026-09-14', days:{'2026-09-13':2}})]);
  assert.deepEqual(view.rows.map(row => row.github.status), ['future','error','ready']);
  assert.equal(view.totals.publicCommits, 2);
});

test('assignment counts use unique current member/challenge pairs and explicit approval, with original submitted titles', () => {
  const payload = data({challengeProgress:[
    {memberId:'a', challengeId:'portfolio', status:'approved', updatedAt:'2026-09-24', definition:{title:'Original portfolio assignment'}},
    {memberId:'a', challengeId:'portfolio', status:'draft', updatedAt:'2026-09-21'},
    {memberId:'a', challengeId:'spend', status:'submitted', submittedAt:'2026-09-27', definition:{title:'Original spending brief'}},
    {memberId:'a', challengeId:'spend', status:'submitted', submittedAt:'2026-09-27'},
    {memberId:'b', challengeId:'portfolio', status:'changes_requested'},
    {memberId:'a', challengeId:'deleted', status:'approved'},
    {memberId:'deleted', challengeId:'portfolio', status:'approved'}
  ], roadmaps:{a:{completed:99},b:{completed:99}}});
  // A duplicate with the same timestamp is resolved consistently to the last stored row.
  payload.challengeProgress[3].definition = {title:'Original spending brief'};
  const view = build(payload);
  assert.equal(view.totals.approvedAssignments, 1);
  assert.equal(view.totals.awaitingReview, 1);
  assert.equal(view.totals.changesRequested, 1);
  assert.equal(view.totals.assignmentSlots, 6);
  assert.equal(view.rows[0].current.title, 'Original spending brief');
  assert.equal(view.rows[0].steps[0].title, 'Original portfolio assignment');
  assert.equal(view.rows[0].approved, 1);
  assert.equal(view.assignments[0].title, 'Domain & portfolio');
  assert.equal(view.assignments[0].approved, 1);
  assert.equal(view.assignments[0].changes_requested, 1);
  assert.equal(view.assignments[1].submitted, 1);
  assert.equal(view.assignments[1].locked, 1);
  assert.equal(view.assignments[2].locked, 2);
});

test('all-approved work stays complete even after its two-week period ends, while drafts use current challenge titles', () => {
  const view = build(data({members:[member('a', {startDate:'2026-08-01', endDate:'2026-08-14'}), member('b')], challengeProgress:[...catalog.map(challenge => ({memberId:'a',challengeId:challenge.id,status:'approved',submittedAt:'2026-08-22'})), {memberId:'b',challengeId:'portfolio',status:'draft',definition:{title:'Obsolete draft title'}}]}));
  assert.equal(view.rows[0].current, undefined);
  assert.equal(view.rows[0].approved, 3);
  assert.equal(view.rows[1].current.title, 'Domain & portfolio');
  assert.match(betaGroupOverviewHTML(view), /All assignments approved/);
});

test('closed cohorts do not count as active; recap counts deduplicate current interns', () => {
  const payload = data({members:[member('a'),member('b',{status:'paused'}),member('c',{batchId:'closed'})], batches:[{id:'one',active:true},{id:'closed',active:false}], recaps:[{memberId:'a',submittedAt:'2026-09-26'}, {memberId:'a',submittedAt:'2026-09-27'}, {memberId:'b'}, {memberId:'orphan',submittedAt:'2026-09-27'}]});
  const view = build(payload);
  assert.equal(view.totals.activeCount, 1);
  assert.equal(view.rows[2].accessStatus, 'Group closed');
  assert.equal(view.totals.recapsSubmitted, 1);
  assert.match(betaGroupOverviewHTML(view), /1 of 3 interns have submitted their two-week recap/);
});

test('empty and unavailable roadmaps do not invent completion or review metrics', () => {
  const empty = build(data({members:[]}));
  assert.match(betaGroupOverviewHTML(empty), /The group starts here/);
  assert.doesNotMatch(betaGroupOverviewHTML(empty), /<table/);
  for (const over of [{betaRoadmap:false}, {challengeCatalog:[]}]) {
    const view = build(data(over));
    assert.equal(view.roadmapEnabled, false);
    assert.equal(view.assignments.length, 0);
    assert.equal(view.totals.assignmentSlots, 0);
    assert.match(betaGroupOverviewHTML(view), /Roadmap unavailable/);
    assert.doesNotMatch(betaGroupOverviewHTML(view), /0 \/ 0 approved/);
  }
});

test('all metric buttons link to the correct intern detail and untrusted labels are escaped', () => {
  const id = 'a" onclick="bad()', name = '<img src=x onerror=bad()>', title = '<script>bad()</script>';
  const view = build(data({members:[member(id, {name, github:'valid-user', status:'<svg onload=bad()>'})], challengeCatalog:[{id:'portfolio', title}], challengeProgress:[{memberId:id,challengeId:'portfolio',status:'submitted',definition:{title:'<b>Snapshot</b>'}}]}));
  const html = betaGroupOverviewHTML(view);
  for (const section of ['profile','attendance','github','roadmap']) assert.match(html, new RegExp(`data-group-section="${section}"`));
  assert.doesNotMatch(html, /<img|<script|<svg|<b>Snapshot|data-group-member="a" onclick=/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
  assert.match(html, /&lt;b&gt;Snapshot/);
});
