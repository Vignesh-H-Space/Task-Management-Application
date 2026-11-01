const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Task Card Element Creation Tests', () => {
  test('createTaskCardElement is declared and creates valid DOM card with elements', () => {
    const appCode = fs.readFileSync(path.resolve(__dirname, '../../js/app.js'), 'utf8');

    // Create a mock DOM context
    function createMockElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        className: '',
        attributes: {},
        innerHTML: '',
        children: [],
        style: {},
        setAttribute(k, v) { this.attributes[k] = String(v); },
        getAttribute(k) { return this.attributes[k] || null; },
        querySelector(selector) {
          return createMockElement('div');
        },
        querySelectorAll(selector) {
          return [];
        },
        addEventListener() {}
      };
    }

    const context = {
      state: { tasks: [] },
      TIERS: [
        { id: 'daily', name: 'Daily Tasks', emoji: '🌅' },
        { id: 'weekly', name: 'Weekly Milestones', emoji: '📅' },
        { id: 'monthly', name: 'Monthly Goals', emoji: '🗓️' },
        { id: 'quarterly', name: 'Quarterly Goals', emoji: '🎯' },
        { id: 'annual', name: 'Annual Goals', emoji: '🏆' }
      ],
      escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
      },
      document: {
        readyState: 'loading',
        documentElement: createMockElement('html'),
        createElement: createMockElement,
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {}
      },
      window: {},
      localStorage: { getItem() { return null; }, setItem() {} }
    };

    vm.createContext(context);
    vm.runInContext(appCode, context);

    const fn = context.window.createTaskCardElement || context.createTaskCardElement;
    assert.strictEqual(typeof fn, 'function', 'createTaskCardElement must be a function exported to window');

    const sampleTask = {
      id: 'task_test_1',
      title: 'Review System Metrics',
      description: 'Check uptime and error rates',
      tier: 'daily',
      completed: false,
      priority: 'high',
      category: 'Engineering',
      tags: ['ops', 'monitoring'],
      subtasks: [
        { id: 'st_1', title: 'Verify firestore latency', completed: false }
      ]
    };

    const card = fn(sampleTask);
    assert.ok(card, 'Should return a card element');
    assert.strictEqual(card.getAttribute('data-id'), 'task_test_1');
    assert.strictEqual(card.getAttribute('data-tier'), 'daily');
    assert.ok(card.innerHTML.includes('Review System Metrics'), 'Card should contain task title');
    assert.ok(card.innerHTML.includes('Engineering'), 'Card should contain task category');
  });
});
