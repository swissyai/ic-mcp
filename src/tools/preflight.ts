/**
 * Preflight: what is installed, who the CLI signs as, what the project looks
 * like, whether its local network runs, and the one next step to take.
 *
 * Local checks only by default. With `checkMainnet`, two read-only mainnet
 * queries run as the active identity: the cycles balance, and the engines the
 * identity can see (through the engine registry named in the OpenCloud
 * console's /.well-known/ic-architecture manifest).
 */

import { z } from 'zod';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { runCommand, parseVersion, compareVersions } from '../executors/icp-executor.js';
import { readIcpProject, type IcpProject } from '../analyzers/icp-project.js';
import { findMopsProject } from '../validators/motoko-compiler.js';
import { currentIdentity, ANONYMOUS_PRINCIPAL, type IdentityInfo } from './icp-ops.js';
import { getUserAgent } from '../utils/version.js';

export const PreflightContextSchema = z.object({
  projectPath: z.string().optional().describe('Project directory (default: server working directory)'),
  target: z.enum(['local', 'mainnet', 'engine']).optional().describe('Where the user wants to deploy (default local)'),
  engine: z.string().optional().describe('Cloud engine name, when target is engine'),
  checkMainnet: z.boolean().optional().describe('Run read-only mainnet queries: cycles balance and visible engines (default false)'),
  checkLatest: z.boolean().optional().describe('Compare installed versions with the npm registry (default true)'),
});

export type PreflightContext = z.infer<typeof PreflightContextSchema>;

export const ENGINE_CONSOLE = 'https://opencloud.org';
const ENGINE_MANIFEST = 'https://opencloud.org/.well-known/ic-architecture';

export interface ToolStatus {
  name: string;
  installed: boolean;
  version?: string;
  latest?: string;
  outdated?: boolean;
  install?: string;
  note?: string;
}

export interface PreflightReport {
  target: 'local' | 'mainnet' | 'engine';
  tools: ToolStatus[];
  engineFlag?: boolean;
  identity: (IdentityInfo & { count?: number }) | null;
  project: {
    path: string;
    kind: 'icp' | 'dfx' | 'none';
    canisters?: Array<{ name: string; kind: string }>;
    environments?: string[];
    problems: string[];
    motokoWithoutMops?: string[];
    rustCanisters?: boolean;
    mocPins?: Record<string, string | undefined>;
    icpDataIgnored?: boolean;
    mainnetIds?: boolean;
  };
  network?: { running: boolean; gatewayUrl?: string };
  mainnet?: {
    cycles?: { balance?: string; error?: string };
    engines?: { names?: string[]; registry?: string; error?: string; note: string };
  };
  engineBalance: string;
  issues: string[];
  nextStep: { summary: string; command?: string; action?: { action: string; context: Record<string, any> } };
}

const NPM_PACKAGES: Record<string, string> = {
  icp: '@icp-sdk/icp-cli',
  'ic-wasm': '@icp-sdk/ic-wasm',
  mops: 'ic-mops',
};

async function latestNpmVersion(pkg: string): Promise<string | undefined> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${pkg.replace('/', '%2F')}/latest`, {
      headers: { 'User-Agent': getUserAgent(), Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return undefined;
    const data: any = await response.json();
    return typeof data.version === 'string' ? data.version : undefined;
  } catch {
    return undefined;
  }
}

async function toolVersion(program: string, args: string[] = ['--version'], cwd?: string): Promise<{ installed: boolean; version?: string }> {
  const result = await runCommand({ program, args, cwd, timeoutMs: 20_000 });
  if (result.notFound) return { installed: false };
  return { installed: result.ok, version: parseVersion(`${result.stdout}\n${result.stderr}`) ?? undefined };
}

function gitignoreHidesIcpData(text: string): boolean {
  return text
    .split('\n')
    .map(l => l.trim())
    .some(l => /^\/?\.icp\/?$/.test(l) || /^\/?\.icp\/data\/?$/.test(l) || l === '.icp/*' || l === '/.icp/*');
}

async function inspectProject(path: string): Promise<{ report: PreflightReport['project']; project: IcpProject | null }> {
  const project = await readIcpProject(path);
  if (!project) {
    return {
      project: null,
      report: { path, kind: existsSync(join(path, 'dfx.json')) ? 'dfx' : 'none', problems: [] },
    };
  }
  const motoko = project.canisters.filter(c => c.kind === 'motoko');
  const mocPins: Record<string, string | undefined> = {};
  const motokoWithoutMops: string[] = [];
  for (const canister of motoko) {
    const dir = await findMopsProject(canister.dir, canister.name);
    if (!dir) {
      motokoWithoutMops.push(canister.name);
    } else {
      const text = await readFile(join(dir, 'mops.toml'), 'utf-8').catch(() => '');
      mocPins[canister.name] = text.match(/^\s*moc\s*=\s*"([^"]+)"/m)?.[1];
    }
  }
  const gitignore = await readFile(join(path, '.gitignore'), 'utf-8').catch(() => '');
  return {
    project,
    report: {
      path,
      kind: 'icp',
      canisters: project.canisters.map(c => ({ name: c.name, kind: c.kind })),
      environments: project.environments.map(e => e.name),
      problems: project.problems,
      ...(motoko.length > 0 ? { mocPins } : {}),
      ...(motokoWithoutMops.length > 0 ? { motokoWithoutMops } : {}),
      rustCanisters: project.canisters.some(c => c.kind === 'rust'),
      icpDataIgnored: gitignoreHidesIcpData(gitignore),
      mainnetIds: existsSync(join(path, '.icp', 'data', 'mappings', 'ic.ids.json')),
    },
  };
}

async function visibleEngines(cwd: string): Promise<NonNullable<PreflightReport['mainnet']>['engines']> {
  const note =
    'Read-only query to the engine registry as the active identity. It lists engines the identity owns or is a member of; it must be the identity linked with --app opencloud.org.';
  let registry: string | undefined;
  try {
    const response = await fetch(ENGINE_MANIFEST, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
    const manifest: any = await response.json();
    registry = (manifest.canisters || []).find((c: any) => /engine registry/i.test(String(c.role || '')))?.id;
  } catch (error: any) {
    return { error: `Could not read ${ENGINE_MANIFEST}: ${error?.message || error}`, note };
  }
  if (!registry) {
    return { error: `${ENGINE_MANIFEST} names no engine registry canister.`, note };
  }
  const result = await runCommand({
    program: 'icp',
    args: ['canister', 'call', registry, 'listMyEngines', '()', '-n', 'ic', '--query', '--json'],
    cwd,
    timeoutMs: 60_000,
  });
  if (!result.ok) {
    return { registry, error: (result.stderr || result.stdout).trim().split('\n').slice(-3).join(' '), note };
  }
  let text = result.stdout;
  try {
    text = JSON.parse(result.stdout).response_candid ?? text;
  } catch {
    // keep raw output
  }
  const names = [...String(text).matchAll(/\bname\s*=\s*"([^"]+)"/g)].map(m => m[1]);
  return { registry, names: [...new Set(names)], note };
}

/**
 * Choose the single next step from a report. Pure, so it is unit-tested.
 */
export function computeNextStep(report: Omit<PreflightReport, 'nextStep'>, engine?: string): PreflightReport['nextStep'] {
  const tool = (name: string) => report.tools.find(t => t.name === name);
  const path = report.project.path;
  const install = 'npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm';

  if (!tool('icp')?.installed || !tool('ic-wasm')?.installed) {
    return { summary: 'Install icp-cli and ic-wasm.', command: install };
  }
  const motokoLikely = report.project.kind !== 'icp' || (report.project.canisters || []).some(c => c.kind === 'motoko');
  if (motokoLikely && !tool('mops')?.installed) {
    return { summary: 'Install mops, the Motoko toolchain manager.', command: 'npm install -g ic-mops' };
  }
  const rustTarget = tool('wasm32-unknown-unknown');
  if (report.project.rustCanisters && rustTarget && !rustTarget.installed) {
    return { summary: 'Add the Rust wasm target.', command: 'rustup target add wasm32-unknown-unknown' };
  }
  if (report.project.kind === 'none') {
    return {
      summary: 'Create a project.',
      command: 'icp new my-app --subfolder hello-world --silent',
      action: { action: 'new-project', context: { name: 'my-app', template: 'hello-world' } },
    };
  }
  if (report.project.kind === 'dfx') {
    return {
      summary: 'Convert dfx.json to icp.yaml.',
      action: { action: 'convert-dfx', context: { projectPath: path, write: true } },
    };
  }
  if (report.project.problems.length > 0) {
    return { summary: `Fix icp.yaml: ${report.project.problems[0]}` };
  }
  if (report.project.motokoWithoutMops && report.project.motokoWithoutMops.length > 0) {
    const name = report.project.motokoWithoutMops[0];
    return { summary: `Add [canisters.${name}] with its main file to mops.toml; the Motoko recipe builds with mops.` };
  }

  const anonymous = !report.identity || report.identity.anonymous || report.identity.principal === ANONYMOUS_PRINCIPAL;
  if (report.target === 'engine') {
    if (report.engineFlag === false) {
      return { summary: 'Update icp-cli: --engine needs 1.7 or later.', command: 'npm install -g @icp-sdk/icp-cli' };
    }
    if (anonymous) {
      return {
        summary: 'Link the identity that administers the engine (the user completes Internet Identity sign-in in the browser), then make it the default.',
        command: "printf '\\n' | icp identity link web <name> --app opencloud.org && icp identity default <name>",
      };
    }
    if (!engine) {
      return { summary: 'Ask the user for the engine name shown in the console at https://opencloud.org.' };
    }
    return {
      summary: `Deploy to engine "${engine}" after the user confirms the plan.`,
      command: `icp deploy -e ic --engine ${engine}`,
      action: { action: 'deploy', context: { projectPath: path, engine } },
    };
  }
  if (report.target === 'mainnet') {
    if (anonymous) {
      return {
        summary: 'Create a named identity for mainnet and make it the default.',
        command: 'icp identity new <name> && icp identity default <name>',
      };
    }
    const balance = report.mainnet?.cycles?.balance;
    if (balance !== undefined && /^0(\D|$)/.test(balance.replace(/_/g, ''))) {
      return {
        summary: 'Fund the identity with cycles: buy by card or convert ICP. Each new canister takes 2T cycles by default.',
        command: 'icp cycles buy --cycles 5t -n ic --no-open --yes --json',
      };
    }
    return {
      summary: 'Deploy to mainnet after the user confirms the plan.',
      command: 'icp deploy -e ic',
      action: { action: 'deploy', context: { projectPath: path, environment: 'ic' } },
    };
  }
  if (report.network && !report.network.running) {
    return {
      summary: "Start the project's local network.",
      command: 'icp network start -d',
      action: { action: 'network-start', context: { projectPath: path } },
    };
  }
  return {
    summary: 'Deploy to the local network.',
    command: 'icp deploy',
    action: { action: 'deploy', context: { projectPath: path } },
  };
}

export async function executePreflight(ctx: PreflightContext): Promise<PreflightReport> {
  const path = resolve(ctx.projectPath || process.cwd());
  const target = ctx.target || 'local';
  const cwd = existsSync(path) ? path : process.cwd();

  const [icp, icWasm, mops, didc, dfx, latest] = await Promise.all([
    toolVersion('icp', ['--version'], cwd),
    toolVersion('ic-wasm', ['--version'], cwd),
    toolVersion('mops', ['--version'], cwd),
    toolVersion('didc', ['--version'], cwd),
    toolVersion('dfx', ['--version'], cwd),
    ctx.checkLatest === false
      ? Promise.resolve({} as Record<string, string | undefined>)
      : Promise.all(Object.entries(NPM_PACKAGES).map(async ([name, pkg]) => [name, await latestNpmVersion(pkg)] as const)).then(
          entries => Object.fromEntries(entries)
        ),
  ]);

  const withLatest = (name: string, status: { installed: boolean; version?: string }, installCmd: string): ToolStatus => {
    const newest = latest[name];
    return {
      name,
      ...status,
      ...(newest ? { latest: newest } : {}),
      ...(status.version && newest ? { outdated: compareVersions(status.version, newest) < 0 } : {}),
      ...(!status.installed ? { install: installCmd } : {}),
    };
  };

  const tools: ToolStatus[] = [
    withLatest('icp', icp, 'npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm'),
    withLatest('ic-wasm', icWasm, 'npm install -g @icp-sdk/ic-wasm'),
    withLatest('mops', mops, 'npm install -g ic-mops'),
    { name: 'node', installed: true, version: process.versions.node },
    { name: 'didc', ...didc, note: 'Optional: Candid validation in this server.' },
  ];
  if (dfx.installed) {
    tools.push({ name: 'dfx', ...dfx, note: 'Legacy tool. Projects are built and deployed with icp.' });
  }

  const { report: projectReport } = await inspectProject(path);
  if (projectReport.rustCanisters) {
    const targets = await runCommand({ program: 'rustup', args: ['target', 'list', '--installed'], timeoutMs: 20_000 });
    tools.push({
      name: 'wasm32-unknown-unknown',
      installed: targets.ok && targets.stdout.split('\n').includes('wasm32-unknown-unknown'),
      install: 'rustup target add wasm32-unknown-unknown',
    });
  }

  const identityInfo = icp.installed ? await currentIdentity(cwd) : null;
  let identityCount: number | undefined;
  if (icp.installed) {
    const list = await runCommand({ program: 'icp', args: ['identity', 'list', '--json'], cwd, timeoutMs: 20_000 });
    try {
      identityCount = (JSON.parse(list.stdout).identities || []).length;
    } catch {
      identityCount = undefined;
    }
  }

  let engineFlag: boolean | undefined;
  if (icp.installed) {
    const help = await runCommand({ program: 'icp', args: ['deploy', '--help'], cwd, timeoutMs: 20_000 });
    engineFlag = help.ok && help.stdout.includes('--engine');
  }

  let network: PreflightReport['network'];
  if (icp.installed && projectReport.kind === 'icp') {
    const status = await runCommand({ program: 'icp', args: ['network', 'status', '--json'], cwd: path, timeoutMs: 30_000 });
    if (status.ok) {
      let gatewayUrl: string | undefined;
      try {
        gatewayUrl = JSON.parse(status.stdout).gateway_url;
      } catch {
        gatewayUrl = undefined;
      }
      network = { running: true, ...(gatewayUrl ? { gatewayUrl } : {}) };
    } else {
      network = { running: false };
    }
  }

  let mainnet: PreflightReport['mainnet'];
  if (ctx.checkMainnet && icp.installed) {
    const cycles = await runCommand({ program: 'icp', args: ['cycles', 'balance', '-n', 'ic', '--json'], cwd, timeoutMs: 60_000 });
    let balance: string | undefined;
    try {
      balance = JSON.parse(cycles.stdout).balance;
    } catch {
      balance = undefined;
    }
    mainnet = {
      cycles: cycles.ok && balance !== undefined ? { balance } : { error: (cycles.stderr || cycles.stdout).trim().split('\n').slice(-2).join(' ') },
      ...(target === 'engine' ? { engines: await visibleEngines(cwd) } : {}),
    };
  }

  const issues: string[] = [];
  for (const t of tools) {
    if (t.outdated) issues.push(`${t.name} ${t.version} is older than the latest release ${t.latest}.`);
  }
  if (projectReport.icpDataIgnored) {
    issues.push('.gitignore hides .icp/data, which holds mainnet canister id mappings. Ignore only .icp/cache/.');
  }
  if (target === 'engine' && engineFlag === false) {
    issues.push('This icp-cli has no --engine flag (added in 1.7).');
  }
  if (!ctx.checkMainnet && target !== 'local') {
    issues.push('Mainnet balances were not checked. Pass checkMainnet: true to run read-only queries as the active identity.');
  }

  const partial: Omit<PreflightReport, 'nextStep'> = {
    target,
    tools,
    ...(engineFlag !== undefined ? { engineFlag } : {}),
    identity: identityInfo ? { ...identityInfo, ...(identityCount !== undefined ? { count: identityCount } : {}) } : null,
    project: projectReport,
    ...(network ? { network } : {}),
    ...(mainnet ? { mainnet } : {}),
    engineBalance: `An engine's balance is not readable from the CLI. It is on the engine's Billing page at ${ENGINE_CONSOLE}; when it runs out the engine is deleted.`,
    issues,
  };
  return { ...partial, nextStep: computeNextStep(partial, ctx.engine) };
}
