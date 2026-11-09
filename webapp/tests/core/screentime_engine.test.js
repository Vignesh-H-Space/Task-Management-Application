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

global.Components = {
  showToast: () => {}
};

global.XPEngine = {
  awardXP: (amount, reason) => {
    global.__lastAwardedXP = { amount, reason };
  }
};

const ScreentimeEngine = require('../../js/screentime_engine.js');

describe('Digital Wellbeing & Screen Time Engine Tests', () => {
  beforeEach(() => {
    global.localStorage.clear();
    global.__lastAwardedXP = null;
    ScreentimeEngine.init();
  });

  it('initializes with default apps and today date', () => {
    const todayData = ScreentimeEngine.getTodayData();
    assert.ok(todayData, 'todayData should exist');
    assert.strictEqual(todayData.totalMinutes, 0);
    assert.ok(Array.isArray(todayData.apps), 'apps should be an array');
    assert.ok(todayData.apps.length >= 5, 'should have default apps pre-seeded');

    const chess = todayData.apps.find(a => a.name === 'Chess Game');
    assert.ok(chess, 'Chess Game should be tracked');
    const linkedin = todayData.apps.find(a => a.name === 'LinkedIn');
    assert.ok(linkedin, 'LinkedIn should be tracked');
  });

  it('formats duration properly in hours and minutes', () => {
    assert.strictEqual(ScreentimeEngine.formatDuration(0), '0m');
    assert.strictEqual(ScreentimeEngine.formatDuration(45), '45m');
    assert.strictEqual(ScreentimeEngine.formatDuration(60), '1h');
    assert.strictEqual(ScreentimeEngine.formatDuration(125), '2h 5m');
  });

  it('quick adjusts app minutes and recalculates total', () => {
    ScreentimeEngine.quickAdjustApp('app_chess', 30);
    let todayData = ScreentimeEngine.getTodayData();
    let chess = todayData.apps.find(a => a.id === 'app_chess');
    assert.strictEqual(chess.minutes, 30);
    assert.strictEqual(todayData.totalMinutes, 30);

    ScreentimeEngine.quickAdjustApp('app_chess', 15);
    todayData = ScreentimeEngine.getTodayData();
    chess = todayData.apps.find(a => a.id === 'app_chess');
    assert.strictEqual(chess.minutes, 45);
    assert.strictEqual(todayData.totalMinutes, 45);

    // Cannot go below 0
    ScreentimeEngine.quickAdjustApp('app_chess', -100);
    todayData = ScreentimeEngine.getTodayData();
    chess = todayData.apps.find(a => a.id === 'app_chess');
    assert.strictEqual(chess.minutes, 0);
  });

  it('adds custom apps and adjusts daily goal', () => {
    const added = ScreentimeEngine.addApp('Twitter / X', '🐦', 25, 'Social');
    assert.strictEqual(added, true);

    const todayData = ScreentimeEngine.getTodayData();
    const twitter = todayData.apps.find(a => a.name === 'Twitter / X');
    assert.ok(twitter);
    assert.strictEqual(twitter.minutes, 25);
    assert.strictEqual(twitter.icon, '🐦');

    // Change daily limit
    const goalUpdated = ScreentimeEngine.setDailyGoal(240);
    assert.strictEqual(goalUpdated, true);
    assert.strictEqual(ScreentimeEngine.data.dailyGoalMinutes, 240);
  });

  it('imports external JSON payload from Tasker/MacroDroid bridge', () => {
    const payload = {
      date: ScreentimeEngine.getToday(),
      totalMinutes: 110,
      apps: [
        { name: 'Chess Game', minutes: 50, icon: '♟️', category: 'Mind' },
        { name: 'LinkedIn', minutes: 60, icon: '💼', category: 'Career' }
      ]
    };

    const res = ScreentimeEngine.importFromPayload(payload);
    assert.strictEqual(res, true);

    const todayData = ScreentimeEngine.getTodayData();
    assert.strictEqual(todayData.totalMinutes, 110);
    const chess = todayData.apps.find(a => a.name === 'Chess Game');
    assert.strictEqual(chess.minutes, 50);
    const linkedin = todayData.apps.find(a => a.name === 'LinkedIn');
    assert.strictEqual(linkedin.minutes, 60);
  });

  it('persists data across reloads via localStorage', () => {
    ScreentimeEngine.quickAdjustApp('app_linkedin', 40);
    ScreentimeEngine.save();

    // Reload from storage
    ScreentimeEngine.load();
    const todayData = ScreentimeEngine.getTodayData();
    const linkedin = todayData.apps.find(a => a.id === 'app_linkedin');
    assert.strictEqual(linkedin.minutes, 40);
  });
});
