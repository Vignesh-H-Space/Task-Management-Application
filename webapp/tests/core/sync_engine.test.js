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
        atob: (s) => Buffer.from(s, 'base64').toString('binary'),
        state: { tasks: [] }
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

  test('mergeTasks non-destructively preserves local tasks not present in remote snapshot', () => {
    const ctx = createSyncContext();
    const engine = ctx.window.SyncEngine;

    const localTasks = [
      { id: 'task_local_1', title: 'Laptop Task Created Offline', createdAt: 2000, updatedAt: 2000 },
      { id: 'task_shared', title: 'Shared Task (Local newer)', updatedAt: 3000 }
    ];

    const remoteTasks = [
      { id: 'task_phone_1', title: 'Phone Task', createdAt: 1000 },
      { id: 'task_shared', title: 'Shared Task (Remote older)', updatedAt: 1000 }
    ];

    const merged = engine.mergeTasks(localTasks, remoteTasks);

    // Both local and remote unique tasks must be preserved!
    assert.strictEqual(merged.length, 3, 'Merged list must contain all 3 tasks');
    assert.ok(merged.some(t => t.id === 'task_local_1'), 'Local-only task must be preserved');
    assert.ok(merged.some(t => t.id === 'task_phone_1'), 'Remote-only task must be preserved');

    // Conflicted task must choose the newer one (local has updatedAt 3000 vs 1000)
    const shared = merged.find(t => t.id === 'task_shared');
    assert.strictEqual(shared.title, 'Shared Task (Local newer)');
  });

  test('createPreSyncSafetySnapshot and restorePreSyncSafetySnapshot round-trip correctly', () => {
    const originalTasks = [{ id: 'task_orig', title: 'Important Laptop Task' }];
    const ctx = createSyncContext({
      'tesseract_goals_tasks_data': JSON.stringify(originalTasks)
    });
    ctx.window.state = { tasks: [...originalTasks] };

    const engine = ctx.window.SyncEngine;
    engine.createPreSyncSafetySnapshot();

    // Verify snapshot was created
    const snapshotRaw = ctx.localStorage.getItem('tesseract_pre_sync_safety_backup');
    assert.ok(snapshotRaw, 'Pre-sync snapshot must exist in localStorage');
    const snapshot = JSON.parse(snapshotRaw);
    assert.strictEqual(snapshot.tasks[0].id, 'task_orig');

    // Simulate an accidental overwrite by a stale remote push
    ctx.window.state.tasks = [{ id: 'task_stale_phone', title: 'Old Phone Task' }];
    ctx.localStorage.setItem('tesseract_goals_tasks_data', JSON.stringify(ctx.window.state.tasks));

    // Restore pre-sync safety backup
    const restored = engine.restorePreSyncSafetySnapshot();
    assert.strictEqual(restored, true, 'Restore operation must succeed');

    // Verify restored state
    const currentTasks = JSON.parse(ctx.localStorage.getItem('tesseract_goals_tasks_data'));
    assert.strictEqual(currentTasks[0].id, 'task_orig', 'Original tasks must be restored');
  });

  test('hasInitialPullCompleted blocks pushNow when initial pull is pending', async () => {
    const ctx = createSyncContext({
      'tesseract_firebase_config': JSON.stringify({ apiKey: 'key', projectId: 'proj' }),
      'tesseract_sync_passphrase': 'mypassphrase',
      'tesseract_sync_room_id': 'test-room'
    });
    const engine = ctx.window.SyncEngine;
    engine.db = { collection: () => {} };
    engine.hasInitialPullCompleted = false;

    // queuePush must defer when initial pull is false
    engine.queuePush();
    assert.strictEqual(engine.pushDebounceTimer, null, 'Push timer must NOT start when initial pull is pending');
  });
});
