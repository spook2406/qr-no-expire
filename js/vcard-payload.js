(function (global) {
  'use strict';

  /**
   * Escape special characters for vCard 3.0 text values (\, ;, ,, newlines).
   */
  function escapeVCard(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  /**
   * Build a vCard 3.0 payload for QR encoding.
   * @param {{
   *   firstName?:string, lastName?:string, fullName?:string,
   *   org?:string, title?:string, phone?:string, email?:string,
   *   url?:string, street?:string, city?:string, region?:string,
   *   postal?:string, country?:string
   * }} opts
   * @returns {string}
   */
  function buildVCardPayload(opts) {
    opts = opts || {};
    var first = String(opts.firstName || '').trim();
    var last = String(opts.lastName || '').trim();
    var fn = String(opts.fullName || '').trim();
    if (!fn) {
      fn = [first, last].filter(Boolean).join(' ').trim();
    }
    if (!fn) {
      throw new Error('Enter a name (full name, or first/last).');
    }

    var lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:' + escapeVCard(last) + ';' + escapeVCard(first) + ';;;',
      'FN:' + escapeVCard(fn)
    ];

    var org = String(opts.org || '').trim();
    if (org) lines.push('ORG:' + escapeVCard(org));

    var title = String(opts.title || '').trim();
    if (title) lines.push('TITLE:' + escapeVCard(title));

    var phone = String(opts.phone || '').trim();
    if (phone) lines.push('TEL;TYPE=CELL:' + escapeVCard(phone));

    var email = String(opts.email || '').trim();
    if (email) lines.push('EMAIL;TYPE=INTERNET:' + escapeVCard(email));

    var url = String(opts.url || '').trim();
    if (url) {
      if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
        url = 'https://' + url;
      }
      lines.push('URL:' + escapeVCard(url));
    }

    var street = String(opts.street || '').trim();
    var city = String(opts.city || '').trim();
    var region = String(opts.region || '').trim();
    var postal = String(opts.postal || '').trim();
    var country = String(opts.country || '').trim();
    if (street || city || region || postal || country) {
      lines.push(
        'ADR;TYPE=WORK:;;' +
          escapeVCard(street) + ';' +
          escapeVCard(city) + ';' +
          escapeVCard(region) + ';' +
          escapeVCard(postal) + ';' +
          escapeVCard(country)
      );
    }

    lines.push('END:VCARD');
    return lines.join('\n');
  }

  global.VCardPayload = {
    escapeVCard: escapeVCard,
    buildVCardPayload: buildVCardPayload
  };
})(typeof window !== 'undefined' ? window : this);
