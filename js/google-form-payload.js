(function (global) {
  'use strict';

  /**
   * Google Form responder links only.
   * Accept docs.google.com/forms/…/viewform and forms.gle/… short links.
   * Reject edit, preview, and formResponse submit endpoints.
   * Normalization is local: no fetch, no short-link service.
   */

  var RESERVED_ID = {
    viewform: true,
    edit: true,
    preview: true,
    formresponse: true,
    forms: true,
    copy: true,
    template: true
  };

  function fail(message) {
    throw new Error(message);
  }

  function emptyError() {
    return 'Paste a Google Form responder link — https://docs.google.com/forms/…/viewform or https://forms.gle/… — from Send, Share, or Published.';
  }

  function domainError() {
    return 'That is not a Google Form responder link. Paste a docs.google.com/forms/…/viewform or forms.gle/… answer link. Other sites are not encoded.';
  }

  function notFormError() {
    return 'That Google link is not a Form. Paste the responder link from Send, Share, or Published (docs.google.com/forms/…/viewform or forms.gle/…).';
  }

  function editError() {
    return 'That is a Google Form edit link. Copy the responder (answer) link from Send, Share, or Published — not the editor URL ending in /edit. Edit links are not encoded.';
  }

  function previewError() {
    return 'That is a Google Form preview link. Preview is for the form owner. Copy the published responder link from Send, Share, or Published. Preview links are not encoded.';
  }

  function formResponseError() {
    return 'That URL is a formResponse submit endpoint, not the answer page. Paste the responder link (…/viewform or forms.gle/…) so a scan opens the form. Submit endpoints are not encoded.';
  }

  function notResponderError() {
    return 'Paste the published responder link that opens the form for answers. It should contain /viewform, or be a forms.gle short link from Send → Shorten URL. This page does not encode the editor.';
  }

  function assertId(id) {
    if (!/^[A-Za-z0-9_-]{4,200}$/.test(id) || RESERVED_ID[String(id).toLowerCase()]) {
      fail('That Google Form id looks invalid. Copy the responder link again from Send, Share, or Published.');
    }
  }

  function assertNotAdminQuery(url) {
    var usp = url.searchParams.get('usp') || '';
    if (/preview/i.test(usp)) fail(previewError());
    var editRequested = url.searchParams.get('edit_requested');
    if (editRequested && editRequested !== 'false' && editRequested !== '0') {
      fail(previewError());
    }
  }

  function rejectAdminSegments(parts) {
    var i;
    for (i = 0; i < parts.length; i++) {
      var seg = String(parts[i] || '').toLowerCase();
      if (seg === 'formresponse') fail(formResponseError());
      if (seg === 'edit') fail(editError());
      if (seg === 'preview') fail(previewError());
      if (seg === 'copy' || seg === 'template') {
        fail('That is a Google Form admin link (copy or template), not the responder link. Copy the answer link from Send, Share, or Published.');
      }
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
   *   normalized: boolean,
   *   strippedUserPrefix: boolean,
   *   appendedViewform: boolean
   * }}
   */
  function buildGoogleFormPayload(input) {
    var raw = String(input == null ? '' : input).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if ((raw.charAt(0) === '"' && raw.charAt(raw.length - 1) === '"') ||
        (raw.charAt(0) === "'" && raw.charAt(raw.length - 1) === "'")) {
      raw = raw.slice(1, -1).trim();
    }
    if (!raw) fail(emptyError());

    var looksLikeUrl =
      /^https?:\/\//i.test(raw) ||
      /^\/\//.test(raw) ||
      /^(www\.)?docs\.google\.com\b/i.test(raw) ||
      /^(www\.)?forms\.gle\b/i.test(raw);

    if (!looksLikeUrl) fail(domainError());

    var candidate = raw;
    var upgradedHttps = false;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = 'https://' + candidate.replace(/^\/\//, '');
      upgradedHttps = true;
    } else if (/^http:\/\//i.test(candidate)) {
      upgradedHttps = true;
    }

    var url;
    try {
      url = new URL(candidate);
    } catch (e) {
      fail('That does not look like a valid Google Form link. Paste https://docs.google.com/forms/…/viewform or https://forms.gle/…');
    }

    if (url.username || url.password) {
      fail('Paste the Google Form link without a username or password in the URL.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      fail('Use an http(s) Google Form responder link. Other schemes are not encoded.');
    }
    if (url.port && url.port !== '443' && url.port !== '80') {
      fail('That Google Form link uses an unexpected port. Paste the normal https responder link.');
    }

    var hostRaw = String(url.hostname || '').toLowerCase().replace(/\.$/, '');
    var strippedWww = /^www\./.test(hostRaw);
    var host = hostRaw.replace(/^www\./, '');
    if (host !== 'docs.google.com' && host !== 'forms.gle') fail(domainError());

    assertNotAdminQuery(url);

    var warning =
      'Posting this QR in public is a public response entry. Share only a form you have the right to share. A sign-in prompt, one response per person, or an organization limit comes from the form’s own settings — this QR does not bypass them.';

    if (host === 'forms.gle') {
      var glePath = String(url.pathname || '/');
      if (glePath.length > 1) glePath = glePath.replace(/\/+$/, '');
      var gleParts = glePath.split('/').filter(function (p) { return p.length > 0; });
      if (gleParts.length !== 1) {
        fail('Paste a forms.gle short responder link with one code, like https://forms.gle/abcDEFghi, from Send → Shorten URL.');
      }
      var slug = gleParts[0];
      var slugLower = slug.toLowerCase();
      if (slugLower === 'formresponse' || /formresponse$/i.test(slugLower)) fail(formResponseError());
      if (slugLower === 'edit') fail(editError());
      if (slugLower === 'preview') fail(previewError());
      if (!/^[A-Za-z0-9_-]{4,128}$/.test(slug)) {
        fail('That forms.gle code looks invalid. Turn on Shorten URL in Send and copy the responder link again.');
      }
      var glePayload = 'https://forms.gle/' + slug + (url.search || '');
      return {
        payload: glePayload,
        url: glePayload,
        type: 'short',
        host: 'forms.gle',
        warning: warning,
        normalized: upgradedHttps || strippedWww || url.protocol === 'http:' || !!url.hash,
        strippedUserPrefix: false,
        appendedViewform: false
      };
    }

    var pathname = String(url.pathname || '/');
    if (!/^\/forms(\/|$)/i.test(pathname)) fail(notFormError());

    var strippedUserPrefix = false;
    if (/^\/forms\/u\/\d+(?:\/|$)/i.test(pathname)) {
      pathname = pathname.replace(/^\/forms\/u\/\d+/i, '/forms');
      strippedUserPrefix = true;
    }
    if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
    if (/\/{2,}/.test(pathname)) {
      fail('That Google Form link has a broken path. Copy the responder link again from Send.');
    }

    var pathLower = pathname.toLowerCase();
    if (/formresponse$/i.test(pathLower)) fail(formResponseError());

    var parts = pathname.split('/').filter(function (p) { return p.length > 0; });
    rejectAdminSegments(parts);

    var lower = parts.map(function (p) { return p.toLowerCase(); });
    var id = '';
    var canonicalPath = '';
    var appendedViewform = false;

    if (lower.length === 5 && lower[0] === 'forms' && lower[1] === 'd' && lower[2] === 'e' && lower[4] === 'viewform') {
      id = parts[3];
      assertId(id);
      canonicalPath = '/forms/d/e/' + id + '/viewform';
    } else if (lower.length === 4 && lower[0] === 'forms' && lower[1] === 'd' && lower[2] === 'e') {
      id = parts[3];
      assertId(id);
      canonicalPath = '/forms/d/e/' + id + '/viewform';
      appendedViewform = true;
    } else if (lower.length === 4 && lower[0] === 'forms' && lower[1] === 'd' && lower[3] === 'viewform') {
      id = parts[2];
      assertId(id);
      canonicalPath = '/forms/d/' + id + '/viewform';
    } else {
      fail(notResponderError());
    }

    var payload = 'https://docs.google.com' + canonicalPath + (url.search || '');
    var normalized = upgradedHttps || strippedWww || strippedUserPrefix || appendedViewform ||
      url.protocol === 'http:' || !!url.hash || pathname !== canonicalPath;

    return {
      payload: payload,
      url: payload,
      type: 'responder',
      host: 'docs.google.com',
      warning: warning,
      normalized: normalized,
      strippedUserPrefix: strippedUserPrefix,
      appendedViewform: appendedViewform
    };
  }

  global.GoogleFormPayload = {
    buildGoogleFormPayload: buildGoogleFormPayload
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
