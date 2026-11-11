'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

/**
 * Run one of the browser IIFE scripts in a fresh sandbox and return the
 * sandbox, so the global it attaches (e.g. WifiPayload) can be read back.
 */
function loadIIFE(filename) {
  const code = fs.readFileSync(path.join(root, filename), 'utf8');
  const sandbox = {
    console: console,
    URL: URL,
    URLSearchParams: URLSearchParams,
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
    Uint8Array: Uint8Array,
    Promise: Promise,
    crypto: globalThis.crypto
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox, { filename: filename });
  return sandbox;
}

module.exports = { root, loadIIFE };
