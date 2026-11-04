(function (global) {
  'use strict';

  /** Base32 alphabet (RFC 4648), no padding required for otpauth secrets. */
  var BASE32_RE = /^[A-Z2-7]+$/;

  /**
   * Strip spaces/hyphens and uppercase a secret candidate.
   * @param {string} raw
   * @returns {string}
   */
  function normalizeSecret(raw) {
    return String(raw == null ? '' : raw)
      .replace(/[\s\-]/g, '')
      .toUpperCase();
  }

  /**
   * Validate Base32 charset after normalize. Empty / invalid throw.
   * Too-short secrets (under 16 chars ≈ 80 bits) throw with guidance.
   * @param {string} raw
   * @returns {string} normalized secret
   */
  function validateSecret(raw) {
    var secret = normalizeSecret(raw);
    if (!secret) {
      throw new Error('Enter a Base32 secret (e.g. JBSWY3DPEHPK3PXP). Spaces are stripped automatically.');
    }
    if (!BASE32_RE.test(secret)) {
      throw new Error('Secret must be Base32 (A–Z and 2–7 only). Remove padding (=) if present, or fix invalid characters.');
    }
    // Practical guidance: ~16 Base32 chars ≈ 80 bits; shorter is weak for enrollment
    if (secret.length < 16) {
      throw new Error('Secret looks too short (need about 16+ Base32 characters / 80+ bits). Paste the full secret from your IdP or generate a new one.');
    }
    return secret;
  }

  /**
   * Percent-encode a path label segment per Key URI Format (encodeURIComponent).
   * @param {string} s
   * @returns {string}
   */
  function encodeLabelPart(s) {
    return encodeURIComponent(String(s));
  }

  /**
   * Build account label path: Issuer:account when issuer present, else account.
   * Path is percent-encoded; colon between issuer and account is literal.
   * @param {string} issuer
   * @param {string} account
   * @returns {string}
   */
  function buildLabelPath(issuer, account) {
    var acct = String(account || '').trim();
    if (!acct) {
      throw new Error('Enter an account label (e.g. user@example.com).');
    }
    var iss = String(issuer || '').trim();
    if (iss) {
      return encodeLabelPart(iss) + ':' + encodeLabelPart(acct);
    }
    return encodeLabelPart(acct);
  }

  /**
   * Defaults per Google Key URI Format / RFC 6238 common practice.
   */
  var DEFAULTS = {
    algorithm: 'SHA1',
    digits: 6,
    period: 30
  };

  /**
   * @param {{
   *   type?: string,
   *   issuer?: string,
   *   account?: string,
   *   secret?: string,
   *   algorithm?: string,
   *   digits?: string|number,
   *   period?: string|number,
   *   counter?: string|number
   * }} opts
   * @returns {{
   *   payload: string,
   *   type: string,
   *   secret: string,
   *   issuer: string,
   *   account: string,
   *   algorithm: string,
   *   digits: number,
   *   period: number,
   *   counter?: number,
   *   warning: string,
   *   nonDefault: boolean
   * }}
   *
   * URI policy: omit algorithm/digits/period when they equal defaults (SHA1/6/30)
   * to keep the otpauth URI short. HOTP always includes counter=.
   */
  function buildTotpPayload(opts) {
    opts = opts || {};
    var type = String(opts.type || 'totp').toLowerCase();
    if (type !== 'totp' && type !== 'hotp') type = 'totp';

    var issuer = String(opts.issuer || '').trim();
    var account = String(opts.account || '').trim();
    if (!account) {
      throw new Error('Enter an account label (e.g. user@example.com).');
    }

    var secret = validateSecret(opts.secret);
    var labelPath = buildLabelPath(issuer, account);

    var algoRaw = String(opts.algorithm || DEFAULTS.algorithm).trim().toUpperCase();
    if (algoRaw === 'SHA-1') algoRaw = 'SHA1';
    if (algoRaw === 'SHA-256') algoRaw = 'SHA256';
    if (algoRaw === 'SHA-512') algoRaw = 'SHA512';
    if (algoRaw !== 'SHA1' && algoRaw !== 'SHA256' && algoRaw !== 'SHA512') {
      throw new Error('Algorithm must be SHA1, SHA256, or SHA512.');
    }

    var digits = parseInt(opts.digits == null || opts.digits === '' ? DEFAULTS.digits : opts.digits, 10);
    if (digits !== 6 && digits !== 8) {
      throw new Error('Digits must be 6 or 8.');
    }

    var period = parseInt(opts.period == null || opts.period === '' ? DEFAULTS.period : opts.period, 10);
    if (!isFinite(period) || period < 1 || period > 3600) {
      throw new Error('Period must be a positive number of seconds (typically 30).');
    }

    var counter = null;
    if (type === 'hotp') {
      var cRaw = opts.counter;
      if (cRaw == null || String(cRaw).trim() === '') {
        throw new Error('HOTP requires a counter (non-negative integer, usually starting at 0).');
      }
      counter = parseInt(cRaw, 10);
      if (!isFinite(counter) || counter < 0 || String(counter) !== String(parseInt(cRaw, 10))) {
        throw new Error('Counter must be a non-negative integer.');
      }
    }

    var nonDefault =
      algoRaw !== DEFAULTS.algorithm ||
      digits !== DEFAULTS.digits ||
      (type === 'totp' && period !== DEFAULTS.period);

    var warning = '';
    if (nonDefault) {
      warning =
        'Compatibility warning: Google Authenticator and some apps may ignore non-default algorithm, digits, or period. Prefer SHA1 / 6 digits / 30s unless you control the verifier.';
    }

    var params = [];
    params.push('secret=' + secret);
    if (issuer) {
      params.push('issuer=' + encodeURIComponent(issuer));
    }
    // Include only non-defaults (documented policy)
    if (algoRaw !== DEFAULTS.algorithm) {
      params.push('algorithm=' + algoRaw);
    }
    if (digits !== DEFAULTS.digits) {
      params.push('digits=' + digits);
    }
    if (type === 'totp' && period !== DEFAULTS.period) {
      params.push('period=' + period);
    }
    if (type === 'hotp') {
      params.push('counter=' + counter);
    }

    var payload = 'otpauth://' + type + '/' + labelPath + '?' + params.join('&');

    return {
      payload: payload,
      type: type,
      secret: secret,
      issuer: issuer,
      account: account,
      algorithm: algoRaw,
      digits: digits,
      period: period,
      counter: type === 'hotp' ? counter : undefined,
      warning: warning,
      nonDefault: nonDefault
    };
  }

  /**
   * Cryptographically random Base32 secret (default 20 bytes → 32 Base32 chars / 160 bits).
   * @param {number} [byteLength=20]
   * @returns {string}
   */
  function generateRandomSecret(byteLength) {
    var n = byteLength == null ? 20 : byteLength;
    if (n < 10) n = 10;
    if (n > 64) n = 64;
    var bytes;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      bytes = new Uint8Array(n);
      crypto.getRandomValues(bytes);
    } else {
      bytes = new Uint8Array(n);
      for (var i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    var out = '';
    var buffer = 0;
    var bitsLeft = 0;
    for (var j = 0; j < bytes.length; j++) {
      buffer = (buffer << 8) | bytes[j];
      bitsLeft += 8;
      while (bitsLeft >= 5) {
        out += alphabet[(buffer >> (bitsLeft - 5)) & 31];
        bitsLeft -= 5;
      }
    }
    if (bitsLeft > 0) {
      out += alphabet[(buffer << (5 - bitsLeft)) & 31];
    }
    return out;
  }

  global.TotpPayload = {
    normalizeSecret: normalizeSecret,
    validateSecret: validateSecret,
    buildLabelPath: buildLabelPath,
    buildTotpPayload: buildTotpPayload,
    generateRandomSecret: generateRandomSecret,
    DEFAULTS: DEFAULTS
  };
})(typeof window !== 'undefined' ? window : this);
