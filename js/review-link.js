(function (global) {
  'use strict';

  // Typical Google Place ID pattern (ChIJ… or similar long alphanumeric)
  var PLACE_ID_RE = /^[A-Za-z0-9_-]{20,}$/;

  /**
   * Normalize user input into a Google review deep link, or throw a clear error.
   * Accepts:
   *  - raw Place ID (e.g. ChIJ…)
   *  - search.google.com/local/writereview?placeid=…
   *  - g.page/r/… review short links
   *  - maps.google.com / google.com/maps links that already include writereview or /review
   * Rejects obvious non-Google / non-review URLs.
   *
   * @param {string} input
   * @returns {{url:string, kind:string, warning?:string}}
   */
  function normalizeReviewLink(input) {
    var raw = String(input || '').trim();
    if (!raw) throw new Error('Paste a Google review link or Place ID.');

    // Bare Place ID
    if (!/^https?:\/\//i.test(raw) && !/\s/.test(raw) && PLACE_ID_RE.test(raw)) {
      return {
        url: 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(raw),
        kind: 'placeid'
      };
    }

    var url;
    try {
      // Allow protocol-relative or missing scheme
      var candidate = raw;
      if (!/^https?:\/\//i.test(candidate)) candidate = 'https://' + candidate;
      url = new URL(candidate);
    } catch (e) {
      throw new Error('That does not look like a valid URL or Place ID.');
    }

    var host = (url.hostname || '').toLowerCase().replace(/^www\./, '');
    var path = url.pathname || '';
    var href = url.href;

    var googleHosts = [
      'google.com',
      'google.co.uk',
      'google.ca',
      'google.com.au',
      'google.de',
      'google.fr',
      'google.co.jp',
      'maps.google.com',
      'maps.app.goo.gl',
      'goo.gl',
      'g.page',
      'search.google.com'
    ];

    function isGoogleHost(h) {
      if (googleHosts.indexOf(h) !== -1) return true;
      if (h === 'google.com' || h.endsWith('.google.com')) return true;
      if (/^google\.[a-z.]+$/.test(h)) return true;
      return false;
    }

    if (!isGoogleHost(host)) {
      throw new Error(
        'That link is not a Google URL. Paste an official Google review / Business Profile link, or a Place ID (ChIJ…).'
      );
    }

    // Already a writereview deep link
    if (/writereview/i.test(path) || /writereview/i.test(url.search)) {
      var placeFromQuery = url.searchParams.get('placeid') || url.searchParams.get('placeId');
      if (placeFromQuery) {
        return {
          url: 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(placeFromQuery),
          kind: 'writereview'
        };
      }
      return { url: href.split('#')[0], kind: 'writereview' };
    }

    // g.page/r/… review short links — keep as-is (these usually open the review flow)
    if (host === 'g.page' && /^\/r\//i.test(path)) {
      return { url: href.split('#')[0], kind: 'g.page' };
    }

    // Place ID embedded in Maps-style URLs (!1sChIJ… or placeid=)
    var placeParam = url.searchParams.get('placeid') || url.searchParams.get('placeId');
    if (placeParam && PLACE_ID_RE.test(placeParam)) {
      return {
        url: 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(placeParam),
        kind: 'placeid-from-url'
      };
    }
    var placeMatch = href.match(/!1s(ChIJ[A-Za-z0-9_-]+)/) || href.match(/[?&]q=place_id:(ChIJ[A-Za-z0-9_-]+)/i);
    if (placeMatch && placeMatch[1]) {
      return {
        url: 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(placeMatch[1]),
        kind: 'placeid-from-maps',
        warning: 'Converted a Maps place link into a review form link using the Place ID found in the URL.'
      };
    }

    // Generic Maps / Business Profile page — warn; still encode but tip user
    if (
      host.indexOf('google.') !== -1 &&
      (/\/maps/i.test(path) || /\/maps/i.test(href) || host.indexOf('maps.') === 0)
    ) {
      return {
        url: href.split('#')[0],
        kind: 'maps-page',
        warning:
          'This looks like a Maps / place page, not a dedicated “Get more reviews” link. Prefer Google’s official review link or a Place ID so guests open the review form directly.'
      };
    }

    // Other google.com links (search, accounts, etc.)
    if (/accounts\.google|support\.google|policies\.google|mail\.google/i.test(host + path)) {
      throw new Error(
        'That Google URL is not a review or Business Profile link. Use “Get more reviews” / Place ID / g.page/r/… instead.'
      );
    }

    // Fallback: allow other google.com https links with a soft warning
    return {
      url: href.split('#')[0],
      kind: 'google-other',
      warning:
        'Could not confirm this opens the review form. If guests only see a Maps listing, replace with Google’s official “Get more reviews” link or a Place ID.'
    };
  }

  global.ReviewLink = {
    normalizeReviewLink: normalizeReviewLink
  };
})(typeof window !== 'undefined' ? window : this);
