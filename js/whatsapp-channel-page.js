(function () {
  'use strict';

  /**
   * Draws one static QR of a public WhatsApp Channel follow URL.
   * Does not read the user agent, does not request the link, and does not
   * build a short link or a redirect.
   */

  var canvas = document.getElementById('qr-canvas');
  var empty = document.getElementById('preview-empty');
  var errEl = document.getElementById('form-error');
  var warnEl = document.getElementById('form-warning');
  var payloadEl = document.getElementById('payload-out');
  var typeEl = document.getElementById('detected-type');
  var downloadPng = document.getElementById('download-png');
  var downloadSvg = document.getElementById('download-svg');
  var copyBtn = document.getElementById('copy-payload');
  var lastSvg = '';

  function showError(msg) { QRCore.showError(errEl, msg); }
  function showWarn(msg) { QRCore.showWarn(warnEl, msg); }
  function setTypeLabel(built) {
    if (!typeEl) return;
    if (!built) {
      typeEl.textContent = '';
      typeEl.hidden = true;
      return;
    }
    var bits = ['Detected: WhatsApp Channel'];
    if (built.normalized) bits.push('normalized to HTTPS');
    typeEl.textContent = bits.join(' · ');
    typeEl.hidden = false;
  }
  function clearPreview() {
    lastSvg = '';
    setButtons(false);
    if (payloadEl) payloadEl.textContent = '';
    if (canvas) canvas.hidden = true;
    if (empty) empty.hidden = false;
  }
  function setButtons(enabled) {
    QRCore.setDisabled([downloadPng, downloadSvg, copyBtn], enabled);
  }
  function getOptions() { return QRCore.getOptions(); }

  function generate() {
    showError('');
    showWarn('');
    setTypeLabel(null);
    lastSvg = '';
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      clearPreview();
      return;
    }
    if (!window.WhatsAppChannelPayload) {
      showError('WhatsApp Channel helper failed to load. Refresh the page.');
      clearPreview();
      return;
    }
    var inputEl = document.getElementById('whatsapp-channel-url');
    var built;
    try {
      built = WhatsAppChannelPayload.buildWhatsAppChannelPayload(inputEl ? inputEl.value : '');
      WhatsAppChannelPayload.assertStaticWhatsAppChannelPayload(built);
    } catch (e) {
      showError(e.message || String(e));
      clearPreview();
      return;
    }
    if (!built || !/^https:\/\/whatsapp\.com\/channel\/[A-Za-z0-9_-]{16,64}$/.test(built.payload)) {
      showError('Refusing to encode a link that is not an HTTPS whatsapp.com/channel follow URL.');
      clearPreview();
      return;
    }
    if (built.warning) showWarn(built.warning);
    setTypeLabel(built);
    if (payloadEl) payloadEl.textContent = built.payload;
    var opts = getOptions();
    QRCode.toCanvas(canvas, built.payload, opts, function (err) {
      if (err) {
        showError('Could not generate QR: ' + (err.message || err));
        clearPreview();
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
      downloadDataUrl(canvas.toDataURL('image/png'), 'whatsapp-channel-qr-code.png');
    });
  }
  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      QRCore.downloadSvg(lastSvg, 'whatsapp-channel-qr-code.svg');
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
  document.querySelectorAll('#whatsapp-channel-generator input, #whatsapp-channel-generator textarea, #whatsapp-channel-generator select').forEach(function (el) {
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
  setTypeLabel(null);
})();
