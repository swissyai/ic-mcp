/**
 * Process execution for icp-cli, mops and other toolchain binaries.
 *
 * Commands are argument arrays passed to spawn without a shell, so no value is
 * ever interpreted by a shell. stdin is closed: a command that would prompt
 * fails instead of waiting (icp-cli aborts a breaking deploy with "Use --yes").
 */

import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export interface CommandSpec {
  program: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface CommandResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  notFound: boolean;
  command: string;
}

const MAX_OUTPUT = 2 * 1024 * 1024;

/** Quote an argument for display only. Commands never run through a shell. */
export function quoteArg(arg: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function displayCommand(program: string, args: string[]): string {
  return [program, ...args].map(quoteArg).join(' ');
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

async function spawnCommand(spec: CommandSpec): Promise<CommandResult> {
  const command = displayCommand(spec.program, spec.args);
  logger.debug(`Running: ${command}`, { cwd: spec.cwd });
  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const finish = (result: Omit<CommandResult, 'command' | 'stdout' | 'stderr'>) => {
      if (settled) return;
      settled = true;
      resolve({ ...result, stdout: stripAnsi(stdout).trim(), stderr: stripAnsi(stderr).trim(), command });
    };

    const child = spawn(spec.program, spec.args, {
      cwd: spec.cwd,
      env: { ...process.env, ...(spec.env || {}) },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    }, spec.timeoutMs ?? 120_000);

    child.stdout?.on('data', chunk => {
      if (stdout.length < MAX_OUTPUT) stdout += chunk.toString();
    });
    child.stderr?.on('data', chunk => {
      if (stderr.length < MAX_OUTPUT) stderr += chunk.toString();
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      stderr += error.message;
      finish({ ok: false, exitCode: null, timedOut, notFound: error.code === 'ENOENT' });
    });
    child.on('close', code => {
      clearTimeout(timer);
      finish({ ok: code === 0 && !timedOut, exitCode: code, timedOut, notFound: false });
    });
  });
}

export type CommandRunner = (spec: CommandSpec) => Promise<CommandResult>;

let runner: CommandRunner = spawnCommand;

/** Run a command through the active runner. */
export function runCommand(spec: CommandSpec): Promise<CommandResult> {
  return runner(spec);
}

/** Replace the command runner (used by tests). Returns the previous one. */
export function setCommandRunner(next: CommandRunner): CommandRunner {
  const previous = runner;
  runner = next;
  return previous;
}

export class InvalidArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidArgumentError';
  }
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PRINCIPAL = /^[a-z0-9]{1,5}(-[a-z0-9]{1,5})+$/;
const METHOD = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const ENGINE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(\/[A-Za-z0-9][A-Za-z0-9._-]{0,127})?$/;
const CYCLES = /^\d+(?:[._]\d+)*[kmbt]?$/i;

/** Canister, environment, identity, network or template name. */
export function checkName(value: string, kind: string): string {
  if (!NAME.test(value)) {
    throw new InvalidArgumentError(`Invalid ${kind} "${value}": use letters, digits, ".", "_" or "-", not starting with "-".`);
  }
  return value;
}

/** Canister name or principal. */
export function checkCanister(value: string): string {
  if (NAME.test(value) || PRINCIPAL.test(value)) return value;
  throw new InvalidArgumentError(`Invalid canister "${value}": expected a canister name from icp.yaml or a principal.`);
}

export function checkPrincipal(value: string, kind: string): string {
  if (!PRINCIPAL.test(value)) throw new InvalidArgumentError(`Invalid ${kind} "${value}": expected a principal.`);
  return value;
}

export function checkMethod(value: string): string {
  if (!METHOD.test(value)) throw new InvalidArgumentError(`Invalid method name "${value}".`);
  return value;
}

/** Engine name, `name/slug`, or an id. */
export function checkEngine(value: string): string {
  if (ENGINE.test(value) || PRINCIPAL.test(value)) return value;
  throw new InvalidArgumentError(`Invalid engine "${value}": expected a name, name/slug, or id.`);
}

export function checkCycles(value: string): string {
  if (!CYCLES.test(value)) throw new InvalidArgumentError(`Invalid cycles amount "${value}": e.g. 2t, 500b, 1000000000000.`);
  return value;
}

/** Positional values may not look like options. */
export function checkPositional(value: string, kind: string): string {
  if (value.startsWith('-')) throw new InvalidArgumentError(`Invalid ${kind}: may not start with "-".`);
  return value;
}

/** First line of a version string, e.g. "icp 1.8.0" -> "1.8.0". */
export function parseVersion(output: string): string | null {
  return output.match(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/)?.[1] ?? null;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}
