# Real Compilation Implementation Roadmap

## 📅 Timeline: ~8 hours total

**Phase 1 (Core):** 4 hours  
**Phase 2 (Testing):** 2 hours  
**Phase 3 (Polish):** 2 hours  

---

## 🎯 Phase 1: Core Implementation (4 hours)

### Step 1: Helper Functions (1 hour)

**File:** `src/validators/motoko-compiler.ts` (new file)

```typescript
/**
 * Real Motoko compilation using moc compiler
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

// Cache for session
let mocPathCache: string | null | undefined = undefined;
let basePathCache: string | null | undefined = undefined;

/**
 * Find moc compiler path
 * Priority: dfx cache > PATH > null
 */
export async function findMocPath(): Promise<string | null> {
  // Return cached result
  if (mocPathCache !== undefined) {
    return mocPathCache;
  }

  try {
    // Method 1: dfx cache (most reliable)
    const cacheDir = (await execAsync('dfx cache show')).stdout.trim();
    const mocPath = join(cacheDir, 'moc');
    
    if (existsSync(mocPath)) {
      mocPathCache = mocPath;
      return mocPath;
    }
  } catch {
    // dfx not found or errored
  }

  try {
    // Method 2: Check PATH
    await execAsync('which moc');
    mocPathCache = 'moc'; // Available in PATH
    return 'moc';
  } catch {
    // moc not in PATH
  }

  // Not found
  mocPathCache = null;
  return null;
}

/**
 * Find base package path for imports
 */
export async function findBasePath(): Promise<string | null> {
  if (basePathCache !== undefined) {
    return basePathCache;
  }

  try {
    const cacheDir = (await execAsync('dfx cache show')).stdout.trim();
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
 * Check if moc is available (exported for tooling)
 */
export async function checkMocAvailable(): Promise<boolean> {
  const mocPath = await findMocPath();
  return mocPath !== null;
}
```

**Tests to write:**
- `findMocPath()` with dfx installed
- `findMocPath()` without dfx
- `findBasePath()` 
- Caching behavior

---

### Step 2: Error Parser (1.5 hours)

**File:** `src/validators/motoko-compiler.ts` (continue)

```typescript
import type { ValidationIssue } from '../types/index.js';

interface MocErrorLocation {
  file: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

/**
 * Parse error location from format: file.mo:line.col-line.col
 */
function parseErrorLocation(locationStr: string): MocErrorLocation | null {
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
 */
function parseErrorStart(line: string): Partial<ValidationIssue> | null {
  // Pattern: location: severity [CODE], message
  const match = line.match(/^(.+?):\s+(error|warning|info)\s+\[([^\]]+)\],\s+(.+)$/);
  
  if (!match) return null;

  const [_, locationStr, severity, code, message] = match;
  const location = parseErrorLocation(locationStr);

  if (!location) return null;

  return {
    severity: severity as 'error' | 'warning' | 'info',
    code,
    message: message.trim(),
    line: location.startLine,
    column: location.startCol,
  };
}

/**
 * State machine parser for multi-line moc errors
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
 * Finalize error by cleaning up message and adding doc URL
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
 * Get documentation URL for error code
 */
function getMotokoDocUrl(code?: string): string | undefined {
  if (!code) return undefined;
  
  // Common error codes
  const errorDocs: Record<string, string> = {
    'M0096': 'https://internetcomputer.org/docs/current/motoko/main/base/Error',
    'M0057': 'https://internetcomputer.org/docs/current/motoko/main/about-this-guide',
    'M0001': 'https://internetcomputer.org/docs/current/motoko/main/language-manual',
    'M0010': 'https://internetcomputer.org/docs/current/motoko/main/package-management',
  };

  return errorDocs[code] || 'https://internetcomputer.org/docs/current/motoko/main/errors';
}
```

**Tests to write:**
- Parse single-line error
- Parse multi-line error
- Parse multiple errors
- Handle malformed errors gracefully

---

### Step 3: Compilation Function (1 hour)

**File:** `src/validators/motoko-compiler.ts` (continue)

```typescript
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import type { ValidationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { validationCache } from '../utils/cache.js';

/**
 * Compile Motoko code using moc
 */
export async function compileMotokoCode(code: string): Promise<ValidationResult> {
  // Check cache
  const cacheKey = `motoko-compile:${code}`;
  const cached = validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached compilation result');
    return cached;
  }

  // Find moc
  const mocPath = await findMocPath();
  if (!mocPath) {
    logger.warn('moc compiler not found');
    return {
      valid: false,
      issues: [{
        severity: 'info',
        message: 'moc compiler not available. Install dfx for full compilation support.',
        suggestion: 'Install: sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"',
        docUrl: 'https://internetcomputer.org/docs/current/developer-docs/setup/install/',
      }],
    };
  }

  // Write code to temp file
  const tempFile = join(
    tmpdir(),
    `motoko-${Date.now()}-${Math.random().toString(36).substring(7)}.mo`
  );

  try {
    await writeFile(tempFile, code, 'utf-8');

    // Build command with package flag
    const basePath = await findBasePath();
    const packageFlag = basePath ? `--package base ${basePath}` : '';
    const command = `${mocPath} --check ${packageFlag} ${tempFile}`.trim();

    logger.debug(`Running: ${command}`);

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
      const issues = parseMocErrors(stderr);

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
    // Cleanup temp file
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}
```

**Tests to write:**
- Compile valid code
- Compile code with type error
- Compile code with syntax error
- Compile code with imports
- Handle moc not found
- Cleanup temp files

---

### Step 4: Update Main Validator (30 min)

**File:** `src/validators/motoko.ts`

```typescript
import { compileMotokoCode, checkMocAvailable } from './motoko-compiler.js';

/**
 * Validate Motoko code
 * Tries real compilation first, falls back to pattern matching
 */
export async function validateMotoko(
  code: string,
  context?: ValidationContext
): Promise<ValidationResult> {
  // Check cache
  const cacheKey = `motoko:${code}`;
  const cached = validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached validation result');
    return cached;
  }

  // Try real compilation first
  const hasMoc = await checkMocAvailable();
  
  if (hasMoc) {
    logger.info('Using moc compiler for validation');
    return await compileMotokoCode(code);
  }

  // Fallback to pattern matching
  logger.info('Using pattern-based validation (moc not available)');
  return await fallbackValidation(code, context);
}

/**
 * Pattern-based validation (fallback)
 * Renamed from validateMotoko, keeps existing logic
 */
async function fallbackValidation(
  code: string,
  context?: ValidationContext
): Promise<ValidationResult> {
  try {
    const issues: ValidationIssue[] = [
      // Add info about fallback mode
      {
        severity: 'info',
        message: 'Using pattern-based validation. Install dfx for full compiler validation.',
        suggestion: 'Install dfx: sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"',
      },
      ...checkActorStructure(code),
      ...checkStableVariables(code, context),
      ...checkPublicFunctions(code),
      ...checkAsyncPatterns(code),
      ...checkUpgradeHooks(code),
      ...checkAntipatterns(code),
    ];

    const hasErrors = issues.some(issue => issue.severity === 'error');

    const result: ValidationResult = {
      valid: !hasErrors,
      issues,
    };

    validationCache.set(`motoko:${code}`, result);
    return result;

  } catch (error: any) {
    logger.error('Pattern validation error:', error);
    return {
      valid: false,
      issues: [{
        severity: 'error',
        message: `Validation failed: ${error.message}`,
      }],
    };
  }
}

// Keep all existing pattern checking functions
// (checkActorStructure, checkStableVariables, etc.)
```

---

## 🧪 Phase 2: Testing (2 hours)

### Unit Tests (1 hour)

**File:** `test/validators/motoko-compiler.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest';
import {
  findMocPath,
  findBasePath,
  parseMocErrors,
  compileMotokoCode,
} from '../../src/validators/motoko-compiler.js';

describe('motoko-compiler', () => {
  describe('findMocPath', () => {
    it('finds moc via dfx cache', async () => {
      const path = await findMocPath();
      expect(path).toBeTruthy();
      expect(path).toContain('moc');
    });

    it('caches result', async () => {
      const path1 = await findMocPath();
      const path2 = await findMocPath();
      expect(path1).toBe(path2);
    });
  });

  describe('parseMocErrors', () => {
    it('parses single-line error', () => {
      const stderr = '/tmp/test.mo:5.5-5.15: type error [M0057], unbound variable unknownVar';
      const errors = parseMocErrors(stderr);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        severity: 'error',
        code: 'M0057',
        line: 5,
        column: 5,
        message: 'unbound variable unknownVar',
      });
    });

    it('parses multi-line error', () => {
      const stderr = `/tmp/test.mo:4.20-4.21: type error [M0096], expression of type
  Nat
cannot produce expected type
  Text`;
      const errors = parseMocErrors(stderr);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Nat');
      expect(errors[0].message).toContain('Text');
    });

    it('parses multiple errors', () => {
      const stderr = `/tmp/test.mo:5.5-5.15: type error [M0057], unbound variable unknownVar
/tmp/test.mo:9.5-9.12: type error [M0050], literal of type
  Text
does not have expected type
  Nat`;
      const errors = parseMocErrors(stderr);
      
      expect(errors).toHaveLength(2);
    });
  });

  describe('compileMotokoCode', () => {
    it('compiles valid code', async () => {
      const code = 'actor { stable var counter : Nat = 0; }';
      const result = await compileMotokoCode(code);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('catches type error', async () => {
      const code = `
        actor {
          public func test() : async Text {
            5
          };
        }
      `;
      const result = await compileMotokoCode(code);
      
      expect(result.valid).toBe(false);
      expect(result.issues[0].code).toBe('M0096');
    });
  });
});
```

---

### Integration Tests (1 hour)

**File:** `test/validators/motoko.integration.test.ts`

Run all the test scenarios from EDGE-CASES-AND-TESTS.md

---

## ✨ Phase 3: Polish (2 hours)

### Step 1: Documentation (1 hour)

Update:
- README.md (prerequisites section)
- CHANGELOG.md (v0.3.0 entry)
- package.json (version bump)

### Step 2: Performance Testing (30 min)

- Measure compilation time vs pattern matching
- Verify caching effectiveness
- Test with large files

### Step 3: Final QA (30 min)

- Run all tests
- Manual testing with Claude Code
- Fix any issues
- Create git commit

---

## 🚢 Deployment

```bash
# Build
npm run build

# Run tests
npm test

# Update version
npm version minor  # 0.2.0 -> 0.3.0

# Commit
git add .
git commit -m "feat: Add real Motoko compilation with moc

- Integrate moc compiler for type-checking
- Fallback to pattern matching when moc unavailable
- Support imports with --package flag
- Parse multi-line compiler errors
- Cache compilation results
- Backwards compatible with v0.2.0

Closes #real-compilation"

# Tag
git tag v0.3.0

# Push (when ready)
git push origin main --tags
```

---

## 📊 Success Metrics

**Before (v0.2.0):**
- Motoko validation: Pattern matching ⭐⭐
- Type safety: None
- Error messages: Generic warnings

**After (v0.3.0):**
- Motoko validation: Real compilation ⭐⭐⭐⭐⭐
- Type safety: Full type checking
- Error messages: Exact compiler errors with line/column

**Value increase:** From "linter" to "compiler-in-the-loop"

---

**Ready to start coding?** 🚀
