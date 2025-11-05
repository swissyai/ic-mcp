/**
 * test-call internal helper for action tool
 * Executes canister methods
 */

import { z } from 'zod';
import { callCanister } from '../executors/dfx-executor.js';
import { logger } from '../utils/logger.js';

export const testCallSchema = z.object({
  canisterId: z.string().describe('Canister ID or name'),
  method: z.string().describe('Method name to call'),
  args: z.union([z.array(z.any()), z.string()]).optional().describe('Method arguments'),
  network: z.enum(['local', 'playground', 'ic']).optional(),
  mode: z.enum(['query', 'update']).optional(),
  projectPath: z.string().optional(),
});

export type TestCallInput = z.infer<typeof testCallSchema>;

function formatCandidArgs(args: any[]| string | undefined): string {
  if (!args) return '()';
  if (typeof args === 'string') return args;

  if (args.length === 0) return '()';

  const formattedArgs = args.map((arg: any) => {
    if (typeof arg === 'string') return `"${arg}"`;
    if (typeof arg === 'number') return arg.toString();
    if (typeof arg === 'boolean') return arg.toString();
    if (arg === null || arg === undefined) return 'null';

    if (Array.isArray(arg)) {
      return `vec { ${arg.map((v) => formatCandidArgs([v])).join('; ')} }`;
    }

    if (typeof arg === 'object') {
      const fields = Object.entries(arg)
        .map(([key, value]) => `${key} = ${formatCandidArgs([value])}`)
        .join('; ');
      return `record { ${fields} }`;
    }

    return arg.toString();
  });

  return `(${formattedArgs.join(', ')})`;
}

function parseCandidResult(output: string): any {
  const trimmed = output.trim();

  if (trimmed === '()') return null;
  if (trimmed === '(true)') return true;
  if (trimmed === '(false)') return false;

  const numberMatch = trimmed.match(/^\((\d+)\)$/);
  if (numberMatch) return parseInt(numberMatch[1]);

  const stringMatch = trimmed.match(/^\("(.*)"\)$/);
  if (stringMatch) return stringMatch[1];

  return trimmed;
}

export async function executeTestCall(input: TestCallInput): Promise<any> {
  logger.info(`Calling ${input.method} on ${input.canisterId}`);

  const candid = formatCandidArgs(input.args);
  const result = await callCanister(
    input.canisterId,
    input.method,
    candid,
    {
      network: input.network || 'local',
      mode: input.mode || 'update',
      projectPath: input.projectPath,
    }
  );

  if (!result.success) {
    return {
      success: false,
      error: result.stderr || 'Call failed',
    };
  }

  return {
    success: true,
    result: parseCandidResult(result.stdout),
    raw: result.stdout,
  };
}
