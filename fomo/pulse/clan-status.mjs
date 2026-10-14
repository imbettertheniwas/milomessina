export const schoolOnly = record => Boolean(record.school && record.school !== 'Unconfirmed' && !record.chapter?.trim());
export const chapterMatch = record => Boolean(record.chapter?.trim() && ['Matched', 'Name match'].includes(record.status));
export const matchGroup = record => schoolOnly(record) ? 'school' : chapterMatch(record) ? 'confirmed' : 'review';
export function labelClan(record) {
  if (!schoolOnly(record)) return record;
  return {...record, status: 'School only', note: 'School-wide clan — not a chapter match. Shown for reference.'};
}
