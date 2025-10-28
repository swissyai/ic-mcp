/**
 * Enhanced Motoko Core Discovery Tool
 * Provides comprehensive module discovery with multiple data sources
 */

import { z } from 'zod';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { Cache } from '../utils/cache.js';
import { Octokit } from '@octokit/rest';

// Create specialized cache for discovery
const discoveryCache = new Cache<any>();
const WEB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for web content
const GITHUB_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for GitHub content

// Initialize GitHub client for fallback
const octokit = new Octokit();

// Input schemas for discovery features
export const DiscoverInputSchema = z.object({
  action: z.enum(['list-all', 'search', 'category', 'get-batch']).describe('Discovery action'),
  query: z.string().optional().describe('Search query for finding modules'),
  category: z.string().optional().describe('Category to filter by'),
  modules: z.array(z.string()).optional().describe('List of modules for batch fetch'),
  includeUrls: z.boolean().optional().default(true).describe('Include documentation URLs'),
  format: z.enum(['full', 'summary', 'names-only']).optional().default('summary'),
  source: z.enum(['auto', 'web', 'github', 'cache', 'static']).optional().default('auto'),
});

export type DiscoverInput = z.infer<typeof DiscoverInputSchema>;

interface ModuleInfo {
  name: string;
  description: string;
  category: string;
  namespace?: string;
  docUrl?: string;
  githubUrl?: string;
  playgroundUrl?: string;
  methods?: string[];
  priority?: number;
  source?: string;
}

interface DiscoveryResult {
  modules: ModuleInfo[];
  categories: Record<string, string[]>;
  total: number;
  fetchedAt: string;
  sources: string[];
}

/**
 * Complete module index - comprehensive fallback
 */
const COMPLETE_MODULE_INDEX: Record<string, ModuleInfo> = {
  // Data Structures - Mutable
  'Array': {
    name: 'Array',
    description: 'Provides extended utility functions on immutable Arrays (values of type [T])',
    category: 'data-structures/arrays',
    priority: 1,
  },
  'VarArray': {
    name: 'VarArray',
    description: 'Provides extended utility functions on mutable Arrays ([var])',
    category: 'data-structures/arrays',
    priority: 1,
  },
  'Map': {
    name: 'Map',
    description: 'An imperative key-value map based on order/comparison of the keys',
    category: 'data-structures/maps',
    priority: 1,
  },
  'Set': {
    name: 'Set',
    description: 'Imperative (mutable) sets based on order/comparison of elements',
    category: 'data-structures/sets',
    priority: 1,
  },
  'List': {
    name: 'List',
    description: 'A mutable list data structure with efficient random access and dynamic resizing',
    category: 'data-structures/lists',
    priority: 1,
  },
  'Queue': {
    name: 'Queue',
    description: 'A mutable double-ended queue of elements',
    category: 'data-structures/queues',
    priority: 1,
  },
  'Stack': {
    name: 'Stack',
    description: 'A mutable stack data structure',
    category: 'data-structures/stacks',
    priority: 1,
  },

  // Data Structures - Immutable (pure)
  'pure/List': {
    name: 'pure/List',
    description: 'Purely-functional, singly-linked lists',
    category: 'data-structures/immutable',
    namespace: 'pure',
    priority: 1,
  },
  'pure/Map': {
    name: 'pure/Map',
    description: 'Immutable, ordered key-value maps',
    category: 'data-structures/immutable',
    namespace: 'pure',
    priority: 1,
  },
  'pure/Set': {
    name: 'pure/Set',
    description: 'Pure (immutable) sets based on order/comparison of elements',
    category: 'data-structures/immutable',
    namespace: 'pure',
    priority: 1,
  },
  'pure/Queue': {
    name: 'pure/Queue',
    description: 'Double-ended queue of a generic element type T',
    category: 'data-structures/immutable',
    namespace: 'pure',
    priority: 1,
  },
  'pure/RealTimeQueue': {
    name: 'pure/RealTimeQueue',
    description: 'Double-ended immutable queue with guaranteed O(1) push/pop operations',
    category: 'data-structures/immutable',
    namespace: 'pure',
    priority: 2,
  },

  // Primitive Types
  'Bool': {
    name: 'Bool',
    description: 'Boolean type and operations',
    category: 'primitives/boolean',
    priority: 2,
  },
  'Char': {
    name: 'Char',
    description: 'Module for working with Characters (Unicode code points)',
    category: 'primitives/text',
    priority: 2,
  },
  'Text': {
    name: 'Text',
    description: 'Utility functions for Text values',
    category: 'primitives/text',
    priority: 1,
  },
  'Blob': {
    name: 'Blob',
    description: 'Module for working with Blobs (immutable sequences of bytes)',
    category: 'primitives/binary',
    priority: 2,
  },

  // Numbers
  'Int': {
    name: 'Int',
    description: 'Signed integer numbers with infinite precision (big integers)',
    category: 'primitives/numbers',
    priority: 1,
  },
  'Int8': {
    name: 'Int8',
    description: 'Utility functions on 8-bit signed integers',
    category: 'primitives/numbers',
    priority: 3,
  },
  'Int16': {
    name: 'Int16',
    description: 'Utility functions on 16-bit signed integers',
    category: 'primitives/numbers',
    priority: 3,
  },
  'Int32': {
    name: 'Int32',
    description: 'Utility functions on 32-bit signed integers',
    category: 'primitives/numbers',
    priority: 3,
  },
  'Int64': {
    name: 'Int64',
    description: 'Utility functions on 64-bit signed integers',
    category: 'primitives/numbers',
    priority: 3,
  },
  'Nat': {
    name: 'Nat',
    description: 'Natural numbers with infinite precision',
    category: 'primitives/numbers',
    priority: 1,
  },
  'Nat8': {
    name: 'Nat8',
    description: 'Utility functions on 8-bit unsigned integers',
    category: 'primitives/numbers',
    priority: 3,
  },
  'Nat16': {
    name: 'Nat16',
    description: 'Utility functions on 16-bit unsigned integers',
    category: 'primitives/numbers',
    priority: 3,
  },
  'Nat32': {
    name: 'Nat32',
    description: 'Utility functions on 32-bit unsigned integers',
    category: 'primitives/numbers',
    priority: 3,
  },
  'Nat64': {
    name: 'Nat64',
    description: 'Utility functions on 64-bit unsigned integers',
    category: 'primitives/numbers',
    priority: 3,
  },
  'Float': {
    name: 'Float',
    description: 'Double precision (64-bit) floating-point numbers in IEEE 754 representation',
    category: 'primitives/numbers',
    priority: 2,
  },

  // System & Runtime
  'Principal': {
    name: 'Principal',
    description: 'Module for interacting with Principals (users and canisters)',
    category: 'system/identity',
    priority: 1,
  },
  'Cycles': {
    name: 'Cycles',
    description: 'Managing cycles within actors in the Internet Computer Protocol',
    category: 'system/cycles',
    priority: 1,
  },
  'InternetComputer': {
    name: 'InternetComputer',
    description: 'Low-level interface to the Internet Computer',
    category: 'system/ic',
    priority: 2,
  },
  'CertifiedData': {
    name: 'CertifiedData',
    description: 'Certified data',
    category: 'system/certified',
    priority: 2,
  },
  'Region': {
    name: 'Region',
    description: 'Byte-level access to isolated, virtual stable memory regions',
    category: 'system/memory',
    priority: 3,
  },
  'Runtime': {
    name: 'Runtime',
    description: 'Runtime utilities',
    category: 'system/runtime',
    priority: 3,
  },
  'Time': {
    name: 'Time',
    description: 'System time utilities and timers',
    category: 'system/time',
    priority: 2,
  },
  'Timer': {
    name: 'Timer',
    description: 'Timers for one-off or periodic tasks',
    category: 'system/time',
    priority: 2,
  },
  'Random': {
    name: 'Random',
    description: 'Random number generation',
    category: 'system/random',
    priority: 2,
  },

  // Utilities
  'Option': {
    name: 'Option',
    description: 'Typesafe nullable values',
    category: 'utilities/control',
    priority: 1,
  },
  'Result': {
    name: 'Result',
    description: 'Module for error handling with the Result type',
    category: 'utilities/control',
    priority: 1,
  },
  'Error': {
    name: 'Error',
    description: 'Error values and inspection',
    category: 'utilities/error',
    priority: 2,
  },
  'Debug': {
    name: 'Debug',
    description: 'Utility functions for debugging',
    category: 'utilities/debug',
    priority: 2,
  },
  'Iter': {
    name: 'Iter',
    description: 'Utilities for Iter (iterator) values',
    category: 'utilities/iteration',
    priority: 1,
  },
  'Func': {
    name: 'Func',
    description: 'Functions on functions, creating functions from simpler inputs',
    category: 'utilities/functional',
    priority: 3,
  },
  'Order': {
    name: 'Order',
    description: 'Utilities for Order (comparison between two values)',
    category: 'utilities/comparison',
    priority: 3,
  },
  'Tuples': {
    name: 'Tuples',
    description: 'Contains modules for working with tuples of different sizes',
    category: 'utilities/tuples',
    priority: 3,
  },
  'Types': {
    name: 'Types',
    description: 'Type definitions and utilities',
    category: 'utilities/types',
    priority: 3,
  },

  // Internal
  'internal/BTreeHelper': {
    name: 'internal/BTreeHelper',
    description: 'Internal B-tree helper functions',
    category: 'internal',
    namespace: 'internal',
    priority: 4,
  },
  'internal/PRNG': {
    name: 'internal/PRNG',
    description: 'Collection of pseudo-random number generators',
    category: 'internal',
    namespace: 'internal',
    priority: 4,
  },
};

/**
 * Add URLs to module info
 */
function enrichModuleWithUrls(module: ModuleInfo): ModuleInfo {
  const baseName = module.name.replace('/', '/');
  return {
    ...module,
    docUrl: module.docUrl || `https://internetcomputer.org/docs/motoko/core/${baseName}`,
    githubUrl: module.githubUrl || `https://github.com/dfinity/motoko-core/blob/main/src/${baseName}.mo`,
    playgroundUrl: module.playgroundUrl || `https://play.motoko.org/?tag=${module.name.toLowerCase()}`,
  };
}

/**
 * Fetch from GitHub as fallback
 */
async function fetchFromGitHub(): Promise<ModuleInfo[] | null> {
  const cacheKey = 'github-modules';
  const cached = discoveryCache.get(cacheKey);
  if (cached) return cached;

  try {
    logger.info('Fetching module list from GitHub');

    // Fetch the src directory listing
    const { data: srcFiles } = await octokit.repos.getContent({
      owner: 'dfinity',
      repo: 'motoko-core',
      path: 'src',
    });

    if (!Array.isArray(srcFiles)) {
      logger.warn('GitHub API returned non-array for src directory');
      return null;
    }

    const modules: ModuleInfo[] = [];

    // Process regular files
    for (const file of srcFiles) {
      if (file.type === 'file' && file.name.endsWith('.mo')) {
        const moduleName = file.name.replace('.mo', '');
        if (COMPLETE_MODULE_INDEX[moduleName]) {
          modules.push(enrichModuleWithUrls(COMPLETE_MODULE_INDEX[moduleName]));
        }
      }
    }

    // Check pure subdirectory
    try {
      const { data: pureFiles } = await octokit.repos.getContent({
        owner: 'dfinity',
        repo: 'motoko-core',
        path: 'src/pure',
      });

      if (Array.isArray(pureFiles)) {
        for (const file of pureFiles) {
          if (file.type === 'file' && file.name.endsWith('.mo')) {
            const moduleName = `pure/${file.name.replace('.mo', '')}`;
            if (COMPLETE_MODULE_INDEX[moduleName]) {
              modules.push(enrichModuleWithUrls(COMPLETE_MODULE_INDEX[moduleName]));
            }
          }
        }
      }
    } catch (error) {
      logger.debug('Could not fetch pure directory from GitHub');
    }

    discoveryCache.set(cacheKey, modules, GITHUB_CACHE_TTL);
    return modules;

  } catch (error) {
    logger.error('Error fetching from GitHub:', error);
    return null;
  }
}

/**
 * Fetch live documentation from internetcomputer.org
 */
async function fetchFromWeb(): Promise<ModuleInfo[] | null> {
  const cacheKey = 'web-modules';
  const cached = discoveryCache.get(cacheKey);
  if (cached) return cached;

  try {
    logger.info('Fetching module list from internetcomputer.org');

    const response = await fetch('https://internetcomputer.org/docs/motoko/core', {
      headers: {
        'User-Agent': 'IC-MCP/1.0',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      logger.warn(`Web fetch failed with status: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const modules: ModuleInfo[] = [];
    const foundModules = new Set<string>();

    // Multiple selector strategies for robustness
    const selectors = [
      'a[href*="/docs/motoko/core/"]',
      '.docs-card a',
      '.module-entry a',
      'article a[href*="core/"]',
      'main a[href*="/motoko/core/"]',
      'table a[href*="core/"]',
      'ul a[href*="/docs/motoko/core/"]',
    ];

    for (const selector of selectors) {
      $(selector).each((_index: number, elem: any) => {
        const $elem = $(elem);
        const href = $elem.attr('href');
        const text = $elem.text().trim();

        if (!href || !text) return;

        // Extract module name from href or text
        let moduleName = '';
        if (href.includes('/docs/motoko/core/')) {
          moduleName = href.split('/docs/motoko/core/')[1]?.replace('/', '');
        } else {
          moduleName = text.split(' ')[0].replace(/[^a-zA-Z0-9/_-]/g, '');
        }

        // Check if we already have this module (deduplication fix)
        if (foundModules.has(moduleName)) return;

        // Validate and add module
        if (moduleName && COMPLETE_MODULE_INDEX[moduleName]) {
          foundModules.add(moduleName);
          modules.push({
            ...enrichModuleWithUrls(COMPLETE_MODULE_INDEX[moduleName]),
            source: 'web',
          });
        }
      });
    }

    if (modules.length > 20) {
      discoveryCache.set(cacheKey, modules, WEB_CACHE_TTL);
      return modules;
    }

    return null;

  } catch (error) {
    logger.error('Error fetching from web:', error);
    return null;
  }
}

/**
 * Get modules from the most appropriate source
 */
async function getModules(preferredSource: string = 'auto'): Promise<DiscoveryResult> {
  const sources: string[] = [];
  let modules: ModuleInfo[] = [];

  // Try sources in order based on preference
  if (preferredSource === 'auto' || preferredSource === 'web') {
    const webModules = await fetchFromWeb();
    if (webModules && webModules.length > 0) {
      modules = webModules;
      sources.push('web');
    }
  }

  if (modules.length === 0 && (preferredSource === 'auto' || preferredSource === 'github')) {
    const githubModules = await fetchFromGitHub();
    if (githubModules && githubModules.length > 0) {
      modules = githubModules;
      sources.push('github');
    }
  }

  // Always fall back to static index
  if (modules.length === 0) {
    logger.info('Using static module index');
    modules = Object.values(COMPLETE_MODULE_INDEX).map(enrichModuleWithUrls);
    sources.push('static');
  }

  // Ensure all modules have proper URLs
  modules = modules.map(enrichModuleWithUrls);

  return {
    modules,
    categories: groupByCategory(modules),
    total: modules.length,
    fetchedAt: new Date().toISOString(),
    sources,
  };
}

/**
 * Group modules by category
 */
function groupByCategory(modules: ModuleInfo[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {};

  for (const module of modules) {
    const cat = module.category;
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(module.name);
  }

  // Sort module names within each category
  for (const cat of Object.keys(categories)) {
    categories[cat].sort();
  }

  return categories;
}

/**
 * Search modules with fuzzy matching
 */
function searchModules(query: string, modules: ModuleInfo[]): ModuleInfo[] {
  const q = query.toLowerCase();
  const results: Array<{ module: ModuleInfo; score: number }> = [];

  for (const module of modules) {
    let score = 0;

    // Exact name match
    if (module.name.toLowerCase() === q) score = 100;
    // Name starts with query
    else if (module.name.toLowerCase().startsWith(q)) score = 90;
    // Name contains query
    else if (module.name.toLowerCase().includes(q)) score = 80;
    // Description contains query
    else if (module.description.toLowerCase().includes(q)) score = 60;
    // Category contains query
    else if (module.category.toLowerCase().includes(q)) score = 40;

    // Special handling for common aliases
    const aliases: Record<string, string[]> = {
      'array': ['Array', 'VarArray'],
      'list': ['List', 'pure/List'],
      'map': ['Map', 'pure/Map'],
      'set': ['Set', 'pure/Set'],
      'queue': ['Queue', 'pure/Queue', 'pure/RealTimeQueue'],
      'number': ['Int', 'Nat', 'Float'],
      'string': ['Text'],
      'bool': ['Bool'],
      'boolean': ['Bool'],
    };

    if (aliases[q] && aliases[q].includes(module.name)) {
      score = Math.max(score, 85);
    }

    if (score > 0) {
      results.push({ module, score });
    }
  }

  // Sort by score and priority
  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.module.priority || 99) - (b.module.priority || 99);
    })
    .map(r => r.module);
}

/**
 * Format discovery result for output
 */
function formatDiscoveryResult(data: DiscoveryResult, format: string): string {
  if (format === 'names-only') {
    return data.modules.map(m => m.name).sort().join('\n');
  }

  const output: string[] = [
    `# Motoko Core Library - Complete Module Index`,
    ``,
    `**Total Modules**: ${data.total}`,
    `**Last Updated**: ${data.fetchedAt}`,
    `**Sources**: ${data.sources.join(', ')}`,
    ``,
  ];

  if (format === 'full') {
    output.push(`## All Modules with Details\n`);

    // Group by category for better organization
    const byCategory: Record<string, ModuleInfo[]> = {};
    for (const module of data.modules) {
      if (!byCategory[module.category]) {
        byCategory[module.category] = [];
      }
      byCategory[module.category].push(module);
    }

    // Sort categories
    const sortedCategories = Object.keys(byCategory).sort();

    for (const category of sortedCategories) {
      const categoryName = category
        .split('/')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' - ');

      output.push(`### ${categoryName}\n`);

      for (const module of byCategory[category]) {
        output.push(`#### ${module.name}`);
        output.push(`**Description**: ${module.description}`);
        if (module.docUrl) output.push(`**Documentation**: ${module.docUrl}`);
        if (module.githubUrl) output.push(`**Source Code**: ${module.githubUrl}`);
        if (module.playgroundUrl) output.push(`**Try in Playground**: ${module.playgroundUrl}`);
        output.push(``);
      }
    }
  } else {
    // Summary format
    output.push(`## Modules by Category\n`);

    for (const [category, moduleNames] of Object.entries(data.categories)) {
      const categoryName = category
        .split('/')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' - ');

      output.push(`### ${categoryName}`);
      for (const name of moduleNames) {
        const module = data.modules.find(m => m.name === name);
        if (module) {
          output.push(`- **${name}**: ${module.description}`);
        }
      }
      output.push(``);
    }
  }

  output.push(`## Quick Reference`);
  output.push(`- [Official Documentation](https://internetcomputer.org/docs/motoko/core)`);
  output.push(`- [GitHub Repository](https://github.com/dfinity/motoko-core)`);
  output.push(`- [Motoko Playground](https://play.motoko.org/)`);

  return output.join('\n');
}

/**
 * Format search results
 */
function formatSearchResults(query: string, results: ModuleInfo[], includeUrls: boolean): string {
  const output: string[] = [
    `# Search Results for "${query}"`,
    ``,
    `Found ${results.length} matching module(s):`,
    ``,
  ];

  if (results.length === 0) {
    output.push(`No modules found matching "${query}".`);
    output.push(``);
    output.push(`Try searching for:`);
    output.push(`- Data structures: array, list, map, set, queue, stack`);
    output.push(`- Primitives: int, nat, float, text, char, bool`);
    output.push(`- System: principal, cycles, timer, random`);
    output.push(`- Utilities: option, result, error, debug, iter`);
  } else {
    for (const module of results.slice(0, 10)) { // Limit to top 10 results
      output.push(`## ${module.name}`);
      output.push(`**Category**: ${module.category}`);
      output.push(`**Description**: ${module.description}`);
      if (includeUrls) {
        if (module.docUrl) output.push(`**Documentation**: ${module.docUrl}`);
        if (module.githubUrl) output.push(`**Source**: ${module.githubUrl}`);
      }
      output.push(``);
    }

    if (results.length > 10) {
      output.push(`... and ${results.length - 10} more modules`);
    }
  }

  return output.join('\n');
}

/**
 * Main discovery handler
 */
export async function discover(input: DiscoverInput) {
  try {
    // Get modules from appropriate source
    const data = await getModules(input.source);

    switch (input.action) {
      case 'list-all': {
        return {
          content: [
            {
              type: 'text' as const,
              text: formatDiscoveryResult(data, input.format || 'summary'),
            },
          ],
        };
      }

      case 'search': {
        if (!input.query) {
          throw new Error('Query parameter is required for search action');
        }

        const results = searchModules(input.query, data.modules);

        return {
          content: [
            {
              type: 'text' as const,
              text: formatSearchResults(input.query, results, input.includeUrls !== false),
            },
          ],
        };
      }

      case 'category': {
        if (!input.category) {
          throw new Error('Category parameter is required for category action');
        }

        const categoryModules = data.modules.filter(
          m => m.category === input.category || m.category.startsWith(input.category + '/')
        );

        if (categoryModules.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No modules found in category "${input.category}".\n\nAvailable categories:\n${Object.keys(data.categories).sort().join('\n')}`,
              },
            ],
          };
        }

        const output: string[] = [
          `# Category: ${input.category}`,
          ``,
          `**Modules in this category**: ${categoryModules.length}`,
          ``,
        ];

        for (const module of categoryModules) {
          output.push(`## ${module.name}`);
          output.push(`${module.description}`);
          if (input.includeUrls !== false && module.docUrl) {
            output.push(`- [Documentation](${module.docUrl})`);
            if (module.githubUrl) output.push(`- [Source Code](${module.githubUrl})`);
          }
          output.push(``);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: output.join('\n'),
            },
          ],
        };
      }

      case 'get-batch': {
        if (!input.modules || input.modules.length === 0) {
          throw new Error('Modules parameter is required for get-batch action');
        }

        const results: any[] = [];
        for (const name of input.modules) {
          const module = data.modules.find(m => m.name === name);
          if (module) {
            results.push(module);
          } else {
            results.push({
              name,
              error: 'Module not found',
              suggestion: `Try searching with action: "search", query: "${name}"`,
            });
          }
        }

        const output: string[] = [
          `# Batch Module Information`,
          ``,
          `Retrieved ${results.length} module(s):`,
          ``,
        ];

        for (const result of results) {
          if (result.error) {
            output.push(`## ${result.name}`);
            output.push(`**Error**: ${result.error}`);
            if (result.suggestion) output.push(`**Suggestion**: ${result.suggestion}`);
          } else {
            output.push(`## ${result.name}`);
            output.push(`**Description**: ${result.description}`);
            output.push(`**Category**: ${result.category}`);
            if (input.includeUrls !== false) {
              if (result.docUrl) output.push(`**Documentation**: ${result.docUrl}`);
              if (result.githubUrl) output.push(`**Source**: ${result.githubUrl}`);
            }
          }
          output.push(``);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: output.join('\n'),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  } catch (error: any) {
    logger.error('Discovery error:', error);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: error.message,
            tip: 'Use action: "list-all" to see all available modules',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

// Export tool definition
export const discoveryTool = {
  name: 'icp/discover',
  description: `Primary tool for discovering Motoko core library modules. ALWAYS USE THIS FIRST when working with Motoko to see what's available.

When to use:
- User asks about available modules or data structures
- Starting any Motoko development task
- Need to find specific functionality
- Want to explore module categories

Actions:
- list-all: Get complete module index with all 45+ modules
- search: Find modules matching a query (e.g., "array", "queue")
- category: List modules in a specific category
- get-batch: Fetch details for multiple specific modules

Returns comprehensive module information with direct documentation links.`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list-all', 'search', 'category', 'get-batch'],
        description: 'Discovery action to perform',
      },
      query: {
        type: 'string',
        description: 'Search query (required for search action)',
      },
      category: {
        type: 'string',
        description: 'Category name (required for category action)',
      },
      modules: {
        type: 'array',
        items: { type: 'string' },
        description: 'Module names (required for get-batch action)',
      },
      includeUrls: {
        type: 'boolean',
        description: 'Include documentation URLs (default: true)',
      },
      format: {
        type: 'string',
        enum: ['full', 'summary', 'names-only'],
        description: 'Output format (default: summary)',
      },
      source: {
        type: 'string',
        enum: ['auto', 'web', 'github', 'cache', 'static'],
        description: 'Data source preference (default: auto)',
      },
    },
    required: ['action'],
  },
};