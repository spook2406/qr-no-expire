(function () {
  'use strict';

  var canvas = document.getElementById('qr-canvas');
  var empty = document.getElementById('preview-empty');
  var errEl = document.getElementById('form-error');
  var downloadPng = document.getElementById('download-png');
  var downloadSvg = document.getElementById('download-svg');
  var downloadIcs = document.getElementById('download-ics');
  var copyIcs = document.getElementById('copy-ics');
  var payloadPreview = document.getElementById('payload-preview');
  var allDayEl = document.getElementById('cal-allday');
  var timeFields = document.getElementById('cal-time-fields');
  var lastSvg = '';
  var lastPayload = '';

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
    [downloadPng, downloadSvg, downloadIcs, copyIcs].forEach(function (btn) {
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
      title: (document.getElementById('cal-title') || {}).value || '',
      startDate: (document.getElementById('cal-start-date') || {}).value || '',
      startTime: (document.getElementById('cal-start-time') || {}).value || '',
      endDate: (document.getElementById('cal-end-date') || {}).value || '',
      endTime: (document.getElementById('cal-end-time') || {}).value || '',
      allDay: !!(allDayEl && allDayEl.checked),
      location: (document.getElementById('cal-location') || {}).value || '',
      description: (document.getElementById('cal-desc') || {}).value || '',
      url: (document.getElementById('cal-url') || {}).value || ''
    };
  }

  function syncAllDayUI() {
    var on = !!(allDayEl && allDayEl.checked);
    document.querySelectorAll('.cal-time-only').forEach(function (el) {
      el.hidden = on;
    });
    ['cal-start-time', 'cal-end-time'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = on;
    });
  }

  function generate() {
    showError('');
    if (typeof QRCode === 'undefined') {
      showError('QR library failed to load. Refresh the page.');
      return;
    }
    if (!window.CalendarPayload) {
      showError('Calendar helper failed to load. Refresh the page.');
      return;
    }
    var payload;
    try {
      payload = CalendarPayload.buildCalendarPayload(readFields());
    } catch (e) {
      showError(e.message || String(e));
      setButtons(false);
      lastPayload = '';
      if (payloadPreview) payloadPreview.textContent = '';
      return;
    }
    lastPayload = payload;
    if (payloadPreview) payloadPreview.textContent = payload;
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

  if (allDayEl) {
    allDayEl.addEventListener('change', syncAllDayUI);
    syncAllDayUI();
  }

  if (downloadPng) {
    downloadPng.addEventListener('click', function () {
      if (!canvas || canvas.hidden) return;
      downloadDataUrl(canvas.toDataURL('image/png'), 'calendar-event-qr-code.png');
    });
  }

  if (downloadSvg) {
    downloadSvg.addEventListener('click', function () {
      if (!lastSvg) return;
      var blob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      downloadDataUrl(url, 'calendar-event-qr-code.svg');
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  if (downloadIcs) {
    downloadIcs.addEventListener('click', function () {
      if (!lastPayload) return;
      var blob = new Blob([lastPayload], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      downloadDataUrl(url, 'event.ics');
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  if (copyIcs) {
    copyIcs.addEventListener('click', function () {
      if (!lastPayload) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lastPayload).then(function () {
          copyIcs.textContent = 'Copied!';
          setTimeout(function () { copyIcs.textContent = 'Copy ICS'; }, 1500);
        }).catch(function () {
          showError('Could not copy. Select the payload text manually.');
        });
      } else {
        showError('Clipboard unavailable. Select the payload text manually.');
      }
    });
  }

  document.querySelectorAll('#calendar-generator input, #calendar-generator select, #calendar-generator textarea').forEach(function (el) {
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && el.tagName !== 'TEXTAREA') {
        ev.preventDefault();
        generate();
      }
    });
  });

  setButtons(false);
  if (canvas) canvas.hidden = true;
})();
