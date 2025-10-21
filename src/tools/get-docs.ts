/**
 * MCP tool: icp/get-docs
 * Fetches ICP documentation from dfinity/portal
 */

import { z } from 'zod';
import { fetchDocs, browseDocsDirectory } from '../fetchers/github.js';
import { logger } from '../utils/logger.js';

// Input schema
export const GetDocsInputSchema = z.object({
  paths: z
    .array(z.string())
    .optional()
    .describe('Specific documentation file paths to fetch'),
  directory: z
    .string()
    .optional()
    .describe('Browse a directory for available docs'),
  maxLength: z
    .number()
    .optional()
    .describe('Maximum total content length'),
});

export type GetDocsInput = z.infer<typeof GetDocsInputSchema>;

/**
 * Get ICP documentation
 */
export async function getDocs(input: GetDocsInput) {
  const { paths, directory, maxLength } = input;

  try {
    // If directory specified, list files in that directory
    if (directory) {
      logger.info(`Browsing docs directory: ${directory}`);
      const files = await browseDocsDirectory(directory);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                directory,
                files,
                count: files.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Otherwise, fetch specific paths
    if (!paths || paths.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                error: 'Please specify either paths to fetch or a directory to browse',
                examples: {
                  fetchPaths: {
                    paths: ['docs/building-apps/developing-canisters/overview.mdx'],
                  },
                  browseDirectory: {
                    directory: 'docs/building-apps',
                  },
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    logger.info(`Fetching ${paths.length} documentation files`);
    const docs = await fetchDocs(paths);

    // Respect maxLength if specified
    let totalLength = 0;
    const filteredDocs = [];

    for (const doc of docs) {
      if (maxLength && totalLength + doc.content.length > maxLength) {
        logger.info(`Reached maxLength limit, truncating results`);
        break;
      }

      filteredDocs.push(doc);
      totalLength += doc.content.length;
    }

    logger.info(`Fetched ${filteredDocs.length} docs (${totalLength} chars)`);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              docs: filteredDocs,
              totalLength,
              truncated: filteredDocs.length < docs.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('Get docs error:', error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: `Failed to fetch docs: ${error.message}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
