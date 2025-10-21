/**
 * MCP tool: icp/dfx-guide
 * Generates safe dfx command templates with explanations
 */

import { z } from 'zod';
import type { DfxCommand } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Input schema
export const DfxGuideInputSchema = z.object({
  operation: z
    .enum(['deploy', 'canister-call', 'identity', 'cycles', 'build'])
    .describe('Type of dfx operation'),
  network: z
    .enum(['local', 'ic', 'playground'])
    .optional()
    .describe('Target network'),
  canister: z.string().optional().describe('Canister name'),
  method: z.string().optional().describe('Canister method name'),
  args: z.string().optional().describe('Method arguments'),
  identityName: z.string().optional().describe('Identity name for identity operations'),
});

export type DfxGuideInput = z.infer<typeof DfxGuideInputSchema>;

/**
 * Generate deploy command guide
 */
function generateDeployGuide(params: DfxGuideInput): DfxCommand {
  const { network = 'local', canister } = params;
  const canisterArg = canister ? ` ${canister}` : '';
  const networkArg = network !== 'local' ? ` --network ${network}` : '';

  const command = `dfx deploy${networkArg}${canisterArg}`;

  const safetyChecks: string[] = [];
  const prerequisites: string[] = [];
  const alternatives: string[] = [];
  const nextSteps: string[] = [];

  // Network-specific safety checks
  if (network === 'ic') {
    safetyChecks.push(
      '⚠️  Deploying to MAINNET - costs real cycles',
      '✓ Ensure code is thoroughly tested',
      '✓ Review all canister settings',
      '✓ Confirm sufficient wallet cycles'
    );
    prerequisites.push(
      'Wallet with sufficient cycles',
      'Code tested on local or playground network',
      'Candid interface validated'
    );
    alternatives.push(
      'dfx deploy --network playground  # Test on playground first',
      'dfx canister install --mode upgrade --network ic  # If canister exists'
    );
  } else if (network === 'playground') {
    safetyChecks.push(
      '✓ Playground network is temporary',
      '✓ Deployed canisters may be cleared periodically'
    );
  } else {
    safetyChecks.push('✓ Local deployment - safe for testing');
    prerequisites.push('Local dfx replica running (dfx start)');
  }

  nextSteps.push(
    `dfx canister id ${canister || '<canister>'}${networkArg}  # Get canister ID`,
    `dfx canister status ${canister || '<canister>'}${networkArg}  # Check status`
  );

  return {
    command,
    explanation: `Deploy ${canister || 'all canisters'} to ${network} network`,
    safetyChecks,
    prerequisites,
    alternatives,
    nextSteps,
    docUrl: 'https://internetcomputer.org/docs/current/references/cli-reference/dfx-deploy',
  };
}

/**
 * Generate canister call command guide
 */
function generateCanisterCallGuide(params: DfxGuideInput): DfxCommand {
  const { network = 'local', canister, method, args } = params;

  if (!canister || !method) {
    throw new Error('canister and method are required for canister-call operation');
  }

  const networkArg = network !== 'local' ? ` --network ${network}` : '';
  const argsArg = args ? ` '${args}'` : " '()'";

  const command = `dfx canister call${networkArg} ${canister} ${method}${argsArg}`;

  const safetyChecks: string[] = [];
  const prerequisites: string[] = [];

  if (network === 'ic') {
    safetyChecks.push(
      '⚠️  Calling MAINNET canister',
      '✓ Verify canister ID is correct',
      '✓ Understand the method being called'
    );
  }

  // Check if method name suggests it's a query or update
  const isQuery = method.toLowerCase().includes('get') || method.toLowerCase().includes('query');

  if (!isQuery) {
    safetyChecks.push('✓ Update calls cost cycles and modify state');
    prerequisites.push('Wallet identity with sufficient cycles');
  }

  return {
    command,
    explanation: `Call ${method} method on ${canister} canister${network === 'ic' ? ' (MAINNET)' : ''}`,
    safetyChecks,
    prerequisites,
    alternatives: [
      `dfx canister call${networkArg} ${canister} ${method} --query  # Force query mode (read-only)`,
    ],
    nextSteps: [
      `dfx canister status${networkArg} ${canister}  # Check canister status`,
    ],
    docUrl: 'https://internetcomputer.org/docs/current/references/cli-reference/dfx-canister',
  };
}

/**
 * Generate identity command guide
 */
function generateIdentityGuide(params: DfxGuideInput): DfxCommand {
  const { identityName } = params;

  if (!identityName) {
    return {
      command: 'dfx identity list',
      explanation: 'List all available identities',
      safetyChecks: [],
      nextSteps: [
        'dfx identity new <name>  # Create new identity',
        'dfx identity use <name>  # Switch to identity',
        'dfx identity get-principal  # Get your principal ID',
      ],
      docUrl: 'https://internetcomputer.org/docs/current/references/cli-reference/dfx-identity',
    };
  }

  return {
    command: `dfx identity new ${identityName}`,
    explanation: `Create new identity: ${identityName}`,
    safetyChecks: [
      '⚠️  Identity PEM files are SENSITIVE',
      '✓ Never commit PEM files to version control',
      '✓ Backup PEM files securely',
      '✓ Store recovery phrases safely',
    ],
    nextSteps: [
      `dfx identity use ${identityName}  # Switch to new identity`,
      `dfx identity get-principal  # Get principal for this identity`,
      `dfx identity export ${identityName} > backup.pem  # Backup (keep secure!)`,
    ],
    docUrl: 'https://internetcomputer.org/docs/current/references/cli-reference/dfx-identity',
  };
}

/**
 * Generate cycles command guide
 */
function generateCyclesGuide(params: DfxGuideInput): DfxCommand {
  const { network = 'local', canister } = params;

  if (!canister) {
    return {
      command: `dfx wallet balance${network !== 'local' ? ` --network ${network}` : ''}`,
      explanation: 'Check wallet cycle balance',
      safetyChecks: network === 'ic' ? ['✓ Checking MAINNET wallet'] : [],
      nextSteps: [
        'dfx wallet addresses  # List wallet addresses',
        'dfx canister deposit-cycles <amount> <canister>  # Top up canister',
      ],
      docUrl: 'https://internetcomputer.org/docs/current/developer-docs/getting-started/cycles/cycles-wallet',
    };
  }

  const networkArg = network !== 'local' ? ` --network ${network}` : '';

  return {
    command: `dfx canister deposit-cycles 1000000000000 ${canister}${networkArg}`,
    explanation: `Deposit 1 trillion cycles to ${canister}`,
    safetyChecks:
      network === 'ic'
        ? [
            '⚠️  Depositing cycles on MAINNET',
            '✓ Cycles are deducted from your wallet',
            '✓ Verify canister ID is correct',
          ]
        : [],
    alternatives: [
      `dfx canister status${networkArg} ${canister}  # Check current cycles`,
      `dfx wallet send <principal> <amount>  # Send cycles to another wallet`,
    ],
    nextSteps: [
      `dfx canister status${networkArg} ${canister}  # Verify deposit`,
    ],
    docUrl: 'https://internetcomputer.org/docs/current/references/cli-reference/dfx-canister',
  };
}

/**
 * Generate build command guide
 */
function generateBuildGuide(params: DfxGuideInput): DfxCommand {
  const { canister } = params;
  const canisterArg = canister ? ` ${canister}` : '';

  return {
    command: `dfx build${canisterArg}`,
    explanation: `Build ${canister || 'all canisters'}`,
    safetyChecks: [],
    nextSteps: [
      `dfx deploy${canisterArg}  # Deploy after successful build`,
      `ls .dfx/local/canisters/  # View build artifacts`,
    ],
    docUrl: 'https://internetcomputer.org/docs/current/references/cli-reference/dfx-build',
  };
}

/**
 * Get dfx command guide
 */
export async function dfxGuide(input: DfxGuideInput) {
  const { operation } = input;

  logger.info(`Generating dfx guide for operation: ${operation}`);

  try {
    let guide: DfxCommand;

    switch (operation) {
      case 'deploy':
        guide = generateDeployGuide(input);
        break;

      case 'canister-call':
        guide = generateCanisterCallGuide(input);
        break;

      case 'identity':
        guide = generateIdentityGuide(input);
        break;

      case 'cycles':
        guide = generateCyclesGuide(input);
        break;

      case 'build':
        guide = generateBuildGuide(input);
        break;

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(guide, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('dfx-guide error:', error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: `Failed to generate guide: ${error.message}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
