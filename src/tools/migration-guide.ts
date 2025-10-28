/**
 * MCP tool: icp/base-to-core-migration
 * Provides guidance for migrating from Motoko base to core library
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

// Input schema
export const MigrationGuideInputSchema = z.object({
  module: z
    .string()
    .optional()
    .describe('Specific module to get migration info for (e.g., Buffer, HashMap)'),
  showExamples: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include code examples (default: true)'),
});

export type MigrationGuideInput = z.infer<typeof MigrationGuideInputSchema>;

// Migration mappings
const MIGRATION_INFO: Record<string, {
  status: 'removed' | 'renamed' | 'moved';
  replacement?: string;
  notes: string;
  example?: { before: string; after: string };
}> = {
  // Removed modules
  'AssocList': {
    status: 'removed',
    replacement: 'Map',
    notes: 'AssocList was removed. Use Map or pure/Map for key-value storage with O(log n) operations.',
    example: {
      before: 'import AssocList "mo:base/AssocList";',
      after: 'import Map "mo:core/Map";',
    },
  },
  'Buffer': {
    status: 'removed',
    replacement: 'VarArray',
    notes: 'Buffer was removed. VarArray provides the same growable array functionality.',
    example: {
      before: 'import Buffer "mo:base/Buffer";\n\nlet buf = Buffer.Buffer<Text>(10);',
      after: 'import VarArray "mo:core/VarArray";\n\nlet arr = VarArray.VarArray<Text>(10);',
    },
  },
  'HashMap': {
    status: 'removed',
    replacement: 'Map',
    notes: 'HashMap (hash-based) was removed for security. Use Map (red-black tree) with O(log n) operations.',
    example: {
      before: 'import HashMap "mo:base/HashMap";\n\nlet map = HashMap.HashMap<Text, Nat>(10, Text.equal, Text.hash);',
      after: 'import Map "mo:core/Map";\n\nlet map = Map.Map<Text, Nat>(Text.compare);',
    },
  },
  'TrieMap': {
    status: 'removed',
    replacement: 'pure/Map',
    notes: 'TrieMap was removed. Use pure/Map for immutable, persistent maps.',
    example: {
      before: 'import TrieMap "mo:base/TrieMap";',
      after: 'import Map "mo:core/pure/Map";',
    },
  },
  'TrieSet': {
    status: 'removed',
    replacement: 'pure/Set',
    notes: 'TrieSet was removed. Use pure/Set for immutable, persistent sets.',
    example: {
      before: 'import TrieSet "mo:base/TrieSet";',
      after: 'import Set "mo:core/pure/Set";',
    },
  },
  'Heap': {
    status: 'removed',
    replacement: 'Custom implementation',
    notes: 'Heap was removed. Implement a priority queue using Map or Array with custom ordering.',
  },
  'Hash': {
    status: 'removed',
    notes: 'Hash module removed. Hash functions are now part of individual type modules (Text.hash, Nat.hash).',
  },

  // Renamed/moved modules
  'ExperimentalCycles': {
    status: 'renamed',
    replacement: 'Cycles',
    notes: 'ExperimentalCycles is now stable as Cycles.',
    example: {
      before: 'import ExperimentalCycles "mo:base/ExperimentalCycles";',
      after: 'import Cycles "mo:core/Cycles";',
    },
  },
  'ExperimentalInternetComputer': {
    status: 'renamed',
    replacement: 'InternetComputer',
    notes: 'ExperimentalInternetComputer is now stable as InternetComputer.',
    example: {
      before: 'import IC "mo:base/ExperimentalInternetComputer";',
      after: 'import IC "mo:core/InternetComputer";',
    },
  },
  'List': {
    status: 'moved',
    replacement: 'pure/List',
    notes: 'List moved to pure/List to emphasize immutability. The API remains the same.',
    example: {
      before: 'import List "mo:base/List";',
      after: 'import List "mo:core/pure/List";',
    },
  },
  'Deque': {
    status: 'moved',
    replacement: 'pure/Queue',
    notes: 'Deque functionality is now in pure/Queue for immutable queue operations.',
    example: {
      before: 'import Deque "mo:base/Deque";',
      after: 'import Queue "mo:core/pure/Queue";',
    },
  },
  'OrderedMap': {
    status: 'moved',
    replacement: 'pure/Map',
    notes: 'OrderedMap is now pure/Map for immutable ordered maps.',
  },
  'OrderedSet': {
    status: 'moved',
    replacement: 'pure/Set',
    notes: 'OrderedSet is now pure/Set for immutable ordered sets.',
  },
};

/**
 * Get migration guide
 */
export async function getMigrationGuide(input: MigrationGuideInput) {
  const { module: moduleName, showExamples } = input;

  logger.info(`Getting migration guide${moduleName ? ` for ${moduleName}` : ''}`);

  if (moduleName) {
    // Get info for specific module
    const info = MIGRATION_INFO[moduleName];

    if (!info) {
      // Check if it's a module that didn't change
      const unchangedModules = [
        'Array', 'Blob', 'Bool', 'Char', 'Debug', 'Error', 'Float', 'Func',
        'Int', 'Int8', 'Int16', 'Int32', 'Int64', 'Iter', 'Nat', 'Nat8',
        'Nat16', 'Nat32', 'Nat64', 'Option', 'Order', 'Principal', 'Result',
        'Text', 'Time', 'Timer',
      ];

      if (unchangedModules.includes(moduleName)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `# Migration Guide: ${moduleName}

**Status:** No changes required ✅

The ${moduleName} module is available in core with the same API.

## Update Import

\`\`\`motoko
// Before
import ${moduleName} "mo:base/${moduleName}";

// After
import ${moduleName} "mo:core/${moduleName}";
\`\`\`

That's it! The module works exactly the same in core.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Module '${moduleName}' not found in migration guide.

Available modules to check:
- Removed: ${Object.entries(MIGRATION_INFO).filter(([_, v]) => v.status === 'removed').map(([k]) => k).join(', ')}
- Renamed: ${Object.entries(MIGRATION_INFO).filter(([_, v]) => v.status === 'renamed').map(([k]) => k).join(', ')}
- Moved: ${Object.entries(MIGRATION_INFO).filter(([_, v]) => v.status === 'moved').map(([k]) => k).join(', ')}`,
          },
        ],
      };
    }

    let guide = `# Migration Guide: ${moduleName}\n\n`;
    guide += `**Status:** ${info.status.toUpperCase()}${info.replacement ? ` → ${info.replacement}` : ''}\n\n`;
    guide += `${info.notes}\n\n`;

    if (showExamples && info.example) {
      guide += '## Code Migration\n\n';
      guide += '### Before (base)\n```motoko\n' + info.example.before + '\n```\n\n';
      guide += '### After (core)\n```motoko\n' + info.example.after + '\n```\n\n';
    }

    return {
      content: [{ type: 'text' as const, text: guide }],
    };
  }

  // Return general migration guide
  const guide = `# Motoko Base to Core Migration Guide

## Overview

The Motoko standard library transitioned from **base** to **core** in 2025, removing hash-based structures for security and reorganizing modules for clarity.

## Quick Start

1. **Update dfx:** Requires dfx 0.28+ or Motoko 0.15+
2. **Add core:** In mops.toml: \`core = "0.0.0"\`
3. **Update imports:** Change \`mo:base/\` to \`mo:core/\`

## Major Changes

### 🗑️ Removed Modules

${Object.entries(MIGRATION_INFO)
  .filter(([_, v]) => v.status === 'removed')
  .map(([k, v]) => `- **${k}** → ${v.replacement || 'No direct replacement'}`)
  .join('\n')}

### 📝 Renamed Modules

${Object.entries(MIGRATION_INFO)
  .filter(([_, v]) => v.status === 'renamed')
  .map(([k, v]) => `- **${k}** → ${v.replacement}`)
  .join('\n')}

### 📦 Moved to pure/ Namespace

${Object.entries(MIGRATION_INFO)
  .filter(([_, v]) => v.status === 'moved')
  .map(([k, v]) => `- **${k}** → ${v.replacement}`)
  .join('\n')}

## Key Differences

### Range Functions
- **BREAKING:** \`range()\` is now EXCLUSIVE (was inclusive)
- Use \`rangeInclusive()\` for old behavior
- Prefer \`Nat.range()\` over \`Iter.range()\`

### Method Naming
- \`vals()\` renamed to \`values()\` across modules

### Stable Memory
- Data structures work directly in stable memory
- No need for pre/post-upgrade hooks with stable types

${showExamples ? `
## Common Migration Examples

### HashMap → Map
\`\`\`motoko
// Before
import HashMap "mo:base/HashMap";
let map = HashMap.HashMap<Text, Nat>(10, Text.equal, Text.hash);

// After
import Map "mo:core/Map";
let map = Map.Map<Text, Nat>(Text.compare);
\`\`\`

### Buffer → VarArray
\`\`\`motoko
// Before
import Buffer "mo:base/Buffer";
let buf = Buffer.Buffer<Text>(10);

// After
import VarArray "mo:core/VarArray";
let arr = VarArray.VarArray<Text>(10);
\`\`\`

### List → pure/List
\`\`\`motoko
// Before
import List "mo:base/List";

// After
import List "mo:core/pure/List";
// API remains the same
\`\`\`
` : ''}

## Migration Strategy

1. **Incremental:** Keep both packages during migration
2. **Test thoroughly:** Especially range functions
3. **Use \`with migration\`:** For stable data conversion
4. **Update one module at a time:** Easier debugging

## Resources

- [Official Migration Guide](https://internetcomputer.org/docs/motoko/base-core-migration)
- [Core Library Docs](https://internetcomputer.org/docs/motoko/core)
- [Changelog](https://github.com/dfinity/motoko-core/blob/main/CHANGELOG.md)

Use \`module: "<module_name>"\` parameter for specific module migration details.`;

  return {
    content: [{ type: 'text' as const, text: guide }],
  };
}

// Tool definition for MCP
export const migrationGuideTool = {
  name: 'icp/base-to-core-migration',
  description:
    'Comprehensive migration guide from Motoko base to core library. Shows removed/renamed/moved modules with replacements, code examples, and breaking changes. Get general overview or specific module migration details.',
  inputSchema: {
    type: 'object',
    properties: {
      module: {
        type: 'string',
        description: 'Specific module to get migration info for (e.g., Buffer, HashMap)',
      },
      showExamples: {
        type: 'boolean',
        description: 'Include code examples (default: true)',
      },
    },
  },
};

// Export for testing
export const migrationGuide = getMigrationGuide;