/**
 * Query Tool - Intelligent knowledge layer for ICP-MCP
 * Handles discovery, documentation, and search with TOON optimization
 */

import { z } from 'zod';
import { DataEncoder } from '../core/toon-encoder.js';
import {
  MODULES_MINIMAL,
  expandModule,
  getModulesByCategory,
  getModule,
  getCategoryKeywords
} from '../data/modules-minimal.js';
import { logger } from '../utils/logger.js';
import { getUserAgent } from '../utils/version.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load use-case metadata
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const useCaseData = JSON.parse(
  readFileSync(join(__dirname, '../data/use-cases.json'), 'utf-8')
);

// Input schema for the query tool
export const QueryInputSchema = z.object({
  query: z.string().describe('Natural language query or specific request'),
  format: z.enum(['toon', 'json', 'markdown']).optional().default('toon'),
  limit: z.number().optional().describe('Token limit for response'),
  includeRelated: z.boolean().optional().default(true),
  includeExamples: z.boolean().optional().default(false),
});

export type QueryInput = z.infer<typeof QueryInputSchema>;

// Intent types
type IntentType =
  | 'discover'    // List modules, browse categories
  | 'search'      // Find specific functionality
  | 'document'    // Get documentation for modules
  | 'example'     // Get code examples
  | 'explain';    // Explain concepts

interface ParsedIntent {
  type: IntentType;
  modules?: string[];
  category?: string;
  query?: string;
  confidence: number;
}

/**
 * Main query tool execution
 */
export async function query(input: QueryInput) {
  const trimmed = input.query.trim();

  // Empty query = return useful default (module list)
  if (trimmed.length === 0) {
    // Instead of marketing text, return actual module list
    const categories: Record<string, any[]> = {};
    for (const module of MODULES_MINIMAL) {
      const [cat] = module.c.split('/');
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(expandModule(module));
    }

    const encoded = DataEncoder.encode({
      action: 'list-all',
      total: MODULES_MINIMAL.length,
      categories,
    }, input.format);

    return {
      content: [{
        type: 'text' as const,
        text: encoded,
      }],
      metadata: {
        intent: 'discover',
        confidence: 1.0,
        format: input.format,
        tokenEstimate: DataEncoder.estimateTokens(encoded),
        suggestions: [
          'Pick a module: "how to use [module]"',
          'Search: "queue operations"',
          'Get help: use icp/help tool',
        ],
      },
    };
  }

  logger.info(`Query tool called with: "${trimmed}"`);

  // Parse the natural language query
  const intent = parseIntent(trimmed);
  logger.debug(`Parsed intent: ${intent.type} (confidence: ${intent.confidence})`);

  let result: any;

  switch (intent.type) {
    case 'discover':
      result = await handleDiscovery(intent, input);
      break;
    case 'search':
      result = await handleSearch(intent, input);
      break;
    case 'document':
      result = await handleDocumentation(intent, input);
      break;
    case 'example':
      result = await handleExamples(intent, input);
      break;
    case 'explain':
      result = await handleExplanation(intent, input);
      break;
    default:
      result = await handleSearch(intent, input);
  }

  // Add intelligence features
  const suggestions = generateSuggestions(intent, result);
  const related = input.includeRelated ? findRelatedModules(intent, result) : [];

  // Encode the result
  const encoded = DataEncoder.encode(result, input.format);

  return {
    content: [
      {
        type: 'text' as const,
        text: encoded,
      },
    ],
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      format: input.format,
      tokenEstimate: DataEncoder.estimateTokens(encoded),
      suggestions,
      related: related.length > 0 ? DataEncoder.encode({ modules: related }, 'toon') : undefined,
    },
  };
}

/**
 * Parse natural language query to determine intent
 *
 * Confidence scoring rationale:
 * - 0.9: Strong explicit keywords (list, validate, deploy) - rarely ambiguous
 * - 0.85: Clear intent with context (how + module name, test + method)
 * - 0.8: Specific patterns (example, code) - usually clear
 * - 0.7: Weaker signals (explain) - often needs fallback
 * - 0.6: Default search - catch-all, lowest confidence
 *
 * Lower confidence triggers more defensive handling and clearer error messages
 */
function parseIntent(query: string): ParsedIntent {
  const q = query.toLowerCase();

  // Discovery patterns (0.9: explicit listing keywords)
  if (/\b(list|show|all|available|browse|discover)\b/.test(q)) {
    // Check if it's a "list all" or "show all" pattern (no specific category)
    if (/\b(list|show)\s+(all|everything)\b/.test(q)) {
      return {
        type: 'discover',
        category: undefined,
        query: q,
        confidence: 0.9,
      };
    }

    // Check for category mentions using data-driven keywords
    const categoryKeywords = getCategoryKeywords();
    let matchedCategory: string | undefined;

    for (const keyword of categoryKeywords) {
      if (q.includes(keyword)) {
        matchedCategory = keyword;
        break;
      }
    }

    return {
      type: 'discover',
      category: matchedCategory,
      query: q,
      confidence: 0.9,
    };
  }

  // Documentation patterns (0.85 with module, 0.7 without - context matters)
  if (/\b(how|documentation|docs?|explain|use)\b/.test(q)) {
    const modules = extractModuleNames(q);
    return {
      type: modules.length > 0 ? 'document' : 'explain',
      modules,
      query: q,
      confidence: modules.length > 0 ? 0.85 : 0.7,
    };
  }

  // Example patterns (0.8: specific but requires module context)
  if (/\b(examples?|samples?|code|templates?|snippets?)\b/.test(q)) {
    const modules = extractModuleNames(q);
    return {
      type: 'example',
      modules,
      query: q,
      confidence: 0.8,
    };
  }

  // Search patterns (0.6: default fallback, weakest signal)
  return {
    type: 'search',
    query: q,
    confidence: 0.6,
  };
}

/**
 * Extract module names from query
 */
function extractModuleNames(query: string): string[] {
  const modules: string[] = [];
  const q = query.toLowerCase();

  for (const module of MODULES_MINIMAL) {
    if (q.includes(module.n.toLowerCase())) {
      modules.push(module.n);
    }
  }

  return modules;
}

/**
 * Handle discovery requests
 */
async function handleDiscovery(intent: ParsedIntent, _input: QueryInput) {
  if (intent.category) {
    const modules = getModulesByCategory(intent.category);
    return {
      action: 'category',
      category: intent.category,
      modules: modules.map(m => expandModule(m)),
      total: modules.length,
    };
  }

  // Return all modules organized by category
  const categories: Record<string, any[]> = {};

  for (const module of MODULES_MINIMAL) {
    const [cat] = module.c.split('/');
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(expandModule(module));
  }

  return {
    action: 'list-all',
    total: MODULES_MINIMAL.length,
    categories,
  };
}

/**
 * Handle search requests using semantic matching
 */
async function handleSearch(intent: ParsedIntent, input: QueryInput) {
  const query = intent.query || input.query;
  const results: Array<{ module: any; score: number }> = [];

  // Search through modules using use-case metadata
  const useCases = useCaseData.useCases as Array<{ m: string; k: string }>;

  for (const uc of useCases) {
    const keywords = uc.k.toLowerCase();
    const q = query.toLowerCase();

    // Calculate relevance score
    let score = 0;

    // Exact module name match
    if (uc.m.toLowerCase() === q) {
      score = 100;
    }
    // Module name contains query
    else if (uc.m.toLowerCase().includes(q)) {
      score = 80;
    }
    // Keywords contain query
    else if (keywords.includes(q)) {
      score = 60;
      // Boost if it's marked as "always" (fundamental module)
      if (keywords.includes('always')) {
        score += 20;
      }
    }
    // Individual keyword match
    else {
      const queryWords = q.split(/\s+/);
      const keywordList = keywords.split(',').map(k => k.trim());

      for (const qw of queryWords) {
        for (const kw of keywordList) {
          if (kw.includes(qw)) {
            score += 20;
          }
        }
      }
    }

    if (score > 0) {
      const module = getModule(uc.m);
      if (module) {
        results.push({ module: expandModule(module), score });
      }
    }
  }

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  return {
    action: 'search',
    query,
    results: results.slice(0, 10).map(r => r.module),
    total: results.length,
  };
}

/**
 * Handle documentation requests
 */
async function handleDocumentation(intent: ParsedIntent, input: QueryInput) {
  const moduleNames = intent.modules || [];

  if (moduleNames.length === 0) {
    return handleSearch(intent, input);
  }

  const modules = moduleNames.map(name => {
    const mod = getModule(name);
    return mod ? expandModule(mod) : null;
  }).filter(Boolean);

  // Fetch actual documentation content from URLs
  try {
    const fetch = (await import('node-fetch')).default;
    const { default: TurndownService } = await import('turndown');

    const docsWithContent = await Promise.all(
      modules.map(async (m: any) => {
        try {
          logger.debug(`Fetching docs from: ${m.docUrl}`);
          const response = await fetch(m.docUrl, {
            headers: { 'User-Agent': getUserAgent() },
            signal: AbortSignal.timeout(5000)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const html = await response.text();

          // Convert HTML to markdown
          const turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
          });
          const markdown = turndown.turndown(html);

          // Extract main content (remove nav, footer, etc)
          const contentMatch = markdown.match(/# [\s\S]*?(?=\n##|$)/);
          const cleanContent = contentMatch ? contentMatch[0] : markdown.slice(0, 2000);

          return {
            ...m,
            content: cleanContent.slice(0, 3000), // Limit to 3000 chars per module
            source: `Full docs: ${m.docUrl}`,
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
      action: 'document',
      modules: docsWithContent,
      format: 'detailed',
    };
  } catch (error: any) {
    logger.error('Documentation fetch error:', error);
    // Fallback to URLs only
    return {
      action: 'document',
      modules: modules.map(m => ({
        ...m,
        content: `View full documentation at: ${m.docUrl}`,
        source: m.githubUrl,
      })),
      format: 'summary',
    };
  }
}

/**
 * Handle example requests
 */
async function handleExamples(intent: ParsedIntent, _input: QueryInput) {
  const moduleNames = intent.modules || [];

  if (moduleNames.length === 0) {
    return {
      action: 'example',
      message: 'Please specify which module you need examples for',
      suggestions: ['Array examples', 'Map examples', 'Text manipulation examples'],
    };
  }

  const modules = moduleNames.map(name => {
    const mod = getModule(name);
    return mod ? expandModule(mod) : null;
  }).filter(Boolean);

  // Fetch actual examples from documentation
  try {
    const fetch = (await import('node-fetch')).default;
    const { default: TurndownService } = await import('turndown');

    const examplesWithContent = await Promise.all(
      modules.map(async (m: any) => {
        try {
          logger.debug(`Fetching examples from: ${m.docUrl}`);
          const response = await fetch(m.docUrl, {
            headers: { 'User-Agent': getUserAgent() },
            signal: AbortSignal.timeout(5000)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const html = await response.text();

          // Convert HTML to markdown
          const turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
          });
          const markdown = turndown.turndown(html);

          // Extract code examples (code blocks)
          const codeBlocks: string[] = [];
          const codeBlockRegex = /```(?:motoko)?\n([\s\S]*?)```/g;
          let match;
          while ((match = codeBlockRegex.exec(markdown)) !== null) {
            codeBlocks.push(match[1].trim());
          }

          return {
            module: m.name,
            examples: codeBlocks.slice(0, 3), // Limit to 3 examples per module
            source: m.docUrl,
            hasExamples: codeBlocks.length > 0,
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
      action: 'example',
      modules: examplesWithContent,
      format: 'detailed',
    };
  } catch (error: any) {
    logger.error('Examples fetch error:', error);
    // Fallback to URLs only
    return {
      action: 'example',
      modules: modules.map(m => ({
        module: m.name,
        examples: [],
        source: m.docUrl,
        hasExamples: false,
        error: `View examples at: ${m.docUrl}`,
      })),
      format: 'summary',
    };
  }
}

/**
 * Handle explanation requests
 * Routes to search since we don't have a conceptual knowledge base
 */
async function handleExplanation(intent: ParsedIntent, input: QueryInput) {
  // Be honest: we don't have explanatory content, so search for relevant modules
  // This is more useful than returning generic marketing text
  const searchResult = await handleSearch(intent, input);

  // Add helpful context about what we found
  return {
    ...searchResult,
    action: 'explain-via-search',
    note: 'Searched for relevant modules. Use "how to use [module]" for detailed documentation.',
  };
}

/**
 * Generate next-action suggestions based on context
 */
function generateSuggestions(intent: ParsedIntent, result: any): string[] {
  const suggestions: string[] = [];

  switch (intent.type) {
    case 'discover':
      suggestions.push('Pick a module and ask: "how to use [module]"');
      suggestions.push('Search for specific functionality: "queue operations"');
      break;
    case 'search':
      if (result.results && result.results.length > 0) {
        const topModule = result.results[0].name;
        suggestions.push(`Get documentation: "explain ${topModule}"`);
        suggestions.push(`See examples: "${topModule} examples"`);
      }
      break;
    case 'document':
      if (result.modules && result.modules.length > 0) {
        suggestions.push('Try the code in the playground');
        suggestions.push('Ask for specific examples');
      }
      break;
  }

  return suggestions;
}

/**
 * Find related modules based on category and use-cases
 */
function findRelatedModules(_intent: ParsedIntent, result: any): any[] {
  const related: any[] = [];

  if (result.modules && result.modules.length > 0) {
    const module = result.modules[0];
    const category = module.category?.split('/')[0];

    if (category) {
      const sameCategory = getModulesByCategory(category)
        .filter(m => m.n !== module.name)
        .slice(0, 3)
        .map(m => expandModule(m));

      related.push(...sameCategory);
    }
  }

  return related;
}

// Export for use in main index
export const queryTool = {
  name: 'icp/query',
  description: `Natural language interface for ICP development knowledge.

ALWAYS START HERE for any ICP question or documentation need.

Understands queries like:
- "list all data structures" → discovers relevant modules
- "how do I use Array" → fetches Array documentation
- "token canister example" → finds templates and examples
- "which module for random numbers" → intelligent search

Features:
- Semantic matching using AI-generated use-cases
- TOON format by default (50% fewer tokens)
- Smart caching with offline fallback
- Context-aware suggestions

Returns TOON-formatted data for efficiency.`,
  inputSchema: QueryInputSchema,
  execute: query,
};