const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock browser environment for PulseEngine
global.window = {};
global.document = {
  getElementById: (id) => null,
  querySelectorAll: (selector) => [],
  addEventListener: () => {}
};
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const { PulseEngine, PULSE_CATEGORIES } = require('../../js/pulse_engine.js');

describe('Pulse Engine & Topic Categories Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    PulseEngine.entries = [];
    PulseEngine.activeFilter = 'all';
    PulseEngine.searchQuery = '';
    PulseEngine.selectedCategory = 'career';
    PulseEngine.selectedSubcategory = 'win';
    PulseEngine.selectedDate = null;
    PulseEngine.editingId = null;
  });

  it('PULSE_CATEGORIES defines humiliation and scolding in Career & Work', () => {
    assert.ok(PULSE_CATEGORIES.career, 'Career category exists');
    assert.ok(PULSE_CATEGORIES.career.subcategories.humiliation, 'Humiliation subcategory exists in Career');
    assert.strictEqual(PULSE_CATEGORIES.career.subcategories.humiliation.label, 'Humiliation');
    assert.strictEqual(PULSE_CATEGORIES.career.subcategories.humiliation.icon, 'shield-alert');

    assert.ok(PULSE_CATEGORIES.career.subcategories.scolding, 'Scolding subcategory exists in Career');
    assert.strictEqual(PULSE_CATEGORIES.career.subcategories.scolding.label, 'Scoldings');
    assert.strictEqual(PULSE_CATEGORIES.career.subcategories.scolding.icon, 'megaphone');
  });

  it('PULSE_CATEGORIES defines humiliation and scolding in Personal & Life', () => {
    assert.ok(PULSE_CATEGORIES.personal, 'Personal category exists');
    assert.ok(PULSE_CATEGORIES.personal.subcategories.humiliation, 'Humiliation subcategory exists in Personal');
    assert.strictEqual(PULSE_CATEGORIES.personal.subcategories.humiliation.label, 'Humiliation');

    assert.ok(PULSE_CATEGORIES.personal.subcategories.scolding, 'Scolding subcategory exists in Personal');
    assert.strictEqual(PULSE_CATEGORIES.personal.subcategories.scolding.label, 'Scoldings');
  });

  it('Correctly switches capture subcategory to humiliation and scolding', () => {
    PulseEngine.setCaptureCategory('career');
    PulseEngine.setCaptureSubcategory('humiliation');
    assert.strictEqual(PulseEngine.selectedSubcategory, 'humiliation');

    PulseEngine.setCaptureSubcategory('scolding');
    assert.strictEqual(PulseEngine.selectedSubcategory, 'scolding');

    PulseEngine.setCaptureCategory('personal');
    PulseEngine.setCaptureSubcategory('humiliation');
    assert.strictEqual(PulseEngine.selectedSubcategory, 'humiliation');
  });

  it('Filters pulses by subcategory (humiliation & scolding)', () => {
    PulseEngine.entries = [
      { id: 'p1', text: 'Public callout during standup', category: 'career', subcategory: 'humiliation', createdAt: Date.now() },
      { id: 'p2', text: 'Manager yelled about deadline', category: 'career', subcategory: 'scolding', createdAt: Date.now() - 1000 },
      { id: 'p3', text: 'Won the pitch', category: 'career', subcategory: 'win', createdAt: Date.now() - 2000 },
      { id: 'p4', text: 'Scolded by dad on phone call', category: 'personal', subcategory: 'scolding', createdAt: Date.now() - 3000 }
    ];

    // Filter by humiliation
    PulseEngine.activeFilter = 'humiliation';
    let filtered = [...PulseEngine.entries];
    if (PulseEngine.activeFilter && PulseEngine.activeFilter !== 'all') {
      filtered = filtered.filter(p => p.subcategory === PulseEngine.activeFilter);
    }
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, 'p1');

    // Filter by scolding
    PulseEngine.activeFilter = 'scolding';
    filtered = [...PulseEngine.entries];
    if (PulseEngine.activeFilter && PulseEngine.activeFilter !== 'all') {
      filtered = filtered.filter(p => p.subcategory === PulseEngine.activeFilter);
    }
    assert.strictEqual(filtered.length, 2);
    assert.ok(filtered.some(p => p.id === 'p2'));
    assert.ok(filtered.some(p => p.id === 'p4'));
  });

  it('Matches humiliation and scolding in search query', () => {
    PulseEngine.entries = [
      { id: 'p1', text: 'Harsh meeting review', category: 'career', subcategory: 'humiliation' },
      { id: 'p2', text: 'Missed chore warning', category: 'personal', subcategory: 'scolding' }
    ];

    // Search "humiliation"
    let query = 'humiliation';
    let matched = PulseEngine.entries.filter(p => {
      const textMatch = p.text.toLowerCase().includes(query);
      const catMatch = (p.category || '').toLowerCase().includes(query);
      const subMatch = (p.subcategory || '').toLowerCase().includes(query);
      return textMatch || catMatch || subMatch;
    });
    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0].id, 'p1');

    // Search "scolding"
    query = 'scolding';
    matched = PulseEngine.entries.filter(p => {
      const textMatch = p.text.toLowerCase().includes(query);
      const catMatch = (p.category || '').toLowerCase().includes(query);
      const subMatch = (p.subcategory || '').toLowerCase().includes(query);
      return textMatch || catMatch || subMatch;
    });
    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0].id, 'p2');
  });
});
