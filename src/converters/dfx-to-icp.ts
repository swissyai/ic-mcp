/**
 * dfx.json to icp.yaml conversion.
 *
 * Mapping follows the icp-cli migration guide
 * (https://cli.internetcomputer.org/1.8/migration/from-dfx.md) and the current
 * recipe releases:
 * - motoko  -> @dfinity/motoko recipe; main, args and candid move to mops.toml [canisters.<name>]
 * - rust    -> @dfinity/rust recipe (package only when it differs from the canister name)
 * - assets  -> @dfinity/static-site recipe (or @dfinity/asset-canister on request)
 * - custom  -> script build step, or a pre-built step for a wasm URL or file
 * - canisters with `remote` ids are not converted: they already exist on mainnet
 * - networks: persistent -> connected, ephemeral -> managed
 * - canister_ids.json mainnet ids -> .icp/data/mappings/ic.ids.json
 *
 * Nothing is deleted. Existing icp.yaml is not overwritten unless asked.
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { stringify } from 'yaml';

export const RECIPES = {
  motoko: '@dfinity/motoko@v5.1.0',
  rust: '@dfinity/rust@v3.4.0',
  staticSite: '@dfinity/static-site@v0.4.3',
  assetCanister: '@dfinity/asset-canister@v2.3.0',
} as const;

/**
 * moc version pinned when a converted project has no [toolchain] moc.
 * Latest 1.x: code written for dfx-era moc builds on it, and it meets the
 * writing-motoko skill's minimum (moc >= 1.16.0). Moving to moc 2 is a
 * separate step (migrating-to-moc-2 skill).
 */
export const CONVERTED_MOC_VERSION = '1.16.1';

const MAINNET_HOSTS = ['icp0.io', 'ic0.app', 'icp-api.io'];

export interface ProjectFacts {
  /** Root package.json defines a "build" script. */
  rootPackageJsonHasBuild?: boolean;
  /** Text of an existing root mops.toml. */
  existingMopsToml?: string;
  /** Parsed canister_ids.json. */
  canisterIds?: Record<string, Record<string, string>>;
  /** `canister:<name>` imports found in each Motoko canister's sources. */
  motokoCanisterImports?: Record<string, string[]>;
  /** `ic:<principal>` imports found in each Motoko canister's sources. */
  motokoIcImports?: Record<string, string[]>;
}

export interface ConversionOptions {
  assetRecipe?: 'static-site' | 'asset-canister';
}

export interface MopsCanister {
  name: string;
  main: string;
  args?: string[];
  candid?: string;
}

export interface ConversionResult {
  icpYaml: string;
  icpConfig: Record<string, any>;
  mopsCanisters: MopsCanister[];
  /** TOML text for the [canisters] entries (and toolchain pin when needed). */
  mopsTomlSnippet: string;
  /** Complete mops.toml to write, or null when no Motoko canister exists. */
  mopsToml: { text: string; mode: 'create' | 'update' | 'unchanged' } | null;
  idMappings: Record<string, string> | null;
  notes: string[];
  warnings: string[];
  skipped: Array<{ name: string; reason: string }>;
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

function splitArgs(args: unknown): string[] {
  if (Array.isArray(args)) return args.map(String);
  if (typeof args !== 'string') return [];
  return (args.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(a => a.replace(/^["']|["']$/g, ''));
}

/**
 * dfx runs a bare relative script name such as `build.sh` from the project
 * root; a shell step looks bare names up on PATH, so run the script with sh.
 */
function scriptCommand(command: string): string {
  return /^(?!\.?\/)[\w.\/-]+\.sh$/.test(command.trim()) ? `sh ${command.trim()}` : command;
}

function isUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}

function tomlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function renderMopsCanister(c: MopsCanister): string {
  const lines = [`[canisters.${tomlKey(c.name)}]`, `main = ${tomlString(c.main)}`];
  if (c.candid) lines.push(`candid = ${tomlString(c.candid)}`);
  if (c.args && c.args.length > 0) lines.push(`args = [${c.args.map(tomlString).join(', ')}]`);
  return lines.join('\n');
}

function hasTomlTable(text: string, table: string): boolean {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*\\[${escaped}\\]\\s*$`, 'm').test(text);
}

/** Add missing [toolchain] moc, [moc] args and [canisters.<name>] tables to mops.toml text. */
export function mergeMopsToml(
  existing: string | undefined,
  canisters: MopsCanister[],
  notes: string[]
): { text: string; mode: 'create' | 'update' | 'unchanged' } {
  const pinnedHere = !existing || !/^\s*moc\s*=/m.test(sectionBody(existing, 'toolchain'));
  let text = existing ? existing.replace(/\s*$/, '\n') : '';
  let insertedPin = false;
  const additions: string[] = [];

  if (!existing || !hasTomlTable(existing, 'toolchain')) {
    additions.push(`[toolchain]\nmoc = ${tomlString(CONVERTED_MOC_VERSION)}`);
  } else if (pinnedHere) {
    text = text.replace(/^([ \t]*\[toolchain\][ \t]*)$/m, `$1\nmoc = ${tomlString(CONVERTED_MOC_VERSION)}`);
    insertedPin = true;
  }
  if (pinnedHere) {
    notes.push(
      `Pinned moc ${CONVERTED_MOC_VERSION} in mops.toml [toolchain]. Move to moc 2 later with the migrating-to-moc-2 skill.`
    );
    if (!existing || !hasTomlTable(existing, 'moc')) {
      additions.push('[moc]\nargs = ["--default-persistent-actors"]');
      notes.push('Added [moc] args = ["--default-persistent-actors"], which moc 1 needs for a plain `actor`.');
    }
  }

  for (const canister of canisters) {
    if (existing && hasTomlTable(existing, `canisters.${tomlKey(canister.name)}`)) {
      notes.push(`mops.toml already has [canisters.${canister.name}]; left unchanged.`);
      continue;
    }
    additions.push(renderMopsCanister(canister));
  }

  if (!existing) {
    return { text: additions.join('\n\n') + '\n', mode: 'create' };
  }
  if (additions.length === 0) {
    return insertedPin ? { text, mode: 'update' } : { text: existing, mode: 'unchanged' };
  }
  return { text: `${text}\n${additions.join('\n\n')}\n`, mode: 'update' };
}

function sectionBody(text: string, table: string): string {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^\\s*\\[${escaped}\\]\\s*$([\\s\\S]*?)(?=^\\s*\\[|$(?![\\s\\S]))`, 'm'));
  return match ? match[1] : '';
}

function convertNetwork(name: string, net: any, warnings: string[]): any | null {
  if (name === 'ic') {
    return null;
  }
  const type = net?.type;
  const providers = toArray(net?.providers);
  if (providers.length > 0 || type === 'persistent') {
    const url = providers[0];
    if (!url) {
      warnings.push(`Network "${name}" has no providers URL; not converted.`);
      return null;
    }
    if (providers.length > 1) {
      warnings.push(`Network "${name}" lists ${providers.length} providers; icp-cli takes one url, using ${url}.`);
    }
    const host = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    })();
    const mainnet = MAINNET_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
    if (!mainnet) {
      warnings.push(
        `Network "${name}": root-key set to "fetch" (trust on first use, as dfx did). Pin the hex root key for a network you rely on.`
      );
    }
    return { name, mode: 'connected', url, 'root-key': mainnet ? 'mainnet' : 'fetch' };
  }
  const bind: string | undefined = net?.bind;
  const network: any = { name, mode: 'managed' };
  if (bind) {
    const [host, port] = bind.split(':');
    network.gateway = { ...(host ? { bind: host } : {}), ...(port ? { port: Number(port) } : {}) };
  }
  return network;
}

/**
 * Convert parsed dfx.json content. Pure: reads nothing from disk.
 */
export function convertDfxJson(
  dfx: any,
  facts: ProjectFacts = {},
  options: ConversionOptions = {}
): ConversionResult {
  const notes: string[] = [];
  const warnings: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const canisters: any[] = [];
  const mopsCanisters: MopsCanister[] = [];
  let needsInternetIdentity = false;
  let hadDependencies = false;

  const entries = Object.entries<any>(dfx?.canisters || {});
  if (entries.length === 0) {
    warnings.push('dfx.json defines no canisters.');
  }

  for (const [name, def] of entries) {
    const type = def?.type || (typeof def?.main === 'string' && def.main.endsWith('.mo') ? 'motoko' : 'custom');
    if (Array.isArray(def?.dependencies) && def.dependencies.length > 0) {
      hadDependencies = true;
    }

    if (def?.remote?.id?.ic) {
      const isII = /internet[_-]?identity/i.test(name) || /internet_identity/.test(String(def?.wasm || ''));
      if (isII) {
        needsInternetIdentity = true;
        skipped.push({
          name,
          reason: `Internet Identity is provided by the network (mainnet id ${def.remote.id.ic}); the local network installs it with ii: true.`,
        });
      } else {
        skipped.push({
          name,
          reason: `Exists on mainnet as ${def.remote.id.ic}. icp-cli has no specified_id, so a local copy would get a different id: read the id from configuration, or add a pre-built canister for local tests.`,
        });
      }
      continue;
    }

    const initArgs = def?.init_arg
      ? { init_args: String(def.init_arg) }
      : def?.init_arg_file
        ? { init_args: { path: String(def.init_arg_file), format: 'candid' } }
        : {};

    switch (type) {
      case 'motoko': {
        if (!def?.main) {
          warnings.push(`Motoko canister "${name}" has no main file; add it to mops.toml [canisters.${name}].`);
        }
        const args = splitArgs(def?.args);
        mopsCanisters.push({
          name,
          main: String(def?.main || 'src/main.mo'),
          ...(args.length > 0 ? { args } : {}),
          ...(def?.candid ? { candid: String(def.candid) } : {}),
        });
        canisters.push({ name, recipe: { type: RECIPES.motoko }, ...initArgs });
        const icImports = facts.motokoIcImports?.[name] || [];
        if (icImports.length > 0) {
          warnings.push(
            `Motoko canister "${name}" imports ${icImports.map(i => `"ic:${i}"`).join(', ')}. dfx supplied these interfaces; mops build needs them: ` +
              `save each as <dir>/<principal>.did (the management canister interface is https://docs.internetcomputer.org/references/ic.did) ` +
              `and add args = ["--actor-idl", "<dir>"] to [canisters.${name}] in mops.toml, or call the management canister through the ic mops package. ` +
              'The current interface can require fields that older code omits.'
          );
        }
        const imports = facts.motokoCanisterImports?.[name] || [];
        if (imports.length > 0) {
          warnings.push(
            `Motoko canister "${name}" imports ${imports.map(i => `"canister:${i}"`).join(', ')}. ` +
              'icp-cli injects canister ids as PUBLIC_CANISTER_ID:<name>; read them with Runtime.envVar and call through an actor reference.'
          );
        }
        break;
      }
      case 'rust': {
        const configuration: Record<string, any> = {};
        if (def?.package && def.package !== name) configuration.package = String(def.package);
        if (def?.candid) configuration.candid = String(def.candid);
        if (def?.shrink === true) configuration.shrink = true;
        if (def?.gzip === true) configuration.compress = true;
        canisters.push({
          name,
          recipe: { type: RECIPES.rust, ...(Object.keys(configuration).length > 0 ? { configuration } : {}) },
          ...initArgs,
        });
        break;
      }
      case 'assets': {
        const sources = toArray(def?.source);
        const dir = sources[0] || 'dist';
        if (sources.length > 1) {
          warnings.push(`Asset canister "${name}" lists ${sources.length} source dirs; the recipe syncs one dir, using "${dir}".`);
        }
        let build = toArray(def?.build);
        if (build.length === 0 && typeof def?.workspace === 'string') {
          build = ['npm install', `npm run build --workspace ${def.workspace}`];
        } else if (build.length === 0 && facts.rootPackageJsonHasBuild) {
          build = ['npm install', 'npm run build'];
        }
        if (build.length === 0) {
          notes.push(`Asset canister "${name}": no build commands found. dfx ran "npm run build" implicitly; add build steps if "${dir}" is generated.`);
        }
        const recipeType = options.assetRecipe === 'asset-canister' ? RECIPES.assetCanister : RECIPES.staticSite;
        canisters.push({
          name,
          recipe: { type: recipeType, configuration: { dir, ...(build.length > 0 ? { build } : {}) } },
        });
        if (def?.output_env_file || dfx?.output_env_file) {
          notes.push('icp-cli writes no .env with canister ids; the frontend canister serves them in the ic_env cookie.');
        }
        break;
      }
      case 'custom': {
        const wasm = def?.wasm;
        const build = toArray(def?.build);
        if (isUrl(wasm) && build.length === 0) {
          canisters.push({
            name,
            build: { steps: [{ type: 'pre-built', url: wasm }] },
            ...initArgs,
          });
          notes.push(`Canister "${name}" downloads ${wasm}. Add sha256 to its pre-built step to pin the file.`);
        } else if (typeof wasm === 'string' && build.length === 0) {
          canisters.push({ name, build: { steps: [{ type: 'pre-built', path: wasm }] }, ...initArgs });
        } else if (typeof wasm === 'string') {
          const commands = [...build.map(scriptCommand), `cp "${wasm}" "$ICP_WASM_OUTPUT_PATH"`];
          if (def?.candid && !isUrl(def.candid)) {
            commands.push(
              `ic-wasm "$ICP_WASM_OUTPUT_PATH" -o "$ICP_WASM_OUTPUT_PATH" metadata candid:service -f "${def.candid}" -v public --keep-name-section`
            );
          }
          if (def?.shrink === true) {
            commands.push('ic-wasm "$ICP_WASM_OUTPUT_PATH" -o "$ICP_WASM_OUTPUT_PATH" shrink');
          }
          canisters.push({ name, build: { steps: [{ type: 'script', commands }] }, ...initArgs });
          if (def?.gzip === true || /\.gz$/.test(wasm)) {
            notes.push(`Canister "${name}": gzip output from dfx is not reproduced; the wasm is installed uncompressed.`);
          }
          if (def?.package) {
            notes.push(
              `Canister "${name}" builds Rust package "${def.package}" with a script. The ${RECIPES.rust} recipe may replace the script if it only runs cargo.`
            );
          }
        } else {
          skipped.push({ name, reason: 'Custom canister without a wasm path; add a build section by hand.' });
        }
        break;
      }
      case 'pull':
        skipped.push({ name, reason: 'dfx deps "pull" canisters have no icp-cli equivalent.' });
        break;
      default:
        skipped.push({ name, reason: `Unsupported canister type "${type}".` });
    }
  }

  const networks: any[] = [];
  for (const [name, net] of Object.entries<any>(dfx?.networks || {})) {
    const converted = convertNetwork(name, net, warnings);
    if (converted) networks.push(converted);
  }
  if (needsInternetIdentity) {
    const local = networks.find(n => n.name === 'local');
    if (local && local.mode === 'managed') {
      local.ii = true;
    } else if (!local) {
      networks.push({ name: 'local', mode: 'managed', ii: true });
    }
  }

  if (hadDependencies) {
    notes.push(
      'dfx "dependencies" were dropped: icp-cli builds canisters in parallel and injects every id as PUBLIC_CANISTER_ID:<name>.'
    );
  }
  if (dfx?.defaults?.build?.packtool) {
    notes.push('defaults.build.packtool was dropped: the Motoko recipe builds with mops directly.');
  }
  if (Object.values<any>(dfx?.canisters || {}).some(c => c?.declarations)) {
    notes.push('dfx "declarations" were dropped: generate TypeScript bindings with @icp-sdk/bindgen.');
  }

  let idMappings: Record<string, string> | null = null;
  if (facts.canisterIds) {
    const ids: Record<string, string> = {};
    for (const [name, byNetwork] of Object.entries(facts.canisterIds)) {
      const id = byNetwork?.ic;
      if (typeof id === 'string' && canisters.some(c => c.name === name)) ids[name] = id;
    }
    if (Object.keys(ids).length > 0) {
      idMappings = ids;
      notes.push('Mainnet canister ids from canister_ids.json go to .icp/data/mappings/ic.ids.json. Commit .icp/data/.');
    }
  }

  const icpConfig: Record<string, any> = { canisters };
  if (networks.length > 0) icpConfig.networks = networks;

  const mopsToml = mopsCanisters.length > 0 ? mergeMopsToml(facts.existingMopsToml, mopsCanisters, notes) : null;
  if (mopsCanisters.length > 0 && !facts.existingMopsToml) {
    notes.push('Created mops.toml. Add the libraries the code imports with `mops add core` (one package per command).');
  }

  return {
    icpYaml: stringify(icpConfig, { lineWidth: 0 }),
    icpConfig,
    mopsCanisters,
    mopsTomlSnippet: mopsCanisters.map(renderMopsCanister).join('\n\n'),
    mopsToml,
    idMappings,
    notes,
    warnings,
    skipped,
  };
}

async function readJson(path: string): Promise<any | undefined> {
  if (!existsSync(path)) return undefined;
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function findActorImports(projectPath: string, main: string): Promise<{ canister: string[]; ic: string[] }> {
  const dir = join(projectPath, dirname(main));
  const found = new Set<string>();
  const ic = new Set<string>();
  const walk = async (current: string, depth: number) => {
    if (depth > 4 || !existsSync(current)) return;
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.mo')) {
        const text = await readFile(full, 'utf-8');
        for (const match of text.matchAll(/import\s+\w+\s+"canister:([^"]+)"/g)) {
          found.add(match[1]);
        }
        for (const match of text.matchAll(/import\s+\w+\s+"ic:([^"]+)"/g)) {
          ic.add(match[1]);
        }
      }
    }
  };
  await walk(dir, 0);
  return { canister: [...found], ic: [...ic] };
}

export interface ProjectConversion extends ConversionResult {
  projectPath: string;
  files: Array<{ path: string; action: 'create' | 'update' | 'skip'; reason?: string }>;
  written: boolean;
}

/**
 * Convert the dfx.json in a project directory. With `write`, creates icp.yaml,
 * creates or extends mops.toml, and writes .icp/data/mappings/ic.ids.json when
 * it does not exist. dfx.json is left in place.
 */
export async function convertProject(
  projectPath: string,
  options: ConversionOptions & { write?: boolean; overwrite?: boolean } = {}
): Promise<ProjectConversion> {
  const dfxPath = join(projectPath, 'dfx.json');
  const dfx = await readJson(dfxPath);
  if (!dfx) {
    throw new Error(`No dfx.json in ${projectPath}`);
  }

  const packageJson = await readJson(join(projectPath, 'package.json')).catch(() => undefined);
  const mopsPath = join(projectPath, 'mops.toml');
  const existingMopsToml = existsSync(mopsPath) ? await readFile(mopsPath, 'utf-8') : undefined;
  const canisterIds = await readJson(join(projectPath, 'canister_ids.json')).catch(() => undefined);

  const motokoCanisterImports: Record<string, string[]> = {};
  const motokoIcImports: Record<string, string[]> = {};
  for (const [name, def] of Object.entries<any>(dfx.canisters || {})) {
    if ((def?.type === 'motoko' || String(def?.main || '').endsWith('.mo')) && typeof def?.main === 'string') {
      const imports = await findActorImports(projectPath, def.main);
      motokoCanisterImports[name] = imports.canister;
      motokoIcImports[name] = imports.ic;
    }
  }

  const result = convertDfxJson(
    dfx,
    {
      rootPackageJsonHasBuild: Boolean(packageJson?.scripts?.build),
      existingMopsToml,
      canisterIds,
      motokoCanisterImports,
      motokoIcImports,
    },
    options
  );

  const files: ProjectConversion['files'] = [];
  const icpPath = join(projectPath, 'icp.yaml');
  const icpExists = existsSync(icpPath);
  files.push(
    icpExists && !options.overwrite
      ? { path: icpPath, action: 'skip', reason: 'icp.yaml exists; pass overwrite to replace it' }
      : { path: icpPath, action: icpExists ? 'update' : 'create' }
  );
  if (result.mopsToml && result.mopsToml.mode !== 'unchanged') {
    files.push({ path: mopsPath, action: result.mopsToml.mode });
  }
  const mappingPath = join(projectPath, '.icp', 'data', 'mappings', 'ic.ids.json');
  if (result.idMappings) {
    files.push(
      existsSync(mappingPath)
        ? { path: mappingPath, action: 'skip', reason: 'mapping file exists' }
        : { path: mappingPath, action: 'create' }
    );
  }

  if (options.write) {
    for (const file of files) {
      if (file.action === 'skip') continue;
      if (file.path === icpPath) {
        await writeFile(icpPath, result.icpYaml, 'utf-8');
      } else if (file.path === mopsPath && result.mopsToml) {
        await writeFile(mopsPath, result.mopsToml.text, 'utf-8');
      } else if (file.path === mappingPath && result.idMappings) {
        await mkdir(dirname(mappingPath), { recursive: true });
        await writeFile(mappingPath, JSON.stringify(result.idMappings, null, 2) + '\n', 'utf-8');
      }
    }
  }

  return { ...result, projectPath, files, written: Boolean(options.write) };
}
