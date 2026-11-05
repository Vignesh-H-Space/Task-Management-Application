const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Data Vault Inspector & Recovery Tests', () => {
  function createInspectorContext(initialStorage = {}) {
    const inspectorCode = fs.readFileSync(path.resolve(__dirname, '../../js/vault_inspector.js'), 'utf8');

    const storage = new Map(Object.entries(initialStorage));

    const context = {
      window: {},
      state: { tasks: [] },
      document: {
        getElementById: () => null,
        body: { insertAdjacentHTML: () => {} }
      },
      localStorage: {
        getItem: (k) => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k)
      },
      console: console,
      Date: Date,
      JSON: JSON,
      Components: { showToast: () => {} },
      SyncEngine: { pushNow: () => {}, hasInitialPullCompleted: false }
    };

    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(inspectorCode, context);
    return context;
  }

  test('VaultInspector.inspect() produces complete diagnostic report', () => {
    const ctx = createInspectorContext({
      'tesseract_goals_tasks_data': JSON.stringify([{ id: '1', title: 'Task A' }]),
      'tesseract_backlog_data': JSON.stringify([{ id: 'bkl_1', objective: 'Trim Pubic' }]),
      'tesseract_daily_completions_archive': JSON.stringify([{ taskId: '1', date: '2026-11-02' }])
    });

    const report = ctx.window.VaultInspector.inspect();
    assert.strictEqual(report.tasksInStorage, 1);
    assert.strictEqual(report.backlogsInStorage, 1);
    assert.strictEqual(report.archiveInStorage, 1);
    assert.strictEqual(report.hasPreSyncBackup, false);
  });

  test('VaultInspector.restoreNov2Tasks() restores Trim Pubic and Dumbell Lift', () => {
    const ctx = createInspectorContext();
    const result = ctx.window.VaultInspector.restoreNov2Tasks();

    assert.strictEqual(result, true, 'Rescue function must return true');

    const tasks = ctx.window.state.tasks;
    assert.ok(tasks.length >= 2, 'Should have at least 2 tasks restored');
    assert.ok(tasks.some(t => t.title === 'Trim Pubic'), 'Trim Pubic must be restored');
    assert.ok(tasks.some(t => t.title === 'Dumbell Lift'), 'Dumbell Lift must be restored');

    const storageTasks = JSON.parse(ctx.localStorage.getItem('tesseract_goals_tasks_data'));
    assert.ok(storageTasks.some(t => t.title === 'Trim Pubic'));

    // Timestamp must be asserted forward into the future
    const lastModified = parseInt(ctx.localStorage.getItem('tesseract_sync_last_local_modified'), 10);
    assert.ok(lastModified > Date.now(), 'Timestamp must be bumped into future to prevent phone overwrite');
  });
});
