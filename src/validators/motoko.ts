/**
 * Motoko validation using moc compiler
 */

import type { ValidationResult } from '../types/index.js';
import { compileMotokoCode } from './motoko-compiler.js';
import { checkMotokoSecurity, checkHttpsOutcalls } from './security-patterns.js';
import { logger } from '../utils/logger.js';
import { validationCache } from '../utils/cache.js';

/**
 * Validate Motoko code using moc compiler
 */
export async function validateMotoko(
  code: string,
  context?: { isUpgrade?: boolean; hasStableState?: boolean; securityCheck?: boolean }
): Promise<ValidationResult> {
  const securityCheck = context?.securityCheck ?? false;

  // Check cache
  const cacheKey = `motoko:${code}:sec=${securityCheck}`;
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

  return result;
}
