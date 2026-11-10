(function () {
  'use strict';

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

  function showError(msg) {
    if (!errEl) return;
    if (msg) { errEl.textContent = msg; errEl.classList.add('show'); }
    else { errEl.textContent = ''; errEl.classList.remove('show'); }
  }
  function showWarn(msg) {
    if (!warnEl) return;
    if (msg) { warnEl.textContent = msg; warnEl.hidden = false; }
    else { warnEl.textContent = ''; warnEl.hidden = true; }
  }
  function setTypeLabel(built) {
    if (!typeEl) return;
    if (!built) {
      typeEl.textContent = '';
      typeEl.hidden = true;
      return;
    }
    var bits = [];
    if (built.type === 'short') bits.push('Detected: Google Form short responder link (forms.gle)');
    else bits.push('Detected: Google Form responder link');
    if (built.normalized) bits.push('normalized to HTTPS');
    if (built.strippedUserPrefix) bits.push('account prefix removed');
    if (built.appendedViewform) bits.push('viewform path added');
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
    [downloadPng, downloadSvg, copyBtn].forEach(function (btn) {
      if (btn) btn.disabled = !enabled;
    });
  }
  function getOptions() {
    var size = parseInt((document.getElementById('opt-size') || {}).value, 10) || 320;
    var level = (document.getElementById('opt-ecc') || {}).value || 'M';
    var margin = parseInt((document.getElementById('opt-margin') || {}).value, 10);
    if (isNaN(margin)) margin = 2;
    return {
      errorCorrectionLevel: level,
      margin: margin,
      width: size,
      color: {
        dark: (document.getElementById('opt-dark') || {}).value || '#000000',
        light: (document.getElementById('opt-light') || {}).value || '#ffffff'
      }
    };
  }

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
    if (!window.GoogleFormPayload) {
      showError('Google Form helper failed to load. Refresh the page.');
      clearPreview();
      return;
    }
    var inputEl = document.getElementById('gform-url');
    var built;
    try {
      built = GoogleFormPayload.buildGoogleFormPayload(inputEl ? inputEl.value : '');
    } catch (e) {
      showError(e.message || String(e));
      clearPreview();
      return;
    }
    if (!built || !/^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/.test(built.payload)) {
      showError('Refusing to encode a link that is not an HTTPS Google Form responder URL.');
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

  function downloadDataUrl(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  var genBtn = document.getElementById('generate-btn');
  if (genBtn) genBtn.addEventListener('click', generate);

  if (downloadPng) {
    downloadPng.addEventListener('click', function () {
      if (!canvas || canvas.hidden) return;
      downloadDataUrl(canvas.toDataURL('image/png'), 'google-form-qr-code.png');
    });
  }
  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      var blob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      downloadDataUrl(url, 'google-form-qr-code.svg');
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
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
  document.querySelectorAll('#gform-generator input, #gform-generator textarea, #gform-generator select').forEach(function (el) {
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
