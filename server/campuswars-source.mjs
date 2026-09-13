// The source is a server-rendered admin table. Read only chapter identity and
// aggregate progress; never return contacts, invite links or individual members.
const legacy = [
  ['Sigma Chi', 'San Diego State University', 'sigma-chi-sdsu', 'San Diego State'],
  ['Kappa Sigma', 'Coastal Carolina University', 'kappa-sigma-coastal', 'Coastal Carolina'],
  ['Phi Delta Theta', 'University of Tampa', 'phi-delta-theta-tampa', 'Tampa'],
  ['Phi Kappa Psi', 'Virginia Tech', 'phi-kappa-psi-vt', 'Virginia Tech'],
  ['Tau Kappa Epsilon', 'University of Tampa', 'tau-kappa-epsilon-tampa', 'Tampa']
];
const greek = Object.fromEntries('Alpha Α Beta Β Gamma Γ Delta Δ Epsilon Ε Zeta Ζ Eta Η Theta Θ Iota Ι Kappa Κ Lambda Λ Mu Μ Nu Ν Xi Ξ Omicron Ο Pi Π Rho Ρ Sigma Σ Tau Τ Upsilon Υ Phi Φ Chi Χ Psi Ψ Omega Ω'.split(' ').reduce((pairs, word, i, all) => i % 2 ? pairs : [...pairs, [word.toLowerCase(), all[i + 1]]], []));
function text(html) {
  const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',middot:'·',ndash:'–',mdash:'—',rsquo:'’'};
  return html.replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] !== '#') return entities[code.toLowerCase()] ?? whole;
    const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2),16) : Number(code.slice(1));
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
  }).replace(/\s+/g, ' ').trim();
}
function field(html, className) {
  const match = html.match(new RegExp(`<([a-z]+)\\b[^>]*class=["'](?:[^"']*\\s)?${className}(?:\\s[^"']*)?["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'));
  if (!match) throw new Error('Chapter source format changed');
  return text(match[2]);
}
export function parseChapterAdmin(html) {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  const table = tables.find(([, value]) => {
    const headers = [...value.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => text(m[1]));
    return headers[0] === 'Chapter' && headers[3] === 'Progress' && headers[5] === 'Registered';
  });
  if (!table) throw new Error('Chapter table unavailable');
  const ids = new Set();
  const chapters = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(([, row]) => {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (!cells.length) return [];
    const uuid = row.match(/data-del=["']([\da-f-]{36})["']/i)?.[1];
    if (cells.length < 7 || !uuid) throw new Error('Incomplete chapter row');
    const name = field(cells[0], 'ch');
    const schoolType = field(cells[0], 'sc');
    const separator = schoolType.lastIndexOf(' · ');
    if (separator < 0) throw new Error('Missing chapter school');
    const school = schoolType.slice(0,separator), type = schoolType.slice(separator + 3);
    const progress = field(cells[3], 'prog').match(/^([\d,]+)\s*\/\s*([\d,]+)$/);
    const activeMatch = text(cells[3]).match(/([\d,]+)\s+actives\b/);
    if (!progress || !activeMatch) throw new Error('Missing chapter totals');
    const joined = Number(progress[1].replaceAll(',','')), active = Number(activeMatch[1].replaceAll(',',''));
    const date = new Date(text(cells[5]) + ' 00:00:00 GMT');
    if (!name || !school || !Number.isSafeInteger(joined) || joined < 0 || !Number.isSafeInteger(active) || active <= 0 || !Number.isFinite(date.getTime())) throw new Error('Invalid chapter totals');
    // The admin denominator is the 80% target, not the full active roster.
    const known = legacy.find(c => c[0] === name && c[1] === school);
    const id = known?.[2] ?? `chapter-${uuid}`;
    if (ids.has(id)) throw new Error('Duplicate chapter identity');
    ids.add(id);
    return [{id, name, letters:name.split(/\s+/).map(word => greek[word.toLowerCase()] ?? word[0]).join(''), school, shortSchool:known?.[3] ?? school, type, joined, active, registered:date.toISOString().slice(0,10)}];
  });
  // Keep the original houses in place; append registrations chronologically.
  const rank = id => { const n = legacy.findIndex(c => c[2] === id); return n < 0 ? legacy.length : n; };
  chapters.sort((a,b) => rank(a.id)-rank(b.id) || a.registered.localeCompare(b.registered) || a.id.localeCompare(b.id));
  return chapters.map((chapter, house) => ({...chapter, house}));
}

// Bound decoded bytes too: Content-Length may be absent or describe compressed
// bytes. Never buffer an unbounded admin export in a public request handler.
export async function readChapterSource(response,maxBytes=8*1024*1024){
  const tooLarge=()=>new Error('Chapter source exceeds size limit');
  if(Number(response.headers?.get('content-length'))>maxBytes){await response.body?.cancel();throw tooLarge();}
  if(!response.body?.getReader){
    const html=await response.text();
    if(Buffer.byteLength(html)>maxBytes)throw tooLarge();
    return html;
  }
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>maxBytes){await reader.cancel();throw tooLarge();}
      chunks.push(value);
    }
    return Buffer.concat(chunks,size).toString('utf8');
  }finally{reader.releaseLock();}
}

export async function fetchChapterSnapshot({password, username='village', fetchImpl=fetch, now=()=>new Date()}={}) {
  if (!password) throw new Error('Chapter source is not configured');
  const response = await fetchImpl('https://www.aryatoufanian.com/admin/', {
    headers:{Authorization:`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`, Accept:'text/html', 'Cache-Control':'no-cache'},
    redirect:'error', signal:AbortSignal.timeout(8000), cache:'no-store'
  });
  if (!response.ok){
    await response.body?.cancel();
    if(response.status===401||response.status===403)throw new Error('Chapter source authentication failed');
    throw new Error('Chapter source unavailable');
  }
  const chapters = parseChapterAdmin(await readChapterSource(response));
  return {source:'Chapter registrations', live:true, updatedAt:now().toISOString(), chapters};
}


// Only fixed diagnostic codes may leave the server; never return source HTML,
// arbitrary exception messages, credentials or registration records.
export function chapterSourceErrorCode(error){
  const codes={
    'Chapter source authentication failed':'SOURCE_AUTH',
    'Chapter source unavailable':'SOURCE_HTTP',
    'Chapter table unavailable':'SOURCE_TABLE',
    'Chapter source format changed':'SOURCE_FIELD',
    'Incomplete chapter row':'SOURCE_ROW',
    'Missing chapter school':'SOURCE_SCHOOL',
    'Missing chapter totals':'SOURCE_TOTALS',
    'Invalid chapter totals':'SOURCE_VALUES',
    'Duplicate chapter identity':'SOURCE_DUPLICATE',
    'Chapter source is not configured':'SOURCE_CONFIG',
    'Chapter source exceeds size limit':'SOURCE_SIZE'
  };
  if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'SOURCE_TIMEOUT';
  return codes[error?.message]||'SOURCE_CONNECTION';
}
