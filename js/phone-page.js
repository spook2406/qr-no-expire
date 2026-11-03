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
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      return;
    }
    if (!window.PhonePayload) {
      showError('Phone helper failed to load. Refresh the page.');
      return;
    }
    var built;
    try {
      built = PhonePayload.buildTelPayload({
        phone: (document.getElementById('phone-number').value || '')
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
      downloadDataUrl(canvas.toDataURL('image/png'), 'phone-call-qr-code.png');
    });
  }
  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      var blob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      downloadDataUrl(url, 'phone-call-qr-code.svg');
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
  document.querySelectorAll('#phone-generator input, #phone-generator textarea, #phone-generator select').forEach(function (el) {
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
