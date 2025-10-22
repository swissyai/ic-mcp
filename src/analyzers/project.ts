/**
 * ICP Project Structure Analysis
 * Parses dfx.json and analyzes entire project structure
 */

import { readFile, readdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';

/**
 * Canister information
 */
export interface CanisterInfo {
  name: string;
  type: 'motoko' | 'rust' | 'custom' | 'assets';
  main?: string;
  candid?: string;
  dependencies: string[];
  sourceFiles: string[];
  linesOfCode: number;
  mainPath?: string;
  packageName?: string;
  wasm?: string;
}

/**
 * Project issue
 */
export interface ProjectIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  canisters?: string[];
  file?: string;
}

/**
 * dfx.json structure
 */
export interface DfxConfig {
  version?: number;
  dfx?: string;
  canisters: Record<string, any>;
  networks?: Record<string, any>;
  defaults?: {
    build?: {
      packtool?: string;
    };
  };
}

/**
 * Complete project structure
 */
export interface ProjectStructure {
  name: string;
  path: string;
  dfxConfig: DfxConfig;
  canisters: CanisterInfo[];
  networks: string[];
  issues: ProjectIssue[];
  totalLinesOfCode: number;
}

/**
 * Read and parse dfx.json
 */
async function readDfxConfig(projectPath: string): Promise<DfxConfig | null> {
  const dfxPath = join(projectPath, 'dfx.json');

  if (!existsSync(dfxPath)) {
    logger.warn(`dfx.json not found at ${dfxPath}`);
    return null;
  }

  try {
    const content = await readFile(dfxPath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    logger.error(`Failed to parse dfx.json: ${error.message}`);
    return null;
  }
}

/**
 * Detect canister type from config
 */
function detectCanisterType(config: any): CanisterInfo['type'] {
  if (config.type === 'motoko') return 'motoko';
  if (config.type === 'rust') return 'rust';
  if (config.type === 'assets') return 'assets';
  if (config.type === 'custom') return 'custom';

  // Infer from main file extension
  if (config.main) {
    if (config.main.endsWith('.mo')) return 'motoko';
    if (config.main.endsWith('.rs')) return 'rust';
  }

  return 'custom';
}

/**
 * Find all source files for a Motoko canister
 */
async function findMotokoSources(mainFile: string, projectPath: string): Promise<string[]> {
  const sources: string[] = [];
  const mainPath = resolve(projectPath, mainFile);

  if (!existsSync(mainPath)) {
    logger.warn(`Main file not found: ${mainPath}`);
    return sources;
  }

  sources.push(mainFile);

  // Find all .mo files in the same directory
  const dir = dirname(mainPath);
  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (file.endsWith('.mo') && file !== mainFile.split('/').pop()) {
        const relativePath = join(dirname(mainFile), file);
        sources.push(relativePath);
      }
    }
  } catch (error: any) {
    logger.warn(`Failed to read directory ${dir}: ${error.message}`);
  }

  return sources;
}

/**
 * Find all source files for a Rust canister
 */
async function findRustSources(canisterDir: string, projectPath: string): Promise<string[]> {
  const sources: string[] = [];
  const srcDir = resolve(projectPath, canisterDir, 'src');

  if (!existsSync(srcDir)) {
    logger.warn(`Source directory not found: ${srcDir}`);
    return sources;
  }

  // Recursively find all .rs files
  async function findRsFiles(dir: string, basePath: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = join(basePath, entry.name);

        if (entry.isDirectory()) {
          await findRsFiles(fullPath, relativePath);
        } else if (entry.isFile() && entry.name.endsWith('.rs')) {
          sources.push(relativePath);
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to read directory ${dir}: ${error.message}`);
    }
  }

  await findRsFiles(srcDir, join(canisterDir, 'src'));
  return sources;
}

/**
 * Count lines of code in a file
 */
async function countLines(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Detect dependencies from canister config
 */
function detectDependencies(config: any): string[] {
  const deps: string[] = [];

  // Check dependencies array
  if (Array.isArray(config.dependencies)) {
    deps.push(...config.dependencies);
  }

  // Check Rust Cargo.toml would be parsed separately
  // For now, just use explicit dependencies

  return deps;
}

/**
 * Analyze a single canister
 */
async function analyzeCanister(
  name: string,
  config: any,
  projectPath: string
): Promise<CanisterInfo> {
  const type = detectCanisterType(config);
  const dependencies = detectDependencies(config);

  let sourceFiles: string[] = [];
  let linesOfCode = 0;

  // Find source files based on type
  if (type === 'motoko' && config.main) {
    sourceFiles = await findMotokoSources(config.main, projectPath);
  } else if (type === 'rust') {
    // Rust canisters typically in src/<canister_name>/
    sourceFiles = await findRustSources(`src/${name}`, projectPath);
  }

  // Count total lines
  for (const file of sourceFiles) {
    const fullPath = resolve(projectPath, file);
    linesOfCode += await countLines(fullPath);
  }

  return {
    name,
    type,
    main: config.main,
    candid: config.candid,
    dependencies,
    sourceFiles,
    linesOfCode,
    mainPath: config.main ? resolve(projectPath, config.main) : undefined,
    packageName: config.package,
    wasm: config.wasm,
  };
}

/**
 * Detect project-level issues
 */
function detectProjectIssues(
  dfxConfig: DfxConfig,
  canisters: CanisterInfo[]
): ProjectIssue[] {
  const issues: ProjectIssue[] = [];

  // Check for missing dfx version
  if (!dfxConfig.dfx) {
    issues.push({
      severity: 'warning',
      message: 'dfx.json missing "dfx" version field',
    });
  }

  // Check for canisters with no source files
  for (const canister of canisters) {
    if (canister.sourceFiles.length === 0 && canister.type !== 'assets') {
      issues.push({
        severity: 'warning',
        message: `Canister "${canister.name}" has no source files found`,
        canisters: [canister.name],
      });
    }
  }

  // Check for missing main files
  for (const canister of canisters) {
    if (canister.main && canister.mainPath && !existsSync(canister.mainPath)) {
      issues.push({
        severity: 'error',
        message: `Canister "${canister.name}" main file not found: ${canister.main}`,
        canisters: [canister.name],
        file: canister.main,
      });
    }
  }

  // Check for dependency references to non-existent canisters
  const canisterNames = new Set(canisters.map(c => c.name));
  for (const canister of canisters) {
    for (const dep of canister.dependencies) {
      if (!canisterNames.has(dep)) {
        issues.push({
          severity: 'error',
          message: `Canister "${canister.name}" depends on unknown canister "${dep}"`,
          canisters: [canister.name, dep],
        });
      }
    }
  }

  return issues;
}

/**
 * Analyze entire ICP project
 */
export async function analyzeProject(
  projectPath: string = process.cwd()
): Promise<ProjectStructure | null> {
  logger.info(`Analyzing ICP project at: ${projectPath}`);

  // Read dfx.json
  const dfxConfig = await readDfxConfig(projectPath);
  if (!dfxConfig) {
    return null;
  }

  // Analyze all canisters
  const canisters: CanisterInfo[] = [];
  for (const [name, config] of Object.entries(dfxConfig.canisters)) {
    const canisterInfo = await analyzeCanister(name, config, projectPath);
    canisters.push(canisterInfo);
  }

  // Extract networks
  const networks = dfxConfig.networks ? Object.keys(dfxConfig.networks) : [];

  // Detect issues
  const issues = detectProjectIssues(dfxConfig, canisters);

  // Calculate total LOC
  const totalLinesOfCode = canisters.reduce((sum, c) => sum + c.linesOfCode, 0);

  // Get project name from path
  const name = projectPath.split('/').pop() || 'unknown';

  const project: ProjectStructure = {
    name,
    path: projectPath,
    dfxConfig,
    canisters,
    networks,
    issues,
    totalLinesOfCode,
  };

  logger.info(`Project analyzed: ${canisters.length} canisters, ${totalLinesOfCode} LOC`);

  return project;
}
