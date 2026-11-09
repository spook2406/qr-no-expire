'use strict';

var assert = require('assert');
var share = require('../js/share.js');

function targetOf(intentUrl, param) {
  var outer = new URL(intentUrl);
  return new URL(outer.searchParams.get(param));
}

function assertCampaign(pageUrl, source) {
  var u = new URL(pageUrl);
  assert.strictEqual(u.searchParams.get('utm_source'), source);
  assert.strictEqual(u.searchParams.get('utm_medium'), 'share');
  assert.strictEqual(u.searchParams.get('utm_campaign'), 'qr_share');
  assert.ok(!/林启|Lin Qi|Ethen/.test(pageUrl));
}

assert.strictEqual(share.SHARE_TEXT, 'I made a free permanent QR code with QRStatic');
assert.ok(!/林启|Lin Qi|Ethen/.test(share.SHARE_TEXT));

assert.strictEqual(
  share.withUtm('https://qrstatic.app/', 'native'),
  'https://qrstatic.app/?utm_source=native&utm_medium=share&utm_campaign=qr_share'
);
assert.strictEqual(
  share.withUtm('https://qrstatic.app/wifi-qr-code-generator.html', 'x'),
  'https://qrstatic.app/wifi-qr-code-generator.html?utm_source=x&utm_medium=share&utm_campaign=qr_share'
);

assert.strictEqual(share.pageBase('https://qrstatic.app/', '/'), 'https://qrstatic.app/');
assert.strictEqual(
  share.pageBase('https://qrstatic.app/wifi-qr-code-generator.html?x=1#y', '/wifi-qr-code-generator.html'),
  'https://qrstatic.app/wifi-qr-code-generator.html'
);
assert.strictEqual(share.pageBase('', '/'), 'https://qrstatic.app/');
assert.strictEqual(share.pageBase('', '/index.html'), 'https://qrstatic.app/');
assert.strictEqual(
  share.pageBase('', '/sms-qr-code-generator.html'),
  'https://qrstatic.app/sms-qr-code-generator.html'
);
assert.strictEqual(
  share.pageBase('not a url', '/zoom-meeting-qr-code-generator.html'),
  'https://qrstatic.app/zoom-meeting-qr-code-generator.html'
);

var home = share.buildIntents('https://qrstatic.app/');
var x = new URL(home.x);
assert.strictEqual(x.origin + x.pathname, 'https://twitter.com/intent/tweet');
assert.strictEqual(x.searchParams.get('text'), share.SHARE_TEXT);
assertCampaign(targetOf(home.x, 'url').toString(), 'x');
assert.strictEqual(targetOf(home.x, 'url').pathname, '/');

var wa = new URL(home.whatsapp);
assert.strictEqual(wa.origin + wa.pathname, 'https://api.whatsapp.com/send');
var waText = wa.searchParams.get('text');
assert.ok(waText.indexOf(share.SHARE_TEXT + '\n') === 0);
assertCampaign(waText.split('\n')[1], 'whatsapp');

var fb = new URL(home.facebook);
assert.strictEqual(fb.origin + fb.pathname, 'https://www.facebook.com/sharer/sharer.php');
assertCampaign(targetOf(home.facebook, 'u').toString(), 'facebook');

var rd = new URL(home.reddit);
assert.strictEqual(rd.origin + rd.pathname, 'https://www.reddit.com/submit');
assert.strictEqual(rd.searchParams.get('title'), share.SHARE_TEXT);
assertCampaign(targetOf(home.reddit, 'url').toString(), 'reddit');
assert.strictEqual(new URL(home.native).searchParams.get('utm_source'), 'native');

var tool = share.buildIntents('https://qrstatic.app/google-review-qr-code-generator.html');
assert.strictEqual(
  targetOf(tool.x, 'url').pathname,
  '/google-review-qr-code-generator.html'
);
assert.strictEqual(
  targetOf(tool.facebook, 'u').pathname,
  '/google-review-qr-code-generator.html'
);
assert.strictEqual(
  targetOf(tool.reddit, 'url').pathname,
  '/google-review-qr-code-generator.html'
);
assert.ok(new URL(tool.whatsapp).searchParams.get('text').indexOf('google-review-qr-code-generator.html') !== -1);

['x', 'whatsapp', 'facebook', 'reddit', 'native'].forEach(function (source) {
  assert.ok(home[source].indexOf('utm_source%3D' + source) !== -1 || source === 'native');
});
assert.ok(home.native.indexOf('utm_source=native') !== -1);
assert.ok(home.x.indexOf('utm_source=whatsapp') === -1);
assert.ok(home.facebook.indexOf('utm_source=reddit') === -1);

console.log('share tests passed');
