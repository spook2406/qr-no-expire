'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { root, loadIIFE } = require('./helpers');

function loadPayload() {
  return loadIIFE('js/linkedin-payload.js').LinkedInPayload;
}

const api = loadPayload();
const PROFILE = 'https://linkedin.com/in/jane-doe';
const COMPANY = 'https://linkedin.com/company/acme';
const SCHOOL = 'https://linkedin.com/school/north-university';

function rejected(input, pattern) {
  assert.throws(function () { api.buildLinkedInPayload(input); }, pattern || /not encoded|Nothing was encoded/i);
}

test('public profile, company, and school URLs are accepted', function () {
  const profile = api.buildLinkedInPayload(PROFILE);
  assert.equal(profile.payload, PROFILE);
  assert.equal(profile.url, PROFILE);
  assert.equal(profile.type, 'profile');
  assert.equal(profile.host, 'linkedin.com');
  assert.equal(profile.normalized, false);
  assert.match(profile.warning, /not an official LinkedIn product/i);
  assert.match(profile.warning, /does not make a private profile public/i);

  const company = api.buildLinkedInPayload(COMPANY);
  assert.equal(company.payload, COMPANY);
  assert.equal(company.type, 'company');

  const school = api.buildLinkedInPayload(SCHOOL);
  assert.equal(school.payload, SCHOOL);
  assert.equal(school.type, 'school');

  api.assertStaticLinkedInPayload(profile);
  api.assertStaticLinkedInPayload(company);
  api.assertStaticLinkedInPayload(school);
});

test('https may be omitted, and http, www, hash, and a trailing slash are normalized', function () {
  assert.equal(api.buildLinkedInPayload('linkedin.com/in/jane-doe').payload, PROFILE);
  assert.equal(api.buildLinkedInPayload('http://www.linkedin.com/in/jane-doe/').payload, PROFILE);
  assert.equal(api.buildLinkedInPayload('https://www.linkedin.com/in/jane-doe#experience').payload, PROFILE);
  assert.equal(api.buildLinkedInPayload('//www.linkedin.com/in/jane-doe').payload, PROFILE);
  assert.equal(api.buildLinkedInPayload('HTTP://WWW.LINKEDIN.COM/in/Jane-Doe').payload, 'https://linkedin.com/in/Jane-Doe');
  assert.equal(api.buildLinkedInPayload('https://www.linkedin.com/IN/jane-doe').payload, PROFILE);
  const bare = api.buildLinkedInPayload('www.linkedin.com/company/acme/');
  assert.equal(bare.payload, COMPANY);
  assert.equal(bare.normalized, true);
  const quoted = api.buildLinkedInPayload('  "https://linkedin.com/in/jane-doe"  ');
  assert.equal(quoted.payload, PROFILE);
  const zw = api.buildLinkedInPayload('https://linkedin.com/in/\u200Bjane-doe');
  assert.equal(zw.payload, PROFILE);
});

test('a single-label country subdomain is canonicalized to linkedin.com', function () {
  assert.equal(
    api.buildLinkedInPayload('http://uk.linkedin.com/in/jane-doe/').payload,
    PROFILE
  );
  assert.equal(
    api.buildLinkedInPayload('https://www.uk.linkedin.com/company/acme').payload,
    COMPANY
  );
  assert.equal(
    api.buildLinkedInPayload('//de.linkedin.com/school/north-university/').payload,
    SCHOOL
  );
  assert.equal(
    api.buildLinkedInPayload('https://m.linkedin.com/in/jane-doe').payload,
    PROFILE
  );
  assert.equal(
    api.buildLinkedInPayload('fr.linkedin.com/in/jane-doe').payload,
    PROFILE
  );
});

test('utm, fbclid, gclid, and LinkedIn tracking params are stripped; the hash is dropped', function () {
  const tracked = api.buildLinkedInPayload(
    'http://www.linkedin.com/in/jane-doe/?utm_source=share&utm_medium=member_desktop&utm_campaign=share_via&fbclid=abc&gclid=xyz#about'
  );
  assert.equal(tracked.payload, PROFILE);
  assert.equal(tracked.payload.includes('utm_'), false);
  assert.equal(tracked.payload.includes('fbclid'), false);
  assert.equal(tracked.payload.includes('gclid'), false);
  assert.equal(tracked.payload.includes('#'), false);
  assert.equal(tracked.payload.includes('?'), false);
  assert.equal(tracked.normalized, true);

  const trk = api.buildLinkedInPayload(
    'https://uk.linkedin.com/company/acme?trk=public_profile&originalSubdomain=uk&lipi=urn%3Ali%3Apage&trkInfo=abc'
  );
  assert.equal(trk.payload, COMPANY);

  const about = api.buildLinkedInPayload('https://www.linkedin.com/company/acme/about/');
  assert.equal(about.payload, 'https://linkedin.com/company/acme/about');
  assert.equal(about.type, 'company');
});

test('empty input is a clear error and encodes nothing', function () {
  ['', '   ', '""', "''", null, undefined].forEach(function (value) {
    rejected(value, /Nothing was encoded/);
  });
});

test('login, signup, authwall, checkpoint, and uas/login are rejected', function () {
  const samples = [
    'https://www.linkedin.com/login',
    'https://www.linkedin.com/login/',
    'https://linkedin.com/signup',
    'https://www.linkedin.com/signup/cold-join',
    'https://www.linkedin.com/uas/login',
    'https://uk.linkedin.com/uas/login?session_redirect=%2Ffeed%2F',
    'https://www.linkedin.com/checkpoint/lg/login-submit',
    'https://www.linkedin.com/checkpoint/challenge/abc',
    'https://www.linkedin.com/authwall',
    'https://www.linkedin.com/authwall?trk=bf',
    'https://linkedin.com/start/join',
    'http://www.linkedin.com/signin',
    'https://www.linkedin.com/checkpoint/challengesV2/AQE'
  ];
  samples.forEach(function (url) {
    rejected(url, /login, signup, authwall, or checkpoint/i);
    rejected(url, /not encoded/i);
  });
});

test('share interstitial pages are rejected', function () {
  [
    'https://www.linkedin.com/sharing/share-offsite/?url=https://example.com',
    'https://www.linkedin.com/share-offsite/?url=https://example.com',
    'https://www.linkedin.com/shareArticle?mini=true&url=https://example.com',
    'https://www.linkedin.com/shareArticle/',
    'https://de.linkedin.com/share?url=https://example.com',
    'https://www.linkedin.com/sharing/share-offsite/'
  ].forEach(function (url) {
    rejected(url, /share interstitial/i);
    rejected(url, /not encoded/i);
  });
});

test('non-LinkedIn domains, lnkd.in, and other shorteners are rejected', function () {
  [
    'https://example.com/in/jane-doe',
    'https://linkedin.com.evil.example/in/jane-doe',
    'https://notlinkedin.com/in/jane-doe',
    'https://www.licdn.com/in/jane-doe',
    'https://media.licdn.com/dms/image/example',
    'https://evil.example/company/acme'
  ].forEach(function (url) {
    rejected(url, /not a linkedin\.com/i);
  });

  [
    'https://lnkd.in/eAbc123',
    'https://www.lnkd.in/eAbc123',
    'http://lnkd.in/eAbc123',
    'https://bit.ly/jane-doe',
    'https://tinyurl.com/jane-doe',
    'www.bit.ly/jane-doe',
    'https://t.co/abc123'
  ].forEach(function (url) {
    rejected(url, /short link/i);
    rejected(url, /not encoded/i);
  });
});

test('qrstatic.app short links and redirects are rejected', function () {
  [
    'https://qrstatic.app/abc',
    'https://www.qrstatic.app/r/linkedin',
    'https://preview.qrstatic.app/go/abc',
    'http://qrstatic.app/linkedin-qr-code-generator.html'
  ].forEach(function (url) {
    rejected(url, /qrstatic\.app/i);
    rejected(url, /not encoded/i);
  });
});

test('nested LinkedIn hosts, redirects, admin paths, and other non-public URLs are rejected', function () {
  rejected('https://a.b.linkedin.com/in/jane-doe', /more than one subdomain/i);
  rejected('https://www.linkedin.com/safety/go/?url=https://example.com', /redirect/i);
  rejected('https://www.linkedin.com/redir/redirect/?url=https://example.com', /redirect/i);
  rejected('https://linkedin.com/in/jane-doe?session_redirect=https://evil.example', /redirect/i);
  rejected('https://linkedin.com/in/jane-doe?url=https://evil.example', /redirect/i);
  rejected('https://www.linkedin.com/company/acme/admin', /admin, edit, or overlay/i);
  rejected('https://www.linkedin.com/in/jane-doe/overlay/contact-info', /admin, edit, or overlay/i);
  rejected('https://www.linkedin.com/company/acme/edit', /admin, edit, or overlay/i);
  rejected('https://www.linkedin.com/', /not a public profile/i);
  rejected('https://www.linkedin.com/jobs/view/123', /not a public profile/i);
  rejected('https://www.linkedin.com/feed/', /not a public profile/i);
  rejected('https://linkedin.com/in/', /missing the public name/i);
  rejected('https://linkedin.com/company', /missing the public name/i);
  rejected('https://linkedin.com/in/jane-doe?locale=en_US', /will not encode/i);
  rejected('https://linkedin.com/in/jane-doe?miniProfileUrn=urn%3Ali%3Afs', /will not encode/i);
  rejected('https://user:pass@linkedin.com/in/jane-doe', /username or password/i);
  rejected('https://linkedin.com:8443/in/jane-doe', /unexpected port/i);
  rejected('javascript:alert(1)', /not encoded/i);
  rejected('https://linkedin.com/in//jane-doe', /invalid/i);
  rejected('https://linkedin.com/in/jane doe', /space/i);
});

test('other in-site tool links are rejected instead of encoded', function () {
  rejected('https://meet.google.com/abc-defg-hij', /Google Meet/i);
  rejected('https://calendly.com/example-user/30min', /another tool/i);
  rejected('mailto:ada@example.com', /another tool/i);
  rejected('BEGIN:VCARD\r\nFN:Ada\r\nEND:VCARD', /another tool/i);
  rejected('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Demo\r\nEND:VEVENT\r\nEND:VCALENDAR', /calendar event/i);
  rejected('https://docs.google.com/forms/d/e/1FAIpQLSdExampleFormId0001/viewform', /another tool/i);
});

test('payload guard refuses short links, login URLs, and empty payloads', function () {
  assert.throws(function () {
    api.assertStaticLinkedInPayload({ payload: 'https://bit.ly/jane-doe' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinkedInPayload({ payload: 'https://lnkd.in/eAbc123' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinkedInPayload({ payload: 'https://qrstatic.app/abc' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinkedInPayload({ payload: 'https://linkedin.com/login' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinkedInPayload({ payload: 'https://linkedin.com/in/jane-doe?utm_source=x' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinkedInPayload({ payload: 'https://linkedin.com/in/jane-doe#about' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinkedInPayload({ payload: '' });
  }, /Refusing to encode/);
});

test('a successful payload is the normalized HTTPS URL and nothing else', function () {
  const built = api.buildLinkedInPayload(
    'http://www.uk.linkedin.com/in/jane-doe/?utm_source=card&fbclid=abc&gclid=xyz#top'
  );
  assert.equal(built.payload, PROFILE);
  assert.equal(built.payload.startsWith('https://linkedin.com/'), true);
  assert.equal(built.payload.includes('qrstatic.app'), false);
  assert.equal(built.payload.includes('lnkd.in'), false);
  assert.equal(/utm_|fbclid|gclid|#|\?/.test(built.payload), false);
});

test('page, sitemap, and homepage meet the LinkedIn tool contract', function () {
  const page = fs.readFileSync(path.join(root, 'linkedin-qr-code-generator.html'), 'utf8');
  const pageJs = fs.readFileSync(path.join(root, 'js/linkedin-page.js'), 'utf8');
  const payloadJs = fs.readFileSync(path.join(root, 'js/linkedin-payload.js'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ads = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8');

  assert.match(page, /<title>Free LinkedIn Profile QR Code Generator \| QRStatic<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]{40,}">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/qrstatic\.app\/linkedin-qr-code-generator\.html">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/qrstatic\.app\/linkedin-qr-code-generator\.html">/);
  assert.match(page, /id="download-png"/);
  assert.match(page, /id="download-svg"/);
  assert.match(page, /ca-pub-8737820277849030/);
  assert.match(page, /G-JV95W19XS3/);
  assert.match(page, /js\/share\.js/);
  assert.match(page, /href="vcard-qr-code-generator\.html"/);
  assert.match(page, /href="guides\/vcard-qr-code-business-card-no-signup\.html"/);
  assert.match(page, /href="email-qr-code-generator\.html"/);
  assert.match(page, /quiet zone/i);
  assert.match(page, /dark modules on a light background/i);
  assert.match(page, /do not overlay the official LinkedIn logo in the center of the code/i);
  assert.match(page, /official LinkedIn app/i);
  assert.match(page, /static URL/i);
  assert.match(page, /desktop/i);
  assert.match(page, /business card/i);
  assert.match(page, /resume/i);
  assert.match(page, /vanity URL/i);
  assert.match(page, /less dense/i);
  assert.match(page, /reprint/i);
  assert.match(page, /not an official LinkedIn product/i);
  assert.match(page, /does not make a private profile public/i);
  assert.match(page, /No signup/);
  assert.match(page, /no watermark/i);
  assert.match(page, /no trial expiry/i);
  assert.match(page, /in your browser/i);
  assert.doesNotMatch(page, /search ranking|rank on|passive income|make money|earn money|\bSEO\b|more clients|more leads/i);
  assert.doesNotMatch(page, /youtube-channel-qr-code-generator|whatsapp-channel-qr-code-generator|apple-music-qr-code-generator/);
  assert.doesNotMatch(pageJs, /userAgent|navigator\.platform|fetch\s*\(/);
  assert.doesNotMatch(payloadJs, /userAgent|fetch\s*\(/);
  assert.match(pageJs, /QRCode\.toCanvas\(canvas, built\.payload/);
  assert.match(payloadJs, /No user-agent routing/);

  assert.match(
    sitemap,
    /<loc>https:\/\/qrstatic\.app\/calendly-qr-code-generator\.html<\/loc><lastmod>2026-11-10<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/linkedin-qr-code-generator\.html<\/loc><lastmod>2026-11-16<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/youtube-channel-qr-code-generator\.html<\/loc><lastmod>2026-11-19<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/contact\.html<\/loc><lastmod>2026-11-07<\/lastmod>/
  );
  assert.equal(
    (sitemap.match(/<loc>https:\/\/qrstatic\.app\/linkedin-qr-code-generator\.html<\/loc>/g) || []).length,
    1
  );

  assert.equal((index.match(/href="linkedin-qr-code-generator\.html"/g) || []).length, 1);
  assert.match(index, /name="toolfound-verify" content="490c0cfeeb94b3d65d893e18dcff92dca9ab1b123e18a330"/);
  assert.match(index, /name="google-adsense-account" content="ca-pub-8737820277849030"/);
  assert.equal(ads, 'google.com, pub-8737820277849030, DIRECT, f08c47fec0942fa0\n');
});

test('existing sitemap entries keep their loc, lastmod, changefreq, and priority', function () {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const blocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(function (m) { return m[1]; });
  const linkedin = blocks.filter(function (block) { return block.includes('linkedin-qr-code-generator.html'); });
  assert.equal(linkedin.length, 1);
  const rest = blocks.filter(function (block) {
    return block.indexOf('linkedin-qr-code-generator.html') === -1 &&
      block.indexOf('youtube-channel-qr-code-generator.html') === -1;
  });
  const expected = [
    'https://qrstatic.app/|2026-11-07|weekly|1.0',
    'https://qrstatic.app/wifi-qr-code-generator.html|2026-11-05|weekly|0.9',
    'https://qrstatic.app/vcard-qr-code-generator.html|2026-10-28|weekly|0.9',
    'https://qrstatic.app/calendar-event-qr-code-generator.html|2026-10-30|weekly|0.9',
    'https://qrstatic.app/google-review-qr-code-generator.html|2026-11-05|weekly|0.9',
    'https://qrstatic.app/sms-qr-code-generator.html|2026-11-01|weekly|0.9',
    'https://qrstatic.app/whatsapp-qr-code-generator.html|2026-11-07|weekly|0.9',
    'https://qrstatic.app/email-qr-code-generator.html|2026-11-02|weekly|0.9',
    'https://qrstatic.app/phone-call-qr-code-generator.html|2026-11-03|weekly|0.9',
    'https://qrstatic.app/location-qr-code-generator.html|2026-11-03|weekly|0.9',
    'https://qrstatic.app/totp-qr-code-generator.html|2026-11-04|weekly|0.9',
    'https://qrstatic.app/spotify-qr-code-generator.html|2026-11-05|weekly|0.9',
    'https://qrstatic.app/telegram-qr-code-generator.html|2026-11-06|weekly|0.9',
    'https://qrstatic.app/discord-qr-code-generator.html|2026-11-06|weekly|0.9',
    'https://qrstatic.app/zoom-meeting-qr-code-generator.html|2026-11-06|weekly|0.9',
    'https://qrstatic.app/google-meet-qr-code-generator.html|2026-11-07|weekly|0.9',
    'https://qrstatic.app/teams-meeting-qr-code-generator.html|2026-11-07|weekly|0.9',
    'https://qrstatic.app/google-form-qr-code-generator.html|2026-11-10|weekly|0.9',
    'https://qrstatic.app/app-store-google-play-qr-code-generator.html|2026-11-10|weekly|0.9',
    'https://qrstatic.app/calendly-qr-code-generator.html|2026-11-10|weekly|0.9',
    'https://qrstatic.app/contact.html|2026-11-07|monthly|0.5',
    'https://qrstatic.app/about.html|2026-11-07|monthly|0.5',
    'https://qrstatic.app/privacy.html|2026-11-07|monthly|0.4',
    'https://qrstatic.app/terms.html|2026-11-04|monthly|0.4',
    'https://qrstatic.app/guides/|2026-11-07|weekly|0.7',
    'https://qrstatic.app/guides/static-qr-no-expiration.html|2026-10-30|monthly|0.8',
    'https://qrstatic.app/guides/free-forever-qr-code.html|2026-10-30|monthly|0.8',
    'https://qrstatic.app/guides/static-vs-dynamic-qr.html|2026-10-28|monthly|0.8',
    'https://qrstatic.app/guides/qr-code-that-never-expires.html|2026-10-28|monthly|0.8',
    'https://qrstatic.app/guides/restaurant-menu-qr-code-never-expires.html|2026-10-28|monthly|0.8',
    'https://qrstatic.app/guides/wedding-qr-code-static-no-signup.html|2026-10-28|monthly|0.8',
    'https://qrstatic.app/guides/why-did-my-qr-code-stop-working.html|2026-11-04|monthly|0.8',
    'https://qrstatic.app/guides/wifi-qr-not-working-after-password-change.html|2026-11-06|monthly|0.8',
    'https://qrstatic.app/guides/qr-code-expired-after-free-trial.html|2026-10-28|monthly|0.8',
    'https://qrstatic.app/guides/google-review-qr-code-static.html|2026-11-06|monthly|0.8',
    'https://qrstatic.app/guides/static-or-dynamic-qr-how-to-tell.html|2026-10-28|monthly|0.8',
    'https://qrstatic.app/guides/qr-code-print-size-scan-distance.html|2026-10-28|monthly|0.8',
    'https://qrstatic.app/guides/cafe-table-tent-menu-wifi-review-qr.html|2026-11-05|monthly|0.8',
    'https://qrstatic.app/guides/guest-wifi-qr-code-cafe-restaurant.html|2026-11-06|monthly|0.8',
    'https://qrstatic.app/guides/free-google-review-qr-no-monthly-fee.html|2026-11-06|monthly|0.8',
    'https://qrstatic.app/guides/product-packaging-qr-code-never-expires.html|2026-11-12|monthly|0.8',
    'https://qrstatic.app/guides/vcard-qr-code-business-card-no-signup.html|2026-11-12|monthly|0.8',
    'https://qrstatic.app/guides/whatsapp-click-to-chat-qr-code.html|2026-11-12|monthly|0.8',
    'https://qrstatic.app/guides/google-form-qr-code-attendance-rsvp.html|2026-11-12|monthly|0.8',
    'https://qrstatic.app/guides/google-maps-location-qr-code-store.html|2026-11-12|monthly|0.8',
    'https://qrstatic.app/whatsapp-channel-qr-code-generator.html|2026-11-22|weekly|0.9'
  ];
  assert.deepEqual(rest.map(function (block) {
    const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1];
    const lastmod = (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1];
    const changefreq = (block.match(/<changefreq>([^<]+)<\/changefreq>/) || [])[1];
    const priority = (block.match(/<priority>([^<]+)<\/priority>/) || [])[1];
    return [loc, lastmod, changefreq, priority].join('|');
  }), expected);
});

test('generated SVG is a static image and the payload is not a short link', function () {
  const sandbox = loadIIFE('vendor/qrcode.min.js');
  const QRCode = sandbox.QRCode;
  assert.equal(typeof QRCode.toString, 'function');
  const opts = { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 256 };
  const payloads = [PROFILE, COMPANY, SCHOOL].map(function (input) {
    return api.buildLinkedInPayload(input).payload;
  });
  return Promise.all(payloads.map(function (payload) {
    return QRCode.toString(payload, opts);
  })).then(function (svgs) {
    assert.equal(svgs.length, 3);
    svgs.forEach(function (svg, i) {
      assert.match(svg, /<svg/);
      assert.equal(svg.includes('bit.ly'), false);
      assert.equal(svg.includes('lnkd.in'), false);
      assert.equal(svg.includes('qrstatic.app'), false);
      assert.equal(svg.includes('userAgent'), false);
      if (i > 0) assert.notEqual(svg, svgs[0]);
    });
  });
});
