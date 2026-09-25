export const SCHEDULE_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const SCHEDULE_TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC'];

const FILE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'text/calendar']);
const EXTENSIONS = {pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', ics: 'text/calendar'};
const fileError = () => new Error('Choose a PDF, PNG, JPG or calendar (.ics) file, up to 2 MB.');

function fileName(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 180 || /[\x00-\x1f\x7f/\\]/.test(value)) throw fileError();
  return value.trim();
}

function checkBytes(bytes, type) {
  if (!bytes.length || bytes.length > SCHEDULE_MAX_FILE_BYTES || !FILE_TYPES.has(type)) throw fileError();
  let valid = false;
  if (type === 'application/pdf') valid = String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
  if (type === 'image/png') valid = [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
  if (type === 'image/jpeg') valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'text/calendar') {
    try {
      const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes).trim();
      valid = !text.includes('\0') && /^BEGIN:VCALENDAR\r?\n[\s\S]*\r?\nEND:VCALENDAR$/i.test(text);
    } catch (_) { valid = false; }
  }
  if (!valid) throw new Error('The file contents do not match its type. Export your schedule as a PDF, image or .ics file and try again.');
}

function normalizeFile(file) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) throw fileError();
  const name = fileName(file.name), type = file.type;
  if (!FILE_TYPES.has(type) || typeof file.data !== 'string' || !file.data.length ||
      file.data.length > Math.ceil(SCHEDULE_MAX_FILE_BYTES / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) throw fileError();
  let raw;
  try { raw = atob(file.data); } catch (_) { throw fileError(); }
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  checkBytes(bytes, type);
  return {name, type, data: file.data};
}

export async function scheduleFile(file) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0 || file.size > SCHEDULE_MAX_FILE_BYTES) throw fileError();
  const name = fileName(file.name), extension = name.split('.').pop().toLowerCase();
  const inferred = EXTENSIONS[extension], declared = String(file.type || '').toLowerCase();
  if (!inferred) throw fileError();
  const type = inferred;
  if (!FILE_TYPES.has(type) || (declared && declared !== type && declared !== 'application/octet-stream' && !(type === 'text/calendar' && declared === 'text/plain'))) throw fileError();
  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch (_) { throw new Error('That file could not be read. Choose it again.'); }
  checkBytes(bytes, type);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return {name, type, data: btoa(binary)};
}

export function normalizeSchedule(input, {allowEmpty = false, allowExistingFile = false} = {}) {
  if (input == null && allowEmpty) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Add your weekly schedule or attach a schedule file.');
  const timezone = typeof input.timezone === 'string' ? input.timezone.trim() : '';
  try {
    if (!timezone || timezone.length > 80) throw new Error();
    new Intl.DateTimeFormat('en-US', {timeZone: timezone}).format();
  } catch (_) { throw new Error('Choose a valid time zone for your schedule.'); }
  if (input.mode === 'file') {
    if (input.keepFile === true && allowExistingFile && !input.file?.data) return {mode: 'file', timezone, blocks: [], keepFile: true};
    return {mode: 'file', timezone, blocks: [], file: normalizeFile(input.file)};
  }
  if (input.mode !== 'manual' || !Array.isArray(input.blocks) || input.blocks.length > 80) throw new Error('Add up to 80 weekly time blocks, or attach a schedule file.');
  const blocks = input.blocks.map(block => {
    if (!block || typeof block !== 'object' || !Number.isInteger(block.day) || block.day < 0 || block.day > 6) throw new Error('Choose a day for every time block.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(block.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(block.end) || block.start >= block.end) throw new Error('Enter a start and end time for each block, with the end after the start.');
    const label = typeof block.label === 'string' ? block.label.trim() : '';
    if (label.length > 100) throw new Error('Keep each schedule label under 100 characters.');
    return {day: block.day, start: block.start, end: block.end, label};
  });
  if (!blocks.length && input.noCommitments !== true) throw new Error('Add a time block, or confirm you have no regular commitments.');
  return {mode: 'manual', timezone, blocks, noCommitments: blocks.length === 0};
}
