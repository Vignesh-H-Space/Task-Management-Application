const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('3-Day Rolling Flight Plan Engine Tests', () => {
  function createFlightPlanContext(initialTasks = [], initialArchive = []) {
    const flightCode = fs.readFileSync(path.resolve(__dirname, '../../js/flight_plan_view.js'), 'utf8');

    const storage = new Map([
      ['tesseract_goals_tasks_data', JSON.stringify(initialTasks)],
      ['tesseract_daily_completions_archive', JSON.stringify(initialArchive)]
    ]);

    const context = {
      window: {},
      state: {
        tasks: initialTasks,
        activeHorizon: 'general',
        viewMode: 'flight_plan',
        searchQuery: '',
        categoryFilter: 'all',
        priorityFilter: 'all'
      },
      document: {
        getElementById: () => null,
        querySelectorAll: () => []
      },
      localStorage: {
        getItem: (k) => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k)
      },
      console: console,
      Date: Date,
      JSON: JSON,
      Math: Math,
      showToast: () => {},
      saveData: () => {},
      renderAll: () => {},
      escapeHTML: (s) => s || ''
    };

    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(flightCode, context);
    return context;
  }

  test('getFlightPlanDates() calculates accurate yesterday, today, and tomorrow dates', () => {
    const ctx = createFlightPlanContext();
    const dates = ctx.window.FlightPlanView.getDates();

    assert.ok(dates.yesterday && dates.yesterday.dateStr);
    assert.ok(dates.today && dates.today.dateStr);
    assert.ok(dates.tomorrow && dates.tomorrow.dateStr);

    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const expectedToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    assert.strictEqual(dates.today.dateStr, expectedToday, 'Today date must match system local date');
    assert.ok(dates.yesterday.dateStr < dates.today.dateStr, 'Yesterday must be before today');
    assert.ok(dates.tomorrow.dateStr > dates.today.dateStr, 'Tomorrow must be after today');
  });

  test('Correctly groups tasks into Yesterday, Today, and Tomorrow', () => {
    const ctx = createFlightPlanContext();
    const dates = ctx.window.FlightPlanView.getDates();

    const tasks = [
      { id: 't_yest_done', title: 'Yesterday Win', tier: 'daily', completed: true, completedAt: `${dates.yesterday.dateStr}T15:00:00Z`, dueDate: dates.yesterday.dateStr },
      { id: 't_yest_slip', title: 'Yesterday Slipped', tier: 'daily', completed: false, completedAt: null, dueDate: dates.yesterday.dateStr },
      { id: 't_today_active', title: 'Today Target', tier: 'daily', completed: false, completedAt: null, dueDate: dates.today.dateStr },
      { id: 't_today_done', title: 'Today Finished', tier: 'daily', completed: true, completedAt: `${dates.today.dateStr}T11:00:00Z`, dueDate: dates.today.dateStr },
      { id: 't_tomm', title: 'Tomorrow Plan', tier: 'daily', completed: false, completedAt: null, dueDate: dates.tomorrow.dateStr }
    ];

    ctx.window.state.tasks = tasks;

    const data = ctx.window.FlightPlanView.getGroupedData(dates);

    assert.strictEqual(data.yesterday.completed.length, 1, 'Should have 1 completed task for yesterday');
    assert.strictEqual(data.yesterday.slipped.length, 1, 'Should have 1 slipped task for yesterday');
    assert.strictEqual(data.today.tasks.length, 2, 'Should have 2 tasks for today');
    assert.strictEqual(data.tomorrow.tasks.length, 1, 'Should have 1 task for tomorrow');
  });

  test('carryOverToToday() moves yesterday task to today and updates due date', () => {
    const ctx = createFlightPlanContext();
    const dates = ctx.window.FlightPlanView.getDates();

    const slippedTask = {
      id: 'task_slip_1',
      title: 'Finish API Spec',
      tier: 'daily',
      completed: false,
      completedAt: null,
      dueDate: dates.yesterday.dateStr
    };

    ctx.window.state.tasks = [slippedTask];

    ctx.window.FlightPlanView.carryOverToToday('task_slip_1');

    assert.strictEqual(slippedTask.dueDate, dates.today.dateStr, 'Due date must be updated to today');
    assert.strictEqual(slippedTask.completed, false);
  });

  test('moveToTomorrow() moves today task to tomorrow', () => {
    const ctx = createFlightPlanContext();
    const dates = ctx.window.FlightPlanView.getDates();

    const todayTask = {
      id: 'task_today_1',
      title: 'Deep Architecture Review',
      tier: 'daily',
      completed: false,
      completedAt: null,
      dueDate: dates.today.dateStr
    };

    ctx.window.state.tasks = [todayTask];

    ctx.window.FlightPlanView.moveToTomorrow('task_today_1');

    assert.strictEqual(todayTask.dueDate, dates.tomorrow.dateStr, 'Due date must be moved to tomorrow');
  });

  test('pullToToday() moves tomorrow task to today', () => {
    const ctx = createFlightPlanContext();
    const dates = ctx.window.FlightPlanView.getDates();

    const tomorrowTask = {
      id: 'task_tomm_1',
      title: 'Prepare Slide Deck',
      tier: 'daily',
      completed: false,
      completedAt: null,
      dueDate: dates.tomorrow.dateStr
    };

    ctx.window.state.tasks = [tomorrowTask];

    ctx.window.FlightPlanView.pullToToday('task_tomm_1');

    assert.strictEqual(tomorrowTask.dueDate, dates.today.dateStr, 'Due date must be pulled into today');
  });
});
