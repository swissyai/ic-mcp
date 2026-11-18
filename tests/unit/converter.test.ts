import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parse } from 'yaml';
import { convertDfxJson, convertProject, mergeMopsToml, CONVERTED_MOC_VERSION } from '../../src/converters/dfx-to-icp.js';
import { validateIcpYamlText } from '../../src/analyzers/icp-project.js';

const motokoWithRemote = {
  canisters: {
    backend: { dependencies: ['llm'], main: 'backend/app.mo', type: 'motoko', args: '--enhanced-orthogonal-persistence' },
    frontend: { dependencies: ['backend'], frontend: { entrypoint: 'frontend/index.html' }, source: ['frontend/dist'], type: 'assets' },
    llm: {
      candid: 'https://example.org/llm.did',
      type: 'custom',
      specified_id: 'w36hm-eqaaa-aaaal-qr76a-cai',
      remote: { id: { ic: 'w36hm-eqaaa-aaaal-qr76a-cai' } },
      wasm: 'https://example.org/llm.wasm',
    },
  },
  output_env_file: '.env',
  defaults: { build: { packtool: 'mops sources' } },
};

const rustWithIdentity = {
  canisters: {
    internet_identity: {
      type: 'custom',
      candid: 'https://example.org/internet_identity.did',
      wasm: 'https://example.org/internet_identity_dev.wasm.gz',
      remote: { id: { ic: 'rdmx6-jaaaa-aaaaa-aaadq-cai' } },
      specified_id: 'rdmx6-jaaaa-aaaaa-aaadq-cai',
    },
    backend: {
      build: 'build.sh',
      candid: 'src/backend/backend.did',
      init_arg: '(variant { mainnet })',
      package: 'backend',
      type: 'custom',
      wasm: 'target/wasm32-unknown-unknown/release/backend.wasm',
    },
    api: { type: 'rust', package: 'api_crate', candid: 'src/api/api.did', gzip: true },
    frontend: { source: ['dist'], type: 'assets', build: ['pnpm run build'] },
  },
};

describe('convertDfxJson', () => {
  it('moves Motoko canisters to the mops-based recipe', () => {
    const result = convertDfxJson(motokoWithRemote, { rootPackageJsonHasBuild: true });
    const config = parse(result.icpYaml);
    expect(config.canisters[0]).toEqual({ name: 'backend', recipe: { type: '@dfinity/motoko@v5.1.0' } });
    expect(result.mopsCanisters).toEqual([{ name: 'backend', main: 'backend/app.mo', args: ['--enhanced-orthogonal-persistence'] }]);
    expect(result.mopsToml?.mode).toBe('create');
    expect(result.mopsToml?.text).toContain(`moc = "${CONVERTED_MOC_VERSION}"`);
    expect(result.mopsToml?.text).toContain('[canisters.backend]\nmain = "backend/app.mo"\nargs = ["--enhanced-orthogonal-persistence"]');
  });

  it('converts asset canisters to static-site with build steps', () => {
    const config = parse(convertDfxJson(motokoWithRemote, { rootPackageJsonHasBuild: true }).icpYaml);
    expect(config.canisters[1]).toEqual({
      name: 'frontend',
      recipe: { type: '@dfinity/static-site@v0.4.3', configuration: { dir: 'frontend/dist', build: ['npm install', 'npm run build'] } },
    });
  });

  it('can use the asset-canister recipe instead', () => {
    const config = parse(convertDfxJson(motokoWithRemote, {}, { assetRecipe: 'asset-canister' }).icpYaml);
    expect(config.canisters[1].recipe.type).toBe('@dfinity/asset-canister@v2.3.0');
  });

  it('skips remote canisters and explains why', () => {
    const result = convertDfxJson(motokoWithRemote);
    expect(parse(result.icpYaml).canisters.map((c: any) => c.name)).toEqual(['backend', 'frontend']);
    expect(result.skipped[0]).toMatchObject({ name: 'llm' });
    expect(result.skipped[0].reason).toMatch(/specified_id/);
    expect(result.notes.join(' ')).toMatch(/dependencies/);
    expect(result.notes.join(' ')).toMatch(/ic_env cookie/);
  });

  it('maps Internet Identity to ii: true on the local network', () => {
    const config = parse(convertDfxJson(rustWithIdentity).icpYaml);
    expect(config.networks).toEqual([{ name: 'local', mode: 'managed', ii: true }]);
    expect(config.canisters.some((c: any) => c.name === 'internet_identity')).toBe(false);
  });

  it('turns a custom Rust build into a script step with candid metadata', () => {
    const config = parse(convertDfxJson(rustWithIdentity).icpYaml);
    const backend = config.canisters.find((c: any) => c.name === 'backend');
    expect(backend.init_args).toBe('(variant { mainnet })');
    expect(backend.build.steps[0].type).toBe('script');
    expect(backend.build.steps[0].commands).toEqual([
      'sh build.sh',
      'cp "target/wasm32-unknown-unknown/release/backend.wasm" "$ICP_WASM_OUTPUT_PATH"',
      'ic-wasm "$ICP_WASM_OUTPUT_PATH" -o "$ICP_WASM_OUTPUT_PATH" metadata candid:service -f "src/backend/backend.did" -v public --keep-name-section',
    ]);
  });

  it('keeps package only when it differs from the canister name', () => {
    const config = parse(convertDfxJson(rustWithIdentity).icpYaml);
    expect(config.canisters.find((c: any) => c.name === 'api').recipe).toEqual({
      type: '@dfinity/rust@v3.4.0',
      configuration: { package: 'api_crate', candid: 'src/api/api.did', compress: true },
    });
  });

  it('maps networks: persistent to connected, ephemeral to managed', () => {
    const result = convertDfxJson({
      canisters: {},
      networks: {
        staging: { providers: ['https://icp-api.io'], type: 'persistent' },
        testnet: { providers: ['https://testnet.example.com'], type: 'persistent' },
        local: { bind: '127.0.0.1:4943', type: 'ephemeral' },
      },
    });
    expect(parse(result.icpYaml).networks).toEqual([
      { name: 'staging', mode: 'connected', url: 'https://icp-api.io', 'root-key': 'mainnet' },
      { name: 'testnet', mode: 'connected', url: 'https://testnet.example.com', 'root-key': 'fetch' },
      { name: 'local', mode: 'managed', gateway: { bind: '127.0.0.1', port: 4943 } },
    ]);
    expect(result.warnings.join(' ')).toMatch(/fetch/);
  });

  it('produces icp.yaml that passes the structural check', () => {
    for (const dfx of [motokoWithRemote, rustWithIdentity]) {
      expect(validateIcpYamlText(convertDfxJson(dfx).icpYaml).issues.filter(i => i.severity === 'error')).toEqual([]);
    }
  });

  it('carries mainnet ids from canister_ids.json', () => {
    const result = convertDfxJson(motokoWithRemote, { canisterIds: { backend: { ic: 'aaaaa-aa' }, llm: { ic: 'bbbbb-bb' } } });
    expect(result.idMappings).toEqual({ backend: 'aaaaa-aa' });
  });

  it('warns about canister: imports', () => {
    const result = convertDfxJson(motokoWithRemote, { motokoCanisterImports: { backend: ['llm'] } });
    expect(result.warnings.join(' ')).toMatch(/"canister:llm"/);
  });

  it('explains how to supply interfaces for ic: imports', () => {
    const result = convertDfxJson(motokoWithRemote, { motokoIcImports: { backend: ['aaaaa-aa'] } });
    const warning = result.warnings.join(' ');
    expect(warning).toMatch(/"ic:aaaaa-aa"/);
    expect(warning).toContain('--actor-idl');
    expect(warning).toContain('https://docs.internetcomputer.org/references/ic.did');
  });
});

describe('mergeMopsToml', () => {
  it('adds toolchain, persistence flag and canister tables to an existing file', () => {
    const notes: string[] = [];
    const merged = mergeMopsToml('[dependencies]\ncore = "1.0.0"\n', [{ name: 'backend', main: 'src/main.mo' }], notes);
    expect(merged.mode).toBe('update');
    expect(merged.text).toContain('[dependencies]\ncore = "1.0.0"');
    expect(merged.text).toContain(`[toolchain]\nmoc = "${CONVERTED_MOC_VERSION}"`);
    expect(merged.text).toContain('[moc]\nargs = ["--default-persistent-actors"]');
    expect(merged.text).toContain('[canisters.backend]');
  });

  it('inserts moc into an existing toolchain table', () => {
    const merged = mergeMopsToml('[toolchain]\npocket-ic = "15.0.0"\n\n[canisters.backend]\nmain = "a.mo"\n', [{ name: 'backend', main: 'a.mo' }], []);
    expect(merged.mode).toBe('update');
    expect(merged.text).toMatch(/\[toolchain\]\nmoc = "[\d.]+"\npocket-ic/);
  });

  it('leaves a complete file unchanged', () => {
    const text = '[toolchain]\nmoc = "2.2.3"\n\n[canisters.backend]\nmain = "a.mo"\n';
    expect(mergeMopsToml(text, [{ name: 'backend', main: 'a.mo' }], [])).toEqual({ text, mode: 'unchanged' });
  });
});

describe('convertProject', () => {
  it('previews by default and writes only on request, never touching dfx.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ic-mcp-convert-'));
    try {
      await mkdir(join(dir, 'src'));
      const dfxText = JSON.stringify({ canisters: { backend: { type: 'motoko', main: 'src/main.mo' } } });
      await writeFile(join(dir, 'dfx.json'), dfxText);
      await writeFile(join(dir, 'src', 'main.mo'), 'import Other "canister:other";\nactor {}\n');
      await writeFile(join(dir, 'canister_ids.json'), '{"backend":{"ic":"aaaaa-aa"}}');

      const preview = await convertProject(dir);
      expect(preview.written).toBe(false);
      expect(existsSync(join(dir, 'icp.yaml'))).toBe(false);
      expect(preview.warnings.join(' ')).toMatch(/canister:other/);

      const written = await convertProject(dir, { write: true });
      expect(written.files.map(f => f.action)).toEqual(['create', 'create', 'create']);
      expect(await readFile(join(dir, 'icp.yaml'), 'utf-8')).toContain('@dfinity/motoko@v5.1.0');
      expect(await readFile(join(dir, 'mops.toml'), 'utf-8')).toContain('[canisters.backend]');
      expect(JSON.parse(await readFile(join(dir, '.icp', 'data', 'mappings', 'ic.ids.json'), 'utf-8'))).toEqual({ backend: 'aaaaa-aa' });
      expect(await readFile(join(dir, 'dfx.json'), 'utf-8')).toBe(dfxText);

      const again = await convertProject(dir, { write: true });
      expect(again.files[0]).toMatchObject({ action: 'skip' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
