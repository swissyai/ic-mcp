/**
 * Motoko compilation using moc compiler
 */

import { exec } from 'child_process';
import { writeFile, unlink, mkdir, copyFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { existsSync } from 'fs';
import type { ValidationIssue, ValidationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { validationCache, generateCacheKey } from '../utils/cache.js';

/**
 * Actor alias for resolving canister imports
 */
export interface ActorAlias {
  name: string;
  candidPath: string;
}

/**
 * Compilation context with canister aliases
 */
export interface CompilationContext {
  actorAliases?: ActorAlias[];
  projectPath?: string;
}

const execAsync = promisify(exec);

// Session-level caching
let mocPathCache: string | null | undefined = undefined;
let basePathCache: string | null | undefined = undefined;

/**
 * Find moc compiler path
 */
export async function findMocPath(): Promise<string | null> {
  if (mocPathCache !== undefined) {
    return mocPathCache;
  }

  try {
    // Try dfx cache first
    const cacheDir = (await execAsync('dfx cache show')).stdout.trim();
    const mocPath = join(cacheDir, 'moc');
    
    if (existsSync(mocPath)) {
      logger.debug(`Found moc at: ${mocPath}`);
      mocPathCache = mocPath;
      return mocPath;
    }
  } catch {
    // dfx not found
  }

  try {
    // Try PATH
    await execAsync('which moc');
    logger.debug('Found moc in PATH');
    mocPathCache = 'moc';
    return 'moc';
  } catch {
    // Not in PATH
  }

  logger.warn('moc compiler not found');
  mocPathCache = null;
  return null;
}

/**
 * Find core package path for imports
 */
async function findBasePath(): Promise<string | null> {
  if (basePathCache !== undefined) {
    return basePathCache;
  }

  try {
    const cacheDir = (await execAsync('dfx cache show')).stdout.trim();
    // Try core first (new standard library)
    const corePath = join(cacheDir, 'core');

    if (existsSync(corePath)) {
      basePathCache = corePath;
      return corePath;
    }

    // Fall back to base for backward compatibility
    const basePath = join(cacheDir, 'base');
    if (existsSync(basePath)) {
      basePathCache = basePath;
      return basePath;
    }
  } catch {
    // Not found
  }

  basePathCache = null;
  return null;
}

/**
 * Parse error location from format: file.mo:line.col-line.col
 */
function parseErrorLocation(locationStr: string) {
  const match = locationStr.match(/([^:]+):(\d+)\.(\d+)-(\d+)\.(\d+)/);
  if (!match) return null;

  const [_, file, startLine, startCol, endLine, endCol] = match;
  return {
    file,
    startLine: parseInt(startLine),
    startCol: parseInt(startCol),
    endLine: parseInt(endLine),
    endCol: parseInt(endCol),
  };
}

/**
 * Parse error start line
 * Format: file.mo:line.col-line.col: severity [CODE], message
 * Severity can be "type error", "syntax error", "import error", "warning", "info"
 */
function parseErrorStart(line: string): Partial<ValidationIssue> | null {
  const match = line.match(/^(.+?):\s+([a-z\s]+)\s+\[([^\]]+)\],\s+(.+)$/);

  if (!match) return null;

  const [_, locationStr, rawSeverity, code, message] = match;
  const location = parseErrorLocation(locationStr);

  if (!location) return null;

  // Normalize severity (type error, syntax error -> error; warning -> warning; info -> info)
  let severity: 'error' | 'warning' | 'info' = 'error';
  const severityLower = rawSeverity.trim().toLowerCase();
  if (severityLower.includes('warning')) {
    severity = 'warning';
  } else if (severityLower.includes('info')) {
    severity = 'info';
  }

  return {
    severity,
    code,
    message: message.trim(),
    line: location.startLine,
    column: location.startCol,
  };
}

/**
 * Get documentation URL for error code
 */
function getMotokoDocUrl(code?: string): string | undefined {
  if (!code) return undefined;
  
  const errorDocs: Record<string, string> = {
    'M0096': 'https://internetcomputer.org/docs/current/motoko/main/base/Error',
    'M0057': 'https://internetcomputer.org/docs/current/motoko/main/about-this-guide',
    'M0001': 'https://internetcomputer.org/docs/current/motoko/main/language-manual',
    'M0010': 'https://internetcomputer.org/docs/current/motoko/main/package-management',
  };

  return errorDocs[code] || 'https://internetcomputer.org/docs/current/motoko/main/errors';
}

/**
 * Finalize error by adding doc URL
 */
function finalizeError(partial: Partial<ValidationIssue>): ValidationIssue {
  return {
    severity: partial.severity || 'error',
    message: partial.message || 'Unknown error',
    code: partial.code,
    line: partial.line,
    column: partial.column,
    docUrl: getMotokoDocUrl(partial.code),
  };
}

/**
 * Generate a valid placeholder principal based on index
 * Format: simple alphanumeric with dashes that satisfies principal format
 */
function generatePlaceholderPrincipal(index: number): string {
  // Use the management canister format as a template: aaaaa-aa
  // Create variations by using different letters for each canister
  // This creates unique but valid principals for validation
  const base32Chars = 'abcdefghijklmnopqrstuvwxyz234567';
  const idx = index % base32Chars.length;
  const char = base32Chars[idx];

  // Generate a simple valid principal format: <char><char><char><char><char>-aa
  return `${char}${char}${char}${char}${char}-aa`;
}

/**
 * Parse moc compiler errors
 * Handles multi-line errors via state machine
 */
export function parseMocErrors(stderr: string): ValidationIssue[] {
  const lines = stderr.split('\n');
  const errors: ValidationIssue[] = [];
  let currentError: Partial<ValidationIssue> | null = null;

  for (const line of lines) {
    // Skip empty lines when not in error
    if (!currentError && line.trim() === '') {
      continue;
    }

    // Check if this is start of new error
    const errorStart = parseErrorStart(line);
    
    if (errorStart) {
      // Save previous error if exists
      if (currentError && currentError.message) {
        errors.push(finalizeError(currentError));
      }
      
      // Start new error
      currentError = errorStart;
    }
    // Check if this is a continuation line (indented)
    else if (currentError && line.startsWith('  ')) {
      // Append to current error message
      currentError.message = (currentError.message || '') + '\n' + line.trim();
    }
    // Blank line or unrecognized - finalize current error
    else if (currentError) {
      errors.push(finalizeError(currentError));
      currentError = null;
    }
  }

  // Don't forget last error
  if (currentError && currentError.message) {
    errors.push(finalizeError(currentError));
  }

  return errors;
}

/**
 * Compile Motoko code using moc
 */
export async function compileMotokoCode(
  code: string,
  context?: CompilationContext
): Promise<ValidationResult> {
  // Check cache (content-based with SHA-256)
  const cacheKey = generateCacheKey('motoko:v1', code, {
    actorAliases: context?.actorAliases || [],
  });
  const cached = validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached compilation result');
    return cached;
  }

  // Find moc
  const mocPath = await findMocPath();
  if (!mocPath) {
    return {
      valid: false,
      issues: [{
        severity: 'error',
        message: 'moc compiler not found. Motoko validation requires dfx.',
        suggestion: 'Install dfx: sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"',
        docUrl: 'https://internetcomputer.org/docs/current/developer-docs/setup/install/',
      }],
    };
  }

  // Write code to temp file
  const tempFile = join(
    tmpdir(),
    `motoko-${Date.now()}-${Math.random().toString(36).substring(7)}.mo`
  );

  // Create temp directory for actor IDL files if needed
  let idlDir: string | null = null;

  try {
    await writeFile(tempFile, code, 'utf-8');

    // Build command with package flag for imports
    const basePath = await findBasePath();
    const packageFlag = basePath ? `--package base ${basePath}` : '';

    // Build actor alias/IDL flags for canister imports
    // moc expects: --actor-alias <name> <principal> --actor-idl <dir>
    // where <dir>/<principal>.did contains the Candid interface
    const actorAliasFlags: string[] = [];
    if (context?.actorAliases && context.actorAliases.length > 0) {
      logger.debug(`Setting up actor imports for ${context.actorAliases.length} canisters`);

      // Create temp IDL directory
      idlDir = join(tmpdir(), `motoko-idl-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      await mkdir(idlDir, { recursive: true });
      logger.debug(`Created temp IDL directory: ${idlDir}`);

      for (let i = 0; i < context.actorAliases.length; i++) {
        const alias = context.actorAliases[i];

        // Resolve path relative to project if needed
        const candidPath = context.projectPath && !alias.candidPath.startsWith('/')
          ? join(context.projectPath, alias.candidPath)
          : alias.candidPath;

        logger.debug(`Processing actor: ${alias.name} from ${alias.candidPath}`);

        if (existsSync(candidPath)) {
          // Generate a unique valid placeholder principal for each canister
          const placeholderPrincipal = generatePlaceholderPrincipal(i);
          const idlFileName = `${placeholderPrincipal}.did`;
          const idlFilePath = join(idlDir, idlFileName);

          // Copy Candid file to IDL directory
          await copyFile(candidPath, idlFilePath);
          logger.debug(`Copied ${candidPath} -> ${idlFilePath}`);

          // Add actor alias flag
          actorAliasFlags.push(`--actor-alias ${alias.name} ${placeholderPrincipal}`);
          logger.debug(`✓ Added actor alias: ${alias.name} -> ${placeholderPrincipal}`);
        } else {
          logger.warn(`✗ Candid file not found for actor ${alias.name}: ${candidPath}`);
        }
      }
    }

    const actorAliasStr = actorAliasFlags.join(' ');
    const actorIdlFlag = idlDir ? `--actor-idl ${idlDir}` : '';
    const command = `${mocPath} --check ${packageFlag} ${actorIdlFlag} ${actorAliasStr} ${tempFile}`.trim();

    logger.debug(`=== MOC COMMAND ===`);
    logger.debug(`  moc path: ${mocPath}`);
    logger.debug(`  package flag: ${packageFlag}`);
    logger.debug(`  IDL directory: ${idlDir || 'none'}`);
    logger.debug(`  actor aliases: ${actorAliasStr || 'none'}`);
    logger.debug(`  temp file: ${tempFile}`);
    logger.debug(`  full command: ${command}`);
    logger.debug(`==================`);

    // Execute compilation
    try {
      await execAsync(command);

      // Success!
      const result: ValidationResult = {
        valid: true,
        issues: [],
      };

      validationCache.set(cacheKey, result);
      return result;

    } catch (error: any) {
      // Compilation failed - parse errors
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      const exitCode = error.code;

      logger.debug(`moc failed with exit code: ${exitCode}`);
      logger.debug(`moc stdout: ${stdout}`);
      logger.debug(`moc stderr: ${stderr}`);

      const issues = parseMocErrors(stderr);
      logger.debug(`Parsed ${issues.length} issues from stderr`);

      // If no issues parsed but command failed, it's likely a command syntax error
      if (issues.length === 0 && stderr) {
        logger.warn(`moc failed but no issues parsed. Raw stderr: ${stderr}`);
        issues.push({
          severity: 'error',
          message: `Compilation failed: ${stderr}`,
        });
      }

      const result: ValidationResult = {
        valid: false,
        issues,
      };

      // Cache for 1 minute (user might be iterating)
      validationCache.set(cacheKey, result, 60 * 1000);
      return result;
    }

  } catch (error: any) {
    logger.error('Motoko compilation error:', error);

    return {
      valid: false,
      issues: [{
        severity: 'error',
        message: `Compilation failed: ${error.message}`,
      }],
    };

  } finally {
    // Cleanup temp files
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }

    // Cleanup temp IDL directory
    if (idlDir) {
      try {
        await rm(idlDir, { recursive: true, force: true });
        logger.debug(`Cleaned up IDL directory: ${idlDir}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Check if moc is available
 */
export async function checkMocAvailable(): Promise<boolean> {
  const mocPath = await findMocPath();
  return mocPath !== null;
}
