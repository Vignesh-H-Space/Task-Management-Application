const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createMatrixContext() {
  const code = fs.readFileSync(path.resolve(__dirname, '../../js/matrix_view.js'), 'utf8');
  const context = {
    state: { tasks: [] },
    TIERS: [
      { id: 'daily', name: 'Daily' },
      { id: 'weekly', name: 'Weekly' },
      { id: 'monthly', name: 'Monthly' },
      { id: 'quarterly', name: 'Quarterly' },
      { id: 'annual', name: 'Annual' }
    ],
    document: {
      getElementById() { return null; }
    },
    window: {}
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

describe('Eisenhower Matrix Tests', () => {
  test('classifyTaskQuadrant() assigns Urgent + Important to Q1 (DO FIRST)', () => {
    const ctx = createMatrixContext();
    const task = {
      title: 'Fix production outage',
      priority: 'urgent',
      tier: 'daily'
    };
    assert.strictEqual(ctx.classifyTaskQuadrant(task), 'q1');
  });

  test('classifyTaskQuadrant() assigns Not Urgent + Important to Q2 (SCHEDULE)', () => {
    const ctx = createMatrixContext();
    const task = {
      title: 'Q3 Architectural Roadmap',
      priority: 'high',
      tier: 'quarterly',
      dueDate: '2026-12-31'
    };
    assert.strictEqual(ctx.classifyTaskQuadrant(task), 'q2');
  });

  test('classifyTaskQuadrant() assigns Urgent + Not Important to Q3 (DELEGATE)', () => {
    const ctx = createMatrixContext();
    const task = {
      title: 'Order office printer supplies',
      priority: 'low',
      tier: 'daily' // daily makes it urgent, but priority is low and not quarterly/annual
    };
    assert.strictEqual(ctx.classifyTaskQuadrant(task), 'q3');
  });

  test('classifyTaskQuadrant() assigns Not Urgent + Not Important to Q4 (ELIMINATE)', () => {
    const ctx = createMatrixContext();
    const task = {
      title: 'Browse random gadget reviews',
      priority: 'low',
      tier: 'monthly',
      dueDate: '2027-01-01'
    };
    assert.strictEqual(ctx.classifyTaskQuadrant(task), 'q4');
  });

  test('classifyTaskQuadrant() auto-escalates tasks with due date within 3 days to urgent', () => {
    const ctx = createMatrixContext();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const task = {
      title: 'Annual Tax Filing',
      priority: 'high', // Important
      tier: 'annual',   // Normally not daily tier
      dueDate: tomorrow // Due tomorrow -> should become Urgent
    };
    assert.strictEqual(ctx.classifyTaskQuadrant(task), 'q1');
  });
});
