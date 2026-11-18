/**
 * Reading icp.yaml projects (https://cli.internetcomputer.org/1.8/reference/configuration/).
 *
 * Canisters are inline objects or references to canister.yaml files (a path,
 * a directory, or a `dir/*` glob). Networks and environments are arrays; the
 * implicit `local` (managed) and `ic` (mainnet) entries always exist.
 */

import { readFile, readdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import type { ValidationIssue, ValidationResult } from '../types/index.js';
import { REFS } from '../data/references.js';

export type CanisterKind = 'motoko' | 'rust' | 'static-site' | 'asset-canister' | 'prebuilt' | 'build-steps' | 'other';

export interface IcpCanister {
  name: string;
  kind: CanisterKind;
  recipe?: string;
  /** Directory the canister builds from (project root for inline canisters). */
  dir: string;
  definedIn: string;
}

export interface IcpNetwork {
  name: string;
  mode: string;
  url?: string;
}

export interface IcpEnvironment {
  name: string;
  network: string;
  canisters?: string[];
}

export interface IcpProject {
  root: string;
  canisters: IcpCanister[];
  networks: IcpNetwork[];
  environments: IcpEnvironment[];
  problems: string[];
}

const MAINNET_HOSTS = ['icp-api.io', 'icp0.io', 'ic0.app'];

function kindOf(def: any): { kind: CanisterKind; recipe?: string } {
  const recipe = typeof def?.recipe?.type === 'string' ? def.recipe.type : undefined;
  if (recipe) {
    if (recipe.includes('/motoko')) return { kind: 'motoko', recipe };
    if (recipe.includes('/rust')) return { kind: 'rust', recipe };
    if (recipe.includes('/static-site')) return { kind: 'static-site', recipe };
    if (recipe.includes('/asset-canister')) return { kind: 'asset-canister', recipe };
    if (recipe.includes('/prebuilt')) return { kind: 'prebuilt', recipe };
    return { kind: 'other', recipe };
  }
  if (def?.build) return { kind: 'build-steps' };
  return { kind: 'other' };
}

async function readYaml(path: string): Promise<any> {
  return parseYaml(await readFile(path, 'utf-8'));
}

async function canisterFilesFor(root: string, ref: string): Promise<string[]> {
  const cleaned = ref.replace(/\/+$/, '');
  if (cleaned.endsWith('/*') || cleaned.endsWith('/**')) {
    const base = join(root, cleaned.replace(/\/\*+$/, ''));
    if (!existsSync(base)) return [];
    const found: string[] = [];
    for (const entry of await readdir(base, { withFileTypes: true })) {
      const candidate = join(base, entry.name, 'canister.yaml');
      if (entry.isDirectory() && existsSync(candidate)) found.push(candidate);
    }
    return found;
  }
  const full = join(root, cleaned);
  if (/\.ya?ml$/.test(full)) return existsSync(full) ? [full] : [];
  const inDir = join(full, 'canister.yaml');
  return existsSync(inDir) ? [inDir] : [];
}

export async function readIcpProject(root: string): Promise<IcpProject | null> {
  const icpPath = join(root, 'icp.yaml');
  if (!existsSync(icpPath)) return null;
  const problems: string[] = [];
  let config: any;
  try {
    config = (await readYaml(icpPath)) || {};
  } catch (error: any) {
    return { root, canisters: [], networks: [], environments: [], problems: [`icp.yaml does not parse: ${error.message}`] };
  }

  const canisters: IcpCanister[] = [];
  const entries = Array.isArray(config.canisters) ? config.canisters : [];
  if (config.canisters && !Array.isArray(config.canisters)) {
    problems.push('icp.yaml "canisters" must be an array.');
  }
  for (const entry of entries) {
    if (typeof entry === 'string') {
      const files = await canisterFilesFor(root, entry);
      if (files.length === 0) problems.push(`No canister.yaml found for "${entry}".`);
      for (const file of files) {
        try {
          const def = (await readYaml(file)) || {};
          canisters.push({ name: String(def.name || ''), ...kindOf(def), dir: dirname(file), definedIn: file });
        } catch (error: any) {
          problems.push(`${file} does not parse: ${error.message}`);
        }
      }
    } else if (entry && typeof entry === 'object') {
      canisters.push({ name: String(entry.name || ''), ...kindOf(entry), dir: root, definedIn: icpPath });
    }
  }

  const networks: IcpNetwork[] = [
    { name: 'local', mode: 'managed' },
    { name: 'ic', mode: 'connected', url: 'https://icp-api.io' },
  ];
  if (Array.isArray(config.networks)) {
    for (const net of config.networks) {
      if (net && typeof net === 'object' && net.name) {
        const existing = networks.findIndex(n => n.name === net.name);
        const value = { name: String(net.name), mode: String(net.mode || 'managed'), ...(net.url ? { url: String(net.url) } : {}) };
        if (existing >= 0) networks[existing] = value;
        else networks.push(value);
      }
    }
  } else if (config.networks) {
    problems.push('icp.yaml "networks" must be an array.');
  }

  const environments: IcpEnvironment[] = [
    { name: 'local', network: 'local' },
    { name: 'ic', network: 'ic' },
  ];
  if (Array.isArray(config.environments)) {
    for (const env of config.environments) {
      if (env && typeof env === 'object' && env.name) {
        const value = {
          name: String(env.name),
          network: String(env.network || ''),
          ...(Array.isArray(env.canisters) ? { canisters: env.canisters.map(String) } : {}),
        };
        const existing = environments.findIndex(e => e.name === value.name);
        if (existing >= 0) environments[existing] = value;
        else environments.push(value);
      }
    }
  } else if (config.environments) {
    problems.push('icp.yaml "environments" must be an array.');
  }

  return { root: resolve(root), canisters, networks, environments, problems };
}

export type TargetClass = 'local' | 'mainnet' | 'remote' | 'unknown';

/**
 * Classify where an environment deploys. Unknown environments are treated by
 * callers as remote.
 */
export function classifyEnvironment(project: IcpProject | null, environment: string): TargetClass {
  if (environment === 'local') return 'local';
  if (environment === 'ic') return 'mainnet';
  const env = project?.environments.find(e => e.name === environment);
  if (!env) return 'unknown';
  if (env.network === 'ic') return 'mainnet';
  const network = project?.networks.find(n => n.name === env.network);
  if (!network) return 'unknown';
  if (network.mode === 'managed') return 'local';
  try {
    const host = network.url ? new URL(network.url).hostname : '';
    if (MAINNET_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) return 'mainnet';
  } catch {
    return 'remote';
  }
  return 'remote';
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

const RECIPE_FIELDS = new Set(['name', 'recipe', 'sync', 'settings', 'init_args', 'upgrade_args']);
const BUILD_FIELDS = new Set(['name', 'build', 'sync', 'settings', 'init_args', 'upgrade_args']);

/**
 * Structural checks for icp.yaml text, covering the common mistakes listed in
 * the icp-cli skill: map-shaped sections, unpinned recipes, and fields that are
 * invalid next to a recipe.
 */
export function validateIcpYamlText(text: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  let config: any;
  try {
    config = parseYaml(text);
  } catch (error: any) {
    return { valid: false, issues: [{ severity: 'error', message: `YAML does not parse: ${error.message}` }] };
  }
  if (!config || typeof config !== 'object') {
    return { valid: false, issues: [{ severity: 'error', message: 'icp.yaml must be a mapping with a "canisters" array.' }] };
  }

  for (const key of ['canisters', 'networks', 'environments']) {
    if (config[key] !== undefined && !Array.isArray(config[key])) {
      issues.push({
        severity: 'error',
        message: `"${key}" must be an array of entries, not a map.`,
        references: [REFS.icpYamlReference],
      });
    }
  }
  if (!config.canisters) {
    issues.push({ severity: 'error', message: 'Missing "canisters".', references: [REFS.icpYamlReference] });
  }

  const names = new Set<string>();
  for (const entry of Array.isArray(config.canisters) ? config.canisters : []) {
    if (typeof entry === 'string') continue;
    if (!entry || typeof entry !== 'object') {
      issues.push({ severity: 'error', message: 'Each canister is an object or a path to a canister.yaml.' });
      continue;
    }
    const name = entry.name;
    if (!name) {
      issues.push({ severity: 'error', message: 'A canister has no "name".' });
    } else if (names.has(name)) {
      issues.push({ severity: 'error', message: `Duplicate canister name "${name}".` });
    } else {
      names.add(name);
    }
    if (entry.recipe && entry.build) {
      issues.push({ severity: 'error', message: `Canister "${name}": "recipe" and "build" cannot be combined.` });
    }
    if (!entry.recipe && !entry.build) {
      issues.push({ severity: 'error', message: `Canister "${name}": needs "recipe" or "build".` });
    }
    const type = entry.recipe?.type;
    if (typeof type === 'string' && type.startsWith('@') && !/@v?\d+\.\d+\.\d+$/.test(type)) {
      issues.push({
        severity: 'error',
        message: `Canister "${name}": recipe "${type}" is not pinned to a version (e.g. "@dfinity/rust@v3.4.0").`,
        references: [REFS.icpCli],
      });
    }
    const allowed = entry.recipe ? RECIPE_FIELDS : BUILD_FIELDS;
    for (const field of Object.keys(entry)) {
      if (!allowed.has(field)) {
        issues.push({
          severity: 'error',
          message: `Canister "${name}": "${field}" is not a canister-level field${entry.recipe ? ' next to a recipe; recipe options go in recipe.configuration' : ''}.`,
          references: [REFS.icpYamlReference],
        });
      }
    }
    if (typeof type === 'string' && type.includes('/motoko@') && entry.recipe?.configuration?.main) {
      issues.push({
        severity: 'warning',
        message: `Canister "${name}": the Motoko recipe v5+ reads main, candid and args from mops.toml [canisters.${name}], not recipe.configuration.`,
        references: [REFS.icpCli, REFS.mopsCli],
      });
    }
  }

  for (const env of Array.isArray(config.environments) ? config.environments : []) {
    if (env && typeof env === 'object' && !env.network) {
      issues.push({ severity: 'error', message: `Environment "${env.name}" has no "network".` });
    }
  }

  return { valid: !issues.some(i => i.severity === 'error'), issues };
}
