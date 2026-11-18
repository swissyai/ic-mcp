/**
 * Candid validation using didc CLI
 */

import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ValidationIssue, ValidationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { validationCache, generateCacheKey } from '../utils/cache.js';
import { runCommand } from '../executors/icp-executor.js';

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

  // Pattern 1: Unbound type identifier
  const unboundMatch = cleanError.match(/Unbound type identifier (\w+)/);
  if (unboundMatch) {
    issues.push({
      severity: 'error',
      message: `Unknown type '${unboundMatch[1]}'`,
      suggestion: 'Check type name casing (use lowercase for primitives: nat, text, bool)',
      docUrl: 'https://docs.internetcomputer.org/guides/canister-calls/candid/',
    });
  }

  // Pattern 2: Parser errors with line/column
  const parserMatch = cleanError.match(/┌─.*?:(\d+):(\d+)/);
  if (parserMatch) {
    const line = parseInt(parserMatch[1]);
    const column = parseInt(parserMatch[2]);

    // Extract error message
    let errorMsg = 'Syntax error';
    if (cleanError.includes('Unexpected token')) {
      errorMsg = 'Unexpected token';
    } else if (cleanError.includes('hash collision')) {
      errorMsg = 'Duplicate method name detected';
    } else if (cleanError.includes('Expects')) {
      const expectsMatch = cleanError.match(/Expects "(.+?)"/);
      if (expectsMatch) {
        errorMsg = `Expected "${expectsMatch[1]}"`;
      }
    }

    issues.push({
      severity: 'error',
      line,
      column,
      message: errorMsg,
      suggestion: 'Check Candid syntax and service interface definition',
      docUrl: 'https://docs.internetcomputer.org/guides/canister-calls/candid/',
    });
  }

  // Pattern 3: Hash collision (duplicate methods)
  if (cleanError.includes('hash collision')) {
    const labelMatch = cleanError.match(/label '(\w+)' hash collision/);
    if (labelMatch && !issues.some(i => i.message.includes('Duplicate'))) {
      issues.push({
        severity: 'error',
        message: `Duplicate method name: '${labelMatch[1]}'`,
        suggestion: 'Service methods must have unique names',
        docUrl: 'https://docs.internetcomputer.org/guides/canister-calls/candid/',
      });
    }
  }

  // Fallback: generic error
  if (issues.length === 0 && cleanError.includes('Error:')) {
    const errorLine = cleanError.split('\n').find(line => line.startsWith('Error:'));
    if (errorLine) {
      issues.push({
        severity: 'error',
        message: errorLine.replace('Error: ', '').trim(),
      });
    }
  }

  return issues;
}

/**
 * Validate Candid code using didc CLI
 */
export async function validateCandid(code: string): Promise<ValidationResult> {
  // Check cache (content-based with SHA-256)
  const cacheKey = generateCacheKey('candid:v1', code);
  const cached = validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached Candid validation result');
    return cached;
  }

  const tempFile = join(tmpdir(), `candid-${Date.now()}-${Math.random().toString(36).substring(7)}.did`);

  try {
    // Write code to temp file
    await writeFile(tempFile, code, 'utf-8');

    const check = await runCommand({ program: 'didc', args: ['check', tempFile], timeoutMs: 30_000 });
    if (check.ok) {
      const result: ValidationResult = { valid: true, issues: [] };
      validationCache.set(cacheKey, result);
      return result;
    }

    const issues = parseDidcError(check.stderr || check.stdout);
    if (issues.length === 0) {
      issues.push({ severity: 'error', message: (check.stderr || check.stdout || 'didc check failed').trim() });
    }
    const result: ValidationResult = { valid: false, issues };
    validationCache.set(cacheKey, result, 60 * 1000);
    return result;
  } catch (error: any) {
    logger.error('Candid validation error:', error);

    return {
      valid: false,
      issues: [
        {
          severity: 'error',
          message: `Validation failed: ${error.message}`,
        },
      ],
    };
  } finally {
    // Cleanup temp file
    try {
      await unlink(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if didc is available
 */
export async function checkDidcAvailable(): Promise<boolean> {
  const result = await runCommand({ program: 'didc', args: ['--version'], timeoutMs: 10_000 });
  return result.ok;
}
