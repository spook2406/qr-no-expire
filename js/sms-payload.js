(function (global) {
  'use strict';

  /**
   * Normalize phone to E.164-ish digits with leading +.
   * Strips spaces, dashes, parentheses; keeps a single leading +.
   */
  function normalizeSmsPhone(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var hasPlus = s.charAt(0) === '+';
    var digits = s.replace(/[^\d]/g, '');
    if (!digits) return '';
    return (hasPlus ? '+' : '+') + digits;
  }

  /**
   * Digits only length check (excluding +).
   */
  function digitCount(e164) {
    return String(e164 || '').replace(/\D/g, '').length;
  }

  /**
   * Build SMSTO payload.
   * @param {{phone:string, message?:string}} opts
   * @returns {{payload:string, warning?:string}}
   */
  function buildSmsPayload(opts) {
    opts = opts || {};
    var phone = normalizeSmsPhone(opts.phone);
    var message = opts.message == null ? '' : String(opts.message);
    if (!phone || digitCount(phone) < 8) {
      throw new Error('Enter a valid phone number with country code (e.g. +15551234567).');
    }
    if (digitCount(phone) > 15) {
      throw new Error('Phone number looks too long. Use international format without extra digits.');
    }
    var warning = '';
    if (message.length > 160) {
      warning = 'Message is longer than 160 characters; some carriers split into multiple SMS segments.';
    }
    var payload = message ? ('SMSTO:' + phone + ':' + message) : ('SMSTO:' + phone);
    return { payload: payload, warning: warning, phone: phone };
  }

  global.SmsPayload = {
    normalizeSmsPhone: normalizeSmsPhone,
    digitCount: digitCount,
    buildSmsPayload: buildSmsPayload
  };
})(typeof window !== 'undefined' ? window : this);
