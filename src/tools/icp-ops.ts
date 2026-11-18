/**
 * icp-cli operations: create a project, run the project's local network,
 * deploy, call and inspect canisters.
 *
 * Every state-changing command is planned first. A plan states the exact
 * command and its effects. Plans that touch mainnet, a cloud engine or another
 * remote network, that reinstall (wiping state), or that skip the Candid
 * compatibility check need `confirm: true` before they run. Deploying to a
 * remote network as the anonymous identity is refused.
 */

import { z } from 'zod';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import {
  runCommand,
  displayCommand,
  checkName,
  checkCanister,
  checkMethod,
  checkEngine,
  checkCycles,
  checkPrincipal,
  checkPositional,
  InvalidArgumentError,
} from '../executors/icp-executor.js';
import { readIcpProject, classifyEnvironment, type IcpProject, type TargetClass } from '../analyzers/icp-project.js';
import { lintEngineRules } from '../validators/engine-rules.js';
import { REFS } from '../data/references.js';

export const ANONYMOUS_PRINCIPAL = '2vxsx-fae';

export const TEMPLATES = ['hello-world', 'motoko', 'rust', 'bitcoin-starter', 'proxy', 'static-website'] as const;

export interface IdentityInfo {
  name: string;
  principal?: string;
  anonymous: boolean;
}

export interface CommandPlan {
  program: 'icp';
  args: string[];
  cwd: string;
  display: string;
  target: TargetClass | 'engine';
  environment?: string;
  changesState: boolean;
  requiresConfirmation: boolean;
  confirmationReasons: string[];
  effects: string[];
  warnings: string[];
  blocked?: string;
}

function plan(args: string[], cwd: string, rest: Omit<CommandPlan, 'program' | 'args' | 'cwd' | 'display'>): CommandPlan {
  return { program: 'icp', args, cwd, display: displayCommand('icp', args), ...rest };
}

function outputTail(text: string, lines = 25): string {
  return text.trim().split('\n').slice(-lines).join('\n');
}

/** Active (or named) icp identity, from `icp identity list --json`. */
export async function currentIdentity(cwd: string, override?: string): Promise<IdentityInfo | null> {
  const result = await runCommand({ program: 'icp', args: ['identity', 'list', '--json'], cwd, timeoutMs: 30_000 });
  if (!result.ok) return null;
  try {
    const data = JSON.parse(result.stdout);
    const name: string = override || data.default_identity;
    const entry = (data.identities || []).find((i: any) => i.name === name);
    return {
      name,
      principal: entry?.principal,
      anonymous: name === 'anonymous' || entry?.principal === ANONYMOUS_PRINCIPAL,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ deploy */

export const DeployContextSchema = z.object({
  projectPath: z.string().optional().describe('Project directory containing icp.yaml (default: server working directory)'),
  canisters: z.array(z.string()).optional().describe('Canister names (default: all in the environment)'),
  environment: z.string().optional().describe('Environment from icp.yaml: "local" (default), "ic" (mainnet) or a custom one'),
  engine: z.string().optional().describe('Cloud engine name, name/slug or id: deploys with `-e ic --engine <name>` (icp-cli >= 1.7)'),
  subnet: z.string().optional().describe('Subnet id to deploy to: `--subnet <id>`'),
  mode: z.enum(['auto', 'install', 'reinstall', 'upgrade']).optional().describe('Install mode (default auto: install new, upgrade existing). reinstall wipes state.'),
  cycles: z.string().optional().describe('Cycles for each canister created on mainnet, e.g. "2t" (icp default 2T)'),
  controllers: z.array(z.string()).optional().describe('Controller principals for created canisters'),
  identity: z.string().optional().describe('icp identity to deploy as (default: the active identity)'),
  args: z.string().optional().describe('Candid init/upgrade arguments, only with exactly one canister'),
  acceptBreakingChange: z.boolean().optional().describe('Pass --yes to skip the Candid compatibility check; needs confirm'),
  startNetwork: z.boolean().optional().describe('Start the local network if it is not running (default true for local)'),
  confirm: z.boolean().optional().describe('Required for mainnet, engine, remote, reinstall or acceptBreakingChange. Only after the user agrees to the plan.'),
  network: z.enum(['local', 'ic', 'playground']).optional().describe('Deprecated: use environment'),
  clean: z.boolean().optional().describe('Deprecated: icp-cli has no clean start; state is always kept'),
});

export type DeployContext = z.infer<typeof DeployContextSchema>;

export function planDeploy(ctx: DeployContext, project: IcpProject | null, identity: IdentityInfo | null): CommandPlan {
  const cwd = resolve(ctx.projectPath || process.cwd());
  const warnings: string[] = [];
  const reasons: string[] = [];
  const effects: string[] = [];

  if (ctx.network === 'playground') {
    throw new InvalidArgumentError('icp-cli has no playground network. Deploy to the local network, or to mainnet with environment "ic".');
  }
  if (ctx.clean !== undefined) {
    warnings.push('"clean" is ignored: icp-cli never wipes the local network on start, and this tool does not either.');
  }
  if (ctx.engine && ctx.subnet) {
    throw new InvalidArgumentError('Pass either engine or subnet, not both.');
  }

  let environment = checkName(ctx.environment || (ctx.network === 'ic' ? 'ic' : ctx.engine || ctx.subnet ? 'ic' : 'local'), 'environment');
  let target: CommandPlan['target'] = classifyEnvironment(project, environment);
  if (ctx.engine || ctx.subnet) {
    if (target === 'local') {
      throw new InvalidArgumentError(`An engine or subnet deploy needs a mainnet environment, not "${environment}".`);
    }
    target = ctx.engine ? 'engine' : target;
  }
  if (target === 'unknown') {
    warnings.push(`Environment "${environment}" is not defined in icp.yaml; treating it as remote.`);
  }

  const args = ['deploy'];
  const canisters = (ctx.canisters || []).map(name => checkName(name, 'canister'));
  args.push(...canisters);
  args.push('-e', environment);
  if (ctx.engine) args.push('--engine', checkEngine(ctx.engine));
  if (ctx.subnet) args.push('--subnet', checkPrincipal(ctx.subnet, 'subnet id'));
  const mode = ctx.mode || 'auto';
  if (mode !== 'auto') args.push('--mode', mode);
  if (ctx.cycles) args.push('--cycles', checkCycles(ctx.cycles));
  for (const controller of ctx.controllers || []) args.push('--controller', checkPrincipal(controller, 'controller'));
  if (ctx.identity) args.push('--identity', checkName(ctx.identity, 'identity'));
  if (ctx.args !== undefined) {
    if (canisters.length !== 1) {
      throw new InvalidArgumentError('args can be passed only when deploying exactly one canister.');
    }
    args.push(`--args=${ctx.args}`);
  }
  if (ctx.acceptBreakingChange) args.push('--yes');
  args.push('--json');

  const scope = canisters.length > 0 ? canisters.join(', ') : 'all canisters in the environment';
  const who = identity ? `${identity.name}${identity.principal ? ` (${identity.principal})` : ''}` : 'the active identity';
  const remote = target !== 'local';

  if (target === 'local') {
    effects.push(`Builds and deploys ${scope} to this project's local network (-e ${environment}).`);
  } else if (target === 'engine') {
    effects.push(`Deploys ${scope} to cloud engine "${ctx.engine}" (the engine's subnet on IC mainnet) as ${who}.`);
    effects.push('Engine canisters hold 0 cycles; capacity is paid from the engine balance, not from canister cycles.');
    reasons.push('Deploys to a cloud engine on mainnet.');
  } else if (target === 'mainnet') {
    effects.push(`Deploys ${scope} to IC mainnet (-e ${environment}) as ${who}.`);
    effects.push(
      `Canisters without an id in .icp/data/mappings/${environment}.ids.json are created, each funded with ${ctx.cycles || '2T'} cycles from that identity's cycles balance.`
    );
    reasons.push('Deploys to IC mainnet and spends cycles.');
  } else {
    effects.push(`Deploys ${scope} to environment "${environment}" on a remote network as ${who}.`);
    reasons.push(`Deploys to remote environment "${environment}".`);
  }
  if (ctx.subnet) effects.push(`Creates new canisters on subnet ${ctx.subnet}.`);

  if (mode === 'reinstall') {
    effects.push(`Reinstalls ${scope}: all canister state is wiped.`);
    reasons.push('Mode reinstall wipes canister state.');
  } else if (mode === 'auto') {
    effects.push('Existing canisters are upgraded and keep their state; new ones are installed.');
  } else if (mode === 'upgrade') {
    effects.push('Existing canisters are upgraded and keep their state.');
  }
  if (ctx.acceptBreakingChange) {
    effects.push('Skips the Candid interface compatibility check (--yes): clients of a changed method may break.');
    reasons.push('Skips the Candid compatibility check.');
  }

  let blocked: string | undefined;
  if (remote && identity?.anonymous) {
    blocked =
      'Refusing to deploy to a remote network as the anonymous identity: it is shared by everyone and leaves canisters uncontrolled. ' +
      (target === 'engine'
        ? 'Link the engine console identity: `icp identity link web <name> --app opencloud.org`, then `icp identity default <name>`.'
        : 'Create one with `icp identity new <name>` and select it with `icp identity default <name>`.');
  }
  if (remote && !identity && !ctx.identity) {
    warnings.push('Could not read the active identity; check it with `icp identity principal` before confirming.');
  }

  return plan(args, cwd, {
    target,
    environment,
    changesState: true,
    requiresConfirmation: reasons.length > 0,
    confirmationReasons: reasons,
    effects,
    warnings,
    ...(blocked ? { blocked } : {}),
  });
}

function deployHints(output: string, target: CommandPlan['target']): string[] {
  const hints: string[] = [];
  if (/Use --yes to bypass/i.test(output)) {
    hints.push('The new interface breaks existing clients. Fix it, or, if that is intended, repeat with acceptBreakingChange: true and confirm: true.');
  }
  if (/insufficient (liquid )?cycles|Insufficient cycles/i.test(output)) {
    hints.push('The deploying identity has too few cycles: check `icp cycles balance -n ic`; convert ICP with `icp cycles mint` or buy with `icp cycles buy` (the user pays by card).');
  }
  if (/is it running|network for this project is not running/i.test(output)) {
    hints.push('Start the project network: action "network-start".');
  }
  if (/No Motoko canisters found in mops\.toml/i.test(output)) {
    hints.push('mops.toml needs [canisters.<name>] with the exact canister name from icp.yaml.');
  }
  if (/mops.*(not found|ENOENT)|command not found: mops/i.test(output)) {
    hints.push('Install the Motoko toolchain: npm install -g ic-mops');
  }
  if (target === 'engine' && /unauthori[sz]ed|not authori[sz]ed|permission/i.test(output)) {
    hints.push('The engine rejected the identity. Link the console identity with `icp identity link web <name> --app opencloud.org` (use the exact console host) and make it the default.');
  }
  if (target === 'engine' && /engine/i.test(output) && /not found|no engine|unknown/i.test(output)) {
    hints.push('No engine with that name is visible to this identity. Use the name shown in the console, name/slug, or the engine id.');
  }
  return hints;
}

async function engineLintFindings(project: IcpProject | null): Promise<string[]> {
  if (!project) return [];
  const findings: string[] = [];
  let scanned = 0;
  const walk = async (dir: string, depth: number) => {
    if (depth > 5 || scanned > 400 || !existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'target' || entry.name === 'dist') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (/\.(mo|rs)$/.test(entry.name)) {
        scanned += 1;
        const code = await readFile(full, 'utf-8');
        for (const issue of lintEngineRules(code, entry.name.endsWith('.rs') ? 'rust' : 'motoko')) {
          findings.push(`${full.slice(project.root.length + 1)}:${issue.line ?? '?'} ${issue.code}: ${issue.message}`);
        }
      }
    }
  };
  const dirs = new Set(project.canisters.filter(c => c.kind === 'motoko' || c.kind === 'rust' || c.kind === 'build-steps').map(c => c.dir));
  for (const dir of dirs) await walk(dir, 0);
  return findings.slice(0, 30);
}

async function engineFlagSupported(cwd: string): Promise<boolean> {
  const help = await runCommand({ program: 'icp', args: ['deploy', '--help'], cwd, timeoutMs: 30_000 });
  return help.ok && help.stdout.includes('--engine');
}

async function networkStatus(cwd: string): Promise<{ running: boolean; status?: any; error?: string }> {
  const result = await runCommand({ program: 'icp', args: ['network', 'status', '--json'], cwd, timeoutMs: 30_000 });
  if (result.ok) {
    try {
      return { running: true, status: JSON.parse(result.stdout) };
    } catch {
      return { running: true };
    }
  }
  return { running: false, error: outputTail(result.stderr || result.stdout, 5) };
}

function projectProblem(cwd: string): Record<string, any> | null {
  if (existsSync(join(cwd, 'icp.yaml'))) return null;
  if (existsSync(join(cwd, 'dfx.json'))) {
    return {
      status: 'blocked',
      error: `${cwd} is a dfx project (dfx.json, no icp.yaml).`,
      next: { action: 'convert-dfx', context: { projectPath: cwd, write: true } },
    };
  }
  return {
    status: 'blocked',
    error: `No icp.yaml in ${cwd}.`,
    next: { action: 'new-project', context: { name: 'my-app', template: 'hello-world' } },
  };
}

export async function executeDeploy(ctx: DeployContext): Promise<Record<string, any>> {
  const cwd = resolve(ctx.projectPath || process.cwd());
  const problem = projectProblem(cwd);
  if (problem) return { operation: 'deploy', ...problem };

  const project = await readIcpProject(cwd);
  const identity = await currentIdentity(cwd, ctx.identity);
  const deployPlan = planDeploy({ ...ctx, projectPath: cwd }, project, identity);

  if (deployPlan.target === 'engine') {
    const findings = await engineLintFindings(project);
    if (findings.length > 0) {
      deployPlan.warnings.push(
        `Cloud engine rule findings (${findings.length}); fix errors before deploying. See ${REFS.cloudEngineCanisters}`,
        ...findings
      );
    }
  }

  if (deployPlan.blocked) {
    return { operation: 'deploy', status: 'blocked', reason: deployPlan.blocked, plan: deployPlan };
  }
  if (deployPlan.requiresConfirmation && ctx.confirm !== true) {
    return {
      operation: 'deploy',
      status: 'confirmation-required',
      plan: deployPlan,
      next: 'Show the plan to the user. If they agree, repeat the same call with context.confirm = true.',
    };
  }

  if (deployPlan.target === 'engine' && !(await engineFlagSupported(cwd))) {
    return {
      operation: 'deploy',
      status: 'blocked',
      reason: 'This icp-cli has no --engine flag (added in 1.7). Update with `npm install -g @icp-sdk/icp-cli`, or deploy with subnet set to the engine subnet id from the console.',
      plan: deployPlan,
    };
  }

  if (deployPlan.target === 'local') {
    const status = await networkStatus(cwd);
    if (!status.running) {
      if (ctx.startNetwork === false) {
        return { operation: 'deploy', status: 'blocked', reason: 'The local network is not running.', next: { action: 'network-start', context: { projectPath: cwd } } };
      }
      const started = await runCommand({ program: 'icp', args: ['network', 'start', '-d'], cwd, timeoutMs: 300_000 });
      if (!started.ok) {
        return { operation: 'deploy', status: 'failed', step: 'network-start', command: started.command, error: outputTail(started.stderr || started.stdout) };
      }
    }
  }

  const result = await runCommand({ program: 'icp', args: deployPlan.args, cwd, timeoutMs: 900_000 });
  if (!result.ok) {
    const output = `${result.stderr}\n${result.stdout}`;
    return {
      operation: 'deploy',
      status: 'failed',
      command: result.command,
      ...(result.notFound ? { error: 'icp is not installed: npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm' } : { error: outputTail(output) }),
      ...(result.timedOut ? { timedOut: true } : {}),
      hints: deployHints(output, deployPlan.target),
    };
  }

  let canisters: any[] = [];
  try {
    canisters = JSON.parse(result.stdout).canisters || [];
  } catch {
    canisters = [];
  }
  return {
    operation: 'deploy',
    status: 'deployed',
    environment: deployPlan.environment,
    target: deployPlan.target,
    command: result.command,
    canisters: canisters.map((c: any) => ({ name: c.name, id: c.canister_id, ...(c.url ? { url: c.url } : {}) })),
    log: outputTail(result.stderr, 12),
    ...(deployPlan.warnings.length > 0 ? { warnings: deployPlan.warnings } : {}),
  };
}

/* ----------------------------------------------------------------- network */

export const NetworkContextSchema = z.object({
  projectPath: z.string().optional().describe('Project directory containing icp.yaml'),
  environment: z.string().optional().describe('Use the network of this environment (default: local)'),
});

export type NetworkContext = z.infer<typeof NetworkContextSchema>;

export async function executeNetwork(op: 'start' | 'stop' | 'status', ctx: NetworkContext): Promise<Record<string, any>> {
  const cwd = resolve(ctx.projectPath || process.cwd());
  const problem = projectProblem(cwd);
  if (problem) return { operation: `network-${op}`, ...problem };
  const envArgs = ctx.environment ? ['-e', checkName(ctx.environment, 'environment')] : [];

  if (op === 'status') {
    const result = await runCommand({ program: 'icp', args: ['network', 'status', ...envArgs, '--json'], cwd, timeoutMs: 30_000 });
    if (!result.ok) return { operation: 'network-status', running: false, detail: outputTail(result.stderr || result.stdout, 5) };
    try {
      const status = JSON.parse(result.stdout);
      return { operation: 'network-status', running: true, gatewayUrl: status.gateway_url, apiUrl: status.api_url, managed: status.managed };
    } catch {
      return { operation: 'network-status', running: true, raw: result.stdout };
    }
  }

  if (op === 'start') {
    const before = await runCommand({ program: 'icp', args: ['network', 'status', ...envArgs, '--json'], cwd, timeoutMs: 30_000 });
    if (before.ok) {
      const status = JSON.parse(before.stdout || '{}');
      return { operation: 'network-start', status: 'already-running', gatewayUrl: status.gateway_url };
    }
    const result = await runCommand({ program: 'icp', args: ['network', 'start', ...envArgs, '-d'], cwd, timeoutMs: 300_000 });
    if (!result.ok) {
      const output = `${result.stderr}\n${result.stdout}`;
      return {
        operation: 'network-start',
        status: 'failed',
        command: result.command,
        error: outputTail(output),
        ...(/port.*(in use|already)/i.test(output)
          ? { hint: 'Another network holds the port. Stop it, or set gateway.port: 0 for the local network in icp.yaml.' }
          : {}),
      };
    }
    const after = await executeNetwork('status', ctx);
    return { operation: 'network-start', status: 'started', command: result.command, gatewayUrl: after.gatewayUrl };
  }

  const result = await runCommand({ program: 'icp', args: ['network', 'stop', ...envArgs], cwd, timeoutMs: 120_000 });
  return result.ok
    ? { operation: 'network-stop', status: 'stopped', command: result.command }
    : { operation: 'network-stop', status: 'failed', command: result.command, error: outputTail(result.stderr || result.stdout, 8) };
}

/* -------------------------------------------------------------------- call */

export const CallContextSchema = z.object({
  canister: z.string().optional().describe('Canister name from icp.yaml or a principal'),
  canisterId: z.string().optional().describe('Deprecated: use canister'),
  method: z.string().describe('Method name'),
  args: z.union([z.string(), z.array(z.any())]).optional().describe('Candid text such as \'("World")\' (default "()"); an array is encoded for simple values'),
  query: z.boolean().optional().describe('Send a query call (read-only, no confirmation needed)'),
  mode: z.enum(['query', 'update']).optional().describe('Deprecated: use query'),
  environment: z.string().optional().describe('Environment (default local)'),
  network: z.enum(['local', 'ic', 'playground']).optional().describe('Deprecated: use environment'),
  identity: z.string().optional(),
  projectPath: z.string().optional(),
  confirm: z.boolean().optional().describe('Required for update calls outside the local network'),
});

export type CallContext = z.infer<typeof CallContextSchema>;

export function formatCandidArgs(args: any[] | string | undefined): string {
  if (args === undefined) return '()';
  if (typeof args === 'string') return args.trim() || '()';
  const one = (arg: any): string => {
    if (typeof arg === 'string') return JSON.stringify(arg);
    if (typeof arg === 'number') return Number.isInteger(arg) ? String(arg) : String(arg);
    if (typeof arg === 'boolean') return String(arg);
    if (arg === null || arg === undefined) return 'null';
    if (Array.isArray(arg)) return `vec { ${arg.map(one).join('; ')} }`;
    if (typeof arg === 'object') {
      return `record { ${Object.entries(arg).map(([k, v]) => `${k} = ${one(v)}`).join('; ')} }`;
    }
    return String(arg);
  };
  return `(${args.map(one).join(', ')})`;
}

export function planCall(ctx: CallContext, project: IcpProject | null, identity: IdentityInfo | null): CommandPlan {
  const cwd = resolve(ctx.projectPath || process.cwd());
  if (ctx.network === 'playground') {
    throw new InvalidArgumentError('icp-cli has no playground network.');
  }
  const canister = checkCanister(ctx.canister || ctx.canisterId || '');
  const method = checkMethod(ctx.method);
  const candid = checkPositional(formatCandidArgs(ctx.args), 'args');
  const isQuery = ctx.query === true || ctx.mode === 'query';
  const environment = checkName(ctx.environment || (ctx.network === 'ic' ? 'ic' : 'local'), 'environment');
  const target = classifyEnvironment(project, environment);

  const args = ['canister', 'call', canister, method, candid];
  if (isQuery) args.push('--query');
  args.push('-e', environment);
  if (ctx.identity) args.push('--identity', checkName(ctx.identity, 'identity'));
  args.push('--json');

  const who = identity ? `${identity.name}${identity.principal ? ` (${identity.principal})` : ''}` : 'the active identity';
  const remoteUpdate = target !== 'local' && !isQuery;
  return plan(args, cwd, {
    target,
    environment,
    changesState: !isQuery,
    requiresConfirmation: remoteUpdate,
    confirmationReasons: remoteUpdate ? [`Update call on ${target === 'mainnet' ? 'IC mainnet' : `environment "${environment}"`} can change state.`] : [],
    effects: [
      isQuery
        ? `Query call ${canister}.${method}${candid} on ${environment} (read-only).`
        : `Update call ${canister}.${method}${candid} on ${environment} as ${who}; it can change canister state.`,
    ],
    warnings: [],
  });
}

function parseCallOutput(stdout: string): any {
  try {
    const data = JSON.parse(stdout);
    return { response: data.response_candid ?? data.response_text ?? data.response_bytes };
  } catch {
    return { response: stdout };
  }
}

export async function executeCall(ctx: CallContext): Promise<Record<string, any>> {
  const cwd = resolve(ctx.projectPath || process.cwd());
  const project = await readIcpProject(cwd);
  const environment = ctx.environment || (ctx.network === 'ic' ? 'ic' : 'local');
  const identity = classifyEnvironment(project, environment) === 'local' ? null : await currentIdentity(cwd, ctx.identity);
  const callPlan = planCall({ ...ctx, projectPath: cwd }, project, identity);

  if (callPlan.requiresConfirmation && ctx.confirm !== true) {
    return {
      operation: 'call',
      status: 'confirmation-required',
      plan: callPlan,
      next: 'Show the plan to the user. If they agree, repeat with context.confirm = true, or set query: true for a read-only method.',
    };
  }

  const result = await runCommand({ program: 'icp', args: callPlan.args, cwd, timeoutMs: 120_000 });
  if (!result.ok) {
    return {
      operation: 'call',
      status: 'failed',
      command: result.command,
      error: result.notFound ? 'icp is not installed: npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm' : outputTail(result.stderr || result.stdout, 12),
    };
  }
  return { operation: 'call', status: 'ok', command: result.command, ...parseCallOutput(result.stdout) };
}

/* -------------------------------------------------------------- new project */

export const NewProjectContextSchema = z.object({
  name: z.string().describe('Project directory name (kebab-case)'),
  template: z.enum(TEMPLATES).optional().describe('Template from dfinity/icp-cli-templates (default hello-world)'),
  parentPath: z.string().optional().describe('Directory to create the project in (default: server working directory)'),
  define: z.record(z.string()).optional().describe('Template variables, e.g. { backend_type: "motoko" }'),
});

export type NewProjectContext = z.infer<typeof NewProjectContextSchema>;

export function planNewProject(ctx: NewProjectContext): CommandPlan {
  const cwd = resolve(ctx.parentPath || process.cwd());
  const name = checkName(ctx.name, 'project name');
  const args = ['new', name, '--subfolder', ctx.template || 'hello-world', '--silent'];
  for (const [key, value] of Object.entries(ctx.define || {})) {
    checkName(key, 'template variable');
    args.push('--define', `${key}=${checkPositional(value, 'template value')}`);
  }
  return plan(args, cwd, {
    target: 'local',
    changesState: true,
    requiresConfirmation: false,
    confirmationReasons: [],
    effects: [`Creates ${join(cwd, name)} from the ${ctx.template || 'hello-world'} template.`],
    warnings: [],
  });
}

export async function executeNewProject(ctx: NewProjectContext): Promise<Record<string, any>> {
  const newPlan = planNewProject(ctx);
  const target = join(newPlan.cwd, ctx.name);
  if (existsSync(target)) {
    return { operation: 'new-project', status: 'blocked', reason: `${target} already exists.` };
  }
  const result = await runCommand({ program: 'icp', args: newPlan.args, cwd: newPlan.cwd, timeoutMs: 300_000 });
  if (!result.ok) {
    return { operation: 'new-project', status: 'failed', command: result.command, error: outputTail(result.stderr || result.stdout) };
  }
  return {
    operation: 'new-project',
    status: 'created',
    command: result.command,
    projectPath: target,
    next: [
      { action: 'network-start', context: { projectPath: target } },
      { action: 'deploy', context: { projectPath: target } },
    ],
  };
}

/* ------------------------------------------------------------------ status */

export const StatusContextSchema = z.object({
  projectPath: z.string().optional(),
  canister: z.string().optional().describe('Canister name or principal (default: all in the environment)'),
  environment: z.string().optional().describe('Environment (default local)'),
});

export async function executeStatus(ctx: z.infer<typeof StatusContextSchema>): Promise<Record<string, any>> {
  const cwd = resolve(ctx.projectPath || process.cwd());
  const args = ['canister', 'status'];
  if (ctx.canister) args.push(checkCanister(ctx.canister));
  args.push('-e', checkName(ctx.environment || 'local', 'environment'), '--json');
  const result = await runCommand({ program: 'icp', args, cwd, timeoutMs: 60_000 });
  if (!result.ok) {
    return { operation: 'status', status: 'failed', command: result.command, error: outputTail(result.stderr || result.stdout, 10) };
  }
  let data: any;
  try {
    data = JSON.parse(result.stdout);
  } catch {
    data = result.stdout;
  }
  return { operation: 'status', status: 'ok', command: result.command, canisters: data };
}
