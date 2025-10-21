/**
 * dfx.json validation
 * Checks configuration structure and common issues
 */

import type { ValidationIssue, ValidationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { validationCache } from '../utils/cache.js';

interface DfxConfig {
  version?: number;
  canisters?: Record<string, CanisterConfig>;
  defaults?: {
    build?: {
      args?: string;
      packtool?: string;
    };
  };
  networks?: Record<string, NetworkConfig>;
}

interface CanisterConfig {
  type?: string;
  main?: string;
  candid?: string;
  frontend?: any;
  dependencies?: string[];
  build?: string | string[];
  args?: string;
  gzip?: boolean;
  prebuild?: string | string[];
  post_install?: string | string[];
}

interface NetworkConfig {
  providers?: string[];
  type?: string;
  bind?: string;
}

/**
 * Validate JSON structure
 */
function validateStructure(config: DfxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check version field
  if (!config.version) {
    issues.push({
      severity: 'warning',
      message: 'Missing version field',
      suggestion: 'Add "version": 1 to specify dfx.json format version',
      docUrl: 'https://internetcomputer.org/docs/current/developer-docs/getting-started/install/',
    });
  }

  // Check canisters field
  if (!config.canisters || Object.keys(config.canisters).length === 0) {
    issues.push({
      severity: 'error',
      message: 'Missing or empty canisters field',
      suggestion: 'dfx.json must define at least one canister',
      docUrl: 'https://internetcomputer.org/docs/current/references/cli-reference/dfx-json-reference',
    });
  }

  return issues;
}

/**
 * Validate canister configurations
 */
function validateCanisters(canisters: Record<string, CanisterConfig>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [name, config] of Object.entries(canisters)) {
    // Check canister type
    if (!config.type) {
      issues.push({
        severity: 'error',
        message: `Canister "${name}" missing type field`,
        suggestion: 'Specify type: "motoko", "rust", "custom", or "assets"',
        docUrl: 'https://internetcomputer.org/docs/current/references/cli-reference/dfx-json-reference',
      });
      continue;
    }

    // Validate based on type
    switch (config.type) {
      case 'motoko':
        if (!config.main) {
          issues.push({
            severity: 'error',
            message: `Motoko canister "${name}" missing main field`,
            suggestion: 'Add "main": "src/main.mo" pointing to your Motoko source file',
          });
        } else if (!config.main.endsWith('.mo')) {
          issues.push({
            severity: 'warning',
            message: `Motoko main file "${config.main}" should have .mo extension`,
          });
        }
        break;

      case 'rust':
        if (!config.candid) {
          issues.push({
            severity: 'warning',
            message: `Rust canister "${name}" missing candid field`,
            suggestion: 'Add "candid": "src/canister.did" to specify the Candid interface',
          });
        }
        break;

      case 'assets':
        if (!config.frontend) {
          issues.push({
            severity: 'warning',
            message: `Assets canister "${name}" missing frontend configuration`,
            suggestion: 'Add frontend.entrypoint to specify the HTML file',
          });
        }
        break;

      case 'custom':
        if (!config.build) {
          issues.push({
            severity: 'error',
            message: `Custom canister "${name}" missing build field`,
            suggestion: 'Add "build": "..." with build command(s)',
          });
        }
        if (!config.candid) {
          issues.push({
            severity: 'error',
            message: `Custom canister "${name}" missing candid field`,
            suggestion: 'Add "candid": "path/to/interface.did"',
          });
        }
        break;
    }

    // Check for common path issues
    if (config.main && config.main.includes('\\')) {
      issues.push({
        severity: 'error',
        message: `Canister "${name}" main path uses backslashes`,
        suggestion: 'Use forward slashes for cross-platform compatibility',
      });
    }
  }

  return issues;
}

/**
 * Validate network configurations
 */
function validateNetworks(networks?: Record<string, NetworkConfig>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!networks) {
    return issues;
  }

  // Check for mainnet config
  if (networks.ic) {
    const icConfig = networks.ic;

    if (!icConfig.providers || icConfig.providers.length === 0) {
      issues.push({
        severity: 'warning',
        message: 'Mainnet (ic) network missing providers',
        suggestion: 'Add providers: ["https://ic0.app"] for mainnet deployment',
      });
    }
  }

  // Check local network config
  if (networks.local) {
    const localConfig = networks.local;

    if (localConfig.bind && !localConfig.bind.startsWith('127.0.0.1')) {
      issues.push({
        severity: 'warning',
        message: 'Local network bind address not localhost',
        suggestion: 'Use 127.0.0.1 for local development',
      });
    }
  }

  return issues;
}

/**
 * Check for common misconfigurations
 */
function checkCommonIssues(config: DfxConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for circular dependencies
  if (config.canisters) {
    const dependencies = new Map<string, string[]>();

    for (const [name, canister] of Object.entries(config.canisters)) {
      if (canister.dependencies) {
        dependencies.set(name, canister.dependencies);

        // Check if dependencies exist
        for (const dep of canister.dependencies) {
          if (!config.canisters[dep]) {
            issues.push({
              severity: 'error',
              message: `Canister "${name}" depends on undefined canister "${dep}"`,
              suggestion: `Define canister "${dep}" or remove from dependencies`,
            });
          }
        }
      }
    }

    // Simple circular dependency check
    for (const [name, deps] of dependencies) {
      for (const dep of deps) {
        const depDeps = dependencies.get(dep);
        if (depDeps?.includes(name)) {
          issues.push({
            severity: 'error',
            message: `Circular dependency between "${name}" and "${dep}"`,
            suggestion: 'Remove circular dependency to allow proper build order',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Validate dfx.json configuration
 */
export async function validateDfxJson(code: string): Promise<ValidationResult> {
  // Check cache
  const cacheKey = `dfx-json:${code}`;
  const cached = validationCache.get(cacheKey);
  if (cached) {
    logger.debug('Using cached dfx.json validation result');
    return cached;
  }

  try {
    // Parse JSON
    let config: DfxConfig;
    try {
      config = JSON.parse(code);
    } catch (error: any) {
      return {
        valid: false,
        issues: [
          {
            severity: 'error',
            message: `Invalid JSON: ${error.message}`,
            suggestion: 'Fix JSON syntax errors',
          },
        ],
      };
    }

    const issues: ValidationIssue[] = [
      ...validateStructure(config),
      ...validateCanisters(config.canisters || {}),
      ...validateNetworks(config.networks),
      ...checkCommonIssues(config),
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
    logger.error('dfx.json validation error:', error);

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
