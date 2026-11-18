/**
 * Motoko validation: compiler check plus source checks taken from the
 * writing-motoko skill (https://skills.internetcomputer.org/skills/writing-motoko/).
 */

import type { ValidationResult, ValidationIssue } from '../types/index.js';
import { compileMotokoCode } from './motoko-compiler.js';
import { checkMotokoSecurity, checkHttpsOutcalls } from './security-patterns.js';
import { lintEngineRules } from './engine-rules.js';
import { logger } from '../utils/logger.js';
import { validationCache, generateCacheKey } from '../utils/cache.js';
import { REFS } from '../data/references.js';

function lineOf(code: string, index: number): number {
  return code.substring(0, index).split('\n').length;
}

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
}

/**
 * Source checks for patterns the writing-motoko skill rules out.
 * The compiler remains the authority on what compiles.
 */
export function checkBestPractices(rawCode: string): ValidationIssue[] {
  const code = stripComments(rawCode);
  const issues: ValidationIssue[] = [];
  let match: RegExpExecArray | null;

  const moBase = /import\s+\w+\s+["']mo:base\/(\w+)["']/g;
  while ((match = moBase.exec(code)) !== null) {
    issues.push({
      severity: 'warning',
      line: lineOf(code, match.index),
      message: `mo:base is deprecated; import from mo:core instead (mo:base/${match[1]}).`,
      suggestedFix: match[1] === 'Buffer' ? 'import List "mo:core/List";' : `import ${match[1]} "mo:core/${match[1]}";`,
      references: [REFS.writingMotoko],
    });
  }

  const vals = /\.vals\(\)/g;
  while ((match = vals.exec(code)) !== null) {
    issues.push({
      severity: 'warning',
      line: lineOf(code, match.index),
      message: '`.vals()` is the deprecated mo:base iterator name; use `.values()`. It fails on core collections (M0072) and warns on arrays (M0269).',
      suggestedFix: '.values()',
      references: [REFS.writingMotoko],
    });
  }

  const stable = /\bstable\s+(var|let)\b/g;
  while ((match = stable.exec(code)) !== null) {
    issues.push({
      severity: 'warning',
      line: lineOf(code, match.index),
      message: 'The `stable` keyword is not needed: actor state persists under enhanced orthogonal persistence.',
      suggestedFix: match[1],
      references: [REFS.writingMotoko, REFS.migratingMotokoActors],
    });
  }

  const hooks = /system\s+func\s+(preupgrade|postupgrade)\b/g;
  while ((match = hooks.exec(code)) !== null) {
    issues.push({
      severity: 'warning',
      line: lineOf(code, match.index),
      message: `\`system func ${match[1]}\` is not needed with enhanced orthogonal persistence. State shape changes go through the mops-managed migration chain.`,
      references: [REFS.migratingMotokoActors],
    });
  }

  const actorMigration = /\(\s*with\s+migration\s*=/g;
  while ((match = actorMigration.exec(code)) !== null) {
    issues.push({
      severity: 'warning',
      line: lineOf(code, match.index),
      message: 'Actor-attached `(with migration = ...)` is replaced by the mops-managed migration chain in migrations/.',
      references: [REFS.migratingMotokoActors],
    });
  }

  return issues;
}

export interface MotokoValidationContext {
  securityCheck?: boolean;
  bestPractices?: boolean;
  /** Also apply cloud engine call rules. */
  engine?: boolean;
  /** Project directory with mops.toml; checks run with that project's toolchain. */
  projectPath?: string;
  /** Canister name in mops.toml [canisters] when projectPath is given. */
  canister?: string;
  /** moc version for snippet checks outside a project. */
  mocVersion?: string;
}

export async function validateMotoko(code: string, context: MotokoValidationContext = {}): Promise<ValidationResult> {
  const securityCheck = context.securityCheck ?? false;
  const bestPractices = context.bestPractices ?? true;
  const engine = context.engine ?? false;

  const cacheKey = generateCacheKey('motoko-validate:v2', code, {
    securityCheck,
    bestPractices,
    engine,
    projectPath: context.projectPath,
    canister: context.canister,
    mocVersion: context.mocVersion,
  });
  // Project checks read files on disk, so only snippet results are cached.
  const cached = context.projectPath ? null : validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached Motoko validation result');
    return cached;
  }

  const result = await compileMotokoCode(code, {
    projectPath: context.projectPath,
    canister: context.canister,
    mocVersion: context.mocVersion,
  });

  if (securityCheck) {
    result.issues.push(...checkMotokoSecurity(code), ...checkHttpsOutcalls(code));
  }
  if (bestPractices) {
    result.issues.push(...checkBestPractices(code));
  }
  if (engine) {
    const engineIssues = lintEngineRules(code, 'motoko');
    result.issues.push(...engineIssues);
    if (engineIssues.some(i => i.severity === 'error')) {
      result.valid = false;
    }
  }

  if (!context.projectPath) {
    validationCache.set(cacheKey, result, 60 * 1000);
  }
  return result;
}
