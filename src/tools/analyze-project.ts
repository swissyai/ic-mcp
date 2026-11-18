/**
 * Project analysis.
 *
 * icp.yaml projects: canisters with their recipes, environments, networks,
 * mops toolchain pins, configuration problems, and optional compiler checks
 * (`mops check` for Motoko, source checks for Rust).
 * dfx.json projects: structure and dependency graph, plus the conversion step.
 */

import { z } from 'zod';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { analyzeProject } from '../analyzers/project.js';
import { buildDependencyGraph, type DependencyGraph } from '../analyzers/dependencies.js';
import { readIcpProject } from '../analyzers/icp-project.js';
import { validateRust } from '../validators/rust.js';
import { compileMotokoCode, findMopsProject } from '../validators/motoko-compiler.js';
import type { ValidationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const analyzeProjectSchema = z.object({
  projectPath: z.string().optional().describe('Project directory (defaults to the server working directory)'),
  validate: z.boolean().optional().describe('Run compiler checks on canisters (default: true)'),
  checkDependencies: z.boolean().optional().describe('dfx projects: build the dependency graph (default: true)'),
});

export type AnalyzeProjectInput = z.infer<typeof analyzeProjectSchema>;

function formatIssues(result: ValidationResult): string[] {
  const lines: string[] = [];
  for (const issue of result.issues.slice(0, 15)) {
    const where = issue.line ? `${issue.file ? `${issue.file}:` : 'line '}${issue.line}: ` : '';
    lines.push(`  - ${issue.severity} ${issue.code ? `[${issue.code}] ` : ''}${where}${issue.message.split('\n')[0]}`);
  }
  if (result.issues.length > 15) lines.push(`  - ... ${result.issues.length - 15} more`);
  return lines;
}

function formatDependencyGraph(graph: DependencyGraph): string {
  const lines: string[] = [];
  lines.push(`Build order: ${graph.buildOrder.join(' -> ') || '(none)'}`);
  if (graph.cycles.length > 0) {
    lines.push('Circular dependencies:');
    for (const cycle of graph.cycles) lines.push(`  - ${cycle.join(' -> ')}`);
  }
  return lines.join('\n');
}

async function analyzeIcp(projectPath: string, shouldValidate: boolean): Promise<string> {
  const project = await readIcpProject(projectPath);
  if (!project) return '';
  const out: string[] = [`# Project: ${projectPath.split('/').pop()}`, '', `Location: ${project.root}`, 'Format: icp.yaml', ''];

  out.push('## Canisters', '');
  for (const canister of project.canisters) {
    let detail = '';
    if (canister.kind === 'motoko') {
      const dir = await findMopsProject(canister.dir, canister.name);
      if (dir) {
        const toml = await readFile(join(dir, 'mops.toml'), 'utf-8').catch(() => '');
        const moc = toml.match(/^\s*moc\s*=\s*"([^"]+)"/m)?.[1];
        detail = ` (mops.toml in ${dir === project.root ? '.' : dir.slice(project.root.length + 1)}${moc ? `, moc ${moc}` : ', moc not pinned'})`;
      } else {
        detail = ' (no mops.toml declares it)';
      }
    }
    out.push(`- ${canister.name}: ${canister.kind}${canister.recipe ? ` via ${canister.recipe}` : ''}${detail}`);
  }

  out.push('', '## Environments', '');
  for (const env of project.environments) {
    out.push(`- ${env.name} -> network ${env.network}${env.canisters ? ` [${env.canisters.join(', ')}]` : ''}`);
  }
  const custom = project.networks.filter(n => n.name !== 'local' && n.name !== 'ic');
  if (custom.length > 0) {
    out.push('', '## Networks', '');
    for (const net of custom) out.push(`- ${net.name}: ${net.mode}${net.url ? ` ${net.url}` : ''}`);
  }

  const problems = [...project.problems];
  for (const canister of project.canisters.filter(c => c.kind === 'motoko')) {
    if (!(await findMopsProject(canister.dir, canister.name))) {
      problems.push(`Motoko canister "${canister.name}" needs [canisters.${canister.name}] in mops.toml.`);
    }
  }
  if (existsSync(join(projectPath, 'dfx.json'))) {
    problems.push('dfx.json is still present; icp-cli ignores it.');
  }

  if (shouldValidate) {
    out.push('', '## Checks', '');
    for (const canister of project.canisters) {
      if (canister.kind === 'motoko') {
        const result = await compileMotokoCode('', { projectPath: canister.dir, canister: canister.name });
        out.push(`${canister.name}: ${result.valid ? 'passes mops check' : 'fails mops check'}`);
        out.push(...formatIssues(result));
      } else if (canister.kind === 'rust') {
        const lib = [join(canister.dir, 'src', 'lib.rs'), join(canister.dir, canister.name, 'src', 'lib.rs')].find(p => existsSync(p));
        if (lib) {
          const result = await validateRust(await readFile(lib, 'utf-8'));
          out.push(`${canister.name}: Rust source checks on ${lib.slice(project.root.length + 1)}`);
          out.push(...formatIssues(result));
        }
      }
    }
  }

  out.push('', '## Problems', '');
  out.push(...(problems.length > 0 ? problems.map(p => `- ${p}`) : ['- none found']));
  return out.join('\n');
}

export async function executeAnalyzeProject(input: AnalyzeProjectInput): Promise<string> {
  const projectPath = resolve(input.projectPath || process.cwd());
  const shouldValidate = input.validate !== false;
  logger.info(`Analyzing project at: ${projectPath}`);

  if (existsSync(join(projectPath, 'icp.yaml'))) {
    return analyzeIcp(projectPath, shouldValidate);
  }

  const project = await analyzeProject(projectPath);
  if (!project) {
    return `No icp.yaml or dfx.json in ${projectPath}. Create a project with action "new-project".`;
  }

  const out: string[] = [
    `# Project: ${project.name}`,
    '',
    `Location: ${project.path}`,
    'Format: dfx.json (legacy). Convert with action "convert-dfx" to build and deploy with icp-cli.',
    `Canisters: ${project.canisters.length}`,
    `Lines of code: ${project.totalLinesOfCode}`,
    '',
    '## Canisters',
    '',
  ];
  for (const canister of project.canisters) {
    out.push(`- ${canister.name}: ${canister.type}${canister.main ? ` (${canister.main})` : ''}, ${canister.sourceFiles.length} files`);
  }

  if (input.checkDependencies !== false) {
    out.push('', '## Dependencies', '', formatDependencyGraph(await buildDependencyGraph(project)));
  }

  if (shouldValidate) {
    out.push('', '## Checks', '');
    for (const canister of project.canisters) {
      if (canister.type === 'rust' && canister.sourceFiles.length > 0) {
        const lib = canister.sourceFiles.find(f => f.endsWith('lib.rs')) || canister.sourceFiles[0];
        const result = await validateRust(await readFile(resolve(projectPath, lib), 'utf-8'));
        out.push(`${canister.name}: Rust source checks on ${lib}`, ...formatIssues(result));
      } else if (canister.type === 'motoko') {
        out.push(`${canister.name}: Motoko compiler checks run on icp.yaml projects with mops.toml; convert first.`);
      }
    }
  }

  out.push('', '## Problems', '');
  out.push(...(project.issues.length > 0 ? project.issues.map(i => `- ${i.severity}: ${i.message}`) : ['- none found']));
  return out.join('\n');
}
