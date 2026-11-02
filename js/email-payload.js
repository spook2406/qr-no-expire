(function (global) {
  'use strict';

  /**
   * Practical mailbox check (not full RFC 5322).
   * Requires local@domain with a dotted domain label; rejects spaces and empty parts.
   */
  function isValidEmail(raw) {
    var s = String(raw || '').trim();
    if (!s || /\s/.test(s)) return false;
    // Single @, non-empty local, domain with at least one dot and no consecutive dots.
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(s)) return false;
    if (s.indexOf('..') !== -1) return false;
    var at = s.lastIndexOf('@');
    var local = s.slice(0, at);
    var domain = s.slice(at + 1);
    if (!local || !domain || local.length > 64 || domain.length > 253) return false;
    return true;
  }

  /**
   * Normalize email: trim + lowercase domain (local part case preserved).
   */
  function normalizeEmail(raw) {
    var s = String(raw || '').trim();
    var at = s.lastIndexOf('@');
    if (at < 0) return s;
    return s.slice(0, at) + '@' + s.slice(at + 1).toLowerCase();
  }

  /**
   * Build RFC 6068 mailto payload.
   * @param {{email:string, subject?:string, body?:string}} opts
   * @returns {{payload:string, warning?:string, email:string}}
   */
  function buildMailtoPayload(opts) {
    opts = opts || {};
    var email = normalizeEmail(opts.email);
    if (!email) {
      throw new Error('Enter a recipient email address.');
    }
    if (!isValidEmail(email)) {
      throw new Error('Enter a valid email address (e.g. hello@example.com).');
    }
    var subject = opts.subject == null ? '' : String(opts.subject);
    var body = opts.body == null ? '' : String(opts.body);
    // Encode per RFC 6068; encodeURIComponent maps newlines to %0A.
    var parts = [];
    if (subject) parts.push('subject=' + encodeURIComponent(subject));
    if (body) parts.push('body=' + encodeURIComponent(body));
    var payload = 'mailto:' + email + (parts.length ? '?' + parts.join('&') : '');
    var warning = '';
    var totalLen = subject.length + body.length;
    if (body.length > 400 || totalLen > 500) {
      warning = 'Subject/body are long; the QR becomes denser and may be harder to scan at small print sizes.';
    }
    return { payload: payload, warning: warning, email: email };
  }

  global.EmailPayload = {
    isValidEmail: isValidEmail,
    normalizeEmail: normalizeEmail,
    buildMailtoPayload: buildMailtoPayload
  };
})(typeof window !== 'undefined' ? window : this);
