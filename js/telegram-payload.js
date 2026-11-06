(function (global) {
  'use strict';

  /** Telegram public usernames: 5–32 chars, start with a letter, then letters/digits/underscore. */
  var USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
  /** Invite hash after + or joinchat/: base64url-ish, practical length. */
  var INVITE_HASH_RE = /^[A-Za-z0-9_-]{8,128}$/;

  var TRACKING_EXACT = {
    utm_source: true,
    utm_medium: true,
    utm_campaign: true,
    utm_term: true,
    utm_content: true,
    utm_id: true,
    fbclid: true,
    gclid: true,
    mc_cid: true,
    mc_eid: true,
    ref: true,
    ref_src: true,
    start: true
  };

  function isTelegramHost(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    return host === 't.me' || host === 'telegram.me' || host === 'telegram.dog';
  }

  function looksLikeLogin(raw) {
    var s = String(raw || '').toLowerCase();
    if (/tg:\/\/\s*login/.test(s)) return true;
    if (/tg:\/\/login/.test(s)) return true;
    if (/qr[\s_-]?login/.test(s)) return true;
    if (/device[\s_-]?auth/.test(s)) return true;
    if (/login[\s_-]?token/.test(s)) return true;
    if (/[?&#]token=/.test(s) && /tg:\/\//.test(s)) return true;
    return false;
  }

  function rejectLogin() {
    throw new Error(
      'This page is not for Telegram login or device-authorization QR codes. Paste a public t.me / @username / group / channel / invite link only.'
    );
  }

  /**
   * Strip known tracking query keys; drop empty search.
   * @param {URL} url
   * @returns {{url: URL, stripped: boolean}}
   */
  function stripTracking(url) {
    var stripped = false;
    var keys = [];
    url.searchParams.forEach(function (_v, k) {
      keys.push(k);
    });
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var lower = k.toLowerCase();
      if (TRACKING_EXACT[lower] || lower.indexOf('utm_') === 0) {
        url.searchParams.delete(k);
        stripped = true;
      }
    }
    return { url: url, stripped: stripped };
  }

  function validateUsername(name) {
    if (!USERNAME_RE.test(name)) {
      throw new Error(
        'That Telegram username looks invalid. Public usernames are 5–32 characters, start with a letter, and use letters, digits, or underscores only.'
      );
    }
  }

  function validateInviteHash(hash) {
    var h = String(hash || '');
    if (h.charAt(0) === '+') h = h.slice(1);
    if (!INVITE_HASH_RE.test(h)) {
      throw new Error(
        'That invite link looks incomplete or invalid. Paste a public t.me/+… or t.me/joinchat/… invite you are allowed to share.'
      );
    }
    return h;
  }

  /**
   * @param {string} input
   * @returns {{
   *   payload: string,
   *   url: string,
   *   type: string,
   *   username?: string,
   *   inviteHash?: string,
   *   source: string,
   *   warning: string,
   *   normalized: boolean,
   *   strippedTracking: boolean
   * }}
   */
  function buildTelegramPayload(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) {
      throw new Error('Paste a Telegram t.me link, @username, or public invite.');
    }

    if (looksLikeLogin(raw)) {
      rejectLogin();
    }

    var normalized = false;
    var strippedTracking = false;
    var warning = '';

    // @username
    if (raw.charAt(0) === '@') {
      var atName = raw.slice(1).trim();
      validateUsername(atName);
      var atUrl = 'https://t.me/' + atName;
      return {
        payload: atUrl,
        url: atUrl,
        type: 'username',
        username: atName,
        source: '@username',
        warning: '',
        normalized: true,
        strippedTracking: false
      };
    }

    // tg:// schemes
    if (/^tg:\/\//i.test(raw)) {
      if (/^tg:\/\/login/i.test(raw) || looksLikeLogin(raw)) {
        rejectLogin();
      }
      var resolveMatch = raw.match(/^tg:\/\/resolve\?(.*)$/i);
      if (resolveMatch) {
        var domain = '';
        var qparts = String(resolveMatch[1] || '').split('&');
        for (var qi = 0; qi < qparts.length; qi++) {
          var kv = qparts[qi].split('=');
          if (decodeURIComponent(kv[0] || '').toLowerCase() === 'domain') {
            try { domain = decodeURIComponent(kv[1] || ''); } catch (de) { domain = kv[1] || ''; }
            break;
          }
        }
        domain = String(domain || '').trim();
        if (!domain) {
          throw new Error('tg://resolve needs a domain=username parameter. Prefer https://t.me/username.');
        }
        validateUsername(domain);
        var resolveUrl = 'https://t.me/' + domain;
        return {
          payload: resolveUrl,
          url: resolveUrl,
          type: 'username',
          username: domain,
          source: 'tg://resolve',
          warning: '',
          normalized: true,
          strippedTracking: false
        };
      }
      throw new Error(
        'Unsupported tg:// link. This tool only accepts public t.me / telegram.me / @username / invite links—not login or other Telegram app deep links.'
      );
    }

    var candidate = raw;
    // Bare t.me/... or telegram.me/... without scheme
    if (!/^https?:\/\//i.test(candidate)) {
      if (/^(t\.me|telegram\.me|telegram\.dog|www\.(t\.me|telegram\.me|telegram\.dog))\//i.test(candidate)) {
        candidate = 'https://' + candidate;
        normalized = true;
      } else {
        // Require @username or an explicit t.me / telegram.me host — do not treat random words as usernames
        throw new Error(
          'Paste a Telegram t.me / telegram.me link, @username, or public invite (not a bare word).'
        );
      }
    }

    var url;
    try {
      url = new URL(candidate);
    } catch (e) {
      throw new Error('That does not look like a valid Telegram link. Paste https://t.me/…, @username, or a public invite.');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      if (url.protocol === 'tg:') {
        rejectLogin();
      }
      throw new Error('Use an http(s) Telegram URL, @username, or public invite.');
    }

    var host = (url.hostname || '').toLowerCase().replace(/^www\./, '');
    if (!isTelegramHost(host)) {
      throw new Error(
        'That is not a t.me / telegram.me link. Paste a public Telegram username, group, channel, or invite URL.'
      );
    }

    if (host === 'telegram.me' || host === 'telegram.dog') {
      normalized = true;
    }

    var stripResult = stripTracking(url);
    url = stripResult.url;
    if (stripResult.stripped) {
      strippedTracking = true;
      normalized = true;
    }
    // Drop any remaining query/hash for clean public share links (except we already stripped tracking;
    // leftover non-tracking params are uncommon on t.me — drop them for a stable QR).
    if (url.search && url.search.length > 1) {
      url.search = '';
      strippedTracking = true;
      normalized = true;
    }
    if (url.hash) {
      url.hash = '';
      normalized = true;
    }

    var parts = String(url.pathname || '')
      .split('/')
      .filter(function (p) { return p.length > 0; });

    if (!parts.length) {
      throw new Error('Paste a full Telegram link that includes a username or invite path.');
    }

    // joinchat/HASH → https://t.me/+HASH
    if (parts[0].toLowerCase() === 'joinchat') {
      if (parts.length < 2) {
        throw new Error('That joinchat invite looks incomplete.');
      }
      var joinHash = validateInviteHash(parts[1]);
      var joinUrl = 'https://t.me/+' + joinHash;
      return {
        payload: joinUrl,
        url: joinUrl,
        type: 'invite',
        inviteHash: joinHash,
        source: 'joinchat',
        warning: '',
        normalized: true,
        strippedTracking: strippedTracking
      };
    }

    // +HASH invite (path segment may be "+HASH" or encoded %2BHASH)
    var first = parts[0];
    var decodedFirst = first;
    try {
      decodedFirst = decodeURIComponent(first);
    } catch (e2) {
      decodedFirst = first;
    }

    if (decodedFirst.charAt(0) === '+') {
      var plusHash = validateInviteHash(decodedFirst);
      var plusUrl = 'https://t.me/+' + plusHash;
      if (raw.indexOf('telegram.me') !== -1 || strippedTracking || candidate !== raw) {
        normalized = true;
      }
      return {
        payload: plusUrl,
        url: plusUrl,
        type: 'invite',
        inviteHash: plusHash,
        source: 'invite',
        warning: warning,
        normalized: normalized || host !== 't.me' || strippedTracking,
        strippedTracking: strippedTracking
      };
    }

    // s/ short links or other multi-segment paths — accept username only as first segment
    // Common: /username, /username/123 (channel post) — encode the public entity root for QR posters
    var username = decodedFirst;
    // Reject path tricks
    if (username.indexOf('..') !== -1 || username.indexOf('@') !== -1) {
      throw new Error('That Telegram path looks invalid.');
    }

    // Known non-username first segments to reject clearly
    var blocked = {
      login: true,
      addstickers: true,
      proxy: true,
      socks: true,
      share: true,
      iv: true,
      setlanguage: true,
      bg: true
    };
    if (blocked[username.toLowerCase()]) {
      if (username.toLowerCase() === 'login') rejectLogin();
      throw new Error(
        'Unsupported Telegram path “/' +
          username +
          '”. Paste a public @username, t.me/username, or invite link.'
      );
    }

    validateUsername(username);

    // Optional: /username/123 message deep links — keep full path for shareable posts
    var pathExtra = '';
    if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
      pathExtra = '/' + parts[1];
      // further junk ignored
    }

    var userUrl = 'https://t.me/' + username + pathExtra;
    if (host !== 't.me' || strippedTracking || /^http:\/\//i.test(candidate) || pathExtra) {
      normalized = true;
    }
    // http → https always counts as normalized
    if (url.protocol === 'http:') normalized = true;

    return {
      payload: userUrl,
      url: userUrl,
      type: pathExtra ? 'post' : 'username',
      username: username,
      source: host,
      warning: warning,
      normalized: normalized || strippedTracking || host !== 't.me',
      strippedTracking: strippedTracking
    };
  }

  global.TelegramPayload = {
    buildTelegramPayload: buildTelegramPayload,
    isTelegramHost: isTelegramHost,
    USERNAME_RE: USERNAME_RE,
    INVITE_HASH_RE: INVITE_HASH_RE
  };
})(typeof window !== 'undefined' ? window : this);
