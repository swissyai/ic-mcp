#!/usr/bin/env node
/**
 * Generate AI-powered use-case metadata for Motoko modules
 * This creates semantic keywords for natural language matching
 *
 * Run: npx tsx scripts/generate-use-cases.ts
 */

import { MODULES_MINIMAL } from '../src/data/modules-minimal.js';
import fs from 'fs/promises';
import path from 'path';

// Manually curated use-cases for core modules
// In production, this would be generated using Claude API
const USE_CASES: Record<string, string> = {
  // Arrays
  'Array': 'always, lists, collections, iteration, sorting, filtering, mapping, core data structure, immutable sequences',
  'VarArray': 'mutable arrays, dynamic lists, resizable collections, buffer operations, in-place modifications',
  'Buffer': 'growing arrays, dynamic allocation, append operations, queue implementation, streaming data',

  // Maps
  'Map': 'key-value storage, dictionaries, lookup tables, caching, configuration, ordered maps, tree-based',
  'HashMap': 'hash tables, fast lookups, unordered maps, O(1) access, large datasets, caching layer',
  'RBTree': 'balanced trees, sorted maps, range queries, ordered iteration, guaranteed O(log n)',
  'TrieMap': 'prefix matching, string keys, autocomplete, routing tables, hierarchical data',

  // Sets
  'Set': 'unique values, deduplication, membership testing, set operations, collections without duplicates',
  'TrieSet': 'string sets, prefix sets, word dictionaries, unique string collections',

  // Lists
  'List': 'functional programming, recursive structures, pattern matching, immutable sequences, cons lists',
  'Queue': 'FIFO, task processing, message queues, breadth-first search, event handling, buffering',
  'Stack': 'LIFO, undo operations, expression parsing, depth-first search, call stacks, recursion',
  'Deque': 'double-ended queue, sliding windows, palindrome checking, bidirectional processing',

  // Primitives
  'Bool': 'boolean logic, conditionals, flags, binary states, validation, true/false operations',
  'Char': 'character processing, string parsing, text analysis, unicode handling, tokenization',
  'Text': 'always, strings, text manipulation, concatenation, substring, formatting, user input, messages',
  'Blob': 'binary data, file handling, serialization, network packets, cryptography, raw bytes',

  // Numbers
  'Int': 'always, integers, arithmetic, calculations, counters, indexes, mathematical operations',
  'Int8': 'small integers, byte operations, protocol buffers, memory optimization, embedded values',
  'Int16': 'short integers, audio samples, graphics, memory-efficient storage',
  'Int32': 'standard integers, timestamps, file sizes, general purpose math',
  'Int64': 'large integers, timestamps, identifiers, precision arithmetic',
  'Nat': 'always, natural numbers, positive integers, counting, array indexes, sizes, unsigned values',
  'Nat8': 'bytes, RGB values, small counters, protocol fields, compact storage',
  'Nat16': 'port numbers, small identifiers, checksums, compact natural numbers',
  'Nat32': 'standard naturals, CRC32, network addresses, general unsigned math',
  'Nat64': 'large naturals, file sizes, memory addresses, large identifiers',
  'Float': 'decimals, scientific computation, statistics, graphics, physics, percentages, ratios',

  // Utilities
  'Option': 'always, nullable values, error handling, optional parameters, maybe types, safe null handling',
  'Result': 'always, error handling, validation, fallible operations, success/failure, try/catch patterns',
  'Error': 'exception handling, error messages, debugging, failure reporting, error propagation',
  'Debug': 'logging, tracing, development, testing, print statements, assertions, diagnostics',

  // Functions
  'Func': 'higher-order functions, callbacks, function composition, currying, functional patterns',
  'Iter': 'iteration, loops, sequences, generators, lazy evaluation, streaming, pagination',
  'Order': 'sorting, comparisons, binary search, heap operations, priority queues, ordering',

  // System
  'Principal': 'authentication, identity, access control, user management, canister ids, security',
  'Cycles': 'gas management, canister funding, resource limits, cost tracking, payments',
  'CertifiedData': 'certified variables, http outcalls, trusted data, blockchain proof',
  'Region': 'stable memory, memory management, persistence, large data, memory regions',
  'Runtime': 'system information, canister status, runtime checks, performance monitoring',
  'Time': 'timestamps, scheduling, date operations, timeouts, duration calculations, now()',
  'Timer': 'periodic tasks, scheduled jobs, heartbeats, cron-like operations, recurring events',
  'Random': 'randomness, shuffling, game development, sampling, monte carlo, entropy, uuid generation',
  'ExperimentalCycles': 'experimental features, cycles api, advanced cycle management',
};

async function generateUseCases() {
  console.log('Generating use-case metadata for Motoko modules...\n');

  // Build the use-cases structure
  const useCases: Array<{ m: string; k: string }> = [];

  for (const module of MODULES_MINIMAL) {
    const keywords = USE_CASES[module.n];
    if (keywords) {
      useCases.push({
        m: module.n,  // module name
        k: keywords   // keywords
      });
      console.log(`✓ ${module.n}: ${keywords.split(',').slice(0, 3).join(',')}...`);
    } else {
      // Fallback: generate basic keywords from name and description
      const fallbackKeywords = `${module.n.toLowerCase()}, ${module.d.toLowerCase()}`;
      useCases.push({
        m: module.n,
        k: fallbackKeywords
      });
      console.log(`⚠ ${module.n}: Generated fallback keywords`);
    }
  }

  // Save as JSON (will be converted to TOON at runtime)
  const outputPath = path.join(process.cwd(), 'src', 'data', 'use-cases.json');
  await fs.writeFile(
    outputPath,
    JSON.stringify({
      generated: new Date().toISOString(),
      version: '1.0.0',
      useCases
    }, null, 2)
  );

  console.log(`\n✅ Generated use-cases for ${useCases.length} modules`);
  console.log(`📁 Saved to: ${outputPath}`);

  // Show sample TOON encoding
  const { encode } = await import('@byjohann/toon');
  const toonEncoded = encode({ useCases: useCases.slice(0, 3) }, {
    indent: 2,
    lengthMarker: true
  });

  console.log('\nSample TOON encoding (first 3 modules):');
  console.log('----------------------------------------');
  console.log(toonEncoded);

  // Calculate token savings
  const jsonSize = JSON.stringify(useCases).length;
  const toonSize = encode({ useCases }, { lengthMarker: true }).length;
  const savings = ((jsonSize - toonSize) / jsonSize * 100).toFixed(1);

  console.log('\nToken efficiency:');
  console.log(`JSON size: ${jsonSize} chars`);
  console.log(`TOON size: ${toonSize} chars`);
  console.log(`Savings: ${savings}%`);
}

// Run the generator
generateUseCases().catch(console.error);