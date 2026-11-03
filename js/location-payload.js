(function (global) {
  'use strict';

  /**
   * Parse a coordinate string; trim whitespace; reject empty/NaN/out-of-range.
   * @param {string|number} raw
   * @param {string} label
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function parseCoord(raw, label, min, max) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) {
      throw new Error('Enter a ' + label + ' (e.g. ' + (label === 'latitude' ? '40.7128' : '-74.0060') + ').');
    }
    // Allow trailing degree symbol / N/S/E/W lightly stripped after numeric part
    s = s.replace(/°/g, '').replace(/,/g, '');
    var n = Number(s);
    if (!isFinite(n)) {
      throw new Error(label.charAt(0).toUpperCase() + label.slice(1) + ' must be a number.');
    }
    if (n < min || n > max) {
      throw new Error(label.charAt(0).toUpperCase() + label.slice(1) + ' must be between ' + min + ' and ' + max + '.');
    }
    return n;
  }

  /**
   * Format a coordinate for URIs without unnecessary trailing zeros.
   * Keeps enough precision for maps (up to 6 decimal places).
   */
  function formatCoord(n) {
    var s = Number(n).toFixed(6);
    s = s.replace(/\.?0+$/, '');
    if (s === '-0') s = '0';
    return s;
  }

  /**
   * Build a Google Maps search URL from lat/lng and/or a query/address.
   * Prefer https://maps.google.com/?q=… (cross-device friendly).
   */
  function buildMapsUrl(lat, lng, query) {
    var q = String(query || '').trim();
    if (lat != null && lng != null && isFinite(lat) && isFinite(lng)) {
      var coord = formatCoord(lat) + ',' + formatCoord(lng);
      if (q) {
        // Include both so Maps can show a labeled pin when possible
        return 'https://maps.google.com/?q=' + encodeURIComponent(q + ' @' + coord);
      }
      return 'https://maps.google.com/?q=' + encodeURIComponent(coord);
    }
    if (q) {
      return 'https://maps.google.com/?q=' + encodeURIComponent(q);
    }
    throw new Error('Enter latitude & longitude, or a place name / address.');
  }

  /**
   * Build geo: URI (RFC 5870-style simple form).
   * geo:lat,lon — no altitude. Query/label not encoded (keep payload short & portable).
   */
  function buildGeoUri(lat, lng) {
    return 'geo:' + formatCoord(lat) + ',' + formatCoord(lng);
  }

  /**
   * @param {{mode?:string, lat?:string|number, lng?:string|number, query?:string}} opts
   *   mode: 'maps' (default) | 'geo'
   * @returns {{payload:string, mode:string, warning?:string, lat?:number, lng?:number, query?:string, mapsUrl?:string}}
   */
  function buildLocationPayload(opts) {
    opts = opts || {};
    var mode = String(opts.mode || 'maps').toLowerCase();
    if (mode !== 'maps' && mode !== 'geo') mode = 'maps';

    var latRaw = opts.lat;
    var lngRaw = opts.lng;
    var query = String(opts.query || '').trim();
    var hasLat = String(latRaw == null ? '' : latRaw).trim() !== '';
    var hasLng = String(lngRaw == null ? '' : lngRaw).trim() !== '';

    var lat = null;
    var lng = null;
    var warning = '';

    if (mode === 'geo') {
      if (!hasLat || !hasLng) {
        throw new Error('geo: mode needs both latitude and longitude.');
      }
      lat = parseCoord(latRaw, 'latitude', -90, 90);
      lng = parseCoord(lngRaw, 'longitude', -180, 180);
      if (query) {
        warning = 'Place name/address is not encoded in geo: payloads (kept short for scanners). Print the label beside the QR if needed.';
      }
      var geoPayload = buildGeoUri(lat, lng);
      return {
        payload: geoPayload,
        mode: 'geo',
        warning: warning,
        lat: lat,
        lng: lng,
        query: query || undefined,
        mapsUrl: buildMapsUrl(lat, lng, '')
      };
    }

    // maps mode (default)
    if (hasLat || hasLng) {
      if (!hasLat || !hasLng) {
        throw new Error('Enter both latitude and longitude, or leave both blank and use a place name / address.');
      }
      lat = parseCoord(latRaw, 'latitude', -90, 90);
      lng = parseCoord(lngRaw, 'longitude', -180, 180);
    }
    if (lat == null && lng == null && !query) {
      throw new Error('Enter latitude & longitude, or a place name / address.');
    }

    var mapsPayload = buildMapsUrl(lat, lng, query);
    return {
      payload: mapsPayload,
      mode: 'maps',
      warning: warning,
      lat: lat == null ? undefined : lat,
      lng: lng == null ? undefined : lng,
      query: query || undefined,
      mapsUrl: mapsPayload
    };
  }

  global.LocationPayload = {
    parseCoord: parseCoord,
    formatCoord: formatCoord,
    buildMapsUrl: buildMapsUrl,
    buildGeoUri: buildGeoUri,
    buildLocationPayload: buildLocationPayload
  };
})(typeof window !== 'undefined' ? window : this);
