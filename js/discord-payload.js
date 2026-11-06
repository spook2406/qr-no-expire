(function (global) {
  'use strict';

  /** Discord invite / vanity codes: letters, digits, hyphen; practical 2–32 length. */
  var INVITE_CODE_RE = /^[A-Za-z0-9-]{2,32}$/;

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

  function isDiscordInviteHost(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    return (
      host === 'discord.gg' ||
      host === 'discord.com' ||
      host === 'discordapp.com'
    );
  }

  function looksLikeLoginOrOauth(raw) {
    var s = String(raw || '').toLowerCase();
    if (/oauth2?/.test(s)) return true;
    if (/\/login\b/.test(s)) return true;
    if (/\/api\//.test(s)) return true;
    if (/authorize/.test(s) && /discord/.test(s)) return true;
    if (/[?&#](client_id|response_type|scope)=/.test(s) && /discord/.test(s)) return true;
    return false;
  }

  function rejectLogin() {
    throw new Error(
      'This page is for Discord invite / server links only—not login, OAuth, or authorization URLs. Paste a discord.gg or discord.com/invite link you are allowed to share.'
    );
  }

  function rejectChannels() {
    throw new Error(
      'This page encodes Discord invite links, not discord.com/channels/… server or channel deep links. Paste a discord.gg / discord.com/invite URL instead.'
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

  function validateInviteCode(code) {
    var c = String(code || '').trim();
    if (!INVITE_CODE_RE.test(c)) {
      throw new Error(
        'That Discord invite code looks invalid. Use a discord.gg / discord.com/invite code with letters, digits, or hyphens (typically 2–32 characters).'
      );
    }
    return c;
  }

  /**
   * @param {string} input
   * @returns {{
   *   payload: string,
   *   url: string,
   *   type: string,
   *   code: string,
   *   source: string,
   *   warning: string,
   *   normalized: boolean,
   *   strippedTracking: boolean
   * }}
   */
  function buildDiscordPayload(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) {
      throw new Error('Paste a Discord invite link (discord.gg/… or discord.com/invite/…).');
    }

    if (looksLikeLoginOrOauth(raw)) {
      rejectLogin();
    }

    var normalized = false;
    var strippedTracking = false;
    var warning = '';

    var candidate = raw;
    // Bare discord.gg/... or discord.com/invite/... without scheme
    if (!/^https?:\/\//i.test(candidate)) {
      if (
        /^(discord\.gg|discord\.com|discordapp\.com|www\.(discord\.gg|discord\.com|discordapp\.com))\//i.test(
          candidate
        )
      ) {
        candidate = 'https://' + candidate;
        normalized = true;
      } else {
        throw new Error(
          'Paste a Discord discord.gg or discord.com/invite link (not a bare word or non-Discord URL).'
        );
      }
    }

    var url;
    try {
      url = new URL(candidate);
    } catch (e) {
      throw new Error(
        'That does not look like a valid Discord invite link. Paste https://discord.gg/… or https://discord.com/invite/….'
      );
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Use an http(s) Discord invite URL.');
    }

    var host = (url.hostname || '').toLowerCase().replace(/^www\./, '');
    if (!isDiscordInviteHost(host)) {
      throw new Error(
        'That is not a Discord invite host. Paste a discord.gg or discord.com/invite URL you are allowed to share.'
      );
    }

    if (looksLikeLoginOrOauth(url.href) || looksLikeLoginOrOauth(url.pathname)) {
      rejectLogin();
    }

    var parts = String(url.pathname || '')
      .split('/')
      .filter(function (p) {
        return p.length > 0;
      });

    // discord.com/channels/... — not invites
    if (parts.length && parts[0].toLowerCase() === 'channels') {
      rejectChannels();
    }

    // login / oauth paths
    if (parts.length) {
      var p0 = parts[0].toLowerCase();
      if (p0 === 'login' || p0 === 'oauth2' || p0 === 'oauth' || p0 === 'api') {
        rejectLogin();
      }
    }

    var code = '';
    var source = host;

    if (host === 'discord.gg') {
      if (!parts.length) {
        throw new Error('Paste a full Discord invite that includes a code after discord.gg/.');
      }
      if (parts.length > 1) {
        throw new Error(
          'Unexpected path after the Discord invite code. Paste a simple discord.gg/CODE or discord.com/invite/CODE link.'
        );
      }
      code = validateInviteCode(parts[0]);
      source = 'discord.gg';
    } else if (host === 'discord.com' || host === 'discordapp.com') {
      // Expect /invite/CODE
      if (!parts.length || parts[0].toLowerCase() !== 'invite') {
        if (parts.length && parts[0].toLowerCase() === 'channels') {
          rejectChannels();
        }
        throw new Error(
          'On discord.com / discordapp.com, paste an /invite/CODE link (not channels, login, or other paths).'
        );
      }
      if (parts.length < 2) {
        throw new Error('That discord.com/invite link looks incomplete—missing the invite code.');
      }
      if (parts.length > 2) {
        throw new Error(
          'Unexpected path after the Discord invite code. Paste discord.com/invite/CODE only.'
        );
      }
      code = validateInviteCode(parts[1]);
      source = host === 'discordapp.com' ? 'discordapp.com/invite' : 'discord.com/invite';
      normalized = true;
    }

    var stripResult = stripTracking(url);
    if (stripResult.stripped) {
      strippedTracking = true;
      normalized = true;
    }
    // Drop remaining query/hash for a stable invite QR
    if (url.search && url.search.length > 1) {
      strippedTracking = true;
      normalized = true;
    }
    if (url.hash) {
      normalized = true;
    }

    if (url.protocol === 'http:') {
      normalized = true;
    }
    if (/^www\./i.test(url.hostname || '')) {
      normalized = true;
    }

    var outUrl = 'https://discord.gg/' + code;

    return {
      payload: outUrl,
      url: outUrl,
      type: 'invite',
      code: code,
      source: source,
      warning: warning,
      normalized: normalized || strippedTracking || source !== 'discord.gg',
      strippedTracking: strippedTracking
    };
  }

  global.DiscordPayload = {
    buildDiscordPayload: buildDiscordPayload,
    isDiscordInviteHost: isDiscordInviteHost,
    INVITE_CODE_RE: INVITE_CODE_RE
  };
})(typeof window !== 'undefined' ? window : this);
