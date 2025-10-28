/**
 * Motoko Core Documentation Tool with Batch Support
 * Provides comprehensive module documentation
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

// Enhanced input schema with batch support
export const EnhancedMotokoCoreInputSchema = z.object({
  modules: z
    .array(z.string())
    .optional()
    .describe('Batch fetch multiple modules (efficient)'),
  module: z
    .string()
    .optional()
    .describe('Single module name'),
  method: z
    .string()
    .optional()
    .describe('Specific method to get details for'),
  examples: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include code examples'),
  includeComplexity: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include time/space complexity info'),
  includeLinks: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include documentation links'),
}).refine(
  (data) => data.modules || data.module,
  { message: 'Either modules (array) or module (string) must be provided' }
);

// Also export as MotokoCoreInputSchema for compatibility
export const MotokoCoreInputSchema = EnhancedMotokoCoreInputSchema;
export type MotokoCoreInput = z.infer<typeof MotokoCoreInputSchema>;

// Common Motoko modules with descriptions
const MODULES_INFO: Record<string, { description: string; priority: number; path?: string }> = {
  // Core data structures
  'Array': { description: 'Mutable and immutable array operations', priority: 1 },
  'Text': { description: 'Text/string operations and utilities', priority: 1 },
  'Map': { description: 'Ordered maps (red-black trees)', priority: 1 },
  'Set': { description: 'Ordered sets', priority: 1 },
  'VarArray': { description: 'Variable-size mutable arrays', priority: 1 },

  // Numeric types
  'Nat': { description: 'Natural numbers (non-negative)', priority: 2 },
  'Int': { description: 'Integer operations', priority: 2 },
  'Float': { description: 'Floating-point operations', priority: 2 },
  'Nat8': { description: '8-bit natural numbers', priority: 3 },
  'Nat16': { description: '16-bit natural numbers', priority: 3 },
  'Nat32': { description: '32-bit natural numbers', priority: 3 },
  'Nat64': { description: '64-bit natural numbers', priority: 3 },
  'Int8': { description: '8-bit integers', priority: 3 },
  'Int16': { description: '16-bit integers', priority: 3 },
  'Int32': { description: '32-bit integers', priority: 3 },
  'Int64': { description: '64-bit integers', priority: 3 },

  // Control flow and utilities
  'Iter': { description: 'Iteration over collections', priority: 2 },
  'Result': { description: 'Error handling with Result<Ok, Err>', priority: 2 },
  'Option': { description: 'Optional values (null safety)', priority: 2 },
  'Error': { description: 'Error handling and propagation', priority: 2 },

  // System and runtime
  'Principal': { description: 'Principal IDs for identity', priority: 2 },
  'Cycles': { description: 'Cycle management and accounting', priority: 2 },
  'Time': { description: 'Time and timestamp utilities', priority: 3 },
  'Timer': { description: 'Timer scheduling and management', priority: 3 },
  'Debug': { description: 'Debugging utilities', priority: 3 },
  'Runtime': { description: 'Runtime information and control', priority: 3 },
  'InternetComputer': { description: 'IC system API bindings', priority: 3 },
  'CertifiedData': { description: 'Certified data management', priority: 3 },

  // Data types
  'Blob': { description: 'Binary data operations', priority: 3 },
  'Bool': { description: 'Boolean operations', priority: 3 },
  'Char': { description: 'Character operations', priority: 3 },
  'Order': { description: 'Ordering comparisons', priority: 3 },

  // Additional data structures
  'Queue': { description: 'FIFO queue operations', priority: 3 },
  'Stack': { description: 'LIFO stack operations', priority: 3 },
  'Random': { description: 'Pseudorandom number generation', priority: 4 },
  'Region': { description: 'Low-level memory regions', priority: 4 },
  'Func': { description: 'Function utilities', priority: 4 },
  'Types': { description: 'Type utilities and definitions', priority: 4 },
  'Tuples': { description: 'Tuple utilities and operations', priority: 4 },

  // Pure (immutable) modules
  'pure/List': { description: 'Immutable singly-linked lists', priority: 2, path: 'pure/List' },
  'pure/Map': { description: 'Immutable ordered maps', priority: 2, path: 'pure/Map' },
  'pure/Set': { description: 'Immutable ordered sets', priority: 2, path: 'pure/Set' },
  'pure/Queue': { description: 'Immutable FIFO queues', priority: 2, path: 'pure/Queue' },
  'pure/RealTimeQueue': { description: 'Immutable real-time queues', priority: 3, path: 'pure/RealTimeQueue' },
};

interface MethodInfo {
  name: string;
  signature: string;
  description: string;
  complexity?: string;
  example?: string;
}

interface ModuleDoc {
  module: string;
  description: string;
  overview: string;
  import: string;
  methods?: MethodInfo[];
  relatedModules?: string[];
  tips?: string[];
}

// Module corrections and suggestions
const MODULE_CORRECTIONS: Record<string, string[]> = {
  'list': ['pure/List', 'List'],
  'map': ['Map', 'pure/Map'],
  'set': ['Set', 'pure/Set'],
  'queue': ['Queue', 'pure/Queue', 'pure/RealTimeQueue'],
  'array': ['Array', 'VarArray'],
  'hashmap': ['Map'],
  'buffer': ['VarArray'],
  'triemap': ['pure/Map'],
  'trieset': ['pure/Set'],
  'heap': ['Use custom implementation or Array with sorting'],
  'hash': ['No direct replacement - removed for security'],
  'assoclist': ['Map'],
  'deque': ['pure/Queue'],
  'orderedmap': ['pure/Map'],
  'orderedset': ['pure/Set'],
};

/**
 * Get suggestions for unknown module
 */
function getSuggestions(input: string): string[] {
  const suggestions: string[] = [];
  const query = input.toLowerCase();

  // Check direct corrections
  if (MODULE_CORRECTIONS[query]) {
    suggestions.push(...MODULE_CORRECTIONS[query]);
  }

  // All valid modules
  const validModules = Object.keys(MODULES_INFO);

  // Find partial matches
  for (const mod of validModules) {
    if (mod.toLowerCase().includes(query) && !suggestions.includes(mod)) {
      suggestions.push(mod);
    }
  }

  return suggestions.slice(0, 5);
}

/**
 * Get related modules
 */
function getRelatedModules(moduleName: string): Array<{ name: string; reason: string }> {
  const relations: Record<string, Array<{ name: string; reason: string }>> = {
    'Array': [
      { name: 'VarArray', reason: 'Mutable version with dynamic sizing' },
      { name: 'pure/List', reason: 'Functional alternative' },
      { name: 'Iter', reason: 'Iteration utilities' },
    ],
    'VarArray': [
      { name: 'Array', reason: 'Immutable version' },
      { name: 'List', reason: 'Alternative mutable collection' },
    ],
    'Map': [
      { name: 'pure/Map', reason: 'Immutable version' },
      { name: 'Set', reason: 'When you only need keys' },
    ],
    'pure/Map': [
      { name: 'Map', reason: 'Mutable version' },
      { name: 'pure/Set', reason: 'Immutable set alternative' },
    ],
    'List': [
      { name: 'pure/List', reason: 'Immutable version' },
      { name: 'VarArray', reason: 'Alternative with better random access' },
      { name: 'Queue', reason: 'For FIFO operations' },
    ],
    'pure/List': [
      { name: 'List', reason: 'Mutable version' },
      { name: 'Array', reason: 'For random access needs' },
    ],
    'Queue': [
      { name: 'pure/Queue', reason: 'Immutable version' },
      { name: 'Stack', reason: 'For LIFO operations' },
      { name: 'pure/RealTimeQueue', reason: 'O(1) guaranteed operations' },
    ],
    'Int': [
      { name: 'Nat', reason: 'For non-negative values' },
      { name: 'Float', reason: 'For decimal numbers' },
    ],
    'Nat': [
      { name: 'Int', reason: 'For signed values' },
      { name: 'Nat64', reason: 'For bounded values' },
    ],
    'Option': [
      { name: 'Result', reason: 'For error handling' },
    ],
    'Result': [
      { name: 'Option', reason: 'For nullable values' },
      { name: 'Error', reason: 'For error details' },
    ],
  };

  return relations[moduleName] || [];
}

/**
 * Get usage tips for modules
 */
function getModuleTips(moduleName: string): string[] {
  const tips: Record<string, string[]> = {
    'Array': [
      'Arrays have fixed size after creation',
      'Use VarArray for growable arrays',
      'Array.tabulate() is efficient for initialization',
      'Consider pure/List for functional programming',
    ],
    'VarArray': [
      'Direct replacement for deprecated Buffer module',
      'Amortized O(1) append operation',
      'Use toArray() to convert to immutable Array',
      'Good for building collections incrementally',
    ],
    'Map': [
      'Mutable B-tree map with O(log n) operations',
      'Direct replacement for deprecated HashMap',
      'Use pure/Map for immutable needs',
      'Requires comparison function for keys',
    ],
    'pure/List': [
      'Immutable singly-linked list',
      'O(1) prepend, O(n) append',
      'Perfect for functional programming',
      'Use List for mutable needs',
    ],
    'pure/Map': [
      'Immutable red-black tree implementation',
      'All operations return new instances',
      'Safe for stable memory persistence',
      'Replacement for deprecated TrieMap',
    ],
    'Principal': [
      'Use Principal.fromText() to parse textual principals',
      'Principal.equal() for comparing principals',
      'Principal.toBlob() for hashing',
    ],
    'Cycles': [
      'Check balance with Cycles.balance()',
      'Accept cycles with Cycles.accept()',
      'Add cycles to calls with Cycles.add()',
    ],
    'Option': [
      'Use Option.get() with default value',
      'Option.map() for transformations',
      'Pattern match with switch for safety',
    ],
    'Result': [
      'Chain operations with Result.chain()',
      'Use Result.mapErr() to transform errors',
      'Result.fromOption() for conversion',
    ],
    'Timer': [
      'Use Timer.setTimer() for one-off timers',
      'Timer.recurringTimer() for periodic tasks',
      'Always cancel timers when done',
    ],
  };

  return tips[moduleName] || [];
}

/**
 * Generate module documentation
 */
function generateModuleDoc(moduleName: string): ModuleDoc {
  const moduleInfo = MODULES_INFO[moduleName];

  if (!moduleInfo) {
    throw new Error(`Module '${moduleName}' not found`);
  }


  return {
    module: moduleName,
    description: moduleInfo.description,
    overview: `The ${moduleName} module provides ${moduleInfo.description.toLowerCase()}.`,
    import: `import ${moduleName.includes('/') ? moduleName.split('/')[1] : moduleName} "mo:core/${moduleName}";`,
    tips: getModuleTips(moduleName),
    relatedModules: getRelatedModules(moduleName).map(r => r.name),
  };
}

/**
 * Format module documentation with optional enhancements
 */
function formatModuleDoc(doc: ModuleDoc, options: any): string {
  const output: string[] = [];

  // Add header with links if requested
  if (options.includeLinks !== false) {
    const baseName = doc.module.replace('/', '/');
    output.push(`# Motoko Core: ${doc.module}`);
    output.push('');
    output.push('## Quick Links');
    output.push(`- [Official Documentation](https://internetcomputer.org/docs/motoko/core/${baseName})`);
    output.push(`- [Source Code](https://github.com/dfinity/motoko-core/blob/main/src/${baseName}.mo)`);
    output.push(`- [Try in Playground](https://play.motoko.org/?tag=${doc.module.toLowerCase()})`);
    output.push('');
  } else {
    output.push(`# Motoko Core: ${doc.module}`);
    output.push('');
  }

  // Basic information
  output.push(`**Description**: ${doc.description}`);
  output.push('');
  output.push(`**Import**: \`${doc.import}\``);
  output.push('');
  output.push(doc.overview);
  output.push('');

  // Add usage tips
  if (doc.tips && doc.tips.length > 0) {
    output.push('## Usage Tips');
    for (const tip of doc.tips) {
      output.push(`- ${tip}`);
    }
    output.push('');
  }

  // Add related modules
  if (doc.relatedModules && doc.relatedModules.length > 0) {
    output.push('## Related Modules');
    const related = getRelatedModules(doc.module);
    for (const rel of related) {
      output.push(`- **${rel.name}**: ${rel.reason}`);
    }
    output.push('');
  }

  return output.join('\n');
}

/**
 * Main handler with batch support
 */
export async function enhancedMotokoCore(input: any) {
  try {
    // Handle batch requests
    if (input.modules && input.modules.length > 0) {
      logger.info(`Batch fetching ${input.modules.length} modules`);

      const results: string[] = [];

      for (const moduleName of input.modules) {
        try {
          const doc = generateModuleDoc(moduleName);
          results.push(formatModuleDoc(doc, input));
        } catch (error: any) {
          // Handle module not found with suggestions
          const suggestions = getSuggestions(moduleName);

          if (suggestions.length > 0) {
            const errorInfo = {
              error: `Module '${moduleName}' not found`,
              suggestions,
              hint: `Did you mean: ${suggestions[0]}?`,
              tip: 'Use icp/discover with action: "list-all" to see all available modules',
            };

            // Special handling for deprecated modules
            if (MODULE_CORRECTIONS[moduleName.toLowerCase()]) {
              const correction = MODULE_CORRECTIONS[moduleName.toLowerCase()][0];
              errorInfo.hint = `${moduleName} was deprecated. Use ${correction} instead.`;
            }

            results.push(JSON.stringify(errorInfo, null, 2));
          } else {
            results.push(JSON.stringify({
              error: error.message,
              module: moduleName,
              tip: 'Use icp/discover to explore available modules',
            }, null, 2));
          }
        }
      }

      const output: string[] = [
        `# Batch Module Documentation`,
        ``,
        `Retrieved ${results.length} module(s)`,
        ``,
      ];

      for (let i = 0; i < results.length; i++) {
        if (i > 0) output.push(`---`);
        output.push(``);
        output.push(results[i]);
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

    // Handle single module request
    if (input.module) {
      logger.info(`Fetching documentation for module: ${input.module}`);

      try {
        const doc = generateModuleDoc(input.module);
        const result = formatModuleDoc(doc, input);

        return {
          content: [
            {
              type: 'text' as const,
              text: result,
            },
          ],
        };
      } catch (error: any) {
        // Handle module not found with suggestions
        const suggestions = getSuggestions(input.module);

        if (suggestions.length > 0) {
          const errorInfo = {
            error: `Module '${input.module}' not found`,
            suggestions,
            hint: `Did you mean: ${suggestions[0]}?`,
            tip: 'Use icp/discover with action: "list-all" to see all available modules',
          };

          // Special handling for deprecated modules
          if (MODULE_CORRECTIONS[input.module.toLowerCase()]) {
            const correction = MODULE_CORRECTIONS[input.module.toLowerCase()][0];
            errorInfo.hint = `${input.module} was deprecated. Use ${correction} instead.`;
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(errorInfo, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: error.message,
                module: input.module,
                tip: 'Use icp/discover to explore available modules',
              }, null, 2),
            },
          ],
        };
      }
    }

    // No modules specified
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'No modules specified',
            tip: 'Use either "module" for single or "modules" for batch requests',
            examples: {
              single: { module: 'Array', examples: true },
              batch: { modules: ['Array', 'Map', 'pure/List'], includeLinks: true },
              withMethod: { module: 'Map', method: 'insert', examples: true },
            },
            discovery: 'Use icp/discover { action: "list-all" } to see available modules',
          }, null, 2),
        },
      ],
      isError: true,
    };

  } catch (error: any) {
    logger.error('Motoko Core error:', error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: error.message,
            suggestion: 'Use icp/discover to find available modules',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

// Export for backward compatibility
export const motokoCore = enhancedMotokoCore;

// Export tool definition
export const motokoCoreTool = {
  name: 'icp/motoko-core',
  description: `Get instant documentation for Motoko core library modules with batch support.`,
  inputSchema: {
    type: 'object',
    properties: {
      modules: {
        type: 'array',
        items: { type: 'string' },
        description: 'Batch fetch multiple modules',
      },
      module: {
        type: 'string',
        description: 'Single module name',
      },
      method: {
        type: 'string',
        description: 'Specific method to get details for',
      },
      examples: {
        type: 'boolean',
        description: 'Include usage examples (default: true)',
      },
      includeLinks: {
        type: 'boolean',
        description: 'Include documentation links (default: true)',
      },
    },
  },
};