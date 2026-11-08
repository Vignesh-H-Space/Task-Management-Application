const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage
let storage = {};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { storage = {}; }
};

const { HabitsEngine, INITIAL_HABITS, HABITS_STORAGE_KEY } = require('../../js/habits_engine.js');

describe('Habits & Cadence Engine Tests', () => {
  beforeEach(() => {
    storage = {};
    HabitsEngine.habits = [];
  });

  it('INITIAL_HABITS defines Chess Game and LinkedIn Game by default', () => {
    const titles = INITIAL_HABITS.map(h => h.title);
    assert.ok(titles.includes('Chess Game'), 'INITIAL_HABITS must contain Chess Game');
    assert.ok(titles.includes('LinkedIn Game'), 'INITIAL_HABITS must contain LinkedIn Game');

    const chess = INITIAL_HABITS.find(h => h.title === 'Chess Game');
    assert.strictEqual(chess.icon, '♟️');
    assert.strictEqual(chess.category, 'Mind');

    const linkedin = INITIAL_HABITS.find(h => h.title === 'LinkedIn Game');
    assert.strictEqual(linkedin.icon, '💼');
    assert.strictEqual(linkedin.category, 'Career');
  });

  it('ensureDefaultHabits() auto-appends Chess Game and LinkedIn Game if missing from existing habits', () => {
    // Simulate user who already has some existing habits in localStorage
    const existingHabits = [
      { id: 'h_custom_1', title: 'Meditation', icon: '🧘', category: 'Personal', history: {} }
    ];
    global.localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(existingHabits));

    HabitsEngine.load();

    const titles = HabitsEngine.habits.map(h => h.title);
    assert.ok(titles.includes('Meditation'), 'Existing habits must be preserved');
    assert.ok(titles.includes('Chess Game'), 'Chess Game must be automatically appended');
    assert.ok(titles.includes('LinkedIn Game'), 'LinkedIn Game must be automatically appended');

    // Verify persisted to storage
    const saved = JSON.parse(global.localStorage.getItem(HABITS_STORAGE_KEY));
    const savedTitles = saved.map(h => h.title);
    assert.ok(savedTitles.includes('Chess Game'));
    assert.ok(savedTitles.includes('LinkedIn Game'));
  });

  it('ensureDefaultHabits() does not duplicate Chess Game or LinkedIn Game if already present', () => {
    const existingHabits = [
      { id: 'h_chess', title: 'Chess Game', icon: '♟️', category: 'Mind', history: {} },
      { id: 'h_linkedin', title: 'LinkedIn Game', icon: '💼', category: 'Career', history: {} }
    ];
    global.localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(existingHabits));

    HabitsEngine.load();

    const chessCount = HabitsEngine.habits.filter(h => h.title === 'Chess Game').length;
    const linkedinCount = HabitsEngine.habits.filter(h => h.title === 'LinkedIn Game').length;

    assert.strictEqual(chessCount, 1, 'Chess Game must not be duplicated');
    assert.strictEqual(linkedinCount, 1, 'LinkedIn Game must not be duplicated');
  });
});

