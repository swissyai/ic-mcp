/**
 * icp/check-upgrade tool
 * Check Candid interface upgrade safety
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { checkUpgradeSafety, formatUpgradeCheck } from '../validators/upgrade-checker.js';
import { logger } from '../utils/logger.js';

/**
 * Input schema
 */
export const checkUpgradeSchema = z.object({
  oldCandid: z.string().describe('Current/old Candid interface'),
  newCandid: z.string().describe('Proposed/new Candid interface'),
});

export type CheckUpgradeInput = z.infer<typeof checkUpgradeSchema>;

/**
 * Tool definition (token-efficient)
 */
export const checkUpgradeTool: Tool = {
  name: 'icp/check-upgrade',
  description: 'Validates canister upgrade safety by comparing old and new Candid interface definitions. Detects breaking changes including removed methods, modified method signatures, changed return types, and incompatible parameter types that would break existing clients or inter-canister calls. Uses Candid subtyping rules to determine safe vs unsafe changes. Returns detailed compatibility report with specific issues and recommendations. Use this before upgrading production canisters to ensure backward compatibility, prevent runtime failures, or validate API evolution.',
  inputSchema: {
    type: 'object',
    properties: {
      oldCandid: {
        type: 'string',
        description: 'Current Candid interface',
      },
      newCandid: {
        type: 'string',
        description: 'Proposed Candid interface',
      },
    },
    required: ['oldCandid', 'newCandid'],
  },
};

/**
 * Execute check-upgrade tool
 */
export async function executeCheckUpgrade(input: CheckUpgradeInput): Promise<string> {
  logger.info('Checking upgrade safety');

  const result = checkUpgradeSafety(input.oldCandid, input.newCandid);

  return formatUpgradeCheck(result);
}
