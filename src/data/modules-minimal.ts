/**
 * Bundled list of mo:core modules (https://github.com/caffeinelabs/motoko-core).
 *
 * Used only when the official API reference cannot be fetched. Signatures and
 * current guidance come from the writing-motoko skill, not from this list.
 * Import syntax: import Map "mo:core/Map"
 */

export interface MinimalModule {
  n: string; // name
  d: string; // description (short)
  c: string; // category
  p: number; // priority (1-3)
}

export const MODULES_MINIMAL: MinimalModule[] = [
  { n: 'Array', d: 'Immutable array utilities', c: 'ds/arr', p: 1 },
  { n: 'VarArray', d: 'Mutable array utilities', c: 'ds/arr', p: 1 },
  { n: 'List', d: 'Mutable list with random access', c: 'ds/list', p: 1 },
  { n: 'Map', d: 'Mutable ordered key-value map', c: 'ds/map', p: 1 },
  { n: 'Set', d: 'Mutable ordered set', c: 'ds/set', p: 1 },
  { n: 'Queue', d: 'Mutable double-ended queue', c: 'ds/queue', p: 2 },
  { n: 'PriorityQueue', d: 'Mutable priority queue', c: 'ds/queue', p: 2 },
  { n: 'Stack', d: 'Mutable stack (LIFO)', c: 'ds/stack', p: 2 },
  { n: 'pure/List', d: 'Immutable functional linked list', c: 'ds/pure', p: 2 },
  { n: 'pure/Map', d: 'Immutable ordered key-value map', c: 'ds/pure', p: 2 },
  { n: 'pure/Set', d: 'Immutable ordered set', c: 'ds/pure', p: 2 },
  { n: 'pure/Queue', d: 'Immutable double-ended queue', c: 'ds/pure', p: 2 },
  { n: 'pure/RealTimeQueue', d: 'Immutable queue with O(1) guarantees', c: 'ds/pure', p: 3 },
  { n: 'Bool', d: 'Boolean operations', c: 'prim/bool', p: 1 },
  { n: 'Char', d: 'Character utilities', c: 'prim/text', p: 2 },
  { n: 'Text', d: 'String operations', c: 'prim/text', p: 1 },
  { n: 'Blob', d: 'Binary data operations', c: 'prim/bin', p: 1 },
  { n: 'Base64', d: 'Base64 encoding', c: 'prim/bin', p: 3 },
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
  { n: 'Float', d: '64-bit floating point', c: 'prim/num', p: 2 },
  { n: 'Float32', d: '32-bit floating point', c: 'prim/num', p: 3 },
  { n: 'Option', d: 'Optional values', c: 'util/ctrl', p: 1 },
  { n: 'Result', d: 'Error handling type', c: 'util/ctrl', p: 1 },
  { n: 'Error', d: 'Error values', c: 'util/ctrl', p: 2 },
  { n: 'Debug', d: 'Debug utilities', c: 'util/ctrl', p: 2 },
  { n: 'Runtime', d: 'Runtime utilities and environment variables', c: 'util/ctrl', p: 2 },
  { n: 'Func', d: 'Function utilities', c: 'util/fn', p: 2 },
  { n: 'Iter', d: 'Iterator operations', c: 'util/fn', p: 1 },
  { n: 'Order', d: 'Value comparison utilities', c: 'util/fn', p: 2 },
  { n: 'Tuples', d: 'Tuple utilities', c: 'util/types', p: 3 },
  { n: 'Records', d: 'Record utilities', c: 'util/types', p: 3 },
  { n: 'Variants', d: 'Variant utilities', c: 'util/types', p: 3 },
  { n: 'Unit', d: 'Unit type utilities', c: 'util/types', p: 3 },
  { n: 'Types', d: 'Shared type definitions', c: 'util/types', p: 3 },
  { n: 'WeakReference', d: 'Weak references', c: 'util/types', p: 3 },
  { n: 'Principal', d: 'Principals and identity', c: 'sys/id', p: 1 },
  { n: 'CallerAttributes', d: 'Caller attributes', c: 'sys/id', p: 3 },
  { n: 'CertifiedData', d: 'Certified data', c: 'sys/cert', p: 3 },
  { n: 'Cycles', d: 'Cycles balance and accounting', c: 'sys/cycles', p: 2 },
  { n: 'Region', d: 'Stable memory regions', c: 'sys/mem', p: 3 },
  { n: 'Time', d: 'System time', c: 'sys/time', p: 2 },
  { n: 'Timer', d: 'One-off and periodic timers', c: 'sys/time', p: 2 },
  { n: 'Random', d: 'Random numbers', c: 'sys/rand', p: 2 },
  { n: 'InternetComputer', d: 'Low-level system interface', c: 'sys/icp', p: 3 },
];

const MAIN_CATEGORIES: Record<string, string> = {
  ds: 'data-structures',
  prim: 'primitives',
  util: 'utilities',
  sys: 'system',
};

/**
 * Expand a module entry with its import line and source link.
 */
export function expandModule(m: MinimalModule) {
  const [main, sub] = m.c.split('/');
  return {
    name: m.n,
    description: m.d,
    category: `${MAIN_CATEGORIES[main] || main}/${sub}`,
    priority: m.p,
    import: `import ${m.n.split('/').pop()} "mo:core/${m.n}";`,
    sourceUrl: `https://github.com/caffeinelabs/motoko-core/blob/main/src/${m.n}.mo`,
  };
}

export function getModule(name: string): MinimalModule | undefined {
  return MODULES_MINIMAL.find(m => m.n.toLowerCase() === name.toLowerCase());
}
