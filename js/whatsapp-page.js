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
    if (!window.WhatsAppPayload) {
      showError('WhatsApp helper failed to load. Refresh the page.');
      return;
    }
    var built;
    try {
      built = WhatsAppPayload.buildWhatsAppUrl({
        countryCode: (document.getElementById('wa-cc').value || ''),
        phone: (document.getElementById('wa-phone').value || ''),
        message: (document.getElementById('wa-message').value || '')
      });
    } catch (e) {
      showError(e.message || String(e));
      setButtons(false);
      if (payloadEl) payloadEl.textContent = '';
      return;
    }
    if (built.warning) showWarn(built.warning);
    if (payloadEl) payloadEl.textContent = built.url;
    var opts = getOptions();
    QRCode.toCanvas(canvas, built.url, opts, function (err) {
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
    QRCode.toString(built.url, Object.assign({}, opts, { type: 'svg' }), function (err, svg) {
      if (!err) lastSvg = svg;
    });
  }

  function downloadDataUrl(dataUrl, filename) { QRCore.downloadDataUrl(dataUrl, filename); }

  var genBtn = document.getElementById('generate-btn');
  if (genBtn) genBtn.addEventListener('click', generate);
  if (downloadPng) {
    downloadPng.addEventListener('click', function () {
      if (!canvas || canvas.hidden) return;
      downloadDataUrl(canvas.toDataURL('image/png'), 'whatsapp-qr-code.png');
    });
  }
  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      QRCore.downloadSvg(lastSvg, 'whatsapp-qr-code.svg');
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
  document.querySelectorAll('#wa-generator input, #wa-generator textarea, #wa-generator select').forEach(function (el) {
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
