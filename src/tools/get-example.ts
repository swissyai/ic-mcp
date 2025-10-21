/**
 * MCP tool: icp/get-example
 * Fetches code examples from dfinity/examples
 */

import { z } from 'zod';
import { fetchExample, listExamples } from '../fetchers/github.js';
import { logger } from '../utils/logger.js';

// Input schema
export const GetExampleInputSchema = z.object({
  language: z
    .enum(['motoko', 'rust', 'svelte'])
    .optional()
    .describe('Programming language'),
  exampleName: z
    .string()
    .optional()
    .describe('Specific example name'),
  list: z
    .boolean()
    .optional()
    .describe('List available examples for a language'),
});

export type GetExampleInput = z.infer<typeof GetExampleInputSchema>;

/**
 * Get ICP code examples
 */
export async function getExample(input: GetExampleInput) {
  const { language, exampleName, list } = input;

  try {
    // List examples for a language
    if (list && language) {
      logger.info(`Listing ${language} examples`);
      const examples = await listExamples(language);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                language,
                examples: examples.map(path => {
                  const name = path.split('/').pop();
                  return {
                    name,
                    path,
                    url: `https://github.com/dfinity/examples/tree/master/${path}`,
                  };
                }),
                count: examples.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Fetch specific example
    if (language && exampleName) {
      const examplePath = `${language}/${exampleName}`;
      logger.info(`Fetching example: ${examplePath}`);

      const example = await fetchExample(examplePath);

      if (!example) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: `Example not found: ${examplePath}`,
                  suggestion: `Use list: true to see available examples`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      logger.info(`Fetched example with ${Object.keys(example.files).length} files`);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(example, null, 2),
          },
        ],
      };
    }

    // Invalid input
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Please specify language and exampleName, or use list: true',
              examples: {
                listExamples: {
                  language: 'motoko',
                  list: true,
                },
                fetchExample: {
                  language: 'motoko',
                  exampleName: 'hello_world',
                },
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('Get example error:', error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: `Failed to fetch example: ${error.message}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
