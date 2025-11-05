/**
 * test-deploy internal helper for action tool
 * Deploys and tests ICP projects
 */

import { z } from 'zod';
import { analyzeProject } from '../analyzers/project.js';
import { buildDependencyGraph } from '../analyzers/dependencies.js';
import {
  checkDfxInstalled,
  getDfxVersion,
  startLocalReplica,
  buildCanister,
  deployCanister,
  type DeploymentResult,
} from '../executors/dfx-executor.js';
import { logger } from '../utils/logger.js';

export const testDeploySchema = z.object({
  projectPath: z.string().optional(),
  network: z.enum(['local', 'playground']).optional(),
  canisters: z.array(z.string()).optional(),
  mode: z.enum(['install', 'reinstall', 'upgrade']).optional(),
  clean: z.boolean().optional(),
});

export type TestDeployInput = z.infer<typeof testDeploySchema>;

interface DeploymentSummary {
  network: string;
  deployedCanisters: DeploymentResult[];
  failures: string[];
  totalTime: number;
}

function formatDeploymentResults(summary: DeploymentSummary): string {
  const lines: string[] = [];

  lines.push(`# Deployment to ${summary.network}\n`);

  if (summary.deployedCanisters.length > 0) {
    lines.push('**✅ Deployed Canisters:**\n');
    for (const canister of summary.deployedCanisters) {
      if (canister.success) {
        lines.push(`- **${canister.canisterName}**`);
        lines.push(`  - Canister ID: \`${canister.canisterId}\``);
        lines.push(`  - Network: ${canister.network}`);
        lines.push('');
      }
    }
  }

  if (summary.failures.length > 0) {
    lines.push('\n**❌ Failures:**\n');
    for (const failure of summary.failures) {
      lines.push(`- ${failure}`);
    }
    lines.push('');
  }

  lines.push(`\n**Total Time:** ${summary.totalTime.toFixed(2)}s`);

  return lines.join('\n');
}

export async function executeTestDeploy(input: TestDeployInput): Promise<string> {
  const startTime = Date.now();
  const projectPath = input.projectPath || process.cwd();
  const network = input.network || 'local';
  const mode = input.mode || 'reinstall';

  logger.info(`Starting deployment to ${network}`, { projectPath });

  const dfxInstalled = await checkDfxInstalled();
  if (!dfxInstalled) {
    return '❌ Error: dfx is not installed';
  }

  const dfxVersion = await getDfxVersion();
  logger.info(`Using dfx version: ${dfxVersion}`);

  const project = await analyzeProject(projectPath);
  if (!project) {
    return '❌ Error: Could not analyze project';
  }

  const graph = await buildDependencyGraph(project);
  const deployOrder = graph.buildOrder;

  let canistersToDeploy = deployOrder;
  if (input.canisters && input.canisters.length > 0) {
    canistersToDeploy = deployOrder.filter((name) =>
      input.canisters!.includes(name)
    );
  }

  if (canistersToDeploy.length === 0) {
    return '❌ Error: No canisters to deploy';
  }

  if (network === 'local') {
    const started = await startLocalReplica(projectPath);
    if (!started) {
      return '❌ Error: Could not start local replica';
    }
  }

  const deployedCanisters: DeploymentResult[] = [];
  const failures: string[] = [];

  for (const canisterName of canistersToDeploy) {
    logger.info(`Deploying ${canisterName}`);

    const built = await buildCanister(canisterName, projectPath);
    if (!built) {
      failures.push(`Build failed for ${canisterName}`);
      continue;
    }

    const result = await deployCanister(canisterName, {
      network,
      mode,
      projectPath,
    });

    if (result.success) {
      deployedCanisters.push(result);
    } else {
      failures.push(`Deploy failed for ${canisterName}: ${result.error}`);
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;

  return formatDeploymentResults({
    network,
    deployedCanisters,
    failures,
    totalTime,
  });
}
