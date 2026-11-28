'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { root, loadIIFE } = require('./helpers');

function loadPayload() {
  return loadIIFE('js/youtube-payload.js').YouTubePayload;
}

const api = loadPayload();
const HANDLE = 'https://youtube.com/@examplechannel';
const CHANNEL_ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
const CHANNEL = 'https://youtube.com/channel/' + CHANNEL_ID;
const CUSTOM = 'https://youtube.com/c/ExampleName';
const USER = 'https://youtube.com/user/ExampleUser';
const VIDEO = 'dQw4w9WgXcQ';
const WATCH = 'https://youtube.com/watch?v=' + VIDEO;
const SHORT = 'https://youtu.be/' + VIDEO;
const SHORTS = 'https://youtube.com/shorts/' + VIDEO;

function rejected(input, pattern) {
  assert.throws(function () { api.buildYouTubePayload(input); }, pattern || /not encoded|Nothing was encoded/i);
}

test('public channel URLs are accepted', function () {
  const handle = api.buildYouTubePayload(HANDLE);
  assert.equal(handle.payload, HANDLE);
  assert.equal(handle.url, HANDLE);
  assert.equal(handle.type, 'channel-handle');
  assert.equal(handle.host, 'youtube.com');
  assert.equal(handle.normalized, false);
  assert.match(handle.warning, /not an official YouTube product/i);
  assert.match(handle.warning, /does not make a private video public/i);
  assert.match(handle.warning, /copyright/i);

  const channel = api.buildYouTubePayload(CHANNEL);
  assert.equal(channel.payload, CHANNEL);
  assert.equal(channel.type, 'channel-id');

  const custom = api.buildYouTubePayload(CUSTOM);
  assert.equal(custom.payload, CUSTOM);
  assert.equal(custom.type, 'channel-custom');

  const user = api.buildYouTubePayload(USER);
  assert.equal(user.payload, USER);
  assert.equal(user.type, 'channel-user');

  api.assertStaticYouTubePayload(handle);
  api.assertStaticYouTubePayload(channel);
  api.assertStaticYouTubePayload(custom);
  api.assertStaticYouTubePayload(user);
});

test('public watch, youtu.be, and Shorts URLs are accepted', function () {
  const watch = api.buildYouTubePayload(WATCH);
  assert.equal(watch.payload, WATCH);
  assert.equal(watch.type, 'video');
  assert.equal(watch.host, 'youtube.com');

  const short = api.buildYouTubePayload(SHORT);
  assert.equal(short.payload, SHORT);
  assert.equal(short.type, 'youtu.be');
  assert.equal(short.host, 'youtu.be');

  const shorts = api.buildYouTubePayload(SHORTS);
  assert.equal(shorts.payload, SHORTS);
  assert.equal(shorts.type, 'shorts');

  api.assertStaticYouTubePayload(watch);
  api.assertStaticYouTubePayload(short);
  api.assertStaticYouTubePayload(shorts);
});

test('https may be omitted, and http, www, m., hash, and a trailing slash are normalized', function () {
  assert.equal(api.buildYouTubePayload('youtube.com/@examplechannel').payload, HANDLE);
  assert.equal(api.buildYouTubePayload('http://www.youtube.com/@examplechannel/').payload, HANDLE);
  assert.equal(api.buildYouTubePayload('https://www.youtube.com/@examplechannel#community').payload, HANDLE);
  assert.equal(api.buildYouTubePayload('//www.youtube.com/@examplechannel').payload, HANDLE);
  assert.equal(api.buildYouTubePayload('HTTP://WWW.YOUTUBE.COM/@ExampleChannel').payload, 'https://youtube.com/@ExampleChannel');
  assert.equal(api.buildYouTubePayload('https://m.youtube.com/@examplechannel').payload, HANDLE);
  assert.equal(api.buildYouTubePayload('https://www.youtube.com/CHANNEL/' + CHANNEL_ID + '/').payload, CHANNEL);
  const bare = api.buildYouTubePayload('www.youtube.com/c/ExampleName/');
  assert.equal(bare.payload, CUSTOM);
  assert.equal(bare.normalized, true);
  const user = api.buildYouTubePayload('youtube.com/user/ExampleUser');
  assert.equal(user.payload, USER);
  const quoted = api.buildYouTubePayload('  "https://youtube.com/@examplechannel"  ');
  assert.equal(quoted.payload, HANDLE);
  const zw = api.buildYouTubePayload('https://youtube.com/@\u200Bexamplechannel');
  assert.equal(zw.payload, HANDLE);
  assert.equal(api.buildYouTubePayload('http://www.youtu.be/' + VIDEO + '/').payload, SHORT);
  assert.equal(api.buildYouTubePayload('HTTP://M.YOUTUBE.COM/shorts/' + VIDEO).payload, SHORTS);
});

test('si, feature, pp, utm, fbclid, gclid, and ab_channel are stripped; the hash is dropped', function () {
  const tracked = api.buildYouTubePayload(
    'http://www.youtube.com/@examplechannel/?si=abc&feature=share&pp=ygUR&utm_source=share&utm_medium=android&utm_campaign=share_via&fbclid=f&gclid=g&ab_channel=Example#about'
  );
  assert.equal(tracked.payload, HANDLE);
  assert.equal(tracked.payload.includes('si='), false);
  assert.equal(tracked.payload.includes('feature'), false);
  assert.equal(tracked.payload.includes('pp='), false);
  assert.equal(tracked.payload.includes('utm_'), false);
  assert.equal(tracked.payload.includes('fbclid'), false);
  assert.equal(tracked.payload.includes('gclid'), false);
  assert.equal(tracked.payload.includes('ab_channel'), false);
  assert.equal(tracked.payload.includes('#'), false);
  assert.equal(tracked.payload.includes('?'), false);
  assert.equal(tracked.normalized, true);

  const watch = api.buildYouTubePayload(
    'https://www.youtube.com/watch?v=' + VIDEO + '&feature=share&si=abc&pp=xyz&utm_source=share&fbclid=f&gclid=g&ab_channel=Rick&hl=en'
  );
  assert.equal(watch.payload, WATCH);

  const timed = api.buildYouTubePayload('https://youtu.be/' + VIDEO + '?si=abc&feature=share&t=1m2s');
  assert.equal(timed.payload, SHORT + '?t=1m2s');
  assert.equal(timed.type, 'youtu.be');

  const tab = api.buildYouTubePayload('https://www.youtube.com/@examplechannel/videos?si=abc');
  assert.equal(tab.payload, 'https://youtube.com/@examplechannel/videos');
  assert.equal(tab.type, 'channel-handle');

  const about = api.buildYouTubePayload('https://www.youtube.com/channel/' + CHANNEL_ID + '/about/');
  assert.equal(about.payload, CHANNEL + '/about');
  assert.equal(about.type, 'channel-id');
});

test('a watch URL that also has list= encodes the video only', function () {
  const both = api.buildYouTubePayload(
    'https://www.youtube.com/watch?v=' + VIDEO + '&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9ef3&index=2&start_radio=1'
  );
  assert.equal(both.payload, WATCH);
  assert.equal(both.payload.includes('list='), false);
  assert.equal(both.payload.includes('index='), false);

  const shortList = api.buildYouTubePayload('https://youtu.be/' + VIDEO + '?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9ef3');
  assert.equal(shortList.payload, SHORT);

  const shortsList = api.buildYouTubePayload('https://www.youtube.com/shorts/' + VIDEO + '?list=PLxxxxxxxxxxxxxxxx&si=abc');
  assert.equal(shortsList.payload, SHORTS);
});

test('empty input is a clear error and encodes nothing', function () {
  ['', '   ', '""', "''", null, undefined].forEach(function (value) {
    rejected(value, /Nothing was encoded/);
  });
});

test('YouTube Music, Studio, Kids, and other YouTube hosts are rejected', function () {
  [
    'https://music.youtube.com/watch?v=' + VIDEO,
    'https://music.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx',
    'https://music.youtube.com/channel/' + CHANNEL_ID,
    'https://www.music.youtube.com/@examplechannel',
    'music.youtube.com/watch?v=' + VIDEO
  ].forEach(function (url) {
    rejected(url, /YouTube Music/i);
    rejected(url, /login or redemption/i);
    rejected(url, /not encoded/i);
  });

  [
    'https://studio.youtube.com/',
    'https://studio.youtube.com/channel/' + CHANNEL_ID,
    'https://studio.youtube.com/video/' + VIDEO + '/edit'
  ].forEach(function (url) {
    rejected(url, /YouTube Studio/i);
    rejected(url, /not encoded/i);
  });

  rejected('https://kids.youtube.com/watch?v=' + VIDEO, /YouTube Kids/i);
  rejected('https://tv.youtube.com/', /TV or device pairing/i);
  rejected('https://consent.youtube.com/m?continue=https://www.youtube.com/', /login or account/i);
  rejected('https://creatoracademy.youtube.com/', /not a public channel or video host/i);
  rejected('https://www.youtube.com/music', /YouTube Music/i);
});

test('login, account walls, and signed-in library pages are rejected', function () {
  [
    'https://www.youtube.com/signin',
    'https://www.youtube.com/login',
    'https://www.youtube.com/account',
    'https://www.youtube.com/account_privacy',
    'https://accounts.google.com/ServiceLogin?service=youtube',
    'https://myaccount.google.com/'
  ].forEach(function (url) {
    rejected(url, /login or account/i);
    rejected(url, /does not bypass a login wall/i);
  });

  [
    'https://www.youtube.com/feed/library',
    'https://www.youtube.com/feed/history',
    'https://www.youtube.com/feed/subscriptions',
    'https://www.youtube.com/history'
  ].forEach(function (url) {
    rejected(url, /requires a signed-in account/i);
    rejected(url, /does not bypass a login wall/i);
  });

  rejected('https://youtube.com/@examplechannel?session_token=abc', /login or session parameter/i);
});

test('TV pairing codes and 2FA or authenticator flows are rejected', function () {
  [
    'https://www.youtube.com/activate',
    'https://www.youtube.com/activate?user_code=ABCD-EFGH',
    'https://www.youtube.com/pair',
    'https://www.youtube.com/tv',
    'ABCD-EFGH'
  ].forEach(function (url) {
    rejected(url, /TV or device pairing/i);
    rejected(url, /Pairing codes are not encoded/i);
  });

  [
    'otpauth://totp/YouTube:name?secret=JBSWY3DPEHPK3PXP',
    'https://www.youtube.com/verify',
    'https://www.youtube.com/2fa',
    'https://www.youtube.com/authenticator'
  ].forEach(function (url) {
    rejected(url, /2FA or authenticator/i);
    rejected(url, /not encoded/i);
  });
});

test('non-YouTube domains, shorteners, and qrstatic.app links are rejected', function () {
  [
    'https://example.com/@examplechannel',
    'https://example.com/watch?v=' + VIDEO,
    'https://vimeo.com/123456789',
    'https://youtube.com.evil.example/@examplechannel',
    'https://notyoutube.com/watch?v=' + VIDEO,
    'https://youtu.be.evil.com/' + VIDEO,
    'https://www.youtube-nocookie.com/embed/' + VIDEO
  ].forEach(function (url) {
    rejected(url, /not a public youtube\.com or youtu\.be/i);
  });

  [
    'https://bit.ly/' + VIDEO,
    'https://tinyurl.com/example',
    'https://t.co/abc123',
    'www.bit.ly/example'
  ].forEach(function (url) {
    rejected(url, /short link/i);
    rejected(url, /Shorteners are not followed/i);
  });

  [
    'https://qrstatic.app/abc',
    'https://www.qrstatic.app/r/youtube',
    'https://preview.qrstatic.app/go/abc',
    'http://qrstatic.app/youtube-channel-qr-code-generator.html'
  ].forEach(function (url) {
    rejected(url, /qrstatic\.app/i);
    rejected(url, /does not put qrstatic\.app inside the QR/i);
  });
});

test('playlists with list= and no video id are rejected and explained', function () {
  [
    'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9ef3',
    'https://www.youtube.com/watch?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9ef3',
    'https://www.youtube.com/watch?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9ef3&index=2',
    'https://youtube.com/@examplechannel?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9ef3',
    'https://www.youtube.com/@examplechannel/playlists',
    'https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx&v=' + VIDEO
  ].forEach(function (url) {
    rejected(url, /does not encode playlists/i);
    rejected(url, /not encoded/i);
  });
});

test('redirects, embeds, invalid ids, and unknown parameters are rejected', function () {
  rejected('https://www.youtube.com/redirect?q=https://evil.example', /redirect/i);
  rejected('https://www.youtube.com/attribution_link?a=abc&u=%2Fwatch%3Fv%3D' + VIDEO, /redirect/i);
  rejected('https://www.youtube.com/embed/' + VIDEO, /not a public channel or a single watch/i);
  rejected('https://www.youtube.com/live/' + VIDEO, /not a public channel or a single watch/i);
  rejected('https://www.youtube.com/watch?v=short', /video id looks invalid/i);
  rejected('https://youtu.be/short', /video id looks invalid/i);
  rejected('https://youtube.com/@ab', /@handle looks invalid/i);
  rejected('https://youtube.com/channel/UCtooshort', /channel id looks invalid/i);
  rejected('https://youtube.com/channel/', /missing the public channel name/i);
  rejected('https://youtube.com/@examplechannel?app=desktop', /will not encode/i);
  rejected('https://youtube.com/watch?v=' + VIDEO + '&t=hello', /time parameter/i);
  rejected('https://youtube.com/@examplechannel/join', /membership/i);
  rejected('https://user:pass@youtube.com/@examplechannel', /username or password/i);
  rejected('https://youtube.com:8443/@examplechannel', /unexpected port/i);
  rejected('javascript:alert(1)', /not encoded/i);
  rejected('https://youtube.com/@example channel', /space/i);
  rejected('https://youtube.com/shorts/' + VIDEO + '/extra', /not a public channel or a single watch/i);
});

test('other in-site tool links are rejected instead of encoded', function () {
  rejected('https://meet.google.com/abc-defg-hij', /Google Meet/i);
  rejected('https://calendly.com/example-user/30min', /another tool/i);
  rejected('https://linkedin.com/in/jane-doe', /another tool/i);
  rejected('https://t.me/example', /another tool/i);
  rejected('https://discord.gg/abcDEF12', /another tool/i);
  rejected('mailto:ada@example.com', /another tool/i);
  rejected('BEGIN:VCARD\r\nFN:Ada\r\nEND:VCARD', /another tool/i);
  rejected('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Demo\r\nEND:VEVENT\r\nEND:VCALENDAR', /calendar event/i);
});

test('payload guard refuses short links, music, playlists, login URLs, and empty payloads', function () {
  assert.throws(function () {
    api.assertStaticYouTubePayload({ payload: 'https://bit.ly/' + VIDEO });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticYouTubePayload({ payload: 'https://qrstatic.app/abc' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticYouTubePayload({ payload: 'https://music.youtube.com/watch?v=' + VIDEO });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticYouTubePayload({ payload: 'https://studio.youtube.com/channel/' + CHANNEL_ID });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticYouTubePayload({ payload: 'https://youtube.com/login' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticYouTubePayload({ payload: 'https://youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticYouTubePayload({ payload: WATCH + '&utm_source=x' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticYouTubePayload({ payload: HANDLE + '#about' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticYouTubePayload({ payload: '' });
  }, /Refusing to encode/);
});

test('a successful payload is the normalized HTTPS URL and nothing else', function () {
  const built = api.buildYouTubePayload(
    'http://www.youtube.com/watch?v=' + VIDEO + '&utm_source=card&fbclid=abc&gclid=xyz&si=qq&feature=share&list=PLxxxxxxxxxxxxxxxx#top'
  );
  assert.equal(built.payload, WATCH);
  assert.equal(built.payload.startsWith('https://youtube.com/'), true);
  assert.equal(built.payload.includes('qrstatic.app'), false);
  assert.equal(built.payload.includes('music.youtube'), false);
  assert.equal(/utm_|fbclid|gclid|si=|feature|#|\blist=/.test(built.payload), false);

  const unicode = api.buildYouTubePayload('https://youtube.com/@日本語チャンネル');
  assert.equal(unicode.payload, 'https://youtube.com/@' + encodeURIComponent('日本語チャンネル'));
  assert.equal(unicode.type, 'channel-handle');
  api.assertStaticYouTubePayload(unicode);
});

test('page, sitemap, and homepage meet the YouTube tool contract', function () {
  const page = fs.readFileSync(path.join(root, 'youtube-channel-qr-code-generator.html'), 'utf8');
  const pageJs = fs.readFileSync(path.join(root, 'js/youtube-page.js'), 'utf8');
  const payloadJs = fs.readFileSync(path.join(root, 'js/youtube-payload.js'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ads = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8');
  const linkedinPage = fs.readFileSync(path.join(root, 'linkedin-qr-code-generator.html'), 'utf8');

  assert.match(page, /<title>Free YouTube Channel QR Code Generator \| QRStatic<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]{40,}">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/qrstatic\.app\/youtube-channel-qr-code-generator\.html">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/qrstatic\.app\/youtube-channel-qr-code-generator\.html">/);
  assert.match(page, /id="download-png"/);
  assert.match(page, /id="download-svg"/);
  assert.match(page, /Download PNG/);
  assert.match(page, /Download SVG/);
  assert.match(page, /ca-pub-8737820277849030/);
  assert.match(page, /G-JV95W19XS3/);
  assert.match(page, /vendor\/qrcode\.min\.js/);
  assert.match(page, /js\/qr-core\.js/);
  assert.match(page, /js\/share\.js/);
  assert.match(page, /href="telegram-qr-code-generator\.html"/);
  assert.match(page, /href="discord-qr-code-generator\.html"/);
  assert.match(page, /href="linkedin-qr-code-generator\.html"/);
  assert.match(page, /quiet zone/i);
  assert.match(page, /dark modules on a light background/i);
  assert.match(page, /do not overlay the official YouTube logo in the center of the code/i);
  assert.match(page, /official mobile Share QR/i);
  assert.match(page, /static URL/i);
  assert.match(page, /desktop/i);
  assert.match(page, /channel code/i);
  assert.match(page, /single-video/i);
  assert.match(page, /handle changes/i);
  assert.match(page, /Reprint/);
  assert.match(page, /Shorts/);
  assert.match(page, /youtu\.be/);
  assert.match(page, /not an official YouTube product/i);
  assert.match(page, /YouTube Music/);
  assert.match(page, /login or redemption/i);
  assert.match(page, /No signup/);
  assert.match(page, /no watermark/i);
  assert.match(page, /no trial expiry/i);
  assert.match(page, /in your browser/i);
  assert.doesNotMatch(page, /search ranking|rank on|passive income|make money|earn money|\bSEO\b|more clients|more leads|subscriber|monetiz|guaranteed views/i);
  assert.doesNotMatch(page, /whatsapp-channel-qr-code-generator|apple-music-qr-code-generator/);
  assert.doesNotMatch(pageJs, /userAgent|navigator\.platform|fetch\s*\(/);
  assert.doesNotMatch(payloadJs, /userAgent|fetch\s*\(/);
  assert.match(pageJs, /QRCode\.toCanvas\(canvas, built\.payload/);
  assert.match(payloadJs, /No user-agent routing/);
  assert.doesNotMatch(linkedinPage, /youtube-channel-qr-code-generator/);

  assert.match(
    sitemap,
    /<loc>https:\/\/qrstatic\.app\/linkedin-qr-code-generator\.html<\/loc><lastmod>2026-11-16<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/youtube-channel-qr-code-generator\.html<\/loc><lastmod>2026-11-19<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/contact\.html<\/loc><lastmod>2026-11-07<\/lastmod>/
  );
  assert.equal(
    (sitemap.match(/<loc>https:\/\/qrstatic\.app\/youtube-channel-qr-code-generator\.html<\/loc>/g) || []).length,
    1
  );

  assert.equal((index.match(/href="youtube-channel-qr-code-generator\.html"/g) || []).length, 1);
  assert.match(index, /name="toolfound-verify" content="490c0cfeeb94b3d65d893e18dcff92dca9ab1b123e18a330"/);
  assert.match(index, /name="google-adsense-account" content="ca-pub-8737820277849030"/);
  assert.equal(ads, 'google.com, pub-8737820277849030, DIRECT, f08c47fec0942fa0\n');
});

test('existing sitemap entries keep their loc, lastmod, changefreq, priority, and order', function () {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const blocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(function (m) { return m[1]; });
  const youtube = blocks.filter(function (block) { return block.includes('youtube-channel-qr-code-generator.html'); });
  assert.equal(youtube.length, 1);
  assert.match(youtube[0], /<loc>https:\/\/qrstatic\.app\/youtube-channel-qr-code-generator\.html<\/loc>/);
  assert.match(youtube[0], /<lastmod>2026-11-19<\/lastmod>/);
  assert.match(youtube[0], /<changefreq>weekly<\/changefreq>/);
  assert.match(youtube[0], /<priority>0\.9<\/priority>/);
  const rest = blocks.filter(function (block) { return !block.includes('youtube-channel-qr-code-generator.html'); });
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
    'https://qrstatic.app/whatsapp-channel-qr-code-generator.html|2026-11-22|weekly|0.9',
    'https://qrstatic.app/apple-music-qr-code-generator.html|2026-11-25|weekly|0.9',
    'https://qrstatic.app/linktree-qr-code-generator.html|2026-11-28|weekly|0.9'
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
  const payloads = [HANDLE, CHANNEL, WATCH, SHORT, SHORTS].map(function (input) {
    return api.buildYouTubePayload(input).payload;
  });
  return Promise.all(payloads.map(function (payload) {
    return QRCode.toString(payload, opts);
  })).then(function (svgs) {
    assert.equal(svgs.length, 5);
    svgs.forEach(function (svg, i) {
      assert.match(svg, /<svg/);
      assert.equal(svg.includes('bit.ly'), false);
      assert.equal(svg.includes('qrstatic.app'), false);
      assert.equal(svg.includes('music.youtube'), false);
      assert.equal(svg.includes('userAgent'), false);
      if (i > 0) assert.notEqual(svg, svgs[0]);
    });
  });
});
