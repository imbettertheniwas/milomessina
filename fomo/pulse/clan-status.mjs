export const schoolOnly = record => Boolean(record.school && record.school !== 'Unconfirmed' && !record.chapter?.trim());
export const chapterMatch = record => Boolean(record.chapter?.trim() && ['Matched', 'Name match'].includes(record.status));
export const matchedMembers = records => records.filter(chapterMatch).reduce((sum, r) => sum + (Number.isFinite(r.members) ? r.members : 0), 0);
export const matchGroup = record => schoolOnly(record) ? 'school' : chapterMatch(record) ? 'confirmed' : 'review';
export function labelClan(record) {
  if (!schoolOnly(record)) return record;
  return {...record, status: 'School only', note: 'School-wide clan — not a chapter match. Shown for reference.'};
}
