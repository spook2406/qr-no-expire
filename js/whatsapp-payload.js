(function (global) {
  'use strict';

  /**
   * Normalize to wa.me digits: strip spaces, (), -, and leading +.
   * Country calling code should be included in the input (e.g. 1 + 555...).
   */
  function normalizeWaDigits(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    return s.replace(/[^\d]/g, '');
  }

  /**
   * @param {{phone:string, message?:string, countryCode?:string}} opts
   *   phone may include country code, or pass countryCode separately (digits only).
   * @returns {{url:string, warning?:string, digits:string}}
   */
  function buildWhatsAppUrl(opts) {
    opts = opts || {};
    var cc = String(opts.countryCode || '').replace(/\D/g, '');
    var local = String(opts.phone || '').trim();
    var digits;
    if (cc) {
      // strip leading 0 from national number
      var national = local.replace(/[^\d]/g, '').replace(/^0+/, '');
      digits = cc + national;
    } else {
      digits = normalizeWaDigits(local);
    }
    if (!digits || digits.length < 8) {
      throw new Error('Enter a valid phone number with country code (digits only for wa.me, e.g. 15551234567).');
    }
    if (digits.length > 15) {
      throw new Error('Phone number looks too long for E.164.');
    }
    var message = opts.message == null ? '' : String(opts.message);
    var warning = '';
    if (message.length > 500) {
      warning = 'Prefilled message is very long; some WhatsApp clients may truncate it.';
    }
    var url = 'https://wa.me/' + digits;
    if (message) {
      url += '?text=' + encodeURIComponent(message);
    }
    return { url: url, warning: warning, digits: digits };
  }

  global.WhatsAppPayload = {
    normalizeWaDigits: normalizeWaDigits,
    buildWhatsAppUrl: buildWhatsAppUrl
  };
})(typeof window !== 'undefined' ? window : this);
