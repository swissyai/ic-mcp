/**
 * Motoko validation using moc compiler
 */

import type { ValidationResult } from '../types/index.js';
import { compileMotokoCode } from './motoko-compiler.js';
import { logger } from '../utils/logger.js';
import { validationCache } from '../utils/cache.js';

/**
 * Validate Motoko code using moc compiler
 */
export async function validateMotoko(
  code: string,
  _context?: { isUpgrade?: boolean; hasStableState?: boolean }
): Promise<ValidationResult> {
  // Check cache
  const cacheKey = `motoko:${code}`;
  const cached = validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached Motoko validation result');
    return cached;
  }

  logger.info('Validating Motoko code with moc compiler');
  return await compileMotokoCode(code);
}
