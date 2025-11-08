/**
 * MCP tool: icp/validate
 * Validates ICP code (Candid, Motoko, Rust, dfx.json)
 */

import { z } from 'zod';
import { validateCandid, checkDidcAvailable } from '../validators/candid.js';
import { validateMotoko } from '../validators/motoko.js';
import { validateRust } from '../validators/rust.js';
import { validateDfxJson } from '../validators/dfx-json.js';
import { getPlatformFeature, expandPlatformFeature } from '../data/modules-minimal.js';
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
      securityCheck: z.boolean().optional().describe('Enable enhanced security checks'),
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
        result = await validateRust(code, context);
        break;
      }

      case 'dfx-json': {
        result = await validateDfxJson(code);
        break;
      }

      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    logger.info(`Validation result: ${result.valid ? 'VALID' : 'INVALID'} (${result.issues.length} issues)`);

    // Smart guidance: Suggest relevant platform features based on issues
    const suggestions: any[] = [];

    for (const issue of result.issues) {
      const message = issue.message.toLowerCase();

      // mo:base → mo:core migration
      if (message.includes('mo:base')) {
        const feature = getPlatformFeature('mo-core-Migration');
        if (feature) {
          suggestions.push({
            topic: 'mo:core Migration',
            reason: 'Deprecated mo:base import detected',
            docUrl: expandPlatformFeature(feature).docUrl,
            query: 'icp/query { modules: ["mo-core-Migration"] }',
          });
        }
      }

      // Labeled loops
      if (message.includes('unlabeled') || message.includes('break') || message.includes('continue')) {
        const feature = getPlatformFeature('Labeled-Loops');
        if (feature) {
          suggestions.push({
            topic: 'Labeled Loops',
            reason: 'Unlabeled break/continue detected',
            docUrl: expandPlatformFeature(feature).docUrl,
            query: 'icp/query { modules: ["Labeled-Loops"] }',
          });
        }
      }

      // Buffer deprecation
      if (message.includes('buffer')) {
        const feature = getPlatformFeature('List-vs-Buffer');
        if (feature) {
          suggestions.push({
            topic: 'List vs Buffer',
            reason: 'Buffer usage detected (deprecated)',
            docUrl: expandPlatformFeature(feature).docUrl,
            query: 'icp/query { modules: ["List-vs-Buffer"] }',
          });
        }
      }

      // EOP guidance
      if (message.includes('eop') || message.includes('stable var') || message.includes('preupgrade')) {
        const feature = getPlatformFeature('EOP');
        if (feature) {
          suggestions.push({
            topic: 'Enhanced Orthogonal Persistence',
            reason: 'Legacy persistence pattern detected',
            docUrl: expandPlatformFeature(feature).docUrl,
            query: 'icp/query { modules: ["EOP"] }',
          });
        }
      }
    }

    // Add suggestions to result if any found
    const enhancedResult = suggestions.length > 0
      ? { ...result, learnMore: suggestions }
      : result;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(enhancedResult, null, 2),
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
