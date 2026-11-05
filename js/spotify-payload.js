(function (global) {
  'use strict';

  /** Spotify resource IDs are Base62-ish; typically 22 chars but allow a practical range. */
  var SPOTIFY_ID_RE = /^[A-Za-z0-9]{10,64}$/;
  var SUPPORTED_TYPES = { playlist: true, album: true, track: true, artist: true };
  var UNSUPPORTED_HINT = {
    episode: 'podcast episodes',
    show: 'podcast shows',
    user: 'user profiles',
    search: 'search pages',
    genre: 'genre pages',
    collection: 'collection pages',
    concert: 'concert pages'
  };

  /**
   * Query keys (and prefixes) stripped by default — tracking / share attribution.
   * Anything else is also dropped: canonical open.spotify URLs use path only.
   */
  var STRIP_EXACT = {
    si: true,
    context: true,
    nd: true,
    dl_branch: true,
    flow_id: true,
    go: true,
    sp_cid: true,
    feature: true
  };

  function isSpotifyOpenHost(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    return host === 'open.spotify.com';
  }

  function isSpotifyLinkHost(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    return host === 'spotify.link' || host === 'spotify.app.link';
  }

  function isSpotifyRelatedHost(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    if (isSpotifyOpenHost(host) || isSpotifyLinkHost(host)) return true;
    // Reject bare spotify.com marketing/account hosts as non-shareable content URLs
    return false;
  }

  /**
   * Drop intl-* locale segment: /intl-en/playlist/ID → /playlist/ID
   * @param {string[]} parts pathname segments (no empty leading)
   * @returns {string[]}
   */
  function dropIntlSegments(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (/^intl-[a-z0-9-]+$/i.test(parts[i])) continue;
      out.push(parts[i]);
    }
    return out;
  }

  /**
   * Parse open.spotify.com path into { type, id } or throw.
   * Supports:
   *   /playlist/{id}
   *   /album/{id}
   *   /track/{id}
   *   /artist/{id}
   *   /user/{user}/playlist/{id}
   * Intl prefixes already removed.
   */
  function parseOpenPath(pathname) {
    var parts = String(pathname || '')
      .split('/')
      .filter(function (p) { return p.length > 0; });
    parts = dropIntlSegments(parts);
    if (!parts.length) {
      throw new Error('Paste a full Spotify link that includes playlist, album, track, or artist.');
    }

    // /user/{name}/playlist/{id}
    if (parts[0] === 'user' && parts.length >= 4 && parts[2] === 'playlist') {
      var uid = parts[3].split('?')[0];
      if (!SPOTIFY_ID_RE.test(uid)) {
        throw new Error('Could not find a valid playlist ID in that Spotify URL.');
      }
      return { type: 'playlist', id: uid };
    }

    var type = String(parts[0] || '').toLowerCase();
    var id = parts[1] ? String(parts[1]).split('?')[0] : '';

    if (UNSUPPORTED_HINT[type]) {
      throw new Error(
        'This tool supports playlist, album, track, and artist links only—not ' +
          UNSUPPORTED_HINT[type] +
          '. Paste a public open.spotify.com link of a supported type.'
      );
    }

    if (!SUPPORTED_TYPES[type]) {
      throw new Error(
        'Unsupported Spotify path “/' +
          type +
          '”. Use a public playlist, album, track, or artist link from open.spotify.com.'
      );
    }

    if (!id || !SPOTIFY_ID_RE.test(id)) {
      throw new Error('Could not find a valid ' + type + ' ID in that Spotify URL.');
    }

    return { type: type, id: id };
  }

  /**
   * @param {string} input raw paste
   * @returns {{
   *   payload: string,
   *   url: string,
   *   type: string,
   *   id?: string,
   *   source: string,
   *   warning: string,
   *   strippedTracking: boolean
   * }}
   */
  function buildSpotifyPayload(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) {
      throw new Error('Paste a Spotify playlist, album, track, or artist URL.');
    }

    var candidate = raw;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = 'https://' + candidate;
    }

    var url;
    try {
      url = new URL(candidate);
    } catch (e) {
      throw new Error('That does not look like a valid URL. Paste an https://open.spotify.com/… link.');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Use an http(s) Spotify URL.');
    }

    var host = (url.hostname || '').toLowerCase().replace(/^www\./, '');

    // spotify.link short links — cannot resolve client-side without network; keep as-is + warn
    if (isSpotifyLinkHost(host)) {
      var shortPath = (url.pathname || '').replace(/\/+$/, '');
      if (!shortPath || shortPath === '/') {
        throw new Error('That spotify.link URL looks incomplete. Paste a full short link, or better: open it and copy the open.spotify.com address.');
      }
      var shortUrl = 'https://' + host + shortPath + (url.search || '');
      return {
        payload: shortUrl,
        url: shortUrl,
        type: 'short-link',
        source: 'spotify.link',
        warning:
          'Short spotify.link URLs cannot be fully normalized in the browser (no redirect fetch). Tracking params may remain. Prefer Share → Copy link from Spotify to get https://open.spotify.com/… for a clean canonical QR.',
        strippedTracking: false
      };
    }

    if (!isSpotifyOpenHost(host)) {
      throw new Error(
        'That is not an open.spotify.com or spotify.link URL. Paste a public Spotify link (playlist, album, track, or artist).'
      );
    }

    var hadQuery = !!(url.search && url.search.length > 1);
    var parsed = parseOpenPath(url.pathname);
    var canonical = 'https://open.spotify.com/' + parsed.type + '/' + parsed.id;

    return {
      payload: canonical,
      url: canonical,
      type: parsed.type,
      id: parsed.id,
      source: 'open.spotify.com',
      warning: '',
      strippedTracking: hadQuery
    };
  }

  global.SpotifyPayload = {
    buildSpotifyPayload: buildSpotifyPayload,
    parseOpenPath: parseOpenPath,
    dropIntlSegments: dropIntlSegments,
    isSpotifyOpenHost: isSpotifyOpenHost,
    isSpotifyLinkHost: isSpotifyLinkHost,
    SUPPORTED_TYPES: SUPPORTED_TYPES,
    STRIP_EXACT: STRIP_EXACT
  };
})(typeof window !== 'undefined' ? window : this);
