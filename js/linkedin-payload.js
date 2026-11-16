(function (global) {
  'use strict';

  /**
   * Public LinkedIn profile, company, and school URLs only.
   * HTTPS, strip www, canonicalize a single-label subdomain (uk.linkedin.com)
   * to linkedin.com, strip hash, strip tracking params.
   * No user-agent routing, no network request, no short link, no redirect unwrap.
   * A private page stays private: this does not bypass a login wall.
   */

  var LOGIN = {
    login: true, 'log-in': true, signin: true, 'sign-in': true,
    signup: true, 'sign-up': true, register: true, registration: true,
    authwall: true, checkpoint: true, authenticate: true, auth: true,
    oauth: true, uas: true, challenge: true, challenges: true,
    challengesv2: true, logout: true, 'log-out': true, 'cold-join': true,
    reg: true
  };

  var SHARE = {
    share: true, sharing: true, sharearticle: true, 'share-article': true,
    'share-offsite': true, shareoffsite: true
  };

  var PRIVATE = {
    admin: true, mycompany: true, analytics: true, inbox: true,
    settings: true, edit: true, overlay: true, messaging: true,
    notifications: true
  };

  var TRACKING_EXACT = {
    fbclid: true, gclid: true, gbraid: true, wbraid: true, dclid: true,
    msclkid: true, twclid: true, ttclid: true, igshid: true, mc_cid: true,
    mc_eid: true, _ga: true, _gl: true, gad_source: true, gad_campaignid: true,
    gclsrc: true, yclid: true, srsltid: true, mkt_tok: true,
    trk: true, trkinfo: true, lipi: true, originalsubdomain: true,
    original_referer: true, trackingid: true, refid: true, veh: true,
    _hsenc: true, _hsmi: true
  };

  var REDIRECT_KEYS = {
    session_redirect: true, sessionredirect: true, redirect: true, url: true,
    dest: true, destination: true, target: true, next: true, goto: true,
    redir: true, redirecturl: true, redirect_uri: true, return: true,
    returnurl: true, return_url: true
  };

  var SHORT_SUFFIXES = [
    'lnkd.in', 'bit.ly', 'bitly.com', 'tinyurl.com', 'tiny.cc', 't.co', 'goo.gl',
    'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'rb.gy', 't.ly',
    'short.io', 'lnk.to', 'ffm.to', 'smarturl.it', 'linktr.ee', 'bio.link',
    'onelink.me', 'app.link', 'branch.io', 'bnc.lt', 'qrco.de', 'flowcode.com',
    'bit.do', 'tiny.one', 'dub.sh', 'smart.link', 'cal.ly'
  ];

  var SHARE_WARNING = 'Share only a public LinkedIn profile, company, or school page you have the right to share. QRStatic is not an official LinkedIn product. This QR does not bypass LinkedIn visibility or login restrictions, and it does not make a private profile public. If LinkedIn asks the visitor to sign in, the scan stops on LinkedIn’s side.';

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
    return 'Paste a public LinkedIn URL: linkedin.com/in/…, linkedin.com/company/…, or linkedin.com/school/…. Nothing was encoded.';
  }

  function domainError() {
    return 'That is not a linkedin.com profile, company, or school page. Other websites are not encoded. It was not encoded.';
  }

  function shortLinkError() {
    return 'That is a short link, not a public LinkedIn URL. lnkd.in and other shorteners are not followed and are not encoded. Paste the public linkedin.com/in, /company, or /school URL. It was not encoded.';
  }

  function ourShortLinkError() {
    return 'That is a short link or redirect on qrstatic.app, not a public LinkedIn URL. This page does not follow redirects and does not put qrstatic.app inside the QR. Paste the public linkedin.com URL. It was not encoded.';
  }

  function nestedHostError() {
    return 'That LinkedIn hostname has more than one subdomain label. Paste linkedin.com or a country host such as uk.linkedin.com. It was not encoded.';
  }

  function loginError() {
    return 'That is a LinkedIn login, signup, authwall, or checkpoint page, not a public profile. This page does not bypass a login wall. Paste a public linkedin.com/in, /company, or /school URL. It was not encoded.';
  }

  function shareError() {
    return 'That is a LinkedIn share interstitial (share, sharing, share-offsite, or shareArticle), not a public profile, company, or school page. Paste the public URL itself. It was not encoded.';
  }

  function redirectError() {
    return 'That LinkedIn link is a redirect. This page does not follow redirects or encode them. Paste the public linkedin.com URL. It was not encoded.';
  }

  function notPublicError() {
    return 'That LinkedIn URL is not a public profile, company, or school page. Paste linkedin.com/in/…, linkedin.com/company/…, or linkedin.com/school/…. It was not encoded.';
  }

  function privateError() {
    return 'That LinkedIn URL is an admin, edit, or overlay page, not the public profile, company, or school page. Paste the public URL. It was not encoded.';
  }

  function missingSlugError() {
    return 'That LinkedIn URL is missing the public name. Paste linkedin.com/in/your-name, linkedin.com/company/your-company, or linkedin.com/school/your-school. It was not encoded.';
  }

  function invalidPathError() {
    return 'That LinkedIn path looks invalid. Copy the public profile, company, or school URL again. It was not encoded.';
  }

  function extraParamError() {
    return 'That LinkedIn link has a parameter this page will not encode. Paste the public URL. Tracking parameters are removed; other parameters are not encoded.';
  }

  function loginParamError() {
    return 'That LinkedIn link contains a login or session parameter. This page does not bypass a login wall. It was not encoded.';
  }

  function schemeError() {
    return 'Use an http(s) LinkedIn URL. Other schemes are not encoded.';
  }

  function otherToolError() {
    return 'That is a link for another tool on this site, not a public LinkedIn page. Use the matching generator. It was not encoded.';
  }

  function meetToolError() {
    return 'That is a Google Meet link, not a LinkedIn URL. Use the Google Meet QR generator. It was not encoded.';
  }

  function calendarToolError() {
    return 'That looks like a calendar event, not a LinkedIn URL. Use the Calendar Event QR generator. It was not encoded.';
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

  function isTrackingKey(key) {
    var k = String(key || '').toLowerCase();
    if (k.indexOf('utm_') === 0) return true;
    return Object.prototype.hasOwnProperty.call(TRACKING_EXACT, k);
  }

  function isAuthKey(key) {
    var k = String(key || '').toLowerCase();
    return /token|session|password|csrf|challenge/.test(k);
  }

  function toolKindFromText(raw) {
    if (/BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(raw)) return 'calendar';
    if (/BEGIN:VCARD/i.test(raw)) return 'other';
    if (/^WIFI:/i.test(raw)) return 'other';
    if (/^otpauth:/i.test(raw)) return 'other';
    if (/^mailto:/i.test(raw)) return 'other';
    if (/^tel:/i.test(raw)) return 'other';
    if (/^sms:/i.test(raw)) return 'other';
    if (/^geo:/i.test(raw)) return 'other';
    return '';
  }

  function failToolKind(kind) {
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
    if (host === 'maps.google.com' || (host === 'google.com' && /^\/maps(\/|$)/i.test(path))) return 'other';
    return '';
  }

  function linkedinHostKind(host) {
    if (host === 'linkedin.com') return 'apex';
    if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.linkedin\.com$/.test(host)) return 'single';
    if (host.length > 13 && host.slice(-13) === '.linkedin.com') return 'nested';
    return '';
  }

  function toUrl(raw) {
    var kind = toolKindFromText(raw);
    if (kind) failToolKind(kind);
    if (/\s/.test(raw)) {
      fail('That link contains a space. Paste one LinkedIn URL with no extra text. It was not encoded.');
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
      fail('That does not look like a valid LinkedIn URL. Paste https://linkedin.com/in/your-name or a company or school page. It was not encoded.');
    }
    if (url.username || url.password) {
      fail('Paste the LinkedIn link without a username or password in the URL. It was not encoded.');
    }
    var protocol = String(url.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') fail(schemeError());
    if (url.port && url.port !== '443' && url.port !== '80') {
      fail('That link uses an unexpected port. Paste the normal https://linkedin.com URL. It was not encoded.');
    }
    return url;
  }

  function rejectHost(url) {
    var host = bareHost(url);
    var kind = linkedinHostKind(host);
    if (kind === 'apex' || kind === 'single') return;
    if (kind === 'nested') fail(nestedHostError());
    if (hostSuffix(host, 'qrstatic.app')) fail(ourShortLinkError());
    if (matchesList(host, SHORT_SUFFIXES)) fail(shortLinkError());
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
    if (parts.length > 8) fail(invalidPathError());
    return parts;
  }

  function validSegment(seg) {
    return !!seg && seg.length <= 128 && /^[\p{L}\p{N}._~-]+$/u.test(seg);
  }

  function isPublicRoot(seg) {
    return seg === 'in' || seg === 'company' || seg === 'school';
  }

  function classify(parts) {
    var lower = parts.map(function (p) { return String(p).toLowerCase(); });
    var root = lower[0] || '';
    var slugIndex = isPublicRoot(root) ? 1 : -1;
    var i;
    for (i = 0; i < lower.length; i++) {
      if (i === slugIndex) continue;
      if (SHARE[lower[i]]) return 'share';
    }
    for (i = 0; i < lower.length; i++) {
      if (i === slugIndex) continue;
      if (LOGIN[lower[i]]) return 'login';
    }
    if (lower[0] === 'start' && lower[1] === 'join') return 'login';
    if (lower[0] === 'redir' || lower[0] === 'redirect' || lower[0] === 'redirection') return 'redirect';
    if (lower[0] === 'safety' && lower[1] === 'go') return 'redirect';
    if (!isPublicRoot(root)) return 'not-public';
    if (parts.length < 2) return 'missing-slug';
    for (i = 2; i < lower.length; i++) {
      if (PRIVATE[lower[i]]) return 'private';
    }
    return 'ok';
  }

  function failClass(kind) {
    if (kind === 'share') fail(shareError());
    if (kind === 'login') fail(loginError());
    if (kind === 'redirect') fail(redirectError());
    if (kind === 'not-public') fail(notPublicError());
    if (kind === 'missing-slug') fail(missingSlugError());
    if (kind === 'private') fail(privateError());
  }

  function assertSegments(parts) {
    var i;
    for (i = 0; i < parts.length; i++) {
      if (!validSegment(parts[i])) fail(invalidPathError());
    }
  }

  function applyQuery(url) {
    var keys = [];
    url.searchParams.forEach(function (_value, key) { keys.push(key); });
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var lower = String(key || '').toLowerCase();
      var values = url.searchParams.getAll(key);
      if (isTrackingKey(lower)) {
        url.searchParams.delete(key);
        continue;
      }
      if (values.length !== 1) fail(extraParamError());
      var value = String(values[0] == null ? '' : values[0]);
      if (REDIRECT_KEYS[lower] || /:\/\//.test(value) || /javascript:/i.test(value)) fail(redirectError());
      if (isAuthKey(lower)) fail(loginParamError());
      fail(extraParamError());
    }
  }

  function pageType(root) {
    if (root === 'in') return 'profile';
    if (root === 'company') return 'company';
    return 'school';
  }

  /**
   * @param {{payload: string}} built
   */
  function assertStaticLinkedInPayload(built) {
    var payload = built && built.payload;
    if (typeof payload !== 'string' || !payload) fail('Refusing to encode an empty payload.');
    if (!/^https:\/\/linkedin\.com\/(in|company|school)\//.test(payload)) {
      fail('Refusing to encode a link that is not an HTTPS linkedin.com profile, company, or school URL.');
    }
    if (/[?#]/.test(payload) || /lnkd\.in|qrstatic\.app|bit\.ly|tinyurl|javascript:/i.test(payload)) {
      fail('Refusing to encode a short link, redirect, hash, or tracking parameter. Nothing was encoded.');
    }
    var path = payload.slice('https://linkedin.com'.length);
    var pieces = path.split('/').filter(function (p) { return p.length > 0; });
    var decoded;
    try {
      decoded = pieces.map(function (p) { return decodeURIComponent(p); });
    } catch (e) {
      fail('Refusing to encode a link that is not a public LinkedIn URL.');
    }
    if (classify(decoded) !== 'ok') fail('Refusing to encode a link that is not a public LinkedIn URL.');
    if (!decoded.every(validSegment)) fail('Refusing to encode a link that is not a public LinkedIn URL.');
    var again = 'https://linkedin.com/' + decoded.map(encodeURIComponent).join('/');
    if (again !== payload) fail('Refusing to encode a link that is not a public LinkedIn URL.');
    return built;
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
  function buildLinkedInPayload(input) {
    var raw = cleanInput(input);
    if (!raw) fail(emptyError());
    var url = toUrl(raw);
    rejectHost(url);
    var parts = readParts(url);
    var kind = classify(parts);
    if (kind !== 'ok') failClass(kind);
    parts[0] = String(parts[0]).toLowerCase();
    assertSegments(parts);
    applyQuery(url);
    if (url.search) fail(extraParamError());
    var payload = 'https://linkedin.com/' + parts.map(encodeURIComponent).join('/');
    var result = {
      payload: payload,
      url: payload,
      type: pageType(String(parts[0]).toLowerCase()),
      host: 'linkedin.com',
      warning: SHARE_WARNING,
      normalized: payload !== raw
    };
    return assertStaticLinkedInPayload(result);
  }

  global.LinkedInPayload = {
    buildLinkedInPayload: buildLinkedInPayload,
    assertStaticLinkedInPayload: assertStaticLinkedInPayload
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
