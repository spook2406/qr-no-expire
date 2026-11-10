#!/usr/bin/env node
'use strict';

/**
 * Static checks that are easy to forget when a new page is added:
 *  - every public HTML page is in sitemap.xml, and every sitemap URL exists
 *  - each page's canonical URL matches its sitemap URL
 *  - every generator page is linked from the homepage
 *  - every generator page loads qrcode → qr-core → its scripts → share.js
 *  - local href/src links point at files that exist
 *
 * Usage: node scripts/check-site.js   (exit code 1 on any problem)
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SITE = 'https://qrstatic.app/';
const problems = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function listHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? dir + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'vendor', 'test', 'scripts'].includes(entry.name)) continue;
      out.push(...listHtml(rel));
    } else if (entry.name.endsWith('.html')) {
      out.push(rel);
    }
  }
  return out.sort();
}

/** Public URL for a file: index.html → directory URL. */
function urlFor(rel) {
  return SITE + rel.replace(/(^|\/)index\.html$/, '$1');
}

const pages = listHtml('');
const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const pageUrls = new Map(pages.map((p) => [urlFor(p), p]));

for (const [url, rel] of pageUrls) {
  if (!sitemapUrls.includes(url)) problems.push(rel + ': missing from sitemap.xml (' + url + ')');
}
for (const url of sitemapUrls) {
  if (!pageUrls.has(url)) problems.push('sitemap.xml: ' + url + ' has no matching HTML file');
}
const dupes = sitemapUrls.filter((u, i) => sitemapUrls.indexOf(u) !== i);
for (const url of new Set(dupes)) problems.push('sitemap.xml: duplicate entry ' + url);

const index = read('index.html');
const generators = pages.filter((p) => /-generator\.html$/.test(p));

for (const rel of pages) {
  const html = read(rel);

  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (!canonical) problems.push(rel + ': no <link rel="canonical">');
  else if (canonical !== urlFor(rel)) problems.push(rel + ': canonical is ' + canonical + ', expected ' + urlFor(rel));

  // Local links and assets must exist.
  const dir = path.posix.dirname(rel);
  for (const m of html.matchAll(/\s(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const target = m[1];
    if (/^(?:[a-z]+:|\/\/)/i.test(target)) continue;
    const resolved = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(dir, target));
    const full = path.join(root, resolved);
    const exists = fs.existsSync(full) && (fs.statSync(full).isFile() || fs.existsSync(path.join(full, 'index.html')));
    if (!exists) problems.push(rel + ': broken local link ' + target);
  }
}

for (const rel of generators.concat('index.html')) {
  const html = read(rel);
  if (rel !== 'index.html' && !index.includes('href="' + rel + '"')) {
    problems.push(rel + ': not linked from index.html');
  }
  const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
  const at = (name) => scripts.indexOf(name);
  if (at('vendor/qrcode.min.js') !== 0) problems.push(rel + ': vendor/qrcode.min.js must be the first local script');
  if (at('js/qr-core.js') !== 1) problems.push(rel + ': js/qr-core.js must load right after vendor/qrcode.min.js');
  if (at('js/share.js') !== scripts.length - 1) problems.push(rel + ': js/share.js must be the last local script');
  for (const s of scripts) {
    if (!/\sdefer[\s>]/.test(html.slice(html.indexOf('src="' + s + '"') - 40, html.indexOf('src="' + s + '"')))) {
      problems.push(rel + ': ' + s + ' should use defer so scripts run in order');
    }
  }
}

if (problems.length) {
  console.error('Site check found ' + problems.length + ' problem(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('Site check passed: ' + pages.length + ' pages, ' + generators.length + ' generators, ' + sitemapUrls.length + ' sitemap URLs.');
