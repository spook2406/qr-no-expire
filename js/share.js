(function () {
  'use strict';

  var SHARE_TEXT = 'I made a free permanent QR code with QRStatic';
  if (document.getElementById('share-result')) return;

  // Most pages have one #qr-canvas gated by #download-png. A page with several
  // codes (e.g. App Store + Google Play) lists its canvas ids instead:
  //   <div class="preview-wrap" data-share-canvases="qr-appstore qr-play">
  // and the share row shows once any of them is drawn.
  var canvases = [];
  var gates = [];
  var preview = null;
  var single = document.getElementById('qr-canvas');
  var downloadPng = document.getElementById('download-png');
  if (single && downloadPng) {
    canvases = [single];
    gates = [downloadPng];
    preview = single.closest('.preview-wrap') || single.parentElement;
  } else {
    preview = document.querySelector('[data-share-canvases]');
    if (preview) {
      canvases = preview.getAttribute('data-share-canvases').split(/\s+/)
        .map(function (id) { return id ? document.getElementById(id) : null; })
        .filter(Boolean);
    }
  }
  if (!preview || !canvases.length) return;

  var section = document.createElement('section');
  section.className = 'share-result';
  section.id = 'share-result';
  section.hidden = true;
  section.setAttribute('aria-labelledby', 'share-result-label');

  var label = document.createElement('p');
  label.className = 'share-result-label';
  label.id = 'share-result-label';
  label.textContent = 'Share this generator';
  section.appendChild(label);

  var actions = document.createElement('div');
  actions.className = 'share-actions';

  var nativeBtn = document.createElement('button');
  nativeBtn.type = 'button';
  nativeBtn.className = 'btn secondary share-btn';
  nativeBtn.id = 'share-native';
  nativeBtn.textContent = 'Share';
  nativeBtn.setAttribute('aria-label', 'Share this page');
  if (typeof navigator.share !== 'function') nativeBtn.hidden = true;
  actions.appendChild(nativeBtn);

  var channels = [
    { id: 'share-x', source: 'x', label: 'X', name: 'Share on X' },
    { id: 'share-whatsapp', source: 'whatsapp', label: 'WhatsApp', name: 'Share on WhatsApp' },
    { id: 'share-facebook', source: 'facebook', label: 'Facebook', name: 'Share on Facebook' },
    { id: 'share-reddit', source: 'reddit', label: 'Reddit', name: 'Share on Reddit' }
  ];

  channels.forEach(function (channel) {
    var link = document.createElement('a');
    link.className = 'btn secondary share-btn';
    link.id = channel.id;
    link.textContent = channel.label;
    link.setAttribute('aria-label', channel.name);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.href = intentUrl(channel.source, withUtm(pageBaseUrl(), channel.source));
    actions.appendChild(link);
  });

  section.appendChild(actions);

  var statusEl = document.createElement('p');
  statusEl.className = 'share-status';
  statusEl.id = 'share-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  section.appendChild(statusEl);

  preview.appendChild(section);

  function pageBaseUrl() {
    var link = document.querySelector('link[rel="canonical"]');
    var href = link && link.getAttribute('href');
    if (href) {
      try {
        var parsed = new URL(href, 'https://qrstatic.app/');
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          parsed.search = '';
          parsed.hash = '';
          return parsed.toString();
        }
      } catch (e) { /* fall through */ }
    }
    var path = (location.pathname || '/');
    if (path === '/' || /\/index\.html$/.test(path)) return 'https://qrstatic.app/';
    var file = path.split('/').filter(Boolean).pop() || '';
    return 'https://qrstatic.app/' + file;
  }

  function withUtm(base, source) {
    var url = new URL(base);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', 'share');
    url.searchParams.set('utm_campaign', 'qr_share');
    return url.toString();
  }

  function intentUrl(source, pageUrl) {
    var text = SHARE_TEXT;
    if (source === 'x') {
      return 'https://x.com/intent/tweet?text=' + encodeURIComponent(text) +
        '&url=' + encodeURIComponent(pageUrl);
    }
    if (source === 'whatsapp') {
      return 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text + ' ' + pageUrl);
    }
    if (source === 'facebook') {
      return 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl) +
        '&quote=' + encodeURIComponent(text);
    }
    if (source === 'reddit') {
      return 'https://www.reddit.com/submit?url=' + encodeURIComponent(pageUrl) +
        '&title=' + encodeURIComponent(text);
    }
    return pageUrl;
  }

  function firstDrawnCanvas() {
    for (var i = 0; i < canvases.length; i++) {
      if (!canvases[i].hidden) return canvases[i];
    }
    return null;
  }

  function qrReady() {
    if (!firstDrawnCanvas()) return false;
    for (var i = 0; i < gates.length; i++) {
      if (gates[i].disabled) return false;
    }
    return true;
  }

  function sync() {
    var ready = qrReady();
    section.hidden = !ready;
    if (!ready) statusEl.textContent = '';
  }

  function pngFileFromCanvas() {
    var canvas = firstDrawnCanvas();
    if (!canvas || typeof File !== 'function' || typeof canvas.toDataURL !== 'function') return null;
    try {
      var dataUrl = canvas.toDataURL('image/png');
      var comma = dataUrl.indexOf(',');
      if (comma < 0 || dataUrl.indexOf('data:image/png') !== 0) return null;
      var binary = atob(dataUrl.slice(comma + 1));
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], 'qrstatic-qr-code.png', { type: 'image/png' });
    } catch (e) {
      return null;
    }
  }

  function chooseShareData(file, text, url, title) {
    var textWithUrl = text + '\n' + url;
    var options = [];
    if (file) {
      options.push({ files: [file], title: title, text: textWithUrl, url: url });
      options.push({ files: [file], title: title, text: textWithUrl });
      options.push({ files: [file], text: textWithUrl });
    }
    var plain = { title: title, text: text, url: url };
    if (typeof navigator.canShare !== 'function') return plain;
    for (var i = 0; i < options.length; i++) {
      try {
        if (navigator.canShare(options[i])) return options[i];
      } catch (e) { /* try the next shape */ }
    }
    return plain;
  }

  function showShareError() {
    statusEl.textContent = 'Could not open the share menu. Use X, WhatsApp, Facebook, or Reddit.';
  }

  nativeBtn.addEventListener('click', function () {
    if (typeof navigator.share !== 'function' || nativeBtn.disabled) return;
    statusEl.textContent = '';
    var url = withUtm(pageBaseUrl(), 'native');
    var title = document.title || 'QRStatic';
    // The TOTP page (#totp-generator) encodes the secret in the QR. Do not attach that PNG.
    var file = document.getElementById('totp-generator') ? null : pngFileFromCanvas();
    var data = chooseShareData(file, SHARE_TEXT, url, title);
    var plain = { title: title, text: SHARE_TEXT, url: url };

    function run(payload) {
      try {
        return Promise.resolve(navigator.share(payload));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    nativeBtn.disabled = true;
    run(data).then(function () {
      nativeBtn.disabled = false;
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        nativeBtn.disabled = false;
        return;
      }
      if (data.files) {
        run(plain).then(function () {
          nativeBtn.disabled = false;
        }).catch(function (err2) {
          nativeBtn.disabled = false;
          if (!err2 || err2.name !== 'AbortError') showShareError();
        });
        return;
      }
      nativeBtn.disabled = false;
      showShareError();
    });
  });

  var observer = new MutationObserver(sync);
  canvases.forEach(function (el) {
    observer.observe(el, { attributes: true, attributeFilter: ['hidden'] });
  });
  gates.forEach(function (el) {
    observer.observe(el, { attributes: true, attributeFilter: ['disabled'] });
  });
  sync();
})();
