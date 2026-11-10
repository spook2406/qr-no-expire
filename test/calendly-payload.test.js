'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { root, loadIIFE } = require('./helpers');


function loadPayload() {
  return loadIIFE('js/calendly-payload.js').CalendlyPayload;
}

const api = loadPayload();
const HOME = 'https://calendly.com/example-user';
const EVENT = 'https://calendly.com/example-user/30min';
const DIRECT = 'https://calendly.com/d/abc-123-xyz/intro-call';

function rejected(input, pattern) {
  assert.throws(function () { api.buildCalendlyPayload(input); }, pattern || /not encoded|Nothing was encoded/i);
}

test('scheduling homepage, event type, and /d/ event link are accepted', function () {
  const home = api.buildCalendlyPayload(HOME);
  assert.equal(home.payload, HOME);
  assert.equal(home.type, 'homepage');
  assert.equal(home.host, 'calendly.com');
  assert.equal(home.normalized, false);

  const event = api.buildCalendlyPayload(EVENT);
  assert.equal(event.payload, EVENT);
  assert.equal(event.type, 'event');

  const direct = api.buildCalendlyPayload(DIRECT);
  assert.equal(direct.payload, DIRECT);
  assert.equal(direct.type, 'direct');

  const idOnly = api.buildCalendlyPayload('https://calendly.com/d/abc-123-xyz');
  assert.equal(idOnly.payload, 'https://calendly.com/d/abc-123-xyz');
  assert.equal(idOnly.type, 'direct');

  api.assertStaticCalendlyPayload(home);
  api.assertStaticCalendlyPayload(event);
  api.assertStaticCalendlyPayload(direct);
});

test('http, www, hash, trailing slash, and a bare host are normalized to https calendly.com', function () {
  assert.equal(
    api.buildCalendlyPayload('http://www.calendly.com/example-user/30min/').payload,
    EVENT
  );
  assert.equal(
    api.buildCalendlyPayload('https://calendly.com/example-user#book').payload,
    HOME
  );
  assert.equal(
    api.buildCalendlyPayload('//www.calendly.com/example-user').payload,
    HOME
  );
  const bare = api.buildCalendlyPayload('calendly.com/example-user/30min');
  assert.equal(bare.payload, EVENT);
  assert.equal(bare.normalized, true);
  const quoted = api.buildCalendlyPayload('  "https://calendly.com/example-user"  ');
  assert.equal(quoted.payload, HOME);
  const zw = api.buildCalendlyPayload('https://calendly.com/\u200Bexample-user');
  assert.equal(zw.payload, HOME);
});

test('utm, fbclid, gclid, and similar tracking params are stripped; month and date stay', function () {
  const tracked = api.buildCalendlyPayload(
    'http://www.calendly.com/example-user/30min?utm_source=card&utm_medium=qr&utm_campaign=booth&fbclid=abc&gclid=xyz&gbraid=g&msclkid=m#time'
  );
  assert.equal(tracked.payload, EVENT);
  assert.equal(tracked.payload.includes('utm_'), false);
  assert.equal(tracked.payload.includes('fbclid'), false);
  assert.equal(tracked.payload.includes('gclid'), false);
  assert.equal(tracked.payload.includes('#'), false);
  assert.equal(tracked.normalized, true);

  const kept = api.buildCalendlyPayload(
    'https://calendly.com/example-user?utm_source=x&month=2026-11&fbclid=abc&date=2026-11-10'
  );
  assert.equal(kept.payload, HOME + '?month=2026-11&date=2026-11-10');

  const chrome = api.buildCalendlyPayload(
    'https://calendly.com/d/abc-123-xyz/intro-call?back=1&hide_gdpr_banner=1&primary_color=ffffff&share_attribution=qr'
  );
  assert.equal(chrome.payload, DIRECT);
});

test('path case is kept and an ordinary event slug is not treated as an admin page', function () {
  assert.equal(
    api.buildCalendlyPayload('https://calendly.com/Example-User/Intro-Call').payload,
    'https://calendly.com/Example-User/Intro-Call'
  );
  assert.equal(
    api.buildCalendlyPayload('https://calendly.com/example-user/meetings').payload,
    'https://calendly.com/example-user/meetings'
  );
});

test('empty input is a clear error and encodes nothing', function () {
  ['', '   ', '""', "''", null].forEach(function (value) {
    rejected(value, /Nothing was encoded/);
  });
});

test('custom domains, other hosts, and lookalike hosts are rejected', function () {
  const samples = [
    'https://schedule.example.com/example-user',
    'https://bookings.example.org/d/abc-123-xyz/intro-call',
    'https://calendly.com.evil.example/example-user',
    'https://notcalendly.com/example-user',
    'https://example.com/redirect?url=https://calendly.com/example-user',
    'https://user:pass@calendly.com/example-user',
    'https://calendly.com:8443/example-user',
    'javascript:alert(1)'
  ];
  samples.forEach(function (url) {
    rejected(url, /not encoded/i);
    assert.throws(function () { api.buildCalendlyPayload(url); });
  });
});

test('smart-QR and short-link URLs are not treated as booking links', function () {
  [
    'https://bit.ly/example-book',
    'https://tinyurl.com/example-user',
    'https://onelink.me/example',
    'https://flowcode.com/page/example',
    'https://qrco.de/example',
    'http://t.co/example1',
    'www.bit.ly/example-book'
  ].forEach(function (url) {
    rejected(url, /short link|smart-QR/i);
    rejected(url, /not encoded/i);
  });
});

test('login, signup, app, admin, and edit pages are rejected', function () {
  const samples = [
    ['https://calendly.com/login', /login or signup/i],
    ['https://www.calendly.com/signup', /login or signup/i],
    ['http://calendly.com/sign-in', /login or signup/i],
    ['https://calendly.com/app/meetings/user/me', /app, admin, or edit/i],
    ['https://calendly.com/app/event_types/123/edit', /app, admin, or edit/i],
    ['https://calendly.com/event_types/abc123/edit', /app, admin, or edit/i],
    ['https://calendly.com/example-user/30min/edit', /app, admin, or edit/i],
    ['https://app.calendly.com/meetings', /app, admin, or edit/i],
    ['https://admin.calendly.com/example-user', /subdomain|app, admin/i]
  ];
  samples.forEach(function (pair) {
    rejected(pair[0], pair[1]);
  });
});

test('cancel and reschedule links that carry a token are rejected', function () {
  [
    'https://calendly.com/cancellations/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'https://calendly.com/reschedulings/fake-invitee-token',
    'https://calendly.com/reschedule/fake-invitee-token',
    'https://calendly.com/example-user/30min?invitee_uuid=fake-token',
    'https://calendly.com/example-user?token=secret-token'
  ].forEach(function (url) {
    rejected(url, /cancel or reschedule/i);
    rejected(url, /not encoded/i);
  });
});

test('invite and confirmation pages are rejected', function () {
  [
    'https://calendly.com/example-user/30min/invitees/fake-invitee',
    'https://calendly.com/example-user/confirmation',
    'https://calendly.com/d/abc-123-xyz/intro-call/invitees/fake-invitee'
  ].forEach(function (url) {
    rejected(url, /invite or confirmation/i);
  });
});

test('Calendar Event, Google Meet, and other in-site tool links are rejected', function () {
  rejected(
    'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Demo\r\nEND:VEVENT\r\nEND:VCALENDAR',
    /Calendar Event/i
  );
  rejected('BEGIN:VEVENT\nSUMMARY:Demo\nEND:VEVENT', /VEVENT/i);
  rejected('https://meet.google.com/abc-defg-hij', /Google Meet/i);
  rejected('https://teams.microsoft.com/l/meetup-join/example', /another tool/i);
  rejected('https://zoom.us/j/5555555555', /another tool/i);
  rejected('https://docs.google.com/forms/d/e/1FAIpQLSdExampleFormId0001/viewform', /another tool/i);
  rejected('https://forms.gle/exampleForm', /another tool/i);
  rejected('https://apps.apple.com/app/id310633997', /another tool/i);
  rejected('https://play.google.com/store/apps/details?id=com.example.app', /another tool/i);
  rejected('https://open.spotify.com/playlist/example', /another tool/i);
  rejected('https://qrstatic.app/calendar-event-qr-code-generator.html', /another tool/i);
  rejected('WIFI:T:WPA;S:Guest;P:secret;;', /another tool/i);
  rejected('mailto:ada@example.com', /another tool/i);
});

test('the calendly.com homepage, marketing pages, and extra path segments are rejected', function () {
  rejected('https://calendly.com', /not a public booking page/i);
  rejected('https://calendly.com/', /not a public booking page/i);
  rejected('https://calendly.com/pricing', /not a public booking page/i);
  rejected('https://calendly.com/help', /not a public booking page/i);
  rejected('https://calendly.com/example-user/30min/extra', /not a public booking page/i);
  rejected('https://calendly.com/d/abc-123-xyz/intro-call/extra', /not a public booking page/i);
  rejected('https://calendly.com/d', /missing a public event id/i);
  rejected('https://calendly.com/example-user?email=ada@example.com', /will not encode/i);
  rejected('https://calendly.com/example-user?url=https://evil.example', /redirect/i);
});

test('payload guard refuses short links and non-booking calendly URLs', function () {
  assert.throws(function () {
    api.assertStaticCalendlyPayload({ payload: 'https://bit.ly/example-book' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticCalendlyPayload({ payload: 'https://calendly.com/login' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticCalendlyPayload({ payload: 'https://calendly.com/example-user?token=abc' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticCalendlyPayload({ payload: '' });
  }, /Refusing to encode/);
});

test('page, sitemap, homepage, calendar page, and guides meet the booking-page contract', function () {
  const page = fs.readFileSync(path.join(root, 'calendly-qr-code-generator.html'), 'utf8');
  const pageJs = fs.readFileSync(path.join(root, 'js/calendly-page.js'), 'utf8');
  const payloadJs = fs.readFileSync(path.join(root, 'js/calendly-payload.js'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const calendar = fs.readFileSync(path.join(root, 'calendar-event-qr-code-generator.html'), 'utf8');
  const why = fs.readFileSync(path.join(root, 'guides/why-did-my-qr-code-stop-working.html'), 'utf8');
  const versus = fs.readFileSync(path.join(root, 'guides/static-vs-dynamic-qr.html'), 'utf8');
  const ads = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8');

  assert.match(page, /<title>Free Calendly QR Code Generator \| QRStatic<\/title>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/qrstatic\.app\/calendly-qr-code-generator\.html">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/qrstatic\.app\/calendly-qr-code-generator\.html">/);
  assert.match(page, /picks a time/i);
  assert.match(page, /VEVENT/);
  assert.match(page, /ICS/);
  assert.match(page, /href="calendar-event-qr-code-generator\.html"/);
  assert.match(page, /does not expire on our side/i);
  assert.match(page, /closed or deleted/i);
  assert.match(page, /account is disabled/i);
  assert.match(page, /Calendly’s side/);
  assert.match(page, /not official Calendly/i);
  assert.match(page, /right to share/i);
  assert.match(page, /paywall/i);
  assert.match(page, /private event/i);
  assert.match(page, /access restriction/i);
  assert.match(page, /not uploaded/i);
  assert.match(page, /works offline/i);
  assert.match(page, /no watermark/i);
  assert.match(page, /no trial expiry/i);
  assert.match(page, /No signup/);
  assert.match(page, /no user-agent/i);
  assert.match(page, /no device routing/i);
  assert.match(page, /id="download-png"/);
  assert.match(page, /id="download-svg"/);
  assert.match(page, /ca-pub-8737820277849030/);
  assert.match(page, /href="guides\/why-did-my-qr-code-stop-working\.html"/);
  assert.match(page, /href="guides\/static-vs-dynamic-qr\.html"/);
  assert.match(page, /js\/share\.js/);
  assert.doesNotMatch(pageJs, /userAgent|navigator\.platform|fetch\s*\(/);
  assert.doesNotMatch(payloadJs, /userAgent|fetch\s*\(/);
  assert.match(payloadJs, /No user-agent routing/);

  assert.match(sitemap, /<loc>https:\/\/qrstatic\.app\/calendly-qr-code-generator\.html<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  assert.match(index, /href="calendly-qr-code-generator\.html"/);
  assert.match(index, /name="toolfound-verify" content="490c0cfeeb94b3d65d893e18dcff92dca9ab1b123e18a330"/);
  assert.match(index, /name="google-adsense-account" content="ca-pub-8737820277849030"/);
  assert.match(calendar, /href="calendly-qr-code-generator\.html"/);
  assert.match(calendar, /picks a time/i);
  assert.match(calendar, /VEVENT/);
  assert.match(why, /href="\.\.\/calendly-qr-code-generator\.html"/);
  assert.match(versus, /href="\.\.\/calendly-qr-code-generator\.html"/);
  assert.match(ads, /pub-8737820277849030/);
});

test('Google Form and App Store payloads still accept a known-good link', function () {
  const form = loadIIFE('js/google-form-payload.js').GoogleFormPayload.buildGoogleFormPayload(
    'http://docs.google.com/forms/d/e/1FAIpQLSdExampleFormId0001/viewform?usp=sf_link'
  );
  assert.equal(
    form.payload,
    'https://docs.google.com/forms/d/e/1FAIpQLSdExampleFormId0001/viewform?usp=sf_link'
  );

  const stores = loadIIFE('js/app-store-play-payload.js').AppStorePlayPayload;
  const built = stores.buildStoreQrPayloads(
    'https://apps.apple.com/us/app/example-app/id310633997',
    'https://play.google.com/store/apps/details?id=com.example.app'
  );
  assert.equal(built.errors.length, 0);
  assert.equal(built.appStore.payload, 'https://apps.apple.com/us/app/example-app/id310633997');
  assert.equal(built.play.payload, 'https://play.google.com/store/apps/details?id=com.example.app');
});

test('generated SVG payloads are static images of the booking URL', function () {
  const sandbox = loadIIFE('vendor/qrcode.min.js');
  const QRCode = sandbox.QRCode;
  assert.equal(typeof QRCode.toString, 'function');
  const opts = { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 256 };
  const payloads = [HOME, EVENT, DIRECT].map(function (input) {
    return api.buildCalendlyPayload(input).payload;
  });
  return Promise.all(payloads.map(function (payload) {
    return QRCode.toString(payload, opts);
  })).then(function (svgs) {
    assert.equal(svgs.length, 3);
    svgs.forEach(function (svg, i) {
      assert.match(svg, /<svg/);
      assert.equal(svg.includes('bit.ly'), false);
      assert.equal(svg.includes('onelink'), false);
      assert.equal(svg.includes('userAgent'), false);
      assert.equal(svg.includes('qrstatic.app'), false);
      if (i > 0) assert.notEqual(svg, svgs[0]);
    });
    assert.notEqual(svgs[1], svgs[2]);
  });
});
