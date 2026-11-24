const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Mock localStorage and window
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

global.window = {
  crypto: {
    subtle: globalThis.crypto.subtle,
    getRandomValues: (arr) => globalThis.crypto.getRandomValues(arr)
  },
  btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
  atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
  location: { pathname: '/index.html', search: '', replace: () => {} }
};

// Load AuthEngine
const fs = require('fs');
const code = fs.readFileSync(__dirname + '/../../js/auth_engine.js', 'utf8');
eval(code);
const Auth = window.AuthEngine;

describe('Authentication & Access Control Engine Tests', () => {
  beforeEach(() => {
    global.localStorage.clear();
  });

  it('detects isSetup() false when not configured and true when master key created', async () => {
    assert.strictEqual(Auth.isSetup(), false);
    await Auth.setupMaster('vignesh', 'Password123');
    assert.strictEqual(Auth.isSetup(), true);
  });

  it('verifies correct credentials and rejects incorrect password or username', async () => {
    await Auth.setupMaster('admin', 'StrongKey999');
    const valid = await Auth.verify('admin', 'StrongKey999');
    assert.strictEqual(valid, true);

    const wrongPass = await Auth.verify('admin', 'WrongPass123');
    assert.strictEqual(wrongPass, false);

    const wrongUser = await Auth.verify('otheruser', 'StrongKey999');
    assert.strictEqual(wrongUser, false);
  });

  it('enforces password minimum length of 6 characters', async () => {
    await assert.rejects(
      async () => { await Auth.setupMaster('admin', '12345'); },
      /at least 6 characters/
    );
  });

  it('resets master credentials cleanly with resetMaster()', async () => {
    await Auth.setupMaster('vignesh', 'Password123');
    assert.strictEqual(Auth.isSetup(), true);

    Auth.resetMaster();
    assert.strictEqual(Auth.isSetup(), false);
    assert.strictEqual(global.localStorage.getItem(Auth.STORAGE_MASTER), null);
  });

  it('manages Remember Me session persistence and expiration', async () => {
    await Auth.setupMaster('vignesh', 'Password123');
    await Auth.login('vignesh', 'Password123', true);
    assert.strictEqual(Auth.isAuthenticated(), true);

    Auth.logout();
    assert.strictEqual(Auth.isAuthenticated(), false);
  });
});
