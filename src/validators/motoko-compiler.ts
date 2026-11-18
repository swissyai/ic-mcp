/**
 * Motoko compiler checks through mops (https://skills.internetcomputer.org/skills/mops-cli/).
 *
 * - Project mode: `mops check [canister]` in the directory that holds the
 *   project's mops.toml, so the project's pinned moc, dependencies and flags
 *   apply. The files on disk are checked; nothing is modified (no --fix).
 * - Snippet mode: a temporary mops project with the latest moc and mo:core
 *   (or a requested moc version) checks one source file.
 */

import { mkdtemp, writeFile, rm, readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ValidationIssue, ValidationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { runCommand } from '../executors/icp-executor.js';
import { REFS } from '../data/references.js';

export interface CompileContext {
  projectPath?: string;
  canister?: string;
  mocVersion?: string;
}

export interface CompileResult extends ValidationResult {
  toolchain?: { mode: 'project' | 'snippet'; moc?: string; core?: string; directory?: string };
}

/**
 * Parse moc diagnostics: `file:line.col-line.col: severity [CODE], message`
 * followed by indented continuation lines.
 */
export function parseMocErrors(output: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let current: ValidationIssue | null = null;
  for (const line of output.split('\n')) {
    const start = line.match(/^(.+?):(\d+)\.(\d+)-\d+\.\d+:\s+([a-z ]+?)\s+\[([A-Z0-9]+)\],\s+(.*)$/);
    if (start) {
      if (current) issues.push(current);
      const raw = start[4].toLowerCase();
      current = {
        severity: raw.includes('warning') ? 'warning' : raw.includes('info') ? 'info' : 'error',
        code: start[5],
        line: Number(start[2]),
        column: Number(start[3]),
        message: start[6].trim(),
        file: start[1],
      } as ValidationIssue;
      continue;
    }
    if (current && /^\s{2,}\S/.test(line)) {
      current.message += `\n${line.trim()}`;
      continue;
    }
    if (current) {
      issues.push(current);
      current = null;
    }
  }
  if (current) issues.push(current);
  return issues;
}

function mopsMissing(): CompileResult {
  return {
    valid: false,
    issues: [
      {
        severity: 'error',
        message: 'mops is not installed. Motoko checks run through the project toolchain.',
        suggestedFix: 'npm install -g ic-mops',
        references: [REFS.mopsCli],
      },
    ],
  };
}

async function mopsAvailable(): Promise<boolean> {
  const result = await runCommand({ program: 'mops', args: ['--version'], timeoutMs: 20_000 });
  return result.ok;
}

let snippetVersions: { moc: string; core: string } | null = null;

async function resolveLatest(): Promise<{ moc: string; core: string }> {
  if (snippetVersions) return snippetVersions;
  const [moc, core] = await Promise.all([
    runCommand({ program: 'mops', args: ['toolchain', 'info', 'moc'], timeoutMs: 30_000 }),
    runCommand({ program: 'mops', args: ['info', 'core'], timeoutMs: 30_000 }),
  ]);
  const mocVersion = moc.stdout.match(/latest:\s*(\d+\.\d+\.\d+)/)?.[1];
  const coreVersion = core.stdout.match(/core@(\d+\.\d+\.\d+)/)?.[1];
  if (!mocVersion || !coreVersion) {
    throw new Error(
      `Could not resolve the latest moc and mo:core versions through mops: ${(moc.stderr || core.stderr || '').trim().slice(0, 300)}`
    );
  }
  snippetVersions = { moc: mocVersion, core: coreVersion };
  return snippetVersions;
}

function snippetMopsToml(moc: string, core: string): string {
  const major = Number(moc.split('.')[0]);
  const args = major >= 2 ? '["-W", "M0223,M0236,M0237"]' : '["--default-persistent-actors", "-W", "M0223,M0236,M0237"]';
  return [
    '[toolchain]',
    `moc = "${moc}"`,
    '',
    '[dependencies]',
    `core = "${core}"`,
    '',
    '[moc]',
    `args = ${args}`,
    '',
    '[canisters.snippet]',
    'main = "main.mo"',
    '',
  ].join('\n');
}

function compileOutcome(output: string, exitOk: boolean): ValidationResult {
  const issues = parseMocErrors(output);
  if (!exitOk && !issues.some(i => i.severity === 'error')) {
    const tail = output.trim().split('\n').slice(-6).join('\n');
    issues.push({ severity: 'error', message: `mops check failed: ${tail || 'no output'}` });
  }
  return { valid: exitOk && !issues.some(i => i.severity === 'error'), issues };
}

async function checkSnippet(code: string, mocVersion?: string): Promise<CompileResult> {
  let versions: { moc: string; core: string };
  try {
    const latest = await resolveLatest();
    versions = { moc: mocVersion || latest.moc, core: latest.core };
  } catch (error: any) {
    return { valid: false, issues: [{ severity: 'error', message: error.message, references: [REFS.mopsCli] }] };
  }

  const dir = await mkdtemp(join(tmpdir(), 'ic-mcp-motoko-'));
  try {
    await writeFile(join(dir, 'mops.toml'), snippetMopsToml(versions.moc, versions.core), 'utf-8');
    await writeFile(join(dir, 'main.mo'), code, 'utf-8');
    const result = await runCommand({
      program: 'mops',
      args: ['check', 'snippet', '--no-lint'],
      cwd: dir,
      timeoutMs: 180_000,
    });
    const outcome = compileOutcome(`${result.stdout}\n${result.stderr}`, result.ok);
    for (const issue of outcome.issues) {
      delete (issue as any).file;
      if (issue.code === 'M0010' && /package "base"/.test(issue.message)) {
        issue.suggestedFix = 'mo:base is deprecated; import the module from mo:core.';
        issue.references = [REFS.writingMotoko];
      }
    }
    return { ...outcome, toolchain: { mode: 'snippet', moc: versions.moc, core: versions.core } };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function readMocPin(dir: string): Promise<string | undefined> {
  const text = await readFile(join(dir, 'mops.toml'), 'utf-8').catch(() => '');
  return text.match(/^\s*moc\s*=\s*"([^"]+)"/m)?.[1];
}

/**
 * Locate the directory whose mops.toml covers the project (or one canister).
 */
export async function findMopsProject(projectPath: string, canister?: string): Promise<string | null> {
  const declares = async (dir: string) => {
    const text = await readFile(join(dir, 'mops.toml'), 'utf-8').catch(() => null);
    if (text === null) return false;
    return canister ? new RegExp(`^\\s*\\[canisters\\.\\"?${canister.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\"?\\]`, 'm').test(text) : true;
  };
  if (await declares(projectPath)) return projectPath;
  if (canister && (await declares(join(projectPath, canister)))) return join(projectPath, canister);
  if (!existsSync(projectPath)) return null;
  for (const entry of await readdir(projectPath, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      const dir = join(projectPath, entry.name);
      if (await declares(dir)) return dir;
    }
  }
  return null;
}

async function checkProject(projectPath: string, canister?: string): Promise<CompileResult> {
  const dir = await findMopsProject(projectPath, canister);
  if (!dir) {
    return {
      valid: false,
      issues: [
        {
          severity: 'error',
          message: canister
            ? `No mops.toml declaring [canisters.${canister}] under ${projectPath}.`
            : `No mops.toml under ${projectPath}.`,
          suggestedFix: 'Motoko canisters built with the @dfinity/motoko recipe declare [canisters.<name>] in mops.toml.',
          references: [REFS.mopsCli, REFS.icpCli],
        },
      ],
    };
  }
  const result = await runCommand({
    program: 'mops',
    args: ['check', ...(canister ? [canister] : [])],
    cwd: dir,
    timeoutMs: 300_000,
  });
  const outcome = compileOutcome(`${result.stdout}\n${result.stderr}`, result.ok);
  return { ...outcome, toolchain: { mode: 'project', moc: await readMocPin(dir), directory: dir } };
}

/**
 * Compile-check Motoko. With `projectPath`, checks the project on disk with its
 * own toolchain and `code` is not compiled; otherwise checks `code` as a snippet.
 */
export async function compileMotokoCode(code: string, context: CompileContext = {}): Promise<CompileResult> {
  if (!(await mopsAvailable())) {
    return mopsMissing();
  }
  try {
    return context.projectPath
      ? await checkProject(context.projectPath, context.canister)
      : await checkSnippet(code, context.mocVersion);
  } catch (error: any) {
    logger.error('Motoko check failed to run:', error);
    return { valid: false, issues: [{ severity: 'error', message: `Motoko check failed to run: ${error.message}` }] };
  }
}

export async function checkMocAvailable(): Promise<boolean> {
  return mopsAvailable();
}
