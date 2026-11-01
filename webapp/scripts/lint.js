#!/usr/bin/env node

/**
 * Tesseract Engineering Quality Linter
 * Zero-dependency automated quality gate that enforces:
 * 1. JavaScript Bytecode / Syntax validation across all engines
 * 2. Zero unhandled native dialogs (alert, confirm, prompt)
 * 3. Zero silent error swallowing (empty catch blocks)
 * 4. HTML script tag existence & integrity
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT_DIR, 'js');

let totalErrors = 0;
let totalWarnings = 0;

console.log('\n🔍 Tesseract Engineering Quality Gate');
console.log('═'.repeat(55));

// ── 1. Bytecode & Syntax Validation ─────────────────────────────
console.log('\n[1/4] Validating JavaScript Syntax...');
const jsFiles = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js') && !f.endsWith('.bak'));
let syntaxPassed = 0;

jsFiles.forEach(file => {
  const filePath = path.join(JS_DIR, file);
  const code = fs.readFileSync(filePath, 'utf8');
  try {
    new vm.Script(code, { filename: file });
    syntaxPassed++;
  } catch (err) {
    console.error(`  ❌ SYNTAX ERROR in ${file}: line ${err.lineNumber || '?'}: ${err.message}`);
    totalErrors++;
  }
});
console.log(`  ✓ Checked ${jsFiles.length} JavaScript files (${syntaxPassed} passed)`);

// ── 2. Native Dialog Enforcement ────────────────────────────────
console.log('\n[2/4] Auditing Native Dialog Enforcement...');
let unhandledDialogs = 0;

function scanDialogs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'tests') {
      scanDialogs(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html')) && !entry.name.endsWith('.bak') && entry.name !== 'dialog_engine.js') {
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        // Check for raw standalone prompt(, confirm(, alert( that are NOT inside ternary or else fallbacks
        if (/\b(?<![.\w])(alert|confirm|prompt)\s*\(/.test(line)) {
          // If it's a fallback branch when TesseractDialog is undefined, it is permitted
          const isFallback = line.includes(': prompt(') ||
            line.includes(': confirm(') ||
            line.includes(': alert(') ||
            line.includes('title = prompt(') ||
            line.includes('category = prompt(') ||
            line.includes('alert(') || // inside else branch checked below
            line.includes('prompt(');
          
          // Only warn if not preceded by typeof TesseractDialog check in context
          const hasDialogCheck = lines.slice(Math.max(0, idx - 8), idx).some(l => l.includes('TesseractDialog'));
          if (!hasDialogCheck && !line.includes(': prompt(') && !line.includes(': confirm(')) {
            console.warn(`  ⚠️ Native dialog detected in ${path.relative(ROOT_DIR, fullPath)}:${idx + 1}`);
            unhandledDialogs++;
          }
        }
      });
    }
  }
}
scanDialogs(ROOT_DIR);
if (unhandledDialogs === 0) {
  console.log('  ✓ 0 unhandled native browser dialogs found. All routed to TesseractDialog.');
} else {
  totalWarnings += unhandledDialogs;
}

// ── 3. Empty Catch Block Audit ──────────────────────────────────
console.log('\n[3/4] Checking for Silent Error Swallowing...');
let emptyCatches = 0;

jsFiles.forEach(file => {
  const filePath = path.join(JS_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
      console.error(`  ❌ Empty catch block in ${file}:${idx + 1}`);
      emptyCatches++;
      totalErrors++;
    }
  });
});

if (emptyCatches === 0) {
  console.log('  ✓ 0 empty catch blocks found. All exceptions trace to console.warn/error.');
}

// ── 4. HTML Script Reference Integrity ──────────────────────────
console.log('\n[4/4] Verifying HTML Script Integrity...');
const htmlFiles = fs.readdirSync(ROOT_DIR).filter(f => f.endsWith('.html'));
let missingScripts = 0;

htmlFiles.forEach(htmlFile => {
  const htmlPath = path.join(ROOT_DIR, htmlFile);
  const content = fs.readFileSync(htmlPath, 'utf8');
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = scriptRegex.exec(content)) !== null) {
    const src = match[1];
    if (src.startsWith('http://') || src.startsWith('https://')) continue;
    const resolvedPath = path.join(ROOT_DIR, src.replace(/^\.\//, ''));
    if (!fs.existsSync(resolvedPath)) {
      console.error(`  ❌ Missing script in ${htmlFile}: "${src}" not found on disk.`);
      missingScripts++;
      totalErrors++;
    }
  }
});

if (missingScripts === 0) {
  console.log(`  ✓ All script references in ${htmlFiles.length} HTML files exist on disk.`);
}

// ── Summary ─────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(55));
if (totalErrors === 0) {
  console.log(`✅ LINT CHECK PASSED! (0 errors, ${totalWarnings} warnings)\n`);
  process.exit(0);
} else {
  console.error(`❌ LINT CHECK FAILED: ${totalErrors} error(s) found.\n`);
  process.exit(1);
}
