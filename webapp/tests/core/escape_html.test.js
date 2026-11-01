const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

describe('HTML Escaping & XSS Sanitization Tests', () => {
  test('escapes angle brackets and ampersands properly', () => {
    const raw = '<script>alert("xss")</script>';
    const safe = escapeHTML(raw);
    assert.strictEqual(safe, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('escapes single and double quotes to prevent HTML attribute injection', () => {
    const raw = '" onmouseover="alert(\'pwned\')"';
    const safe = escapeHTML(raw);
    assert.strictEqual(safe, '&quot; onmouseover=&quot;alert(&#39;pwned&#39;)&quot;');
  });

  test('handles null, undefined and non-string inputs safely', () => {
    assert.strictEqual(escapeHTML(null), '');
    assert.strictEqual(escapeHTML(undefined), '');
    assert.strictEqual(escapeHTML(42), '42');
    assert.strictEqual(escapeHTML(true), 'true');
  });

  test('preserves normal characters without unnecessary escaping', () => {
    const normal = 'Ship high-throughput orchestrator v2.0!';
    assert.strictEqual(escapeHTML(normal), normal);
  });
});
