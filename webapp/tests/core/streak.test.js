const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load streak engine into an isolated sandbox context
function createStreakContext() {
  const code = fs.readFileSync(path.resolve(__dirname, '../../js/streak_engine.js'), 'utf8');
  const context = {
    state: { streak: { count: 1, lastDate: null } },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); }
    },
    document: {
      getElementById() { return null; }
    },
    window: {}
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

describe('Streak Engine Tests', () => {
  test('getToday() returns valid YYYY-MM-DD formatted string', () => {
    const ctx = createStreakContext();
    const today = ctx.getToday();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    const parts = today.split('-').map(Number);
    assert.strictEqual(parts.length, 3);
    assert.ok(parts[1] >= 1 && parts[1] <= 12);
    assert.ok(parts[2] >= 1 && parts[2] <= 31);
  });

  test('getDaysBetween() calculates day differences accurately', () => {
    const ctx = createStreakContext();
    assert.strictEqual(ctx.getDaysBetween('2026-10-01', '2026-10-02'), 1);
    assert.strictEqual(ctx.getDaysBetween('2026-10-01', '2026-10-01'), 0);
    assert.strictEqual(ctx.getDaysBetween('2026-10-01', '2026-10-08'), 7);
    assert.strictEqual(ctx.getDaysBetween('2026-09-30', '2026-10-01'), 1);
    assert.strictEqual(ctx.getDaysBetween(null, '2026-10-01'), 999);
  });

  test('STREAK_BADGES milestones are sorted ascending with proper emojis', () => {
    const ctx = createStreakContext();
    const badges = ctx.window.STREAK_BADGES || ctx.STREAK_BADGES;
    assert.ok(Array.isArray(badges) && badges.length >= 10);
    for (let i = 1; i < badges.length; i++) {
      assert.ok(badges[i].days > badges[i - 1].days, `Badge ${badges[i].name} should be greater than previous`);
      assert.ok(badges[i].emoji.length > 0);
    }
  });

  test('checkAndUpdateStreak() increments on consecutive days', () => {
    const ctx = createStreakContext();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    ctx.state.streak = { count: 5, lastDate: yesterday };

    ctx.checkAndUpdateStreak();
    assert.strictEqual(ctx.state.streak.count, 6);
  });

  test('checkAndUpdateStreak() resets to 1 after multiple missed days with zero shields', () => {
    const ctx = createStreakContext();
    ctx.state.streak = { count: 12, lastDate: '2026-01-01' };

    ctx.checkAndUpdateStreak();
    assert.strictEqual(ctx.state.streak.count, 1);
  });
});
