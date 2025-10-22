/**
 * dfx command executor
 * Handles all dfx CLI interactions with proper error handling
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export interface DfxCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DeploymentResult {
  canisterName: string;
  canisterId: string;
  network: string;
  success: boolean;
  error?: string;
}

/**
 * Execute dfx command with timeout and error handling
 */
export async function executeDfxCommand(
  command: string,
  options: {
    cwd?: string;
    timeout?: number;
    network?: string;
  } = {}
): Promise<DfxCommandResult> {
  const { cwd = process.cwd(), timeout = 120000, network } = options;

  // Add network flag if specified
  const networkFlag = network ? `--network ${network}` : '';
  const fullCommand = `dfx ${command} ${networkFlag}`.trim();

  logger.debug(`Executing: ${fullCommand}`, { cwd });

  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    logger.debug(`dfx command succeeded`, { command: fullCommand });

    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  } catch (error: any) {
    logger.warn(`dfx command failed`, {
      command: fullCommand,
      error: error.message,
      stderr: error.stderr,
    });

    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
    };
  }
}

/**
 * Check if dfx is installed and accessible
 */
export async function checkDfxInstalled(): Promise<boolean> {
  const result = await executeDfxCommand('--version');
  return result.success;
}

/**
 * Get dfx version
 */
export async function getDfxVersion(): Promise<string | null> {
  const result = await executeDfxCommand('--version');
  if (!result.success) return null;

  // Parse version from output like "dfx 0.20.1"
  const match = result.stdout.match(/dfx\s+(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

/**
 * Start local replica if not running
 */
export async function startLocalReplica(projectPath?: string): Promise<boolean> {
  logger.info('Starting local IC replica');

  const result = await executeDfxCommand('start --background --clean', {
    cwd: projectPath,
    timeout: 60000,
  });

  if (!result.success) {
    logger.error('Failed to start replica', { error: result.stderr });
    return false;
  }

  logger.info('Local replica started');
  return true;
}

/**
 * Stop local replica
 */
export async function stopLocalReplica(projectPath?: string): Promise<boolean> {
  logger.info('Stopping local IC replica');

  const result = await executeDfxCommand('stop', {
    cwd: projectPath,
  });

  return result.success;
}

/**
 * Build a canister
 */
export async function buildCanister(
  canisterName: string,
  projectPath?: string
): Promise<boolean> {
  logger.info(`Building canister: ${canisterName}`);

  const result = await executeDfxCommand(`build ${canisterName}`, {
    cwd: projectPath,
    timeout: 180000, // 3 minutes for builds
  });

  if (!result.success) {
    logger.error(`Build failed for ${canisterName}`, { error: result.stderr });
    return false;
  }

  logger.info(`Successfully built ${canisterName}`);
  return true;
}

/**
 * Deploy a canister
 */
export async function deployCanister(
  canisterName: string,
  options: {
    projectPath?: string;
    network?: string;
    mode?: 'install' | 'reinstall' | 'upgrade';
    argument?: string;
  } = {}
): Promise<DeploymentResult> {
  const { projectPath, network = 'local', mode = 'install', argument } = options;

  logger.info(`Deploying canister: ${canisterName}`, { network, mode });

  // Build mode flag
  let modeFlag = '';
  if (mode === 'reinstall') modeFlag = '--mode reinstall';
  else if (mode === 'upgrade') modeFlag = '--mode upgrade';

  // Argument flag
  const argFlag = argument ? `--argument '${argument}'` : '';

  const command = `deploy ${canisterName} ${modeFlag} ${argFlag}`.trim();

  const result = await executeDfxCommand(command, {
    cwd: projectPath,
    network,
    timeout: 180000, // 3 minutes for deployment
  });

  if (!result.success) {
    logger.error(`Deployment failed for ${canisterName}`, { error: result.stderr });
    return {
      canisterName,
      canisterId: '',
      network,
      success: false,
      error: result.stderr,
    };
  }

  // Extract canister ID from output
  const canisterId = extractCanisterId(result.stdout, canisterName);

  logger.info(`Successfully deployed ${canisterName}`, { canisterId });

  return {
    canisterName,
    canisterId,
    network,
    success: true,
  };
}

/**
 * Call a canister method
 */
export async function callCanister(
  canisterId: string,
  methodName: string,
  args: string,
  options: {
    network?: string;
    mode?: 'query' | 'update';
    projectPath?: string;
  } = {}
): Promise<DfxCommandResult> {
  const { network = 'local', mode = 'update', projectPath } = options;

  logger.info(`Calling ${canisterId}.${methodName}`, { mode, args });

  const modeFlag = mode === 'query' ? '--query' : '--update';
  const command = `canister call ${canisterId} ${methodName} ${modeFlag} '${args}'`;

  const result = await executeDfxCommand(command, {
    cwd: projectPath,
    network,
    timeout: 30000,
  });

  if (!result.success) {
    logger.error(`Call failed`, {
      canister: canisterId,
      method: methodName,
      error: result.stderr,
    });
  }

  return result;
}

/**
 * Get canister ID from dfx output
 */
function extractCanisterId(output: string, canisterName: string): string {
  // Try multiple patterns for canister ID extraction
  const patterns = [
    // Pattern 1: "Deployed canisters:\nbackend:\n  canister_id: rrkah-fqaaa-aaaaa-aaaaq-cai"
    new RegExp(`${canisterName}[\\s\\S]*?canister_id:\\s*([a-z0-9-]+)`, 'i'),
    // Pattern 2: "Installing code for canister backend, with canister ID rrkah-fqaaa-aaaaa-aaaaq-cai"
    new RegExp(`${canisterName}[\\s\\S]*?canister ID\\s+([a-z0-9-]+)`, 'i'),
    // Pattern 3: Generic principal format
    /([a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{3})/,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  logger.warn(`Could not extract canister ID for ${canisterName}`, { output });
  return '';
}

/**
 * Get canister status
 */
export async function getCanisterStatus(
  canisterId: string,
  network: string = 'local',
  projectPath?: string
): Promise<any> {
  const result = await executeDfxCommand(`canister status ${canisterId}`, {
    cwd: projectPath,
    network,
  });

  if (!result.success) {
    return null;
  }

  // Parse status output
  return parseCanisterStatus(result.stdout);
}

/**
 * Parse canister status from dfx output
 */
function parseCanisterStatus(output: string): any {
  const status: any = {
    raw: output,
  };

  // Extract key fields
  const patterns = {
    status: /Status:\s*(\w+)/,
    memory: /Memory allocation:\s*([\d,]+)/,
    cycles: /Balance:\s*([\d,_]+)\s*Cycles/,
    moduleHash: /Module hash:\s*([a-f0-9]+)/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = output.match(pattern);
    if (match) {
      status[key] = match[1].replace(/[,_]/g, '');
    }
  }

  return status;
}
