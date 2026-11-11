(function () {
  'use strict';

  var canvas = document.getElementById('qr-canvas');
  var empty = document.getElementById('preview-empty');
  var errEl = document.getElementById('form-error');
  var warnEl = document.getElementById('form-warning');
  var payloadEl = document.getElementById('payload-out');
  var downloadPng = document.getElementById('download-png');
  var downloadSvg = document.getElementById('download-svg');
  var copyBtn = document.getElementById('copy-payload');
  var lastSvg = '';

  function showError(msg) { QRCore.showError(errEl, msg); }
  function showWarn(msg) { QRCore.showWarn(warnEl, msg); }
  function setButtons(enabled) {
    QRCore.setDisabled([downloadPng, downloadSvg, copyBtn], enabled);
  }
  function getOptions() { return QRCore.getOptions(); }

  function selectedType() {
    var checked = document.querySelector('input[name="otp-type"]:checked');
    return checked ? checked.value : 'totp';
  }

  function syncTypeHints() {
    var type = selectedType();
    var counterField = document.getElementById('field-counter');
    var periodField = document.getElementById('field-period');
    var hint = document.getElementById('type-hint');
    if (counterField) counterField.hidden = type !== 'hotp';
    if (periodField) periodField.hidden = type !== 'totp';
    if (hint) {
      if (type === 'hotp') {
        hint.textContent = 'HOTP uses a counter that increments per use. Most authenticator apps expect TOTP (time-based).';
      } else {
        hint.textContent = 'TOTP (time-based) is what Google Authenticator and most apps expect. Defaults: SHA1, 6 digits, 30-second period.';
      }
    }
  }

  function collectOpts() {
    return {
      type: selectedType(),
      issuer: (document.getElementById('otp-issuer').value || ''),
      account: (document.getElementById('otp-account').value || ''),
      secret: (document.getElementById('otp-secret').value || ''),
      algorithm: (document.getElementById('otp-algorithm').value || 'SHA1'),
      digits: (document.getElementById('otp-digits').value || '6'),
      period: (document.getElementById('otp-period').value || '30'),
      counter: (document.getElementById('otp-counter').value || '')
    };
  }

  function generate() {
    showError('');
    showWarn('');
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      return;
    }
    if (!window.TotpPayload) {
      showError('TOTP helper failed to load. Refresh the page.');
      return;
    }
    var built;
    try {
      built = TotpPayload.buildTotpPayload(collectOpts());
    } catch (e) {
      showError(e.message || String(e));
      setButtons(false);
      if (payloadEl) payloadEl.textContent = '';
      if (canvas) canvas.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    if (built.warning) showWarn(built.warning);
    if (payloadEl) payloadEl.textContent = built.payload;
    var opts = getOptions();
    QRCode.toCanvas(canvas, built.payload, opts, function (err) {
      if (err) {
        showError('Could not generate QR: ' + (err.message || err));
        setButtons(false);
        canvas.hidden = true;
        empty.hidden = false;
        return;
      }
      canvas.hidden = false;
      empty.hidden = true;
      setButtons(true);
    });
    QRCode.toString(built.payload, Object.assign({}, opts, { type: 'svg' }), function (err, svg) {
      if (!err) lastSvg = svg;
    });
  }

  function downloadDataUrl(dataUrl, filename) { QRCore.downloadDataUrl(dataUrl, filename); }

  function clearPreview() {
    showError('');
    showWarn('');
    setButtons(false);
    if (payloadEl) payloadEl.textContent = '';
    if (canvas) canvas.hidden = true;
    if (empty) empty.hidden = false;
    lastSvg = '';
  }

  var genBtn = document.getElementById('generate-btn');
  if (genBtn) genBtn.addEventListener('click', generate);

  document.querySelectorAll('input[name="otp-type"]').forEach(function (el) {
    el.addEventListener('change', function () {
      syncTypeHints();
      clearPreview();
    });
  });

  // Live compatibility warning when advanced options leave defaults (no QR yet)
  ['otp-algorithm', 'otp-digits', 'otp-period'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function () {
      if (!window.TotpPayload) return;
      var algo = (document.getElementById('otp-algorithm').value || 'SHA1').toUpperCase();
      var digits = parseInt((document.getElementById('otp-digits').value || '6'), 10);
      var period = parseInt((document.getElementById('otp-period').value || '30'), 10);
      var d = TotpPayload.DEFAULTS;
      if (algo !== d.algorithm || digits !== d.digits || period !== d.period) {
        showWarn(
          'Compatibility warning: Google Authenticator and some apps may ignore non-default algorithm, digits, or period. Prefer SHA1 / 6 digits / 30s unless you control the verifier.'
        );
      } else if (!(payloadEl && payloadEl.textContent)) {
        showWarn('');
      }
    });
  });

  var randomBtn = document.getElementById('random-secret-btn');
  if (randomBtn) {
    randomBtn.addEventListener('click', function () {
      if (!window.TotpPayload) {
        showError('TOTP helper failed to load. Refresh the page.');
        return;
      }
      var secretEl = document.getElementById('otp-secret');
      if (secretEl) secretEl.value = TotpPayload.generateRandomSecret(20);
      clearPreview();
    });
  }

  if (downloadPng) {
    downloadPng.addEventListener('click', function () {
      if (!canvas || canvas.hidden) return;
      downloadDataUrl(canvas.toDataURL('image/png'), 'totp-qr-code.png');
    });
  }
  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      QRCore.downloadSvg(lastSvg, 'totp-qr-code.svg');
    });
  }
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var t = payloadEl ? payloadEl.textContent : '';
      if (!t) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).catch(function () {});
      }
    });
  }
  document.querySelectorAll('#totp-generator input, #totp-generator textarea, #totp-generator select').forEach(function (el) {
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && el.tagName !== 'TEXTAREA') {
        ev.preventDefault();
        generate();
      }
    });
  });
  setButtons(false);
  if (canvas) canvas.hidden = true;
  showWarn('');
  syncTypeHints();
})();
