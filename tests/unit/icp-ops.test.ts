import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  planDeploy,
  planCall,
  planNewProject,
  executeDeploy,
  executeCall,
  executeNetwork,
  formatCandidArgs,
  type IdentityInfo,
} from '../../src/tools/icp-ops.js';
import { setCommandRunner, type CommandSpec, type CommandResult, InvalidArgumentError } from '../../src/executors/icp-executor.js';
import { readIcpProject } from '../../src/analyzers/icp-project.js';

const named: IdentityInfo = { name: 'dev', principal: 'abcde-fghij', anonymous: false };
const anonymous: IdentityInfo = { name: 'anonymous', principal: '2vxsx-fae', anonymous: true };

describe('planDeploy', () => {
  it('deploys locally in auto mode without confirmation', () => {
    const plan = planDeploy({ projectPath: '/p' }, null, anonymous);
    expect(plan.args).toEqual(['deploy', '-e', 'local', '--json']);
    expect(plan.requiresConfirmation).toBe(false);
    expect(plan.blocked).toBeUndefined();
    expect(plan.effects.join(' ')).toMatch(/keep their state/);
  });

  it('never adds a reinstall or clean flag by default', () => {
    const plan = planDeploy({ projectPath: '/p', clean: true }, null, named);
    expect(plan.args).not.toContain('reinstall');
    expect(plan.args.some(a => a.includes('clean'))).toBe(false);
    expect(plan.warnings[0]).toMatch(/clean/);
  });

  it('requires confirmation for reinstall, even locally', () => {
    const plan = planDeploy({ projectPath: '/p', mode: 'reinstall' }, null, named);
    expect(plan.args).toContain('--mode');
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.effects.join(' ')).toMatch(/wiped/);
  });

  it('requires confirmation for mainnet and states the cycles cost', () => {
    const plan = planDeploy({ projectPath: '/p', environment: 'ic', cycles: '3t' }, null, named);
    expect(plan.args).toEqual(['deploy', '-e', 'ic', '--cycles', '3t', '--json']);
    expect(plan.target).toBe('mainnet');
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.effects.join(' ')).toMatch(/3t cycles/);
    expect(plan.effects.join(' ')).toContain('dev (abcde-fghij)');
  });

  it('builds the engine command with -e ic --engine', () => {
    const plan = planDeploy({ projectPath: '/p', engine: 'my-engine/team', canisters: ['backend'] }, null, named);
    expect(plan.args).toEqual(['deploy', 'backend', '-e', 'ic', '--engine', 'my-engine/team', '--json']);
    expect(plan.target).toBe('engine');
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.display).toBe('icp deploy backend -e ic --engine my-engine/team --json');
  });

  it('refuses remote deploys as the anonymous identity', () => {
    expect(planDeploy({ projectPath: '/p', environment: 'ic' }, null, anonymous).blocked).toMatch(/anonymous/);
    expect(planDeploy({ projectPath: '/p', engine: 'e1' }, null, anonymous).blocked).toMatch(/--app opencloud.org/);
  });

  it('passes --yes only for acceptBreakingChange, which needs confirmation', () => {
    const plan = planDeploy({ projectPath: '/p', acceptBreakingChange: true }, null, named);
    expect(plan.args).toContain('--yes');
    expect(plan.requiresConfirmation).toBe(true);
  });

  it('keeps install args as one argument that cannot become a flag', () => {
    const plan = planDeploy({ projectPath: '/p', canisters: ['backend'], args: "(\"it's\"; --mode reinstall)" }, null, named);
    expect(plan.args).toContain("--args=(\"it's\"; --mode reinstall)");
    expect(plan.args.filter(a => a === '--mode')).toHaveLength(0);
  });

  it('rejects names that could be read as options', () => {
    expect(() => planDeploy({ projectPath: '/p', canisters: ['--mode'] }, null, named)).toThrow(InvalidArgumentError);
    expect(() => planDeploy({ projectPath: '/p', environment: '-e' }, null, named)).toThrow(InvalidArgumentError);
    expect(() => planDeploy({ projectPath: '/p', engine: 'a b' }, null, named)).toThrow(InvalidArgumentError);
    expect(() => planDeploy({ projectPath: '/p', cycles: '2t; rm' }, null, named)).toThrow(InvalidArgumentError);
  });

  it('rejects playground and engine with subnet', () => {
    expect(() => planDeploy({ network: 'playground' }, null, named)).toThrow(/playground/);
    expect(() => planDeploy({ engine: 'e', subnet: 'aaaaa-aa' }, null, named)).toThrow(/either engine or subnet/);
  });

  it('treats a custom environment on a managed network as local', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ic-mcp-ops-'));
    try {
      await writeFile(
        join(dir, 'icp.yaml'),
        'canisters: []\nnetworks:\n  - name: dev\n    mode: managed\nenvironments:\n  - name: dev\n    network: dev\n  - name: staging\n    network: ic\n'
      );
      const project = await readIcpProject(dir);
      expect(planDeploy({ projectPath: dir, environment: 'dev' }, project, named).requiresConfirmation).toBe(false);
      expect(planDeploy({ projectPath: dir, environment: 'staging' }, project, named).target).toBe('mainnet');
      expect(planDeploy({ projectPath: dir, environment: 'unknown-env' }, project, named).requiresConfirmation).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('planCall', () => {
  it('sends local update calls without confirmation', () => {
    const plan = planCall({ projectPath: '/p', canister: 'backend', method: 'greet', args: '("World")' }, null, null);
    expect(plan.args).toEqual(['canister', 'call', 'backend', 'greet', '("World")', '-e', 'local', '--json']);
    expect(plan.requiresConfirmation).toBe(false);
  });

  it('requires confirmation for mainnet update calls but not queries', () => {
    expect(planCall({ canister: 'backend', method: 'set', environment: 'ic' }, null, named).requiresConfirmation).toBe(true);
    const query = planCall({ canister: 'backend', method: 'get', environment: 'ic', query: true }, null, named);
    expect(query.requiresConfirmation).toBe(false);
    expect(query.args).toContain('--query');
  });

  it('maps the legacy canisterId, mode and network fields', () => {
    const plan = planCall({ canisterId: 'ryjl3-tyaaa-aaaaa-aaaba-cai', method: 'symbol', mode: 'query', network: 'ic' }, null, named);
    expect(plan.args).toEqual(['canister', 'call', 'ryjl3-tyaaa-aaaaa-aaaba-cai', 'symbol', '()', '--query', '-e', 'ic', '--json']);
  });

  it('always passes arguments so icp never prompts', () => {
    expect(planCall({ canister: 'b', method: 'm' }, null, null).args[4]).toBe('()');
  });
});

describe('formatCandidArgs', () => {
  it('encodes simple values', () => {
    expect(formatCandidArgs(['World', 3, true, { to: 'x', amount: 1 }])).toBe('("World", 3, true, record { to = "x"; amount = 1 })');
    expect(formatCandidArgs('("raw")')).toBe('("raw")');
  });
});

describe('planNewProject', () => {
  it('runs icp new silently with a template', () => {
    const plan = planNewProject({ name: 'my-app', parentPath: '/tmp', template: 'motoko', define: { backend_type: 'motoko' } });
    expect(plan.args).toEqual(['new', 'my-app', '--subfolder', 'motoko', '--silent', '--define', 'backend_type=motoko']);
  });
});

describe('execution with a recording runner', () => {
  let calls: CommandSpec[];
  let previous: ReturnType<typeof setCommandRunner>;
  let dir: string;

  const respond = (spec: CommandSpec): CommandResult => {
    const joined = spec.args.join(' ');
    const ok = (stdout: string): CommandResult => ({ ok: true, exitCode: 0, stdout, stderr: '', timedOut: false, notFound: false, command: `icp ${joined}` });
    if (joined === 'identity list --json') return ok(JSON.stringify({ default_identity: 'dev', identities: [{ name: 'dev', principal: 'abcde-fghij' }] }));
    if (joined === 'deploy --help') return ok('--engine <ENGINE>');
    if (joined.startsWith('network status')) return { ...ok(''), ok: false, exitCode: 1, stderr: 'the local network for this project is not running' };
    if (joined.startsWith('deploy')) return ok(JSON.stringify({ canisters: [{ name: 'backend', canister_id: 'aaaaa-aa', url: 'http://x' }] }));
    if (joined.startsWith('canister call')) return ok(JSON.stringify({ response_candid: '("Hello")' }));
    return ok('');
  };

  beforeEach(async () => {
    calls = [];
    previous = setCommandRunner(async spec => {
      calls.push(spec);
      return respond(spec);
    });
    dir = await mkdtemp(join(tmpdir(), 'ic-mcp-exec-'));
    await writeFile(join(dir, 'icp.yaml'), 'canisters:\n  - name: backend\n    recipe:\n      type: "@dfinity/motoko@v5.1.0"\n');
  });
  afterEach(async () => {
    setCommandRunner(previous);
    await rm(dir, { recursive: true, force: true });
  });

  it('returns the plan and runs nothing for an unconfirmed engine deploy', async () => {
    const result = await executeDeploy({ projectPath: dir, engine: 'my-engine' });
    expect(result.status).toBe('confirmation-required');
    expect(result.plan.display).toBe('icp deploy -e ic --engine my-engine --json');
    expect(calls.some(c => c.args[0] === 'deploy' && c.args.length > 2)).toBe(false);
  });

  it('runs the exact planned command once confirmed', async () => {
    const result = await executeDeploy({ projectPath: dir, engine: 'my-engine', confirm: true });
    expect(result.status).toBe('deployed');
    const deploy = calls.find(c => c.args[0] === 'deploy' && c.args[1] !== '--help')!;
    expect(deploy.program).toBe('icp');
    expect(deploy.args).toEqual(['deploy', '-e', 'ic', '--engine', 'my-engine', '--json']);
    expect(result.canisters).toEqual([{ name: 'backend', id: 'aaaaa-aa', url: 'http://x' }]);
  });

  it('starts the local network before a local deploy, without any clean flag', async () => {
    const result = await executeDeploy({ projectPath: dir });
    expect(result.status).toBe('deployed');
    const start = calls.find(c => c.args[0] === 'network' && c.args[1] === 'start')!;
    expect(start.args).toEqual(['network', 'start', '-d']);
  });

  it('points a dfx project at the converter', async () => {
    const dfxDir = await mkdtemp(join(tmpdir(), 'ic-mcp-dfx-'));
    try {
      await writeFile(join(dfxDir, 'dfx.json'), '{"canisters":{}}');
      const result = await executeDeploy({ projectPath: dfxDir });
      expect(result.status).toBe('blocked');
      expect(result.next.action).toBe('convert-dfx');
      expect(calls.some(c => c.args[0] === 'deploy')).toBe(false);
    } finally {
      await rm(dfxDir, { recursive: true, force: true });
    }
  });

  it('holds a mainnet update call until confirmed', async () => {
    const pending = await executeCall({ projectPath: dir, canister: 'backend', method: 'set', environment: 'ic' });
    expect(pending.status).toBe('confirmation-required');
    expect(calls.some(c => c.args[0] === 'canister')).toBe(false);
    const done = await executeCall({ projectPath: dir, canister: 'backend', method: 'set', environment: 'ic', confirm: true });
    expect(done.response).toBe('("Hello")');
  });

  it('reports network-start as already running when it is', async () => {
    setCommandRunner(async spec => {
      calls.push(spec);
      return { ok: true, exitCode: 0, stdout: '{"gateway_url":"http://localhost:1234/"}', stderr: '', timedOut: false, notFound: false, command: '' };
    });
    const result = await executeNetwork('start', { projectPath: dir });
    expect(result.status).toBe('already-running');
    expect(calls.every(c => c.args[1] !== 'start')).toBe(true);
  });
});
