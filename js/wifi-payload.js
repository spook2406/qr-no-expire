(function (global) {
  'use strict';

  /**
   * Escape special characters for WIFI: QR payloads (\, ;, ,, ").
   */
  function escapeWifi(value) {
    return String(value || '').replace(/([\\;,"])/g, '\\$1');
  }

  /**
   * Build a WIFI: connection string.
   * @param {{ssid:string, password?:string, encryption?:string, hidden?:boolean}} opts
   * @returns {string}
   */
  function buildWifiPayload(opts) {
    opts = opts || {};
    var ssid = String(opts.ssid || '').trim();
    var pass = opts.password == null ? '' : String(opts.password);
    var enc = opts.encryption || 'WPA';
    var hidden = !!opts.hidden;
    if (!ssid) throw new Error('Enter a WiFi network name (SSID).');
    var parts = ['WIFI:T:' + enc, 'S:' + escapeWifi(ssid)];
    if (enc !== 'nopass') parts.push('P:' + escapeWifi(pass));
    if (hidden) parts.push('H:true');
    return parts.join(';') + ';;';
  }

  global.WifiPayload = {
    escapeWifi: escapeWifi,
    buildWifiPayload: buildWifiPayload
  };
})(typeof window !== 'undefined' ? window : this);
