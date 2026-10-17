import fs from 'node:fs';
// Keep the onboarding page focused on one task; historical offers remain in offers.json.
const html=fs.readFileSync(new URL('./template.html',import.meta.url),'utf8');
fs.writeFileSync(new URL('./index.html',import.meta.url),html);
console.log('Built the single calendar task.');
