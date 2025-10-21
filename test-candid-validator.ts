#!/usr/bin/env tsx
/**
 * Quick prototype: Candid validator using didc CLI
 * Tests the feasibility of our validation architecture
 */

import { exec } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  line?: number;
  column?: number;
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Strip ANSI color codes from terminal output
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Parse didc error output into structured issues
 */
function parseDidcError(stderr: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cleanError = stripAnsi(stderr);

  // Check for unbound type identifier
  const unboundMatch = cleanError.match(/Unbound type identifier (\w+)/);
  if (unboundMatch) {
    issues.push({
      severity: 'error',
      message: `Unknown type '${unboundMatch[1]}'`,
      suggestion: 'Check type name casing (e.g., use "nat64" not "Nat64")',
    });
  }

  // Check for parser errors with line numbers
  const parserMatch = cleanError.match(/┌─.*?:(\d+):(\d+)/);
  if (parserMatch) {
    const line = parseInt(parserMatch[1]);
    const column = parseInt(parserMatch[2]);

    // Extract the actual error message
    const errorMsg = cleanError.match(/Unexpected token|Expected one of|hash collision/)?.[0] || 'Syntax error';

    issues.push({
      severity: 'error',
      line,
      column,
      message: errorMsg,
      suggestion: 'Check Candid syntax documentation',
    });
  }

  // Fallback: generic error if we couldn't parse specifics
  if (issues.length === 0 && cleanError.includes('Error:')) {
    issues.push({
      severity: 'error',
      message: cleanError.split('\n')[0].replace('Error: ', ''),
    });
  }

  return issues;
}

/**
 * Validate Candid code using didc CLI
 */
async function validateCandid(code: string): Promise<ValidationResult> {
  const tempFile = `/tmp/candid-${Date.now()}.did`;

  try {
    // Write code to temp file
    writeFileSync(tempFile, code);

    // Run didc check
    await execAsync(`didc check ${tempFile}`);

    // If we get here, validation passed
    return {
      valid: true,
      issues: [],
    };
  } catch (error: any) {
    // didc returns non-zero exit code on error
    const stderr = error.stderr || error.message;

    return {
      valid: false,
      issues: parseDidcError(stderr),
    };
  } finally {
    // Cleanup temp file
    try {
      unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Test cases
 */
async function runTests() {
  console.log('🧪 Testing Candid Validator\n');

  // Test 1: Valid Candid
  console.log('Test 1: Valid Candid');
  const result1 = await validateCandid(`service : {
  get : () -> (nat) query;
  increment : () -> ();
}`);
  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log('✓ Pass:', result1.valid === true, '\n');

  // Test 2: Invalid syntax
  console.log('Test 2: Invalid syntax');
  const result2 = await validateCandid(`service : { invalid syntax }`);
  console.log('Result:', JSON.stringify(result2, null, 2));
  console.log('✓ Pass:', result2.valid === false && result2.issues.length > 0, '\n');

  // Test 3: Unknown type
  console.log('Test 3: Unknown type');
  const result3 = await validateCandid(`service : {
  get : () -> (UnknownType);
}`);
  console.log('Result:', JSON.stringify(result3, null, 2));
  console.log('✓ Pass:', result3.valid === false && result3.issues[0].message.includes('UnknownType'), '\n');

  // Test 4: Duplicate methods
  console.log('Test 4: Duplicate methods');
  const result4 = await validateCandid(`service : {
  get : () -> (nat) query;
  get : () -> (text) query;
}`);
  console.log('Result:', JSON.stringify(result4, null, 2));
  console.log('✓ Pass:', result4.valid === false, '\n');

  // Test 5: Complex valid Candid
  console.log('Test 5: Complex valid Candid');
  const result5 = await validateCandid(`service : {
  get : () -> (nat64) query;
  getData : () -> (record { id: nat; name: text; active: bool }) query;
  update : (nat, text) -> (variant { Ok: nat; Err: text });
}`);
  console.log('Result:', JSON.stringify(result5, null, 2));
  console.log('✓ Pass:', result5.valid === true, '\n');

  console.log('🎉 All tests completed!');
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { validateCandid, ValidationResult, ValidationIssue };
