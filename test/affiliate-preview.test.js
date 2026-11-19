'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { root } = require('./helpers');

const STATEMENT = 'As an Amazon Associate I earn from qualifying purchases.';
const NEW_GUIDES = [
  'guides/label-printer-for-table-tent-qr.html',
  'guides/cafe-guest-wifi-router.html'
];

function listHtml(dir, rel) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor') continue;
    const child = path.join(dir, entry.name);
    const childRel = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...listHtml(child, childRel));
    else if (entry.name.endsWith('.html')) out.push(childRel);
  }
  return out;
}

test('purchase guides are English decision pages with disclosure slots and no tracking links', function () {
  const index = fs.readFileSync(path.join(root, 'guides/index.html'), 'utf8');
  NEW_GUIDES.forEach(function (rel) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.match(html, /<html lang="en">/);
    assert.match(html, /G-JV95W19XS3/);
    assert.match(html, /ca-pub-8737820277849030/);
    assert.match(html, new RegExp(STATEMENT.replace(/[.]/g, '\\.')));
    assert.match(html, /<p class="associate-disclosure">As an Amazon Associate I earn from qualifying purchases\.<\/p>/);
    assert.match(html, /replace after Amazon Associates approval/i);
    assert.match(html, /Disclosure slot \(paid link\)/);
    assert.match(html, /Placeholder, not a link/);
    assert.equal((html.match(/class="affiliate-slot"/g) || []).length >= 1, true);
    const slots = html.match(/<p class="affiliate-slot">[\s\S]*?<\/p>/g) || [];
    assert.equal(slots.length >= 1, true);
    slots.forEach(function (slot) {
      assert.equal(/<a\b/i.test(slot), false);
      assert.match(slot, /replace after Amazon Associates approval/i);
      assert.match(slot, /paid link/i);
    });
    assert.doesNotMatch(html, /amazon\.com|amzn\.to|\btag=|assoc-data|ascsubtag/i);
    assert.doesNotMatch(html, /whatsapp-channel-qr-code-generator|apple-music-qr-code-generator/);
    assert.doesNotMatch(html, /林启|Lin Qi/);
    assert.doesNotMatch(html, /ko-fi|kofi|buy me a coffee|buymeacoffee|github\.com\/sponsors|paypal/i);
    assert.doesNotMatch(html, /[\u3400-\u9FFF]/);
    assert.equal(index.includes('href="' + path.basename(rel) + '"'), true);
  });

  const label = fs.readFileSync(path.join(root, NEW_GUIDES[0]), 'utf8');
  assert.match(label, /href="cafe-table-tent-menu-wifi-review-qr\.html"/);
  assert.match(label, /href="qr-code-print-size-scan-distance\.html"/);
  const router = fs.readFileSync(path.join(root, NEW_GUIDES[1]), 'utf8');
  assert.match(router, /href="guest-wifi-qr-code-cafe-restaurant\.html"/);
  assert.match(router, /href="\.\.\/wifi-qr-code-generator\.html"/);
});

test('every public page footer shows the Associates statement and nowhere else on live pages', function () {
  const pages = listHtml(root, '');
  assert.equal(pages.length > 10, true);
  pages.forEach(function (rel) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.match(
      html,
      /<footer class="site-footer">\n {2}<p class="associate-disclosure">As an Amazon Associate I earn from qualifying purchases\.<\/p>/
    );
    const count = (html.match(/As an Amazon Associate I earn from qualifying purchases\./g) || []).length;
    if (NEW_GUIDES.indexOf(rel) !== -1) assert.equal(count, 2);
    else assert.equal(count, 1, rel);
    assert.doesNotMatch(html, /林启|Lin Qi/);
    assert.doesNotMatch(html, /ko-fi|buymeacoffee|github\.com\/sponsors/i);
    assert.doesNotMatch(html, /amazon\.com[^"'\s]*tag=|amzn\.to/i);
  });
});

test('ads.txt, toolfound-verify, and appended sitemap neighbors stay locked', function () {
  const ads = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert.equal(ads, 'google.com, pub-8737820277849030, DIRECT, f08c47fec0942fa0\n');
  assert.match(index, /name="toolfound-verify" content="490c0cfeeb94b3d65d893e18dcff92dca9ab1b123e18a330"/);
  assert.match(index, /name="google-adsense-account" content="ca-pub-8737820277849030"/);
  assert.doesNotMatch(index, /label-printer-for-table-tent-qr|cafe-guest-wifi-router/);
  assert.match(
    sitemap,
    /<loc>https:\/\/qrstatic\.app\/guides\/google-maps-location-qr-code-store\.html<\/loc><lastmod>2026-11-12<\/lastmod><changefreq>monthly<\/changefreq><priority>0\.8<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/guides\/label-printer-for-table-tent-qr\.html<\/loc><lastmod>2026-11-19<\/lastmod><changefreq>monthly<\/changefreq><priority>0\.8<\/priority><\/url>\n {2}<url><loc>https:\/\/qrstatic\.app\/guides\/cafe-guest-wifi-router\.html<\/loc><lastmod>2026-11-19<\/lastmod><changefreq>monthly<\/changefreq><priority>0\.8<\/priority><\/url>\n<\/urlset>/
  );
});
