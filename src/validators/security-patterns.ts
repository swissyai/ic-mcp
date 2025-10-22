/**
 * Security pattern detection for Motoko and Rust
 * Identifies common security vulnerabilities in ICP canisters
 */

import type { ValidationIssue } from '../types/index.js';

/**
 * Security check for Motoko code
 */
export function checkMotokoSecurity(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check 1: Missing caller verification in update methods
  if (hasUpdateMethods(code) && !hasCallerChecks(code)) {
    issues.push({
      severity: 'warning',
      message: 'Update methods without caller verification detected',
      suggestion: 'Add caller checks: let caller = msg.caller; assert(caller == owner);',
      docUrl: 'https://internetcomputer.org/docs/current/motoko/main/caller-id',
    });
  }

  // Check 2: Unbounded data structures
  const unboundedStructures = findUnboundedStructures(code);
  for (const structure of unboundedStructures) {
    issues.push({
      severity: 'warning',
      message: `Unbounded ${structure.type} '${structure.name}' may cause heap overflow`,
      line: structure.line,
      suggestion: `Use stable storage with size limits or pagination`,
      docUrl: 'https://internetcomputer.org/docs/current/motoko/main/stablememory',
    });
  }

  // Check 3: Arithmetic operations without overflow checks
  if (hasArithmeticOperations(code) && !hasOverflowChecks(code)) {
    issues.push({
      severity: 'info',
      message: 'Arithmetic operations without overflow protection',
      suggestion: 'Consider using checked arithmetic or explicit overflow handling',
    });
  }

  // Check 4: Unsafe trap conditions
  const trapPatterns = findUnsafeTraps(code);
  for (const trap of trapPatterns) {
    issues.push({
      severity: 'warning',
      message: `Unsafe trap at line ${trap.line}: ${trap.reason}`,
      line: trap.line,
      suggestion: 'Return Result type or handle error gracefully',
    });
  }

  // Check 5: Missing upgrade hooks with stable vars
  if (hasStableVars(code) && !hasUpgradeHooks(code)) {
    issues.push({
      severity: 'warning',
      message: 'Stable variables without upgrade hooks',
      suggestion: 'Add system func preupgrade() and postupgrade() for data migration',
      docUrl: 'https://internetcomputer.org/docs/current/motoko/main/upgrades',
    });
  }

  return issues;
}

/**
 * Security check for Rust code
 */
export function checkRustSecurity(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check 1: Unwrap/expect in canister methods
  const unsafeUnwraps = findUnsafeUnwraps(code);
  for (const unwrap of unsafeUnwraps) {
    issues.push({
      severity: 'warning',
      message: `Unsafe ${unwrap.method} at line ${unwrap.line} may cause trap`,
      line: unwrap.line,
      suggestion: 'Use ? operator or match for proper error handling',
    });
  }

  // Check 2: Missing caller verification
  if (hasUpdateMethods(code) && !code.includes('ic_cdk::caller()')) {
    issues.push({
      severity: 'warning',
      message: 'Update methods without caller verification',
      suggestion: 'Add: let caller = ic_cdk::caller(); assert_eq!(caller, owner);',
    });
  }

  // Check 3: Reentrancy risks in inter-canister calls
  const reentrancyRisks = findReentrancyRisks(code);
  for (const risk of reentrancyRisks) {
    issues.push({
      severity: 'warning',
      message: `Potential reentrancy at line ${risk.line}`,
      line: risk.line,
      suggestion: 'Use checks-effects-interactions pattern: verify state before await',
    });
  }

  // Check 4: Unbounded memory allocations
  if (code.includes('Vec::new()') && !code.includes('with_capacity')) {
    issues.push({
      severity: 'info',
      message: 'Consider using Vec::with_capacity for known sizes',
      suggestion: 'Reduces memory allocations and improves performance',
    });
  }

  return issues;
}

// === Helper functions ===

function hasUpdateMethods(code: string): boolean {
  return (
    code.includes('public func') ||
    code.includes('#[update]') ||
    code.includes('public shared')
  );
}

function hasCallerChecks(code: string): boolean {
  return (
    code.includes('msg.caller') ||
    code.includes('ic_cdk::caller()') ||
    code.includes('caller()')
  );
}

function findUnboundedStructures(code: string): Array<{ type: string; name: string; line?: number }> {
  const structures: Array<{ type: string; name: string; line?: number }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // HashMap/TrieMap without size limit
    if (line.match(/(var|let)\s+(\w+)\s*=\s*(HashMap|TrieMap)\.new/)) {
      const nameMatch = line.match(/(var|let)\s+(\w+)/);
      if (nameMatch) {
        structures.push({
          type: line.includes('HashMap') ? 'HashMap' : 'TrieMap',
          name: nameMatch[2],
          line: i + 1,
        });
      }
    }

    // Buffer/Array without limit
    if (line.match(/(var|let)\s+(\w+)\s*=\s*Buffer\.Buffer/)) {
      const nameMatch = line.match(/(var|let)\s+(\w+)/);
      if (nameMatch) {
        structures.push({ type: 'Buffer', name: nameMatch[2], line: i + 1 });
      }
    }
  }

  return structures;
}

function hasArithmeticOperations(code: string): boolean {
  return /[\+\-\*\/]/.test(code) && (code.includes(': Nat') || code.includes(': Int'));
}

function hasOverflowChecks(code: string): boolean {
  return code.includes('Nat.add') || code.includes('Int.add') || code.includes('checked_');
}

function findUnsafeTraps(code: string): Array<{ line: number; reason: string }> {
  const traps: Array<{ line: number; reason: string }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Direct assert without message
    if (line.match(/assert\s*\(/)) {
      traps.push({ line: i + 1, reason: 'Assert without error message' });
    }

    // Array indexing without bounds check
    if (line.match(/\[\s*\d+\s*\]/) && !line.includes('get(')) {
      traps.push({ line: i + 1, reason: 'Direct array indexing (use .get())' });
    }
  }

  return traps;
}

function hasStableVars(code: string): boolean {
  return code.includes('stable var') || code.includes('stable let');
}

function hasUpgradeHooks(code: string): boolean {
  return code.includes('system func preupgrade') || code.includes('system func postupgrade');
}

function findUnsafeUnwraps(code: string): Array<{ method: string; line: number }> {
  const unwraps: Array<{ method: string; line: number }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('.unwrap()')) {
      unwraps.push({ method: 'unwrap', line: i + 1 });
    }

    if (line.includes('.expect(')) {
      unwraps.push({ method: 'expect', line: i + 1 });
    }
  }

  return unwraps;
}

function findReentrancyRisks(code: string): Array<{ line: number }> {
  const risks: Array<{ line: number }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // State modification after await
    if (i > 0 && lines[i - 1].includes('.await') && line.match(/(\.insert|\.remove|=)/)) {
      risks.push({ line: i + 1 });
    }
  }

  return risks;
}
