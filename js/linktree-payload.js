(function (global) {
  'use strict';

  /**
   * Public Linktree homepage URLs only: linktr.ee/{username} and
   * linktr.biz/{username}. HTTPS, strip one www label on those two hosts,
   * keep the pasted host (.ee stays .ee, .biz stays .biz), keep the
   * username path segment exactly as pasted, drop the hash, drop a
   * trailing slash, and strip tracking and affiliate parameters.
   * The QR holds that URL directly.
   * No user-agent routing, no network request, no short link, no redirect
   * unwrap, no signup, and no affiliate or campaign parameter added.
   * Login, admin, help, marketing, linktree.com, other hosts, custom
   * domains, short links, and unknown unique URLs stay out of the code.
   * This does not bypass a login wall or open non-public content.
   */

  var LOGIN = {
    login: true, 'log-in': true, logout: true, 'log-out': true,
    register: true, signup: true, 'sign-up': true, signin: true, 'sign-in': true,
    forgot: true, 'forgot-password': true, forgotpassword: true, forgot_password: true,
    'reset-password': true, resetpassword: true, reset_password: true,
    'password-reset': true, auth: true
  };

  var ADMIN = {
    admin: true, account: true, settings: true, insights: true, billing: true,
    upgrade: true, subscribe: true
  };

  var MARKETING = {
    help: true, blog: true, pricing: true, about: true, legal: true,
    privacy: true, terms: true, explore: true, discover: true, jobs: true,
    api: true, shop: true, store: true, cards: true, invite: true, connect: true
  };

  var TRACKING_EXACT = {
    fbclid: true, gclid: true, gbraid: true, wbraid: true, dclid: true,
    msclkid: true, twclid: true, ttclid: true, igshid: true, igsh: true,
    mc_cid: true, mc_eid: true, _ga: true, _gl: true, gad_source: true,
    gad_campaignid: true, gclsrc: true, yclid: true, srsltid: true,
    mkt_tok: true, _hsenc: true, _hsmi: true, fb_action_ids: true,
    fb_action_types: true, fb_source: true, fb_ref: true, ref: true,
    ref_src: true, ref_url: true, si: true, source: true, src: true,
    campaign: true, affiliate: true, affiliates: true, cid: true,
    irclickid: true, irgwc: true, clickid: true, click_id: true,
    partner: true, partnerid: true
  };

  var REDIRECT_KEYS = {
    session_redirect: true, sessionredirect: true, redirect: true, url: true,
    dest: true, destination: true, target: true, next: true, goto: true,
    redir: true, redirecturl: true, redirect_uri: true, 'return': true,
    returnurl: true, return_url: true, q: true, u: true, continue: true
  };

  var BIO_SUFFIXES = [
    'beacons.ai', 'beacons.page', 'later.com', 'linkin.bio', 'lnk.bio',
    'bio.link', 'campsite.bio', 'taplink.cc', 'tap.bio', 'hoo.be', 'solo.to',
    'allmylinks.com', 'carrd.co', 'linkpop.com', 'stan.store', 'msha.ke',
    'bento.me', 'bio.site', 'withkoji.com', 'komi.io', 'snipfeed.co',
    'pillar.io', 'direct.me'
  ];

  var SHORT_SUFFIXES = [
    'bit.ly', 'bitly.com', 'tinyurl.com', 'tiny.cc', 't.co', 'goo.gl',
    'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'rb.gy', 't.ly',
    'short.io', 'lnk.to', 'ffm.to', 'smarturl.it', 'tr.ee',
    'onelink.me', 'app.link', 'branch.io', 'bnc.lt', 'qrco.de', 'flowcode.com',
    'bit.do', 'tiny.one', 'dub.sh', 'smart.link', 'lnkd.in'
  ];

  var SHARE_WARNING = 'Share only a public Linktree homepage you have the right to share. QRStatic is not an official Linktree product. This QR does not bypass a login wall or non-public content. If you change the username, delete the public page, or the link no longer opens for the public, a code that was already printed can stop opening that page and must be remade from the current public homepage link. This page does not assume an old username redirects to a new one.';

  function fail(message) {
    throw new Error(message);
  }

  function has(map, key) {
    return Object.prototype.hasOwnProperty.call(map, key);
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
    return 'Paste a public Linktree homepage URL: linktr.ee/yourusername or linktr.biz/yourusername. Nothing was encoded.';
  }

  function domainError() {
    return 'That is not a public linktr.ee or linktr.biz homepage. Other websites and custom domains are not checked and are not encoded. It was not encoded.';
  }

  function shortLinkError() {
    return 'That is a short link or an unknown unique URL. This page does not follow it and does not encode it. Paste the public linktr.ee or linktr.biz homepage. It was not encoded.';
  }

  function ourShortLinkError() {
    return 'That is a short link or redirect on qrstatic.app, not a public Linktree homepage. This page does not follow redirects and does not put qrstatic.app inside the QR. Paste the public linktr.ee or linktr.biz homepage. It was not encoded.';
  }

  function subdomainError() {
    return 'That host is not a public Linktree homepage host. This page only accepts linktr.ee and linktr.biz. Hosts such as cards.linktr.ee, ciam.linktr.ee, and ugc.production.linktr.ee are not encoded. It was not encoded.';
  }

  function linktreeComError() {
    return 'That is linktree.com, not a public user homepage. This page does not encode linktree.com. It was not encoded.';
  }

  function bioError() {
    return 'That is another link-in-bio tool, not a public Linktree homepage. Beacons, Later, and similar tools are not encoded. It was not encoded.';
  }

  function loginError() {
    return 'That is a Linktree login, register, logout, or forgot-password page, not a public homepage. This page does not bypass a login wall. It was not encoded.';
  }

  function adminError() {
    return 'That is a Linktree Admin, Account, Settings, Insights, Billing, upgrade, or subscribe page, not a public homepage. It was not encoded.';
  }

  function marketingError() {
    return 'That is a Linktree help or marketing page, not a public homepage. It was not encoded.';
  }

  function multiError() {
    return 'That Linktree URL has more than one path segment. This page only accepts a public homepage shaped as {host}/{username}. It was not encoded.';
  }

  function missingError() {
    return 'That Linktree URL is missing the username. Paste a public homepage such as linktr.ee/yourusername or linktr.biz/yourusername. It was not encoded.';
  }

  function invalidPathError() {
    return 'That Linktree path looks invalid. Copy the public homepage URL again. It was not encoded.';
  }

  function extraParamError() {
    return 'That Linktree link has a parameter this page will not encode. Paste the public homepage URL. Tracking and affiliate parameters are removed; other parameters are not encoded. It was not encoded.';
  }

  function redirectError() {
    return 'That link is a redirect. This page does not follow redirects or encode them. Paste the public homepage URL. It was not encoded.';
  }

  function loginParamError() {
    return 'That Linktree link contains a login or session parameter. This page does not bypass a login wall. It was not encoded.';
  }

  function schemeError() {
    return 'Use an http(s) Linktree URL. Other schemes are not encoded.';
  }

  function otherToolError() {
    return 'That is a link for another tool on this site, not a public Linktree homepage. Use the matching generator. It was not encoded.';
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

  function isOfficialSubdomain(host) {
    return (host.length > 10 && host.slice(-10) === '.linktr.ee') ||
      (host.length > 11 && host.slice(-11) === '.linktr.biz');
  }

  function isLinktreeCom(host) {
    return host === 'linktree.com' || (host.length > 13 && host.slice(-13) === '.linktree.com');
  }

  function isTrackingKey(key) {
    var k = String(key || '').toLowerCase();
    if (k.indexOf('utm_') === 0 || k === 'utm') return true;
    return has(TRACKING_EXACT, k);
  }

  function isAuthKey(key) {
    return /token|session|password|csrf|challenge|otp|auth/.test(key);
  }

  function toolKindFromText(raw) {
    if (/^otpauth:/i.test(raw)) return 'other';
    if (/BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(raw)) return 'other';
    if (/BEGIN:VCARD/i.test(raw)) return 'other';
    if (/^WIFI:/i.test(raw)) return 'other';
    if (/^mailto:/i.test(raw)) return 'other';
    if (/^tel:/i.test(raw)) return 'other';
    if (/^sms:/i.test(raw)) return 'other';
    if (/^geo:/i.test(raw)) return 'other';
    return '';
  }

  function toolKindFromUrl(url) {
    var host = bareHost(url);
    var path = String(url.pathname || '');
    if (host === 'meet.google.com') return 'other';
    if (host === 'teams.microsoft.com' || host === 'teams.live.com') return 'other';
    if (host === 'zoom.us' || hostSuffix(host, 'zoom.us')) return 'other';
    if (host === 'forms.gle') return 'other';
    if (host === 'docs.google.com' && /\/forms(\/|$)/i.test(path)) return 'other';
    if (host === 'apps.apple.com' || host === 'itunes.apple.com' || host === 'play.google.com') return 'other';
    if (host === 'music.apple.com' || hostSuffix(host, 'music.apple.com')) return 'other';
    if (host === 'open.spotify.com' || host === 'spotify.link' || host === 'spotify.com' || hostSuffix(host, 'spotify.com')) return 'other';
    if (host === 't.me' || host === 'telegram.me' || hostSuffix(host, 'telegram.org')) return 'other';
    if (host === 'discord.gg' || host === 'discord.com') return 'other';
    if (host === 'wa.me' || host === 'chat.whatsapp.com' || host === 'api.whatsapp.com' || host === 'whatsapp.com') return 'other';
    if (host === 'calendly.com' || hostSuffix(host, 'calendly.com')) return 'other';
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com' || hostSuffix(host, 'youtube.com')) return 'other';
    if (host === 'linkedin.com' || hostSuffix(host, 'linkedin.com')) return 'other';
    if (host === 'maps.google.com' || (host === 'google.com' && /^\/maps(\/|$)/i.test(path))) return 'other';
    return '';
  }

  function toUrl(raw) {
    if (/\s/.test(raw)) {
      fail('That link contains a space. Paste one Linktree URL with no extra text. It was not encoded.');
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
      fail('That does not look like a valid Linktree URL. Paste a public linktr.ee/yourusername or linktr.biz/yourusername link. It was not encoded.');
    }
    if (url.username || url.password) {
      fail('Paste the Linktree link without a username or password in the URL. It was not encoded.');
    }
    var protocol = String(url.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') fail(schemeError());
    if (url.port && url.port !== '443' && url.port !== '80') {
      fail('That link uses an unexpected port. Paste the normal https://linktr.ee or https://linktr.biz URL. It was not encoded.');
    }
    return url;
  }

  function rejectHost(url) {
    var host = bareHost(url);
    if (host === 'linktr.ee' || host === 'linktr.biz') return host;
    if (isOfficialSubdomain(host)) fail(subdomainError());
    if (isLinktreeCom(host)) fail(linktreeComError());
    if (matchesList(host, BIO_SUFFIXES)) fail(bioError());
    if (hostSuffix(host, 'qrstatic.app')) fail(ourShortLinkError());
    if (matchesList(host, SHORT_SUFFIXES)) fail(shortLinkError());
    if (toolKindFromUrl(url)) fail(otherToolError());
    fail(domainError());
  }

  function readParts(url) {
    var path = String(url.pathname || '/');
    if (/%2f|%5c/i.test(path)) fail(invalidPathError());
    var trimmed = path.replace(/\/+$/, '');
    if (/\/{2,}/.test(trimmed)) fail(invalidPathError());
    if (!trimmed) return [];
    var parts = trimmed.split('/').filter(function (p) { return p.length > 0; });
    try {
      parts = parts.map(function (p) { return decodeURIComponent(p); });
    } catch (e) {
      fail(invalidPathError());
    }
    if (parts.some(function (p) { return /[\/\\?#]/.test(p) || p === '.' || p === '..' || /\s/.test(p); })) {
      fail(invalidPathError());
    }
    return parts;
  }

  function validUsername(seg) {
    if (!seg || seg.length > 128) return false;
    if (seg === '.' || seg === '..') return false;
    if (/[\/\\?#\s]/.test(seg)) return false;
    return /^[\p{L}\p{N}._-]+$/u.test(seg);
  }

  function classify(parts) {
    if (!parts.length) return 'missing';
    var root = String(parts[0]).toLowerCase();
    if (has(LOGIN, root)) return 'login';
    if (has(ADMIN, root)) return 'admin';
    if (has(MARKETING, root)) return 'marketing';
    if (parts.length > 1) return 'multi';
    return 'ok';
  }

  function failClass(kind) {
    if (kind === 'login') fail(loginError());
    if (kind === 'admin') fail(adminError());
    if (kind === 'marketing') fail(marketingError());
    if (kind === 'multi') fail(multiError());
    if (kind === 'missing') fail(missingError());
  }

  function applyQuery(url) {
    var keys = [];
    var stripped = false;
    url.searchParams.forEach(function (_value, key) { keys.push(key); });
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var lower = String(key || '').toLowerCase();
      var values = url.searchParams.getAll(key);
      if (isTrackingKey(lower)) {
        url.searchParams.delete(key);
        stripped = true;
        continue;
      }
      if (values.length !== 1) fail(extraParamError());
      var value = String(values[0] == null ? '' : values[0]);
      if (has(REDIRECT_KEYS, lower) || /:\/\//.test(value) || /javascript:/i.test(value)) fail(redirectError());
      if (isAuthKey(lower) || has(LOGIN, lower)) fail(loginParamError());
      fail(extraParamError());
    }
    return stripped;
  }

  /**
   * @param {string} input
   * @returns {{
   *   payload: string,
   *   url: string,
   *   type: string,
   *   username: string,
   *   host: string,
   *   warning: string,
   *   normalized: boolean,
   *   strippedTracking: boolean
   * }}
   */
  function normalizeLinktree(input) {
    var raw = cleanInput(input);
    if (!raw) fail(emptyError());
    if (toolKindFromText(raw)) fail(otherToolError());
    var url = toUrl(raw);
    var host = rejectHost(url);
    var parts = readParts(url);
    var kind = classify(parts);
    if (kind !== 'ok') failClass(kind);
    var username = parts[0];
    if (!validUsername(username)) fail(invalidPathError());
    var strippedTracking = applyQuery(url);
    if (url.search) fail(extraParamError());
    var payload = 'https://' + host + '/' + encodeURIComponent(username);
    return {
      payload: payload,
      url: payload,
      type: 'homepage',
      username: username,
      host: host,
      warning: SHARE_WARNING,
      normalized: payload !== raw,
      strippedTracking: strippedTracking
    };
  }

  /**
   * @param {{payload: string}} built
   */
  function assertStaticLinktreePayload(built) {
    var payload = built && built.payload;
    if (typeof payload !== 'string' || !payload) fail('Refusing to encode an empty payload.');
    if (!/^https:\/\/linktr\.(?:ee|biz)\/[^/?#]+$/.test(payload)) {
      fail('Refusing to encode a link that is not an HTTPS linktr.ee or linktr.biz public homepage URL.');
    }
    if (/[?#]|qrstatic\.app|javascript:/i.test(payload)) {
      fail('Refusing to encode a short link, redirect, hash, or tracking parameter. Nothing was encoded.');
    }
    var again;
    try {
      again = normalizeLinktree(payload);
    } catch (e) {
      fail('Refusing to encode a link that is not a public Linktree homepage URL.');
    }
    if (!again || again.payload !== payload) {
      fail('Refusing to encode a link that is not a public Linktree homepage URL.');
    }
    return built;
  }

  function buildLinktreePayload(input) {
    return assertStaticLinktreePayload(normalizeLinktree(input));
  }

  global.LinktreePayload = {
    buildLinktreePayload: buildLinktreePayload,
    assertStaticLinktreePayload: assertStaticLinktreePayload
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
