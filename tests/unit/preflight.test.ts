import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { computeNextStep, executePreflight, type PreflightReport } from '../../src/tools/preflight.js';
import { setCommandRunner, type CommandResult } from '../../src/executors/icp-executor.js';

type Partial = Omit<PreflightReport, 'nextStep'>;

function report(overrides: Record<string, any> = {}): Partial {
  return {
    target: 'local',
    tools: [
      { name: 'icp', installed: true, version: '1.8.0' },
      { name: 'ic-wasm', installed: true, version: '0.11.1' },
      { name: 'mops', installed: true, version: '3.8.0' },
    ],
    engineFlag: true,
    identity: { name: 'dev', principal: 'abcde-fghij', anonymous: false },
    project: { path: '/p', kind: 'icp', canisters: [{ name: 'backend', kind: 'motoko' }], problems: [] },
    network: { running: true },
    engineBalance: '',
    issues: [],
    ...overrides,
  } as Partial;
}

describe('computeNextStep', () => {
  it('installs icp-cli first', () => {
    const r = report({ tools: [{ name: 'icp', installed: false }, { name: 'ic-wasm', installed: false }] });
    expect(computeNextStep(r).command).toBe('npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm');
  });

  it('installs mops for Motoko projects', () => {
    const r = report({ tools: [{ name: 'icp', installed: true }, { name: 'ic-wasm', installed: true }, { name: 'mops', installed: false }] });
    expect(computeNextStep(r).command).toBe('npm install -g ic-mops');
  });

  it('creates a project when there is none', () => {
    const step = computeNextStep(report({ project: { path: '/p', kind: 'none', problems: [] } }));
    expect(step.action?.action).toBe('new-project');
  });

  it('converts a dfx project', () => {
    const step = computeNextStep(report({ project: { path: '/p', kind: 'dfx', problems: [] } }));
    expect(step.action).toEqual({ action: 'convert-dfx', context: { projectPath: '/p', write: true } });
  });

  it('starts the local network, then deploys', () => {
    expect(computeNextStep(report({ network: { running: false } })).command).toBe('icp network start -d');
    expect(computeNextStep(report()).command).toBe('icp deploy');
  });

  it('asks for a named identity before mainnet', () => {
    const step = computeNextStep(report({ target: 'mainnet', identity: { name: 'anonymous', principal: '2vxsx-fae', anonymous: true } }));
    expect(step.command).toMatch(/icp identity new/);
  });

  it('asks for cycles when the mainnet balance is zero', () => {
    const step = computeNextStep(report({ target: 'mainnet', mainnet: { cycles: { balance: '0 cycles' } } }));
    expect(step.command).toMatch(/icp cycles buy/);
  });

  it('walks the engine route: link identity, engine name, deploy', () => {
    const anon = { name: 'anonymous', principal: '2vxsx-fae', anonymous: true };
    expect(computeNextStep(report({ target: 'engine', identity: anon })).command).toMatch(/--app opencloud.org/);
    expect(computeNextStep(report({ target: 'engine' })).summary).toMatch(/engine name/);
    expect(computeNextStep(report({ target: 'engine' }), 'my-engine').command).toBe('icp deploy -e ic --engine my-engine');
    expect(computeNextStep(report({ target: 'engine', engineFlag: false }), 'e').summary).toMatch(/1\.7/);
  });
});

describe('executePreflight', () => {
  let previous: ReturnType<typeof setCommandRunner>;
  let dir: string;
  const programs: string[] = [];

  beforeEach(async () => {
    programs.length = 0;
    previous = setCommandRunner(async spec => {
      programs.push(`${spec.program} ${spec.args.join(' ')}`);
      const ok = (stdout: string): CommandResult => ({ ok: true, exitCode: 0, stdout, stderr: '', timedOut: false, notFound: false, command: '' });
      if (spec.program === 'dfx') return { ...ok(''), ok: false, notFound: true };
      if (spec.args.join(' ') === 'identity list --json') return ok('{"default_identity":"anonymous","identities":[{"name":"anonymous","principal":"2vxsx-fae"}]}');
      if (spec.args.join(' ') === 'network status --json') return { ...ok(''), ok: false, exitCode: 1 };
      if (spec.args.join(' ') === 'deploy --help') return ok('--engine <ENGINE>');
      return ok(`${spec.program} 1.2.3`);
    });
    dir = await mkdtemp(join(tmpdir(), 'ic-mcp-pre-'));
    await mkdir(join(dir, 'backend'));
    await writeFile(join(dir, 'icp.yaml'), 'canisters:\n  - backend\n');
    await writeFile(join(dir, 'backend', 'canister.yaml'), 'name: backend\nrecipe:\n  type: "@dfinity/motoko@v5.1.0"\n');
    await writeFile(join(dir, 'backend', 'mops.toml'), '[toolchain]\nmoc = "1.16.1"\n\n[canisters.backend]\nmain = "src/main.mo"\n');
    await writeFile(join(dir, '.gitignore'), '.icp\n');
  });
  afterEach(async () => {
    setCommandRunner(previous);
    await rm(dir, { recursive: true, force: true });
  });

  it('reports tools, identity, project, network and one next step, with no mainnet query by default', async () => {
    const result = await executePreflight({ projectPath: dir, checkLatest: false });
    expect(result.tools.find(t => t.name === 'icp')).toMatchObject({ installed: true, version: '1.2.3' });
    expect(result.tools.some(t => t.name === 'dfx')).toBe(false);
    expect(result.identity).toMatchObject({ name: 'anonymous', anonymous: true });
    expect(result.project.mocPins).toEqual({ backend: '1.16.1' });
    expect(result.project.icpDataIgnored).toBe(true);
    expect(result.issues.join(' ')).toMatch(/hides \.icp\/data/);
    expect(result.network).toEqual({ running: false });
    expect(result.nextStep.action?.action).toBe('network-start');
    expect(programs.some(p => p.includes('-n ic'))).toBe(false);
  });

  it('runs only read-only mainnet queries when asked', async () => {
    const result = await executePreflight({ projectPath: dir, target: 'mainnet', checkMainnet: true, checkLatest: false });
    const mainnetCommands = programs.filter(p => p.includes('-n ic'));
    expect(mainnetCommands).toEqual(['icp cycles balance -n ic --json']);
    expect(result.nextStep.command).toMatch(/icp identity new/);
  });
});
