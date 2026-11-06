(function (global) {
  'use strict';

  /** Zoom meeting IDs are typically 9–11 digits. */
  var MEETING_ID_RE = /^\d{9,11}$/;

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

  function isZoomHost(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    if (host === 'zoom.us') return true;
    // Regional / vanity join hosts: us02web.zoom.us, us06web.zoom.us, etc.
    if (/\.zoom\.us$/.test(host)) return true;
    return false;
  }

  function looksLikeNonJoin(raw) {
    var s = String(raw || '').toLowerCase();
    if (/\/signin\b/.test(s)) return true;
    if (/\/signup\b/.test(s)) return true;
    if (/\/login\b/.test(s)) return true;
    if (/oauth2?/.test(s)) return true;
    if (/\/account\b/.test(s)) return true;
    if (/\/marketplace\b/.test(s)) return true;
    if (/\/profile\b/.test(s)) return true;
    if (/\/billing\b/.test(s)) return true;
    if (/\/admin\b/.test(s)) return true;
    if (/\/devtools\b/.test(s)) return true;
    if (/\/rest\b/.test(s) && /zoom/.test(s)) return true;
    return false;
  }

  function rejectNonJoin() {
    throw new Error(
      'This page is for Zoom meeting join links only—not sign-in, OAuth, account, or marketplace URLs. Paste a zoom.us/j/… or regional *.zoom.us/j/… join URL you are allowed to share.'
    );
  }

  /**
   * Strip known tracking query keys. Never strip pwd.
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
      // Never strip meeting password
      if (lower === 'pwd') continue;
      if (TRACKING_EXACT[lower] || lower.indexOf('utm_') === 0) {
        url.searchParams.delete(k);
        stripped = true;
      }
    }
    return { url: url, stripped: stripped };
  }

  function normalizeMeetingId(rawId) {
    var id = String(rawId || '');
    try {
      id = decodeURIComponent(id);
    } catch (e) {
      /* keep raw if malformed escape */
    }
    id = id.replace(/[\s-]+/g, '');
    if (!MEETING_ID_RE.test(id)) {
      throw new Error(
        'That Zoom meeting ID looks invalid. Meeting IDs are typically 9–11 digits (spaces or hyphens in the ID are OK and will be removed).'
      );
    }
    return id;
  }

  /**
   * Parse join path → { kind, meetingId, pathTemplate }.
   * kind: 'j' | 'wc-join'
   */
  function parseJoinPath(pathname) {
    var parts = String(pathname || '')
      .split('/')
      .filter(function (p) {
        return p.length > 0;
      });

    if (!parts.length) {
      throw new Error(
        'Paste a full Zoom join URL that includes /j/{meetingId} (or /wc/join/{meetingId}).'
      );
    }

    var p0 = parts[0].toLowerCase();

    // /j/{id}
    if (p0 === 'j') {
      if (parts.length < 2) {
        throw new Error('That Zoom /j/ link looks incomplete—missing the meeting ID.');
      }
      if (parts.length > 2) {
        throw new Error(
          'Unexpected path after the Zoom meeting ID. Paste a simple zoom.us/j/{id} or regional *.zoom.us/j/{id} link.'
        );
      }
      return { kind: 'j', meetingId: normalizeMeetingId(parts[1]), pathPrefix: '/j/' };
    }

    // /wc/join/{id}
    if (p0 === 'wc') {
      if (parts.length >= 2 && parts[1].toLowerCase() === 'join') {
        if (parts.length < 3) {
          throw new Error('That Zoom /wc/join/ link looks incomplete—missing the meeting ID.');
        }
        if (parts.length > 3) {
          throw new Error(
            'Unexpected path after the Zoom meeting ID. Paste zoom.us/wc/join/{id} only.'
          );
        }
        return {
          kind: 'wc-join',
          meetingId: normalizeMeetingId(parts[2]),
          pathPrefix: '/wc/join/'
        };
      }
    }

    // Explicit non-join paths already caught by looksLikeNonJoin; otherwise generic reject
    throw new Error(
      'That is not a Zoom meeting join path. Paste https://zoom.us/j/{meetingId} or a regional https://us02web.zoom.us/j/{meetingId} link (optional ?pwd=…).'
    );
  }

  /**
   * @param {string} input
   * @returns {{
   *   payload: string,
   *   url: string,
   *   type: string,
   *   meetingId: string,
   *   host: string,
   *   hasPwd: boolean,
   *   source: string,
   *   warning: string,
   *   normalized: boolean,
   *   strippedTracking: boolean,
   *   keptPwd: boolean
   * }}
   */
  function buildZoomPayload(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) {
      throw new Error('Paste a Zoom meeting join URL (zoom.us/j/… or *.zoom.us/j/…).');
    }

    if (looksLikeNonJoin(raw)) {
      rejectNonJoin();
    }

    var normalized = false;
    var strippedTracking = false;
    var warning = '';

    var candidate = raw;
    // Bare zoom.us/... or us02web.zoom.us/... without scheme
    if (!/^https?:\/\//i.test(candidate)) {
      if (/^([a-z0-9-]+\.)?zoom\.us\//i.test(candidate) || /^www\.zoom\.us\//i.test(candidate)) {
        candidate = 'https://' + candidate;
        normalized = true;
      } else {
        throw new Error(
          'Paste a Zoom zoom.us/j/… or regional *.zoom.us/j/… join link (not a bare word or non-Zoom URL).'
        );
      }
    }

    var url;
    try {
      url = new URL(candidate);
    } catch (e) {
      throw new Error(
        'That does not look like a valid Zoom join link. Paste https://zoom.us/j/… or https://us02web.zoom.us/j/… (optional ?pwd=…).'
      );
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Use an http(s) Zoom join URL.');
    }

    var hostRaw = (url.hostname || '').toLowerCase();
    var host = hostRaw.replace(/^www\./, '');
    if (!isZoomHost(host)) {
      throw new Error(
        'That is not a Zoom join host. Paste a zoom.us or *.zoom.us meeting join URL you are allowed to share.'
      );
    }

    if (looksLikeNonJoin(url.href) || looksLikeNonJoin(url.pathname)) {
      rejectNonJoin();
    }

    // Path-level reject for account-ish first segments
    var firstSeg = String(url.pathname || '')
      .split('/')
      .filter(function (p) {
        return p.length > 0;
      })[0];
    if (firstSeg) {
      var fs = firstSeg.toLowerCase();
      if (
        fs === 'signin' ||
        fs === 'signup' ||
        fs === 'login' ||
        fs === 'oauth' ||
        fs === 'oauth2' ||
        fs === 'account' ||
        fs === 'marketplace' ||
        fs === 'profile' ||
        fs === 'billing' ||
        fs === 'admin'
      ) {
        rejectNonJoin();
      }
    }

    var parsed = parseJoinPath(url.pathname);
    var meetingId = parsed.meetingId;

    // Detect ID cleanup (spaces/hyphens removed)
    var originalIdToken = String(url.pathname || '')
      .split('/')
      .filter(function (p) {
        return p.length > 0;
      });
    var rawIdPart =
      parsed.kind === 'j'
        ? originalIdToken[1]
        : parsed.kind === 'wc-join'
          ? originalIdToken[2]
          : '';
    if (rawIdPart && String(rawIdPart).replace(/[\s-]+/g, '') !== rawIdPart) {
      normalized = true;
    }
    if (rawIdPart && String(rawIdPart) !== meetingId) {
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

    var hasPwd = false;
    var pwdValue = null;
    url.searchParams.forEach(function (v, k) {
      if (String(k).toLowerCase() === 'pwd') {
        hasPwd = true;
        pwdValue = v;
      }
    });

    // Rebuild canonical HTTPS URL: keep host (minus www), join path, and non-tracking query (pwd required-keep)
    var out = new URL('https://' + host + parsed.pathPrefix + meetingId);
    // Copy remaining (non-tracking) params from stripped url — pwd and any other kept keys
    url.searchParams.forEach(function (v, k) {
      var lower = String(k).toLowerCase();
      if (TRACKING_EXACT[lower] || lower.indexOf('utm_') === 0) return;
      out.searchParams.append(k, v);
    });

    // Safety: if pwd was present on input, it MUST appear on output
    if (hasPwd) {
      var outHasPwd = false;
      out.searchParams.forEach(function (_v, k) {
        if (String(k).toLowerCase() === 'pwd') outHasPwd = true;
      });
      if (!outHasPwd) {
        // Restore pwd explicitly (should not happen if stripTracking is correct)
        out.searchParams.set('pwd', pwdValue == null ? '' : pwdValue);
      }
      warning =
        'This join URL includes a meeting password (?pwd=). Do not publicly post that QR or link in uncontrolled places (open social feeds, random public pages)—anyone who scans it can join with the password. Prefer invited attendees or controlled spaces (office poster, invite email, private group).';
    }

    var outUrl = out.toString();
    // URL.toString() may append trailing slash oddly; Zoom join paths should not have trailing slash after id
    // Ensure no trailing slash before query
    outUrl = outUrl.replace(/\/(\?|$)/, '$1');
    // But pathPrefix+/id should remain. Actually out.pathname is /j/123 — toString is fine.
    // Re-read: new URL('https://zoom.us/j/123') → href ends without slash. Good.

    return {
      payload: outUrl,
      url: outUrl,
      type: 'meeting',
      meetingId: meetingId,
      host: host,
      hasPwd: hasPwd,
      source: host + parsed.pathPrefix,
      warning: warning,
      normalized: normalized || strippedTracking,
      strippedTracking: strippedTracking,
      keptPwd: hasPwd
    };
  }

  global.ZoomPayload = {
    buildZoomPayload: buildZoomPayload,
    isZoomHost: isZoomHost,
    MEETING_ID_RE: MEETING_ID_RE
  };
})(typeof window !== 'undefined' ? window : this);
