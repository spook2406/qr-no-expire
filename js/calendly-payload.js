(function (global) {
  'use strict';

  /**
   * Public Calendly booking links only.
   * Accept calendly.com/{username}, calendly.com/{username}/{event},
   * and calendly.com/d/{id}/…
   * HTTPS, strip www, strip hash, strip tracking params.
   * No user-agent routing, no fetch, no short link, no redirect unwrap.
   */

  var USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,78}[A-Za-z0-9])?$/;
  var DIRECT_ID_RE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
  var MONTH_RE = /^\d{4}-\d{2}$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  var AUTH = {
    login: true, 'log-in': true, signin: true, 'sign-in': true,
    signup: true, 'sign-up': true, register: true, registration: true,
    logout: true, 'log-out': true, auth: true, oauth: true, sso: true,
    users: true, sessions: true, password: true, passwords: true,
    'forgot-password': true, forgot_password: true
  };

  var ADMIN = {
    app: true, admin: true, dashboard: true, settings: true,
    account: true, accounts: true, billing: true, edit: true, editor: true,
    event_types: true, 'event-types': true,
    scheduled_events: true, 'scheduled-events': true,
    availability: true, workflows: true, organization: true, organizations: true,
    onboarding: true, setup: true, members: true, routing: true,
    routing_forms: true, 'routing-forms': true
  };

  var CANCEL = {
    cancellations: true, cancellation: true,
    reschedulings: true, rescheduling: true,
    reschedule: true, cancel: true
  };

  var INVITE = {
    invitees: true, invitee: true, invites: true, invite: true,
    invitation: true, invitations: true,
    confirmation: true, confirmations: true, confirmed: true
  };

  var SITE = {
    pricing: true, blog: true, help: true, support: true, security: true,
    partners: true, customers: true, solutions: true, enterprise: true,
    resources: true, careers: true, jobs: true, legal: true, privacy: true,
    terms: true, cookies: true, contact: true, product: true, products: true,
    features: true, about: true, developers: true, api: true, docs: true,
    documentation: true, status: true, press: true, company: true,
    webinars: true, compare: true, alternatives: true, integrations: true,
    download: true, mobile: true, explore: true, home: true, templates: true,
    stories: true, news: true, www: true
  };

  var TOKEN_KEYS = {
    invitee_uuid: true, invitee: true, token: true, signature: true, sig: true,
    jwt: true, access_token: true, auth_token: true, cancel_token: true,
    reschedule_token: true, secret: true, password: true, pwd: true
  };

  var TRACKING_EXACT = {
    fbclid: true, gclid: true, gbraid: true, wbraid: true, dclid: true,
    msclkid: true, twclid: true, ttclid: true, igshid: true, mc_cid: true,
    mc_eid: true, _ga: true, _gl: true, gad_source: true, gad_campaignid: true,
    gclsrc: true, yclid: true, srsltid: true, mkt_tok: true, share_attribution: true,
    ref: true, referrer: true
  };

  var CHROME_KEYS = {
    back: true, embed_domain: true, embed_type: true, hide_gdpr_banner: true,
    hide_landing_page_details: true, hide_event_type_details: true,
    background_color: true, text_color: true, primary_color: true, branding: true
  };

  var SHORT_SUFFIXES = [
    'bit.ly', 'bitly.com', 'tinyurl.com', 'tiny.cc', 't.co', 'goo.gl', 'ow.ly',
    'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'rb.gy', 't.ly', 'short.io',
    'lnk.to', 'ffm.to', 'smarturl.it', 'linktr.ee', 'bio.link', 'onelink.me',
    'app.link', 'branch.io', 'bnc.lt', 'qrco.de', 'flowcode.com', 'bit.do',
    'tiny.one', 'dub.sh', 'smart.link', 'cal.ly'
  ];

  var SHARE_WARNING = 'Share only a public Calendly booking link you have the right to share. QRStatic is not official Calendly. This QR does not bypass a paywall, a private event, or an access restriction. If the event type is closed or the account is disabled, the scan fails on Calendly’s side.';

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
    return 'Paste a public Calendly booking link: https://calendly.com/your-name, https://calendly.com/your-name/event, or https://calendly.com/d/id/event. Nothing was encoded.';
  }

  function domainError() {
    return 'That is not a calendly.com booking link. Custom domains, short links, and other websites are not encoded. Paste the public https://calendly.com page. It was not encoded.';
  }

  function shortLinkError() {
    return 'That is a smart-QR or short-link URL, not a Calendly booking link. This page does not follow redirects and does not treat a short link as the booking page. Paste the public calendly.com URL. It was not encoded.';
  }

  function subdomainError() {
    return 'That Calendly subdomain is not a public booking page. Paste https://calendly.com/… from Share, not an app or admin host. It was not encoded.';
  }

  function loginError() {
    return 'That is a Calendly login or signup page, not a public booking link. Paste the scheduling page you can share. Login and signup pages are not encoded.';
  }

  function adminError() {
    return 'That is a Calendly app, admin, or edit page, not a public booking link. Copy the booking link from Share, not the editor. It was not encoded.';
  }

  function cancelError() {
    return 'That is a Calendly cancel or reschedule link with an invitee token. Paste the public booking page, where the other person picks a time. Cancel and reschedule links are not encoded.';
  }

  function inviteError() {
    return 'That is a Calendly invite or confirmation page, not the public booking link. Paste the scheduling page or event-type link. It was not encoded.';
  }

  function notBookingError() {
    return 'That Calendly URL is not a public booking page. Paste a scheduling homepage (calendly.com/your-name), one event type (calendly.com/your-name/event), or a public /d/ event link. It was not encoded.';
  }

  function invalidPathError() {
    return 'That Calendly booking path looks invalid. Copy the public scheduling link again. It was not encoded.';
  }

  function directIdError() {
    return 'That /d/ link is missing a public event id. Paste a link like https://calendly.com/d/abc-123-xyz/meeting-name. It was not encoded.';
  }

  function extraParamError() {
    return 'That Calendly link has a parameter this page will not encode. Paste the public booking link. Tracking parameters are removed; private or extra parameters are not encoded.';
  }

  function calendarToolError() {
    return 'That looks like a Calendar Event (a fixed ICS / VEVENT), not a Calendly booking page. The other person does not pick a time from an ICS code. Use the Calendar Event QR generator for a fixed event. It was not encoded.';
  }

  function meetToolError() {
    return 'That is a Google Meet link, not a Calendly booking page. Use the Google Meet QR generator. It was not encoded.';
  }

  function otherToolError() {
    return 'That is a link for another tool on this site, not a public Calendly booking page. Use the matching generator. It was not encoded.';
  }

  function schemeError() {
    return 'Use an http(s) calendly.com booking link. Other schemes are not encoded.';
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

  function toolKindFromText(raw) {
    if (/BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(raw)) return 'calendar';
    if (/BEGIN:VCARD/i.test(raw)) return 'other';
    if (/^WIFI:/i.test(raw)) return 'other';
    if (/^otpauth:/i.test(raw)) return 'other';
    if (/^mailto:/i.test(raw)) return 'other';
    if (/^tel:/i.test(raw)) return 'other';
    if (/^sms:/i.test(raw)) return 'other';
    if (/^geo:/i.test(raw)) return 'other';
    if (/^market:/i.test(raw)) return 'other';
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
    if (host === 'maps.google.com' || (host === 'google.com' && /^\/maps(\/|$)/i.test(path))) return 'other';
    if (host === 'search.google.com' || host === 'g.page') return 'other';
    if (host === 'qrstatic.app' || hostSuffix(host, 'qrstatic.app')) return 'other';
    return '';
  }

  function classifySegment(seg) {
    if (AUTH[seg]) return 'login';
    if (ADMIN[seg]) return 'admin';
    if (CANCEL[seg]) return 'cancel';
    if (INVITE[seg]) return 'invite';
    return '';
  }

  function failSegment(kind) {
    if (kind === 'login') fail(loginError());
    if (kind === 'admin') fail(adminError());
    if (kind === 'cancel') fail(cancelError());
    if (kind === 'invite') fail(inviteError());
  }

  function assertUserOrSlug(value) {
    if (!value || value.length < 2 || value.length > 80 || !USER_RE.test(value)) fail(invalidPathError());
    if (value.indexOf('..') !== -1 || /%2f/i.test(value)) fail(invalidPathError());
  }

  function assertDirectId(value) {
    if (!value || value.length < 3 || value.length > 80 || !DIRECT_ID_RE.test(value)) fail(directIdError());
  }

  function toUrl(raw) {
    var kind = toolKindFromText(raw);
    if (kind) failToolKind(kind);
    if (/\s/.test(raw)) {
      fail('That link contains a space. Paste one Calendly booking URL with no extra text. It was not encoded.');
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
      fail('That does not look like a valid Calendly booking link. Paste https://calendly.com/your-name or an event link. It was not encoded.');
    }
    if (url.username || url.password) {
      fail('Paste the Calendly link without a username or password in the URL. It was not encoded.');
    }
    var protocol = String(url.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') fail(schemeError());
    if (url.port && url.port !== '443' && url.port !== '80') {
      fail('That link uses an unexpected port. Paste the normal https://calendly.com booking link. It was not encoded.');
    }
    return url;
  }

  function rejectHost(url) {
    var hostRaw = String(url.hostname || '').toLowerCase().replace(/\.$/, '');
    if (!hostRaw || hostRaw === 'calendly.com' || hostRaw === 'www.calendly.com') return;
    var host = hostRaw.replace(/^www\./, '');
    if (matchesList(host, SHORT_SUFFIXES)) fail(shortLinkError());
    var tool = toolKindFromUrl(url);
    if (tool) failToolKind(tool);
    if (host === 'app.calendly.com') fail(adminError());
    if (hostSuffix(host, 'calendly.com')) fail(subdomainError());
    if (matchesList(hostRaw, SHORT_SUFFIXES)) fail(shortLinkError());
    fail(domainError());
  }

  function readParts(url) {
    var path = String(url.pathname || '/');
    if (/\/{2,}/.test(path) || /%2f/i.test(path) || /(^|\/)\.\.(\/|$)/.test(path)) fail(invalidPathError());
    if (path.length > 1) path = path.replace(/\/+$/, '');
    var parts = path.split('/').filter(function (p) { return p.length > 0; });
    try {
      parts = parts.map(function (p) { return decodeURIComponent(p); });
    } catch (e) {
      fail(invalidPathError());
    }
    if (parts.some(function (p) { return /[\/\\?#]/.test(p) || p === '.' || p === '..'; })) fail(invalidPathError());
    return parts;
  }

  function applyQuery(url) {
    var keys = [];
    url.searchParams.forEach(function (_value, key) { keys.push(key); });
    var kept = [];
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var lower = String(key || '').toLowerCase();
      var values = url.searchParams.getAll(key);
      if (values.length !== 1) fail(extraParamError());
      var value = String(values[0] == null ? '' : values[0]);
      if (TOKEN_KEYS[lower] || /token|invitee|signature/i.test(lower)) fail(cancelError());
      if (/^(redirect|url|dest|destination|target|next|goto)$/i.test(lower) || /:\/\//.test(value) || /javascript:/i.test(value)) {
        fail('That Calendly link contains a redirect parameter. This page does not follow redirects or encode them. It was not encoded.');
      }
      if (isTrackingKey(lower) || CHROME_KEYS[lower]) {
        url.searchParams.delete(key);
        continue;
      }
      if (lower === 'month' && MONTH_RE.test(value)) {
        kept.push(['month', value]);
        url.searchParams.delete(key);
        continue;
      }
      if (lower === 'date' && DATE_RE.test(value)) {
        kept.push(['date', value]);
        url.searchParams.delete(key);
        continue;
      }
      fail(extraParamError());
    }
    kept.forEach(function (pair) { url.searchParams.append(pair[0], pair[1]); });
  }

  function buildPath(parts) {
    var lower = parts.map(function (p) { return String(p).toLowerCase(); });
    var i;
    if (!parts.length) fail(notBookingError());

    var firstKind = classifySegment(lower[0]);
    if (firstKind) failSegment(firstKind);
    if (SITE[lower[0]]) fail(notBookingError());

    for (i = 1; i < lower.length; i++) {
      var later = classifySegment(lower[i]);
      if (later) failSegment(later);
    }

    if (lower[0] === 'd') {
      if (parts.length < 2) fail(directIdError());
      if (parts.length > 3) fail(notBookingError());
      assertDirectId(parts[1]);
      if (parts.length === 3) assertUserOrSlug(parts[2]);
      return { type: 'direct', parts: parts };
    }

    if (parts.length > 2) fail(notBookingError());
    assertUserOrSlug(parts[0]);
    if (parts.length === 2) assertUserOrSlug(parts[1]);
    return { type: parts.length === 1 ? 'homepage' : 'event', parts: parts };
  }

  function assertStaticCalendlyPayload(built) {
    var payload = built && built.payload;
    if (typeof payload !== 'string' || !payload) fail('Refusing to encode an empty payload.');
    if (!/^https:\/\/calendly\.com\//.test(payload)) {
      fail('Refusing to encode a link that is not an HTTPS calendly.com booking URL.');
    }
    if (/user-agent|useragent|smartlink|onelink|bit\.ly|tinyurl|qrco\.de|flowcode|javascript:/i.test(payload)) {
      fail('Refusing to encode a short link, redirect, or device route. Nothing was encoded.');
    }
    var hashAt = payload.indexOf('#');
    var queryAt = payload.indexOf('?');
    var pathPart = payload;
    var query = '';
    if (hashAt !== -1) fail('Refusing to encode a Calendly link that still has a hash.');
    if (queryAt !== -1) {
      pathPart = payload.slice(0, queryAt);
      query = payload.slice(queryAt);
    }
    var path = pathPart.slice('https://calendly.com/'.length);
    var pieces = path.split('/');
    var okPath = false;
    if (pieces[0] === 'd' && (pieces.length === 2 || pieces.length === 3) && DIRECT_ID_RE.test(pieces[1] || '')) {
      okPath = pieces.length === 2 || USER_RE.test(pieces[2] || '');
    } else if ((pieces.length === 1 || pieces.length === 2) && USER_RE.test(pieces[0] || '')) {
      okPath = pieces.length === 1 || USER_RE.test(pieces[1] || '');
      if (SITE[String(pieces[0] || '').toLowerCase()] || classifySegment(String(pieces[0] || '').toLowerCase())) okPath = false;
    }
    if (!okPath || pieces.some(function (p) { return classifySegment(String(p).toLowerCase()); })) {
      fail('Refusing to encode a link that is not a public Calendly booking URL.');
    }
    if (query) {
      var pairs = query.slice(1).split('&');
      if (!pairs.length || pairs.length > 2) fail('Refusing to encode a Calendly link with extra parameters.');
      var seen = {};
      pairs.forEach(function (pair) {
        var bits = pair.split('=');
        if (bits.length !== 2 || seen[bits[0]]) fail('Refusing to encode a Calendly link with extra parameters.');
        seen[bits[0]] = true;
        if (bits[0] === 'month' && !MONTH_RE.test(bits[1])) fail('Refusing to encode a Calendly link with extra parameters.');
        else if (bits[0] === 'date' && !DATE_RE.test(bits[1])) fail('Refusing to encode a Calendly link with extra parameters.');
        else if (bits[0] !== 'month' && bits[0] !== 'date') fail('Refusing to encode a Calendly link with extra parameters.');
      });
    }
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
  function buildCalendlyPayload(input) {
    var raw = cleanInput(input);
    if (!raw) fail(emptyError());
    var url = toUrl(raw);
    rejectHost(url);
    var builtPath = buildPath(readParts(url));
    applyQuery(url);
    var payload = 'https://calendly.com/' + builtPath.parts.join('/');
    if (url.search) payload += url.search;
    var result = {
      payload: payload,
      url: payload,
      type: builtPath.type,
      host: 'calendly.com',
      warning: SHARE_WARNING,
      normalized: payload !== raw
    };
    return assertStaticCalendlyPayload(result);
  }

  global.CalendlyPayload = {
    buildCalendlyPayload: buildCalendlyPayload,
    assertStaticCalendlyPayload: assertStaticCalendlyPayload
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
