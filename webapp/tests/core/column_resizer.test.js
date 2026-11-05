const { describe, it } = require('node:test');
const assert = require('node:assert');

// Mock browser globals for testing
function createMockDOM() {
  const storage = {};
  const mockLocalStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
  };

  const listeners = {};

  const createMockElement = (tagName, className = '') => {
    const el = {
      tagName: tagName.toUpperCase(),
      className,
      style: {},
      attributes: {},
      children: [],
      classList: {
        add: (c) => { el.className = (el.className + ' ' + c).trim(); },
        remove: (c) => { el.className = el.className.replace(c, '').trim(); },
        contains: (c) => el.className.split(/\s+/).includes(c)
      },
      setAttribute: (k, v) => { el.attributes[k] = v; },
      getAttribute: (k) => el.attributes[k] || null,
      appendChild: (child) => {
        el.children.push(child);
        child.parentElement = el;
        return child;
      },
      querySelector: (sel) => {
        if (sel === 'thead') {
          return el.children.find(c => c.tagName === 'THEAD') || null;
        }
        if (sel === '.col-resizer-handle') {
          return el.children.find(c => c.className && c.className.includes('col-resizer-handle')) || null;
        }
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel === 'th' || sel === 'thead th') {
          const result = [];
          const collect = (node) => {
            if (node.tagName === 'TH') result.push(node);
            if (node.children) node.children.forEach(collect);
          };
          collect(el);
          return result;
        }
        return [];
      },
      addEventListener: (evt, fn) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      dispatchEvent: (evt) => {
        if (listeners[evt.type]) {
          listeners[evt.type].forEach(fn => fn(evt));
        }
      },
      getBoundingClientRect: () => ({ width: el.offsetWidth || 120, height: 40 }),
      offsetWidth: 120
    };
    return el;
  };

  return { mockLocalStorage, createMockElement, listeners };
}

describe('ColumnResizer Module Tests', () => {
  it('loads ColumnResizer cleanly in Node.js environment', () => {
    const ColumnResizer = require('../../js/column_resizer.js');
    assert.strictEqual(typeof ColumnResizer, 'object');
    assert.strictEqual(typeof ColumnResizer.attach, 'function');
    assert.strictEqual(typeof ColumnResizer.saveColumnWidth, 'function');
    assert.strictEqual(typeof ColumnResizer.getSavedWidths, 'function');
    assert.strictEqual(typeof ColumnResizer.reset, 'function');
  });

  it('persists and retrieves column widths via localStorage correctly', () => {
    const ColumnResizer = require('../../js/column_resizer.js');
    const { mockLocalStorage } = createMockDOM();
    global.localStorage = mockLocalStorage;

    const storageKey = 'test_col_widths';
    ColumnResizer.saveColumnWidth(storageKey, 'col-objective', 320);
    ColumnResizer.saveColumnWidth(storageKey, 'col-group', 160);

    const retrieved = ColumnResizer.getSavedWidths(storageKey);
    assert.strictEqual(retrieved['col-objective'], 320);
    assert.strictEqual(retrieved['col-group'], 160);

    ColumnResizer.reset(storageKey);
    const cleared = ColumnResizer.getSavedWidths(storageKey);
    assert.deepStrictEqual(cleared, {});
  });

  it('attaches .col-resizer-handle elements to all table headers and applies saved widths', () => {
    const ColumnResizer = require('../../js/column_resizer.js');
    const { mockLocalStorage, createMockElement } = createMockDOM();
    global.localStorage = mockLocalStorage;

    // Seed saved widths
    mockLocalStorage.setItem('test_table_widths', JSON.stringify({
      'th-event': 280,
      'th-status': 140
    }));

    // Mock table DOM
    const table = createMockElement('TABLE');
    const thead = createMockElement('THEAD');
    const tr = createMockElement('TR');

    const th1 = createMockElement('TH', 'th-event');
    th1.setAttribute('data-col-key', 'th-event');

    const th2 = createMockElement('TH', 'th-status');
    th2.setAttribute('data-col-key', 'th-status');

    tr.appendChild(th1);
    tr.appendChild(th2);
    thead.appendChild(tr);
    table.appendChild(thead);

    global.document = {
      createElement: (tag) => createMockElement(tag),
      body: createMockElement('BODY'),
      querySelector: () => table
    };

    ColumnResizer.attach(table, 'test_table_widths');

    // Both th headers should have resizer handles attached
    const handle1 = th1.querySelector('.col-resizer-handle');
    const handle2 = th2.querySelector('.col-resizer-handle');

    assert.ok(handle1, 'Column 1 must have a .col-resizer-handle attached');
    assert.ok(handle2, 'Column 2 must have a .col-resizer-handle attached');

    // Headers should have received saved widths
    assert.strictEqual(th1.style.width, '280px');
    assert.strictEqual(th2.style.width, '140px');
  });
});
