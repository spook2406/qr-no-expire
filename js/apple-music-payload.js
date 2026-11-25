(function (global) {
  'use strict';

  /**
   * Public Apple Music song, album, and playlist URLs only.
   * HTTPS, unify geo.music.apple.com and www.music.apple.com to
   * music.apple.com, keep the pasted storefront, keep an album-to-song
   * i= parameter, strip the hash, and strip affiliate and tracking
   * parameters. The QR holds that URL directly.
   * No user-agent routing, no network request, no short link, no redirect
   * unwrap, no signup, and no affiliate or campaign parameter added.
   * Artist pages, radio, music videos, library, login, redeem, and trial
   * links stay out of the code. This does not bypass a region limit, a
   * subscription wall, or content that requires sign-in.
   */

  var SPOTIFY_PAGE = 'https://qrstatic.app/spotify-qr-code-generator.html';
  var APP_STORE_PAGE = 'https://qrstatic.app/app-store-google-play-qr-code-generator.html';

  var ARTIST_KIND = { artist: true, artists: true };
  var RADIO_KIND = { station: true, stations: true, radio: true, radios: true };
  var VIDEO_KIND = {
    'music-video': true, 'music-videos': true, musicvideo: true, music_video: true
  };
  var LIBRARY_KIND = {
    library: true, 'listen-now': true, listen_now: true, listennow: true,
    browse: true, 'for-you': true, foryou: true, home: true, 'new': true,
    'recently-added': true, recentlyadded: true, collection: true
  };
  var ACCOUNT_KIND = {
    account: true, accounts: true, settings: true, setting: true,
    subscribe: true, subscription: true, subscriptions: true, profile: true
  };
  var REDEEM_KIND = {
    redeem: true, redemption: true, trial: true, trials: true,
    offer: true, offers: true, gift: true, gifts: true,
    coupon: true, promo: true, voucher: true, code: true
  };
  var LOGIN_KIND = {
    login: true, 'log-in': true, signin: true, 'sign-in': true,
    signup: true, 'sign-up': true, logout: true, 'log-out': true,
    appleid: true, 'apple-id': true, authenticate: true, auth: true
  };
  var TWOFA_KIND = {
    '2fa': true, twofactor: true, 'two-factor': true, authenticator: true,
    otp: true, totp: true, verify: true, verification: true, keychain: true
  };
  var SHAREPLAY_KIND = {
    shareplay: true, 'share-play': true, room: true, rooms: true,
    'listen-together': true, listentogether: true
  };
  var CATALOG_KIND = { song: true, album: true, playlist: true };

  var TRACKING_EXACT = {
    at: true, ct: true, pt: true, ls: true, app: true, uo: true,
    itsct: true, itscg: true, mt: true, mpt: true,
    'ign-itsct': true, 'ign-itscg': true, 'ign-mpt': true,
    fbclid: true, gclid: true, gbraid: true, wbraid: true, dclid: true,
    msclkid: true, twclid: true, ttclid: true, igshid: true, igsh: true,
    mc_cid: true, mc_eid: true, _ga: true, _gl: true, gad_source: true,
    gad_campaignid: true, gclsrc: true, yclid: true, srsltid: true,
    mkt_tok: true, _hsenc: true, _hsmi: true, fb_action_ids: true,
    fb_action_types: true, fb_source: true, fb_ref: true, ref: true,
    ref_src: true, ref_url: true, si: true, source: true, src: true,
    campaign: true, affiliate: true, cid: true, irclickid: true,
    irgwc: true, clickid: true, partner: true, partnerid: true,
    l: true, lang: true, locale: true
  };

  var REDEEM_KEYS = {
    code: true, redeem: true, redemption: true, gift: true, giftcode: true,
    'gift-code': true, offer: true, trial: true, coupon: true, promo: true,
    voucher: true, giftcard: true, 'gift-card': true
  };

  var LOGIN_KEYS = {
    login: true, signin: true, appleid: true, 'apple-id': true,
    password: true, authenticator: true, keychain: true, shareplay: true,
    'share-play': true, private: true, session: true, token: true
  };

  var REDIRECT_KEYS = {
    session_redirect: true, sessionredirect: true, redirect: true, url: true,
    dest: true, destination: true, target: true, next: true, goto: true,
    redir: true, redirecturl: true, redirect_uri: true, 'return': true,
    returnurl: true, return_url: true, q: true, u: true, continue: true
  };

  var SHORT_SUFFIXES = [
    'bit.ly', 'bitly.com', 'tinyurl.com', 'tiny.cc', 't.co', 'goo.gl',
    'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'rb.gy', 't.ly',
    'short.io', 'lnk.to', 'ffm.to', 'smarturl.it', 'linktr.ee', 'bio.link',
    'onelink.me', 'app.link', 'branch.io', 'bnc.lt', 'qrco.de', 'flowcode.com',
    'bit.do', 'tiny.one', 'dub.sh', 'smart.link', 'lnkd.in'
  ];

  var SHARE_WARNING = 'Share only a public Apple Music song, album, or playlist that opens without signing in. QRStatic is not an official Apple product. This QR does not bypass region limits, a subscription wall, or non-public content. If a playlist is made private, deleted, or the link changes, a printed code stops opening that page and must be remade from the current public link.';

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

  function emptyError() {
    return 'Paste a public Apple Music song, album, or playlist URL from music.apple.com. Nothing was encoded.';
  }

  function domainError() {
    return 'That is not a public music.apple.com song, album, or playlist URL. Other websites are not encoded. It was not encoded.';
  }

  function shortLinkError() {
    return 'That is a short link, not a public Apple Music URL. Shorteners are not followed and are not encoded. Paste the public music.apple.com song, album, or playlist URL. It was not encoded.';
  }

  function appleCoError() {
    return 'That is an apple.co short link. This page does not follow network redirects and will not encode a short link. Paste the public music.apple.com song, album, or playlist URL. It was not encoded.';
  }

  function ourShortLinkError() {
    return 'That is a short link or redirect on qrstatic.app, not a public Apple Music URL. This page does not follow redirects and does not put qrstatic.app inside the QR. Paste the public music.apple.com URL. It was not encoded.';
  }

  function spotifyError() {
    return 'That is a Spotify link, not an Apple Music song, album, or playlist. This page will not generate a code for it. Use the Spotify QR generator: ' + SPOTIFY_PAGE + '. It was not encoded.';
  }

  function appStoreError() {
    return 'That is an App Store link on apps.apple.com, not an Apple Music song, album, or playlist. This page will not generate a code for it. Use the App Store and Google Play QR generator: ' + APP_STORE_PAGE + '. It was not encoded.';
  }

  function itunesError() {
    return 'That is an itunes.apple.com link. This page only accepts public music.apple.com song, album, and playlist links, and it does not follow an itunes.apple.com address. It was not encoded.';
  }

  function ytMusicError() {
    return 'That is a YouTube Music link (music.youtube.com), not an Apple Music catalog link. This page does not encode YouTube Music. It was not encoded.';
  }

  function artistError() {
    return 'That is an Apple Music artist page. This page only encodes public song, album, and playlist links, not artist pages. It was not encoded.';
  }

  function radioError() {
    return 'That is an Apple Music radio or Station link. This page does not encode radio or Station. It was not encoded.';
  }

  function videoError() {
    return 'That is an Apple Music music-video link. This page does not encode music videos. Paste a public song, album, or playlist URL. It was not encoded.';
  }

  function libraryError() {
    return 'That Apple Music link is a library, Listen Now, or Browse page. Those need an Apple ID and are not public catalog links. This page does not encode them. It was not encoded.';
  }

  function accountError() {
    return 'That is an Apple Music account, settings, or subscribe page. This page does not encode it. It was not encoded.';
  }

  function redeemError() {
    return 'That looks like a redeem, trial, offer, or gift-code link. Do not use this page for Apple ID login, redeem, or trial. It was not encoded.';
  }

  function loginError() {
    return 'That looks like an Apple ID login, 2FA, authenticator, keychain, or SharePlay link. Do not use this page for Apple ID login, redeem, or trial. It was not encoded.';
  }

  function signInError() {
    return 'That link is not a public song, album, or playlist that opens without signing in. This page does not encode content that requires sign-in, and it does not bypass a subscription wall or a region limit. It was not encoded.';
  }

  function storefrontError() {
    return 'That Apple Music link is missing the storefront (for example /us/, /gb/, or /jp/). This page keeps the storefront you paste and does not guess a region. It was not encoded.';
  }

  function unsupportedError() {
    return 'That Apple Music path is not a public song, album, or playlist. This page does not encode it. It was not encoded.';
  }

  function missingIdError() {
    return 'That Apple Music URL is missing the public catalog id. Paste a music.apple.com song, album, or playlist link. It was not encoded.';
  }

  function invalidIdError() {
    return 'That Apple Music catalog id looks invalid. Copy the public song, album, or playlist URL again. It was not encoded.';
  }

  function playlistIdError() {
    return 'That playlist id is not a public Apple Music playlist id. Public playlist ids start with pl. Library playlist ids are not encoded. It was not encoded.';
  }

  function invalidPathError() {
    return 'That Apple Music path looks invalid. Copy the public song, album, or playlist URL again. It was not encoded.';
  }

  function invalidSongParamError() {
    return 'That album-to-song i= parameter looks invalid. Paste the public link again, or remove i= if you want the album itself. It was not encoded.';
  }

  function extraParamError() {
    return 'That Apple Music link has a parameter this page will not encode. Paste the public URL. Tracking and affiliate parameters are removed; other parameters are not encoded. It was not encoded.';
  }

  function redirectError() {
    return 'That link is a redirect. This page does not follow redirects or encode them. Paste the public music.apple.com song, album, or playlist URL. It was not encoded.';
  }

  function schemeError() {
    return 'Use an http(s) Apple Music URL. Other schemes are not encoded.';
  }

  function otherToolError() {
    return 'That is a link for another tool on this site, not a public Apple Music URL. Use the matching generator. It was not encoded.';
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
    var host = String(url.hostname || '').toLowerCase().replace(/\.+$/, '');
    if (host.indexOf('www.') === 0) host = host.slice(4);
    return host;
  }

  function isTrackingKey(key) {
    var k = String(key || '').toLowerCase();
    if (k.indexOf('utm_') === 0 || k === 'utm') return true;
    if (k.indexOf('its') === 0 || k.indexOf('ign-') === 0) return true;
    return Object.prototype.hasOwnProperty.call(TRACKING_EXACT, k);
  }

  function isAuthKey(key) {
    return /token|session|password|csrf|challenge|otp|auth/.test(key);
  }

  function isSpotifyHost(host) {
    if (host === 'spotify.link' || host === 'spotify.app.link' || host === 'spotify.com' || host === 'open.spotify.com') return true;
    if (host.length > 12 && host.slice(-12) === '.spotify.com') return true;
    if (host.length > 13 && host.slice(-13) === '.spotify.link') return true;
    return false;
  }

  function validCatalogId(id) {
    return /^(?:id)?\d{6,18}$/i.test(id);
  }

  function canonicalCatalogId(id) {
    return String(id || '').replace(/^id/i, '');
  }

  function validPlaylistId(id) {
    return /^pl\.[A-Za-z0-9][A-Za-z0-9._-]{4,120}$/.test(id);
  }

  function validSlug(slug) {
    if (!slug || slug.length > 160) return false;
    if (slug === '.' || slug === '..') return false;
    if (/[\/\\?#\s]/.test(slug)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(slug)) return false;
    return true;
  }

  function toolKindFromText(raw) {
    if (/^otpauth:/i.test(raw)) return '2fa';
    if (/BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(raw)) return 'other';
    if (/BEGIN:VCARD/i.test(raw)) return 'other';
    if (/^WIFI:/i.test(raw)) return 'other';
    if (/^mailto:/i.test(raw)) return 'other';
    if (/^tel:/i.test(raw)) return 'other';
    if (/^sms:/i.test(raw)) return 'other';
    if (/^geo:/i.test(raw)) return 'other';
    return '';
  }

  function failKindWord(word) {
    if (ARTIST_KIND[word]) fail(artistError());
    if (RADIO_KIND[word]) fail(radioError());
    if (VIDEO_KIND[word]) fail(videoError());
    if (LIBRARY_KIND[word]) fail(libraryError());
    if (ACCOUNT_KIND[word]) fail(accountError());
    if (REDEEM_KIND[word]) fail(redeemError());
    if (LOGIN_KIND[word]) fail(loginError());
    if (TWOFA_KIND[word]) fail(loginError());
    if (SHAREPLAY_KIND[word]) fail(loginError());
  }

  function hostKind(host) {
    if (host === 'music.apple.com' || host === 'geo.music.apple.com') return 'catalog';
    if (host === 'music.youtube.com' || (host.length > 18 && host.slice(-18) === '.music.youtube.com')) return 'ytmusic';
    if (host === 'apps.apple.com' || (host.length > 15 && host.slice(-15) === '.apps.apple.com')) return 'appstore';
    if (host === 'itunes.apple.com' || host === 'geo.itunes.apple.com' ||
        (host.length > 17 && host.slice(-17) === '.itunes.apple.com')) return 'itunes';
    if (host === 'apple.co' || (host.length > 8 && host.slice(-8) === '.apple.co')) return 'appleco';
    if (host === 'appleid.apple.com' || host === 'idmsa.apple.com' ||
        host === 'iforgot.apple.com' || host === 'account.apple.com') return 'login';
    if (isSpotifyHost(host)) return 'spotify';
    if (hostSuffix(host, 'qrstatic.app')) return 'ours';
    if (matchesList(host, SHORT_SUFFIXES)) return 'short';
    return 'other';
  }

  function rejectTextShape(raw) {
    if (/^otpauth:/i.test(raw)) fail(loginError());
    if (/\b(2fa|authenticator|keychain)\b/i.test(raw) && !/music\.apple\.com/i.test(raw)) fail(loginError());
    if (/\bshareplay\b/i.test(raw) && !/\/(?:song|album|playlist)\//i.test(raw)) fail(loginError());
    var kind = toolKindFromText(raw);
    if (kind === '2fa') fail(loginError());
    if (kind === 'other') fail(otherToolError());
    if (/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(raw)) fail(domainError());
  }

  function toUrl(raw) {
    if (/\s/.test(raw)) {
      fail('That link contains a space. Paste one Apple Music URL with no extra text. It was not encoded.');
    }
    var candidate = raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !/^https?:/i.test(candidate)) fail(schemeError());
    if (!/^https?:\/\//i.test(candidate)) {
      if (/^\/\//.test(candidate)) {
        candidate = 'https:' + candidate;
      } else if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#]|$)/i.test(candidate)) {
        candidate = 'https://' + candidate.replace(/^\/\//, '');
      } else {
        fail(domainError());
      }
    }
    var url;
    try {
      url = new URL(candidate);
    } catch (e) {
      fail('That does not look like a valid Apple Music URL. Paste a public music.apple.com song, album, or playlist link. It was not encoded.');
    }
    if (url.username || url.password) {
      fail('Paste the Apple Music link without a username or password in the URL. It was not encoded.');
    }
    var protocol = String(url.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') fail(schemeError());
    if (url.port && url.port !== '443' && url.port !== '80') {
      fail('That link uses an unexpected port. Paste the normal https://music.apple.com URL. It was not encoded.');
    }
    return url;
  }

  function rejectHost(url) {
    var kind = hostKind(bareHost(url));
    if (kind === 'catalog') return;
    if (kind === 'ytmusic') fail(ytMusicError());
    if (kind === 'appstore') fail(appStoreError());
    if (kind === 'itunes') fail(itunesError());
    if (kind === 'appleco') fail(appleCoError());
    if (kind === 'login') fail(loginError());
    if (kind === 'spotify') fail(spotifyError());
    if (kind === 'ours') fail(ourShortLinkError());
    if (kind === 'short') fail(shortLinkError());
    var host = bareHost(url);
    var pathLower = String(url.pathname || '').toLowerCase();
    if (hostSuffix(host, 'apple.com') && /redeem|gift|trial|offer|coupon/.test(pathLower)) fail(redeemError());
    fail(domainError());
  }

  function readParts(url) {
    var path = String(url.pathname || '/');
    if (/\/{2,}/.test(path) || /%2f|%5c/i.test(path)) fail(invalidPathError());
    if (path.length > 1) path = path.replace(/\/+$/, '');
    var parts = path.split('/').filter(function (p) { return p.length > 0; });
    try {
      parts = parts.map(function (p) { return decodeURIComponent(p); });
    } catch (e) {
      fail(invalidPathError());
    }
    if (parts.some(function (p) { return /[\/\\?#]/.test(p) || p === '.' || p === '..' || /\s/.test(p); })) {
      fail(invalidPathError());
    }
    if (parts.length > 6) fail(invalidPathError());
    return parts;
  }

  function classify(parts) {
    if (!parts.length) fail(unsupportedError());
    var root = String(parts[0]).toLowerCase();
    failKindWord(root);
    if (CATALOG_KIND[root]) fail(storefrontError());
    if (!/^[a-z]{2}$/i.test(parts[0])) fail(unsupportedError());
    if (parts.length < 2) fail(storefrontError());
    var storefront = root;
    var kind = String(parts[1]).toLowerCase();
    failKindWord(kind);
    if (!CATALOG_KIND[kind]) fail(unsupportedError());
    var resource = parseResource(kind, parts.slice(2));
    return {
      storefront: storefront,
      kind: kind,
      slug: resource.slug,
      id: resource.id
    };
  }

  function parseResource(kind, rest) {
    if (!rest.length) fail(missingIdError());
    if (rest.length > 2) fail(invalidPathError());
    var slug = '';
    var id = rest[0];
    if (rest.length === 2) {
      slug = rest[0];
      id = rest[1];
      if (!validSlug(slug)) fail(invalidPathError());
    }
    if (kind === 'playlist') {
      if (!validPlaylistId(id)) fail(playlistIdError());
      return { slug: slug, id: id };
    }
    if (!validCatalogId(id)) fail(invalidIdError());
    return { slug: slug, id: canonicalCatalogId(id) };
  }

  function collectParams(url) {
    var params = [];
    url.searchParams.forEach(function (value, key) {
      params.push({
        lower: String(key || '').toLowerCase(),
        value: String(value == null ? '' : value)
      });
    });
    return params;
  }

  function resolveQuery(url) {
    var params = collectParams(url);
    var songId = '';
    var songCount = 0;
    var stripped = false;
    var i;
    for (i = 0; i < params.length; i++) {
      var lower = params[i].lower;
      var value = params[i].value;
      var valueLower = value.toLowerCase();
      if (lower === 'i') {
        songCount++;
        songId = value;
        continue;
      }
      if (isTrackingKey(lower)) {
        stripped = true;
        continue;
      }
      if (REDEEM_KEYS[lower] || /redeem|gift-?code|coupon|voucher/.test(valueLower)) fail(redeemError());
      if (LOGIN_KEYS[lower] || TWOFA_KIND[lower] || SHAREPLAY_KIND[lower] || isAuthKey(lower)) fail(loginError());
      if (REDIRECT_KEYS[lower] || /:\/\//.test(value) || /javascript:/i.test(value)) fail(redirectError());
      if (LIBRARY_KIND[lower] || valueLower === 'library' || valueLower === 'listen-now') fail(libraryError());
      fail(extraParamError());
    }
    if (songCount > 1) fail(extraParamError());
    if (songCount === 1 && !/^\d{6,18}$/.test(songId)) fail(invalidSongParamError());
    return { songId: songCount === 1 ? songId : '', strippedTracking: stripped };
  }

  function buildCanonical(parsed, songId) {
    var path = 'https://music.apple.com/' + parsed.storefront + '/' + parsed.kind + '/';
    if (parsed.slug) path += encodeURIComponent(parsed.slug) + '/';
    path += encodeURIComponent(parsed.id);
    if (songId) path += '?i=' + encodeURIComponent(songId);
    return path;
  }

  /**
   * @param {string} input
   * @returns {{
   *   payload: string,
   *   url: string,
   *   type: string,
   *   id: string,
   *   storefront: string,
   *   songId: string,
   *   host: string,
   *   warning: string,
   *   normalized: boolean,
   *   strippedTracking: boolean
   * }}
   */
  function normalizeAppleMusic(input) {
    var raw = cleanInput(input);
    if (!raw) fail(emptyError());
    rejectTextShape(raw);
    var url = toUrl(raw);
    rejectHost(url);
    var parsed = classify(readParts(url));
    var query = resolveQuery(url);
    var payload = buildCanonical(parsed, query.songId);
    return {
      payload: payload,
      url: payload,
      type: parsed.kind,
      id: parsed.id,
      storefront: parsed.storefront,
      songId: query.songId,
      host: 'music.apple.com',
      warning: SHARE_WARNING,
      normalized: payload !== raw,
      strippedTracking: query.strippedTracking
    };
  }

  /**
   * @param {{payload: string}} built
   */
  function assertStaticAppleMusicPayload(built) {
    var payload = built && built.payload;
    if (typeof payload !== 'string' || !payload) fail('Refusing to encode an empty payload.');
    if (!/^https:\/\/music\.apple\.com\/[a-z]{2}\/(?:song|album|playlist)\//.test(payload)) {
      fail('Refusing to encode a link that is not an HTTPS music.apple.com song, album, or playlist URL.');
    }
    if (/#|qrstatic\.app|\/\/apple\.co\b|itunes\.apple|music\.youtube|javascript:|\/\/apps\.apple/i.test(payload)) {
      fail('Refusing to encode a short link, redirect, hash, or tracking parameter. Nothing was encoded.');
    }
    if (/[?&](?:at|ct|pt|ls|app|uo|itsct|itscg|fbclid|gclid)(?:=|&|$)|[?&]utm_/i.test(payload)) {
      fail('Refusing to encode a short link, redirect, hash, or tracking parameter. Nothing was encoded.');
    }
    if (/\?/.test(payload) && !/\?i=\d{6,18}$/.test(payload)) {
      fail('Refusing to encode a link that is not a public Apple Music URL.');
    }
    var again;
    try {
      again = normalizeAppleMusic(payload);
    } catch (e) {
      fail('Refusing to encode a link that is not a public Apple Music URL.');
    }
    if (!again || again.payload !== payload) {
      fail('Refusing to encode a link that is not a public Apple Music URL.');
    }
    return built;
  }

  function buildAppleMusicPayload(input) {
    return assertStaticAppleMusicPayload(normalizeAppleMusic(input));
  }

  global.AppleMusicPayload = {
    buildAppleMusicPayload: buildAppleMusicPayload,
    assertStaticAppleMusicPayload: assertStaticAppleMusicPayload
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
