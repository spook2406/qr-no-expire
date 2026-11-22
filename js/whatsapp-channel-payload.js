(function (global) {
  'use strict';

  /**
   * Public WhatsApp Channel follow links only.
   * HTTPS, unify www.whatsapp.com to whatsapp.com, strip hash, strip
   * utm* / fbclid / gclid and other tracking parameters.
   * The QR holds that URL directly. No user-agent routing, no network
   * request, no short link, no redirect unwrap, no signup.
   * A group invite, Community invite, click-to-chat link, Web login, or
   * pairing code stays out of the code. This does not bypass privacy,
   * bans, or a non-public limit.
   */

  var CLICK_TO_CHAT_PAGE = 'https://qrstatic.app/whatsapp-qr-code-generator.html';

  var COMMUNITY_ROOT = { community: true, communities: true, invite: true };
  var STATUS_ROOT = { status: true, statuses: true };
  var LOGIN_ROOT = {
    login: true, 'log-in': true, signin: true, 'sign-in': true,
    desktop: true, web: true, logout: true, 'log-out': true
  };
  var PAIR_ROOT = {
    pair: true, pairing: true, device: true, devices: true,
    'linked-devices': true, linked_devices: true, linkeddevices: true,
    companion: true, 'link-device': true, 'linked-device': true
  };
  var TWOFA_ROOT = {
    verify: true, verification: true, twofactor: true, 'two-factor': true,
    '2fa': true, authenticator: true, otp: true, totp: true,
    'two-step': true, twostep: true, pin: true
  };
  var JOIN_ROOT = {
    join: true, request: true, approve: true, approval: true, private: true
  };
  var REDIRECT_ROOT = { redirect: true, redirection: true, redir: true };

  var TRACKING_EXACT = {
    fbclid: true, gclid: true, gbraid: true, wbraid: true, dclid: true,
    msclkid: true, twclid: true, ttclid: true, igshid: true, igsh: true,
    mc_cid: true, mc_eid: true, _ga: true, _gl: true, gad_source: true,
    gad_campaignid: true, gclsrc: true, yclid: true, srsltid: true,
    mkt_tok: true, _hsenc: true, _hsmi: true, fb_action_ids: true,
    fb_action_types: true, fb_source: true, fb_ref: true, ref: true,
    ref_src: true, ref_url: true, si: true, source: true
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

  var SHARE_WARNING = 'Share only a public WhatsApp Channel follow link you have the right to share. QRStatic is not an official WhatsApp product. This QR does not bypass WhatsApp privacy, bans, or non-public limits. If an admin changes or disables the public follow link, a code that was already printed stops opening that channel and must be remade from the current public link.';

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
    return 'Paste a public WhatsApp Channel follow link: whatsapp.com/channel/… or www.whatsapp.com/channel/…. Nothing was encoded.';
  }

  function domainError() {
    return 'That is not a public whatsapp.com/channel follow link. Other websites are not encoded. It was not encoded.';
  }

  function shortLinkError() {
    return 'That is a short link, not a public WhatsApp Channel follow link. Shorteners are not followed and are not encoded. Paste the public whatsapp.com/channel URL. It was not encoded.';
  }

  function ourShortLinkError() {
    return 'That is a short link or redirect on qrstatic.app, not a public WhatsApp Channel follow link. This page does not follow redirects and does not put qrstatic.app inside the QR. Paste the public whatsapp.com/channel URL. It was not encoded.';
  }

  function clickToChatError() {
    return 'That is a phone number or a WhatsApp click-to-chat link (wa.me or a send link). This page only encodes a public WhatsApp Channel follow link and will not generate a code for that input. Use the click-to-chat generator: ' + CLICK_TO_CHAT_PAGE + '. Nothing was encoded.';
  }

  function groupError() {
    return 'That is a WhatsApp group invite (chat.whatsapp.com), not a public Channel follow link. This page does not encode group invites. It was not encoded.';
  }

  function communityError() {
    return 'That is a WhatsApp Community invite, not a public Channel follow link. Community is out of scope on this page. It was not encoded.';
  }

  function webLoginError() {
    return 'That is a WhatsApp Web or desktop login page, not a public Channel follow link. Do not use this page to scan a WhatsApp Web login code. It was not encoded.';
  }

  function pairingError() {
    return 'That is a linked-device or pairing code, not a public Channel follow link. Pairing codes are not encoded. It was not encoded.';
  }

  function twofaError() {
    return 'That looks like a 2FA or authenticator flow, not a public WhatsApp Channel follow link. This page does not encode authenticator or verification codes. It was not encoded.';
  }

  function statusError() {
    return 'That is WhatsApp Status, not a public Channel follow link. Status is not encoded on this page. It was not encoded.';
  }

  function nonPublicError() {
    return 'That link is not a public WhatsApp Channel follow URL. This page does not encode an entry point that requires joining before the content can be viewed, and it does not bypass a non-public limit. It was not encoded.';
  }

  function notChannelError() {
    return 'That WhatsApp URL is not a public Channel follow link. This page only encodes whatsapp.com/channel/…. It was not encoded.';
  }

  function otherHostError() {
    return 'That WhatsApp hostname is not the public channel host. Paste whatsapp.com/channel/…. It was not encoded.';
  }

  function missingCodeError() {
    return 'That WhatsApp URL is missing the public channel code. Paste whatsapp.com/channel/…. It was not encoded.';
  }

  function invalidCodeError() {
    return 'That channel code looks invalid. Paste the public whatsapp.com/channel/… follow link again. It was not encoded.';
  }

  function invalidPathError() {
    return 'That WhatsApp path looks invalid. Copy the public channel follow URL again. It was not encoded.';
  }

  function newsletterIdError() {
    return 'That is a channel id, not a public follow link. Paste the whatsapp.com/channel/… URL. It was not encoded.';
  }

  function extraParamError() {
    return 'That WhatsApp link has a parameter this page will not encode. Paste the public follow URL. Tracking parameters are removed; other parameters are not encoded.';
  }

  function loginParamError() {
    return 'That WhatsApp link contains a login or session parameter. This page does not bypass a login wall. It was not encoded.';
  }

  function redirectError() {
    return 'That link is a redirect. This page does not follow redirects or encode them. Paste the public whatsapp.com/channel URL. It was not encoded.';
  }

  function schemeError() {
    return 'Use an http(s) WhatsApp Channel follow URL. Other schemes are not encoded.';
  }

  function otherToolError() {
    return 'That is a link for another tool on this site, not a public WhatsApp Channel follow link. Use the matching generator. It was not encoded.';
  }

  function meetToolError() {
    return 'That is a Google Meet link, not a WhatsApp Channel follow link. Use the Google Meet QR generator. It was not encoded.';
  }

  function calendarToolError() {
    return 'That looks like a calendar event, not a WhatsApp Channel follow link. Use the Calendar Event QR generator. It was not encoded.';
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
    return /token|session|password|csrf|challenge|otp|auth/.test(key);
  }

  function validCode(code) {
    return !!code && /^[A-Za-z0-9_-]{16,64}$/.test(code);
  }

  function clickToChatPhone(raw) {
    if (/[a-zA-Z/:@\\]/.test(raw)) return false;
    if (!/^[+\d\s().-]+$/.test(raw)) return false;
    var digits = raw.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
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
    if (host === 'music.apple.com' || hostSuffix(host, 'music.apple.com')) return '';
    if (host === 'open.spotify.com' || host === 'spotify.link' || hostSuffix(host, 'spotify.com')) return 'other';
    if (host === 't.me' || host === 'telegram.me' || hostSuffix(host, 'telegram.org')) return 'other';
    if (host === 'discord.gg' || host === 'discord.com') return 'other';
    if (host === 'calendly.com' || hostSuffix(host, 'calendly.com')) return 'other';
    if (host === 'linkedin.com' || hostSuffix(host, 'linkedin.com')) return 'other';
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') return 'other';
    if (host === 'maps.google.com' || (host === 'google.com' && /^\/maps(\/|$)/i.test(path))) return 'other';
    return '';
  }

  function hostKind(host) {
    if (host === 'whatsapp.com') return 'channel';
    if (host === 'wa.me') return 'wa';
    if (host === 'web.whatsapp.com') return 'web';
    if (host === 'api.whatsapp.com') return 'api';
    if (host === 'chat.whatsapp.com') return 'chat';
    if (host === 'status.whatsapp.com') return 'status';
    if (host.length > 13 && host.slice(-13) === '.whatsapp.com') return 'other-wa';
    return '';
  }

  function rejectTextShape(raw) {
    if (/@newsletter\b/i.test(raw)) fail(newsletterIdError());
    if (/^whatsapp:/i.test(raw)) {
      if (/send|phone=\d/i.test(raw)) fail(clickToChatError());
      if (/pair|device|link/i.test(raw)) fail(pairingError());
      fail(schemeError());
    }
    if (clickToChatPhone(raw)) fail(clickToChatError());
    if (/^\d{6}$/.test(raw)) fail(twofaError());
    if (/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(raw)) fail(pairingError());
    var kind = toolKindFromText(raw);
    if (kind) failToolKind(kind);
  }

  function toUrl(raw) {
    if (/\s/.test(raw)) {
      fail('That link contains a space. Paste one WhatsApp Channel follow URL with no extra text. It was not encoded.');
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
      fail('That does not look like a valid WhatsApp Channel follow URL. Paste a public whatsapp.com/channel link. It was not encoded.');
    }
    if (url.username || url.password) {
      fail('Paste the channel link without a username or password in the URL. It was not encoded.');
    }
    var protocol = String(url.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') fail(schemeError());
    if (url.port && url.port !== '443' && url.port !== '80') {
      fail('That link uses an unexpected port. Paste the normal https://whatsapp.com/channel URL. It was not encoded.');
    }
    return url;
  }

  function rejectHost(url) {
    var host = bareHost(url);
    var kind = hostKind(host);
    var pathLower = String(url.pathname || '').toLowerCase();
    var joined = (pathLower + String(url.search || '').toLowerCase());
    if (kind === 'wa') {
      if (/linked[-_]?device|\/pair\b|pairing/.test(joined)) fail(pairingError());
      if (/authenticator|2fa|otpauth|two-step|verification/.test(joined)) fail(twofaError());
      fail(clickToChatError());
    }
    if (kind === 'api') {
      if (/^\/send(\/|$)/.test(pathLower)) fail(clickToChatError());
      if (/pair|device/.test(pathLower)) fail(pairingError());
      fail(notChannelError());
    }
    if (kind === 'web') {
      if (/^\/send(\/|$)/.test(pathLower)) fail(clickToChatError());
      fail(webLoginError());
    }
    if (kind === 'chat') {
      if (/community|\/invite(\/|$)/.test(pathLower)) fail(communityError());
      fail(groupError());
    }
    if (kind === 'status') fail(statusError());
    if (kind === 'channel') return;
    if (kind === 'other-wa') fail(otherHostError());
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
    if (parts.length > 4) fail(invalidPathError());
    return parts;
  }

  function classify(parts) {
    if (!parts.length) fail(notChannelError());
    var root = String(parts[0]).toLowerCase();
    if (COMMUNITY_ROOT[root]) fail(communityError());
    if (STATUS_ROOT[root]) fail(statusError());
    if (LOGIN_ROOT[root]) fail(webLoginError());
    if (PAIR_ROOT[root]) fail(pairingError());
    if (TWOFA_ROOT[root]) fail(twofaError());
    if (JOIN_ROOT[root]) fail(nonPublicError());
    if (REDIRECT_ROOT[root]) fail(redirectError());
    if (root !== 'channel') fail(notChannelError());
    if (parts.length < 2) fail(missingCodeError());
    if (parts.length > 2) {
      var extra = String(parts[2]).toLowerCase();
      if (COMMUNITY_ROOT[extra]) fail(communityError());
      if (STATUS_ROOT[extra]) fail(statusError());
      if (JOIN_ROOT[extra]) fail(nonPublicError());
      if (PAIR_ROOT[extra]) fail(pairingError());
      fail(invalidPathError());
    }
    if (!validCode(parts[1])) fail(invalidCodeError());
    return parts[1];
  }

  function assertQuery(url) {
    var params = [];
    url.searchParams.forEach(function (value, key) {
      params.push({
        lower: String(key || '').toLowerCase(),
        value: String(value == null ? '' : value)
      });
    });
    var i;
    for (i = 0; i < params.length; i++) {
      var lower = params[i].lower;
      var value = params[i].value;
      var valueLower = value.toLowerCase();
      if (isTrackingKey(lower)) continue;
      if (/community/.test(valueLower) || lower === 'community') fail(communityError());
      if (lower === 'status' || valueLower === 'status') fail(statusError());
      if (/pair|linked[-_]?device/.test(lower) || /pair|linked[-_]?device/.test(valueLower)) fail(pairingError());
      if (REDIRECT_KEYS[lower] || /:\/\//.test(value) || /javascript:/i.test(value)) fail(redirectError());
      if (isAuthKey(lower)) fail(loginParamError());
      fail(extraParamError());
    }
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
  function normalizeWhatsAppChannel(input) {
    var raw = cleanInput(input);
    if (!raw) fail(emptyError());
    rejectTextShape(raw);
    var url = toUrl(raw);
    rejectHost(url);
    var code = classify(readParts(url));
    assertQuery(url);
    var payload = 'https://whatsapp.com/channel/' + encodeURIComponent(code);
    return {
      payload: payload,
      url: payload,
      type: 'channel',
      host: 'whatsapp.com',
      warning: SHARE_WARNING,
      normalized: payload !== raw
    };
  }

  /**
   * @param {{payload: string}} built
   */
  function assertStaticWhatsAppChannelPayload(built) {
    var payload = built && built.payload;
    if (typeof payload !== 'string' || !payload) fail('Refusing to encode an empty payload.');
    if (!/^https:\/\/whatsapp\.com\/channel\/[A-Za-z0-9_-]{16,64}$/.test(payload)) {
      fail('Refusing to encode a link that is not an HTTPS whatsapp.com/channel follow URL.');
    }
    if (/[?#]|qrstatic\.app|wa\.me|chat\.whatsapp|api\.whatsapp|web\.whatsapp|bit\.ly|javascript:/i.test(payload)) {
      fail('Refusing to encode a short link, redirect, hash, or tracking parameter. Nothing was encoded.');
    }
    var again;
    try {
      again = normalizeWhatsAppChannel(payload);
    } catch (e) {
      fail('Refusing to encode a link that is not a public WhatsApp Channel follow URL.');
    }
    if (!again || again.payload !== payload) {
      fail('Refusing to encode a link that is not a public WhatsApp Channel follow URL.');
    }
    return built;
  }

  function buildWhatsAppChannelPayload(input) {
    return assertStaticWhatsAppChannelPayload(normalizeWhatsAppChannel(input));
  }

  global.WhatsAppChannelPayload = {
    buildWhatsAppChannelPayload: buildWhatsAppChannelPayload,
    assertStaticWhatsAppChannelPayload: assertStaticWhatsAppChannelPayload
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
