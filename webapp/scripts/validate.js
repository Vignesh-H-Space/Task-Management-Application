#!/usr/bin/env node

/**
 * Tesseract Complete System Validation
 * Runs both quality linter gate and automated unit test suite.
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('\n🚀 Starting Full Tesseract Validation Pipeline');
console.log('═'.repeat(60));

try {
  // 1. Run Linter
  execSync('node scripts/lint.js', { cwd: ROOT_DIR, stdio: 'inherit' });

  // 2. Run Test Suite
  console.log('\n🧪 Executing Automated Regression Test Suite...');
  console.log('═'.repeat(60));
  execSync('node --test tests/**/*.test.js', { cwd: ROOT_DIR, stdio: 'inherit' });

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 ALL QUALITY GATES PASSED! SYSTEM PRODUCTION READY.');
  console.log('═'.repeat(60) + '\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Pipeline check failed.');
  process.exit(1);
}
