/**
 * MCP tool: icp/validate
 * Validates ICP code (Candid, Motoko, Rust, dfx.json)
 */

import { z } from 'zod';
import { validateCandid, checkDidcAvailable } from '../validators/candid.js';
import { validateMotoko } from '../validators/motoko.js';
import { logger } from '../utils/logger.js';

// Input schema
export const ValidateInputSchema = z.object({
  code: z.string().describe('Code to validate'),
  language: z
    .enum(['candid', 'motoko', 'rust', 'dfx-json'])
    .describe('Programming language'),
  filename: z.string().optional().describe('Optional filename for context'),
  context: z
    .object({
      isUpgrade: z.boolean().optional(),
      hasStableState: z.boolean().optional(),
    })
    .optional()
    .describe('Optional validation context'),
});

export type ValidateInput = z.infer<typeof ValidateInputSchema>;

/**
 * Validate ICP code
 */
export async function validate(input: ValidateInput) {
  const { code, language, filename, context } = input;

  logger.info(`Validating ${language} code ${filename ? `(${filename})` : ''}`);

  try {
    let result;

    switch (language) {
      case 'candid': {
        // Check if didc is available
        const didcAvailable = await checkDidcAvailable();
        if (!didcAvailable) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    valid: false,
                    issues: [
                      {
                        severity: 'error',
                        message:
                          'didc CLI not found. Please install it to enable Candid validation.',
                        suggestion:
                          'Install didc: cargo install --git https://github.com/dfinity/candid.git didc',
                        docUrl: 'https://github.com/dfinity/candid',
                      },
                    ],
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        result = await validateCandid(code);
        break;
      }

      case 'motoko': {
        result = await validateMotoko(code, context);
        break;
      }

      case 'rust': {
        // TODO: Implement Rust validation
        result = {
          valid: true,
          issues: [],
          suggestions: ['Rust validation coming soon'],
        };
        break;
      }

      case 'dfx-json': {
        // TODO: Implement dfx.json validation
        try {
          JSON.parse(code);
          result = {
            valid: true,
            issues: [],
          };
        } catch (e: any) {
          result = {
            valid: false,
            issues: [
              {
                severity: 'error',
                message: `Invalid JSON: ${e.message}`,
              },
            ],
          };
        }
        break;
      }

      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    logger.info(`Validation result: ${result.valid ? 'VALID' : 'INVALID'} (${result.issues.length} issues)`);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('Validation error:', error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              valid: false,
              issues: [
                {
                  severity: 'error',
                  message: `Validation failed: ${error.message}`,
                },
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
