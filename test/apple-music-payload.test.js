'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { root, loadIIFE } = require('./helpers');

function loadPayload() {
  return loadIIFE('js/apple-music-payload.js').AppleMusicPayload;
}

const api = loadPayload();
const SONG = 'https://music.apple.com/us/song/example-track/1234567890';
const ALBUM = 'https://music.apple.com/us/album/1524801260';
const ALBUM_SLUG = 'https://music.apple.com/us/album/a-night-at-the-opera/1440814844';
const ALBUM_SONG = 'https://music.apple.com/gb/album/midnights/1649434004?i=1650237741';
const PLAYLIST = 'https://music.apple.com/jp/playlist/evening/pl.u-AbCdEf123456';
const SPOTIFY_PAGE = 'https://qrstatic.app/spotify-qr-code-generator.html';
const APP_STORE_PAGE = 'https://qrstatic.app/app-store-google-play-qr-code-generator.html';

function rejected(input, pattern) {
  assert.throws(function () { api.buildAppleMusicPayload(input); }, pattern || /not encoded|Nothing was encoded/i);
}

test('public song, album, and playlist URLs are accepted', function () {
  const song = api.buildAppleMusicPayload(SONG);
  assert.equal(song.payload, SONG);
  assert.equal(song.url, SONG);
  assert.equal(song.type, 'song');
  assert.equal(song.id, '1234567890');
  assert.equal(song.storefront, 'us');
  assert.equal(song.host, 'music.apple.com');
  assert.equal(song.songId, '');
  assert.equal(song.normalized, false);
  assert.match(song.warning, /not an official Apple product/i);
  assert.match(song.warning, /does not bypass region limits/i);
  assert.match(song.warning, /current public link/i);

  const album = api.buildAppleMusicPayload(ALBUM);
  assert.equal(album.payload, ALBUM);
  assert.equal(album.type, 'album');
  assert.equal(album.id, '1524801260');

  const slug = api.buildAppleMusicPayload(ALBUM_SLUG);
  assert.equal(slug.payload, ALBUM_SLUG);
  assert.equal(slug.type, 'album');

  const playlist = api.buildAppleMusicPayload(PLAYLIST);
  assert.equal(playlist.payload, PLAYLIST);
  assert.equal(playlist.type, 'playlist');
  assert.equal(playlist.storefront, 'jp');
  assert.equal(playlist.id, 'pl.u-AbCdEf123456');

  api.assertStaticAppleMusicPayload(song);
  api.assertStaticAppleMusicPayload(album);
  api.assertStaticAppleMusicPayload(slug);
  api.assertStaticAppleMusicPayload(playlist);
});

test('album-to-song i= is kept and the pasted storefront is not rewritten', function () {
  const built = api.buildAppleMusicPayload(ALBUM_SONG);
  assert.equal(built.payload, ALBUM_SONG);
  assert.equal(built.type, 'album');
  assert.equal(built.storefront, 'gb');
  assert.equal(built.songId, '1650237741');
  assert.equal(built.payload.includes('?i=1650237741'), true);
  assert.equal(built.storefront === 'us', false);
  api.assertStaticAppleMusicPayload(built);

  const us = api.buildAppleMusicPayload('https://music.apple.com/us/playlist/pl.f4d106fed2bd41149aaacabb233eb5eb');
  assert.equal(us.storefront, 'us');
  assert.equal(us.payload, 'https://music.apple.com/us/playlist/pl.f4d106fed2bd41149aaacabb233eb5eb');
});

test('https may be omitted, and http, www, geo, hash, trailing slash, and id prefix are normalized', function () {
  assert.equal(api.buildAppleMusicPayload('music.apple.com/us/album/1524801260').payload, ALBUM);
  assert.equal(api.buildAppleMusicPayload('http://www.music.apple.com/us/album/1524801260/').payload, ALBUM);
  assert.equal(api.buildAppleMusicPayload('https://www.music.apple.com/us/album/1524801260#songs').payload, ALBUM);
  assert.equal(api.buildAppleMusicPayload('https://geo.music.apple.com/us/album/1524801260').payload, ALBUM);
  assert.equal(api.buildAppleMusicPayload('HTTPS://WWW.MUSIC.APPLE.COM/US/Album/1524801260').payload, ALBUM);
  assert.equal(api.buildAppleMusicPayload('https://music.apple.com/us/album/id1524801260').payload, ALBUM);
  assert.equal(
    api.buildAppleMusicPayload('http://geo.music.apple.com/gb/song/example-track/1234567890').payload,
    'https://music.apple.com/gb/song/example-track/1234567890'
  );
  const geoPlaylist = api.buildAppleMusicPayload('geo.music.apple.com/jp/playlist/evening/pl.u-AbCdEf123456#top');
  assert.equal(geoPlaylist.payload, PLAYLIST);
  assert.equal(geoPlaylist.host, 'music.apple.com');
});

test('affiliate and tracking parameters are removed and none are added', function () {
  const raw = 'https://geo.music.apple.com/gb/album/midnights/1649434004?i=1650237741&at=1000l3xx&ct=spring&pt=1&ls=1&app=music&uo=4&itsct=abc&itscg=def&utm_source=ig&utm_medium=social&fbclid=abc&gclid=xyz&mt=1&l=en-US#track';
  const built = api.buildAppleMusicPayload(raw);
  assert.equal(built.payload, ALBUM_SONG);
  assert.equal(built.strippedTracking, true);
  assert.equal(built.payload.startsWith('https://music.apple.com/'), true);
  assert.equal(/[?&](?:at|ct|pt|ls|app|uo|itsct|itscg|fbclid|gclid)=/.test(built.payload), false);
  assert.equal(/utm_|#|qrstatic\.app|affiliate/.test(built.payload), false);
  assert.equal(built.payload.includes('1000l3xx'), false);
  api.assertStaticAppleMusicPayload(built);

  const clean = api.buildAppleMusicPayload(ALBUM);
  assert.equal(clean.payload, ALBUM);
  assert.equal(clean.payload.includes('?'), false);
});

test('artist, radio, music-video, library, account, redeem, login, and short links are rejected', function () {
  rejected('https://music.apple.com/us/artist/example-artist/159260351', /artist page/i);
  rejected('https://music.apple.com/us/station/apple-music-1/ra.978194965', /radio or Station/i);
  rejected('https://music.apple.com/us/radio/apple-music-1/ra.978194965', /radio or Station/i);
  rejected('https://music.apple.com/us/music-video/blank-space/1440815267', /music-video/i);
  rejected('https://music.apple.com/library/recently-added', /library, Listen Now, or Browse/i);
  rejected('https://music.apple.com/us/listen-now', /library, Listen Now, or Browse/i);
  rejected('https://music.apple.com/browse', /library, Listen Now, or Browse/i);
  rejected('https://music.apple.com/account', /account, settings, or subscribe/i);
  rejected('https://music.apple.com/settings', /account, settings, or subscribe/i);
  rejected('https://music.apple.com/subscribe', /account, settings, or subscribe/i);
  rejected('https://music.apple.com/redeem', /redeem, trial, offer, or gift-code/i);
  rejected('https://music.apple.com/us/trial', /redeem, trial, offer, or gift-code/i);
  rejected('https://music.apple.com/gift', /redeem, trial, offer, or gift-code/i);
  rejected('https://music.apple.com/us/offer/spring', /redeem, trial, offer, or gift-code/i);
  rejected('https://music.apple.com/us/album/1524801260?offer=trial', /redeem, trial, offer, or gift-code/i);
  rejected('https://music.apple.com/us/album/1524801260?code=GIFTCODE', /redeem, trial, offer, or gift-code/i);
  rejected('https://appleid.apple.com/auth/authorize', /Apple ID login/i);
  rejected('otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP', /Apple ID login|2FA|authenticator/i);
  rejected('https://music.apple.com/us/shareplay/session', /SharePlay|Apple ID login/i);
  rejected('https://music.apple.com/authenticator', /Apple ID login/i);
  rejected('https://music.apple.com/keychain', /Apple ID login/i);
  rejected('https://music.apple.com/us/album/1524801260?private=1', /sign-in|Apple ID login|private/i);
  rejected('https://itunes.apple.com/us/album/id1440814844', /itunes\.apple\.com/i);
  rejected('https://buy.itunes.apple.com/redeem?code=ABCD1234', /itunes\.apple\.com|redeem/i);
  rejected('https://apple.co/3abcDEF', /apple\.co short link/i);
  rejected('https://music.youtube.com/watch?v=dQw4w9WgXcQ', /YouTube Music/i);
  rejected('https://qrstatic.app/abc123', /qrstatic\.app/i);
  rejected('https://bit.ly/applemusic', /short link/i);
  rejected('https://music.apple.com/us/curator/apple-music/976439448', /not a public song, album, or playlist/i);
  rejected('https://music.apple.com/album/1524801260', /missing the storefront/i);
  rejected('', /Nothing was encoded/);
  rejected('https://example.com/us/album/1524801260', /not a public music\.apple\.com/i);
});

test('Spotify and App Store links are rejected with the live tool pages and no code', function () {
  rejected('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', new RegExp(SPOTIFY_PAGE.replace(/[.]/g, '\\.')));
  rejected('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc', /spotify-qr-code-generator\.html/);
  rejected('spotify.link/abcDEF', /spotify-qr-code-generator\.html/);
  rejected('https://apps.apple.com/us/app/example-app/id310633997', new RegExp(APP_STORE_PAGE.replace(/[.]/g, '\\.')));
  rejected('https://apps.apple.com/gb/app/example/id123456789', /app-store-google-play-qr-code-generator\.html/);

  assert.throws(function () {
    return api.buildAppleMusicPayload('https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy');
  }, function (err) {
    assert.match(err.message, /will not generate a code/);
    assert.match(err.message, /https:\/\/qrstatic\.app\/spotify-qr-code-generator\.html/);
    assert.equal(/music\.apple\.com\/[a-z]{2}\/(?:song|album|playlist)/.test(err.message), false);
    return true;
  });
  assert.throws(function () {
    api.buildAppleMusicPayload('https://apps.apple.com/us/app/example/id310633997');
  }, function (err) {
    assert.match(err.message, /will not generate a code/);
    assert.match(err.message, /https:\/\/qrstatic\.app\/app-store-google-play-qr-code-generator\.html/);
    return true;
  });
});

test('a non-public or unexpected parameter is not encoded', function () {
  rejected('https://music.apple.com/us/album/1524801260?foo=1', /will not encode/i);
  rejected('https://music.apple.com/us/album/1524801260?i=12', /i= parameter looks invalid/i);
  rejected('https://music.apple.com/us/album/1524801260?i=1650237741&i=1650237742', /will not encode/i);
  rejected('https://music.apple.com/us/playlist/p.libraryid', /playlist id/i);
  rejected('https://music.apple.com/us/album/1524801260?redirect=https://example.com', /redirect/i);
  rejected('javascript:alert(1)', /http\(s\)|not encoded/i);
});

test('assertStatic refuses short links, hashes, tracking, and empty payloads', function () {
  assert.throws(function () {
    api.assertStaticAppleMusicPayload({ payload: 'https://qrstatic.app/abc' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticAppleMusicPayload({ payload: ALBUM + '?at=1000l3xx' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticAppleMusicPayload({ payload: ALBUM + '&utm_source=x' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticAppleMusicPayload({ payload: ALBUM + '#songs' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticAppleMusicPayload({ payload: 'https://apple.co/3abcDEF' });
  }, /Refusing to encode/);
  assert.throws(function () {
    api.assertStaticAppleMusicPayload({ payload: '' });
  }, /Refusing to encode/);
});

test('a successful payload is the normalized HTTPS catalog URL and nothing else', function () {
  const built = api.buildAppleMusicPayload(
    'http://www.music.apple.com/us/album/a-night-at-the-opera/1440814844?at=1000l3xx&utm_source=card&fbclid=abc&gclid=xyz#top'
  );
  assert.equal(built.payload, ALBUM_SLUG);
  assert.equal(built.payload.startsWith('https://music.apple.com/'), true);
  assert.equal(built.payload.includes('qrstatic.app'), false);
  assert.equal(/\/\/apple\.co\b/.test(built.payload), false);
  assert.equal(/[?&#](?:utm_|fbclid|gclid|at=)/.test(built.payload), false);
  assert.equal(built.payload.includes('#'), false);
  api.assertStaticAppleMusicPayload(built);

  const payloadJs = fs.readFileSync(path.join(root, 'js/apple-music-payload.js'), 'utf8');
  assert.match(payloadJs, /No user-agent routing/);
  assert.doesNotMatch(payloadJs, /fetch\s*\(|XMLHttpRequest|userAgent|apple\.co\/\w+/);
});

test('page, sitemap, and already-live pages meet the Apple Music preview contract', function () {
  const page = fs.readFileSync(path.join(root, 'apple-music-qr-code-generator.html'), 'utf8');
  const pageJs = fs.readFileSync(path.join(root, 'js/apple-music-page.js'), 'utf8');
  const payloadJs = fs.readFileSync(path.join(root, 'js/apple-music-payload.js'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ads = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8');
  const check = fs.readFileSync(path.join(root, 'scripts/check-site.js'), 'utf8');
  const spotifyPage = fs.readFileSync(path.join(root, 'spotify-qr-code-generator.html'), 'utf8');
  const youtubePage = fs.readFileSync(path.join(root, 'youtube-channel-qr-code-generator.html'), 'utf8');
  const whatsappPage = fs.readFileSync(path.join(root, 'whatsapp-channel-qr-code-generator.html'), 'utf8');
  const linkedinPage = fs.readFileSync(path.join(root, 'linkedin-qr-code-generator.html'), 'utf8');

  assert.match(page, /<html lang="en">/);
  assert.match(page, /<title>Free Apple Music QR Code Generator \| QRStatic<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]{40,}">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/qrstatic\.app\/apple-music-qr-code-generator\.html">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/qrstatic\.app\/apple-music-qr-code-generator\.html">/);
  assert.match(page, /id="download-png"/);
  assert.match(page, /id="download-svg"/);
  assert.match(page, /Download PNG/);
  assert.match(page, /Download SVG/);
  assert.match(page, /ca-pub-8737820277849030/);
  assert.match(page, /G-JV95W19XS3/);
  assert.match(page, /vendor\/qrcode\.min\.js/);
  assert.match(page, /js\/qr-core\.js/);
  assert.match(page, /js\/apple-music-payload\.js/);
  assert.match(page, /js\/share\.js/);
  assert.match(page, /href="spotify-qr-code-generator\.html"/);
  assert.match(page, /href="https:\/\/qrstatic\.app\/spotify-qr-code-generator\.html"/);
  assert.match(page, /href="youtube-channel-qr-code-generator\.html"/);
  assert.match(page, /href="https:\/\/qrstatic\.app\/youtube-channel-qr-code-generator\.html"/);
  assert.match(page, /href="https:\/\/qrstatic\.app\/app-store-google-play-qr-code-generator\.html"/);
  assert.match(page, /quiet zone/i);
  assert.match(page, /dark modules on a light background/i);
  assert.match(page, /do not overlay the official Apple or Apple Music logo in the center of the code/i);
  assert.match(page, /artist marketing toolbox/i);
  assert.match(page, /static URL/i);
  assert.match(page, /public songs, albums, and playlists/i);
  assert.match(page, /artist pages, radio/i);
  assert.match(page, /opens without signing in/i);
  assert.match(page, /made private, deleted, or the link changes/i);
  assert.match(page, /current public link/i);
  assert.match(page, /Do not use this page for Apple ID login, redeem, or trial/);
  assert.match(page, /This site is not official Apple/);
  assert.match(page, /No signup/);
  assert.match(page, /in your browser/i);
  assert.doesNotMatch(page, /play counts?|rankings?|revenue|earnings|monetiz|guaranteed plays|search ranking|\bSEO\b/i);
  assert.doesNotMatch(page, /林启|Lin Qi|ko-fi|buymeacoffee|linktree|substack|patreon/i);
  assert.doesNotMatch(pageJs, /userAgent|navigator\.platform|fetch\s*\(/);
  assert.doesNotMatch(payloadJs, /userAgent|fetch\s*\(/);
  assert.match(pageJs, /QRCode\.toCanvas\(canvas, built\.payload/);
  assert.match(payloadJs, /No user-agent routing/);
  assert.match(check, /'apple-music-qr-code-generator\.html'/);

  assert.doesNotMatch(index, /apple-music-qr-code-generator/);
  assert.doesNotMatch(spotifyPage, /apple-music-qr-code-generator/);
  assert.doesNotMatch(youtubePage, /apple-music-qr-code-generator/);
  assert.doesNotMatch(whatsappPage, /apple-music-qr-code-generator/);
  assert.doesNotMatch(linkedinPage, /apple-music-qr-code-generator/);
  assert.match(index, /name="toolfound-verify" content="490c0cfeeb94b3d65d893e18dcff92dca9ab1b123e18a330"/);
  assert.match(index, /name="google-adsense-account" content="ca-pub-8737820277849030"/);
  assert.equal(ads, 'google.com, pub-8737820277849030, DIRECT, f08c47fec0942fa0\n');

  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(function (m) { return m[1]; });
  assert.equal(locs[locs.length - 1], 'https://qrstatic.app/apple-music-qr-code-generator.html');
  assert.equal(locs[locs.length - 2], 'https://qrstatic.app/whatsapp-channel-qr-code-generator.html');
  assert.equal(
    (sitemap.match(/<loc>https:\/\/qrstatic\.app\/apple-music-qr-code-generator\.html<\/loc>/g) || []).length,
    1
  );
  assert.match(
    sitemap,
    /<loc>https:\/\/qrstatic\.app\/whatsapp-channel-qr-code-generator\.html<\/loc><lastmod>2026-11-22<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/apple-music-qr-code-generator\.html<\/loc><lastmod>2026-11-25<\/lastmod><changefreq>weekly<\/changefreq><priority>0\.9<\/priority><\/url>\n<\/urlset>/
  );
});

test('generated SVG is a static image of the catalog URL and not a short link', function () {
  const sandbox = loadIIFE('vendor/qrcode.min.js');
  const QRCode = sandbox.QRCode;
  assert.equal(typeof QRCode.toString, 'function');
  const opts = { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 256 };
  const payloads = [SONG, ALBUM, ALBUM_SONG, PLAYLIST].map(function (input) {
    return api.buildAppleMusicPayload(input).payload;
  });
  return Promise.all(payloads.map(function (payload) {
    return QRCode.toString(payload, opts);
  })).then(function (svgs) {
    assert.equal(svgs.length, 4);
    svgs.forEach(function (svg, i) {
      assert.match(svg, /<svg/);
      assert.equal(svg.includes('bit.ly'), false);
      assert.equal(svg.includes('qrstatic.app'), false);
      assert.equal(svg.includes('apple.co'), false);
      assert.equal(svg.includes('at='), false);
      assert.equal(svg.includes('userAgent'), false);
      if (i > 0) assert.notEqual(svg, svgs[0]);
    });
  });
});
