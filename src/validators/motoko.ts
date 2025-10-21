/**
 * Motoko validation using pattern matching
 * Checks for common issues and best practices
 */

import type { ValidationIssue, ValidationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { validationCache } from '../utils/cache.js';

interface ValidationContext {
  isUpgrade?: boolean;
  hasStableState?: boolean;
}

/**
 * Check for actor structure
 */
function checkActorStructure(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for actor declaration
  if (!code.match(/\b(actor|persistent\s+actor)\b/)) {
    issues.push({
      severity: 'error',
      message: 'No actor declaration found',
      suggestion: 'Motoko canisters must have an actor declaration: "actor { ... }" or "persistent actor { ... }"',
      docUrl: 'https://internetcomputer.org/docs/current/motoko/main/actors-async',
    });
  }

  // Check for persistent actor pattern (modern best practice)
  const hasPersistentActor = code.includes('persistent actor');
  const hasStableVar = code.match(/\bstable\s+var\b/);

  if (!hasPersistentActor && hasStableVar) {
    issues.push({
      severity: 'info',
      message: 'Consider using "persistent actor" for enhanced orthogonal persistence',
      suggestion: 'Modern Motoko uses "persistent actor" which automatically handles state persistence',
      docUrl: 'https://internetcomputer.org/docs/current/motoko/main/stablememory/persistent-actors',
    });
  }

  return issues;
}

/**
 * Check for stable variables when needed
 */
function checkStableVariables(code: string, _context?: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check if there are variables that should probably be stable
  const varMatches = code.matchAll(/^\s*(var|let)\s+(\w+)\s*:/gm);
  const stableVarMatches = code.matchAll(/^\s*stable\s+var\s+(\w+)\s*:/gm);

  const regularVars = Array.from(varMatches).map(m => m[2]);
  const stableVars = Array.from(stableVarMatches).map(m => m[1]);

  // If using regular actor (not persistent) and has mutable state
  const hasPersistentActor = code.includes('persistent actor');
  if (!hasPersistentActor && regularVars.length > 0 && stableVars.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'State variables without stable keyword will be lost on upgrade',
      suggestion: 'Use "stable var" for data that should persist across canister upgrades, or use "persistent actor"',
      docUrl: 'https://internetcomputer.org/docs/current/motoko/main/upgrades',
    });
  }

  return issues;
}

/**
 * Check for proper public function declarations
 */
function checkPublicFunctions(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for public functions that should be shared
  const publicFuncMatches = code.matchAll(/public\s+func\s+(\w+)/g);
  const sharedFuncMatches = code.matchAll(/public\s+shared\s+/g);

  const publicFuncs = Array.from(publicFuncMatches);

  if (publicFuncs.length > 0) {
    // Count shared functions
    const sharedCount = Array.from(sharedFuncMatches).length;

    if (sharedCount === 0) {
      issues.push({
        severity: 'warning',
        message: 'Public functions should be declared as "public shared" or "public query"',
        suggestion: 'Use "public shared func" for update calls or "public query func" for read-only calls',
        docUrl: 'https://internetcomputer.org/docs/current/motoko/main/actors-async',
      });
    }
  }

  return issues;
}

/**
 * Check for async/await patterns
 */
function checkAsyncPatterns(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for async without await in shared functions
  const asyncWithoutAwait = code.match(/public\s+shared.*?async\s*\{[^}]*\}/gs);

  if (asyncWithoutAwait) {
    for (const match of asyncWithoutAwait) {
      if (!match.includes('await') && match.includes('async')) {
        issues.push({
          severity: 'info',
          message: 'Async function without await may not need async return type',
          suggestion: 'If not awaiting any calls, return type may not need to be async',
        });
        break; // Only report once
      }
    }
  }

  return issues;
}

/**
 * Check for upgrade hooks when stable variables exist
 */
function checkUpgradeHooks(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const hasStableVars = code.match(/\bstable\s+var\b/);
  const hasPreUpgrade = code.match(/system\s+func\s+preupgrade/);
  const hasPostUpgrade = code.match(/system\s+func\s+postupgrade/);

  // If using persistent actor, upgrade hooks are less critical
  const hasPersistentActor = code.includes('persistent actor');

  if (hasStableVars && !hasPersistentActor && (!hasPreUpgrade || !hasPostUpgrade)) {
    issues.push({
      severity: 'info',
      message: 'Consider adding upgrade hooks for stable state management',
      suggestion: 'Implement system func preupgrade() and system func postupgrade() for safe upgrades',
      docUrl: 'https://internetcomputer.org/docs/current/motoko/main/upgrades',
    });
  }

  return issues;
}

/**
 * Check for common antipatterns
 */
function checkAntipatterns(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for unhandled errors in async calls
  const asyncCallsWithoutTry = code.match(/await\s+\w+\.[^;]+;(?!\s*catch)/g);
  if (asyncCallsWithoutTry && asyncCallsWithoutTry.length > 0) {
    issues.push({
      severity: 'warning',
      message: 'Async calls without error handling can cause traps',
      suggestion: 'Wrap inter-canister calls in try/catch blocks or use Result types',
      docUrl: 'https://internetcomputer.org/docs/current/motoko/main/errors',
    });
  }

  return issues;
}

/**
 * Validate Motoko code using pattern matching
 */
export async function validateMotoko(
  code: string,
  context?: ValidationContext
): Promise<ValidationResult> {
  // Check cache
  const cacheKey = `motoko:${code}`;
  const cached = validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached Motoko validation result');
    return cached;
  }

  try {
    const issues: ValidationIssue[] = [
      ...checkActorStructure(code),
      ...checkStableVariables(code, context),
      ...checkPublicFunctions(code),
      ...checkAsyncPatterns(code),
      ...checkUpgradeHooks(code),
      ...checkAntipatterns(code),
    ];

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
    logger.error('Motoko validation error:', error);

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
