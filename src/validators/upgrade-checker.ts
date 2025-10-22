/**
 * Candid upgrade safety checker
 * Detects breaking changes between old and new Candid interfaces
 */

import { logger } from '../utils/logger.js';

export interface UpgradeChange {
  type: 'added' | 'removed' | 'modified' | 'renamed';
  kind: 'method' | 'type' | 'field';
  name: string;
  breaking: boolean;
  severity: 'safe' | 'warning' | 'breaking';
  description: string;
  oldSignature?: string;
  newSignature?: string;
}

export interface UpgradeCheckResult {
  safe: boolean;
  changes: UpgradeChange[];
  recommendation: string;
  summary: {
    safeChanges: number;
    warnings: number;
    breakingChanges: number;
  };
}

/**
 * Simple Candid method parser
 * Extracts method signatures from Candid service definitions
 */
interface CandidMethod {
  name: string;
  signature: string;
  isQuery: boolean;
}

/**
 * Parse Candid service definition to extract methods
 */
function parseCandidService(candid: string): CandidMethod[] {
  const methods: CandidMethod[] = [];

  // Remove comments
  const cleaned = candid.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

  // Find service block
  const serviceMatch = cleaned.match(/service\s*:\s*\{([^}]+)\}/s);
  if (!serviceMatch) {
    logger.warn('Could not parse Candid service definition');
    return methods;
  }

  const serviceBody = serviceMatch[1];

  // Match method declarations: name : signature query?;
  const methodRegex = /(\w+)\s*:\s*([^;]+?)(query|composite_query)?\s*;/g;
  let match;

  while ((match = methodRegex.exec(serviceBody)) !== null) {
    const [, name, signature, queryModifier] = match;
    methods.push({
      name: name.trim(),
      signature: signature.trim(),
      isQuery: !!queryModifier,
    });
  }

  return methods;
}

/**
 * Normalize Candid type signature for comparison
 */
function normalizeSignature(signature: string): string {
  // Remove extra whitespace
  return signature.replace(/\s+/g, ' ').trim();
}

/**
 * Check if two signatures are compatible
 * Simplified check - in production would use full Candid subtyping rules
 */
function areSignaturesCompatible(oldSig: string, newSig: string): boolean {
  const oldNorm = normalizeSignature(oldSig);
  const newNorm = normalizeSignature(newSig);

  // Exact match is always compatible
  if (oldNorm === newNorm) return true;

  // Check if it's a narrowing (adding opt is safe for args, removing for returns is breaking)
  // This is simplified - full Candid subtyping is more complex

  // For now, treat any signature change as potentially breaking
  return false;
}

/**
 * Check upgrade safety between two Candid interfaces
 */
export function checkUpgradeSafety(
  oldCandid: string,
  newCandid: string
): UpgradeCheckResult {
  logger.debug('Checking upgrade safety');

  const oldMethods = parseCandidService(oldCandid);
  const newMethods = parseCandidService(newCandid);

  const oldMethodMap = new Map(oldMethods.map((m) => [m.name, m]));
  const newMethodMap = new Map(newMethods.map((m) => [m.name, m]));

  const changes: UpgradeChange[] = [];

  // Check for removed methods (BREAKING)
  for (const oldMethod of oldMethods) {
    if (!newMethodMap.has(oldMethod.name)) {
      changes.push({
        type: 'removed',
        kind: 'method',
        name: oldMethod.name,
        breaking: true,
        severity: 'breaking',
        description: `Method '${oldMethod.name}' was removed`,
        oldSignature: oldMethod.signature,
      });
    }
  }

  // Check for added methods (SAFE)
  for (const newMethod of newMethods) {
    if (!oldMethodMap.has(newMethod.name)) {
      changes.push({
        type: 'added',
        kind: 'method',
        name: newMethod.name,
        breaking: false,
        severity: 'safe',
        description: `Method '${newMethod.name}' was added`,
        newSignature: newMethod.signature,
      });
    }
  }

  // Check for modified methods
  for (const newMethod of newMethods) {
    const oldMethod = oldMethodMap.get(newMethod.name);
    if (!oldMethod) continue; // Already handled as added

    // Check signature compatibility
    const compatible = areSignaturesCompatible(
      oldMethod.signature,
      newMethod.signature
    );

    if (!compatible) {
      changes.push({
        type: 'modified',
        kind: 'method',
        name: newMethod.name,
        breaking: true,
        severity: 'breaking',
        description: `Method '${newMethod.name}' signature changed`,
        oldSignature: oldMethod.signature,
        newSignature: newMethod.signature,
      });
    }

    // Check query/update mode change
    if (oldMethod.isQuery !== newMethod.isQuery) {
      const modeChange = oldMethod.isQuery ? 'query → update' : 'update → query';
      changes.push({
        type: 'modified',
        kind: 'method',
        name: newMethod.name,
        breaking: true,
        severity: 'breaking',
        description: `Method '${newMethod.name}' mode changed (${modeChange})`,
        oldSignature: `${oldMethod.signature} ${oldMethod.isQuery ? 'query' : 'update'}`,
        newSignature: `${newMethod.signature} ${newMethod.isQuery ? 'query' : 'update'}`,
      });
    }
  }

  // Calculate summary
  const summary = {
    safeChanges: changes.filter((c) => c.severity === 'safe').length,
    warnings: changes.filter((c) => c.severity === 'warning').length,
    breakingChanges: changes.filter((c) => c.severity === 'breaking').length,
  };

  // Determine overall safety
  const safe = summary.breakingChanges === 0;

  // Generate recommendation
  let recommendation = '';
  if (safe) {
    if (summary.safeChanges === 0) {
      recommendation = 'No changes detected. Upgrade is safe.';
    } else {
      recommendation = `Safe to upgrade. ${summary.safeChanges} non-breaking change(s) detected.`;
    }
  } else {
    recommendation = `⚠️  BREAKING CHANGES DETECTED (${summary.breakingChanges}). This upgrade may break existing clients.`;
  }

  return {
    safe,
    changes,
    recommendation,
    summary,
  };
}

/**
 * Format upgrade check results (token-efficient)
 */
export function formatUpgradeCheck(result: UpgradeCheckResult): string {
  const lines: string[] = [];

  // Status line (always first, most important)
  const icon = result.safe ? '✅' : '❌';
  lines.push(`${icon} ${result.recommendation}\n`);

  // Summary counts
  if (result.changes.length > 0) {
    lines.push(
      `**Changes:** ${result.summary.safeChanges} safe, ${result.summary.warnings} warnings, ${result.summary.breakingChanges} breaking\n`
    );
  }

  // Breaking changes first (most critical)
  const breaking = result.changes.filter((c) => c.severity === 'breaking');
  if (breaking.length > 0) {
    lines.push('**Breaking Changes:**');
    for (const change of breaking) {
      lines.push(`- **${change.name}**: ${change.description}`);
      if (change.oldSignature && change.newSignature) {
        lines.push(`  - Old: \`${change.oldSignature}\``);
        lines.push(`  - New: \`${change.newSignature}\``);
      }
    }
    lines.push('');
  }

  // Safe changes (condensed)
  const safe = result.changes.filter((c) => c.severity === 'safe');
  if (safe.length > 0 && safe.length <= 5) {
    // Only show if few changes
    lines.push('**Safe Changes:**');
    for (const change of safe) {
      lines.push(`- ${change.description}`);
    }
  } else if (safe.length > 5) {
    lines.push(`**Safe Changes:** ${safe.length} methods added`);
  }

  return lines.join('\n');
}
