import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ZONE, PREFERENCE_KEY, parseUTC, convertUTC, readPreference, savePreference } from '../core.js';

const today = new Date('2026-11-06T00:10:00Z');

test('defaults to Phoenix MST in both winter and summer', () => {
  for (const date of ['2026-01-15', '2026-07-15']) {
    const result = convertUTC(`${date} 21:30 UTC`);
    assert.equal(result.time, '14:30:00');
    assert.equal(result.offset, 'UTC−07:00');
    assert.equal(result.zoneLabel, 'MST');
  }
});

test('uses the supplied date for daylight-saving transitions', () => {
  assert.equal(convertUTC('2026-03-08T08:59:00Z', 'America/Denver').time, '01:59:00');
  const after = convertUTC('2026-03-08T09:00:00Z', 'America/Denver');
  assert.equal(after.time, '03:00:00');
  assert.equal(after.zoneLabel, 'MDT');
  assert.equal(after.offset, 'UTC−06:00');
});

test('distinguishes the repeated autumn hour by its UTC offset', () => {
  const first = convertUTC('2026-11-01T07:30:00Z', 'America/Denver');
  const second = convertUTC('2026-11-01T08:30:00Z', 'America/Denver');
  assert.equal(first.time, second.time);
  assert.notEqual(first.offset, second.offset);
});

test('shows previous-day and next-day rollover', () => {
  assert.equal(convertUTC('2026-01-01 02:30').date, '2025-12-31');
  const japan = convertUTC('2026-12-31 23:30', 'Asia/Tokyo');
  assert.equal(japan.date, '2027-01-01');
  assert.equal(japan.time, '08:30:00');
});

test('time-only input uses today in UTC, independently of local date', () => {
  const result = convertUTC('00:05 UTC', DEFAULT_ZONE, today);
  assert.equal(result.utcISO, '2026-11-06T00:05:00.000Z');
  assert.equal(result.date, '2026-11-05');
  assert.equal(result.timeOnly, true);
});

test('accepts ISO, UTC labels, missing zone, and zero offsets consistently', () => {
  for (const text of ['2026-11-06T21:30:00Z', '2026-11-06t21:30:00z', '2026-11-06 21:30 UTC', '2026-11-06 21:30 GMT', '2026-11-06 21:30', '2026-11-06T21:30:00+00:00', '2026-11-06 21:30+0000']) {
    assert.equal(convertUTC(text).utcISO, '2026-11-06T21:30:00.000Z', text);
  }
});

test('preserves milliseconds and truncates higher precision without rounding into a new second', () => {
  assert.equal(convertUTC('2026-11-06T21:30:59.999999Z').time, '14:30:59.999');
  assert.equal(convertUTC('2026-11-06T21:30:00.1Z').time, '14:30:00.100');
});

test('rejects invalid dates, times, and non-UTC offsets instead of normalizing them', () => {
  for (const text of ['', 'tomorrow', '2026-02-29 12:00', '2026-04-31 12:00', '2026-13-01 12:00', '0000-01-01 12:00', '24:00', '12:60', '12:00:60', '2026-11-06T21:30:00-07:00', '2026-11-06 21:30 MST']) {
    assert.throws(() => parseUTC(text, today), text);
  }
  assert.equal(parseUTC('2024-02-29 12:00').date.toISOString(), '2024-02-29T12:00:00.000Z');
});

test('handles non-hour timezone offsets and UTC midnight', () => {
  assert.equal(convertUTC('2026-11-06 00:00', 'UTC').time, '00:00:00');
  const india = convertUTC('2026-11-06 00:00', 'Asia/Kolkata');
  assert.equal(india.time, '05:30:00');
  assert.equal(india.offset, 'UTC+05:30');
});

test('saves and restores only the selected timezone', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(readPreference(storage), DEFAULT_ZONE);
  assert.equal(savePreference(storage, 'Europe/London'), true);
  assert.equal(readPreference(storage), 'Europe/London');
  assert.deepEqual([...values], [[PREFERENCE_KEY, 'Europe/London']]);
  assert.equal(savePreference(storage, 'Not/AZone'), false);
});

test('falls back safely for corrupt or blocked browser storage', () => {
  assert.equal(readPreference({ getItem: () => 'Not/AZone' }), DEFAULT_ZONE);
  assert.equal(readPreference(undefined), DEFAULT_ZONE);
  const blocked = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.equal(readPreference(blocked), DEFAULT_ZONE);
  assert.equal(savePreference(blocked, 'UTC'), false);
  assert.throws(() => convertUTC('12:00', 'Not/AZone', today));
});
