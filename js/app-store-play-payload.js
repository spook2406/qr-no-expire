(function (global) {
  'use strict';

  /**
   * Two independent static store URLs.
   * App Store QR payload = normalized https://apps.apple.com app page.
   * Google Play QR payload = normalized https://play.google.com/store/apps/details?id=
   * No user-agent routing, no fetch, no short-link service, no redirect unwrap.
   */

  var APP_PAYLOAD_RE = /^https:\/\/apps\.apple\.com\/(?:[a-z]{2}\/)?app\/(?:(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})+\/)?id[1-9]\d{5,17}(?:\?[A-Za-z0-9._~%=&+-]*)?$/;
  var PLAY_PAYLOAD_RE = /^https:\/\/play\.google\.com\/store\/apps\/details\?id=[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;
  var PACKAGE_RE = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;
  var SLUG_RE = /^(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})+$/;

  var TRACKING_EXACT = {
    fbclid: true,
    gclid: true,
    gbraid: true,
    wbraid: true,
    dclid: true,
    msclkid: true,
    twclid: true,
    ttclid: true,
    igshid: true,
    mc_cid: true,
    mc_eid: true,
    _ga: true,
    _gl: true,
    gad_source: true,
    gad_campaignid: true,
    gclsrc: true,
    yclid: true,
    srsltid: true,
    mkt_tok: true,
    icid: true,
    at: true,
    ct: true,
    pt: true,
    mt: true,
    uo: true,
    itsct: true,
    itscg: true,
    ls: true,
    referrer: true,
    ref: true,
    gref: true,
    feature: true,
    source: true,
    campaign: true,
    cid: true,
    ncid: true,
    soc_src: true,
    soc_trk: true
  };

  var SHORT_SUFFIXES = [
    'bit.ly', 'bitly.com', 'tinyurl.com', 'tiny.cc', 't.co', 'goo.gl', 'ow.ly',
    'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'rb.gy', 't.ly', 'short.io',
    'lnk.to', 'ffm.to', 'smarturl.it', 'song.link', 'linktr.ee', 'bio.link',
    'onelink.me', 'app.link', 'branch.io', 'bnc.lt', 'adj.st', 'adjust.com',
    'appsflyer.com', 'abr.ge', 'appsto.re', 'apple.co', 'smart.link',
    'qrco.de', 'flowcode.com', 'bit.do', 'tiny.one', 'dub.sh'
  ];

  var SIDELOAD_SUFFIXES = [
    'apkpure.com', 'apkpure.net', 'apkmirror.com', 'apkcombo.com', 'apkmonk.com',
    'aptoide.com', 'f-droid.org', 'fdroid.org', 'happymod.com', 'apkmody.io',
    'androidapksfree.com', 'apkhere.com', 'apkfab.com', 'uptodown.com',
    'apkdone.com', 'apksos.com', 'rexdl.com', 'platinmods.com', 'apknew.com',
    'apkdl.in', 'apk.support', 'apkgoogle.com', 'apkgk.com', 'z-apk.com'
  ];

  var SHARE_WARNING = 'Share only store links you have the right to share. This site is not official Apple or Google. These are two static store URLs, not a device-routed smart short link, and this page does not help with piracy or sideloading.';

  function fail(message) {
    throw new Error(message);
  }

  function cleanInput(input) {
    var raw = String(input == null ? '' : input).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if ((raw.charAt(0) === '"' && raw.charAt(raw.length - 1) === '"') ||
        (raw.charAt(0) === "'" && raw.charAt(raw.length - 1) === "'")) {
      raw = raw.slice(1, -1).trim();
    }
    return raw;
  }

  function emptyBothError() {
    return 'Enter an App Store URL, a Google Play URL, or both. This page builds two labeled static QR codes, not a device-routed smart short link. Nothing was encoded.';
  }

  function appEmptyError() {
    return 'Paste a public App Store app page (apps.apple.com or itunes.apple.com with /app/id and the app id). An empty App Store field is skipped only when the Google Play field has a link. Nothing was encoded.';
  }

  function playEmptyError() {
    return 'Paste a public Google Play app page (play.google.com/store/apps/details?id= or market://details?id=). An empty Google Play field is skipped only when the App Store field has a link. Nothing was encoded.';
  }

  function crossFromAppError() {
    return 'That looks like a Google Play link. Paste it in the Google Play field. It was not encoded in the App Store QR.';
  }

  function crossFromPlayError() {
    return 'That looks like an App Store link. Paste it in the App Store field. It was not encoded in the Google Play QR.';
  }

  function shortLinkError() {
    return 'That is a third-party smart short link or redirect, not an official store app page. Paste the public apps.apple.com or play.google.com URL. Short links are not encoded.';
  }

  function redirectHostError() {
    return 'That host is a redirect in front of the store, not the public app page. Paste the https apps.apple.com or play.google.com app URL directly. Redirects are not encoded.';
  }

  function sideloadError() {
    return 'That looks like an APK or sideload download link. This page only encodes official App Store and Google Play app pages. It does not help with piracy or sideloading, and the link was not encoded.';
  }

  function appWrongDomainError() {
    return 'That is not a public App Store app page. Paste an apps.apple.com or itunes.apple.com link that includes the app id (/app/…/id123…). Other sites are not encoded.';
  }

  function playWrongDomainError() {
    return 'That is not a public Google Play app page. Paste play.google.com/store/apps/details?id=… (or market://details?id=…). Other sites are not encoded.';
  }

  function appDeveloperError() {
    return 'That is an App Store developer page, not an app page. Paste the public app link that contains /app/id and the app id. Developer pages are not encoded.';
  }

  function appSearchError() {
    return 'That is an App Store search, category, or marketing page, not a single app. Paste the public app page whose path contains /app/ and an id number (…/id123…). Search and category pages are not encoded.';
  }

  function appMissingIdError() {
    return 'That App Store link has no app id. Paste the public app page, for example https://apps.apple.com/app/id123456789. Links without an app id are not encoded.';
  }

  function appBrokenPathError() {
    return 'That App Store link is not a single app page. Paste the public app URL that ends with the app id. It was not encoded.';
  }

  function playDeveloperError() {
    return 'That is a Google Play developer page, not an app page. Paste the public app link: https://play.google.com/store/apps/details?id=your.package.name. Developer pages are not encoded.';
  }

  function playSearchError() {
    return 'That is a Google Play search, category, or marketing page, not a single app. Paste play.google.com/store/apps/details?id= and the package name. Search and category pages are not encoded.';
  }

  function playMissingIdError() {
    return 'That Google Play link has no package id. Paste https://play.google.com/store/apps/details?id=your.package.name. Links without a package id are not encoded.';
  }

  function playNotDetailsError() {
    return 'That Google Play link is not an app details page (play.google.com/store/apps/details?id=…). It was not encoded.';
  }

  function playBadPackageError() {
    return 'That Google Play package name looks invalid. Use the id from the app’s Play page, like com.example.app. It was not encoded.';
  }

  function hostSuffix(host, suffix) {
    return host === suffix || host.slice(-(suffix.length + 1)) === '.' + suffix;
  }

  function matchesList(host, list) {
    var i;
    for (i = 0; i < list.length; i++) {
      if (hostSuffix(host, list[i])) return true;
    }
    return false;
  }

  function bareHost(url) {
    return String(url.hostname || '').toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  }

  function isTrackingKey(key) {
    var k = String(key || '').toLowerCase();
    if (k.indexOf('utm_') === 0) return true;
    return Object.prototype.hasOwnProperty.call(TRACKING_EXACT, k);
  }

  function isUnsafeQuery(key, value) {
    var k = String(key || '').toLowerCase();
    var v = String(value || '');
    if (/^(redirect|url|dest|destination|target|next|link|goto|q|u)$/.test(k)) return true;
    if (/\.apk|\.xapk|\.apks|\.aab|\.ipa|sideload|:\/\/|javascript:/i.test(v)) return true;
    return false;
  }

  function isSideloadUrl(url) {
    var host = bareHost(url);
    var path = String(url.pathname || '');
    var search = String(url.search || '');
    if (matchesList(host, SIDELOAD_SUFFIXES)) return true;
    if (/\.(apk|xapk|apks|aab|ipa)(?:$|[?#])/i.test(path)) return true;
    if (/(?:^|[?&])[^=]*=[^&]*\.(?:apk|xapk|apks|aab|ipa)(?:$|&)/i.test(search) &&
        host !== 'play.google.com' && host !== 'apps.apple.com' && host !== 'itunes.apple.com') {
      return true;
    }
    return false;
  }

  function isRedirectHost(host) {
    if (host === 'geo.itunes.apple.com' || host === 'testflight.apple.com') return true;
    if (host !== 'itunes.apple.com' && hostSuffix(host, 'itunes.apple.com')) return true;
    if (host !== 'apps.apple.com' && hostSuffix(host, 'apps.apple.com')) return true;
    if (host !== 'play.google.com' && hostSuffix(host, 'play.google.com')) return true;
    return false;
  }

  function classifyHost(url) {
    if (String(url.protocol || '').toLowerCase() === 'market:') return 'play';
    var host = bareHost(url);
    if (host === 'play.google.com') return 'play';
    if (host === 'apps.apple.com' || host === 'itunes.apple.com') return 'appstore';
    if (isRedirectHost(host) || matchesList(host, SHORT_SUFFIXES)) return 'redirect';
    return 'other';
  }

  function toUrl(raw) {
    var candidate = raw;
    if (/^intent:/i.test(candidate)) {
      fail('That is an Android intent link, not a public store app page. Paste the https App Store or Google Play URL (or market://details?id= for Play). Intent links are not encoded.');
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !/^https?:/i.test(candidate) && !/^market:/i.test(candidate)) {
      fail('Use an http(s) store link, or market://details?id= for Google Play. Other schemes are not encoded.');
    }
    if (/\s/.test(candidate)) {
      fail('That link contains a space. Paste one store URL with no extra text. It was not encoded.');
    }
    if (!/^https?:\/\//i.test(candidate) && !/^market:/i.test(candidate)) {
      if (/^\/\//.test(candidate)) {
        candidate = 'https:' + candidate;
      } else if (/^(www\.)?(apps\.apple\.com|itunes\.apple\.com|play\.google\.com|bit\.ly|bitly\.com|tinyurl\.com|onelink\.me|app\.link|t\.co|goo\.gl|appsto\.re)\b/i.test(candidate) ||
          /^[a-z0-9.-]+\.[a-z]{2,}([/:?#]|$)/i.test(candidate)) {
        candidate = 'https://' + candidate.replace(/^\/\//, '');
      } else {
        fail('That does not look like a store URL. Paste a public apps.apple.com app page or a play.google.com/store/apps/details link. It was not encoded.');
      }
    }
    var url;
    try {
      url = new URL(candidate);
    } catch (e) {
      fail('That does not look like a valid store URL. Paste a public apps.apple.com app page or a play.google.com/store/apps/details link. It was not encoded.');
    }
    if (url.username || url.password) {
      fail('Paste the store link without a username or password in the URL. It was not encoded.');
    }
    if (url.port && url.port !== '443' && url.port !== '80') {
      fail('That link uses an unexpected port. Paste the normal public https store URL. It was not encoded.');
    }
    var protocol = String(url.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'market:') {
      fail('Use an http(s) store link, or market://details?id= for Google Play. Other schemes are not encoded.');
    }
    return url;
  }

  function rejectShared(url, field) {
    if (isSideloadUrl(url)) fail(sideloadError());
    var kind = classifyHost(url);
    if (field === 'appstore' && kind === 'play') fail(crossFromAppError());
    if (field === 'play' && kind === 'appstore') fail(crossFromPlayError());
    if (kind === 'redirect') {
      if (isRedirectHost(bareHost(url)) && !matchesList(bareHost(url), SHORT_SUFFIXES)) fail(redirectHostError());
      fail(shortLinkError());
    }
    if (field === 'appstore' && kind !== 'appstore') fail(appWrongDomainError());
    if (field === 'play' && kind !== 'play') fail(playWrongDomainError());
  }

  function stripTrackingAndUnsafe(url) {
    var keys = [];
    url.searchParams.forEach(function (_value, key) { keys.push(key); });
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = url.searchParams.get(key);
      var safe = /^[A-Za-z0-9._~+-]*$/.test(key) && /^[A-Za-z0-9._~+-]*$/.test(String(value || ''));
      if (isTrackingKey(key) || isUnsafeQuery(key, value) || !safe) {
        url.searchParams.delete(key);
      }
    }
  }

  function parseAppStorePath(pathname) {
    var path = String(pathname || '/');
    if (path.length > 1) path = path.replace(/\/+$/, '');
    var parts = path.split('/').filter(function (p) { return p.length > 0; });
    var lower = parts.map(function (p) { return String(p).toLowerCase(); });
    var country = '';
    var start = 0;
    if (lower.length >= 2 && /^[a-z]{2}$/.test(lower[0]) && lower[1] === 'app') {
      country = lower[0];
      start = 1;
    }
    if (lower[start] !== 'app') {
      var joined = '/' + lower.join('/');
      if (/(^|\/)developer(\/|$)/.test(joined)) fail(appDeveloperError());
      if (/(^|\/)(search|genre|charts|story|today|iphone|ipad|mac|watch|tv|promo|collection|room)(\/|$)/.test(joined)) {
        fail(appSearchError());
      }
      if (/^[a-z]{2}-[a-z]{2}$/.test(lower[0] || '')) {
        fail('That App Store link uses a regional code this page does not keep. Paste the public app page with a two-letter country (for example /us/) or without a country (/app/id…). It was not encoded.');
      }
      fail(appMissingIdError());
    }
    var rest = parts.slice(start + 1);
    var slug = '';
    var idSegment = '';
    if (rest.length === 1 && /^id\d+$/i.test(rest[0])) {
      idSegment = rest[0];
    } else if (rest.length === 2 && /^id\d+$/i.test(rest[1])) {
      slug = rest[0];
      idSegment = rest[1];
    } else if (!rest.some(function (p) { return /^id\d+$/i.test(p); })) {
      fail(appMissingIdError());
    } else {
      fail(appBrokenPathError());
    }
    var appId = idSegment.replace(/^id/i, '');
    if (!/^[1-9]\d{5,17}$/.test(appId)) {
      fail('That App Store app id looks invalid. Copy the public app page whose path ends in id and at least six digits. It was not encoded.');
    }
    if (slug) {
      if (slug === '.' || slug === '..' || slug.indexOf('..') !== -1 || /%2f/i.test(slug) || /^id\d+$/i.test(slug)) {
        fail(appBrokenPathError());
      }
      if (!SLUG_RE.test(slug)) {
        fail('That App Store app path has characters this page will not encode. Copy the public app page link again. It was not encoded.');
      }
    }
    return { country: country, slug: slug, appId: appId };
  }

  function readPackageId(url) {
    if (!url.searchParams || typeof url.searchParams.getAll !== 'function') {
      fail(playMissingIdError());
    }
    var ids = url.searchParams.getAll('id').filter(function (value) { return String(value || '').trim() !== ''; });
    if (!ids.length) fail(playMissingIdError());
    if (ids.length !== 1) {
      fail('That Google Play link has more than one id parameter. Paste the single package id from the app page. It was not encoded.');
    }
    var id = String(ids[0]).trim();
    if (!PACKAGE_RE.test(id) || id.length > 200) fail(playBadPackageError());
    return id;
  }

  function rejectPlayPath(pathname) {
    var path = String(pathname || '/').replace(/\/+$/, '') || '/';
    var lower = path.toLowerCase();
    if (lower === '/store/apps/details') return;
    if (/\/developer(?:\/|$)/.test(lower) || /\/dev(?:\/|$)/.test(lower)) fail(playDeveloperError());
    if (/\/(search|category|genre|collection|editorial|topic|topcharts|stream)(?:\/|$)/.test(lower) ||
        lower === '/' || lower === '/store' || lower === '/store/apps' ||
        lower === '/store/games' || lower === '/store/movies' || lower === '/store/books') {
      fail(playSearchError());
    }
    fail(playNotDetailsError());
  }

  function finishAppStore(raw, url) {
    rejectShared(url, 'appstore');
    var protocol = String(url.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') fail(appWrongDomainError());
    var parsed = parseAppStorePath(url.pathname);
    stripTrackingAndUnsafe(url);
    var payload = 'https://apps.apple.com';
    if (parsed.country) payload += '/' + parsed.country;
    payload += '/app/';
    if (parsed.slug) payload += parsed.slug + '/';
    payload += 'id' + parsed.appId;
    if (url.search) payload += url.search;
    if (url.hash) {
      /* fragments are not part of the store identity */
    }
    assertStaticStorePayload({ store: 'appstore', payload: payload });
    return {
      payload: payload,
      url: payload,
      label: 'App Store',
      platform: 'iOS',
      store: 'appstore',
      appId: parsed.appId,
      country: parsed.country,
      normalized: payload !== raw,
      warning: SHARE_WARNING
    };
  }

  function finishPlay(raw, url) {
    rejectShared(url, 'play');
    var protocol = String(url.protocol || '').toLowerCase();
    var packageName;
    if (protocol === 'market:') {
      var host = String(url.hostname || '').toLowerCase();
      var path = String(url.pathname || '');
      if (host !== 'details' || (path !== '' && path !== '/')) {
        fail('That market:// link is not an app details page. Use market://details?id=your.package.name. It was not encoded.');
      }
      packageName = readPackageId(url);
    } else {
      rejectPlayPath(url.pathname);
      packageName = readPackageId(url);
    }
    var payload = 'https://play.google.com/store/apps/details?id=' + encodeURIComponent(packageName);
    assertStaticStorePayload({ store: 'play', payload: payload });
    return {
      payload: payload,
      url: payload,
      label: 'Google Play',
      platform: 'Android',
      store: 'play',
      packageName: packageName,
      normalized: payload !== raw,
      warning: SHARE_WARNING
    };
  }

  function normalizeAppStoreUrl(input) {
    var raw = cleanInput(input);
    if (!raw) fail(appEmptyError());
    return finishAppStore(raw, toUrl(raw));
  }

  function normalizePlayUrl(input) {
    var raw = cleanInput(input);
    if (!raw) fail(playEmptyError());
    return finishPlay(raw, toUrl(raw));
  }

  /**
   * @param {string} appStoreInput
   * @param {string} playInput
   * @returns {{ appStore: object|null, play: object|null, errors: string[] }}
   */
  function buildStoreQrPayloads(appStoreInput, playInput) {
    var appRaw = cleanInput(appStoreInput);
    var playRaw = cleanInput(playInput);
    if (!appRaw && !playRaw) {
      return { appStore: null, play: null, errors: [emptyBothError()] };
    }
    var appStore = null;
    var play = null;
    var errors = [];
    if (appRaw) {
      try {
        appStore = normalizeAppStoreUrl(appRaw);
      } catch (e) {
        appStore = null;
        errors.push(e && e.message ? e.message : String(e));
      }
    }
    if (playRaw) {
      try {
        play = normalizePlayUrl(playRaw);
      } catch (e) {
        play = null;
        errors.push(e && e.message ? e.message : String(e));
      }
    }
    return { appStore: appStore, play: play, errors: errors };
  }

  function assertStaticStorePayload(built) {
    var payload = built && built.payload;
    if (typeof payload !== 'string' || !payload) {
      fail('Refusing to encode an empty payload.');
    }
    if (/user-agent|smartlink|onelink|bit\.ly|tinyurl|redirect/i.test(payload)) {
      fail('Refusing to encode a short link or redirect. Nothing was encoded.');
    }
    if (built.store === 'appstore' || /^https:\/\/apps\.apple\.com\//.test(payload)) {
      if (!APP_PAYLOAD_RE.test(payload) || /\.apk|\.ipa|sideload/i.test(payload)) {
        fail('Refusing to encode a link that is not an HTTPS App Store app URL.');
      }
      return built;
    }
    if (!PLAY_PAYLOAD_RE.test(payload) || payload.indexOf('://') !== payload.lastIndexOf('://')) {
      fail('Refusing to encode a link that is not an HTTPS Google Play app URL.');
    }
    return built;
  }

  global.AppStorePlayPayload = {
    buildStoreQrPayloads: buildStoreQrPayloads,
    normalizeAppStoreUrl: normalizeAppStoreUrl,
    normalizePlayUrl: normalizePlayUrl,
    assertStaticStorePayload: assertStaticStorePayload
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
