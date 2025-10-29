/**
 * Minimal module index optimized for TOON encoding
 * Reduces from ~3000 tokens to ~500 tokens
 */

export interface MinimalModule {
  n: string;  // name
  d: string;  // description (short)
  c: string;  // category
  p: number;  // priority (1-3)
}

export const MODULES_MINIMAL: MinimalModule[] = [
  // Data Structures - Arrays
  { n: 'Array', d: 'Immutable array utilities', c: 'ds/arr', p: 1 },
  { n: 'VarArray', d: 'Mutable array utilities', c: 'ds/arr', p: 1 },
  { n: 'Buffer', d: 'Growable mutable arrays', c: 'ds/arr', p: 2 },

  // Data Structures - Maps
  { n: 'Map', d: 'Key-value map (ordered)', c: 'ds/map', p: 1 },
  { n: 'HashMap', d: 'Hash table implementation', c: 'ds/map', p: 1 },
  { n: 'RBTree', d: 'Red-black tree map', c: 'ds/map', p: 2 },
  { n: 'TrieMap', d: 'Trie-based map', c: 'ds/map', p: 2 },

  // Data Structures - Sets
  { n: 'Set', d: 'Set data structure', c: 'ds/set', p: 1 },
  { n: 'TrieSet', d: 'Trie-based set', c: 'ds/set', p: 2 },

  // Data Structures - Lists
  { n: 'List', d: 'Functional linked list', c: 'ds/list', p: 2 },
  { n: 'Queue', d: 'FIFO queue', c: 'ds/list', p: 2 },
  { n: 'Stack', d: 'LIFO stack', c: 'ds/list', p: 2 },
  { n: 'Deque', d: 'Double-ended queue', c: 'ds/list', p: 2 },

  // Primitives - Boolean
  { n: 'Bool', d: 'Boolean operations', c: 'prim/bool', p: 1 },

  // Primitives - Text
  { n: 'Char', d: 'Character utilities', c: 'prim/text', p: 2 },
  { n: 'Text', d: 'String operations', c: 'prim/text', p: 1 },

  // Primitives - Binary
  { n: 'Blob', d: 'Binary data operations', c: 'prim/bin', p: 1 },

  // Primitives - Numbers
  { n: 'Int', d: 'Integer operations', c: 'prim/num', p: 1 },
  { n: 'Int8', d: '8-bit integers', c: 'prim/num', p: 3 },
  { n: 'Int16', d: '16-bit integers', c: 'prim/num', p: 3 },
  { n: 'Int32', d: '32-bit integers', c: 'prim/num', p: 3 },
  { n: 'Int64', d: '64-bit integers', c: 'prim/num', p: 3 },
  { n: 'Nat', d: 'Natural numbers', c: 'prim/num', p: 1 },
  { n: 'Nat8', d: '8-bit naturals', c: 'prim/num', p: 3 },
  { n: 'Nat16', d: '16-bit naturals', c: 'prim/num', p: 3 },
  { n: 'Nat32', d: '32-bit naturals', c: 'prim/num', p: 3 },
  { n: 'Nat64', d: '64-bit naturals', c: 'prim/num', p: 3 },
  { n: 'Float', d: 'Floating point math', c: 'prim/num', p: 2 },

  // Utilities - Control
  { n: 'Option', d: 'Optional values', c: 'util/ctrl', p: 1 },
  { n: 'Result', d: 'Error handling type', c: 'util/ctrl', p: 1 },
  { n: 'Error', d: 'Error creation/handling', c: 'util/ctrl', p: 2 },
  { n: 'Debug', d: 'Debug utilities', c: 'util/ctrl', p: 2 },

  // Utilities - Functions
  { n: 'Func', d: 'Function utilities', c: 'util/fn', p: 2 },
  { n: 'Iter', d: 'Iterator operations', c: 'util/fn', p: 1 },
  { n: 'Order', d: 'Ordering comparisons', c: 'util/fn', p: 2 },

  // System
  { n: 'Principal', d: 'Principal/identity', c: 'sys/id', p: 1 },
  { n: 'Cycles', d: 'Cycle management', c: 'sys/cycles', p: 2 },
  { n: 'CertifiedData', d: 'Certified data', c: 'sys/cert', p: 3 },
  { n: 'Region', d: 'Memory regions', c: 'sys/mem', p: 3 },
  { n: 'Runtime', d: 'Runtime utilities', c: 'sys/rt', p: 3 },
  { n: 'Time', d: 'Time utilities', c: 'sys/time', p: 2 },
  { n: 'Timer', d: 'Periodic tasks', c: 'sys/time', p: 2 },
  { n: 'Random', d: 'Random numbers', c: 'sys/rand', p: 2 },
  { n: 'ExperimentalCycles', d: 'Experimental cycles', c: 'sys/exp', p: 3 },
];

/**
 * Expand minimal module to full format when needed
 */
export function expandModule(m: MinimalModule): any {
  const baseUrl = 'https://internetcomputer.org/docs/motoko/core/';
  const githubUrl = 'https://github.com/dfinity/motoko-core/blob/main/src/';

  return {
    name: m.n,
    description: m.d,
    category: expandCategory(m.c),
    priority: m.p,
    docUrl: `${baseUrl}${m.n}`,
    githubUrl: `${githubUrl}${m.n}.mo`,
    playgroundUrl: `https://m7sm4-2iaaa-aaaah-qbilq-cai.raw.ic0.app/?tag=3299891533`
  };
}

/**
 * Expand category shorthand
 */
function expandCategory(c: string): string {
  const [main, sub] = c.split('/');
  const mainMap: Record<string, string> = {
    'ds': 'data-structures',
    'prim': 'primitives',
    'util': 'utilities',
    'sys': 'system'
  };
  const subMap: Record<string, string> = {
    'arr': 'arrays',
    'map': 'maps',
    'set': 'sets',
    'list': 'lists',
    'bool': 'boolean',
    'text': 'text',
    'bin': 'binary',
    'num': 'numbers',
    'ctrl': 'control',
    'fn': 'functions',
    'id': 'identity',
    'cert': 'certified',
    'mem': 'memory',
    'rt': 'runtime',
    'rand': 'random',
    'exp': 'experimental'
  };

  return `${mainMap[main] || main}/${subMap[sub] || sub}`;
}

/**
 * Get module by name
 */
export function getModule(name: string): MinimalModule | undefined {
  return MODULES_MINIMAL.find(m => m.n === name);
}

/**
 * Search modules by keyword
 */
export function searchModules(query: string): MinimalModule[] {
  const q = query.toLowerCase();
  return MODULES_MINIMAL.filter(m =>
    m.n.toLowerCase().includes(q) ||
    m.d.toLowerCase().includes(q) ||
    m.c.includes(q)
  );
}

/**
 * Get modules by category
 */
export function getModulesByCategory(category: string): MinimalModule[] {
  return MODULES_MINIMAL.filter(m => m.c.startsWith(category));
}

/**
 * Get all categories
 */
export function getCategories(): string[] {
  const cats = new Set<string>();
  MODULES_MINIMAL.forEach(m => {
    const [main] = m.c.split('/');
    cats.add(main);
  });
  return Array.from(cats);
}

/**
 * Get all category keywords for pattern matching
 * Returns both abbreviated and expanded forms
 */
export function getCategoryKeywords(): string[] {
  const keywords = new Set<string>();

  // Add main category abbreviations and expansions
  const mainMap: Record<string, string> = {
    'ds': 'data-structures',
    'prim': 'primitives',
    'util': 'utilities',
    'sys': 'system'
  };

  // Add sub-category expansions
  const subMap: Record<string, string> = {
    'arr': 'arrays',
    'map': 'maps',
    'set': 'sets',
    'list': 'lists',
    'bool': 'boolean',
    'text': 'text',
    'bin': 'binary',
    'num': 'numbers',
    'ctrl': 'control',
    'fn': 'functions',
    'id': 'identity',
    'cert': 'certified',
    'mem': 'memory',
    'rt': 'runtime',
    'rand': 'random',
    'exp': 'experimental'
  };

  // Add all variations
  Object.values(mainMap).forEach(v => keywords.add(v));
  Object.values(subMap).forEach(v => keywords.add(v));

  // Add singular forms too
  keywords.add('array');
  keywords.add('number');
  keywords.add('utility');
  keywords.add('function');

  // Add common synonyms
  keywords.add('data');
  keywords.add('structure');
  keywords.add('primitive');

  return Array.from(keywords);
}