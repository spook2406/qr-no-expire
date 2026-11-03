(function (global) {
  'use strict';

  /**
   * Detect and strip common extension suffixes (not encoded into tel: payload).
   * Extension dialing via , ; ext x is unreliable across camera apps / dialers.
   */
  function stripExtension(raw) {
    var s = String(raw || '').trim();
    if (!s) return { number: '', hadExtension: false };
    // RFC 3966-style ;ext=…
    var m = s.match(/^(.+?);ext=.+$/i);
    if (m) return { number: m[1].trim(), hadExtension: true };
    // Trailing ,pause / ;wait / ext / x / #
    m = s.match(/^(.+?)(?:\s*(?:,|;|ext\.?|x|#)\s*[\d\s.\-]+)$/i);
    if (m) return { number: m[1].trim(), hadExtension: true };
    return { number: s, hadExtension: false };
  }

  /**
   * Normalize phone to E.164-ish digits with leading +.
   * Strips spaces, dashes, parentheses, dots; keeps a single leading +.
   */
  function normalizeTelPhone(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var hasPlus = s.charAt(0) === '+';
    var digits = s.replace(/[^\d]/g, '');
    if (!digits) return '';
    return '+' + digits;
  }

  function digitCount(e164) {
    return String(e164 || '').replace(/\D/g, '').length;
  }

  /**
   * Build RFC 3966 tel: payload (global-number form).
   * Extensions are never encoded — print them beside the QR instead.
   * @param {{phone:string}} opts
   * @returns {{payload:string, warning?:string, phone:string}}
   */
  function buildTelPayload(opts) {
    opts = opts || {};
    var stripped = stripExtension(opts.phone);
    var phone = normalizeTelPhone(stripped.number);
    if (!String(opts.phone || '').trim()) {
      throw new Error('Enter a phone number with country code (e.g. +12025550123).');
    }
    if (!phone) {
      throw new Error('Enter a valid phone number. Use digits with an international +country code.');
    }
    if (digitCount(phone) < 8) {
      throw new Error('Phone number is too short. Use international format with country code (e.g. +12025550123).');
    }
    if (digitCount(phone) > 15) {
      throw new Error('Phone number looks too long. Use E.164 international format without extra digits.');
    }
    var warning = '';
    if (stripped.hadExtension) {
      warning = 'Extension numbers are not encoded in the QR (unreliable across devices). Print the extension as a note beside the code.';
    }
    var payload = 'tel:' + phone;
    return { payload: payload, warning: warning, phone: phone };
  }

  global.PhonePayload = {
    stripExtension: stripExtension,
    normalizeTelPhone: normalizeTelPhone,
    digitCount: digitCount,
    buildTelPayload: buildTelPayload
  };
})(typeof window !== 'undefined' ? window : this);
