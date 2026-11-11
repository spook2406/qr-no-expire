'use strict';

// WiFi, email, phone, SMS, WhatsApp, vCard, and location payload builders.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIIFE } = require('./helpers');

const Wifi = loadIIFE('js/wifi-payload.js').WifiPayload;
const Email = loadIIFE('js/email-payload.js').EmailPayload;
const Phone = loadIIFE('js/phone-payload.js').PhonePayload;
const Sms = loadIIFE('js/sms-payload.js').SmsPayload;
const WhatsApp = loadIIFE('js/whatsapp-payload.js').WhatsAppPayload;
const VCard = loadIIFE('js/vcard-payload.js').VCardPayload;
const Location = loadIIFE('js/location-payload.js').LocationPayload;

test('wifi: escapes \\ ; , " in SSID and password, adds hidden flag', () => {
  assert.equal(
    Wifi.buildWifiPayload({ ssid: 'Cafe;1', password: 'p"a,ss\\', encryption: 'WPA', hidden: true }),
    'WIFI:T:WPA;S:Cafe\\;1;P:p\\"a\\,ss\\\\;H:true;;'
  );
});

test('wifi: open network omits the password field', () => {
  assert.equal(
    Wifi.buildWifiPayload({ ssid: 'Open', password: 'ignored', encryption: 'nopass' }),
    'WIFI:T:nopass;S:Open;;'
  );
});

test('wifi: defaults to WPA and keeps an empty password field', () => {
  assert.equal(Wifi.buildWifiPayload({ ssid: 'Home' }), 'WIFI:T:WPA;S:Home;P:;;');
});

test('wifi: blank SSID is rejected', () => {
  assert.throws(() => Wifi.buildWifiPayload({ ssid: '   ' }), /SSID/);
});

test('email: lowercases the domain and percent-encodes subject/body', () => {
  const built = Email.buildMailtoPayload({ email: ' Hi@Example.com ', subject: 'Hello & bye', body: 'Line1\nLine2' });
  assert.equal(built.payload, 'mailto:Hi@example.com?subject=Hello%20%26%20bye&body=Line1%0ALine2');
  assert.equal(built.email, 'Hi@example.com');
});

test('email: address only has no query string', () => {
  assert.equal(Email.buildMailtoPayload({ email: 'a@b.co' }).payload, 'mailto:a@b.co');
});

test('email: validation', () => {
  assert.equal(Email.isValidEmail('a@b.co'), true);
  assert.equal(Email.isValidEmail('a@b'), false);
  assert.equal(Email.isValidEmail('a b@c.com'), false);
  assert.throws(() => Email.buildMailtoPayload({ email: 'nope' }), /valid email/);
});

test('phone: formats to E.164 tel: URI', () => {
  assert.equal(Phone.buildTelPayload({ phone: '+1 (555) 123-4567' }).payload, 'tel:+15551234567');
});

test('phone: strips an extension and warns', () => {
  const built = Phone.buildTelPayload({ phone: '+1 555 123 4567 ext. 89' });
  assert.equal(built.payload, 'tel:+15551234567');
  assert.match(built.warning, /Extension/);
});

test('phone: too-short numbers are rejected', () => {
  assert.throws(() => Phone.buildTelPayload({ phone: '12' }), /too short/);
  assert.throws(() => Phone.buildTelPayload({ phone: '555 1234' }), /too short/);
});

test('sms: SMSTO with and without message', () => {
  assert.equal(
    Sms.buildSmsPayload({ phone: '+44 20 7946 0958', message: 'Hi there & ok?' }).payload,
    'SMSTO:+442079460958:Hi there & ok?'
  );
  assert.equal(Sms.buildSmsPayload({ phone: '+44 20 7946 0958' }).payload, 'SMSTO:+442079460958');
  assert.throws(() => Sms.buildSmsPayload({ phone: '' }), /valid phone/);
});

test('whatsapp: wa.me link with digits only and encoded text', () => {
  assert.equal(
    WhatsApp.buildWhatsAppUrl({ countryCode: '+1', phone: '(555) 123-4567', message: 'Hello world' }).url,
    'https://wa.me/15551234567?text=Hello%20world'
  );
});

test('whatsapp: drops the national trunk 0 after the country code', () => {
  assert.equal(WhatsApp.buildWhatsAppUrl({ countryCode: '44', phone: '07946 0958' }).url, 'https://wa.me/4479460958');
});

test('whatsapp: empty number is rejected', () => {
  assert.throws(() => WhatsApp.buildWhatsAppUrl({ countryCode: '', phone: '' }), /valid phone/);
});

test('vcard: builds a 3.0 card and escapes ; and , in values', () => {
  const card = VCard.buildVCardPayload({
    firstName: 'Ann', lastName: 'Lee', org: 'A;B', phone: '+1 555', email: 'a@b.co',
    url: 'https://x.y', street: '1 Main, St', city: 'X', country: 'US'
  });
  assert.equal(card, [
    'BEGIN:VCARD', 'VERSION:3.0', 'N:Lee;Ann;;;', 'FN:Ann Lee', 'ORG:A\\;B',
    'TEL;TYPE=CELL:+1 555', 'EMAIL;TYPE=INTERNET:a@b.co', 'URL:https://x.y',
    'ADR;TYPE=WORK:;;1 Main\\, St;X;;;US', 'END:VCARD'
  ].join('\n'));
});

test('vcard: escapeVCard handles backslash, ; , and newlines', () => {
  assert.equal(VCard.escapeVCard('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
});

test('vcard: a name is required', () => {
  assert.throws(() => VCard.buildVCardPayload({}), /name/);
});

test('location: geo: URI mode', () => {
  assert.equal(Location.buildLocationPayload({ lat: '40.7128', lng: '-74.006', mode: 'geo' }).payload, 'geo:40.7128,-74.006');
});

test('location: Google Maps link with label and coordinates', () => {
  assert.equal(
    Location.buildLocationPayload({ lat: '40.7128', lng: '-74.006', query: 'Times Sq' }).payload,
    'https://maps.google.com/?q=Times%20Sq%20%4040.7128%2C-74.006'
  );
});

test('location: search query only', () => {
  assert.equal(Location.buildLocationPayload({ query: 'Eiffel Tower' }).payload, 'https://maps.google.com/?q=Eiffel%20Tower');
});

test('location: out-of-range latitude is rejected; coords round to 6 places', () => {
  assert.throws(() => Location.buildLocationPayload({ lat: '91', lng: '0' }), /Latitude/);
  assert.equal(Location.formatCoord(1.123456789), '1.123457');
  assert.equal(Location.formatCoord(-0), '0');
});
