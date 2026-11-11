(function (global) {
  'use strict';

  /**
   * Helpers shared by every generator page: messages, QR render options,
   * and file downloads. Load after vendor/qrcode.min.js and before the
   * page's own *-page.js script.
   */

  /** Show or clear a form error (the .show class makes it visible). */
  function showError(el, msg) {
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.add('show');
    } else {
      el.textContent = '';
      el.classList.remove('show');
    }
  }

  /** Show or clear a warning note (toggled with the hidden attribute). */
  function showWarn(el, msg) {
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  }

  /** Enable or disable a list of buttons; missing (null) entries are skipped. */
  function setDisabled(buttons, enabled) {
    buttons.forEach(function (btn) {
      if (btn) btn.disabled = !enabled;
    });
  }

  function fieldValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : undefined;
  }

  /** Read the shared size / error-correction / margin / colour controls. */
  function getOptions() {
    var size = parseInt(fieldValue('opt-size'), 10) || 320;
    var level = fieldValue('opt-ecc') || 'M';
    var margin = parseInt(fieldValue('opt-margin'), 10);
    if (isNaN(margin)) margin = 2;
    return {
      errorCorrectionLevel: level,
      margin: margin,
      width: size,
      color: {
        dark: fieldValue('opt-dark') || '#000000',
        light: fieldValue('opt-light') || '#ffffff'
      }
    };
  }

  /** Trigger a download of a data: or blob: URL. */
  function downloadDataUrl(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /** Download text content as a file of the given MIME type. */
  function downloadText(text, mime, filename) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    downloadDataUrl(url, filename);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadSvg(svg, filename) {
    downloadText(svg, 'image/svg+xml;charset=utf-8', filename);
  }

  global.QRCore = {
    showError: showError,
    showWarn: showWarn,
    setDisabled: setDisabled,
    getOptions: getOptions,
    downloadDataUrl: downloadDataUrl,
    downloadText: downloadText,
    downloadSvg: downloadSvg
  };
})(typeof window !== 'undefined' ? window : this);
