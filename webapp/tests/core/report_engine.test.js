const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

global.state = {
  tasks: [],
  profile: { name: 'Test Executive' }
};

global.XPEngine = {
  data: { totalXP: 500, level: 2, rankTitle: 'Operator', streak: 3 }
};

const ReportEngine = require('../../js/report_engine.js');

describe('Executive Report Engine (100% Real Data) Tests', () => {
  beforeEach(() => {
    global.localStorage.clear();
    global.state.tasks = [];
    ReportEngine.cadence = 'weekly';
    ReportEngine.anchorDate = new Date();
  });

  it('returns zeroed metrics when no real tasks, sessions, habits, or screentime exist (no fake fallbacks)', () => {
    const data = ReportEngine.getAggregatedData();
    assert.strictEqual(data.completedTasks.length, 0);
    assert.strictEqual(data.effectiveSessions.length, 0);
    assert.strictEqual(data.focusMins, 0);
    assert.strictEqual(data.focusHours, '0.0');
    assert.strictEqual(data.habitHeatmapRows.length, 0);
    assert.strictEqual(data.habitAdherencePct, 0);
    assert.strictEqual(data.screentime.daysLogged, 0);
    assert.strictEqual(data.completionRate, 0);
  });

  it('aggregates real completed tasks, focus sessions, habits, and screentime within the active period', () => {
    const now = new Date();
    const todayISO = ReportEngine.formatLocalISO(now);
    const nowISO = now.toISOString();

    global.state.tasks = [
      { id: 't1', title: 'Ship v1', tier: 'daily', category: 'Engineering', priority: 'high', completed: true, completedAt: nowISO },
      { id: 't2', title: 'Old task', tier: 'weekly', category: 'Product', priority: 'medium', completed: true, completedAt: '2020-01-01T10:00:00.000Z' },
      { id: 't3', title: 'Open task', tier: 'daily', category: 'Engineering', priority: 'low', completed: false, parentId: 't0' }
    ];

    global.localStorage.setItem('tesseract_focus_sessions', JSON.stringify([
      { id: 's1', durationMinutes: 45, timestamp: nowISO },
      { id: 's2', durationMinutes: 30, timestamp: '2020-01-01T10:00:00.000Z' }
    ]));

    global.localStorage.setItem('tesseract_habits_data', JSON.stringify([
      { id: 'h1', title: 'Chess Game', icon: '♟️', category: 'Mind', history: { [todayISO]: true } }
    ]));

    global.localStorage.setItem('tesseract_screentime_data', JSON.stringify({
      dailyGoalMinutes: 180,
      history: { [todayISO]: { totalMinutes: 120 } }
    }));

    const data = ReportEngine.getAggregatedData();
    assert.strictEqual(data.completedTasks.length, 1, 'Should exclude out-of-range completed task');
    assert.strictEqual(data.completedTasks[0].id, 't1');
    assert.strictEqual(data.effectiveSessions.length, 1, 'Should exclude out-of-range focus session');
    assert.strictEqual(data.focusMins, 45);
    assert.strictEqual(data.habitHeatmapRows.length, 1);
    assert.strictEqual(data.habitHeatmapRows[0].checks, 1);
    assert.strictEqual(data.screentime.daysLogged, 1);
    assert.strictEqual(data.screentime.totalMinutes, 120);
    assert.strictEqual(data.screentime.compliancePct, 100);
    assert.strictEqual(data.alignmentScore, 100);
  });

  it('includes archived daily completions from rollover within the active period', () => {
    const now = new Date();
    const todayISO = ReportEngine.formatLocalISO(now);
    global.localStorage.setItem('tesseract_daily_completions_archive', JSON.stringify([
      { taskId: 'd1', title: 'Morning Run', category: 'Health', tier: 'daily', completedAt: now.toISOString(), date: todayISO }
    ]));

    const data = ReportEngine.getAggregatedData();
    assert.strictEqual(data.completedTasks.length, 1);
    assert.strictEqual(data.completedTasks[0].title, 'Morning Run');
  });

  it('renders real velocity SVG and markdown without fake values', () => {
    const data = ReportEngine.getAggregatedData();
    const svg = ReportEngine.renderVelocityChartSVG(data);
    assert.ok(svg.includes('<svg'));
    const md = ReportEngine.generateMarkdown();
    assert.ok(md.includes('Digital Wellbeing'));
    assert.ok(md.includes('0.0 Hours'));
  });
});
