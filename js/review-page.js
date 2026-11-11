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

  function showError(msg) { QRCore.showError(errEl, msg); }

  function showWarning(msg) { QRCore.showWarn(warnEl, msg); }

  function setButtons(enabled) {
    QRCore.setDisabled([downloadPng, downloadSvg, copyUrl], enabled);
  }

  function getOptions() { return QRCore.getOptions(); }

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

  function downloadDataUrl(dataUrl, filename) { QRCore.downloadDataUrl(dataUrl, filename); }

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
      QRCore.downloadSvg(lastSvg, 'google-review-qr-code.svg');
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
