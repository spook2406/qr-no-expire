(function (global) {
  'use strict';

  /**
   * Public YouTube channel and single-video URLs only.
   * HTTPS, strip www (and the m. mobile host), strip hash, strip
   * si / feature / pp / utm* / fbclid / gclid / ab_channel.
   * No user-agent routing, no network request, no short link, no redirect unwrap.
   * A private video stays private: this does not bypass a login wall,
   * a visibility setting, or a copyright limit.
   * music.youtube.com is rejected here (a later page). Playlists are out of scope.
   */

  var LOGIN_ROOT = {
    signin: true, 'sign-in': true, login: true, 'log-in': true,
    logout: true, 'log-out': true, signup: true, 'sign-up': true,
    account: true, accounts: true, create_channel: true, get_started: true,
    reauth: true, upload: true, create: true
  };

  var PRIVATE_ROOT = {
    feed: true, history: true, library: true, subscription_manager: true,
    purchases: true, reporthistory: true, notifications: true
  };

  var TV_ROOT = {
    activate: true, pair: true, pairing: true, tv: true, device: true,
    devices: true, remote: true, link: true
  };

  var TWOFA_ROOT = {
    verify: true, verification: true, twofactor: true, 'two-factor': true,
    '2fa': true, authenticator: true, otp: true, totp: true
  };

  var MUSIC_ROOT = { music: true, youtubemusic: true };

  var REDIRECT_ROOT = {
    redirect: true, attribution_link: true, redirect_link: true
  };

  var PLAYLIST_ROOT = {
    playlist: true, playlists: true, mix: true, watch_videos: true
  };

  var MEMBER_TAB = { join: true, membership: true, sponsor: true };

  var TABS = {
    videos: true, shorts: true, streams: true, live: true, about: true,
    featured: true, community: true, posts: true, channels: true,
    releases: true, podcasts: true
  };

  var TRACKING_EXACT = {
    si: true, feature: true, pp: true, fbclid: true, gclid: true, ab_channel: true
  };

  var LOCALE_KEYS = { hl: true, gl: true, persist_hl: true };

  var TV_KEYS = {
    user_code: true, pairing_code: true, device_code: true, pair_code: true
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

  var SHARE_WARNING = 'Share only a public YouTube channel or video you have the right to share. QRStatic is not an official YouTube product. This QR does not bypass YouTube visibility, login, or copyright limits, and it does not make a private video public. If YouTube asks the visitor to sign in, the scan stops on YouTube’s side.';

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
    return 'Paste a public YouTube channel or video URL: youtube.com/@handle, youtube.com/channel/UC…, youtube.com/c/…, youtube.com/user/…, or a watch, youtu.be, or Shorts link. Nothing was encoded.';
  }

  function domainError() {
    return 'That is not a public youtube.com or youtu.be URL. Other websites are not encoded. It was not encoded.';
  }

  function shortLinkError() {
    return 'That is a short link, not a public YouTube URL. Shorteners are not followed and are not encoded. Paste the public youtube.com or youtu.be URL. It was not encoded.';
  }

  function ourShortLinkError() {
    return 'That is a short link or redirect on qrstatic.app, not a public YouTube URL. This page does not follow redirects and does not put qrstatic.app inside the QR. Paste the public youtube.com or youtu.be URL. It was not encoded.';
  }

  function musicError() {
    return 'That is a YouTube Music link. This page does not encode YouTube Music, and it does not handle YouTube Music login or redemption. Paste a public youtube.com or youtu.be URL. It was not encoded.';
  }

  function studioError() {
    return 'That is YouTube Studio, not a public channel or video. This page does not encode studio.youtube.com. It was not encoded.';
  }

  function kidsError() {
    return 'That is a YouTube Kids link, not a public youtube.com or youtu.be URL. It was not encoded.';
  }

  function otherHostError() {
    return 'That YouTube hostname is not a public channel or video host. Paste youtube.com or youtu.be. It was not encoded.';
  }

  function loginError() {
    return 'That is a YouTube login or account page, not a public channel or video. This page does not bypass a login wall. It was not encoded.';
  }

  function loginRequiredError() {
    return 'That YouTube page requires a signed-in account. This page only encodes public channel and single-video URLs, and it does not bypass a login wall. It was not encoded.';
  }

  function loginParamError() {
    return 'That YouTube link contains a login or session parameter. This page does not bypass a login wall. It was not encoded.';
  }

  function tvError() {
    return 'That is a YouTube TV or device pairing link, not a public channel or video. Pairing codes are not encoded. It was not encoded.';
  }

  function twofaError() {
    return 'That looks like a 2FA or authenticator flow, not a public YouTube URL. This page does not encode authenticator or verification codes. It was not encoded.';
  }

  function playlistError() {
    return 'That is a YouTube playlist (a list= parameter or a playlist page) and this page does not encode playlists. Paste a public channel URL, or a single video URL that includes the video id (watch?v=, youtu.be, or Shorts). It was not encoded.';
  }

  function redirectError() {
    return 'That YouTube link is a redirect. This page does not follow redirects or encode them. Paste the public youtube.com or youtu.be URL. It was not encoded.';
  }

  function notPublicError() {
    return 'That YouTube URL is not a public channel or a single watch, youtu.be, or Shorts link. It was not encoded.';
  }

  function invalidPathError() {
    return 'That YouTube path looks invalid. Copy the public channel or video URL again. It was not encoded.';
  }

  function missingChannelError() {
    return 'That YouTube URL is missing the public channel name. Paste youtube.com/@handle, youtube.com/channel/UC…, youtube.com/c/…, or youtube.com/user/…. It was not encoded.';
  }

  function handleError() {
    return 'That @handle looks invalid. YouTube handles are 3–30 characters, start with a letter, and use letters, digits, periods, underscores, or hyphens. It was not encoded.';
  }

  function channelIdError() {
    return 'That channel id looks invalid. Paste a public youtube.com/channel/UC… URL (UC plus 22 characters). It was not encoded.';
  }

  function missingVideoError() {
    return 'That watch URL is missing the video id. Paste a public youtube.com/watch?v=… link. It was not encoded.';
  }

  function videoIdError() {
    return 'That video id looks invalid. A YouTube video id is 11 letters, digits, underscores, or hyphens. Paste the public watch, youtu.be, or Shorts URL again. It was not encoded.';
  }

  function timeError() {
    return 'That time parameter (t=) looks invalid. Use a start time such as 90 or 1m30s, or remove it. It was not encoded.';
  }

  function extraParamError() {
    return 'That YouTube link has a parameter this page will not encode. Paste the public URL. Tracking parameters are removed; other parameters are not encoded.';
  }

  function schemeError() {
    return 'Use an http(s) YouTube URL. Other schemes are not encoded.';
  }

  function otherToolError() {
    return 'That is a link for another tool on this site, not a public YouTube URL. Use the matching generator. It was not encoded.';
  }

  function meetToolError() {
    return 'That is a Google Meet link, not a YouTube URL. Use the Google Meet QR generator. It was not encoded.';
  }

  function calendarToolError() {
    return 'That looks like a calendar event, not a YouTube URL. Use the Calendar Event QR generator. It was not encoded.';
  }

  function membershipError() {
    return 'That is a YouTube membership page, not the public channel URL. This page does not bypass visibility limits. It was not encoded.';
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
    return String(url.hostname || '').toLowerCase().replace(/\.+$/, '').replace(/^www\./, '');
  }

  function hostKind(host) {
    if (host === 'music.youtube.com' || host.slice(-18) === '.music.youtube.com') return 'music';
    if (host === 'studio.youtube.com' || host.slice(-19) === '.studio.youtube.com') return 'studio';
    if (host === 'tv.youtube.com' || host.slice(-15) === '.tv.youtube.com') return 'tv';
    if (host === 'kids.youtube.com' || host.slice(-17) === '.kids.youtube.com') return 'kids';
    if (host === 'consent.youtube.com' || host.slice(-20) === '.consent.youtube.com') return 'login';
    if (host === 'youtu.be') return 'short';
    if (host === 'youtube.com' || host === 'm.youtube.com') return 'main';
    if (host.length > 12 && host.slice(-12) === '.youtube.com') return 'other-yt';
    return '';
  }

  function isTrackingKey(key) {
    var k = String(key || '').toLowerCase();
    if (k.indexOf('utm_') === 0) return true;
    return Object.prototype.hasOwnProperty.call(TRACKING_EXACT, k);
  }

  function isAuthKey(key) {
    return /token|session|password|csrf|challenge|otp|auth/.test(key);
  }

  function validVideoId(id) {
    return /^[A-Za-z0-9_-]{11}$/.test(id);
  }

  function validHandle(name) {
    if (!name || name.length < 3 || name.length > 30) return false;
    if (name.charAt(0) === '.' || name.charAt(name.length - 1) === '.') return false;
    if (name.indexOf('..') !== -1) return false;
    return /^\p{L}[\p{L}\p{N}._-]*$/u.test(name);
  }

  function validSlug(name) {
    if (!name || name.length < 1 || name.length > 80) return false;
    if (name.charAt(0) === '.' || name.charAt(name.length - 1) === '.') return false;
    if (name.indexOf('..') !== -1) return false;
    return /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u.test(name);
  }

  function validTime(value) {
    if (!value || value.length > 32) return false;
    if (/^\d{1,8}$/.test(value)) return true;
    var m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
    if (!m) return false;
    return !!(m[1] || m[2] || m[3]);
  }

  function toolKindFromText(raw) {
    if (/^otpauth:/i.test(raw)) return '2fa';
    if (/BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(raw)) return 'calendar';
    if (/BEGIN:VCARD/i.test(raw)) return 'other';
    if (/^WIFI:/i.test(raw)) return 'other';
    if (/^mailto:/i.test(raw)) return 'other';
    if (/^tel:/i.test(raw)) return 'other';
    if (/^sms:/i.test(raw)) return 'other';
    if (/^geo:/i.test(raw)) return 'other';
    return '';
  }

  function failToolKind(kind) {
    if (kind === '2fa') fail(twofaError());
    if (kind === 'calendar') fail(calendarToolError());
    if (kind === 'meet') fail(meetToolError());
    if (kind === 'other') fail(otherToolError());
  }

  function toolKindFromUrl(url) {
    var host = bareHost(url);
    var path = String(url.pathname || '');
    if (host === 'meet.google.com') return 'meet';
    if (host === 'teams.microsoft.com' || host === 'teams.live.com') return 'other';
    if (host === 'zoom.us' || hostSuffix(host, 'zoom.us')) return 'other';
    if (host === 'forms.gle') return 'other';
    if (host === 'docs.google.com' && /\/forms(\/|$)/i.test(path)) return 'other';
    if (host === 'apps.apple.com' || host === 'itunes.apple.com' || host === 'play.google.com') return 'other';
    if (host === 'open.spotify.com' || host === 'spotify.link' || hostSuffix(host, 'spotify.com')) return 'other';
    if (host === 't.me' || host === 'telegram.me' || hostSuffix(host, 'telegram.org')) return 'other';
    if (host === 'discord.gg' || host === 'discord.com') return 'other';
    if (host === 'wa.me' || host === 'chat.whatsapp.com' || host === 'api.whatsapp.com') return 'other';
    if (host === 'calendly.com' || hostSuffix(host, 'calendly.com')) return 'other';
    if (host === 'linkedin.com' || hostSuffix(host, 'linkedin.com')) return 'other';
    if (host === 'maps.google.com' || (host === 'google.com' && /^\/maps(\/|$)/i.test(path))) return 'other';
    return '';
  }

  function toUrl(raw) {
    var kind = toolKindFromText(raw);
    if (kind) failToolKind(kind);
    if (/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(raw)) fail(tvError());
    if (/\s/.test(raw)) {
      fail('That link contains a space. Paste one YouTube URL with no extra text. It was not encoded.');
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
      fail('That does not look like a valid YouTube URL. Paste a public youtube.com or youtu.be link. It was not encoded.');
    }
    if (url.username || url.password) {
      fail('Paste the YouTube link without a username or password in the URL. It was not encoded.');
    }
    var protocol = String(url.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') fail(schemeError());
    if (url.port && url.port !== '443' && url.port !== '80') {
      fail('That link uses an unexpected port. Paste the normal https://youtube.com or https://youtu.be URL. It was not encoded.');
    }
    return url;
  }

  function rejectHost(url) {
    var host = bareHost(url);
    var kind = hostKind(host);
    if (kind === 'music') fail(musicError());
    if (kind === 'studio') fail(studioError());
    if (kind === 'tv') fail(tvError());
    if (kind === 'kids') fail(kidsError());
    if (kind === 'login') fail(loginError());
    if (kind === 'short' || kind === 'main') return kind;
    if (kind === 'other-yt') fail(otherHostError());
    if (hostSuffix(host, 'qrstatic.app')) fail(ourShortLinkError());
    if (matchesList(host, SHORT_SUFFIXES)) fail(shortLinkError());
    if (host === 'accounts.google.com' || host === 'myaccount.google.com' || hostSuffix(host, 'accounts.google.com')) {
      fail(loginError());
    }
    var tool = toolKindFromUrl(url);
    if (tool) failToolKind(tool);
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
    if (parts.length > 4) fail(invalidPathError());
    return parts;
  }

  function encodeSegment(seg) {
    if (seg.charAt(0) === '@') return '@' + encodeURIComponent(seg.slice(1));
    return encodeURIComponent(seg);
  }

  function querySuffix(t) {
    if (!t) return '';
    return '?t=' + encodeURIComponent(t);
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

  function resolveQuery(url, mode) {
    var params = collectParams(url);
    var sawList = false;
    var playlistNoise = false;
    var vCount = 0;
    var watchV = '';
    var t = '';
    var tCount = 0;
    var i;
    for (i = 0; i < params.length; i++) {
      if (params[i].lower === 'list') sawList = true;
      if (params[i].lower === 'index' || params[i].lower === 'start_radio') playlistNoise = true;
      if (mode === 'watch' && params[i].lower === 'v') {
        vCount++;
        if (params[i].value) watchV = params[i].value;
      }
    }
    var pathVideo = mode === 'short';
    var watchOk = mode === 'watch' && vCount === 1 && validVideoId(watchV);
    if ((sawList || playlistNoise) && !pathVideo && !watchOk) fail(playlistError());
    if (mode === 'watch' && vCount > 1) fail(extraParamError());
    if (mode === 'watch' && (vCount !== 1 || !watchV)) fail(missingVideoError());
    if (mode === 'watch' && !validVideoId(watchV)) fail(videoIdError());

    for (i = 0; i < params.length; i++) {
      var lower = params[i].lower;
      var value = params[i].value;
      if (isTrackingKey(lower) || LOCALE_KEYS[lower]) continue;
      if (lower === 'list' || lower === 'index' || lower === 'start_radio') continue;
      if (REDIRECT_KEYS[lower] || /:\/\//.test(value) || /javascript:/i.test(value)) fail(redirectError());
      if (TV_KEYS[lower]) fail(tvError());
      if (isAuthKey(lower)) fail(loginParamError());
      if (mode === 'watch' && lower === 'v') continue;
      if ((mode === 'watch' || mode === 'short') && lower === 't') {
        tCount++;
        t = value;
        continue;
      }
      fail(extraParamError());
    }
    if (tCount > 1) fail(extraParamError());
    if (tCount === 1 && !validTime(t)) fail(timeError());
    return { v: watchV, t: tCount === 1 ? t : '' };
  }

  function applyTab(segments, tab) {
    var lower = String(tab || '').toLowerCase();
    if (lower === 'playlist' || lower === 'playlists') fail(playlistError());
    if (MEMBER_TAB[lower]) fail(membershipError());
    if (!TABS[lower]) fail(notPublicError());
    segments.push(lower);
    return segments;
  }

  function classifyChannel(parts) {
    var root = parts[0];
    var rootLower = String(root).toLowerCase();
    if (root.charAt(0) === '@') {
      if (parts.length > 2) fail(invalidPathError());
      if (!validHandle(root.slice(1))) fail(handleError());
      var handleSegments = [root];
      if (parts.length === 2) applyTab(handleSegments, parts[1]);
      return { mode: 'channel', type: 'channel-handle', segments: handleSegments };
    }
    if (rootLower !== 'channel' && rootLower !== 'c' && rootLower !== 'user') fail(notPublicError());
    if (parts.length < 2) fail(missingChannelError());
    if (parts.length > 3) fail(invalidPathError());
    var slug = parts[1];
    if (rootLower === 'channel') {
      if (!/^UC[A-Za-z0-9_-]{22}$/.test(slug)) fail(channelIdError());
    } else if (!validSlug(slug)) {
      fail(invalidPathError());
    }
    var segments = [rootLower, slug];
    if (parts.length === 3) applyTab(segments, parts[2]);
    var type = rootLower === 'channel' ? 'channel-id' : (rootLower === 'c' ? 'channel-custom' : 'channel-user');
    return { mode: 'channel', type: type, segments: segments };
  }

  function classifyMain(parts) {
    if (!parts.length) fail(notPublicError());
    var root = parts[0];
    var rootLower = String(root).toLowerCase();
    if (LOGIN_ROOT[rootLower] || rootLower.indexOf('account_') === 0) fail(loginError());
    if (PRIVATE_ROOT[rootLower]) fail(loginRequiredError());
    if (TV_ROOT[rootLower]) fail(tvError());
    if (TWOFA_ROOT[rootLower]) fail(twofaError());
    if (MUSIC_ROOT[rootLower]) fail(musicError());
    if (REDIRECT_ROOT[rootLower]) fail(redirectError());
    if (PLAYLIST_ROOT[rootLower]) fail(playlistError());
    if (root.charAt(0) === '@' || rootLower === 'channel' || rootLower === 'c' || rootLower === 'user') {
      return classifyChannel(parts);
    }
    if (rootLower === 'shorts') {
      if (parts.length !== 2) fail(notPublicError());
      if (!validVideoId(parts[1])) fail(videoIdError());
      return { mode: 'short', type: 'shorts', id: parts[1] };
    }
    if (rootLower === 'watch') {
      if (parts.length !== 1) fail(invalidPathError());
      return { mode: 'watch', type: 'video' };
    }
    fail(notPublicError());
  }

  function classifyShortHost(parts, url) {
    if (parts.length !== 1) fail(invalidPathError());
    if (!validVideoId(parts[0])) {
      var params = collectParams(url);
      var i;
      for (i = 0; i < params.length; i++) {
        if (params[i].lower === 'list') fail(playlistError());
      }
      fail(videoIdError());
    }
    return { mode: 'short', type: 'youtu.be', id: parts[0] };
  }

  function payloadFor(classified, query) {
    if (classified.mode === 'channel') {
      return 'https://youtube.com/' + classified.segments.map(encodeSegment).join('/');
    }
    if (classified.type === 'youtu.be') {
      return 'https://youtu.be/' + encodeURIComponent(classified.id) + querySuffix(query.t);
    }
    if (classified.type === 'shorts') {
      return 'https://youtube.com/shorts/' + encodeURIComponent(classified.id) + querySuffix(query.t);
    }
    var watch = 'https://youtube.com/watch?v=' + encodeURIComponent(query.v);
    if (query.t) watch += '&t=' + encodeURIComponent(query.t);
    return watch;
  }

  /**
   * @param {string} input
   * @returns {{
   *   payload: string,
   *   url: string,
   *   type: string,
   *   host: string,
   *   warning: string,
   *   normalized: boolean
   * }}
   */
  function normalizeYouTube(input) {
    var raw = cleanInput(input);
    if (!raw) fail(emptyError());
    var url = toUrl(raw);
    var kind = rejectHost(url);
    var parts = readParts(url);
    var classified = kind === 'short' ? classifyShortHost(parts, url) : classifyMain(parts);
    var query = resolveQuery(url, classified.mode);
    var payload = payloadFor(classified, query);
    return {
      payload: payload,
      url: payload,
      type: classified.type,
      host: classified.type === 'youtu.be' ? 'youtu.be' : 'youtube.com',
      warning: SHARE_WARNING,
      normalized: payload !== raw
    };
  }

  /**
   * @param {{payload: string}} built
   */
  function assertStaticYouTubePayload(built) {
    var payload = built && built.payload;
    if (typeof payload !== 'string' || !payload) fail('Refusing to encode an empty payload.');
    if (!/^https:\/\/(youtube\.com\/|youtu\.be\/)/.test(payload)) {
      fail('Refusing to encode a link that is not an HTTPS youtube.com or youtu.be URL.');
    }
    if (/#|qrstatic\.app|music\.youtube|studio\.youtube|bit\.ly|javascript:/i.test(payload)) {
      fail('Refusing to encode a short link, redirect, hash, or tracking parameter. Nothing was encoded.');
    }
    if (/[?&](?:si|feature|pp|fbclid|gclid|ab_channel|list|index)(?:=|&|$)|[?&]utm_/i.test(payload)) {
      fail('Refusing to encode a short link, redirect, hash, or tracking parameter. Nothing was encoded.');
    }
    var again;
    try {
      again = normalizeYouTube(payload);
    } catch (e) {
      fail('Refusing to encode a link that is not a public YouTube URL.');
    }
    if (!again || again.payload !== payload) {
      fail('Refusing to encode a link that is not a public YouTube URL.');
    }
    return built;
  }

  function buildYouTubePayload(input) {
    return assertStaticYouTubePayload(normalizeYouTube(input));
  }

  global.YouTubePayload = {
    buildYouTubePayload: buildYouTubePayload,
    assertStaticYouTubePayload: assertStaticYouTubePayload
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
