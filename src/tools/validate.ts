/**
 * Validation of ICP code and configuration:
 * Candid (didc), Motoko (mops with the project's toolchain), Rust (source
 * checks), icp.yaml (structure), dfx.json (legacy format).
 */

import { z } from 'zod';
import { validateCandid, checkDidcAvailable } from '../validators/candid.js';
import { validateMotoko } from '../validators/motoko.js';
import { validateRust } from '../validators/rust.js';
import { validateDfxJson } from '../validators/dfx-json.js';
import { lintEngineRules } from '../validators/engine-rules.js';
import { validateIcpYamlText } from '../analyzers/icp-project.js';
import { logger } from '../utils/logger.js';
import { REFS } from '../data/references.js';
import type { ValidationResult } from '../types/index.js';

const ValidateOptions = {
  securityCheck: z.boolean().optional().describe('Add security pattern checks'),
  engine: z.boolean().optional().describe('Apply cloud engine call rules (Motoko and Rust)'),
  projectPath: z.string().optional().describe('Motoko: check this project on disk with its own mops toolchain (code may be omitted)'),
  canister: z.string().optional().describe('Motoko: canister name in mops.toml when projectPath is set'),
  mocVersion: z.string().optional().describe('Motoko snippet checks: moc version (default latest)'),
};

export const ValidateInputSchema = z.object({
  code: z.string().optional().describe('Source or configuration text to validate'),
  language: z.enum(['candid', 'motoko', 'rust', 'icp-yaml', 'dfx-json']).describe('What the code is'),
  filename: z.string().optional().describe('File name, for messages'),
  ...ValidateOptions,
  context: z.object(ValidateOptions).optional().describe('Same options, nested (accepted for compatibility)'),
});

export type ValidateInput = z.infer<typeof ValidateInputSchema>;

function respond(result: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}

export async function validate(input: ValidateInput) {
  const { language, filename } = input;
  const code = input.code ?? '';
  const context = {
    ...input.context,
    ...Object.fromEntries(
      (Object.keys(ValidateOptions) as Array<keyof typeof ValidateOptions>)
        .filter(key => input[key] !== undefined)
        .map(key => [key, input[key]])
    ),
  } as { securityCheck?: boolean; engine?: boolean; projectPath?: string; canister?: string; mocVersion?: string };
  logger.info(`Validating ${language} code ${filename ? `(${filename})` : ''}`);

  if (!code.trim() && !(language === 'motoko' && context.projectPath)) {
    return respond({ valid: false, issues: [{ severity: 'error', message: 'Provide code (or, for Motoko, projectPath).' }] });
  }

  try {
    let result: ValidationResult & Record<string, any>;
    switch (language) {
      case 'candid': {
        if (!(await checkDidcAvailable())) {
          return respond({
            valid: false,
            issues: [
              {
                severity: 'error',
                message: 'didc is not installed; Candid validation needs it.',
                suggestedFix: 'cargo install --git https://github.com/dfinity/candid.git didc',
                references: [REFS.candidRepo],
              },
            ],
          });
        }
        result = await validateCandid(code);
        break;
      }
      case 'motoko':
        result = await validateMotoko(code, {
          securityCheck: context?.securityCheck,
          engine: context?.engine,
          projectPath: context?.projectPath,
          canister: context?.canister,
          mocVersion: context?.mocVersion,
        });
        if (context?.projectPath) {
          result.note = 'The compiler checked the project as saved on disk; source checks ran on the code passed in.';
        }
        break;
      case 'rust': {
        result = await validateRust(code, context);
        if (context?.engine) {
          const engineIssues = lintEngineRules(code, 'rust');
          result.issues.push(...engineIssues);
          if (engineIssues.some(i => i.severity === 'error')) result.valid = false;
        }
        break;
      }
      case 'icp-yaml':
        result = validateIcpYamlText(code);
        break;
      case 'dfx-json':
        result = await validateDfxJson(code);
        result.note =
          'dfx.json is the legacy dfx format. icp-cli uses icp.yaml: convert with action "convert-dfx".';
        result.references = [REFS.migrationFromDfx];
        break;
    }

    logger.info(`Validation result: ${result.valid ? 'VALID' : 'INVALID'} (${result.issues.length} issues)`);
    return respond(result);
  } catch (error: any) {
    logger.error('Validation error:', error);
    return respond({ valid: false, issues: [{ severity: 'error', message: `Validation failed: ${error.message}` }] });
  }
}
