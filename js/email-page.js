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

  function generate() {
    showError('');
    showWarn('');
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      return;
    }
    if (!window.EmailPayload) {
      showError('Email helper failed to load. Refresh the page.');
      return;
    }
    var built;
    try {
      built = EmailPayload.buildMailtoPayload({
        email: (document.getElementById('email-to').value || ''),
        subject: (document.getElementById('email-subject').value || ''),
        body: (document.getElementById('email-body').value || '')
      });
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

  var genBtn = document.getElementById('generate-btn');
  if (genBtn) genBtn.addEventListener('click', generate);
  if (downloadPng) {
    downloadPng.addEventListener('click', function () {
      if (!canvas || canvas.hidden) return;
      downloadDataUrl(canvas.toDataURL('image/png'), 'email-qr-code.png');
    });
  }
  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      QRCore.downloadSvg(lastSvg, 'email-qr-code.svg');
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
  document.querySelectorAll('#email-generator input, #email-generator textarea, #email-generator select').forEach(function (el) {
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
})();
