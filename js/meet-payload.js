(function (global) {
  'use strict';

  /**
   * Standard Google Meet join codes: xxx-xxxx-xxx
   * (3 + 4 + 3 alphanumeric groups, hyphens).
   */
  var MEET_CODE_RE = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/;

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
    ref_src: true
  };

  function isMeetHost(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    return host === 'meet.google.com';
  }

  function looksLikeNonJoin(raw) {
    var s = String(raw || '').toLowerCase();
    if (/\/signin\b/.test(s)) return true;
    if (/\/signup\b/.test(s)) return true;
    if (/\/login\b/.test(s)) return true;
    if (/\/accounts?\b/.test(s)) return true;
    if (/oauth2?/.test(s)) return true;
    if (/\/landing\b/.test(s)) return true;
    if (/\/admin\b/.test(s)) return true;
    if (/\/about\b/.test(s)) return true;
    return false;
  }

  function rejectNonJoin() {
    throw new Error(
      'This page is for Google Meet join links or meeting codes only—not sign-in, account, admin, or homepage URLs. Paste a meet.google.com/xxx-xxxx-xxx link or the bare code you are allowed to share.'
    );
  }

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

  /**
   * Normalize a bare or messy meeting code to xxx-xxxx-xxx lowercase.
   * Accepts: "abc-defg-hij", "ABC DEFG HIJ", "abcdefg hij", "abcdefghij" (10 chars).
   */
  function normalizeMeetCode(raw) {
    var s = String(raw || '').trim().toLowerCase();
    try {
      s = decodeURIComponent(s);
    } catch (e) {
      /* keep raw */
    }
    // Collapse separators to hyphens, then strip non-alnum except hyphens
    s = s.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
    // Already hyphenated 3-4-3
    if (MEET_CODE_RE.test(s)) return s;
    // Strip hyphens and re-insert if 10 alnum chars
    var compact = s.replace(/-/g, '');
    if (/^[a-z0-9]{10}$/.test(compact)) {
      return compact.slice(0, 3) + '-' + compact.slice(3, 7) + '-' + compact.slice(7, 10);
    }
    throw new Error(
      'That Google Meet meeting code looks invalid. Codes look like xxx-xxxx-xxx (three groups of letters/digits). Paste a meet.google.com join link or the bare code.'
    );
  }

  /**
   * @param {string} input
   * @returns {{
   *   payload: string,
   *   url: string,
   *   type: string,
   *   code: string,
   *   host: string,
   *   source: string,
   *   warning: string,
   *   normalized: boolean,
   *   strippedTracking: boolean
   * }}
   */
  function buildMeetPayload(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) {
      throw new Error(
        'Paste a Google Meet join URL (meet.google.com/xxx-xxxx-xxx) or a meeting code (xxx-xxxx-xxx).'
      );
    }

    if (looksLikeNonJoin(raw)) {
      rejectNonJoin();
    }

    var normalized = false;
    var strippedTracking = false;
    var warning = '';

    // Bare meeting code (no scheme / no meet.google.com host)
    var bareCandidate = raw;
    // If it looks like a URL-ish string containing meet.google.com, treat as URL
    var looksLikeUrl =
      /^https?:\/\//i.test(raw) ||
      /^(www\.)?meet\.google\.com\//i.test(raw) ||
      /^meet\.google\.com$/i.test(raw);

    if (!looksLikeUrl) {
      // Reject obvious other hosts pasted without scheme handling below
      if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(raw) || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw)) {
        // Could be zoom.us/... or example.com — reject unless meet.google.com
        if (!/meet\.google\.com/i.test(raw)) {
          throw new Error(
            'That is not a Google Meet join link or meeting code. Paste https://meet.google.com/xxx-xxxx-xxx or a bare xxx-xxxx-xxx code.'
          );
        }
      }
      var code = normalizeMeetCode(raw);
      if (code !== raw.trim().toLowerCase().replace(/[\s_]+/g, '-')) {
        normalized = true;
      }
      var outUrl = 'https://meet.google.com/' + code;
      warning =
        'Public posters with a Meet join link can let strangers into the meeting. Prefer a waiting room / host admission controls, and only paste links you are allowed to share.';
      return {
        payload: outUrl,
        url: outUrl,
        type: 'meeting',
        code: code,
        host: 'meet.google.com',
        source: 'code',
        warning: warning,
        normalized: true,
        strippedTracking: false
      };
    }

    var candidate = raw;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = 'https://' + candidate.replace(/^\/\//, '');
      normalized = true;
    }

    var url;
    try {
      url = new URL(candidate);
    } catch (e) {
      throw new Error(
        'That does not look like a valid Google Meet join link. Paste https://meet.google.com/xxx-xxxx-xxx or a bare meeting code.'
      );
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Use an http(s) Google Meet join URL.');
    }

    var hostRaw = (url.hostname || '').toLowerCase();
    var host = hostRaw.replace(/^www\./, '');
    if (!isMeetHost(host)) {
      throw new Error(
        'That is not a Google Meet host. Paste a meet.google.com join URL or a bare xxx-xxxx-xxx meeting code you are allowed to share.'
      );
    }

    if (looksLikeNonJoin(url.href) || looksLikeNonJoin(url.pathname)) {
      rejectNonJoin();
    }

    var parts = String(url.pathname || '')
      .split('/')
      .filter(function (p) {
        return p.length > 0;
      });

    if (!parts.length) {
      throw new Error(
        'Paste a full Google Meet join URL that includes the meeting code path (meet.google.com/xxx-xxxx-xxx), or paste the bare code.'
      );
    }

    var first = parts[0].toLowerCase();
    // Reject lookup and other non-standard join paths for v1
    if (first === 'lookup' || first === 'landing' || first === 'new' || first === 'linkredirect') {
      throw new Error(
        'This version only accepts standard Google Meet join codes (xxx-xxxx-xxx). Lookup or other Meet path types are not supported—paste the join code from your invite.'
      );
    }
    if (
      first === 'signin' ||
      first === 'signup' ||
      first === 'login' ||
      first === 'accounts' ||
      first === 'account' ||
      first === 'admin' ||
      first === 'about'
    ) {
      rejectNonJoin();
    }

    if (parts.length > 1) {
      throw new Error(
        'Unexpected path after the Google Meet meeting code. Paste https://meet.google.com/xxx-xxxx-xxx only.'
      );
    }

    var code;
    try {
      code = normalizeMeetCode(parts[0]);
    } catch (e) {
      throw e;
    }

    if (String(parts[0]).toLowerCase() !== code) {
      normalized = true;
    }

    var stripResult = stripTracking(url);
    if (stripResult.stripped) {
      strippedTracking = true;
      normalized = true;
    }

    if (url.protocol === 'http:') {
      normalized = true;
    }
    if (/^www\./i.test(hostRaw)) {
      normalized = true;
    }
    if (url.hash) {
      normalized = true;
    }
    // Any remaining query after strip → drop for canonical join URL (Meet join codes need no query)
    var hadExtraQuery = false;
    url.searchParams.forEach(function () {
      hadExtraQuery = true;
    });
    if (hadExtraQuery) {
      // Drop remaining non-tracking params for clean canonical join URL
      normalized = true;
    }

    var outUrl = 'https://meet.google.com/' + code;

    warning =
      'Public posters with a Meet join link can let strangers into the meeting. Prefer a waiting room / host admission controls, and only paste links you are allowed to share.';

    return {
      payload: outUrl,
      url: outUrl,
      type: 'meeting',
      code: code,
      host: 'meet.google.com',
      source: 'url',
      warning: warning,
      normalized: normalized || strippedTracking,
      strippedTracking: strippedTracking
    };
  }

  global.MeetPayload = {
    buildMeetPayload: buildMeetPayload,
    isMeetHost: isMeetHost,
    MEET_CODE_RE: MEET_CODE_RE
  };
})(typeof window !== 'undefined' ? window : this);
