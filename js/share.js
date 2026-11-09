(function () {
  'use strict';

  var SHARE_TEXT = 'I made a free permanent QR code with QRStatic';
  var UTM_MEDIUM = 'share';
  var UTM_CAMPAIGN = 'qr_share';

  function withUtm(base, source) {
    var url = new URL(base);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', UTM_MEDIUM);
    url.searchParams.set('utm_campaign', UTM_CAMPAIGN);
    return url.toString();
  }

  function pageBase(canonicalHref, pathname) {
    if (canonicalHref) {
      try {
        var parsed = new URL(canonicalHref);
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
      } catch (e) {}
    }
    var path = String(pathname || '/');
    var parts = path.split('/');
    var file = parts[parts.length - 1] || '';
    if (!file || file === 'index.html') return 'https://qrstatic.app/';
    return 'https://qrstatic.app/' + file;
  }

  function buildIntents(base) {
    var xPage = withUtm(base, 'x');
    var x = new URL('https://twitter.com/intent/tweet');
    x.searchParams.set('text', SHARE_TEXT);
    x.searchParams.set('url', xPage);

    var waPage = withUtm(base, 'whatsapp');
    var wa = new URL('https://api.whatsapp.com/send');
    wa.searchParams.set('text', SHARE_TEXT + '\n' + waPage);

    var fbPage = withUtm(base, 'facebook');
    var fb = new URL('https://www.facebook.com/sharer/sharer.php');
    fb.searchParams.set('u', fbPage);

    var rdPage = withUtm(base, 'reddit');
    var rd = new URL('https://www.reddit.com/submit');
    rd.searchParams.set('url', rdPage);
    rd.searchParams.set('title', SHARE_TEXT);

    return {
      x: x.toString(),
      whatsapp: wa.toString(),
      facebook: fb.toString(),
      reddit: rd.toString(),
      native: withUtm(base, 'native')
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SHARE_TEXT: SHARE_TEXT,
      withUtm: withUtm,
      pageBase: pageBase,
      buildIntents: buildIntents
    };
  }

  if (typeof document === 'undefined') return;

  function pngFileFromCanvas(canvas) {
    try {
      var dataUrl = canvas.toDataURL('image/png');
      var comma = dataUrl.indexOf(',');
      if (comma < 0) return null;
      var binary = atob(dataUrl.slice(comma + 1));
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], 'qrstatic-qr-code.png', { type: 'image/png' });
    } catch (e) {
      return null;
    }
  }

  function mount() {
    var canvas = document.getElementById('qr-canvas');
    if (!canvas || document.getElementById('qr-share')) return;

    var canonical = document.querySelector('link[rel="canonical"]');
    var base = pageBase(
      canonical ? canonical.getAttribute('href') : '',
      window.location.pathname
    );
    // The TOTP image is the secret. That page already says not to email or chat it.
    var attachFile = !document.getElementById('totp-generator');
    var nativeOk = !!(navigator.share);

    var section = document.createElement('section');
    section.className = 'qr-share';
    section.id = 'qr-share';
    section.hidden = true;
    section.setAttribute('aria-labelledby', 'qr-share-title');

    var title = document.createElement('h3');
    title.id = 'qr-share-title';
    title.textContent = 'Share';

    var copy = document.createElement('p');
    copy.className = 'qr-share-copy';
    copy.textContent = SHARE_TEXT;

    var actions = document.createElement('div');
    actions.className = 'qr-share-actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Share this page');

    var nativeBtn = null;
    if (nativeOk) {
      nativeBtn = document.createElement('button');
      nativeBtn.type = 'button';
      nativeBtn.className = 'btn secondary';
      nativeBtn.id = 'qr-share-native';
      nativeBtn.textContent = 'Share';
      nativeBtn.setAttribute('aria-label', 'Share this page');
      actions.appendChild(nativeBtn);
    }

    var channels = [
      { key: 'x', label: 'X', aria: 'Share on X (opens in a new tab)' },
      { key: 'whatsapp', label: 'WhatsApp', aria: 'Share on WhatsApp (opens in a new tab)' },
      { key: 'facebook', label: 'Facebook', aria: 'Share on Facebook (opens in a new tab)' },
      { key: 'reddit', label: 'Reddit', aria: 'Share on Reddit (opens in a new tab)' }
    ];
    var links = {};
    channels.forEach(function (ch) {
      var a = document.createElement('a');
      a.className = 'btn secondary';
      a.id = 'qr-share-' + ch.key;
      a.textContent = ch.label;
      a.setAttribute('aria-label', ch.aria);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      actions.appendChild(a);
      links[ch.key] = a;
    });

    var hint = document.createElement('p');
    hint.className = 'qr-share-hint';
    if (!attachFile) {
      hint.textContent = 'This shares a link to this page. The PNG stays on this device because it contains the secret.';
    } else if (nativeOk) {
      hint.textContent = 'This shares a link to this page. Share also attaches the PNG when this browser allows files.';
    } else {
      hint.textContent = 'This shares a link to this page.';
    }

    var status = document.createElement('p');
    status.className = 'qr-share-status';
    status.id = 'qr-share-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    section.appendChild(title);
    section.appendChild(copy);
    section.appendChild(actions);
    section.appendChild(hint);
    section.appendChild(status);

    var pngBtn = document.getElementById('download-png');
    var downloadActions = pngBtn && pngBtn.closest ? pngBtn.closest('.actions') : null;
    if (downloadActions && downloadActions.parentNode) {
      downloadActions.parentNode.insertBefore(section, downloadActions.nextSibling);
    } else if (canvas.parentNode) {
      canvas.parentNode.appendChild(section);
    }

    function refreshLinks() {
      var built = buildIntents(base);
      links.x.href = built.x;
      links.whatsapp.href = built.whatsapp;
      links.facebook.href = built.facebook;
      links.reddit.href = built.reddit;
      return built;
    }

    function setStatus(msg) {
      status.textContent = msg || '';
      status.classList.toggle('is-error', !!msg);
    }

    function sync() {
      var show = !canvas.hidden;
      section.hidden = !show;
      if (show) refreshLinks();
      else setStatus('');
    }

    refreshLinks();
    sync();

    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(sync);
      observer.observe(canvas, { attributes: true, attributeFilter: ['hidden'] });
    }

    if (nativeBtn) {
      nativeBtn.addEventListener('click', function () {
        setStatus('');
        if (!navigator.share) {
          nativeBtn.hidden = true;
          setStatus('Sharing is not available in this browser. Use one of the other buttons.');
          return;
        }
        var built = refreshLinks();
        var payload = { title: 'QRStatic', text: SHARE_TEXT, url: built.native };
        if (attachFile) {
          var file = pngFileFromCanvas(canvas);
          if (file && typeof navigator.canShare === 'function') {
            var withFile = {
              title: 'QRStatic',
              text: SHARE_TEXT,
              url: built.native,
              files: [file]
            };
            var textAndFile = {
              title: 'QRStatic',
              text: SHARE_TEXT + ' ' + built.native,
              files: [file]
            };
            var accepted = false;
            try {
              accepted = navigator.canShare(withFile);
            } catch (e) {
              accepted = false;
            }
            if (accepted) {
              payload = withFile;
            } else {
              try {
                if (navigator.canShare(textAndFile)) payload = textAndFile;
              } catch (e2) {}
            }
          }
        }
        nativeBtn.disabled = true;
        navigator.share(payload).then(function () {
          nativeBtn.disabled = false;
        }).catch(function (err) {
          nativeBtn.disabled = false;
          if (err && err.name === 'AbortError') return;
          setStatus('Could not open sharing. Use one of the other buttons.');
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
