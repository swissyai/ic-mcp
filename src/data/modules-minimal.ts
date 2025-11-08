/**
 * Minimal module index for mo:core (Motoko core library)
 * Optimized for TOON encoding - reduces from ~3000 tokens to ~500 tokens
 *
 * IMPORTANT: mo:core replaced mo:base in August 2025
 * Import syntax: import Array "mo:core/Array"
 */

export interface MinimalModule {
  n: string;  // name
  d: string;  // description (short)
  c: string;  // category
  p: number;  // priority (1-3)
}

/**
 * Platform features (not modules, but queryable documentation)
 */
export interface PlatformFeature {
  n: string;  // name
  d: string;  // description
  c: string;  // category
  u: string;  // URL path (relative to internetcomputer.org)
  p: number;  // priority (1-3)
}

export const PLATFORM_FEATURES: PlatformFeature[] = [
  // Persistence & Upgrades
  {
    n: 'EOP',
    d: 'Enhanced Orthogonal Persistence - default since moc 0.15.0, fast upgrades scaling independently of heap size',
    c: 'platform/persistence',
    u: '/docs/motoko/fundamentals/actors/orthogonal-persistence/enhanced',
    p: 1,
  },
  {
    n: 'Classical-Persistence',
    d: 'Classical orthogonal persistence - deprecated, uses serialization',
    c: 'platform/persistence',
    u: '/docs/motoko/main/canister-maintenance/orthogonal-persistence/classical',
    p: 3,
  },

  // Cryptography & Security
  {
    n: 'VetKeys',
    d: 'Verifiably encrypted threshold keys - enables IBE, threshold BLS signatures, decentralized key management',
    c: 'platform/crypto',
    u: '/docs/building-apps/network-features/vetkeys/introduction',
    p: 1,
  },
  {
    n: 'VetKeys-API',
    d: 'VetKeys API reference for threshold encryption and signing',
    c: 'platform/crypto',
    u: '/docs/building-apps/network-features/vetkeys/api',
    p: 2,
  },

  // Chain Fusion & Interoperability
  {
    n: 'Chain-Fusion',
    d: 'Multi-chain integration - connect ICP with Bitcoin, Ethereum, and other chains',
    c: 'platform/interop',
    u: '/docs/building-apps/multi-chain/',
    p: 2,
  },
  {
    n: 'Threshold-ECDSA',
    d: 'Threshold ECDSA signatures for Bitcoin and Ethereum integration',
    c: 'platform/crypto',
    u: '/docs/building-apps/network-features/threshold-ecdsa',
    p: 2,
  },

  // Performance & Optimization
  {
    n: 'Stable-Memory',
    d: 'Direct stable memory access - for large-scale data storage beyond heap',
    c: 'platform/memory',
    u: '/docs/motoko/main/writing-motoko/stable-memory',
    p: 2,
  },

  // Best Practices & Migration Guides
  {
    n: 'Labeled-Loops',
    d: 'Loop labels for break/continue - required in Motoko for breaking/continuing loops',
    c: 'practices/syntax',
    u: '/docs/motoko/main/base/control-flow#labeled-loops',
    p: 1,
  },
  {
    n: 'mo-core-Migration',
    d: 'mo:base to mo:core migration - mo:core is the new standard library (since Aug 2025)',
    c: 'practices/migration',
    u: '/docs/motoko/main/base/core-migration',
    p: 1,
  },
  {
    n: 'List-vs-Buffer',
    d: 'Use List instead of Buffer - Buffer deprecated, List provides dynamic sizing',
    c: 'practices/migration',
    u: '/docs/motoko/main/base/deprecated#buffer',
    p: 1,
  },
  {
    n: 'Async-Best-Practices',
    d: 'Async/await patterns and inter-canister calls - error handling and upgrades',
    c: 'practices/async',
    u: '/docs/motoko/main/writing-motoko/async-data',
    p: 2,
  },
];

export const MODULES_MINIMAL: MinimalModule[] = [
  // Data Structures - Arrays (Mutable)
  { n: 'Array', d: 'Immutable array utilities', c: 'ds/arr', p: 1 },
  { n: 'VarArray', d: 'Mutable array utilities', c: 'ds/arr', p: 1 },
  { n: 'List', d: 'Mutable list with random access', c: 'ds/list', p: 1 },

  // Data Structures - Maps (Mutable)
  { n: 'Map', d: 'Mutable ordered key-value map', c: 'ds/map', p: 1 },

  // Data Structures - Sets (Mutable)
  { n: 'Set', d: 'Mutable ordered set', c: 'ds/set', p: 1 },

  // Data Structures - Queues & Stacks (Mutable)
  { n: 'Queue', d: 'Mutable double-ended queue', c: 'ds/queue', p: 2 },
  { n: 'PriorityQueue', d: 'Mutable priority queue', c: 'ds/queue', p: 2 },
  { n: 'Stack', d: 'Mutable stack (LIFO)', c: 'ds/stack', p: 2 },

  // Pure/Functional Data Structures (Immutable)
  { n: 'pure/List', d: 'Immutable functional linked list', c: 'ds/pure', p: 2 },
  { n: 'pure/Map', d: 'Immutable ordered key-value map', c: 'ds/pure', p: 2 },
  { n: 'pure/Set', d: 'Immutable ordered set', c: 'ds/pure', p: 2 },
  { n: 'pure/Queue', d: 'Immutable double-ended queue', c: 'ds/pure', p: 2 },
  { n: 'pure/RealTimeQueue', d: 'Immutable queue with O(1) guarantees', c: 'ds/pure', p: 3 },

  // Primitives - Boolean
  { n: 'Bool', d: 'Boolean operations', c: 'prim/bool', p: 1 },

  // Primitives - Text
  { n: 'Char', d: 'Character utilities', c: 'prim/text', p: 2 },
  { n: 'Text', d: 'String operations', c: 'prim/text', p: 1 },

  // Primitives - Binary
  { n: 'Blob', d: 'Binary data operations', c: 'prim/bin', p: 1 },

  // Primitives - Numbers
  { n: 'Int', d: 'Infinite precision integers', c: 'prim/num', p: 1 },
  { n: 'Int8', d: '8-bit signed integers', c: 'prim/num', p: 3 },
  { n: 'Int16', d: '16-bit signed integers', c: 'prim/num', p: 3 },
  { n: 'Int32', d: '32-bit signed integers', c: 'prim/num', p: 3 },
  { n: 'Int64', d: '64-bit signed integers', c: 'prim/num', p: 3 },
  { n: 'Nat', d: 'Infinite precision naturals', c: 'prim/num', p: 1 },
  { n: 'Nat8', d: '8-bit unsigned integers', c: 'prim/num', p: 3 },
  { n: 'Nat16', d: '16-bit unsigned integers', c: 'prim/num', p: 3 },
  { n: 'Nat32', d: '32-bit unsigned integers', c: 'prim/num', p: 3 },
  { n: 'Nat64', d: '64-bit unsigned integers', c: 'prim/num', p: 3 },
  { n: 'Float', d: '64-bit IEEE 754 floating point', c: 'prim/num', p: 2 },

  // Utilities - Control Flow
  { n: 'Option', d: 'Typesafe nullable values', c: 'util/ctrl', p: 1 },
  { n: 'Result', d: 'Error handling type', c: 'util/ctrl', p: 1 },
  { n: 'Error', d: 'Error creation and handling', c: 'util/ctrl', p: 2 },
  { n: 'Debug', d: 'Debug utilities', c: 'util/ctrl', p: 2 },

  // Utilities - Functions
  { n: 'Func', d: 'Function utilities', c: 'util/fn', p: 2 },
  { n: 'Iter', d: 'Iterator operations', c: 'util/fn', p: 1 },
  { n: 'Order', d: 'Value comparison utilities', c: 'util/fn', p: 2 },

  // Utilities - Types
  { n: 'Tuples', d: 'Multi-size tuple operations', c: 'util/types', p: 3 },
  { n: 'Types', d: 'Type definitions', c: 'util/types', p: 3 },
  { n: 'WeakReference', d: 'Weak reference utilities', c: 'util/types', p: 3 },

  // System - Identity & Security
  { n: 'Principal', d: 'Principal and identity handling', c: 'sys/id', p: 1 },
  { n: 'CertifiedData', d: 'Certified data handling', c: 'sys/cert', p: 3 },

  // System - Cycles & Resources
  { n: 'Cycles', d: 'Cycle management', c: 'sys/cycles', p: 2 },

  // System - Memory
  { n: 'Region', d: 'Stable memory regions', c: 'sys/mem', p: 3 },

  // System - Time
  { n: 'Time', d: 'System time utilities', c: 'sys/time', p: 2 },
  { n: 'Timer', d: 'One-off or periodic timers', c: 'sys/time', p: 2 },

  // System - Randomness
  { n: 'Random', d: 'Random number generation', c: 'sys/rand', p: 2 },

  // System - Runtime & Low-level
  { n: 'Runtime', d: 'Runtime utilities', c: 'sys/rt', p: 3 },
  { n: 'InternetComputer', d: 'Low-level ICP interface', c: 'sys/icp', p: 3 },
];

/**
 * Expand minimal module to full format when needed
 */
export function expandModule(m: MinimalModule): any {
  const baseUrl = 'https://internetcomputer.org/docs/motoko/core/';
  const githubUrl = 'https://github.com/dfinity/motoko-core/blob/main/src/';

  // Handle pure/* modules specially
  const modulePath = m.n.includes('/') ? m.n : m.n;
  const docName = m.n.replace('/', '-'); // pure/List → pure-List for docs

  return {
    name: m.n,
    description: m.d,
    category: expandCategory(m.c),
    priority: m.p,
    docUrl: `${baseUrl}${docName}`,
    githubUrl: `${githubUrl}${modulePath}.mo`,
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
    'queue': 'queues',
    'stack': 'stacks',
    'pure': 'pure-functional',
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
    'cycles': 'cycles',
    'time': 'time',
    'types': 'types',
    'icp': 'internet-computer'
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
 * Get platform feature by name
 */
export function getPlatformFeature(name: string): PlatformFeature | undefined {
  // Case-insensitive search
  const normalized = name.toLowerCase();
  return PLATFORM_FEATURES.find(
    f => f.n.toLowerCase() === normalized ||
         f.n.toLowerCase().replace('-', '') === normalized
  );
}

/**
 * Expand platform feature to full format
 */
export function expandPlatformFeature(f: PlatformFeature): any {
  const baseUrl = 'https://internetcomputer.org';

  return {
    name: f.n,
    description: f.d,
    category: f.c,
    priority: f.p,
    docUrl: `${baseUrl}${f.u}`,
    type: 'platform-feature',
  };
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
    'queue': 'queues',
    'stack': 'stacks',
    'pure': 'pure-functional',
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
    'cycles': 'cycles',
    'time': 'time',
    'types': 'types',
    'icp': 'internet-computer'
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
  keywords.add('immutable');
  keywords.add('mutable');
  keywords.add('functional');

  return Array.from(keywords);
}
