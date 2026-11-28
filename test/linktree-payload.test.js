'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { root, loadIIFE } = require('./helpers');

function loadPayload() {
  return loadIIFE('js/linktree-payload.js').LinktreePayload;
}

const api = loadPayload();
const EE = 'https://linktr.ee/MyName';
const BIZ = 'https://linktr.biz/yourusername';

const LOGIN_PATHS = [
  'login', 'logout', 'register', 'signup', 'signin', 'sign-in', 'sign-up',
  'log-in', 'log-out', 'forgot', 'forgot-password', 'reset-password', 'auth'
];
const ADMIN_PATHS = [
  'admin', 'account', 'settings', 'insights', 'billing', 'upgrade', 'subscribe'
];
const MARKETING_PATHS = [
  'help', 'blog', 'pricing', 'about', 'legal', 'privacy', 'terms', 'explore',
  'discover', 'jobs', 'api', 'shop', 'store', 'cards', 'invite', 'connect'
];

function rejected(input, pattern) {
  assert.throws(function () { api.buildLinktreePayload(input); }, pattern || /not encoded|Nothing was encoded/i);
}

test('public linktr.ee and linktr.biz homepages are accepted and hosts are not swapped', function () {
  const ee = api.buildLinktreePayload(EE);
  assert.equal(ee.payload, EE);
  assert.equal(ee.url, EE);
  assert.equal(ee.type, 'homepage');
  assert.equal(ee.username, 'MyName');
  assert.equal(ee.host, 'linktr.ee');
  assert.equal(ee.normalized, false);
  assert.equal(ee.strippedTracking, false);
  assert.equal(ee.payload.includes('linktr.biz'), false);
  assert.match(ee.warning, /not an official Linktree product/i);
  assert.match(ee.warning, /does not assume an old username redirects/i);
  assert.match(ee.warning, /does not bypass a login wall/i);

  const biz = api.buildLinktreePayload(BIZ);
  assert.equal(biz.payload, BIZ);
  assert.equal(biz.username, 'yourusername');
  assert.equal(biz.host, 'linktr.biz');
  assert.equal(biz.payload.includes('linktr.ee'), false);

  api.assertStaticLinktreePayload(ee);
  api.assertStaticLinktreePayload(biz);
});

test('https may be omitted, and http, www, hash, and a trailing slash are normalized without swapping hosts', function () {
  assert.equal(api.buildLinktreePayload('linktr.ee/MyName').payload, EE);
  assert.equal(api.buildLinktreePayload('linktr.biz/yourusername').payload, BIZ);
  assert.equal(api.buildLinktreePayload('http://www.linktr.ee/MyName/').payload, EE);
  assert.equal(api.buildLinktreePayload('http://www.linktr.biz/yourusername/').payload, BIZ);
  assert.equal(api.buildLinktreePayload('https://www.linktr.ee/MyName#bio').payload, EE);
  assert.equal(api.buildLinktreePayload('https://www.linktr.biz/yourusername#links').payload, BIZ);
  assert.equal(api.buildLinktreePayload('//www.linktr.ee/MyName').payload, EE);
  assert.equal(api.buildLinktreePayload('//www.linktr.biz/yourusername').payload, BIZ);
  assert.equal(api.buildLinktreePayload('HTTP://WWW.LINKTR.EE/MyName').payload, EE);
  assert.equal(api.buildLinktreePayload('HTTPS://WWW.LINKTR.BIZ/yourusername/').payload, BIZ);
  assert.equal(api.buildLinktreePayload('https://linktr.ee/MyName//').payload, EE);

  const bare = api.buildLinktreePayload('www.linktr.ee/MyName/');
  assert.equal(bare.payload, EE);
  assert.equal(bare.host, 'linktr.ee');
  assert.equal(bare.normalized, true);
  assert.equal(bare.payload.includes('linktr.biz'), false);

  const quoted = api.buildLinktreePayload('  "https://linktr.biz/yourusername"  ');
  assert.equal(quoted.payload, BIZ);
  assert.equal(quoted.payload.includes('linktr.ee'), false);

  const zw = api.buildLinktreePayload('https://linktr.ee/\u200BMyName');
  assert.equal(zw.payload, EE);
  assert.equal(zw.username, 'MyName');
});

test('the username path segment keeps the pasted case and is not completed', function () {
  const mixed = api.buildLinktreePayload('https://linktr.ee/AbC_def-1.x');
  assert.equal(mixed.payload, 'https://linktr.ee/AbC_def-1.x');
  assert.equal(mixed.username, 'AbC_def-1.x');
  assert.equal(mixed.payload.includes('abc_def'), false);

  const bizCase = api.buildLinktreePayload('linktr.biz/QRStatic');
  assert.equal(bizCase.payload, 'https://linktr.biz/QRStatic');
  assert.equal(bizCase.username, 'QRStatic');

  const cafe = api.buildLinktreePayload('https://linktr.ee/caf%C3%A9');
  assert.equal(cafe.payload, 'https://linktr.ee/caf%C3%A9');
  assert.equal(cafe.username, 'café');
  api.assertStaticLinktreePayload(cafe);
});

test('utm, fbclid, gclid, and other tracking or affiliate parameters are stripped and none are added', function () {
  const raw = 'http://www.linktr.ee/MyName/?utm_source=ig&utm_medium=social&utm_campaign=spring&fbclid=abc&gclid=xyz&irclickid=partner1#bio';
  const built = api.buildLinktreePayload(raw);
  assert.equal(built.payload, EE);
  assert.equal(built.strippedTracking, true);
  assert.equal(built.normalized, true);
  assert.equal(built.payload.includes('?'), false);
  assert.equal(built.payload.includes('#'), false);
  assert.equal(built.payload.includes('utm_'), false);
  assert.equal(built.payload.includes('fbclid'), false);
  assert.equal(built.payload.includes('gclid'), false);
  assert.equal(built.payload.includes('irclickid'), false);
  assert.equal(built.payload.includes('qrstatic.app'), false);
  api.assertStaticLinktreePayload(built);

  const biz = api.buildLinktreePayload('https://www.linktr.biz/yourusername?utm_source=bio&fbclid=abc&gclid=xyz&affiliate=1&mc_cid=aa');
  assert.equal(biz.payload, BIZ);
  assert.equal(biz.payload.includes('linktr.ee'), false);
  assert.equal(/[?#]/.test(biz.payload), false);

  const clean = api.buildLinktreePayload(EE);
  assert.equal(clean.payload, EE);
  assert.equal(clean.payload.includes('?'), false);
});

test('empty input is a clear error and encodes nothing', function () {
  ['', '   ', '""', "''", null, undefined].forEach(function (value) {
    rejected(value, /Nothing was encoded/);
  });
  rejected('https://linktr.ee', /missing the username/i);
  rejected('https://linktr.ee/', /missing the username/i);
  rejected('https://www.linktr.biz/', /missing the username/i);
});

test('login, register, logout, and forgot-password paths are rejected on both hosts', function () {
  LOGIN_PATHS.forEach(function (segment) {
    rejected('https://linktr.ee/' + segment, /login, register, logout, or forgot-password/i);
    rejected('https://www.linktr.biz/' + segment.toUpperCase() + '/', /login, register, logout, or forgot-password/i);
    rejected('https://linktr.ee/' + segment, /not encoded/i);
    rejected('https://linktr.ee/' + segment + '?utm_source=x', /not encoded/i);
  });
});

test('admin, account, settings, insights, and billing paths are rejected on both hosts', function () {
  ADMIN_PATHS.forEach(function (segment) {
    rejected('https://linktr.ee/' + segment, /Admin, Account, Settings, Insights, Billing/i);
    rejected('http://www.linktr.biz/' + segment, /not encoded/i);
  });
});

test('help and marketing paths are rejected on both hosts', function () {
  MARKETING_PATHS.forEach(function (segment) {
    rejected('https://linktr.ee/' + segment, /help or marketing/i);
    rejected('https://linktr.biz/' + segment + '/', /help or marketing/i);
    rejected('https://www.linktr.ee/help/articles/5434152-create-qr-code', /help or marketing/i);
    rejected('https://linktr.biz/help/en/articles/5434152-create-qr-code', /not encoded/i);
  });
});

test('linktree.com, non-homepage hosts, custom domains, short links, and unknown unique URLs are rejected', function () {
  [
    'https://linktree.com/',
    'https://www.linktree.com/',
    'https://linktree.com/MyName',
    'https://www.linktree.com/MyName',
    'http://linktree.com/login'
  ].forEach(function (url) {
    rejected(url, /linktree\.com/i);
    rejected(url, /not encoded/i);
  });

  [
    'https://cards.linktr.ee/MyName',
    'https://ciam.linktr.ee/login',
    'https://ugc.production.linktr.ee/asset',
    'https://m.linktr.biz/MyName',
    'https://www.cards.linktr.ee/MyName'
  ].forEach(function (url) {
    rejected(url, /not a public Linktree homepage host/i);
    rejected(url, /cards\.linktr\.ee/i);
  });

  [
    'https://mybrand.example/MyName',
    'https://example.com/linktr.ee/MyName',
    'https://notlinktr.ee/MyName',
    'https://linktr.ee.evil.example/MyName'
  ].forEach(function (url) {
    rejected(url, /custom domains/i);
    rejected(url, /not encoded/i);
  });

  [
    'https://bit.ly/MyName',
    'https://tinyurl.com/MyName',
    'https://tr.ee/AbCdEf',
    'http://t.co/abc',
    'www.bit.ly/MyName'
  ].forEach(function (url) {
    rejected(url, /short link or an unknown unique URL/i);
    rejected(url, /does not follow it/i);
  });

  [
    'https://qrstatic.app/abc',
    'https://www.qrstatic.app/r/linktree',
    'https://preview.qrstatic.app/go/abc'
  ].forEach(function (url) {
    rejected(url, /qrstatic\.app/i);
    rejected(url, /not encoded/i);
  });
});

test('other link-in-bio tools and multi-segment paths are rejected', function () {
  [
    'https://beacons.ai/someone',
    'https://www.beacons.ai/someone',
    'https://later.com/creator',
    'https://linkin.bio/someone',
    'https://bio.link/someone',
    'https://solo.to/someone'
  ].forEach(function (url) {
    rejected(url, /another link-in-bio tool/i);
    rejected(url, /Beacons, Later/i);
  });

  rejected('https://linktr.ee/MyName/shop', /more than one path segment/i);
  rejected('https://linktr.biz/yourusername/links', /more than one path segment/i);
  rejected('https://linktr.ee/MyName/extra/more', /not encoded/i);
  rejected('https://linktr.ee//MyName', /invalid/i);
  rejected('https://linktr.ee/My%2FName', /invalid/i);
  rejected('https://linktr.ee/my name', /space/i);
  rejected('https://user:pass@linktr.ee/MyName', /username or password/i);
  rejected('https://linktr.ee:8443/MyName', /unexpected port/i);
  rejected('javascript:alert(1)', /not encoded/i);
});

test('other in-site tool links are rejected instead of encoded', function () {
  rejected('https://www.linkedin.com/in/jane-doe', /another tool/i);
  rejected('https://wa.me/15551234567', /another tool/i);
  rejected('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', /another tool/i);
  rejected('https://music.apple.com/us/album/1524801260', /another tool/i);
  rejected('https://www.youtube.com/@example', /another tool/i);
  rejected('mailto:ada@example.com', /another tool/i);
  rejected('BEGIN:VCARD\r\nFN:Ada\r\nEND:VCARD', /another tool/i);
  rejected('https://linktr.ee/MyName?redirect=https://evil.example', /redirect/i);
  rejected('https://linktr.ee/MyName?url=https://evil.example', /redirect/i);
  rejected('https://linktr.ee/MyName?token=abc', /login or session parameter/i);
  rejected('https://linktr.ee/MyName?theme=dark', /will not encode/i);
});

test('payload guard refuses short links, reserved paths, query strings, and empty payloads', function () {
  assert.throws(function () {
    api.assertStaticLinktreePayload({ payload: 'https://bit.ly/MyName' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinktreePayload({ payload: 'https://tr.ee/AbCdEf' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinktreePayload({ payload: 'https://qrstatic.app/abc' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinktreePayload({ payload: 'https://linktr.ee/login' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinktreePayload({ payload: 'https://linktree.com/MyName' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinktreePayload({ payload: EE + '?utm_source=x' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinktreePayload({ payload: EE + '#bio' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticLinktreePayload({ payload: '' });
  }, /Refusing to encode/);
});

test('a successful payload is the normalized HTTPS homepage URL and nothing else', function () {
  const built = api.buildLinktreePayload(
    'http://www.linktr.ee/MyName/?utm_source=card&fbclid=abc&gclid=xyz#top'
  );
  assert.equal(built.payload, EE);
  assert.equal(built.payload.startsWith('https://linktr.ee/'), true);
  assert.equal(built.host, 'linktr.ee');
  assert.equal(built.payload.includes('linktr.biz'), false);
  assert.equal(built.payload.includes('qrstatic.app'), false);
  assert.equal(/utm_|fbclid|gclid|#|\?/.test(built.payload), false);

  const other = api.buildLinktreePayload('www.linktr.biz/yourusername');
  assert.equal(other.payload, BIZ);
  assert.equal(other.payload.includes('linktr.ee'), false);

  const payloadJs = fs.readFileSync(path.join(root, 'js/linktree-payload.js'), 'utf8');
  assert.match(payloadJs, /No user-agent routing/);
  assert.doesNotMatch(payloadJs, /fetch\s*\(|XMLHttpRequest|userAgent/);
});

test('page, sitemap, and already-live pages meet the Linktree preview contract', function () {
  const page = fs.readFileSync(path.join(root, 'linktree-qr-code-generator.html'), 'utf8');
  const pageJs = fs.readFileSync(path.join(root, 'js/linktree-page.js'), 'utf8');
  const payloadJs = fs.readFileSync(path.join(root, 'js/linktree-payload.js'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ads = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8');
  const check = fs.readFileSync(path.join(root, 'scripts/check-site.js'), 'utf8');
  const vcardPage = fs.readFileSync(path.join(root, 'vcard-qr-code-generator.html'), 'utf8');
  const linkedinPage = fs.readFileSync(path.join(root, 'linkedin-qr-code-generator.html'), 'utf8');
  const whatsappPage = fs.readFileSync(path.join(root, 'whatsapp-qr-code-generator.html'), 'utf8');
  const applePage = fs.readFileSync(path.join(root, 'apple-music-qr-code-generator.html'), 'utf8');

  assert.match(page, /<html lang="en">/);
  assert.match(page, /<title>Free Linktree QR Code Generator \| QRStatic<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]{40,}">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/qrstatic\.app\/linktree-qr-code-generator\.html">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/qrstatic\.app\/linktree-qr-code-generator\.html">/);
  assert.match(page, /id="download-png"/);
  assert.match(page, /id="download-svg"/);
  assert.match(page, /Download PNG/);
  assert.match(page, /Download SVG/);
  assert.match(page, /ca-pub-8737820277849030/);
  assert.match(page, /G-JV95W19XS3/);
  assert.match(page, /vendor\/qrcode\.min\.js/);
  assert.match(page, /js\/qr-core\.js/);
  assert.match(page, /js\/linktree-payload\.js/);
  assert.match(page, /js\/share\.js/);
  assert.match(page, /href="vcard-qr-code-generator\.html"/);
  assert.match(page, /href="https:\/\/qrstatic\.app\/vcard-qr-code-generator\.html"/);
  assert.match(page, /href="linkedin-qr-code-generator\.html"/);
  assert.match(page, /href="https:\/\/qrstatic\.app\/linkedin-qr-code-generator\.html"/);
  assert.match(page, /href="whatsapp-qr-code-generator\.html"/);
  assert.match(page, /href="https:\/\/qrstatic\.app\/whatsapp-qr-code-generator\.html"/);
  assert.match(page, /quiet zone/i);
  assert.match(page, /dark modules on a light background/i);
  assert.match(page, /do not overlay the official Linktree logo in the center of the code/i);
  assert.match(page, /unique URL, not your username/);
  assert.match(page, /QR codes keep working/);
  assert.match(page, /How to create your QR code/);
  assert.match(page, /https:\/\/linktr\.biz\/help\/en\/articles\/5434152-create-qr-code/);
  assert.match(page, /https:\/\/linktr\.ee\/help\/articles\/5434152-create-qr-code/);
  assert.match(page, /does not assume an old username automatically redirects/i);
  assert.match(page, /no timed expiry of its own/i);
  assert.match(page, /Official help does not say whether an official Linktree QR code expires/);
  assert.match(page, /This site is not official Linktree/);
  assert.match(page, /does not send a request to unwrap/i);
  assert.match(page, /custom domains/i);
  assert.match(page, /unknown unique URL/i);
  assert.match(page, /No signup/);
  assert.match(page, /in your browser/i);
  assert.doesNotMatch(page, /never expires/i);
  assert.doesNotMatch(page, /search ranking|rank on|passive income|revenue|earnings|monetiz|guaranteed scans|scan volume|\bSEO\b|more clients|more leads/i);
  assert.doesNotMatch(page, /facebook-qr-code-generator|threads-qr-code-generator|facebook-page|threads-profile/i);
  assert.doesNotMatch(page, /<img[^>]+linktr/i);
  assert.doesNotMatch(pageJs, /userAgent|navigator\.platform|fetch\s*\(/);
  assert.doesNotMatch(payloadJs, /userAgent|fetch\s*\(/);
  assert.match(pageJs, /QRCode\.toCanvas\(canvas, built\.payload/);
  assert.match(payloadJs, /No user-agent routing/);
  assert.match(check, /'linktree-qr-code-generator\.html'/);
  assert.match(check, /'apple-music-qr-code-generator\.html'/);
  assert.match(check, /'whatsapp-channel-qr-code-generator\.html'/);

  assert.doesNotMatch(index, /linktree-qr-code-generator/);
  assert.doesNotMatch(vcardPage, /linktree-qr-code-generator/);
  assert.doesNotMatch(linkedinPage, /linktree-qr-code-generator/);
  assert.doesNotMatch(whatsappPage, /linktree-qr-code-generator/);
  assert.doesNotMatch(applePage, /linktree-qr-code-generator/);
  assert.match(index, /name="toolfound-verify" content="490c0cfeeb94b3d65d893e18dcff92dca9ab1b123e18a330"/);
  assert.match(index, /name="google-adsense-account" content="ca-pub-8737820277849030"/);
  assert.equal(ads, 'google.com, pub-8737820277849030, DIRECT, f08c47fec0942fa0\n');

  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(function (m) { return m[1]; });
  assert.equal(locs[locs.length - 1], 'https://qrstatic.app/linktree-qr-code-generator.html');
  assert.equal(locs[locs.length - 2], 'https://qrstatic.app/apple-music-qr-code-generator.html');
  assert.equal(
    (sitemap.match(/<loc>https:\/\/qrstatic\.app\/linktree-qr-code-generator\.html<\/loc>/g) || []).length,
    1
  );
  assert.match(
    sitemap,
    /<loc>https:\/\/qrstatic\.app\/apple-music-qr-code-generator\.html<\/loc><lastmod>2026-11-25<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/linktree-qr-code-generator\.html<\/loc><lastmod>2026-11-28<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n<\/urlset>/
  );
});

test('generated SVG is a static image of the homepage URL and not a short link', function () {
  const sandbox = loadIIFE('vendor/qrcode.min.js');
  const QRCode = sandbox.QRCode;
  assert.equal(typeof QRCode.toString, 'function');
  const opts = { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 256 };
  const payloads = [EE, BIZ].map(function (input) {
    return api.buildLinktreePayload(input).payload;
  });
  return Promise.all(payloads.map(function (payload) {
    return QRCode.toString(payload, opts);
  })).then(function (svgs) {
    assert.equal(svgs.length, 2);
    svgs.forEach(function (svg, i) {
      assert.match(svg, /<svg/);
      assert.equal(svg.includes('bit.ly'), false);
      assert.equal(svg.includes('qrstatic.app'), false);
      assert.equal(svg.includes('utm_'), false);
      assert.equal(svg.includes('fbclid'), false);
      assert.equal(svg.includes('userAgent'), false);
      if (i > 0) assert.notEqual(svg, svgs[0]);
    });
  });
});
