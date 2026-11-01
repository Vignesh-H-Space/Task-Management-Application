const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('TesseractDialog Interface & Contract Tests', () => {
  test('dialog_engine.js exports alert, confirm, and prompt as async methods', () => {
    const code = fs.readFileSync(path.resolve(__dirname, '../../js/dialog_engine.js'), 'utf8');
    const context = {
      window: {},
      document: {
        getElementById() { return null; },
        head: { appendChild() {} },
        createElement() {
          return {
            setAttribute() {},
            style: {},
            classList: { add() {}, remove() {} },
            addEventListener() {}
          };
        }
      }
    };
    vm.createContext(context);
    vm.runInContext(code, context);

    const dialog = context.window.TesseractDialog;
    assert.ok(dialog, 'TesseractDialog must be attached to window');
    assert.strictEqual(typeof dialog.alert, 'function', 'alert must be a function');
    assert.strictEqual(typeof dialog.confirm, 'function', 'confirm must be a function');
    assert.strictEqual(typeof dialog.prompt, 'function', 'prompt must be a function');
  });
});
