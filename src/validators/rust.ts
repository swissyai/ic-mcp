/**
 * Rust validation for ic-cdk canisters
 * Pattern-based checking for common issues and best practices
 */

import type { ValidationIssue, ValidationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { validationCache } from '../utils/cache.js';

/**
 * Check for required ic-cdk imports
 */
function checkImports(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for ic_cdk import
  if (!code.includes('use ic_cdk') && !code.includes('ic_cdk::')) {
    issues.push({
      severity: 'error',
      message: 'Missing ic_cdk import',
      suggestion: 'Add: use ic_cdk::*; or use ic_cdk::{query, update, init};',
      docUrl: 'https://docs.rs/ic-cdk/latest/ic_cdk/',
    });
  }

  return issues;
}

/**
 * Check for canister method attributes
 */
function checkMethodAttributes(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Find function definitions
  const fnMatches = code.matchAll(/(?:pub\s+)?fn\s+(\w+)/g);
  const functions = Array.from(fnMatches).map(m => m[1]);

  // Check for functions that look like canister methods but lack attributes
  const queryAttrPattern = /#\[query\]/g;
  const updateAttrPattern = /#\[update\]/g;

  const queryAttrs = Array.from(code.matchAll(queryAttrPattern));
  const updateAttrs = Array.from(code.matchAll(updateAttrPattern));

  // If we have public functions but no attributes, warn
  if (functions.length > 0 && queryAttrs.length === 0 && updateAttrs.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'Public functions without #[query] or #[update] attributes',
      suggestion: 'Canister methods need #[query] for read-only or #[update] for state-changing operations',
      docUrl: 'https://docs.rs/ic-cdk/latest/ic_cdk/attr.query.html',
    });
  }

  return issues;
}

/**
 * Check for state management patterns
 */
function checkStateManagement(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for thread_local! macro for shared state
  const hasThreadLocal = code.includes('thread_local!');
  const hasRefCell = code.includes('RefCell') || code.includes('Cell');

  // If there's mutable state without proper wrappers
  const hasStaticMut = code.match(/static\s+mut\s+/);
  if (hasStaticMut) {
    issues.push({
      severity: 'error',
      message: 'Using static mut is unsafe and not recommended',
      suggestion: 'Use thread_local! with RefCell or Cell for shared mutable state',
      docUrl: 'https://internetcomputer.org/docs/current/developer-docs/backend/rust/samples/state',
    });
  }

  // If we have update methods but no state management
  const hasUpdateAttr = code.includes('#[update]');
  if (hasUpdateAttr && !hasThreadLocal && !hasRefCell) {
    issues.push({
      severity: 'info',
      message: 'Update methods typically need state management',
      suggestion: 'Consider using thread_local! with RefCell for mutable state',
      docUrl: 'https://internetcomputer.org/docs/current/developer-docs/backend/rust/samples/state',
    });
  }

  return issues;
}

/**
 * Check for Candid export
 */
function checkCandidExport(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for export_candid! macro or candid_method
  const hasExportCandid = code.includes('export_candid!') || code.includes('ic_cdk::export_candid!');

  if (!hasExportCandid && (code.includes('#[query]') || code.includes('#[update]'))) {
    issues.push({
      severity: 'warning',
      message: 'Missing Candid interface export',
      suggestion: 'Add ic_cdk::export_candid!(); at the end of your file to generate the Candid interface',
      docUrl: 'https://docs.rs/ic-cdk/latest/ic_cdk/macro.export_candid.html',
    });
  }

  return issues;
}

/**
 * Check for upgrade hooks
 */
function checkUpgradeHooks(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const hasPreUpgrade = code.includes('#[pre_upgrade]');
  const hasPostUpgrade = code.includes('#[post_upgrade]');
  const hasThreadLocal = code.includes('thread_local!');

  // If there's state but no upgrade hooks
  if (hasThreadLocal && (!hasPreUpgrade || !hasPostUpgrade)) {
    issues.push({
      severity: 'info',
      message: 'State management without upgrade hooks',
      suggestion: 'Implement #[pre_upgrade] and #[post_upgrade] to preserve state during canister upgrades',
      docUrl: 'https://internetcomputer.org/docs/current/developer-docs/backend/rust/samples/upgrades',
    });
  }

  return issues;
}

/**
 * Check for security patterns
 */
function checkSecurityPatterns(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for caller() usage in critical operations
  const hasCallerCheck = code.includes('ic_cdk::api::caller()');
  const hasUpdateWithoutCaller = code.includes('#[update]') && !hasCallerCheck;

  if (hasUpdateWithoutCaller && code.includes('delete') || code.includes('admin')) {
    issues.push({
      severity: 'warning',
      message: 'Critical operations without caller verification',
      suggestion: 'Use ic_cdk::api::caller() to verify the caller identity for admin/delete operations',
      docUrl: 'https://internetcomputer.org/docs/current/developer-docs/security/security-best-practices',
    });
  }

  // Check for unwrap() usage
  const hasUnwrap = code.match(/\.unwrap\(\)/g);
  if (hasUnwrap && hasUnwrap.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Found ${hasUnwrap.length} unwrap() calls that could panic`,
      suggestion: 'Use expect() with error messages or proper error handling instead of unwrap()',
      docUrl: 'https://internetcomputer.org/docs/current/developer-docs/security/security-best-practices',
    });
  }

  // Check for panic! usage
  const hasPanic = code.match(/panic!\(/g);
  if (hasPanic && hasPanic.length > 0) {
    issues.push({
      severity: 'warning',
      message: 'Explicit panic! calls can trap the canister',
      suggestion: 'Return Result types and handle errors gracefully instead of panicking',
    });
  }

  return issues;
}

/**
 * Check for common antipatterns
 */
function checkAntipatterns(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for println! usage
  if (code.includes('println!')) {
    issues.push({
      severity: 'info',
      message: 'println! has no effect in canisters',
      suggestion: 'Use ic_cdk::println! for debugging or remove print statements',
    });
  }

  // Check for std::time usage instead of ic_cdk::api::time
  if (code.includes('std::time::') && !code.includes('ic_cdk::api::time')) {
    issues.push({
      severity: 'warning',
      message: 'std::time is not deterministic on IC',
      suggestion: 'Use ic_cdk::api::time() for deterministic timestamps',
      docUrl: 'https://docs.rs/ic-cdk/latest/ic_cdk/api/fn.time.html',
    });
  }

  return issues;
}

/**
 * Validate Rust ic-cdk code
 */
export async function validateRust(
  code: string,
  context?: { securityCheck?: boolean }
): Promise<ValidationResult> {
  const enhancedSecurity = context?.securityCheck ?? false;

  // Check cache
  const cacheKey = `rust:${code}:sec=${enhancedSecurity}`;
  const cached = validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached Rust validation result');
    return cached;
  }

  try {
    const issues: ValidationIssue[] = [
      ...checkImports(code),
      ...checkMethodAttributes(code),
      ...checkStateManagement(code),
      ...checkCandidExport(code),
      ...checkUpgradeHooks(code),
      ...checkSecurityPatterns(code),
      ...checkAntipatterns(code),
    ];

    // Add enhanced security checks if requested
    if (enhancedSecurity) {
      const { checkRustSecurity } = await import('./security-patterns.js');
      logger.debug('Running enhanced security checks');
      issues.push(...checkRustSecurity(code));
    }

    // Check if there are any errors
    const hasErrors = issues.some(issue => issue.severity === 'error');

    const result: ValidationResult = {
      valid: !hasErrors,
      issues,
    };

    // Cache result
    validationCache.set(cacheKey, result);

    return result;
  } catch (error: any) {
    logger.error('Rust validation error:', error);

    return {
      valid: false,
      issues: [
        {
          severity: 'error',
          message: `Validation failed: ${error.message}`,
        },
      ],
    };
  }
}
