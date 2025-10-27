/**
 * MCP tool: icp/motoko-base
 * Provides instant access to Motoko base library documentation
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { docsCache } from '../utils/cache.js';

// Input schema
export const MotokoBaseInputSchema = z.object({
  module: z
    .string()
    .describe('Module name (e.g., List, Array, HashMap, Buffer, Text, Int, Nat, etc.)'),
  method: z
    .string()
    .optional()
    .describe('Optional: specific method name (e.g., add, filter, map, size)'),
  examples: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include usage examples (default: true)'),
});

export type MotokoBaseInput = z.infer<typeof MotokoBaseInputSchema>;

// Common Motoko modules with descriptions
const MODULES_INFO: Record<string, { description: string; priority: number }> = {
  'List': { description: 'Purely-functional singly-linked lists', priority: 1 },
  'Array': { description: 'Mutable and immutable array operations', priority: 1 },
  'HashMap': { description: 'Mutable hash map for key-value storage', priority: 1 },
  'Buffer': { description: 'Growable, mutable sequences', priority: 1 },
  'Text': { description: 'Text/string operations and utilities', priority: 1 },
  'Iter': { description: 'Iteration over collections', priority: 2 },
  'Nat': { description: 'Natural numbers (non-negative)', priority: 2 },
  'Int': { description: 'Integer operations', priority: 2 },
  'Result': { description: 'Error handling with Result<Ok, Err>', priority: 2 },
  'Option': { description: 'Optional values (null safety)', priority: 2 },
  'Blob': { description: 'Binary data operations', priority: 3 },
  'Principal': { description: 'Principal IDs for identity', priority: 3 },
  'Time': { description: 'Time and timestamp utilities', priority: 3 },
  'Debug': { description: 'Debugging utilities', priority: 3 },
  'Map': { description: 'Ordered maps (red-black trees)', priority: 3 },
  'Set': { description: 'Ordered sets', priority: 3 },
  'TrieMap': { description: 'Hash tries for persistent maps', priority: 4 },
  'AssocList': { description: 'Association lists', priority: 4 },
  'Heap': { description: 'Priority queues', priority: 4 },
  'Deque': { description: 'Double-ended queues', priority: 4 },
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
  methods: MethodInfo[];
  typeDefinitions?: string[];
  importStatement: string;
}

/**
 * Parse a .mo file to extract documentation
 */
function parseMotokoModule(content: string, moduleName: string): ModuleDoc {
  const lines = content.split('\n');
  const methods: MethodInfo[] = [];
  let overview = '';
  let inOverview = true;

  // Extract module overview (first doc comment block)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inOverview) {
      if (line.startsWith('///')) {
        const docLine = line.substring(3).trim();
        if (docLine && !docLine.startsWith(':::') && !docLine.includes('```')) {
          overview += docLine + ' ';
        }
      } else if (line.includes('module {')) {
        inOverview = false;
      }
    }

    // Look for public functions
    if (line.includes('public func')) {
      const methodInfo = extractMethodInfo(lines, i);
      if (methodInfo) {
        methods.push(methodInfo);
      }
    }
  }

  // Extract type definitions
  const typeDefinitions: string[] = [];
  const typeMatches = content.match(/public type \w+.*?(?=;)/gs);
  if (typeMatches) {
    typeDefinitions.push(...typeMatches.map(t => t.replace(/\s+/g, ' ').trim() + ';'));
  }

  return {
    module: moduleName,
    description: MODULES_INFO[moduleName]?.description || '',
    overview: overview.trim() || MODULES_INFO[moduleName]?.description || '',
    methods: methods.slice(0, 20), // Limit to top 20 methods
    typeDefinitions: typeDefinitions.slice(0, 5), // Limit type definitions
    importStatement: `import ${moduleName} "mo:base/${moduleName}";`,
  };
}

/**
 * Extract method information from lines starting at given index
 */
function extractMethodInfo(lines: string[], startIdx: number): MethodInfo | null {
  let description = '';
  let example = '';
  let complexity = '';

  // Look backwards for documentation
  for (let i = startIdx - 1; i >= Math.max(0, startIdx - 20); i--) {
    const line = lines[i];
    if (!line.includes('///')) break;

    const docLine = line.substring(3).trim();

    // Extract complexity
    if (docLine.includes('O(')) {
      const complexityMatch = docLine.match(/O\([^)]+\)/);
      if (complexityMatch) {
        complexity = complexityMatch[0];
      }
    }

    // Extract example
    if (docLine.includes('Example:') || lines[i + 1]?.includes('```motoko')) {
      // Find the example code block
      for (let j = i; j < Math.min(lines.length, i + 10); j++) {
        if (lines[j].includes('```motoko')) {
          j++;
          while (j < lines.length && !lines[j].includes('```')) {
            example += lines[j] + '\n';
            j++;
          }
          break;
        }
      }
    }

    // Extract description (first line of doc)
    if (!description && docLine && !docLine.includes('Example:') &&
        !docLine.includes('|') && !docLine.includes('```')) {
      description = docLine;
    }
  }

  // Extract function signature
  const funcLine = lines[startIdx];
  const signatureMatch = funcLine.match(/public func (\w+)(<[^>]+>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?/);

  if (!signatureMatch) return null;

  const funcName = signatureMatch[1];
  let signature = signatureMatch[0]
    .replace('public func ', '')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean up signature
  if (signature.includes('{')) {
    signature = signature.substring(0, signature.indexOf('{')).trim();
  }

  return {
    name: funcName,
    signature,
    description: description || `${funcName} operation`,
    complexity,
    example: example.trim(),
  };
}

/**
 * Fetch module source from GitHub
 */
async function fetchModuleSource(moduleName: string): Promise<string | null> {
  const cacheKey = `motoko-base-${moduleName}`;

  // Check cache (1 hour for base library docs)
  const cached = await docsCache.get(cacheKey);
  if (cached) {
    logger.info(`Using cached Motoko base docs for ${moduleName}`);
    return cached as string;
  }

  try {
    const url = `https://raw.githubusercontent.com/dfinity/motoko-base/master/src/${moduleName}.mo`;
    const response = await fetch(url);

    if (!response.ok) {
      logger.error(`Failed to fetch ${moduleName}.mo: ${response.status}`);
      return null;
    }

    const content = await response.text();
    await docsCache.set(cacheKey, content, 3600); // Cache for 1 hour

    return content;
  } catch (error) {
    logger.error(`Error fetching ${moduleName}.mo:`, error);
    return null;
  }
}

/**
 * Get Motoko base library documentation
 */
export async function getMotokoBase(input: MotokoBaseInput) {
  const { module: moduleName, method, examples } = input;

  logger.info(`Getting Motoko base docs for ${moduleName}${method ? `.${method}` : ''}`);

  // Validate module exists
  if (!MODULES_INFO[moduleName]) {
    // Try to find similar module names
    const available = Object.keys(MODULES_INFO);
    const suggestions = available.filter(m =>
      m.toLowerCase().includes(moduleName.toLowerCase()) ||
      moduleName.toLowerCase().includes(m.toLowerCase())
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: `Module '${moduleName}' not found`,
              suggestions: suggestions.length > 0 ? suggestions : available.slice(0, 10),
              hint: 'Use one of the available modules listed above',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Fetch module source
  const source = await fetchModuleSource(moduleName);
  if (!source) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Failed to fetch module documentation',
              fallback: {
                module: moduleName,
                description: MODULES_INFO[moduleName].description,
                importStatement: `import ${moduleName} "mo:base/${moduleName}";`,
                hint: 'Check the official docs at https://internetcomputer.org/docs/current/motoko/main/base/',
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Parse the module
  const moduleDoc = parseMotokoModule(source, moduleName);

  // Filter by method if specified
  if (method) {
    const methodInfo = moduleDoc.methods.find(m =>
      m.name.toLowerCase() === method.toLowerCase()
    );

    if (methodInfo) {
      return {
        content: [
          {
            type: 'text' as const,
            text: formatMethodDoc(moduleName, methodInfo, examples),
          },
        ],
      };
    } else {
      // Method not found, suggest similar ones
      const suggestions = moduleDoc.methods
        .filter(m => m.name.toLowerCase().includes(method.toLowerCase()))
        .map(m => m.name);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                error: `Method '${method}' not found in ${moduleName}`,
                availableMethods: moduleDoc.methods.map(m => ({
                  name: m.name,
                  signature: m.signature,
                })).slice(0, 15),
                suggestions,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  // Return full module documentation
  return {
    content: [
      {
        type: 'text' as const,
        text: formatModuleDoc(moduleDoc, examples),
      },
    ],
  };
}

/**
 * Format method documentation
 */
function formatMethodDoc(moduleName: string, method: MethodInfo, includeExamples: boolean): string {
  let doc = `# ${moduleName}.${method.name}\n\n`;
  doc += `**Signature:** \`${method.signature}\`\n\n`;
  doc += `**Description:** ${method.description}\n\n`;

  if (method.complexity) {
    doc += `**Complexity:** ${method.complexity}\n\n`;
  }

  if (includeExamples && method.example) {
    doc += `**Example:**\n\`\`\`motoko\n${method.example}\n\`\`\`\n\n`;
  }

  doc += `**Import:** \`import ${moduleName} "mo:base/${moduleName}";\`\n`;

  return doc;
}

/**
 * Format module documentation
 */
function formatModuleDoc(moduleDoc: ModuleDoc, includeExamples: boolean): string {
  let doc = `# Motoko Base: ${moduleDoc.module}\n\n`;
  doc += `${moduleDoc.overview}\n\n`;
  doc += `**Import:** \`${moduleDoc.importStatement}\`\n\n`;

  // Type definitions
  if (moduleDoc.typeDefinitions && moduleDoc.typeDefinitions.length > 0) {
    doc += '## Type Definitions\n\n';
    moduleDoc.typeDefinitions.forEach(type => {
      doc += `\`\`\`motoko\n${type}\n\`\`\`\n\n`;
    });
  }

  // Common methods
  doc += '## Common Methods\n\n';

  // Group methods by functionality
  const crud = moduleDoc.methods.filter(m =>
    ['add', 'push', 'put', 'set', 'insert', 'append', 'remove', 'delete', 'pop', 'clear'].includes(m.name)
  );
  const query = moduleDoc.methods.filter(m =>
    ['get', 'find', 'contains', 'has', 'size', 'isEmpty', 'isNil', 'length'].includes(m.name)
  );
  const transform = moduleDoc.methods.filter(m =>
    ['map', 'filter', 'fold', 'reduce', 'sort', 'reverse', 'flatten'].includes(m.name)
  );
  const others = moduleDoc.methods.filter(m =>
    ![...crud, ...query, ...transform].includes(m)
  );

  if (crud.length > 0) {
    doc += '### Create/Update/Delete\n\n';
    crud.forEach(m => {
      doc += `- **${m.name}**: \`${m.signature}\`\n`;
      if (m.complexity) doc += `  - Complexity: ${m.complexity}\n`;
      doc += `  - ${m.description}\n`;
      if (includeExamples && m.example) {
        doc += `  \`\`\`motoko\n  ${m.example.split('\n').join('\n  ')}\n  \`\`\`\n`;
      }
      doc += '\n';
    });
  }

  if (query.length > 0) {
    doc += '### Query Operations\n\n';
    query.forEach(m => {
      doc += `- **${m.name}**: \`${m.signature}\`\n`;
      if (m.complexity) doc += `  - Complexity: ${m.complexity}\n`;
      doc += `  - ${m.description}\n\n`;
    });
  }

  if (transform.length > 0) {
    doc += '### Transformations\n\n';
    transform.forEach(m => {
      doc += `- **${m.name}**: \`${m.signature}\`\n`;
      if (m.complexity) doc += `  - Complexity: ${m.complexity}\n`;
      doc += `  - ${m.description}\n\n`;
    });
  }

  if (others.length > 0) {
    doc += '### Other Methods\n\n';
    others.slice(0, 10).forEach(m => {
      doc += `- **${m.name}**: \`${m.signature}\`\n`;
      doc += `  - ${m.description}\n\n`;
    });
  }

  // Usage tips
  doc += '\n## Usage Tips\n\n';

  // Add module-specific tips
  const tips = getModuleTips(moduleDoc.module);
  tips.forEach(tip => {
    doc += `- ${tip}\n`;
  });

  return doc;
}

/**
 * Get module-specific usage tips
 */
function getModuleTips(moduleName: string): string[] {
  const tips: Record<string, string[]> = {
    'List': [
      'Lists are immutable and operations return new lists',
      'Prepending (push) is O(1), appending is O(n)',
      'Consider Array or Buffer for random access needs',
      'Use List.iterate() for efficient traversal',
    ],
    'Array': [
      'Arrays have fixed size after creation',
      'Use Array.tabulate() for initialization',
      'Array.mutate() for in-place updates (when var)',
      'Consider Buffer for dynamic sizing',
    ],
    'HashMap': [
      'Requires both hash and equal functions for keys',
      'Use Text.hash and Text.equal for Text keys',
      'Pre-size with expected capacity for performance',
      'Consider TrieMap for persistence across upgrades',
    ],
    'Buffer': [
      'Growable arrays with amortized O(1) append',
      'Use buffer.toArray() to convert to immutable Array',
      'Good for building collections incrementally',
      'Clear with buffer.clear() to reset',
    ],
    'Text': [
      'Texts are immutable in Motoko',
      'Use Text.concat() sparingly (creates new string)',
      'Text.split() returns an iterator, not array',
      'Consider Char operations for single character work',
    ],
    'Result': [
      'Use for explicit error handling',
      'Pattern match with switch for exhaustive handling',
      'Chain with Result.chain() for sequential operations',
      'Convert to Option with Result.toOption()',
    ],
    'Iter': [
      'Iterators are consumed after use',
      'Use Iter.toArray() to materialize results',
      'Efficient for lazy evaluation and streaming',
      'Many collection types provide .vals() or .entries() iterators',
    ],
  };

  return tips[moduleName] || [
    `Import with: import ${moduleName} "mo:base/${moduleName}";`,
    'Check official docs for complete API reference',
    'Most operations are immutable and return new values',
  ];
}

// Tool definition for MCP
export const motokoBaseTool = {
  name: 'icp/motoko-base',
  description:
    'Get instant documentation for Motoko base library modules (List, Array, HashMap, Buffer, Text, etc.). Returns module overview, method signatures with complexity, usage examples, and tips. Eliminates need to manually copy documentation.',
  inputSchema: {
    type: 'object',
    properties: {
      module: {
        type: 'string',
        description: 'Module name (e.g., List, Array, HashMap, Buffer, Text, Int, Nat)',
      },
      method: {
        type: 'string',
        description: 'Optional: specific method name (e.g., add, filter, map, size)',
      },
      examples: {
        type: 'boolean',
        description: 'Include usage examples (default: true)',
      },
    },
    required: ['module'],
  },
};

// Export for testing
export const motokoBase = getMotokoBase;