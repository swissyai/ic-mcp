/**
 * icp/analyze-project tool
 * Analyzes entire ICP project structure, dependencies, and optionally validates all canisters
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { analyzeProject } from '../analyzers/project.js';
import { buildDependencyGraph, type DependencyGraph } from '../analyzers/dependencies.js';
import { validateRust } from '../validators/rust.js';
import { compileMotokoCode, type ActorAlias, type CompilationContext } from '../validators/motoko-compiler.js';
import type { ValidationResult } from '../types/index.js';
import { readFile } from 'fs/promises';
import { logger } from '../utils/logger.js';

/**
 * Input schema
 */
export const analyzeProjectSchema = z.object({
  projectPath: z.string().optional().describe('Path to ICP project (defaults to current directory)'),
  validate: z.boolean().optional().describe('Run validation on all canisters (default: true)'),
  checkDependencies: z.boolean().optional().describe('Analyze canister dependencies (default: true)'),
});

export type AnalyzeProjectInput = z.infer<typeof analyzeProjectSchema>;

/**
 * Tool definition
 */
export const analyzeProjectTool: Tool = {
  name: 'icp/analyze-project',
  description: `Analyze entire ICP project structure.

Returns:
- All canisters with their configurations
- Source file locations and line counts
- Dependency graph and build order
- Circular dependency detection
- Optional validation of all canister code
- Project-level issues and warnings

Use this to:
- Understand multi-canister project architecture
- Detect dependency issues before deployment
- Validate entire project at once
- Get project overview and statistics`,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to ICP project (defaults to current directory)',
      },
      validate: {
        type: 'boolean',
        description: 'Run validation on all canisters (default: true)',
      },
      checkDependencies: {
        type: 'boolean',
        description: 'Analyze canister dependencies (default: true)',
      },
    },
  },
};

/**
 * Validation results for all canisters
 */
interface ProjectValidation {
  [canisterName: string]: ValidationResult;
}

/**
 * Format canister summary
 */
function formatCanisterSummary(canister: any): string {
  const lines = [
    `**${canister.name}** (${canister.type})`,
    `  Files: ${canister.sourceFiles.length}`,
    `  Lines: ${canister.linesOfCode}`,
  ];

  if (canister.main) {
    lines.push(`  Main: ${canister.main}`);
  }

  if (canister.dependencies.length > 0) {
    lines.push(`  Dependencies: ${canister.dependencies.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Format dependency graph
 */
function formatDependencyGraph(graph: DependencyGraph): string {
  const lines: string[] = [];

  if (graph.cycles.length > 0) {
    lines.push('\n**⚠️  CIRCULAR DEPENDENCIES DETECTED:**');
    for (const cycle of graph.cycles) {
      lines.push(`  ${cycle.join(' → ')}`);
    }
    lines.push('');
  }

  if (graph.buildOrder.length > 0) {
    lines.push('**Build Order:**');
    lines.push(`  ${graph.buildOrder.join(' → ')}`);
    lines.push('');
  } else if (graph.cycles.length > 0) {
    lines.push('**Build Order:** Cannot determine (circular dependencies exist)');
    lines.push('');
  }

  // Show dependency tree
  lines.push('**Dependency Tree:**');
  for (const node of graph.nodes) {
    if (node.dependencies.length === 0) {
      lines.push(`  ${node.name} (no dependencies)`);
    } else {
      lines.push(`  ${node.name} → ${node.dependencies.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format validation results
 */
function formatValidation(validation: ProjectValidation): string {
  const lines: string[] = ['\n**Validation Results:**'];

  let totalIssues = 0;
  let validCount = 0;

  for (const [name, result] of Object.entries(validation)) {
    const status = result.valid ? '✅' : '❌';
    const issueCount = result.issues.length;
    totalIssues += issueCount;

    if (result.valid) {
      validCount++;
      lines.push(`  ${status} ${name}: Valid`);
    } else {
      lines.push(`  ${status} ${name}: ${issueCount} issue(s)`);

      // Show first 3 issues
      for (const issue of result.issues.slice(0, 3)) {
        const location = issue.line ? `:${issue.line}` : '';
        lines.push(`      ${issue.severity}: ${issue.message}${location}`);
      }

      if (result.issues.length > 3) {
        lines.push(`      ... and ${result.issues.length - 3} more`);
      }
    }
  }

  lines.push(`\n**Summary:** ${validCount}/${Object.keys(validation).length} canisters valid, ${totalIssues} total issues`);

  return lines.join('\n');
}

/**
 * Format project issues
 */
function formatProjectIssues(issues: any[]): string {
  if (issues.length === 0) {
    return '\n**✅ No project-level issues detected**';
  }

  const lines: string[] = ['\n**Project Issues:**'];

  for (const issue of issues) {
    const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
    lines.push(`  ${icon} ${issue.message}`);
  }

  return lines.join('\n');
}

/**
 * Build actor aliases from project canisters
 */
function buildActorAliases(project: any, excludeCanister?: string): ActorAlias[] {
  const aliases: ActorAlias[] = [];

  for (const canister of project.canisters) {
    // Don't include the canister we're validating
    if (canister.name === excludeCanister) continue;

    // Only include canisters with Candid interfaces
    if (canister.candid) {
      aliases.push({
        name: canister.name,
        candidPath: canister.candid,
      });
    }
  }

  return aliases;
}

/**
 * Execute analyze-project tool
 */
export async function executeAnalyzeProject(input: AnalyzeProjectInput): Promise<string> {
  const projectPath = input.projectPath || process.cwd();
  const shouldValidate = input.validate !== false;
  const shouldCheckDeps = input.checkDependencies !== false;

  logger.info(`Analyzing project at: ${projectPath}`);

  // Analyze project structure
  const project = await analyzeProject(projectPath);

  if (!project) {
    return 'Error: dfx.json not found or invalid. Are you in an ICP project directory?';
  }

  // Build output
  const output: string[] = [];

  output.push(`# Project Analysis: ${project.name}`);
  output.push(`\n**Location:** ${project.path}`);
  output.push(`**dfx Version:** ${project.dfxConfig.dfx || 'not specified'}`);
  output.push(`**Canisters:** ${project.canisters.length}`);
  output.push(`**Total Lines of Code:** ${project.totalLinesOfCode}`);

  if (project.networks.length > 0) {
    output.push(`**Networks:** ${project.networks.join(', ')}`);
  }

  // Canister details
  output.push('\n## Canisters\n');
  for (const canister of project.canisters) {
    output.push(formatCanisterSummary(canister));
    output.push('');
  }

  // Dependency analysis
  if (shouldCheckDeps) {
    output.push('\n## Dependency Analysis\n');
    const graph = await buildDependencyGraph(project);
    output.push(formatDependencyGraph(graph));
  }

  // Validation
  if (shouldValidate) {
    const validation: ProjectValidation = {};

    for (const canister of project.canisters) {
      // Only validate Motoko and Rust canisters
      if (canister.type === 'motoko' && canister.mainPath) {
        try {
          const code = await readFile(canister.mainPath, 'utf-8');

          // Build actor aliases for this canister's dependencies
          const actorAliases = buildActorAliases(project, canister.name);
          const context: CompilationContext = {
            actorAliases,
            projectPath,
          };

          validation[canister.name] = await compileMotokoCode(code, context);
        } catch (error: any) {
          validation[canister.name] = {
            valid: false,
            issues: [{
              severity: 'error',
              message: `Failed to read main file: ${error.message}`,
            }],
          };
        }
      } else if (canister.type === 'rust' && canister.mainPath) {
        try {
          const code = await readFile(canister.mainPath, 'utf-8');
          validation[canister.name] = await validateRust(code);
        } catch (error: any) {
          validation[canister.name] = {
            valid: false,
            issues: [{
              severity: 'error',
              message: `Failed to read main file: ${error.message}`,
            }],
          };
        }
      }
    }

    if (Object.keys(validation).length > 0) {
      output.push(formatValidation(validation));
    }
  }

  // Project issues
  output.push(formatProjectIssues(project.issues));

  return output.join('\n');
}
