/**
 * Query Tool - Simplified data fetching for ICP modules
 * Claude handles intelligence, we handle fetching
 */

import { z } from 'zod';
import { DataEncoder } from '../core/toon-encoder.js';
import { MODULES_MINIMAL, expandModule, getModule } from '../data/modules-minimal.js';
import { logger } from '../utils/logger.js';
import { getUserAgent } from '../utils/version.js';

// Input schema - simple and direct
export const QueryInputSchema = z.object({
  operation: z.enum(['list-all', 'document', 'examples']).describe('What to fetch'),
  modules: z.array(z.string()).optional().describe('Module names (for document/examples)'),
  format: z.enum(['toon', 'json', 'markdown']).optional().default('toon'),
  filter: z.object({
    mode: z.enum(['full', 'summary', 'signatures-only']).optional().default('full')
      .describe('Content filtering mode: full (default), summary (first paragraph), signatures-only (function signatures only)'),
    maxLength: z.number().optional()
      .describe('Maximum characters per module (default: 3000 for full, 500 for summary)'),
  }).optional().describe('Data filtering options to reduce token usage'),
});

export type QueryInput = z.infer<typeof QueryInputSchema>;

/**
 * Main query tool - simplified data fetching
 */
export async function query(input: QueryInput) {
  logger.info(`Query: ${input.operation}${input.modules ? ` for ${input.modules.join(', ')}` : ''}`);

  let result: any;

  switch (input.operation) {
    case 'list-all':
      result = await listAllModules();
      break;
    case 'document':
      result = await fetchDocumentation(input.modules || [], input.filter);
      break;
    case 'examples':
      result = await fetchExamples(input.modules || [], input.filter?.maxLength);
      break;
  }

  const encoded = DataEncoder.encode(result, input.format);

  return {
    content: [{ type: 'text' as const, text: encoded }],
    metadata: {
      operation: input.operation,
      format: input.format,
      tokenEstimate: DataEncoder.estimateTokens(encoded),
    },
  };
}

/**
 * List all modules organized by category
 */
async function listAllModules() {
  const categories: Record<string, any[]> = {};

  for (const module of MODULES_MINIMAL) {
    const [cat] = module.c.split('/');
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(expandModule(module));
  }

  return {
    operation: 'list-all',
    total: MODULES_MINIMAL.length,
    categories,
  };
}

/**
 * Extract function signatures from markdown documentation
 */
function extractFunctionSignatures(markdown: string): string[] {
  const signatures: string[] = [];

  // Match function/value signatures in documentation
  // Pattern: "public func name(...) : Type" or "public let name : Type"
  const funcRegex = /(?:public|private)?\s*(?:func|let|var|class|type)\s+\w+[^;\n]*/g;
  const matches = markdown.match(funcRegex);

  if (matches) {
    signatures.push(...matches.map(m => m.trim()));
  }

  // Also extract from code blocks
  const codeBlockRegex = /```motoko\n([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const codeSignatures = match[1].match(funcRegex);
    if (codeSignatures) {
      signatures.push(...codeSignatures.map(s => s.trim()));
    }
  }

  return [...new Set(signatures)]; // Remove duplicates
}

/**
 * Fetch documentation for specified modules
 */
async function fetchDocumentation(moduleNames: string[], filter?: QueryInput['filter']) {
  if (moduleNames.length === 0) {
    return {
      operation: 'document',
      error: 'No modules specified',
      suggestion: 'Provide module names to fetch documentation',
    };
  }

  const modules = moduleNames
    .map(name => {
      const mod = getModule(name);
      return mod ? expandModule(mod) : null;
    })
    .filter(Boolean);

  if (modules.length === 0) {
    return {
      operation: 'document',
      error: 'No valid modules found',
      requested: moduleNames,
    };
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const { default: TurndownService } = await import('turndown');

    const docsWithContent = await Promise.all(
      modules.map(async (m: any) => {
        try {
          logger.debug(`Fetching docs: ${m.docUrl}`);
          const response = await fetch(m.docUrl, {
            headers: { 'User-Agent': getUserAgent() },
            signal: AbortSignal.timeout(5000),
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const html = await response.text();
          const turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
          });
          const markdown = turndown.turndown(html);

          // Extract main content
          const contentMatch = markdown.match(/# [\s\S]*?(?=\n##|$)/);
          const cleanContent = contentMatch ? contentMatch[0] : markdown.slice(0, 2000);

          // Apply filtering based on mode
          let finalContent = cleanContent;
          const mode = filter?.mode || 'full';
          const maxLength = filter?.maxLength || (mode === 'summary' ? 500 : 3000);

          if (mode === 'signatures-only') {
            const signatures = extractFunctionSignatures(cleanContent);
            finalContent = signatures.length > 0
              ? `# ${m.name}\n\n${signatures.join('\n')}`
              : 'No function signatures found';
          } else if (mode === 'summary') {
            // Extract first paragraph or section
            const firstParagraph = cleanContent.split('\n\n')[0];
            finalContent = firstParagraph;
          }

          return {
            ...m,
            content: finalContent.slice(0, maxLength),
            source: m.docUrl,
            filterMode: mode,
          };
        } catch (error: any) {
          logger.warn(`Failed to fetch ${m.name} docs: ${error.message}`);
          return {
            ...m,
            content: `Documentation unavailable. View at: ${m.docUrl}`,
            source: m.docUrl,
          };
        }
      })
    );

    return {
      operation: 'document',
      modules: docsWithContent,
    };
  } catch (error: any) {
    logger.error('Documentation fetch error:', error);
    return {
      operation: 'document',
      modules: modules.map(m => ({
        ...m,
        content: `View documentation at: ${m.docUrl}`,
        source: m.docUrl,
      })),
    };
  }
}

/**
 * Fetch code examples for specified modules
 */
async function fetchExamples(moduleNames: string[], maxLength?: number) {
  if (moduleNames.length === 0) {
    return {
      operation: 'examples',
      error: 'No modules specified',
      suggestion: 'Provide module names to fetch examples',
    };
  }

  const exampleLimit = maxLength ? Math.max(1, Math.floor(maxLength / 200)) : 3; // Estimate ~200 chars per example

  const modules = moduleNames
    .map(name => {
      const mod = getModule(name);
      return mod ? expandModule(mod) : null;
    })
    .filter(Boolean);

  if (modules.length === 0) {
    return {
      operation: 'examples',
      error: 'No valid modules found',
      requested: moduleNames,
    };
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const { default: TurndownService } = await import('turndown');

    const examplesWithContent = await Promise.all(
      modules.map(async (m: any) => {
        try {
          logger.debug(`Fetching examples: ${m.docUrl}`);
          const response = await fetch(m.docUrl, {
            headers: { 'User-Agent': getUserAgent() },
            signal: AbortSignal.timeout(5000),
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const html = await response.text();
          const turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
          });
          const markdown = turndown.turndown(html);

          // Extract code blocks
          const codeBlocks: string[] = [];
          const codeBlockRegex = /```(?:motoko)?\n([\s\S]*?)```/g;
          let match;
          while ((match = codeBlockRegex.exec(markdown)) !== null) {
            codeBlocks.push(match[1].trim());
          }

          return {
            module: m.name,
            examples: codeBlocks.slice(0, exampleLimit),
            source: m.docUrl,
            hasExamples: codeBlocks.length > 0,
            totalExamples: codeBlocks.length,
          };
        } catch (error: any) {
          logger.warn(`Failed to fetch ${m.name} examples: ${error.message}`);
          return {
            module: m.name,
            examples: [],
            source: m.docUrl,
            hasExamples: false,
            error: `Examples unavailable. View at: ${m.docUrl}`,
          };
        }
      })
    );

    return {
      operation: 'examples',
      modules: examplesWithContent,
    };
  } catch (error: any) {
    logger.error('Examples fetch error:', error);
    return {
      operation: 'examples',
      modules: modules.map(m => ({
        module: m.name,
        examples: [],
        source: m.docUrl,
        hasExamples: false,
        error: `View examples at: ${m.docUrl}`,
      })),
    };
  }
}

// Export for use in main index
export const queryTool = {
  name: 'icp/query',
  description:
    'Search and discover ICP modules, fetch live documentation and code examples from internetcomputer.org. Supports semantic search across 44 Motoko base library modules (Data Structures, Primitives, Control, System) with intelligent intent detection. Use icp/help section=\'query\' for detailed usage patterns and examples.',
  inputSchema: QueryInputSchema,
  execute: query,
};
