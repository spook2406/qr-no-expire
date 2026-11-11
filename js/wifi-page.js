(function () {
  'use strict';

  var canvas = document.getElementById('qr-canvas');
  var empty = document.getElementById('preview-empty');
  var errEl = document.getElementById('form-error');
  var downloadPng = document.getElementById('download-png');
  var downloadSvg = document.getElementById('download-svg');
  var lastSvg = '';

  function showError(msg) { QRCore.showError(errEl, msg); }

  function setButtons(enabled) {
    QRCore.setDisabled([downloadPng, downloadSvg], enabled);
  }

  function getOptions() { return QRCore.getOptions(); }

  function generate() {
    showError('');
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      return;
    }
    if (!window.WifiPayload) {
      showError('WiFi helper failed to load. Refresh the page.');
      return;
    }
    var payload;
    try {
      payload = WifiPayload.buildWifiPayload({
        ssid: (document.getElementById('wifi-ssid').value || ''),
        password: document.getElementById('wifi-pass').value || '',
        encryption: document.getElementById('wifi-enc').value || 'WPA',
        hidden: document.getElementById('wifi-hidden').checked
      });
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

  function downloadDataUrl(dataUrl, filename) { QRCore.downloadDataUrl(dataUrl, filename); }

  var genBtn = document.getElementById('generate-btn');
  if (genBtn) genBtn.addEventListener('click', generate);

  if (downloadPng) {
    downloadPng.addEventListener('click', function () {
      if (!canvas || canvas.hidden) return;
      downloadDataUrl(canvas.toDataURL('image/png'), 'wifi-qr-code.png');
    });
  }

  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      QRCore.downloadSvg(lastSvg, 'wifi-qr-code.svg');
    });
  }

  document.querySelectorAll('#wifi-generator input, #wifi-generator select').forEach(function (el) {
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
