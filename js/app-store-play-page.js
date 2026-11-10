(function () {
  'use strict';

  /**
   * Draws one static QR per valid store URL.
   * Does not read the user agent, does not fetch the link, and does not
   * build a short link or a device redirect.
   */

  var errEl = document.getElementById('form-error');
  var warnEl = document.getElementById('form-warning');
  var posterBtn = document.getElementById('download-poster');
  var posterNote = document.getElementById('poster-note');

  var sides = {
    appstore: {
      key: 'appstore',
      label: 'App Store',
      platform: 'iOS',
      file: 'app-store-qr-code',
      canvas: document.getElementById('qr-appstore'),
      empty: document.getElementById('empty-appstore'),
      payloadEl: document.getElementById('payload-appstore'),
      png: document.getElementById('png-appstore'),
      svgBtn: document.getElementById('svg-appstore'),
      copy: document.getElementById('copy-appstore'),
      card: document.getElementById('card-appstore'),
      svg: '',
      payload: ''
    },
    play: {
      key: 'play',
      label: 'Google Play',
      platform: 'Android',
      file: 'google-play-qr-code',
      canvas: document.getElementById('qr-play'),
      empty: document.getElementById('empty-play'),
      payloadEl: document.getElementById('payload-play'),
      png: document.getElementById('png-play'),
      svgBtn: document.getElementById('svg-play'),
      copy: document.getElementById('copy-play'),
      card: document.getElementById('card-play'),
      svg: '',
      payload: ''
    }
  };

  function showError(msg) { QRCore.showError(errEl, msg); }

  function showWarn(msg) { QRCore.showWarn(warnEl, msg); }

  function getOptions() { return QRCore.getOptions(); }

  function setSideEnabled(side, enabled) {
    QRCore.setDisabled([side.png, side.svgBtn, side.copy], enabled);
    if (side.card) side.card.classList.toggle('is-empty', !enabled);
  }

  function clearSide(side) {
    side.svg = '';
    side.payload = '';
    setSideEnabled(side, false);
    if (side.payloadEl) side.payloadEl.textContent = '';
    if (side.canvas) side.canvas.hidden = true;
    if (side.empty) side.empty.hidden = false;
  }

  function clearAll() {
    clearSide(sides.appstore);
    clearSide(sides.play);
    if (posterBtn) posterBtn.disabled = true;
    if (posterNote) posterNote.hidden = true;
  }

  function generatedSides() {
    return [sides.appstore, sides.play].filter(function (side) {
      return side.payload && side.canvas && !side.canvas.hidden;
    });
  }

  function paintSide(side, built, opts, done) {
    QRCode.toCanvas(side.canvas, built.payload, opts, function (err) {
      if (err) {
        clearSide(side);
        done(err);
        return;
      }
      QRCode.toString(built.payload, Object.assign({}, opts, { type: 'svg' }), function (err2, svg) {
        if (err2 || !svg) {
          clearSide(side);
          done(err2 || new Error('Could not build the SVG.'));
          return;
        }
        side.svg = svg;
        side.payload = built.payload;
        if (side.payloadEl) side.payloadEl.textContent = built.payload;
        side.canvas.hidden = false;
        if (side.empty) side.empty.hidden = true;
        setSideEnabled(side, true);
        done(null);
      });
    });
  }

  function loadImage(src, done) {
    var img = new Image();
    img.onload = function () { done(null, img); };
    img.onerror = function () { done(new Error('Could not draw the poster.')); };
    img.src = src;
  }

  function buildPoster(done) {
    var ready = generatedSides();
    if (!ready.length) {
      done(new Error('Generate a store QR before downloading the poster.'));
      return;
    }
    var pending = ready.length;
    var images = new Array(ready.length);
    var failed = false;
    ready.forEach(function (side, index) {
      loadImage(side.canvas.toDataURL('image/png'), function (err, img) {
        if (failed) return;
        if (err) {
          failed = true;
          done(err);
          return;
        }
        images[index] = { side: side, img: img };
        pending -= 1;
        if (pending === 0) drawPoster(images, done);
      });
    });
  }

  function drawPoster(images, done) {
    var qrSize = 280;
    var pad = 40;
    var gap = 48;
    var header = 78;
    var footer = 72;
    var n = images.length;
    var width = pad * 2 + n * qrSize + (n - 1) * gap;
    var height = pad + header + qrSize + footer;
    var poster = document.createElement('canvas');
    poster.width = width;
    poster.height = height;
    var ctx = poster.getContext('2d');
    if (!ctx) {
      done(new Error('Could not draw the poster.'));
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = '700 22px system-ui, Segoe UI, sans-serif';
    ctx.fillText(n === 2 ? 'App Store and Google Play' : images[0].side.label, width / 2, pad + 8);
    ctx.font = '15px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Static QR codes. Not a device redirect.', width / 2, pad + 36);

    images.forEach(function (item, i) {
      var x = pad + i * (qrSize + gap);
      var y = pad + header;
      ctx.drawImage(item.img, x, y, qrSize, qrSize);
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 20px system-ui, Segoe UI, sans-serif';
      ctx.fillText(item.side.label, x + qrSize / 2, y + qrSize + 32);
      ctx.fillStyle = '#475569';
      ctx.font = '15px system-ui, Segoe UI, sans-serif';
      ctx.fillText(item.side.platform, x + qrSize / 2, y + qrSize + 54);
    });
    done(null, poster);
  }

  function generate() {
    showError('');
    showWarn('');
    clearAll();
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      return;
    }
    if (!window.AppStorePlayPayload) {
      showError('Store link helper failed to load. Refresh the page.');
      return;
    }
    var appEl = document.getElementById('appstore-url');
    var playEl = document.getElementById('play-url');
    var built = AppStorePlayPayload.buildStoreQrPayloads(
      appEl ? appEl.value : '',
      playEl ? playEl.value : ''
    );
    var errorText = built.errors && built.errors.length ? built.errors.join('\n') : '';
    if (!built.appStore && !built.play) {
      showError(errorText || 'Nothing was encoded.');
      return;
    }
    try {
      if (built.appStore) AppStorePlayPayload.assertStaticStorePayload(built.appStore);
      if (built.play) AppStorePlayPayload.assertStaticStorePayload(built.play);
    } catch (e) {
      showError(e.message || String(e));
      clearAll();
      return;
    }
    if (built.appStore && built.play && built.appStore.payload === built.play.payload) {
      showError('The two QR codes would contain the same link. Paste each store in its own field. Nothing was encoded.');
      clearAll();
      return;
    }
    if (errorText) showError(errorText);
    var warning = (built.appStore && built.appStore.warning) || (built.play && built.play.warning) || '';
    if (warning) showWarn(warning);

    var opts = getOptions();
    var jobs = [];
    if (built.appStore) jobs.push({ side: sides.appstore, built: built.appStore });
    else clearSide(sides.appstore);
    if (built.play) jobs.push({ side: sides.play, built: built.play });
    else clearSide(sides.play);

    var pending = jobs.length;
    var failed = false;
    jobs.forEach(function (job) {
      paintSide(job.side, job.built, opts, function (err) {
        if (failed) return;
        if (err) {
          failed = true;
          clearAll();
          showError('Could not generate QR: ' + (err.message || err));
          return;
        }
        pending -= 1;
        if (pending === 0) {
          if (posterBtn) posterBtn.disabled = false;
          if (posterNote) posterNote.hidden = false;
        }
      });
    });
  }

  function downloadDataUrl(dataUrl, filename) { QRCore.downloadDataUrl(dataUrl, filename); }

  function bindSide(side) {
    if (side.png) {
      side.png.addEventListener('click', function () {
        if (!side.canvas || side.canvas.hidden) return;
        downloadDataUrl(side.canvas.toDataURL('image/png'), side.file + '.png');
      });
    }
    if (side.svgBtn) {
      side.svgBtn.addEventListener('click', function () {
        if (!side.svg) return;
        QRCore.downloadSvg(side.svg, side.file + '.svg');
      });
    }
    if (side.copy) {
      side.copy.addEventListener('click', function () {
        var text = side.payloadEl ? side.payloadEl.textContent : '';
        if (!text || !navigator.clipboard || !navigator.clipboard.writeText) return;
        navigator.clipboard.writeText(text).catch(function () {});
      });
    }
  }

  bindSide(sides.appstore);
  bindSide(sides.play);

  var genBtn = document.getElementById('generate-btn');
  if (genBtn) genBtn.addEventListener('click', generate);

  if (posterBtn) {
    posterBtn.addEventListener('click', function () {
      buildPoster(function (err, poster) {
        if (err || !poster) {
          showError(err && err.message ? err.message : 'Could not build the poster.');
          return;
        }
        downloadDataUrl(poster.toDataURL('image/png'), 'app-store-google-play-qr-poster.png');
      });
    });
  }

  var root = document.getElementById('store-generator');
  if (root) {
    root.querySelectorAll('input, textarea, select').forEach(function (el) {
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && el.tagName !== 'TEXTAREA') {
          ev.preventDefault();
          generate();
        }
      });
    });
  }

  clearAll();
  showWarn('');
})();
