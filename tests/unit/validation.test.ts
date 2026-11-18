import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { lintEngineRules } from '../../src/validators/engine-rules.js';
import { executeRefactor } from '../../src/tools/refactor.js';
import { compileMotokoCode, findMopsProject } from '../../src/validators/motoko-compiler.js';
import { validate, ValidateInputSchema } from '../../src/tools/validate.js';
import { setCommandRunner, type CommandSpec, type CommandResult } from '../../src/executors/icp-executor.js';
import { validateIcpYamlText } from '../../src/analyzers/icp-project.js';

const codes = (code: string, lang: 'motoko' | 'rust' = 'motoko') => lintEngineRules(code, lang).map(i => `${i.severity}:${i.code}`);

describe('cloud engine lint, Motoko', () => {
  it('flags attached cycles as errors', () => {
    expect(codes('let r = await (with cycles = 1_000_000) ledger.transfer(args);')).toContain('error:ENGINE-CYCLES');
    expect(codes('Cycles.add<system>(1_000);')).toContain('error:ENGINE-CYCLES');
  });

  it('flags unbounded-wait calls to actor references', () => {
    const code = 'import Ledger "canister:ledger";\nactor { public func f() : async () { await Ledger.transfer(x) } }';
    expect(codes(code)).toEqual(['warning:ENGINE-BOUNDED-WAIT']);
  });

  it('accepts bounded-wait calls without cycles', () => {
    const code = 'let other = actor ("aaaaa-aa") : actor { ping : () -> async () };\nawait (with timeout = 30) other.ping();';
    expect(lintEngineRules(code, 'motoko')).toEqual([]);
  });

  it('accepts HTTPS outcalls through the standard wrapper', () => {
    expect(lintEngineRules('let response = await Call.httpRequest(request);', 'motoko')).toEqual([]);
  });

  it('points chain-key calls at the proxy', () => {
    const [issue] = lintEngineRules('let sig = await ic.sign_with_ecdsa(args);', 'motoko');
    expect(issue.code).toBe('ENGINE-PROXY');
    expect(issue.suggestedFix).toMatch(/PROXY_CANISTER_ID/);
  });

  it('ignores commented-out code', () => {
    expect(lintEngineRules('// await (with cycles = 5) x.y();', 'motoko')).toEqual([]);
  });
});

describe('cloud engine lint, Rust', () => {
  it('flags with_cycles and call_with_payment', () => {
    expect(codes('Call::bounded_wait(id, "m").with_cycles(5).await', 'rust')).toContain('error:ENGINE-CYCLES');
    expect(codes('ic_cdk::api::call::call_with_payment(id, "m", (), 5).await', 'rust')).toContain('error:ENGINE-CYCLES');
  });

  it('flags unbounded and legacy calls', () => {
    expect(codes('Call::unbounded_wait(id, "m").await', 'rust')).toEqual(['warning:ENGINE-BOUNDED-WAIT']);
    expect(codes('let (r,): (u64,) = ic_cdk::call(id, "m", ()).await?;', 'rust')).toEqual(['warning:ENGINE-BOUNDED-WAIT']);
  });

  it('accepts bounded-wait calls', () => {
    expect(lintEngineRules('let r = Call::bounded_wait(id, "m").with_arg(a).await?;', 'rust')).toEqual([]);
  });
});

describe('refactor', () => {
  it('no longer inserts upgrade hooks or stable declarations', async () => {
    for (const refactoring of ['add-upgrade-hooks', 'add-stable-vars'] as const) {
      const text = await executeRefactor({ code: 'actor Counter { var count = 0; }', language: 'motoko', refactoring });
      expect(text).toMatch(/is not applied/);
      expect(text).not.toMatch(/system func preupgrade\(\)/);
      expect(text).not.toMatch(/stable var count/);
      expect(text).toContain('migrating-motoko-actors');
    }
  });

  it('modernize only exposes the caller', async () => {
    const text = await executeRefactor({ code: 'actor { public shared func reset() : async () {} }', language: 'motoko', refactoring: 'modernize' });
    expect(text).toContain('public shared ({ caller }) func reset');
    expect(text).not.toContain('preupgrade');
  });
});

describe('Motoko compile through mops', () => {
  let calls: CommandSpec[];
  let previous: ReturnType<typeof setCommandRunner>;
  let lastToml = '';
  const ok = (stdout = '', stderr = ''): CommandResult => ({ ok: true, exitCode: 0, stdout, stderr, timedOut: false, notFound: false, command: '' });

  beforeEach(() => {
    calls = [];
    previous = setCommandRunner(async spec => {
      calls.push(spec);
      const joined = spec.args.join(' ');
      if (joined === 'toolchain info moc') return ok('moc\nlatest: 9.9.9\n');
      if (joined === 'info core') return ok('core@8.8.8\nThe Motoko standard library');
      if (spec.args[0] === 'check' && spec.cwd) {
        lastToml = await readFile(join(spec.cwd, 'mops.toml'), 'utf-8').catch(() => '');
        return { ...ok('', 'main.mo:2.3-2.9: type error [M0072], field vals does not exist in type:\n  List<Nat>\n✗ Check failed'), ok: false, exitCode: 1 };
      }
      return ok('3.8.0');
    });
  });
  afterEach(() => setCommandRunner(previous));

  it('checks a snippet in a temporary project with the latest moc and core', async () => {
    const result = await compileMotokoCode('actor {}');
    const check = calls.find(c => c.args[0] === 'check')!;
    expect(check.program).toBe('mops');
    expect(check.args).toEqual(['check', 'snippet', '--no-lint']);
    expect(lastToml).toContain('moc = "9.9.9"');
    expect(lastToml).toContain('core = "8.8.8"');
    expect(lastToml).not.toContain('--default-persistent-actors');
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: 'M0072', line: 2 });
    expect(result.toolchain).toMatchObject({ mode: 'snippet', moc: '9.9.9' });
    expect(calls.some(c => c.program === 'dfx' || c.program === 'moc')).toBe(false);
  });

  it('adds the persistence flag for a moc 1 snippet', async () => {
    await compileMotokoCode('actor {}', { mocVersion: '1.16.1' });
    expect(lastToml).toContain('moc = "1.16.1"');
    expect(lastToml).toContain('--default-persistent-actors');
  });

  it('checks a project with its own mops.toml, without --fix', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ic-mcp-mops-'));
    try {
      await mkdir(join(dir, 'backend'));
      await writeFile(join(dir, 'backend', 'mops.toml'), '[toolchain]\nmoc = "1.14.0"\n\n[canisters.backend]\nmain = "src/main.mo"\n');
      expect(await findMopsProject(dir, 'backend')).toBe(join(dir, 'backend'));
      const result = await compileMotokoCode('', { projectPath: dir, canister: 'backend' });
      const check = calls.find(c => c.args[0] === 'check')!;
      expect(check.args).toEqual(['check', 'backend']);
      expect(check.cwd).toBe(join(dir, 'backend'));
      expect(result.toolchain).toMatchObject({ mode: 'project', moc: '1.14.0' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('validate accepts projectPath at the top level and nested', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ic-mcp-mops-'));
    try {
      await writeFile(join(dir, 'mops.toml'), '[canisters.app]\nmain = "main.mo"\n');
      for (const input of [
        { language: 'motoko', projectPath: dir, canister: 'app' },
        { language: 'motoko', context: { projectPath: dir, canister: 'app' } },
      ]) {
        calls = [];
        await validate(ValidateInputSchema.parse(input));
        expect(calls.find(c => c.args[0] === 'check')?.args).toEqual(['check', 'app']);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('validate refuses empty code without a project', async () => {
    const result = await validate(ValidateInputSchema.parse({ language: 'motoko', code: '' }));
    expect(JSON.parse(result.content[0].text).issues[0].message).toMatch(/Provide code/);
  });
});

describe('icp.yaml validation', () => {
  it('accepts a correct file', () => {
    const text = 'canisters:\n  - name: backend\n    recipe:\n      type: "@dfinity/rust@v3.4.0"\n';
    expect(validateIcpYamlText(text)).toEqual({ valid: true, issues: [] });
  });

  it('catches map-shaped sections, unpinned recipes and misplaced fields', () => {
    const text = [
      'canisters:',
      '  - name: backend',
      '    candid: backend.did',
      '    recipe:',
      '      type: "@dfinity/rust"',
      'networks:',
      '  local:',
      '    mode: managed',
    ].join('\n');
    const messages = validateIcpYamlText(text).issues.map(i => i.message).join('\n');
    expect(messages).toMatch(/"networks" must be an array/);
    expect(messages).toMatch(/not pinned/);
    expect(messages).toMatch(/"candid" is not a canister-level field next to a recipe/);
  });
});
