(function (global) {
  'use strict';

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

  function isTeamsJoinHost(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    if (host === 'teams.microsoft.com') return true;
    if (host === 'teams.live.com') return true;
    // Tenant / regional hosts that still serve Teams join under microsoft.com
    if (/\.teams\.microsoft\.com$/.test(host)) return true;
    return false;
  }

  function isSafeLinksHost(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    // nam01.safelinks.protection.outlook.com, safelinks.protection.outlook.com, etc.
    if (host === 'safelinks.protection.outlook.com') return true;
    if (/\.safelinks\.protection\.outlook\.com$/.test(host)) return true;
    return false;
  }

  function looksLikeNonJoin(raw) {
    var s = String(raw || '').toLowerCase();
    if (/\/signin\b/.test(s)) return true;
    if (/\/signup\b/.test(s)) return true;
    if (/\/login\b/.test(s)) return true;
    if (/oauth2?/.test(s)) return true;
    if (/\/admin\b/.test(s)) return true;
    if (/\/download\b/.test(s) && /teams/.test(s)) return true;
    if (/\/store\b/.test(s) && /teams/.test(s)) return true;
    if (/appsource/.test(s)) return true;
    if (/\/account\b/.test(s)) return true;
    if (/\/billing\b/.test(s)) return true;
    return false;
  }

  function rejectNonJoin() {
    throw new Error(
      'This page is for Microsoft Teams meeting join links only—not sign-in, admin, download, or store pages. Paste a full teams.microsoft.com/l/meetup-join/… (or teams.live.com) join URL you are allowed to share.'
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
      // Keep Teams join-critical params (context, etc.) — only strip obvious tracking
      if (TRACKING_EXACT[lower] || lower.indexOf('utm_') === 0) {
        url.searchParams.delete(k);
        stripped = true;
      }
    }
    return { url: url, stripped: stripped };
  }

  /**
   * True when pathname contains /l/meetup-join/ (case-insensitive).
   */
  function hasMeetupJoinPath(pathname) {
    var p = String(pathname || '').toLowerCase();
    return p.indexOf('/l/meetup-join/') !== -1 || /\/l\/meetup-join\/?$/.test(p);
  }

  /**
   * Extract the join path starting at /l/meetup-join/… preserving the rest of the path.
   * Do NOT rewrite or invent tokens.
   */
  function extractMeetupJoinPath(pathname) {
    var raw = String(pathname || '');
    var lower = raw.toLowerCase();
    var idx = lower.indexOf('/l/meetup-join/');
    if (idx === -1) {
      // Allow trailing /l/meetup-join with nothing after (rare) — still not useful without token
      idx = lower.indexOf('/l/meetup-join');
      if (idx === -1) return null;
      var restBare = raw.slice(idx);
      if (/^\/l\/meetup-join\/?$/i.test(restBare)) {
        return null; // no token
      }
    }
    return raw.slice(idx);
  }

  function unwrapSafeLinks(raw) {
    var candidate = String(raw || '').trim();
    if (!/^https?:\/\//i.test(candidate) && !/safelinks\.protection\.outlook\.com/i.test(candidate)) {
      return null;
    }
    var withScheme = candidate;
    if (!/^https?:\/\//i.test(withScheme)) {
      withScheme = 'https://' + withScheme.replace(/^\/\//, '');
    }
    var wrapped;
    try {
      wrapped = new URL(withScheme);
    } catch (e) {
      return null;
    }
    if (!isSafeLinksHost(wrapped.hostname)) {
      return null;
    }
    var inner = wrapped.searchParams.get('url');
    if (!inner) {
      throw new Error(
        'That looks like an Outlook Safe Links wrapper, but no url= parameter was found. Paste the underlying Teams meetup-join link, or a Safe Links URL that includes url=… pointing at Teams.'
      );
    }
    // searchParams.get already decodes once. Only unwrap a second layer when the
    // whole value is still a percent-encoded URL (https%3A%2F%2F...), so we do not
    // turn path tokens like 19%3ameeting_… into 19:meeting_ before URL parsing.
    var decoded = inner;
    if (/^https?%3A/i.test(inner) || /^https?%253A/i.test(inner)) {
      try {
        decoded = decodeURIComponent(inner);
      } catch (e) {
        decoded = inner;
      }
      // Extremely rare triple-wrap
      if (/^https?%3A/i.test(decoded)) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch (e2) {
          /* keep */
        }
      }
    }
    return { inner: decoded, fromSafeLinks: true };
  }

  /**
   * @param {string} input
   * @returns {{
   *   payload: string,
   *   url: string,
   *   type: string,
   *   host: string,
   *   path: string,
   *   source: string,
   *   warning: string,
   *   normalized: boolean,
   *   strippedTracking: boolean,
   *   fromSafeLinks: boolean
   * }}
   */
  function buildTeamsPayload(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) {
      throw new Error(
        'Paste a full Microsoft Teams meeting join URL (teams.microsoft.com/l/meetup-join/… or teams.live.com). Bare meeting IDs are not supported in this version.'
      );
    }

    var fromSafeLinks = false;
    var working = raw;

    // Try Safe Links unwrap first when host matches
    var unwrapped = null;
    try {
      unwrapped = unwrapSafeLinks(raw);
    } catch (e) {
      throw e;
    }
    if (unwrapped) {
      fromSafeLinks = true;
      working = unwrapped.inner;
      if (!working || !String(working).trim()) {
        throw new Error(
          'Outlook Safe Links unwrap failed: the url= value was empty. Paste the real Teams meetup-join link instead.'
        );
      }
    }

    if (looksLikeNonJoin(working) && !/meetup-join/i.test(working)) {
      rejectNonJoin();
    }

    var normalized = false;
    var strippedTracking = false;
    var warning = '';

    var candidate = String(working).trim();
    if (!/^https?:\/\//i.test(candidate)) {
      // Scheme-less hosts we accept
      if (
        /^(www\.)?(teams\.microsoft\.com|teams\.live\.com|[a-z0-9.-]+\.teams\.microsoft\.com)\//i.test(
          candidate
        )
      ) {
        candidate = 'https://' + candidate.replace(/^\/\//, '');
        normalized = true;
      } else if (/safelinks\.protection\.outlook\.com/i.test(candidate)) {
        // Nested / missed earlier — try again with scheme
        var again = unwrapSafeLinks('https://' + candidate.replace(/^\/\//, ''));
        if (again) {
          fromSafeLinks = true;
          candidate = again.inner;
          if (!/^https?:\/\//i.test(candidate)) {
            candidate = 'https://' + String(candidate).replace(/^\/\//, '');
          }
          normalized = true;
        } else {
          throw new Error(
            'Could not unwrap that Outlook Safe Links URL to a Teams join link. Paste the underlying teams.microsoft.com/l/meetup-join/… URL.'
          );
        }
      } else {
        throw new Error(
          'Paste a full Microsoft Teams meetup-join URL (https://teams.microsoft.com/l/meetup-join/…). This version does not invent join paths from bare meeting IDs.'
        );
      }
    }

    var url;
    try {
      url = new URL(candidate);
    } catch (e) {
      throw new Error(
        fromSafeLinks
          ? 'Outlook Safe Links unwrap produced an invalid URL. Paste the underlying Teams meetup-join link instead.'
          : 'That does not look like a valid Teams meeting join URL. Paste a full https://teams.microsoft.com/l/meetup-join/… link.'
      );
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Use an http(s) Microsoft Teams meeting join URL.');
    }

    // If after Safe Links we somehow still have Safe Links, fail clearly
    if (isSafeLinksHost(url.hostname)) {
      throw new Error(
        'Could not unwrap that Outlook Safe Links URL to a Teams join link. Paste the underlying teams.microsoft.com/l/meetup-join/… URL.'
      );
    }

    var hostRaw = (url.hostname || '').toLowerCase();
    var host = hostRaw.replace(/^www\./, '');

    // Reject Zoom / Meet clearly
    if (/zoom\.us$/i.test(host) || host === 'zoom.us') {
      throw new Error(
        'That is a Zoom link, not Microsoft Teams. Use the Zoom meeting QR page, or paste a teams.microsoft.com/l/meetup-join/… URL.'
      );
    }
    if (host === 'meet.google.com') {
      throw new Error(
        'That is a Google Meet link, not Microsoft Teams. Use the Google Meet QR page, or paste a teams.microsoft.com/l/meetup-join/… URL.'
      );
    }

    if (!isTeamsJoinHost(host)) {
      throw new Error(
        fromSafeLinks
          ? 'Outlook Safe Links unwrap did not point at a Teams meetup-join URL. Paste a teams.microsoft.com or teams.live.com join link.'
          : 'That is not a Microsoft Teams join host. Paste a full teams.microsoft.com/l/meetup-join/… or teams.live.com meetup-join URL you are allowed to share.'
      );
    }

    if (looksLikeNonJoin(url.href) && !hasMeetupJoinPath(url.pathname)) {
      rejectNonJoin();
    }

    var joinPath = extractMeetupJoinPath(url.pathname);
    if (!joinPath) {
      // Non-join Teams page
      if (
        /^\/?$/.test(url.pathname) ||
        /\/(download|store|admin|login|signin|signup|account)/i.test(url.pathname)
      ) {
        rejectNonJoin();
      }
      throw new Error(
        'Paste a full Teams meeting join URL that includes /l/meetup-join/… (with the join token in the path). Bare meeting IDs and non-join Teams pages are not accepted.'
      );
    }

    // Preserve path token exactly (do not rewrite). Only normalize host/protocol/www/hash/tracking.
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
    if (fromSafeLinks) {
      normalized = true;
    }

    // Rebuild: https + original host (without www) + preserved join path + remaining query
    // Keep the original non-www host so tenant/regional hosts stay intact.
    var outHost = host; // already www-stripped
    var search = stripResult.url.search || '';
    // pathname: use exact joinPath from original (preserves token casing)
    // Ensure joinPath starts with /
    if (joinPath.charAt(0) !== '/') {
      joinPath = '/' + joinPath;
    }

    var outUrl = 'https://' + outHost + joinPath + search;

    warning =
      'Public posters with a Teams join link can let attendees into the meeting (subject to lobby / org policy). Only paste links you are allowed to share. Encoding the URL does not bypass Teams admission controls.';

    return {
      payload: outUrl,
      url: outUrl,
      type: 'meeting',
      host: outHost,
      path: joinPath,
      source: fromSafeLinks ? 'safelinks' : 'url',
      warning: warning,
      normalized: normalized || strippedTracking,
      strippedTracking: strippedTracking,
      fromSafeLinks: fromSafeLinks
    };
  }

  global.TeamsPayload = {
    buildTeamsPayload: buildTeamsPayload,
    isTeamsJoinHost: isTeamsJoinHost,
    isSafeLinksHost: isSafeLinksHost
  };
})(typeof window !== 'undefined' ? window : this);
