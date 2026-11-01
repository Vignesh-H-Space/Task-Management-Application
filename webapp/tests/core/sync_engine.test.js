const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('E2EE Sync Engine Robustness Tests', () => {
  function createSyncContext(initialStorage = {}) {
    const syncCode = fs.readFileSync(path.resolve(__dirname, '../../js/sync_engine.js'), 'utf8');

    const storage = new Map(Object.entries(initialStorage));

    const context = {
      window: {
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        atob: (s) => Buffer.from(s, 'base64').toString('binary')
      },
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      atob: (s) => Buffer.from(s, 'base64').toString('binary'),
      document: {
        getElementById: () => null
      },
      localStorage: {
        getItem: (k) => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k)
      },
      console: console,
      TextEncoder: TextEncoder,
      TextDecoder: TextDecoder,
      Uint8Array: Uint8Array,
      Date: Date,
      JSON: JSON,
      Math: Math
    };

    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(syncCode, context);
    return context;
  }

  test('getConfig() returns null for empty or incomplete configs without crashing', () => {
    const ctx = createSyncContext({
      'tesseract_firebase_config': '{}'
    });

    const engine = ctx.window.SyncEngine;
    assert.strictEqual(engine.getConfig(), null, 'Empty config must be rejected as null');
  });

  test('getConfig() accepts valid config with apiKey and projectId', () => {
    const validConfig = { apiKey: 'AIzaSyTest123', projectId: 'tesseract-test' };
    const ctx = createSyncContext({
      'tesseract_firebase_config': JSON.stringify(validConfig)
    });

    const engine = ctx.window.SyncEngine;
    const cfg = engine.getConfig();
    assert.ok(cfg, 'Valid config should be accepted');
    assert.strictEqual(cfg.apiKey, 'AIzaSyTest123');
    assert.strictEqual(cfg.projectId, 'tesseract-test');
  });

  test('portable encryption and decryption round-trip correctly', async () => {
    const ctx = createSyncContext();
    const engine = ctx.window.SyncEngine;

    const sampleData = {
      tasks: [{ id: '1', title: 'Test Task' }],
      profile: { name: 'Executive' }
    };

    const passphrase = 'test-secret-passphrase-123';
    const encrypted = await engine.encryptPayload(sampleData, passphrase);

    assert.ok(encrypted.ciphertext, 'Encrypted payload must have ciphertext');
    assert.ok(encrypted.salt, 'Encrypted payload must have salt');
    assert.ok(encrypted.iv, 'Encrypted payload must have iv');

    const decrypted = await engine.decryptPayload(encrypted, passphrase);
    assert.deepStrictEqual(decrypted, sampleData, 'Decrypted payload must match original data');
  });

  test('clearCredentials() resets state to unconfigured', () => {
    const ctx = createSyncContext({
      'tesseract_firebase_config': JSON.stringify({ apiKey: 'key', projectId: 'proj' }),
      'tesseract_sync_passphrase': 'mypassphrase'
    });

    const engine = ctx.window.SyncEngine;
    engine.status = 'error';
    engine.clearCredentials();

    assert.strictEqual(engine.status, 'unconfigured');
    assert.strictEqual(ctx.localStorage.getItem('tesseract_firebase_config'), null);
    assert.strictEqual(ctx.localStorage.getItem('tesseract_sync_passphrase'), null);
  });

  test('pushLocalChange aliases queuePush safely', () => {
    const ctx = createSyncContext();
    const engine = ctx.window.SyncEngine;
    assert.strictEqual(typeof engine.pushLocalChange, 'function', 'pushLocalChange must be defined');
    // Ensure it does not throw
    engine.status = 'unconfigured';
    engine.pushLocalChange();
  });
});
