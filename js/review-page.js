(function () {
  'use strict';

  var canvas = document.getElementById('qr-canvas');
  var empty = document.getElementById('preview-empty');
  var errEl = document.getElementById('form-error');
  var warnEl = document.getElementById('form-warning');
  var downloadPng = document.getElementById('download-png');
  var downloadSvg = document.getElementById('download-svg');
  var copyUrl = document.getElementById('copy-url');
  var normalizedEl = document.getElementById('normalized-url');
  var lastSvg = '';
  var lastUrl = '';

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

  function showWarning(msg) {
    if (!warnEl) return;
    if (msg) {
      warnEl.textContent = msg;
      warnEl.hidden = false;
    } else {
      warnEl.textContent = '';
      warnEl.hidden = true;
    }
  }

  function setButtons(enabled) {
    [downloadPng, downloadSvg, copyUrl].forEach(function (btn) {
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

  function generate() {
    showError('');
    showWarning('');
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      return;
    }
    if (!window.ReviewLink) {
      showError('Review-link helper failed to load. Refresh the page.');
      return;
    }
    var result;
    try {
      result = ReviewLink.normalizeReviewLink(
        (document.getElementById('review-input') || {}).value || ''
      );
    } catch (e) {
      showError(e.message || String(e));
      setButtons(false);
      lastUrl = '';
      if (normalizedEl) normalizedEl.textContent = '';
      canvas.hidden = true;
      empty.hidden = false;
      return;
    }
    lastUrl = result.url;
    if (normalizedEl) normalizedEl.textContent = result.url;
    if (result.warning) showWarning(result.warning);

    var opts = getOptions();
    QRCode.toCanvas(canvas, lastUrl, opts, function (err) {
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

    QRCode.toString(lastUrl, Object.assign({}, opts, { type: 'svg' }), function (err, svg) {
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
      downloadDataUrl(canvas.toDataURL('image/png'), 'google-review-qr-code.png');
    });
  }

  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      var blob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      downloadDataUrl(url, 'google-review-qr-code.svg');
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  if (copyUrl) {
    copyUrl.addEventListener('click', function () {
      if (!lastUrl) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lastUrl).then(function () {
          copyUrl.textContent = 'Copied!';
          setTimeout(function () { copyUrl.textContent = 'Copy link'; }, 1500);
        }).catch(function () {
          showError('Could not copy. Select the normalized URL manually.');
        });
      } else {
        showError('Clipboard unavailable. Select the normalized URL manually.');
      }
    });
  }

  document.querySelectorAll('#review-generator input, #review-generator select').forEach(function (el) {
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        generate();
      }
    });
  });

  setButtons(false);
  if (canvas) canvas.hidden = true;
  showWarning('');
})();
