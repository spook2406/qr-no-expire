'use strict';

// Browser smoke test: load every generator page, fill a valid input, click
// Generate, and check that a QR is drawn, downloads work, the share row
// appears, and no script errors are thrown. External hosts (ads, analytics)
// are blocked so the test runs offline.
//
// Run with: npm run test:e2e   (needs Playwright + Chromium)

const http = require('http');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

// page → steps to put a valid payload in the form.
const PAGES = {
  'index.html': [['fill', '#input-url', 'example.com']],
  'wifi-qr-code-generator.html': [['fill', '#wifi-ssid', 'Cafe Guest'], ['fill', '#wifi-pass', 'secret123']],
  'vcard-qr-code-generator.html': [['fill', '#vc-first', 'Ann'], ['fill', '#vc-last', 'Lee']],
  'calendar-event-qr-code-generator.html': [
    ['fill', '#cal-title', 'Party'], ['fill', '#cal-start-date', '2026-12-01'],
    ['fill', '#cal-end-date', '2026-12-01'], ['fill', '#cal-start-time', '18:00'], ['fill', '#cal-end-time', '20:00']
  ],
  'google-review-qr-code-generator.html': [['fill', '#review-input', 'ChIJN1t_tDeuEmsRUsoyG83frY4']],
  'location-qr-code-generator.html': [['fill', '#loc-query', 'Eiffel Tower']],
  'phone-call-qr-code-generator.html': [['fill', '#phone-number', '+15551234567']],
  'sms-qr-code-generator.html': [['fill', '#sms-phone', '+15551234567'], ['fill', '#sms-message', 'Hi']],
  'email-qr-code-generator.html': [['fill', '#email-to', 'hello@example.com']],
  'whatsapp-qr-code-generator.html': [['fill', '#wa-cc', '1'], ['fill', '#wa-phone', '5551234567']],
  'telegram-qr-code-generator.html': [['fill', '#telegram-url', '@durov']],
  'discord-qr-code-generator.html': [['fill', '#discord-url', 'https://discord.gg/abcDEF12']],
  'zoom-meeting-qr-code-generator.html': [['fill', '#zoom-url', 'https://us02web.zoom.us/j/85012345678']],
  'google-meet-qr-code-generator.html': [['fill', '#meet-url', 'https://meet.google.com/abc-defg-hij']],
  'teams-meeting-qr-code-generator.html': [['fill', '#teams-url', 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d']],
  'spotify-qr-code-generator.html': [['fill', '#spotify-url', 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC']],
  'google-form-qr-code-generator.html': [['fill', '#gform-url', 'https://forms.gle/AbCdEf123']],
  'calendly-qr-code-generator.html': [['fill', '#calendly-url', 'https://calendly.com/example-user/30min']],
  'totp-qr-code-generator.html': [['fill', '#otp-account', 'ann@example.com'], ['fill', '#otp-secret', 'JBSWY3DPEHPK3PXP']],
  'app-store-google-play-qr-code-generator.html': [
    ['fill', '#appstore-url', 'https://apps.apple.com/us/app/example-app/id310633997'],
    ['fill', '#play-url', 'https://play.google.com/store/apps/details?id=com.example.app']
  ]
};

// Pages whose preview is not the single #qr-canvas / #download-png / #download-svg set.
const CUSTOM_PREVIEW = {
  'app-store-google-play-qr-code-generator.html': { canvas: '#qr-appstore', png: '#png-appstore', svg: '#svg-appstore' }
};

let server;
let baseUrl;
let browser;

test.before(async () => {
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch();
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

test('every generator page is covered by this smoke test', () => {
  const pages = fs.readdirSync(root).filter((f) => /-generator\.html$/.test(f)).concat('index.html').sort();
  assert.deepEqual(Object.keys(PAGES).sort(), pages);
});

for (const [page, steps] of Object.entries(PAGES)) {
  test('generates a QR on ' + page, async () => {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const tab = await ctx.newPage();
    const errors = [];
    tab.on('pageerror', (err) => errors.push(err.message));
    await tab.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    });
    try {
      await tab.goto(baseUrl + page, { waitUntil: 'load' });
      const sel = Object.assign({ canvas: '#qr-canvas', png: '#download-png', svg: '#download-svg' }, CUSTOM_PREVIEW[page]);

      assert.equal(await tab.isHidden(sel.canvas), true, 'canvas starts hidden');
      assert.equal(await tab.isDisabled(sel.png), true, 'PNG button starts disabled');
      assert.equal(await tab.isHidden('#share-result'), true, 'share row starts hidden');

      for (const [action, target, value] of steps) await tab[action](target, value);
      await tab.click('#generate-btn');

      await tab.waitForSelector(sel.canvas, { state: 'visible', timeout: 5000 });
      assert.equal(await tab.isEnabled(sel.png), true, 'PNG button enabled after generate');
      assert.equal((await tab.textContent('#form-error')).trim(), '', 'no form error');

      const png = await Promise.all([tab.waitForEvent('download'), tab.click(sel.png)]);
      assert.match(png[0].suggestedFilename(), /\.png$/);

      const svg = await Promise.all([tab.waitForEvent('download'), tab.click(sel.svg)]);
      assert.match(svg[0].suggestedFilename(), /\.svg$/);
      const svgText = fs.readFileSync(await svg[0].path(), 'utf8');
      assert.match(svgText, /^<svg[\s>]/);

      await tab.waitForSelector('#share-result', { state: 'visible', timeout: 2000 });
      const shareHref = await tab.getAttribute('#share-x', 'href');
      assert.match(shareHref, /^https:\/\/x\.com\/intent\/tweet\?/);

      assert.deepEqual(errors, [], 'no uncaught page errors');
    } finally {
      await ctx.close();
    }
  });
}
