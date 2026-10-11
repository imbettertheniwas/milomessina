// Scene records contain aggregate counts only, never individual member identities.
export function registrationSceneRecords(history){
 if(!history)return [];
 return history.days.filter(day=>day.count>0).map(day=>({
  id:'member-day:'+day.date,registered:day.date,joined:day.count,
  name:day.date,letters:day.date.slice(5),school:day.date.slice(0,7),memberDay:true
 }));
}
export function registrationSceneSummary(history){
 if(!history)return 'Member registration history is temporarily unavailable. Retrying with the live feed.';
 if(!history.total)return 'No member registrations in the available history.';
 return history.total.toLocaleString('en-US')+' member registrations · '+history.days.filter(day=>day.count>0).length+' signup days · UTC dates. Select a day cluster to inspect.';
}
