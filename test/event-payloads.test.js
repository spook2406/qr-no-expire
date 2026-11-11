'use strict';

// Calendar (iCalendar VEVENT) and TOTP/HOTP (otpauth://) payload builders.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIIFE } = require('./helpers');

const Calendar = loadIIFE('js/calendar-payload.js').CalendarPayload;
const Totp = loadIIFE('js/totp-payload.js').TotpPayload;

function lines(ics) {
  return ics.split('\r\n');
}

test('calendar: timed event uses CRLF and escapes text fields', () => {
  const ics = Calendar.buildCalendarPayload({
    title: 'Party; fun', startDate: '2026-12-01', startTime: '18:00',
    endDate: '2026-12-01', endTime: '20:00', location: 'Hall', description: 'Bring, food', allDay: false
  });
  const l = lines(ics);
  assert.equal(l[0], 'BEGIN:VCALENDAR');
  assert.equal(l[l.length - 1], 'END:VCALENDAR');
  assert.ok(l.includes('DTSTART:20261201T180000'));
  assert.ok(l.includes('DTEND:20261201T200000'));
  assert.ok(l.includes('SUMMARY:Party\\; fun'));
  assert.ok(l.includes('LOCATION:Hall'));
  assert.ok(l.includes('DESCRIPTION:Bring\\, food'));
  assert.ok(l.some((x) => /^UID:.+@qrstatic\.app$/.test(x)));
  assert.ok(l.some((x) => /^DTSTAMP:\d{8}T\d{6}Z$/.test(x)));
});

test('calendar: all-day end date is exclusive (next day)', () => {
  const l = lines(Calendar.buildCalendarPayload({ title: 'Day', startDate: '2026-12-01', endDate: '2026-12-02', allDay: true }));
  assert.ok(l.includes('DTSTART;VALUE=DATE:20261201'));
  assert.ok(l.includes('DTEND;VALUE=DATE:20261203'));
});

test('calendar: end before start and missing title are rejected', () => {
  assert.throws(() => Calendar.buildCalendarPayload({
    title: 'X', startDate: '2026-12-02', startTime: '10:00', endDate: '2026-12-01', endTime: '09:00'
  }), /End must be after start/);
  assert.throws(() => Calendar.buildCalendarPayload({ startDate: '2026-12-01' }), /title/);
});

test('calendar: escapeICal', () => {
  assert.equal(Calendar.escapeICal('a;b,c\\d\ne'), 'a\\;b\\,c\\\\d\\ne');
});

test('totp: default parameters are omitted; secret normalized to Base32 uppercase', () => {
  const built = Totp.buildTotpPayload({ issuer: 'Acme Co', account: 'ann@acme.com', secret: 'jbsw y3dp ehpk 3pxp' });
  assert.equal(built.payload, 'otpauth://totp/Acme%20Co:ann%40acme.com?secret=JBSWY3DPEHPK3PXP&issuer=Acme%20Co');
  assert.equal(built.nonDefault, false);
  assert.equal(built.warning, '');
});

test('totp: non-default algorithm/digits/period are encoded with a warning', () => {
  const built = Totp.buildTotpPayload({ issuer: 'Acme', account: 'ann', secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA256', digits: 8, period: 60 });
  assert.equal(built.payload, 'otpauth://totp/Acme:ann?secret=JBSWY3DPEHPK3PXP&issuer=Acme&algorithm=SHA256&digits=8&period=60');
  assert.equal(built.nonDefault, true);
  assert.match(built.warning, /Compatibility/);
});

test('totp: HOTP includes the counter', () => {
  const built = Totp.buildTotpPayload({ type: 'hotp', issuer: 'Acme', account: 'ann', secret: 'JBSWY3DPEHPK3PXP', counter: 5 });
  assert.equal(built.payload, 'otpauth://hotp/Acme:ann?secret=JBSWY3DPEHPK3PXP&issuer=Acme&counter=5');
});

test('totp: non-Base32 secret is rejected', () => {
  assert.throws(() => Totp.buildTotpPayload({ account: 'a', secret: 'abc1' }), /Base32/);
});

test('totp: random secret is 32 valid Base32 characters', () => {
  const secret = Totp.generateRandomSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.notEqual(secret, Totp.generateRandomSecret());
});
