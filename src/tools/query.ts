/**
 * Query Tool - Simplified data fetching for ICP modules
 * Claude handles intelligence, we handle fetching
 */

import { z } from 'zod';
import { DataEncoder } from '../core/toon-encoder.js';
import {
  MODULES_MINIMAL,
  PLATFORM_FEATURES,
  expandModule,
  getModule,
  getPlatformFeature,
  expandPlatformFeature,
} from '../data/modules-minimal.js';
import { searchDocs, getAllCategories, type DocEntry } from '../data/dfinity-docs-index.js';
import { icpExamples } from '../data/examples/icp-examples.js';
import { logger } from '../utils/logger.js';
import { getUserAgent } from '../utils/version.js';

// Input schema - simple and direct
export const QueryInputSchema = z.object({
  operation: z.enum(['list-all', 'document', 'examples', 'fetch-url', 'list-icp-examples', 'fetch-icp-example']).describe('What to fetch'),
  modules: z.array(z.string()).optional().describe('Module names (for document/examples)'),
  url: z.string().optional().describe('Direct URL path to fetch from internetcomputer.org'),
  query: z.string().optional().describe('Search query for fallback discovery or example filtering'),
  exampleId: z.string().optional().describe('Example ID to fetch (for fetch-icp-example)'),
  category: z.string().optional().describe('Filter examples by category (AI, DeFi, Chain Fusion, etc.)'),
  language: z.string().optional().describe('Filter examples by language (motoko, rust, frontend-only)'),
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
  logger.info(`Query: ${input.operation}${input.modules ? ` for ${input.modules.join(', ')}` : ''}${input.url ? ` url=${input.url}` : ''}${input.query ? ` query="${input.query}"` : ''}`);

  let result: any;

  switch (input.operation) {
    case 'list-all':
      result = await listAllModules();
      break;
    case 'document':
      result = await fetchDocumentation(input.modules || [], input.filter, input.query);
      break;
    case 'examples':
      result = await fetchExamples(input.modules || [], input.filter?.maxLength);
      break;
    case 'fetch-url':
      result = await fetchArbitraryUrl(input.url || '', input.filter);
      break;
    case 'list-icp-examples':
      result = listICPExamples(input.category, input.language, input.query);
      break;
    case 'fetch-icp-example':
      result = await fetchICPExample(input.exampleId || '', input.filter);
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
 * List all modules and platform features organized by category
 */
async function listAllModules() {
  const categories: Record<string, any[]> = {};

  // Add modules
  for (const module of MODULES_MINIMAL) {
    const [cat] = module.c.split('/');
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(expandModule(module));
  }

  // Add platform features
  for (const feature of PLATFORM_FEATURES) {
    const [cat] = feature.c.split('/');
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(expandPlatformFeature(feature));
  }

  return {
    operation: 'list-all',
    total: MODULES_MINIMAL.length + PLATFORM_FEATURES.length,
    modules: MODULES_MINIMAL.length,
    platformFeatures: PLATFORM_FEATURES.length,
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
 * Fetch arbitrary URL from internetcomputer.org (Layer 2)
 */
async function fetchArbitraryUrl(urlPath: string, filter?: QueryInput['filter']): Promise<any> {
  if (!urlPath) {
    return {
      operation: 'fetch-url',
      error: 'No URL provided',
      suggestion: 'Provide a URL path (e.g., "/docs/motoko/main/writing-motoko/modules") or full URL',
    };
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const { default: TurndownService } = await import('turndown');

    // Normalize URL
    const baseUrl = 'https://internetcomputer.org';
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`;

    logger.debug(`Fetching arbitrary URL: ${fullUrl}`);
    const response = await fetch(fullUrl, {
      headers: { 'User-Agent': getUserAgent() },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        operation: 'fetch-url',
        error: `HTTP ${response.status} for ${fullUrl}`,
        url: fullUrl,
      };
    }

    const html = await response.text();
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    const markdown = turndown.turndown(html);

    // Apply filtering
    const mode = filter?.mode || 'full';
    const maxLength = filter?.maxLength || (mode === 'summary' ? 500 : 3000);

    let content = markdown;
    if (mode === 'summary') {
      content = markdown.split('\n\n').slice(0, 2).join('\n\n');
    }

    return {
      operation: 'fetch-url',
      url: fullUrl,
      content: content.slice(0, maxLength),
      filterMode: mode,
    };
  } catch (error: any) {
    logger.error(`Failed to fetch URL: ${error.message}`);
    return {
      operation: 'fetch-url',
      error: `Failed to fetch: ${error.message}`,
      url: urlPath,
    };
  }
}

/**
 * Fetch documentation for specified modules or platform features
 * Supports fallback search (Layer 3) if modules not found
 */
async function fetchDocumentation(moduleNames: string[], filter?: QueryInput['filter'], fallbackQuery?: string) {
  if (moduleNames.length === 0 && !fallbackQuery) {
    return {
      operation: 'document',
      error: 'No modules or search query specified',
      suggestion: 'Provide module names (e.g., "EOP", "List") or a search query',
    };
  }

  // Layer 1: Try static index
  const items = moduleNames
    .map(name => {
      // Try as module first
      const mod = getModule(name);
      if (mod) return expandModule(mod);

      // Try as platform feature
      const feat = getPlatformFeature(name);
      if (feat) return expandPlatformFeature(feat);

      return null;
    })
    .filter(Boolean);

  // If found in index, fetch those docs (Layer 1 success)
  if (items.length > 0) {
    const modules = items;

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

  // Layer 3: Semantic search across comprehensive doc index
  if (fallbackQuery || moduleNames.length > 0) {
    const searchQuery = fallbackQuery || moduleNames.join(' ');
    logger.info(`Attempting semantic search for: ${searchQuery}`);

    // Search comprehensive doc index
    const results = searchDocs(searchQuery, { limit: 5 });

    if (results.length > 0) {
      logger.info(`Found ${results.length} matching docs via semantic search`);

      // Fetch top results
      try {
        const fetch = (await import('node-fetch')).default;
        const { default: TurndownService } = await import('turndown');

        const fetchedDocs = await Promise.all(
          results.slice(0, 3).map(async (docEntry: DocEntry) => {
            try {
              const baseUrl = 'https://internetcomputer.org';
              const fullUrl = docEntry.url.startsWith('http') ? docEntry.url : `${baseUrl}${docEntry.url}`;

              logger.debug(`Fetching discovered doc: ${fullUrl}`);
              const response = await fetch(fullUrl, {
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

              // Apply filtering
              const mode = filter?.mode || 'summary'; // Default to summary for discovered docs
              const maxLength = filter?.maxLength || 800;

              let content = markdown;
              if (mode === 'summary') {
                content = markdown.split('\n\n').slice(0, 3).join('\n\n');
              }

              return {
                title: docEntry.title,
                category: docEntry.category,
                id: docEntry.id,
                url: fullUrl,
                content: content.slice(0, maxLength),
                relevance: 'semantic-search',
                keywords: docEntry.keywords,
              };
            } catch (error: any) {
              logger.warn(`Failed to fetch ${docEntry.title}: ${error.message}`);
              return {
                title: docEntry.title,
                category: docEntry.category,
                id: docEntry.id,
                url: `https://internetcomputer.org${docEntry.url}`,
                content: `Documentation available at URL above`,
                relevance: 'semantic-search',
                error: error.message,
              };
            }
          })
        );

        return {
          operation: 'document',
          searchQuery,
          discoveryMethod: 'semantic-search',
          resultsFound: results.length,
          documentsFetched: fetchedDocs.length,
          documents: fetchedDocs,
          allResults: results.map((r: DocEntry) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            url: `https://internetcomputer.org${r.url}`,
          })),
        };
      } catch (error: any) {
        logger.error('Semantic search fetch error:', error);
        return {
          operation: 'document',
          searchQuery,
          discoveryMethod: 'semantic-search',
          resultsFound: results.length,
          results: results.map((r: DocEntry) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            url: `https://internetcomputer.org${r.url}`,
            keywords: r.keywords,
          })),
          hint: 'Use operation: "fetch-url" with one of the URLs above to get full content',
        };
      }
    }

    // Nothing found anywhere
    return {
      operation: 'document',
      searchQuery,
      error: 'No matching documentation found',
      suggestion: 'Try different keywords or browse available categories',
      availableCategories: getAllCategories(),
      availableFeatures: PLATFORM_FEATURES.map(f => f.n).join(', '),
    };
  }

  // No matches and no fallback query
  return {
    operation: 'document',
    error: 'No valid modules or platform features found',
    requested: moduleNames,
    suggestion: `Available platform features: ${PLATFORM_FEATURES.map(f => f.n).join(', ')}`,
  };
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

/**
 * List ICP Examples - filter by category, language, or search query
 */
function listICPExamples(category?: string, language?: string, query?: string) {
  let filtered = icpExamples;

  // Filter by category
  if (category) {
    filtered = filtered.filter(ex =>
      ex.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Filter by language
  if (language) {
    filtered = filtered.filter(ex =>
      ex.language.toLowerCase() === language.toLowerCase()
    );
  }

  // Filter by search query (search in title, description, technologies)
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(ex =>
      ex.title.toLowerCase().includes(q) ||
      ex.description.toLowerCase().includes(q) ||
      ex.technologies.some(tech => tech.toLowerCase().includes(q))
    );
  }

  // Group by category
  const byCategory: Record<string, any[]> = {};
  filtered.forEach(ex => {
    if (!byCategory[ex.category]) {
      byCategory[ex.category] = [];
    }
    byCategory[ex.category].push({
      id: ex.id,
      title: ex.title,
      description: ex.description,
      language: ex.language,
      hasFrontend: ex.hasFrontend,
      technologies: ex.technologies,
      sourceUrl: ex.sourceUrl,
      githubUrl: ex.githubUrl,
      docUrl: ex.docUrl,
    });
  });

  return {
    operation: 'list-icp-examples',
    total: filtered.length,
    filters: { category, language, query },
    examples: byCategory,
    note: 'Use operation="fetch-icp-example" with exampleId to get full source code',
  };
}

/**
 * Fetch ICP Example - get full source code and documentation
 */
async function fetchICPExample(exampleId: string, _filter?: any) {
  const example = icpExamples.find(ex => ex.id === exampleId);

  if (!example) {
    return {
      operation: 'fetch-icp-example',
      error: `Example "${exampleId}" not found`,
      suggestion: 'Use operation="list-icp-examples" to see available examples',
    };
  }

  try {
    const fetch = (await import('node-fetch')).default;

    // Fetch README from our source repo
    const readmeUrl = `${example.sourceUrl}/README.md`;
    logger.debug(`Fetching example README: ${readmeUrl}`);

    const readmeResponse = await fetch(readmeUrl, {
      headers: { 'User-Agent': getUserAgent() },
      signal: AbortSignal.timeout(5000),
    });

    let readme = '';
    if (readmeResponse.ok) {
      readme = await readmeResponse.text();
    }

    // Fetch dfx.json to show project structure
    const dfxUrl = `${example.sourceUrl}/dfx.json`;
    const dfxResponse = await fetch(dfxUrl, {
      headers: { 'User-Agent': getUserAgent() },
      signal: AbortSignal.timeout(5000),
    });

    let dfxConfig = null;
    if (dfxResponse.ok) {
      dfxConfig = await dfxResponse.json();
    }

    return {
      operation: 'fetch-icp-example',
      example: {
        id: example.id,
        title: example.title,
        category: example.category,
        description: example.description,
        language: example.language,
        hasFrontend: example.hasFrontend,
        technologies: example.technologies,
        sourceUrl: example.sourceUrl,
        githubUrl: example.githubUrl,
        docUrl: example.docUrl,
        readme: readme || 'README not available',
        projectStructure: dfxConfig,
      },
      instructions: {
        fetchBackend: example.language === 'motoko'
          ? `${example.sourceUrl}/backend/app.mo or /backend/main.mo`
          : example.language === 'rust'
          ? `${example.sourceUrl}/src/lib.rs or /backend/src/lib.rs or /src/backend/src/lib.rs`
          : 'Frontend-only project',
        fetchFrontend: example.hasFrontend
          ? `${example.sourceUrl}/frontend/`
          : 'No frontend',
        deployLocal: 'See README for deployment instructions',
      },
    };
  } catch (error: any) {
    logger.error('Example fetch error:', error);
    return {
      operation: 'fetch-icp-example',
      example: {
        id: example.id,
        title: example.title,
        sourceUrl: example.sourceUrl,
        githubUrl: example.githubUrl,
      },
      error: 'Failed to fetch example details',
      fallback: `View directly at: ${example.sourceUrl}`,
    };
  }
}

// Export for use in main index
export const queryTool = {
  name: 'icp/query',
  description:
    'Query ICP documentation: modules, platform features, or any internetcomputer.org topic. See icp/help section=\'query\' for examples.',
  inputSchema: QueryInputSchema,
  execute: query,
};
