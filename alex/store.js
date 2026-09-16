/* ─────────────────────────────────────────────────────────────
   Where submissions go.

   Nothing is connected to a server yet. `saveLead` keeps records in
   this browser's localStorage so the portal and the dashboard can be
   used end to end while the fields and the offers are still being
   settled.

   That has one consequence worth being blunt about: a submission made
   on an influencer's phone stays on their phone. It does not reach the
   dashboard. The portal says so plainly on screen rather than taking
   an address and quietly dropping it.

   To take it live, set ENDPOINT to a receiver that accepts a POST of
   {form:'influencer', fields:{...}} — the same shape the rest of this
   site already posts to its Apps Script — and give readLeads a source
   for the dashboard. Those two functions are the only seam; nothing
   else in the portal or the dashboard knows how records are stored.
   ───────────────────────────────────────────────────────────── */
export const ENDPOINT = '';
export const isLive = Boolean(ENDPOINT);

const KEY = 'nyfw.leads.v1';
const DEMO_KEY = 'nyfw.demo.v1';

export const INTERESTS = [
  {id: 'podcast',    label: 'Podcast guest'},
  {id: 'content',    label: 'Featured in content'},
  {id: 'events',     label: 'Shows & events'},
  {id: 'brand',      label: 'Brand partnership'},
  {id: 'ambassador', label: 'Ambassador program'}
];

export const NICHES = ['Fashion', 'Beauty', 'Lifestyle', 'Music', 'Food', 'Fitness', 'Art & design', 'Other'];
export const PLATFORMS = [
  {id: 'instagram', label: 'Instagram'},
  {id: 'tiktok',    label: 'TikTok'},
  {id: 'youtube',   label: 'YouTube'}
];
export const STATUSES = [
  {id: 'new',       label: 'New'},
  {id: 'contacted', label: 'Contacted'},
  {id: 'booked',    label: 'Booked'},
  {id: 'passed',    label: 'Passed'}
];

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}
function write(rows) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); return true; }
  catch { return false; }
}

/* Total reach is derived, never trusted from the form, so the dashboard
   and the confirmation screen can never disagree about it. */
export function reachOf(lead) {
  return PLATFORMS.reduce((sum, p) => sum + (Number(lead.platforms?.[p.id]?.followers) || 0), 0);
}

export async function saveLead(fields) {
  const lead = {
    ...fields,
    id: 'ld_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    createdAt: new Date().toISOString(),
    status: 'new'
  };
  lead.reach = reachOf(lead);

  if (isLive) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({form: 'influencer', fields: lead})
    });
    if (!res.ok) throw new Error('The submission was not accepted.');
    return {lead, stored: 'remote'};
  }

  const rows = read();
  rows.unshift(lead);
  return {lead, stored: write(rows) ? 'local' : 'nowhere'};
}

export function readLeads() {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateLead(id, patch) {
  const rows = read();
  const row = rows.find(r => r.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  write(rows);
  return row;
}

export function removeLead(id) {
  write(read().filter(r => r.id !== id));
}

export function clearDemo() {
  write(read().filter(r => !r.demo));
  try { localStorage.setItem(DEMO_KEY, 'cleared'); } catch {}
}

export function hasDemo() {
  return read().some(r => r.demo);
}

/* ── formatting ───────────────────────────────────────────── */
export function formatReach(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'K';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
export function formatCount(n) {
  return (Number(n) || 0).toLocaleString('en-US');
}
export function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}

export function toCsv(rows) {
  const cell = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = ['Submitted', 'Name', 'Email', 'Phone', 'City', 'New to NY', 'Niche',
    'Instagram', 'IG followers', 'TikTok', 'TT followers', 'YouTube', 'YT followers',
    'Total reach', 'Interests', 'Availability', 'Links', 'Notes', 'Status'];
  const body = rows.map(r => [
    r.createdAt, r.name, r.email, r.phone, r.city, r.newToNy ? 'yes' : 'no', r.niche,
    r.platforms?.instagram?.handle, r.platforms?.instagram?.followers,
    r.platforms?.tiktok?.handle, r.platforms?.tiktok?.followers,
    r.platforms?.youtube?.handle, r.platforms?.youtube?.followers,
    reachOf(r),
    (r.interests || []).map(i => INTERESTS.find(x => x.id === i)?.label || i).join('; '),
    r.availability, r.links, r.notes, r.status
  ].map(cell).join(','));
  return [head.join(','), ...body].join('\n');
}

/* ── demo records ─────────────────────────────────────────────
   Seeded once so the dashboard has something to show before the
   first real submission. Every row carries demo:true, the dashboard
   says so on screen, and "Clear demo data" removes exactly these.
   ───────────────────────────────────────────────────────────── */
const DEMO = [
  ['Nia Okafor', 'nia@example.com', 'Brooklyn, NY', false, 'Fashion', ['podcast', 'events'], 184000, 96000, 0, 'booked', 2],
  ['Sloane Whitaker', 'sloane@example.com', 'Manhattan, NY', false, 'Beauty', ['content', 'brand'], 41000, 320000, 12000, 'contacted', 4],
  ['Priya Raman', 'priya@example.com', 'Austin → NY', true, 'Lifestyle', ['events', 'ambassador', 'podcast'], 76000, 21000, 0, 'new', 5],
  ['Jules Marchetti', 'jules@example.com', 'Queens, NY', false, 'Art & design', ['content'], 12400, 0, 48000, 'new', 6],
  ['Dara Kim', 'dara@example.com', 'Seoul → NY', true, 'Fashion', ['podcast', 'content', 'events', 'brand'], 610000, 1240000, 88000, 'contacted', 8],
  ['Marisol Vega', 'marisol@example.com', 'Bronx, NY', false, 'Music', ['events', 'ambassador'], 53000, 140000, 0, 'new', 9],
  ['Tess Halloran', 'tess@example.com', 'London → NY', true, 'Beauty', ['brand'], 29000, 8600, 0, 'passed', 12],
  ['Amara Diallo', 'amara@example.com', 'Harlem, NY', false, 'Fitness', ['content', 'ambassador'], 91000, 44000, 15000, 'new', 14],
  ['Rue Castellanos', 'rue@example.com', 'Miami → NY', true, 'Fashion', ['events', 'podcast'], 232000, 410000, 0, 'contacted', 17],
  ['Wren Abbott', 'wren@example.com', 'Manhattan, NY', false, 'Lifestyle', ['content', 'events'], 7800, 19000, 0, 'new', 19],
  ['Sofia Leclair', 'sofia@example.com', 'Paris → NY', true, 'Fashion', ['brand', 'ambassador', 'content'], 480000, 260000, 34000, 'booked', 22],
  ['Hana Ueda', 'hana@example.com', 'Jersey City, NJ', false, 'Art & design', ['podcast'], 16000, 5200, 9100, 'new', 26]
];

export function seedDemo() {
  try { if (localStorage.getItem(DEMO_KEY) === 'cleared') return; } catch { return; }
  if (read().length) return;
  const day = 86400000;
  const rows = DEMO.map(([name, email, city, newToNy, niche, interests, ig, tt, yt, status, ago]) => {
    const handle = name.toLowerCase().split(' ')[0];
    const lead = {
      id: 'demo_' + name.toLowerCase().replace(/\W/g, ''),
      createdAt: new Date(Date.now() - ago * day).toISOString(),
      demo: true,
      name, email, phone: '', city, newToNy, niche, interests,
      platforms: {
        instagram: {handle: ig ? handle : '', followers: ig},
        tiktok:    {handle: tt ? handle : '', followers: tt},
        youtube:   {handle: yt ? handle : '', followers: yt}
      },
      availability: '', links: '', notes: '', status
    };
    lead.reach = reachOf(lead);
    return lead;
  });
  write(rows);
}
