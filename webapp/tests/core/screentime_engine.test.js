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
    ScreentimeEngine.selectedDate = null;
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

  it('navigates dates backward and forward properly', () => {
    const today = ScreentimeEngine.getToday();
    assert.strictEqual(ScreentimeEngine.selectedDate, today);

    // Navigate to yesterday
    ScreentimeEngine.navigateDate(-1);
    const yesterday = ScreentimeEngine.selectedDate;
    assert.notStrictEqual(yesterday, today);

    // Quick adjust on yesterday
    ScreentimeEngine.quickAdjustApp('app_chess', 40);
    const yesterdayData = ScreentimeEngine.getDateData(yesterday);
    assert.strictEqual(yesterdayData.totalMinutes, 40);

    // Jump back to today
    ScreentimeEngine.goToToday();
    assert.strictEqual(ScreentimeEngine.selectedDate, today);
    assert.strictEqual(ScreentimeEngine.getTodayData().totalMinutes, 0); // Today is independent!
  });

  it('calculates range dates for 7d, 30d, and 90d (up to 3 months)', () => {
    const dates7 = ScreentimeEngine.getRangeDates('7d');
    assert.strictEqual(dates7.length, 7);
    assert.strictEqual(dates7[dates7.length - 1], ScreentimeEngine.getToday());

    const dates30 = ScreentimeEngine.getRangeDates('30d');
    assert.strictEqual(dates30.length, 30);

    const dates90 = ScreentimeEngine.getRangeDates('90d');
    assert.strictEqual(dates90.length, 90);
  });

  it('retains history for up to 120 days and prunes older entries safely', () => {
    // Populate an entry from 40 days ago, 85 days ago, and 150 days ago
    const now = new Date();
    const d40 = new Date(now.getTime() - 40 * 86400000).toISOString().split('T')[0];
    const d85 = new Date(now.getTime() - 85 * 86400000).toISOString().split('T')[0];
    const d150 = new Date(now.getTime() - 150 * 86400000).toISOString().split('T')[0];

    ScreentimeEngine.data.history[d40] = { totalMinutes: 120, apps: [] };
    ScreentimeEngine.data.history[d85] = { totalMinutes: 90, apps: [] };
    ScreentimeEngine.data.history[d150] = { totalMinutes: 200, apps: [] };

    ScreentimeEngine.pruneOldData(120);

    assert.ok(ScreentimeEngine.data.history[d40], '40-day data must be preserved (> 1 month)');
    assert.ok(ScreentimeEngine.data.history[d85], '85-day data must be preserved (> 50 days, within 3 months)');
    assert.strictEqual(ScreentimeEngine.data.history[d150], undefined, '150-day data should be pruned (> 120 days)');
  });

  it('generates responsive SVG chart with goal markers', () => {
    const svg7 = ScreentimeEngine.renderTrendChartSVG('7d');
    assert.ok(svg7.includes('<svg'), 'SVG chart should be generated');
    assert.ok(svg7.includes('Goal ('), 'Goal marker should be included');

    const svg90 = ScreentimeEngine.renderTrendChartSVG('90d');
    assert.ok(svg90.includes('<svg'), '90-day SVG chart should be generated');
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
