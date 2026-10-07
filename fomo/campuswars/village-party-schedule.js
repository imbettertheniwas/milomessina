// Use one US clock so every visitor sees the same weekend party.
export const PARTY_TIME_ZONE='America/New_York';
const clock=new Intl.DateTimeFormat('en-US',{timeZone:PARTY_TIME_ZONE,weekday:'short',hour:'numeric',hourCycle:'h23'});
export function isPartyNight(date=new Date()){
  const parts=Object.fromEntries(clock.formatToParts(date).map(p=>[p.type,p.value]));
  const hour=Number(parts.hour),day=parts.weekday;
  return hour>=20&&['Thu','Fri','Sat'].includes(day)||hour<4&&['Fri','Sat','Sun'].includes(day);
}
