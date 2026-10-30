(function (global) {
  'use strict';

  /**
   * Escape text for iCalendar (RFC 5545) TEXT values.
   */
  function escapeICal(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /**
   * Format a Date as floating local DATE-TIME: YYYYMMDDTHHMMSS
   */
  function formatDateTimeLocal(d) {
    return (
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      'T' +
      pad2(d.getHours()) +
      pad2(d.getMinutes()) +
      pad2(d.getSeconds())
    );
  }

  /**
   * Format a Date as DATE (all-day): YYYYMMDD
   */
  function formatDateOnly(d) {
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  /**
   * Format a Date as UTC DATE-TIME for DTSTAMP/UID helpers: YYYYMMDDTHHMMSSZ
   */
  function formatDateTimeUTC(d) {
    return (
      d.getUTCFullYear() +
      pad2(d.getUTCMonth() + 1) +
      pad2(d.getUTCDate()) +
      'T' +
      pad2(d.getUTCHours()) +
      pad2(d.getUTCMinutes()) +
      pad2(d.getUTCSeconds()) +
      'Z'
    );
  }

  function parseLocalInput(dateStr, timeStr) {
    // dateStr: YYYY-MM-DD from <input type="date">
    // timeStr: HH:MM from <input type="time">
    var parts = String(dateStr || '').split('-');
    if (parts.length !== 3) throw new Error('Enter a valid start date.');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    var hh = 0;
    var mm = 0;
    if (timeStr) {
      var tp = String(timeStr).split(':');
      hh = parseInt(tp[0], 10) || 0;
      mm = parseInt(tp[1], 10) || 0;
    }
    var d = new Date(y, m, day, hh, mm, 0, 0);
    if (isNaN(d.getTime())) throw new Error('Enter a valid date and time.');
    return d;
  }

  /**
   * Build a minimal VCALENDAR / VEVENT payload for QR encoding.
   * @param {{
   *   title:string, startDate:string, startTime?:string,
   *   endDate?:string, endTime?:string, allDay?:boolean,
   *   location?:string, description?:string, url?:string
   * }} opts
   * @returns {string}
   */
  function buildCalendarPayload(opts) {
    opts = opts || {};
    var title = String(opts.title || '').trim();
    if (!title) throw new Error('Enter an event title.');

    var allDay = !!opts.allDay;
    var startDate = String(opts.startDate || '').trim();
    if (!startDate) throw new Error('Enter a start date.');

    var start;
    var end;
    if (allDay) {
      start = parseLocalInput(startDate, '00:00');
      var endDateStr = String(opts.endDate || startDate).trim();
      end = parseLocalInput(endDateStr, '00:00');
      // iCal all-day DTEND is exclusive — add one day
      end = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
    } else {
      var startTime = String(opts.startTime || '').trim();
      if (!startTime) throw new Error('Enter a start time, or check All-day.');
      start = parseLocalInput(startDate, startTime);
      var endDate = String(opts.endDate || startDate).trim();
      var endTime = String(opts.endTime || '').trim();
      if (!endTime) {
        // Default: 1 hour after start
        end = new Date(start.getTime() + 60 * 60 * 1000);
      } else {
        end = parseLocalInput(endDate, endTime);
      }
      if (end.getTime() <= start.getTime()) {
        throw new Error('End must be after start.');
      }
    }

    var now = new Date();
    var uid =
      formatDateTimeUTC(now) +
      '-' +
      Math.random().toString(36).slice(2, 10) +
      '@qrstatic.app';

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//QRStatic//Calendar Event QR//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTAMP:' + formatDateTimeUTC(now)
    ];

    if (allDay) {
      lines.push('DTSTART;VALUE=DATE:' + formatDateOnly(start));
      lines.push('DTEND;VALUE=DATE:' + formatDateOnly(end));
    } else {
      lines.push('DTSTART:' + formatDateTimeLocal(start));
      lines.push('DTEND:' + formatDateTimeLocal(end));
    }

    lines.push('SUMMARY:' + escapeICal(title));

    var location = String(opts.location || '').trim();
    if (location) lines.push('LOCATION:' + escapeICal(location));

    var description = String(opts.description || '').trim();
    if (description) lines.push('DESCRIPTION:' + escapeICal(description));

    var url = String(opts.url || '').trim();
    if (url) {
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      lines.push('URL:' + escapeICal(url));
    }

    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  global.CalendarPayload = {
    escapeICal: escapeICal,
    buildCalendarPayload: buildCalendarPayload
  };
})(typeof window !== 'undefined' ? window : this);
