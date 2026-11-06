export const DEFAULT_ZONE = 'America/Phoenix';
export const PREFERENCE_KEY = 'time-traveler.time-zone';

export function validZone(zone) {
  if (typeof zone !== 'string' || !zone) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; }
  catch { return false; }
}

export function readPreference(storage) {
  try {
    const zone = storage.getItem(PREFERENCE_KEY);
    return validZone(zone) ? zone : DEFAULT_ZONE;
  } catch { return DEFAULT_ZONE; }
}

export function savePreference(storage, zone) {
  if (!validZone(zone)) return false;
  try { storage.setItem(PREFERENCE_KEY, zone); return true; }
  catch { return false; }
}

export function parseUTC(value, today = new Date()) {
  const text = String(value).trim().replace(/\s*(?:Z|UTC|GMT|\+00:?00)$/i, '').trim();
  const match = /^(?:(\d{4})-(\d{2})-(\d{2})[Tt\s]+)?(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/.exec(text);
  if (!match) throw new Error('Use YYYY-MM-DD HH:mm:ss UTC or HH:mm UTC.');
  const timeOnly = !match[1];
  const year = timeOnly ? today.getUTCFullYear() : Number(match[1]);
  const month = timeOnly ? today.getUTCMonth() + 1 : Number(match[2]);
  const day = timeOnly ? today.getUTCDate() : Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6] || 0);
  const millis = Number((match[7] || '').padEnd(3, '0').slice(0, 3));
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    throw new Error('That UTC date or time is out of range.');
  }
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millis);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('That date does not exist.');
  }
  return { date, timeOnly };
}

export function convertUTC(value, zone = DEFAULT_ZONE, today = new Date()) {
  if (!validZone(zone)) throw new Error('Choose a valid timezone.');
  const { date, timeOnly } = parseUTC(value, today);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short'
  }).formatToParts(date).map(part => [part.type, part.value]));
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(date).find(part => part.type === 'timeZoneName').value.replace('GMT', 'UTC').replace('-', '−');
  const localDate = `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
  const fractional = date.getUTCMilliseconds() ? `.${String(date.getUTCMilliseconds()).padStart(3, '0')}` : '';
  const time = `${parts.hour}:${parts.minute}:${parts.second}${fractional}`;
  return {
    date: localDate, time, zoneLabel: parts.timeZoneName, offset, utcISO: date.toISOString(), timeOnly,
    display: `${localDate} ${time} ${parts.timeZoneName} (${offset})`
  };
}
