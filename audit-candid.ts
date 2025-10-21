#!/usr/bin/env tsx
/**
 * REAL AUDIT: Test if Candid validation actually works
 * This test will fail if anything is fake
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TEST_CASES = [
  {
    name: 'Valid service',
    code: 'service : { greet : (text) -> (text) query }',
    shouldPass: true,
  },
  {
    name: 'Invalid syntax',
    code: 'service : { invalid }',
    shouldPass: false,
  },
  {
    name: 'Complex types',
    code: `
      type User = record {
        id: nat64;
        name: text;
        active: bool;
      };
      service : {
        getUser : (nat64) -> (opt User) query;
        updateUser : (User) -> ();
      }
    `,
    shouldPass: true,
  },
  {
    name: 'Unknown type',
    code: 'service : { get : () -> (NonExistentType) }',
    shouldPass: false,
  },
];

function testDidc(): { passed: number; failed: number; errors: string[] } {
  const results = { passed: 0, failed: 0, errors: [] as string[] };

  console.log('🔍 AUDITING CANDID VALIDATION\n');

  // First, verify didc exists
  try {
    const version = execSync('didc --version', { encoding: 'utf-8' }).trim();
    console.log(`✓ didc found: ${version}\n`);
  } catch (e) {
    console.error('✗ CRITICAL: didc not found in PATH');
    results.errors.push('didc not installed');
    return results;
  }

  // Test each case
  for (const testCase of TEST_CASES) {
    const tempFile = join(tmpdir(), `test-${Date.now()}.did`);
    console.log(`Test: ${testCase.name}`);
    console.log(`Code: ${testCase.code.trim()}`);

    try {
      // Write test file
      writeFileSync(tempFile, testCase.code);

      // Run didc
      let exitCode = 0;
      let stderr = '';

      try {
        execSync(`didc check ${tempFile}`, { encoding: 'utf-8' });
      } catch (e: any) {
        exitCode = e.status || 1;
        stderr = e.stderr || e.message;
      }

      const passed = testCase.shouldPass ? exitCode === 0 : exitCode !== 0;

      if (passed) {
        console.log(`✓ PASS (expected ${testCase.shouldPass ? 'valid' : 'invalid'}, got exit code ${exitCode})`);
        results.passed++;
      } else {
        console.log(`✗ FAIL (expected ${testCase.shouldPass ? 'valid' : 'invalid'}, got exit code ${exitCode})`);
        if (stderr) console.log(`  Error: ${stderr.substring(0, 100)}`);
        results.failed++;
        results.errors.push(`${testCase.name}: unexpected result`);
      }

      // Cleanup
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    } catch (e: any) {
      console.log(`✗ ERROR: ${e.message}`);
      results.failed++;
      results.errors.push(`${testCase.name}: ${e.message}`);
    }

    console.log('');
  }

  return results;
}

// Run audit
const results = testDidc();

console.log('═'.repeat(50));
console.log('CANDID VALIDATION AUDIT RESULTS:');
console.log(`  Passed: ${results.passed}/${TEST_CASES.length}`);
console.log(`  Failed: ${results.failed}/${TEST_CASES.length}`);

if (results.errors.length > 0) {
  console.log('\nErrors:');
  results.errors.forEach(err => console.log(`  - ${err}`));
}

console.log('\nVERDICT:', results.failed === 0 ? '✅ WORKING' : '❌ NOT WORKING');

process.exit(results.failed === 0 ? 0 : 1);