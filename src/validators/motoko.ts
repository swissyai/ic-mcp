/**
 * Motoko validation using moc compiler
 */

import type { ValidationResult, ValidationIssue } from '../types/index.js';
import { compileMotokoCode } from './motoko-compiler.js';
import { checkMotokoSecurity, checkHttpsOutcalls } from './security-patterns.js';
import { logger } from '../utils/logger.js';
import { validationCache } from '../utils/cache.js';

/**
 * Check for Motoko best practice violations
 */
function checkBestPractices(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Check for mo:base imports (deprecated)
  const moBaseRegex = /import\s+\w+\s+["']mo:base\//g;
  let match;
  while ((match = moBaseRegex.exec(code)) !== null) {
    const line = code.substring(0, match.index).split('\n').length;
    issues.push({
      severity: 'warning',
      message: 'Using deprecated mo:base library. Replace with mo:core (mo:base deprecated August 2025)',
      line,
      suggestion: match[0].replace('mo:base/', 'mo:core/'),
    });
  }

  // 2. Check for unlabeled break/continue
  const breakContinueRegex = /\b(break|continue)\b(?!\s+\w)/g;
  while ((match = breakContinueRegex.exec(code)) !== null) {
    // Check if we're inside a loop context
    const beforeBreak = code.substring(0, match.index);
    const hasLoop = /\b(for|while)\s*\(/.test(beforeBreak.substring(Math.max(0, beforeBreak.length - 200)));

    if (hasLoop) {
      const line = beforeBreak.split('\n').length;
      issues.push({
        severity: 'error',
        message: `Unlabeled ${match[1]} statement. Motoko requires labeled loops for break/continue`,
        line,
        suggestion: `Use: label loop_name ${match[1]} loop_name`,
      });
    }
  }

  // 3. Check for Buffer usage (deprecated)
  const bufferRegex = /import\s+(\w+)\s+["']mo:(?:base|core)\/Buffer/g;
  while ((match = bufferRegex.exec(code)) !== null) {
    const line = code.substring(0, match.index).split('\n').length;
    issues.push({
      severity: 'warning',
      message: 'Buffer is deprecated. Use List from mo:core instead (List provides dynamic sizing)',
      line,
      suggestion: `import ${match[1]} "mo:core/List"`,
    });
  }

  // 4. Check for async without error handling
  const asyncWithoutTry = /async\s+\{[^}]*await[^}]*\}(?![^{]*catch)/g;
  while ((match = asyncWithoutTry.exec(code)) !== null) {
    const hasResultType = /Result\.Result</.test(match[0]);
    if (!hasResultType) {
      const line = code.substring(0, match.index).split('\n').length;
      issues.push({
        severity: 'info',
        message: 'Async function without try/catch or Result type. Consider explicit error handling',
        line,
        suggestion: 'Wrap await calls in try/catch or use Result.Result<T, E> return type',
      });
    }
  }

  // 5. Check for manual stable memory usage with EOP
  // Note: This requires detecting moc version, which we'll infer from presence of EOP patterns
  const hasRegionUsage = /Region\./g.test(code);
  const hasStableVars = /stable\s+var/g.test(code);
  const hasPreupgrade = /system\s+func\s+preupgrade/g.test(code);

  if (hasRegionUsage && hasStableVars) {
    const regionMatch = /Region\./.exec(code);
    if (regionMatch) {
      const line = code.substring(0, regionMatch.index).split('\n').length;
      issues.push({
        severity: 'info',
        message: 'Using manual stable memory (Region) with stable vars. Consider if EOP (moc >= 0.15.0) makes this unnecessary',
        line,
        suggestion: 'With Enhanced Orthogonal Persistence, heap persists automatically. Remove stable vars and Region unless you need >4GB stable memory',
      });
    }
  }

  // 6. Check for old persistence patterns with preupgrade/stable
  if (hasPreupgrade && hasStableVars) {
    const preupgradeMatch = /system\s+func\s+preupgrade/.exec(code);
    if (preupgradeMatch) {
      const line = code.substring(0, preupgradeMatch.index).split('\n').length;
      issues.push({
        severity: 'info',
        message: 'Using preupgrade with stable vars. If using moc >= 0.15.0, EOP handles persistence automatically',
        line,
        suggestion: 'With EOP enabled, stable vars and preupgrade/postupgrade hooks are usually unnecessary. Query icp/query { modules: ["EOP"] } for details',
      });
    }
  }

  return issues;
}

/**
 * Validate Motoko code using moc compiler
 */
export async function validateMotoko(
  code: string,
  context?: { isUpgrade?: boolean; hasStableState?: boolean; securityCheck?: boolean; bestPractices?: boolean }
): Promise<ValidationResult> {
  const securityCheck = context?.securityCheck ?? false;
  const bestPractices = context?.bestPractices ?? true; // Enabled by default

  // Check cache
  const cacheKey = `motoko:${code}:sec=${securityCheck}:bp=${bestPractices}`;
  const cached = validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached Motoko validation result');
    return cached;
  }

  logger.info('Validating Motoko code with moc compiler');
  const result = await compileMotokoCode(code);

  // Add security checks if requested
  if (securityCheck) {
    logger.debug('Running security pattern checks');
    const securityIssues = checkMotokoSecurity(code);
    const httpsIssues = checkHttpsOutcalls(code);
    result.issues = [...result.issues, ...securityIssues, ...httpsIssues];
  }

  // Add best practice checks
  if (bestPractices) {
    logger.debug('Running best practice checks');
    const practiceIssues = checkBestPractices(code);
    result.issues = [...result.issues, ...practiceIssues];

    // If we found best practice issues, validation is still technically valid but with warnings
    if (practiceIssues.some(i => i.severity === 'error')) {
      result.valid = false;
    }
  }

  validationCache.set(cacheKey, result);
  return result;
}
