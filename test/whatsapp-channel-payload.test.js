'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { root, loadIIFE } = require('./helpers');

function loadPayload() {
  return loadIIFE('js/whatsapp-channel-payload.js').WhatsAppChannelPayload;
}

const api = loadPayload();
const CODE = '0029VaAbCdEfGhIjKlMnOp';
const CHANNEL = 'https://whatsapp.com/channel/' + CODE;
const CLICK = 'https://qrstatic.app/whatsapp-qr-code-generator.html';

function rejected(input, pattern) {
  assert.throws(function () { api.buildWhatsAppChannelPayload(input); }, pattern || /not encoded|Nothing was encoded/i);
}

test('a public channel follow URL is accepted and encoded directly', function () {
  const built = api.buildWhatsAppChannelPayload(CHANNEL);
  assert.equal(built.payload, CHANNEL);
  assert.equal(built.url, CHANNEL);
  assert.equal(built.type, 'channel');
  assert.equal(built.host, 'whatsapp.com');
  assert.equal(built.normalized, false);
  assert.match(built.warning, /not an official WhatsApp product/i);
  assert.match(built.warning, /does not bypass WhatsApp privacy, bans, or non-public limits/i);
  assert.match(built.warning, /remade from the current public link/i);
  assert.equal(built.payload.includes('qrstatic.app'), false);
  assert.equal(built.payload.includes('wa.me'), false);
  api.assertStaticWhatsAppChannelPayload(built);
});

test('https may be omitted, and http, www, hash, and a trailing slash are normalized', function () {
  assert.equal(api.buildWhatsAppChannelPayload('whatsapp.com/channel/' + CODE).payload, CHANNEL);
  assert.equal(api.buildWhatsAppChannelPayload('www.whatsapp.com/channel/' + CODE).payload, CHANNEL);
  assert.equal(api.buildWhatsAppChannelPayload('http://www.whatsapp.com/channel/' + CODE + '/').payload, CHANNEL);
  assert.equal(api.buildWhatsAppChannelPayload('https://www.whatsapp.com/channel/' + CODE + '#update').payload, CHANNEL);
  assert.equal(api.buildWhatsAppChannelPayload('//www.whatsapp.com/channel/' + CODE).payload, CHANNEL);
  assert.equal(api.buildWhatsAppChannelPayload('HTTP://WWW.WHATSAPP.COM/channel/' + CODE).payload, CHANNEL);
  const bare = api.buildWhatsAppChannelPayload('www.whatsapp.com/channel/' + CODE + '/');
  assert.equal(bare.payload, CHANNEL);
  assert.equal(bare.normalized, true);
  const quoted = api.buildWhatsAppChannelPayload('  "' + CHANNEL + '"  ');
  assert.equal(quoted.payload, CHANNEL);
  const zw = api.buildWhatsAppChannelPayload('https://whatsapp.com/channel/' + CODE.slice(0, 4) + '\u200B' + CODE.slice(4));
  assert.equal(zw.payload, CHANNEL);
  const cased = api.buildWhatsAppChannelPayload('http://www.whatsapp.com/channel/AbCdEf1234567XyZ/');
  assert.equal(cased.payload, 'https://whatsapp.com/channel/AbCdEf1234567XyZ');
  assert.equal(cased.type, 'channel');
});

test('utm, fbclid, gclid, and other tracking parameters are stripped', function () {
  const tracked = api.buildWhatsAppChannelPayload(
    'http://www.whatsapp.com/channel/' + CODE + '/?utm_source=share&utm_medium=social&utm_campaign=channel&fbclid=f&gclid=g&igshid=ig&mc_cid=mc&ref=share&source=ig#followers'
  );
  assert.equal(tracked.payload, CHANNEL);
  assert.equal(tracked.payload.includes('utm_'), false);
  assert.equal(tracked.payload.includes('fbclid'), false);
  assert.equal(tracked.payload.includes('gclid'), false);
  assert.equal(tracked.payload.includes('igshid'), false);
  assert.equal(tracked.payload.includes('mc_cid'), false);
  assert.equal(tracked.payload.includes('ref='), false);
  assert.equal(tracked.payload.includes('source='), false);
  assert.equal(tracked.payload.includes('#'), false);
  assert.equal(tracked.payload.includes('?'), false);
  assert.equal(tracked.normalized, true);
  assert.equal(tracked.payload.startsWith('https://whatsapp.com/channel/'), true);
});

test('empty input is a clear error and encodes nothing', function () {
  ['', '   ', '""', "''", null, undefined].forEach(function (value) {
    rejected(value, /Nothing was encoded/);
  });
});

test('phone numbers and wa.me or send links point at the click-to-chat page and are not encoded', function () {
  [
    '15551234567',
    '+1 555 123 4567',
    '+1 (555) 123-4567',
    'wa.me/15551234567',
    'https://wa.me/15551234567',
    'https://wa.me/15551234567?text=Hello',
    'http://api.whatsapp.com/send?phone=15551234567',
    'https://api.whatsapp.com/send/?phone=15551234567&text=Hello',
    'https://web.whatsapp.com/send?phone=15551234567',
    'whatsapp://send?phone=15551234567'
  ].forEach(function (input) {
    assert.throws(function () { api.buildWhatsAppChannelPayload(input); }, function (err) {
      assert.match(err.message, /click-to-chat/i);
      assert.match(err.message, new RegExp(CLICK.replace(/[.]/g, '\\.')));
      assert.match(err.message, /will not generate a code/i);
      assert.match(err.message, /Nothing was encoded/);
      return true;
    });
  });
});

test('group invites, Community invites, and join-to-view links are rejected', function () {
  [
    'https://chat.whatsapp.com/AbCdEfGhIjKlMnOp',
    'https://www.chat.whatsapp.com/AbCdEfGhIjKlMnOpQr',
    'http://chat.whatsapp.com/'
  ].forEach(function (url) {
    rejected(url, /group invite/i);
    rejected(url, /not encoded/i);
  });

  [
    'https://chat.whatsapp.com/invite/AbCdEfGhIjKlMnOp',
    'https://www.chat.whatsapp.com/community/AbCdEfGhIjKlMnOp',
    'https://whatsapp.com/community/AbCdEfGhIjKlMnOpQrSt',
    'https://www.whatsapp.com/channel/' + CODE + '?type=community'
  ].forEach(function (url) {
    rejected(url, /Community/i);
    rejected(url, /out of scope/i);
    rejected(url, /not encoded/i);
  });

  rejected('https://whatsapp.com/join/' + CODE, /requires joining/i);
  rejected('https://whatsapp.com/channel/' + CODE + '/join', /requires joining/i);
  rejected('https://whatsapp.com/channel/' + CODE + '/private', /requires joining/i);
});

test('WhatsApp Web login, pairing codes, 2FA, and Status are rejected', function () {
  [
    'https://web.whatsapp.com/',
    'https://web.whatsapp.com/login',
    'https://www.whatsapp.com/desktop'
  ].forEach(function (url) {
    rejected(url, /WhatsApp Web or desktop login/i);
    rejected(url, /Do not use this page to scan a WhatsApp Web login code/i);
  });

  [
    'ABCD-EFGH',
    'https://whatsapp.com/linked-devices',
    'https://www.whatsapp.com/pair',
    'https://wa.me/settings/linked_devices'
  ].forEach(function (url) {
    rejected(url, /linked-device or pairing code/i);
    rejected(url, /Pairing codes are not encoded/i);
  });

  [
    'otpauth://totp/WhatsApp:name?secret=JBSWY3DPEHPK3PXP',
    '123456',
    'https://whatsapp.com/2fa',
    'https://www.whatsapp.com/authenticator'
  ].forEach(function (url) {
    rejected(url, /2FA or authenticator/i);
    rejected(url, /not encoded/i);
  });

  rejected('https://www.whatsapp.com/status', /Status/i);
  rejected('https://status.whatsapp.com/', /Status/i);
  rejected('https://whatsapp.com/channel/' + CODE + '/status', /Status/i);
});

test('non-channel domains, shorteners, and qrstatic.app links are rejected', function () {
  [
    'https://example.com/channel/' + CODE,
    'https://whatsapp.com.evil.example/channel/' + CODE,
    'https://notwhatsapp.com/channel/' + CODE,
    'https://music.apple.com/us/album/example/1234567890',
    'https://faq.whatsapp.com/360977646301595',
    'https://business.whatsapp.com/'
  ].forEach(function (url) {
    rejected(url, /not a public whatsapp\.com\/channel|not the public channel host/i);
  });

  [
    'https://bit.ly/' + CODE,
    'https://tinyurl.com/example',
    'https://t.co/abc123',
    'www.bit.ly/example'
  ].forEach(function (url) {
    rejected(url, /short link/i);
    rejected(url, /Shorteners are not followed/i);
  });

  [
    'https://qrstatic.app/abc',
    'https://www.qrstatic.app/r/channel',
    'https://preview.qrstatic.app/go/abc',
    'http://qrstatic.app/whatsapp-channel-qr-code-generator.html',
    'https://qrstatic.app/whatsapp-qr-code-generator.html'
  ].forEach(function (url) {
    rejected(url, /qrstatic\.app/i);
    rejected(url, /does not put qrstatic\.app inside the QR/i);
  });
});

test('invalid codes, redirects, login parameters, and unknown parameters are rejected', function () {
  rejected('https://whatsapp.com/channel/', /missing the public channel code/i);
  rejected('https://whatsapp.com/channel/short', /channel code looks invalid/i);
  rejected('https://whatsapp.com/channel/' + CODE + '/extra', /path looks invalid/i);
  rejected('https://whatsapp.com/redirect?q=https://evil.example', /redirect/i);
  rejected('https://whatsapp.com/channel/' + CODE + '?url=https://evil.example', /redirect/i);
  rejected('https://whatsapp.com/channel/' + CODE + '?session_token=abc', /login or session parameter/i);
  rejected('https://whatsapp.com/channel/' + CODE + '?app=desktop', /will not encode/i);
  rejected('https://user:pass@whatsapp.com/channel/' + CODE, /username or password/i);
  rejected('https://whatsapp.com:8443/channel/' + CODE, /unexpected port/i);
  rejected('javascript:alert(1)', /not encoded/i);
  rejected('https://whatsapp.com/channel/' + CODE + ' extra', /space/i);
  rejected('120363099887766554@newsletter', /not a public follow link/i);
});

test('other in-site tool links are rejected instead of encoded', function () {
  rejected('https://meet.google.com/abc-defg-hij', /Google Meet/i);
  rejected('https://youtube.com/@examplechannel', /another tool/i);
  rejected('https://calendly.com/example-user/30min', /another tool/i);
  rejected('https://linkedin.com/in/jane-doe', /another tool/i);
  rejected('https://t.me/example', /another tool/i);
  rejected('https://discord.gg/abcDEF12', /another tool/i);
  rejected('mailto:ada@example.com', /another tool/i);
  rejected('BEGIN:VCARD\r\nFN:Ada\r\nEND:VCARD', /another tool/i);
  rejected('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Demo\r\nEND:VEVENT\r\nEND:VCALENDAR', /calendar event/i);
});

test('payload guard refuses short links, click-to-chat, login URLs, and empty payloads', function () {
  assert.throws(function () {
    api.assertStaticWhatsAppChannelPayload({ payload: 'https://bit.ly/' + CODE });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticWhatsAppChannelPayload({ payload: 'https://qrstatic.app/abc' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticWhatsAppChannelPayload({ payload: 'https://wa.me/15551234567' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticWhatsAppChannelPayload({ payload: 'https://api.whatsapp.com/send?phone=15551234567' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticWhatsAppChannelPayload({ payload: 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOp' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticWhatsAppChannelPayload({ payload: 'https://web.whatsapp.com/' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticWhatsAppChannelPayload({ payload: CHANNEL + '?utm_source=x' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticWhatsAppChannelPayload({ payload: CHANNEL + '#update' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticWhatsAppChannelPayload({ payload: '' });
  }, /Refusing to encode/);
});

test('a successful payload is the normalized HTTPS follow URL and nothing else', function () {
  const built = api.buildWhatsAppChannelPayload(
    'http://www.whatsapp.com/channel/' + CODE + '?utm_source=card&fbclid=abc&gclid=xyz#top'
  );
  assert.equal(built.payload, CHANNEL);
  assert.equal(built.payload.startsWith('https://whatsapp.com/channel/'), true);
  assert.equal(built.payload.includes('qrstatic.app'), false);
  assert.equal(built.payload.includes('wa.me'), false);
  assert.equal(/utm_|fbclid|gclid|#|\?/.test(built.payload), false);
  api.assertStaticWhatsAppChannelPayload(built);
});

test('page, sitemap, and already-live pages meet the WhatsApp Channel contract', function () {
  const page = fs.readFileSync(path.join(root, 'whatsapp-channel-qr-code-generator.html'), 'utf8');
  const pageJs = fs.readFileSync(path.join(root, 'js/whatsapp-channel-page.js'), 'utf8');
  const payloadJs = fs.readFileSync(path.join(root, 'js/whatsapp-channel-payload.js'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ads = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8');
  const clickPage = fs.readFileSync(path.join(root, 'whatsapp-qr-code-generator.html'), 'utf8');
  const youtubePage = fs.readFileSync(path.join(root, 'youtube-channel-qr-code-generator.html'), 'utf8');
  const linkedinPage = fs.readFileSync(path.join(root, 'linkedin-qr-code-generator.html'), 'utf8');
  const guide = fs.readFileSync(path.join(root, 'guides/whatsapp-click-to-chat-qr-code.html'), 'utf8');

  assert.match(page, /<title>Free WhatsApp Channel QR Code Generator \| QRStatic<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]{40,}">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/qrstatic\.app\/whatsapp-channel-qr-code-generator\.html">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/qrstatic\.app\/whatsapp-channel-qr-code-generator\.html">/);
  assert.match(page, /id="download-png"/);
  assert.match(page, /id="download-svg"/);
  assert.match(page, /Download PNG/);
  assert.match(page, /Download SVG/);
  assert.match(page, /ca-pub-8737820277849030/);
  assert.match(page, /G-JV95W19XS3/);
  assert.match(page, /vendor\/qrcode\.min\.js/);
  assert.match(page, /js\/qr-core\.js/);
  assert.match(page, /js\/share\.js/);
  assert.match(page, /href="whatsapp-qr-code-generator\.html"/);
  assert.match(page, /href="\/guides\/whatsapp-click-to-chat-qr-code\.html"/);
  assert.match(page, /href="youtube-channel-qr-code-generator\.html"/);
  assert.match(page, /href="telegram-qr-code-generator\.html"/);
  assert.match(page, /https:\/\/qrstatic\.app\/whatsapp-qr-code-generator\.html/);
  assert.match(page, /quiet zone/i);
  assert.match(page, /dark modules on a light background/i);
  assert.match(page, /do not overlay the official WhatsApp logo in the center of the code/i);
  assert.match(page, /Share \/ Show QR/);
  assert.match(page, /static URL/i);
  assert.match(page, /Channel-only/);
  assert.match(page, /group invites/i);
  assert.match(page, /click-to-chat/i);
  assert.match(page, /Do not use this page to scan a WhatsApp Web login code/);
  assert.match(page, /If an admin changes or disables the public follow link/);
  assert.match(page, /already-printed static codes break/);
  assert.match(page, /current public link/);
  assert.match(page, /This site is not official WhatsApp/);
  assert.match(page, /Community is out of scope/);
  assert.match(page, /No signup/);
  assert.match(page, /no watermark/i);
  assert.match(page, /no trial expiry/i);
  assert.match(page, /in your browser/i);
  assert.doesNotMatch(page, /more followers|gain followers|follower count|search ranking|rank on|passive income|make money|earn money|guaranteed|\bSEO\b|monetiz|more clients|more leads/i);
  assert.doesNotMatch(page, /apple-music-qr-code-generator|林启|Lin Qi|ko-fi|buymeacoffee|github\.com\/sponsors/i);
  assert.doesNotMatch(pageJs, /userAgent|navigator\.platform|fetch\s*\(/);
  assert.doesNotMatch(payloadJs, /userAgent|fetch\s*\(/);
  assert.match(pageJs, /QRCode\.toCanvas\(canvas, built\.payload/);
  assert.match(payloadJs, /No user-agent routing/);
  assert.equal(fs.existsSync(path.join(root, 'apple-music-qr-code-generator.html')), false);

  assert.doesNotMatch(index, /whatsapp-channel-qr-code-generator/);
  assert.doesNotMatch(clickPage, /whatsapp-channel-qr-code-generator/);
  assert.doesNotMatch(youtubePage, /whatsapp-channel-qr-code-generator/);
  assert.doesNotMatch(linkedinPage, /whatsapp-channel-qr-code-generator/);
  assert.doesNotMatch(guide, /whatsapp-channel-qr-code-generator/);
  assert.match(index, /name="toolfound-verify" content="490c0cfeeb94b3d65d893e18dcff92dca9ab1b123e18a330"/);
  assert.match(index, /name="google-adsense-account" content="ca-pub-8737820277849030"/);
  assert.equal(ads, 'google.com, pub-8737820277849030, DIRECT, f08c47fec0942fa0\n');

  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(function (m) { return m[1]; });
  assert.equal(locs.length, 48);
  assert.equal(locs[locs.length - 1], 'https://qrstatic.app/whatsapp-channel-qr-code-generator.html');
  assert.equal(
    (sitemap.match(/<loc>https:\/\/qrstatic\.app\/whatsapp-channel-qr-code-generator\.html<\/loc>/g) || []).length,
    1
  );
  assert.match(
    sitemap,
    /<loc>https:\/\/qrstatic\.app\/guides\/google-maps-location-qr-code-store\.html<\/loc><lastmod>2026-11-12<\/lastmod><changefreq>monthly<\/changefreq><priority>0\.8<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/whatsapp-channel-qr-code-generator\.html<\/loc><lastmod>2026-11-22<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n<\/urlset>/
  );
});

test('sitemap appends only the channel page and keeps every older entry', function () {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const blocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(function (m) { return m[1]; });
  const added = blocks.filter(function (block) { return block.includes('whatsapp-channel-qr-code-generator.html'); });
  assert.equal(added.length, 1);
  assert.match(added[0], /<loc>https:\/\/qrstatic\.app\/whatsapp-channel-qr-code-generator\.html<\/loc>/);
  assert.match(added[0], /<lastmod>2026-11-22<\/lastmod>/);
  assert.match(added[0], /<changefreq>weekly<\/changefreq>/);
  assert.match(added[0], /<priority>0\.9<\/priority>/);
  const rest = blocks.filter(function (block) { return !block.includes('whatsapp-channel-qr-code-generator.html'); });
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
    'https://qrstatic.app/linkedin-qr-code-generator.html|2026-11-16|weekly|0.9',
    'https://qrstatic.app/youtube-channel-qr-code-generator.html|2026-11-19|weekly|0.9',
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
    'https://qrstatic.app/guides/google-maps-location-qr-code-store.html|2026-11-12|monthly|0.8'
  ];
  assert.deepEqual(rest.map(function (block) {
    const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1];
    const lastmod = (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1];
    const changefreq = (block.match(/<changefreq>([^<]+)<\/changefreq>/) || [])[1];
    const priority = (block.match(/<priority>([^<]+)<\/priority>/) || [])[1];
    return [loc, lastmod, changefreq, priority].join('|');
  }), expected);
});

test('generated SVG is a static image of the follow URL and not a short link', function () {
  const sandbox = loadIIFE('vendor/qrcode.min.js');
  const QRCode = sandbox.QRCode;
  assert.equal(typeof QRCode.toString, 'function');
  const opts = { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 256 };
  const payloads = [
    CHANNEL,
    'https://whatsapp.com/channel/AbCdEf1234567XyZ'
  ].map(function (input) {
    return api.buildWhatsAppChannelPayload(input).payload;
  });
  return Promise.all(payloads.map(function (payload) {
    return QRCode.toString(payload, opts);
  })).then(function (svgs) {
    assert.equal(svgs.length, 2);
    svgs.forEach(function (svg, i) {
      assert.match(svg, /<svg/);
      assert.equal(svg.includes('bit.ly'), false);
      assert.equal(svg.includes('qrstatic.app'), false);
      assert.equal(svg.includes('wa.me'), false);
      assert.equal(svg.includes('userAgent'), false);
      if (i > 0) assert.notEqual(svg, svgs[0]);
    });
  });
});
