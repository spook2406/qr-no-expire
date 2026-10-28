(function () {
  'use strict';

  var canvas = document.getElementById('qr-canvas');
  var empty = document.getElementById('preview-empty');
  var errEl = document.getElementById('form-error');
  var downloadPng = document.getElementById('download-png');
  var downloadSvg = document.getElementById('download-svg');
  var lastSvg = '';

  function showError(msg) {
    if (!errEl) return;
    if (msg) {
      errEl.textContent = msg;
      errEl.classList.add('show');
    } else {
      errEl.textContent = '';
      errEl.classList.remove('show');
    }
  }

  function setButtons(enabled) {
    [downloadPng, downloadSvg].forEach(function (btn) {
      if (btn) btn.disabled = !enabled;
    });
  }

  function getOptions() {
    var size = parseInt((document.getElementById('opt-size') || {}).value, 10) || 320;
    var level = (document.getElementById('opt-ecc') || {}).value || 'M';
    var margin = parseInt((document.getElementById('opt-margin') || {}).value, 10);
    if (isNaN(margin)) margin = 2;
    var dark = (document.getElementById('opt-dark') || {}).value || '#000000';
    var light = (document.getElementById('opt-light') || {}).value || '#ffffff';
    return {
      errorCorrectionLevel: level,
      margin: margin,
      width: size,
      color: { dark: dark, light: light }
    };
  }

  function readFields() {
    return {
      firstName: (document.getElementById('vc-first') || {}).value || '',
      lastName: (document.getElementById('vc-last') || {}).value || '',
      fullName: (document.getElementById('vc-fn') || {}).value || '',
      org: (document.getElementById('vc-org') || {}).value || '',
      title: (document.getElementById('vc-title') || {}).value || '',
      phone: (document.getElementById('vc-phone') || {}).value || '',
      email: (document.getElementById('vc-email') || {}).value || '',
      url: (document.getElementById('vc-url') || {}).value || '',
      street: (document.getElementById('vc-street') || {}).value || '',
      city: (document.getElementById('vc-city') || {}).value || '',
      region: (document.getElementById('vc-region') || {}).value || '',
      postal: (document.getElementById('vc-postal') || {}).value || '',
      country: (document.getElementById('vc-country') || {}).value || ''
    };
  }

  function generate() {
    showError('');
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      return;
    }
    if (!window.VCardPayload) {
      showError('vCard helper failed to load. Refresh the page.');
      return;
    }
    var payload;
    try {
      payload = VCardPayload.buildVCardPayload(readFields());
    } catch (e) {
      showError(e.message || String(e));
      setButtons(false);
      return;
    }
    var opts = getOptions();

    QRCode.toCanvas(canvas, payload, opts, function (err) {
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

    QRCode.toString(payload, Object.assign({}, opts, { type: 'svg' }), function (err, svg) {
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
      downloadDataUrl(canvas.toDataURL('image/png'), 'vcard-qr-code.png');
    });
  }

  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      var blob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      downloadDataUrl(url, 'vcard-qr-code.svg');
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  document.querySelectorAll('#vcard-generator input, #vcard-generator select').forEach(function (el) {
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        generate();
      }
    });
  });

  setButtons(false);
  if (canvas) canvas.hidden = true;
})();
