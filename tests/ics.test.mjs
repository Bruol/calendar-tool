import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseICS } from '../src/lib/ics.ts';

const feed = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap(lines => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const series = ['UID:lab', 'SUMMARY:Lab', 'DTSTART:20261001T141500Z', 'DTEND:20261001T170000Z'];

test('expands weekly rules and excludes cancelled dates', () => {
  const events = parseICS(feed([...series, 'RRULE:FREQ=WEEKLY;UNTIL=20261029T235959Z', 'EXDATE:20261001T141500Z']));
  assert.deepEqual(events.map(e => e.start.slice(0,10)), ['2026-10-08','2026-10-15','2026-10-22','2026-10-29']);
  assert.ok(events.every(e => (Date.parse(e.end)-Date.parse(e.start))/3600000 === 2.75));
});

test('uses moved and cancelled exceptions without duplicates', () => {
  const events = parseICS(feed([...series, 'RRULE:FREQ=WEEKLY;COUNT=3'],
    ['UID:lab', 'RECURRENCE-ID:20261008T141500Z', 'DTSTART:20261009T120000Z', 'DTEND:20261009T130000Z', 'SUMMARY:Moved'],
    ['UID:lab', 'RECURRENCE-ID:20261015T141500Z', 'DTSTART:20261015T141500Z', 'STATUS:CANCELLED']));
  assert.equal(events.length, 2);
  assert.equal(events[1].summary, 'Moved');
  assert.equal(events[1].start, '2026-10-09T12:00:00.000Z');
});

test('retains all-day dates, unfolded text and additional dates', () => {
  const events = parseICS(feed(['UID:day', 'DTSTART;VALUE=DATE:20261001', 'DTEND;VALUE=DATE:20261002', 'SUMMARY:Long ', ' title\\, yes', 'RDATE;VALUE=DATE:20261008']));
  assert.deepEqual(events.map(e=>e.start), ['2026-10-01', '2026-10-08']);
  assert.equal(events[0].summary, 'Long title, yes');
});

test('bounds infinite recurrences', () => {
  const events = parseICS(feed([...series, 'RRULE:FREQ=WEEKLY']), new Date('2026-10-22T00:00:00Z'));
  assert.ok(events.length > 100 && events.length < 120);
  assert.ok(events.every(e=>e.start < '2029-01-01'));
});

test("keeps Zurich wall-clock time across daylight saving", () => {
  const zone = `BEGIN:VTIMEZONE\nTZID:Europe/Zurich\nX-LIC-LOCATION:Europe/Zurich\nBEGIN:DAYLIGHT\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nTZNAME:GMT+2\nDTSTART:19700329T020000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\nEND:DAYLIGHT\nBEGIN:STANDARD\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nTZNAME:GMT+1\nDTSTART:19701025T030000\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\nEND:STANDARD\nEND:VTIMEZONE`;
  const content = feed(["UID:dst", "SUMMARY:Lab", "DTSTART;TZID=Europe/Zurich:20261022T161500", "DTEND;TZID=Europe/Zurich:20261022T190000", "RRULE:FREQ=WEEKLY;COUNT=2"]).replace("BEGIN:VEVENT", zone + "\r\nBEGIN:VEVENT");
  const events = parseICS(content);
  assert.deepEqual(events.map(e=>e.start), ["2026-10-22T14:15:00.000Z", "2026-10-29T15:15:00.000Z"]);
});
