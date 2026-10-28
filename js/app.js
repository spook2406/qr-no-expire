(function () {
  'use strict';

  var type = 'url';
  var canvas = document.getElementById('qr-canvas');
  var empty = document.getElementById('preview-empty');
  var errEl = document.getElementById('form-error');
  var downloadPng = document.getElementById('download-png');
  var downloadSvg = document.getElementById('download-svg');
  var copyBtn = document.getElementById('copy-data');
  var lastPayload = '';
  var lastSvg = '';

  var panels = {
    url: document.getElementById('panel-url'),
    text: document.getElementById('panel-text'),
    wifi: document.getElementById('panel-wifi'),
    email: document.getElementById('panel-email'),
    phone: document.getElementById('panel-phone')
  };

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

  function setType(next) {
    type = next;
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-type') === next);
    });
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = key !== next;
    });
    showError('');
  }

  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setType(btn.getAttribute('data-type'));
    });
  });

  function buildPayload() {
    if (type === 'url') {
      var url = (document.getElementById('input-url').value || '').trim();
      if (!url) throw new Error('Enter a URL.');
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      return url;
    }
    if (type === 'text') {
      var text = (document.getElementById('input-text').value || '').trim();
      if (!text) throw new Error('Enter some text.');
      return text;
    }
    if (type === 'wifi') {
      return WifiPayload.buildWifiPayload({
        ssid: document.getElementById('wifi-ssid').value || '',
        password: document.getElementById('wifi-pass').value || '',
        encryption: document.getElementById('wifi-enc').value || 'WPA',
        hidden: document.getElementById('wifi-hidden').checked
      });
    }
    if (type === 'email') {
      var email = (document.getElementById('email-to').value || '').trim();
      var subject = (document.getElementById('email-subject').value || '').trim();
      var body = (document.getElementById('email-body').value || '').trim();
      if (!email) throw new Error('Enter an email address.');
      var q = [];
      if (subject) q.push('subject=' + encodeURIComponent(subject));
      if (body) q.push('body=' + encodeURIComponent(body));
      return 'mailto:' + email + (q.length ? '?' + q.join('&') : '');
    }
    if (type === 'phone') {
      var phone = (document.getElementById('input-phone').value || '').trim();
      if (!phone) throw new Error('Enter a phone number.');
      return 'tel:' + phone.replace(/\s+/g, '');
    }
    throw new Error('Unknown type.');
  }

  function getOptions() {
    var size = parseInt(document.getElementById('opt-size').value, 10) || 320;
    var level = document.getElementById('opt-ecc').value || 'M';
    var margin = parseInt(document.getElementById('opt-margin').value, 10);
    if (isNaN(margin)) margin = 2;
    var dark = document.getElementById('opt-dark').value || '#000000';
    var light = document.getElementById('opt-light').value || '#ffffff';
    return {
      errorCorrectionLevel: level,
      margin: margin,
      width: size,
      color: { dark: dark, light: light }
    };
  }

  function setButtons(enabled) {
    [downloadPng, downloadSvg, copyBtn].forEach(function (btn) {
      if (btn) btn.disabled = !enabled;
    });
  }

  function generate() {
    showError('');
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      return;
    }
    var payload;
    try {
      payload = buildPayload();
    } catch (e) {
      showError(e.message || String(e));
      setButtons(false);
      return;
    }
    var opts = getOptions();
    lastPayload = payload;

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

  document.getElementById('generate-btn').addEventListener('click', generate);

  downloadPng.addEventListener('click', function () {
    if (!canvas || canvas.hidden) return;
    downloadDataUrl(canvas.toDataURL('image/png'), 'static-qr-code.png');
  });

  downloadSvg.addEventListener('click', function () {
    if (!lastSvg) return;
    var blob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    downloadDataUrl(url, 'static-qr-code.svg');
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  copyBtn.addEventListener('click', function () {
    if (!lastPayload) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastPayload).then(function () {
        copyBtn.textContent = 'Copied!';
        setTimeout(function () { copyBtn.textContent = 'Copy payload'; }, 1200);
      });
    }
  });

  // Live update on Enter in inputs
  document.querySelectorAll('.panel input, .panel textarea, .panel select').forEach(function (el) {
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && el.tagName !== 'TEXTAREA') {
        ev.preventDefault();
        generate();
      }
    });
  });

  setType('url');
  setButtons(false);
  canvas.hidden = true;
})();
