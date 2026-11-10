'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { root, loadIIFE } = require('./helpers');


function loadPayload() {
  return loadIIFE('js/app-store-play-payload.js').AppStorePlayPayload;
}

const api = loadPayload();
const APP = 'https://apps.apple.com/us/app/example-app/id310633997';
const PLAY = 'https://play.google.com/store/apps/details?id=com.example.app';

function messages(result) {
  return (result.errors || []).join('\n');
}

test('valid App Store and Play URLs stay on their own codes', function () {
  const result = api.buildStoreQrPayloads(APP, PLAY + '&hl=en&gl=US');
  assert.equal(result.errors.length, 0);
  assert.equal(result.appStore.payload, APP);
  assert.equal(result.appStore.label, 'App Store');
  assert.equal(result.appStore.platform, 'iOS');
  assert.equal(result.play.payload, PLAY);
  assert.equal(result.play.label, 'Google Play');
  assert.equal(result.play.platform, 'Android');
  assert.notEqual(result.appStore.payload, result.play.payload);
  api.assertStaticStorePayload(result.appStore);
  api.assertStaticStorePayload(result.play);
});

test('App Store country path and bare /app/id are both accepted', function () {
  assert.equal(
    api.normalizeAppStoreUrl('https://apps.apple.com/gb/app/id310633997').payload,
    'https://apps.apple.com/gb/app/id310633997'
  );
  assert.equal(
    api.normalizeAppStoreUrl('https://apps.apple.com/app/id123456789').payload,
    'https://apps.apple.com/app/id123456789'
  );
});

test('itunes legacy app page rewrites to https apps.apple.com and keeps the app id', function () {
  const raw = 'http://www.itunes.apple.com/us/app/whatsapp-messenger/id310633997?mt=8&utm_source=newsletter';
  const built = api.normalizeAppStoreUrl(raw);
  assert.equal(built.payload, 'https://apps.apple.com/us/app/whatsapp-messenger/id310633997');
  assert.equal(built.normalized, true);
  assert.equal(built.appId, '310633997');
});

test('market://details?id= rewrites to the HTTPS Play URL and drops referrer', function () {
  const built = api.normalizePlayUrl('market://details?id=com.example.app&referrer=utm_source%3Dgoogle&utm_medium=cpc');
  assert.equal(built.payload, PLAY);
  assert.equal(built.packageName, 'com.example.app');
});

test('tracking params are stripped and the app-id path is kept', function () {
  const app = api.normalizeAppStoreUrl(
    'https://apps.apple.com/US/app/example-app/id310633997?utm_source=x&utm_campaign=spring&fbclid=abc&gclid=xyz&mt=8&platform=iphone#reviews'
  );
  assert.equal(app.payload, 'https://apps.apple.com/us/app/example-app/id310633997?platform=iphone');
  assert.equal(app.payload.includes('fbclid'), false);
  assert.equal(app.payload.includes('gclid'), false);
  assert.equal(app.payload.includes('utm_'), false);

  const play = api.normalizePlayUrl(
    'http://www.play.google.com/store/apps/details?id=com.example.app&referrer=utm_source%3Dgoogle&utm_medium=cpc&hl=en&gl=US'
  );
  assert.equal(play.payload, PLAY);
  assert.equal(play.payload.includes('referrer'), false);
  assert.equal(play.payload.includes('utm_'), false);
  assert.equal(play.payload.includes('hl='), false);
});

test('a Play URL in the App Store field is rejected and not moved', function () {
  const result = api.buildStoreQrPayloads(PLAY, '');
  assert.equal(result.appStore, null);
  assert.equal(result.play, null);
  assert.match(messages(result), /Google Play field/);
  assert.match(messages(result), /not encoded/i);
  assert.equal(messages(result).includes(PLAY), false);
});

test('an App Store URL in the Play field is rejected and not moved', function () {
  const result = api.buildStoreQrPayloads('', 'https://itunes.apple.com/us/app/example-app/id310633997?mt=8');
  assert.equal(result.appStore, null);
  assert.equal(result.play, null);
  assert.match(messages(result), /App Store field/);
  assert.match(messages(result), /not encoded/i);
  assert.equal(result.play, null);
});

test('pasting Play into the App Store field does not fill the Play code even if Play is also empty', function () {
  const result = api.buildStoreQrPayloads(
    'https://play.google.com/store/search?q=maps&c=apps',
    '   '
  );
  assert.equal(result.appStore, null);
  assert.equal(result.play, null);
  assert.match(messages(result), /Google Play field/);
});

test('a valid store is still returned when the other field is rejected', function () {
  const result = api.buildStoreQrPayloads(APP, 'https://bit.ly/not-a-store');
  assert.equal(result.appStore.payload, APP);
  assert.equal(result.play, null);
  assert.match(messages(result), /not encoded/i);
});

test('both fields empty is a clear error and encodes nothing', function () {
  ['', '   ', null].forEach(function (value) {
    const result = api.buildStoreQrPayloads(value, value);
    assert.equal(result.appStore, null);
    assert.equal(result.play, null);
    assert.match(messages(result), /Enter an App Store URL, a Google Play URL, or both/);
    assert.match(messages(result), /not a device-routed smart short link/);
    assert.match(messages(result), /Nothing was encoded/);
  });
});

test('only one filled field generates only that code', function () {
  const appOnly = api.buildStoreQrPayloads(APP, '');
  assert.equal(appOnly.appStore.payload, APP);
  assert.equal(appOnly.play, null);
  assert.equal(appOnly.errors.length, 0);

  const playOnly = api.buildStoreQrPayloads('', PLAY);
  assert.equal(playOnly.appStore, null);
  assert.equal(playOnly.play.payload, PLAY);
  assert.equal(playOnly.errors.length, 0);
});

test('missing app id and missing Play package are rejected', function () {
  const missingApp = api.buildStoreQrPayloads('https://apps.apple.com/us/app/example-app', '');
  assert.equal(missingApp.appStore, null);
  assert.match(messages(missingApp), /no app id/i);
  assert.match(messages(missingApp), /not encoded/i);

  const missingPlay = api.buildStoreQrPayloads('', 'https://play.google.com/store/apps/details?hl=en');
  assert.equal(missingPlay.play, null);
  assert.match(messages(missingPlay), /no package id/i);
  assert.match(messages(missingPlay), /not encoded/i);

  assert.throws(function () {
    api.normalizePlayUrl('https://play.google.com/store/apps/details?id=');
  }, /no package id/i);
  assert.throws(function () {
    api.normalizePlayUrl('https://play.google.com/store/apps/details?id=not-a-package');
  }, /package name looks invalid/i);
});

test('third-party smart short links are rejected on either field', function () {
  const samples = [
    'https://bit.ly/3abcDEF',
    'https://tinyurl.com/appx',
    'https://onelink.me/abc123',
    'https://example.onelink.me/W4iG/store',
    'https://appsto.re/us/example',
    'https://spotify.app.link/xyz',
    'http://t.co/abc123'
  ];
  samples.forEach(function (url) {
    const onApp = api.buildStoreQrPayloads(url, '');
    const onPlay = api.buildStoreQrPayloads('', url);
    assert.equal(onApp.appStore, null, url);
    assert.equal(onPlay.play, null, url);
    assert.match(messages(onApp), /short link|redirect/i, url);
    assert.match(messages(onPlay), /short link|redirect/i, url);
    assert.match(messages(onApp), /not encoded/i, url);
  });
});

test('APK and sideload links are rejected and never encoded', function () {
  const samples = [
    'https://apkpure.com/example/com.example.app',
    'https://www.apkmirror.com/apk/example/example-app/',
    'https://f-droid.org/packages/org.fdroid.fdroid/',
    'https://example.com/downloads/example.apk',
    'http://cdn.example.net/releases/app.APK',
    'https://example.com/files/app-release.xapk',
    'https://example.com/sideload/app.ipa'
  ];
  samples.forEach(function (url) {
    const result = api.buildStoreQrPayloads(url, url);
    assert.equal(result.appStore, null, url);
    assert.equal(result.play, null, url);
    assert.match(messages(result), /sideload|APK/i, url);
    assert.match(messages(result), /not encoded/i, url);
    assert.equal(JSON.stringify(result).includes(url), false);
  });
});

test('search, category, developer, and marketing pages are rejected', function () {
  const appPages = [
    ['https://apps.apple.com/us/search?term=maps', /search, category, or marketing/i],
    ['https://apps.apple.com/us/genre/ios-social-networking/id6005', /search, category, or marketing/i],
    ['https://apps.apple.com/us/developer/example-inc/id310634000', /developer page/i],
    ['https://apps.apple.com/us/iphone/today', /search, category, or marketing/i],
    ['https://www.apple.com/app-store/', /not a public App Store app page/i]
  ];
  appPages.forEach(function (pair) {
    assert.throws(function () { api.normalizeAppStoreUrl(pair[0]); }, pair[1]);
  });

  const playPages = [
    ['https://play.google.com/store/search?q=maps&c=apps', /search, category, or marketing/i],
    ['https://play.google.com/store/apps/category/GAME', /search, category, or marketing/i],
    ['https://play.google.com/store/apps/developer?id=Example+LLC', /developer page/i],
    ['https://play.google.com/store/apps/dev?id=5700313618786177705', /developer page/i],
    ['https://play.google.com/store/apps', /search, category, or marketing/i]
  ];
  playPages.forEach(function (pair) {
    assert.throws(function () { api.normalizePlayUrl(pair[0]); }, pair[1]);
  });
});

test('non-store hosts and embedded store URLs are not unwrapped', function () {
  const evil = 'https://evil.example/store/apps/details?id=com.example.app';
  const result = api.buildStoreQrPayloads(
    'https://apps.apple.com.evil.com/app/id310633997',
    evil
  );
  assert.equal(result.appStore, null);
  assert.equal(result.play, null);
  assert.match(messages(result), /not encoded/i);
  assert.equal(JSON.stringify(result).includes('com.example.app'), false);

  assert.throws(function () {
    api.normalizeAppStoreUrl('https://user:pass@apps.apple.com/app/id310633997');
  }, /username or password/);
  assert.throws(function () {
    api.normalizePlayUrl('market://launch?id=com.example.app');
  }, /not an app details page/);
  assert.throws(function () {
    api.normalizeAppStoreUrl('javascript:alert(1)');
  }, /not encoded/i);
});

test('a Play referrer that points at an APK is dropped, not encoded', function () {
  const built = api.normalizePlayUrl(
    'https://play.google.com/store/apps/details?id=com.example.app&referrer=' +
      encodeURIComponent('https://evil.example/app.apk')
  );
  assert.equal(built.payload, PLAY);
  assert.equal(built.payload.includes('apk'), false);
});

test('payload guard refuses anything that is not the official HTTPS store URL', function () {
  assert.throws(function () {
    api.assertStaticStorePayload({ store: 'appstore', payload: 'https://bit.ly/abc' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticStorePayload({ store: 'play', payload: 'https://play.google.com/store/search?q=maps' });
  }, /Refusing to encode/);
});

test('page, sitemap, homepage, and guides meet the static-store contract', function () {
  const page = fs.readFileSync(path.join(root, 'app-store-google-play-qr-code-generator.html'), 'utf8');
  const pageJs = fs.readFileSync(path.join(root, 'js/app-store-play-page.js'), 'utf8');
  const payloadJs = fs.readFileSync(path.join(root, 'js/app-store-play-payload.js'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const why = fs.readFileSync(path.join(root, 'guides/why-did-my-qr-code-stop-working.html'), 'utf8');
  const versus = fs.readFileSync(path.join(root, 'guides/static-vs-dynamic-qr.html'), 'utf8');

  assert.match(page, /<title>Free App Store and Google Play QR Code Generator \| QRStatic<\/title>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/qrstatic\.app\/app-store-google-play-qr-code-generator\.html">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/qrstatic\.app\/app-store-google-play-qr-code-generator\.html">/);
  assert.match(page, /two side-by-side static QR codes/i);
  assert.match(page, /not<\/strong> a device-routed smart short link|not a device-routed smart short link/i);
  assert.match(page, /do not expire on our side/i);
  assert.match(page, /delisted/i);
  assert.match(page, /do not host/i);
  assert.match(page, /do not set an expiry/i);
  assert.match(page, /not official Apple or Google/i);
  assert.match(page, /right to share/i);
  assert.match(page, /piracy or sideloading/i);
  assert.match(page, /not uploaded to our server/i);
  assert.match(page, /works offline/i);
  assert.match(page, /no watermark/i);
  assert.match(page, /no trial expiry/i);
  assert.match(page, /href="google-form-qr-code-generator\.html"/);
  assert.match(page, /href="spotify-qr-code-generator\.html"/);
  assert.match(page, /href="guides\/why-did-my-qr-code-stop-working\.html"/);
  assert.match(page, /href="guides\/static-vs-dynamic-qr\.html"/);
  assert.match(page, /id="png-appstore"/);
  assert.match(page, /id="svg-appstore"/);
  assert.match(page, /id="png-play"/);
  assert.match(page, /id="svg-play"/);
  assert.match(page, /id="download-poster"/);
  assert.match(page, /ca-pub-8737820277849030/);
  assert.doesNotMatch(pageJs, /userAgent|navigator\.platform|fetch\s*\(/);
  assert.doesNotMatch(payloadJs, /userAgent|fetch\s*\(/);
  assert.match(payloadJs, /No user-agent routing/);

  assert.match(sitemap, /<loc>https:\/\/qrstatic\.app\/app-store-google-play-qr-code-generator\.html<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  assert.match(index, /href="app-store-google-play-qr-code-generator\.html"/);
  assert.match(index, /name="toolfound-verify" content="490c0cfeeb94b3d65d893e18dcff92dca9ab1b123e18a330"/);
  assert.match(why, /href="\.\.\/app-store-google-play-qr-code-generator\.html"/);
  assert.match(versus, /href="\.\.\/app-store-google-play-qr-code-generator\.html"/);
});

test('Google Form payload still accepts a responder link and rejects an edit link', function () {
  const sandbox = loadIIFE('js/google-form-payload.js');
  const form = sandbox.GoogleFormPayload.buildGoogleFormPayload(
    'http://docs.google.com/forms/d/e/1FAIpQLSdExampleFormId0001/viewform?usp=sf_link'
  );
  assert.equal(
    form.payload,
    'https://docs.google.com/forms/d/e/1FAIpQLSdExampleFormId0001/viewform?usp=sf_link'
  );
  assert.throws(function () {
    sandbox.GoogleFormPayload.buildGoogleFormPayload('https://docs.google.com/forms/d/e/1FAIpQLSdExampleFormId0001/edit');
  }, /edit/i);
});

test('generated SVG payloads differ and contain no short-link host', function () {
  const sandbox = loadIIFE('vendor/qrcode.min.js');
  const QRCode = sandbox.QRCode;
  assert.equal(typeof QRCode.toString, 'function');

  const app = api.normalizeAppStoreUrl(APP);
  const play = api.normalizePlayUrl(PLAY);
  const opts = { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 256 };

  return Promise.all([
    QRCode.toString(app.payload, opts),
    QRCode.toString(play.payload, opts)
  ]).then(function (svgs) {
    assert.match(svgs[0], /<svg/);
    assert.match(svgs[1], /<svg/);
    assert.notEqual(svgs[0], svgs[1]);
    svgs.forEach(function (svg) {
      assert.equal(svg.includes('bit.ly'), false);
      assert.equal(svg.includes('onelink'), false);
      assert.equal(svg.includes('userAgent'), false);
    });
  });
});
