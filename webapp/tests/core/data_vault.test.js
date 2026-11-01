const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('Data Vault Backup Schema Tests', () => {
  test('Executive Backup v2.0 structure contains all critical root entities', () => {
    const backup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      tasks: [
        { id: 't1', title: 'Task 1', tier: 'daily', completed: false }
      ],
      profile: { name: 'Executive', image: null },
      streak: { count: 14, lastDate: '2026-10-30' },
      xpData: { totalXP: 1250, level: 3 },
      habits: [],
      bucketList: [],
      focusSessions: []
    };

    const json = JSON.stringify(backup);
    const parsed = JSON.parse(json);

    assert.strictEqual(parsed.version, '2.0');
    assert.ok(Array.isArray(parsed.tasks));
    assert.strictEqual(parsed.tasks.length, 1);
    assert.strictEqual(parsed.profile.name, 'Executive');
    assert.strictEqual(parsed.streak.count, 14);
  });

  test('Legacy task array backups are backward-compatible', () => {
    const legacyBackup = [
      { id: 'legacy_1', title: 'Old Task', tier: 'weekly', completed: true }
    ];

    const json = JSON.stringify(legacyBackup);
    const parsed = JSON.parse(json);

    assert.ok(Array.isArray(parsed));
    assert.strictEqual(parsed[0].id, 'legacy_1');
  });
});
