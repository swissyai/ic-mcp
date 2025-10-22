/**
 * Dependency Graph Analysis
 * Detects circular dependencies and analyzes canister relationships
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import type { ProjectStructure, CanisterInfo } from './project.js';
import { logger } from '../utils/logger.js';

/**
 * Dependency edge
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: 'explicit' | 'import';
}

/**
 * Dependency graph node
 */
export interface CanisterNode {
  name: string;
  dependencies: string[];
  dependents: string[];
}

/**
 * Complete dependency graph
 */
export interface DependencyGraph {
  nodes: CanisterNode[];
  edges: DependencyEdge[];
  cycles: string[][];
  buildOrder: string[];
}

/**
 * Parse Motoko imports to detect dependencies
 */
async function parseMotokoImports(
  filePath: string,
  _projectPath: string,
  allCanisters: Set<string>
): Promise<string[]> {
  const deps: string[] = [];

  if (!existsSync(filePath)) {
    return deps;
  }

  try {
    const content = await readFile(filePath, 'utf-8');

    // Match import statements: import CanisterName "canister:canister_name"
    const importRegex = /import\s+\w+\s+"canister:(\w+)"/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const canisterName = match[1];
      if (allCanisters.has(canisterName)) {
        deps.push(canisterName);
      }
    }
  } catch (error: any) {
    logger.warn(`Failed to parse imports from ${filePath}: ${error.message}`);
  }

  return deps;
}

/**
 * Parse Rust dependencies from Cargo.toml
 */
async function parseRustDependencies(
  canisterPath: string,
  projectPath: string,
  allCanisters: Set<string>
): Promise<string[]> {
  const deps: string[] = [];
  const cargoPath = resolve(projectPath, canisterPath, 'Cargo.toml');

  if (!existsSync(cargoPath)) {
    return deps;
  }

  try {
    const content = await readFile(cargoPath, 'utf-8');

    // Look for canister dependencies in [dependencies] section
    // This is simplified - real parsing would use TOML parser
    for (const canisterName of allCanisters) {
      if (content.includes(`${canisterName} =`) || content.includes(`"${canisterName}"`)) {
        deps.push(canisterName);
      }
    }
  } catch (error: any) {
    logger.warn(`Failed to parse Cargo.toml from ${canisterPath}: ${error.message}`);
  }

  return deps;
}

/**
 * Detect all dependencies for a canister (explicit + imports)
 */
async function detectAllDependencies(
  canister: CanisterInfo,
  project: ProjectStructure
): Promise<string[]> {
  const allCanisters = new Set(project.canisters.map(c => c.name));
  const deps = new Set<string>(canister.dependencies);

  // Parse imports based on canister type
  if (canister.type === 'motoko' && canister.mainPath) {
    const importDeps = await parseMotokoImports(
      canister.mainPath,
      project.path,
      allCanisters
    );
    importDeps.forEach(dep => deps.add(dep));
  } else if (canister.type === 'rust') {
    const rustDeps = await parseRustDependencies(
      `src/${canister.name}`,
      project.path,
      allCanisters
    );
    rustDeps.forEach(dep => deps.add(dep));
  }

  return Array.from(deps);
}

/**
 * Build dependency graph from project
 */
export async function buildDependencyGraph(
  project: ProjectStructure
): Promise<DependencyGraph> {
  logger.info('Building dependency graph...');

  const nodes: CanisterNode[] = [];
  const edges: DependencyEdge[] = [];

  // Build nodes with all dependencies
  for (const canister of project.canisters) {
    const allDeps = await detectAllDependencies(canister, project);

    nodes.push({
      name: canister.name,
      dependencies: allDeps,
      dependents: [],
    });

    // Create edges
    for (const dep of canister.dependencies) {
      edges.push({
        from: canister.name,
        to: dep,
        type: 'explicit',
      });
    }

    // Add import edges (not in explicit dependencies)
    for (const dep of allDeps) {
      if (!canister.dependencies.includes(dep)) {
        edges.push({
          from: canister.name,
          to: dep,
          type: 'import',
        });
      }
    }
  }

  // Build dependents (reverse dependencies)
  for (const node of nodes) {
    node.dependents = nodes
      .filter(n => n.dependencies.includes(node.name))
      .map(n => n.name);
  }

  // Detect cycles
  const cycles = detectCycles(nodes);

  // Calculate build order (topological sort)
  const buildOrder = calculateBuildOrder(nodes, cycles);

  logger.info(`Graph built: ${nodes.length} nodes, ${edges.length} edges, ${cycles.length} cycles`);

  return {
    nodes,
    edges,
    cycles,
    buildOrder,
  };
}

/**
 * Detect circular dependencies using DFS
 */
function detectCycles(nodes: CanisterNode[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const nodeMap = new Map(nodes.map(n => [n.name, n]));

  function dfs(nodeName: string, path: string[]): void {
    visited.add(nodeName);
    recursionStack.add(nodeName);
    path.push(nodeName);

    const node = nodeMap.get(nodeName);
    if (!node) return;

    for (const dep of node.dependencies) {
      if (!visited.has(dep)) {
        dfs(dep, [...path]);
      } else if (recursionStack.has(dep)) {
        // Found a cycle
        const cycleStart = path.indexOf(dep);
        const cycle = path.slice(cycleStart);
        cycle.push(dep); // Complete the cycle

        // Check if we already have this cycle (in any rotation)
        const cycleStr = cycle.join('->');
        const isDuplicate = cycles.some(existingCycle => {
          const existingStr = existingCycle.join('->');
          return cycleStr.includes(existingStr) || existingStr.includes(cycleStr);
        });

        if (!isDuplicate) {
          cycles.push(cycle);
        }
      }
    }

    recursionStack.delete(nodeName);
  }

  for (const node of nodes) {
    if (!visited.has(node.name)) {
      dfs(node.name, []);
    }
  }

  return cycles;
}

/**
 * Calculate valid build order (topological sort)
 * Returns empty array if there are cycles
 */
function calculateBuildOrder(nodes: CanisterNode[], cycles: string[][]): string[] {
  // Can't build if there are cycles
  if (cycles.length > 0) {
    return [];
  }

  const order: string[] = [];
  const visited = new Set<string>();
  const nodeMap = new Map(nodes.map(n => [n.name, n]));

  function visit(nodeName: string): void {
    if (visited.has(nodeName)) return;

    const node = nodeMap.get(nodeName);
    if (!node) return;

    // Visit dependencies first
    for (const dep of node.dependencies) {
      visit(dep);
    }

    visited.add(nodeName);
    order.push(nodeName);
  }

  for (const node of nodes) {
    visit(node.name);
  }

  return order;
}

/**
 * Get dependency depth for a canister
 */
export function getDependencyDepth(canisterName: string, graph: DependencyGraph): number {
  const node = graph.nodes.find(n => n.name === canisterName);
  if (!node) return 0;

  if (node.dependencies.length === 0) return 0;

  const depths = node.dependencies.map(dep => getDependencyDepth(dep, graph));
  return 1 + Math.max(...depths);
}

/**
 * Get all transitive dependencies for a canister
 */
export function getTransitiveDependencies(
  canisterName: string,
  graph: DependencyGraph
): string[] {
  const visited = new Set<string>();
  const nodeMap = new Map(graph.nodes.map(n => [n.name, n]));

  function collect(name: string): void {
    const node = nodeMap.get(name);
    if (!node || visited.has(name)) return;

    visited.add(name);

    for (const dep of node.dependencies) {
      collect(dep);
    }
  }

  collect(canisterName);
  visited.delete(canisterName); // Don't include self

  return Array.from(visited);
}
