// Company-neutral board state. Existing task IDs remain stable for saved reviews.
export function opportunityStatus(profile,taskId){
  const task=profile?.cloud?.tasks?.find(t=>t.taskId===taskId);
  const steps=profile?.cloud?.steps?.filter(s=>s.taskId===taskId)||[];
  const local=profile?.progress?.[taskId];
  const drafts=Object.entries(profile?.stepDrafts||{}).filter(([key])=>key.startsWith(taskId+':')).map(([,value])=>value);
  if(task?.status==='approved')return 'approved';
  if(task?.status==='submitted'||steps.some(s=>s.status==='submitted'))return 'review';
  if(task?.status==='changes_requested'||steps.some(s=>['approved','changes_requested'].includes(s.status)))return 'active';
  if(local?.checks?.some(Boolean)||local?.notes?.trim()||drafts.some(d=>d.notes?.trim()||d.files?.length)||steps.some(s=>s.draft?.notes?.trim()||s.draft?.files?.length))return 'active';
  if(taskId==='calendar'&&(profile?.calendar?.file||profile?.calendar?.events?.some(e=>e.title||e.date)))return 'active';
  return 'available';
}
export function opportunityCounts(profile,ids){
  const counts={all:ids.length,active:0,review:0,approved:0};
  for(const id of ids){const status=opportunityStatus(profile,id);if(status in counts)counts[status]++;}
  return counts;
}
