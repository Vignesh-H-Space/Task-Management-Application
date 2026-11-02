const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Daily Task Rollover & Midnight Refresh Tests', () => {
  function createAppEnvironment(initialTasks = []) {
    const appCode = fs.readFileSync(path.resolve(__dirname, '../../js/app.js'), 'utf8');

    const storage = new Map([
      ['tesseract_goals_tasks_data', JSON.stringify(initialTasks)]
    ]);

    const context = {
      window: {},
      lucide: { createIcons: () => {} },
      loadStreak: () => {},
      renderStreakUI: () => {},
      document: {
        readyState: 'loading',
        addEventListener: () => {},
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        documentElement: {
          setAttribute: () => {},
          removeAttribute: () => {}
        }
      },
      localStorage: {
        getItem: (k) => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k)
      },
      console: console,
      setTimeout: (fn) => setTimeout(fn, 0),
      setInterval: () => 1,
      Date: Date,
      JSON: JSON,
      Math: Math,
      showToast: () => {},
      updateAppBadge: () => {}
    };

    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(appCode, context);
    return context;
  }

  test('Daily tasks completed on a prior day automatically reset to uncompleted', () => {
    const priorCompletedDailyTask = {
      id: 'day_test_01',
      title: '5km Morning Run',
      tier: 'daily',
      completed: true,
      completedAt: '2026-11-01T07:30:00.000Z',
      dueDate: '2026-11-01',
      subtasks: [
        { id: 'st_1', title: 'Warmup stretches', completed: true },
        { id: 'st_2', title: '5km jog', completed: true }
      ]
    };

    const ctx = createAppEnvironment([priorCompletedDailyTask]);
    ctx.window.state.tasks = [priorCompletedDailyTask];

    const refreshed = ctx.window.checkDailyTasksRollover(false);
    assert.strictEqual(refreshed, 1, 'Exactly 1 daily task should be refreshed');

    const task = ctx.window.state.tasks[0];
    assert.strictEqual(task.completed, false, 'Daily task must be reset to uncompleted');
    assert.strictEqual(task.completedAt, null, 'completedAt must be cleared to null');
    assert.ok(task.dueDate, 'dueDate should be set');
    assert.strictEqual(task.subtasks[0].completed, false, 'Subtask 1 must be reset');
    assert.strictEqual(task.subtasks[1].completed, false, 'Subtask 2 must be reset');
  });

  test('Daily tasks completed TODAY do NOT reset during regular rollover', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCompletedDailyTask = {
      id: 'day_test_02',
      title: 'Review System Metrics',
      tier: 'daily',
      completed: true,
      completedAt: `${todayStr}T10:00:00.000Z`,
      dueDate: todayStr,
      subtasks: []
    };

    const ctx = createAppEnvironment([todayCompletedDailyTask]);
    ctx.window.state.tasks = [todayCompletedDailyTask];

    const refreshed = ctx.window.checkDailyTasksRollover(false);
    assert.strictEqual(refreshed, 0, 'Today task should NOT be refreshed on same day');

    const task = ctx.window.state.tasks[0];
    assert.strictEqual(task.completed, true, 'Today completed task should remain completed');
  });

  test('Non-daily tasks (weekly, monthly, annual) do NOT reset on daily rollover', () => {
    const pastWeeklyTask = {
      id: 'wek_test_01',
      title: 'Deliver Sprint Demo',
      tier: 'weekly',
      completed: true,
      completedAt: '2026-10-25T14:00:00.000Z',
      dueDate: '2026-10-30',
      subtasks: []
    };

    const ctx = createAppEnvironment([pastWeeklyTask]);
    ctx.window.state.tasks = [pastWeeklyTask];

    const refreshed = ctx.window.checkDailyTasksRollover(false);
    assert.strictEqual(refreshed, 0, 'Weekly task should NOT be refreshed by daily rollover');

    const task = ctx.window.state.tasks[0];
    assert.strictEqual(task.completed, true, 'Weekly task must stay completed');
  });

  test('Manual forced refresh resets daily tasks regardless of completion time', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTask = {
      id: 'day_test_03',
      title: 'Read 20 Pages',
      tier: 'daily',
      completed: true,
      completedAt: `${todayStr}T09:00:00.000Z`,
      dueDate: todayStr,
      subtasks: []
    };

    const ctx = createAppEnvironment([todayTask]);
    ctx.window.state.tasks = [todayTask];

    const refreshed = ctx.window.checkDailyTasksRollover(true);
    assert.strictEqual(refreshed, 1, 'Forced refresh should reset daily task');

    const task = ctx.window.state.tasks[0];
    assert.strictEqual(task.completed, false, 'Daily task must be reset when force=true');
  });
});
