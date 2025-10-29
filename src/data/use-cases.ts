/**
 * Use-case metadata for semantic search
 * AI-generated keywords mapping modules to common use cases
 */

export interface UseCase {
  m: string;  // module name
  k: string;  // keywords (comma-separated)
}

export const useCases: UseCase[] = [
  {
    m: "Array",
    k: "always, lists, collections, iteration, sorting, filtering, mapping, core data structure, immutable sequences"
  },
  {
    m: "VarArray",
    k: "mutable arrays, dynamic lists, resizable collections, buffer operations, in-place modifications"
  },
  {
    m: "Buffer",
    k: "growing arrays, dynamic allocation, append operations, queue implementation, streaming data"
  },
  {
    m: "Map",
    k: "key-value storage, dictionaries, lookup tables, caching, configuration, ordered maps, tree-based"
  },
  {
    m: "HashMap",
    k: "hash tables, fast lookups, unordered maps, O(1) access, large datasets, caching layer"
  },
  {
    m: "RBTree",
    k: "balanced trees, sorted maps, range queries, ordered iteration, guaranteed O(log n)"
  },
  {
    m: "TrieMap",
    k: "tries, prefix matching, string keys, efficient string lookup, path-based storage"
  },
  {
    m: "Set",
    k: "unique values, membership testing, deduplication, collection operations, union, intersection"
  },
  {
    m: "TrieSet",
    k: "unique strings, prefix sets, trie-based uniqueness, efficient string sets"
  },
  {
    m: "List",
    k: "linked lists, functional programming, cons cells, recursive data, immutable sequences, pattern matching"
  },
  {
    m: "Queue",
    k: "FIFO, first-in-first-out, job queues, task scheduling, message passing, event handling"
  },
  {
    m: "Stack",
    k: "LIFO, last-in-first-out, undo operations, call stack, parsing, depth-first search"
  },
  {
    m: "Deque",
    k: "double-ended queue, bidirectional access, sliding window, palindrome checking, efficient both ends"
  },
  {
    m: "Bool",
    k: "boolean operations, logic, true/false, conditionals, flags, binary decisions"
  },
  {
    m: "Char",
    k: "characters, unicode, text processing, character codes, single characters, char validation"
  },
  {
    m: "Text",
    k: "always, strings, text manipulation, concatenation, parsing, string operations, text processing, unicode"
  },
  {
    m: "Blob",
    k: "binary data, bytes, serialization, byte arrays, binary protocols, raw data, file content"
  },
  {
    m: "Int",
    k: "always, integers, signed numbers, arithmetic, math operations, negative numbers, integer math"
  },
  {
    m: "Int8",
    k: "8-bit integers, byte values, small signed numbers, compact storage, -128 to 127"
  },
  {
    m: "Int16",
    k: "16-bit integers, short integers, signed shorts, -32768 to 32767"
  },
  {
    m: "Int32",
    k: "32-bit integers, standard integers, signed ints, -2^31 to 2^31-1"
  },
  {
    m: "Int64",
    k: "64-bit integers, long integers, large signed numbers, timestamps, -2^63 to 2^63-1"
  },
  {
    m: "Nat",
    k: "always, natural numbers, unsigned integers, positive numbers, counting, non-negative, token amounts"
  },
  {
    m: "Nat8",
    k: "bytes, unsigned bytes, 0-255, byte values, compact unsigned, u8"
  },
  {
    m: "Nat16",
    k: "unsigned shorts, 16-bit unsigned, 0-65535, u16"
  },
  {
    m: "Nat32",
    k: "unsigned ints, 32-bit unsigned, 0 to 2^32-1, u32, identifiers"
  },
  {
    m: "Nat64",
    k: "unsigned longs, 64-bit unsigned, large unsigned, u64, cycle counts, large amounts"
  },
  {
    m: "Float",
    k: "floating point, decimals, fractional numbers, scientific notation, IEEE 754, double precision"
  },
  {
    m: "Option",
    k: "always, nullable, maybe, optional values, None, Some, null handling, optional parameters"
  },
  {
    m: "Result",
    k: "always, error handling, Ok, Err, fallible operations, success or failure, error types"
  },
  {
    m: "Error",
    k: "errors, exceptions, error creation, error codes, error messages, trap, reject"
  },
  {
    m: "Debug",
    k: "debugging, print, logging, development, assertions, debug output, tracing"
  },
  {
    m: "Func",
    k: "function utilities, higher-order functions, function composition, const, identity"
  },
  {
    m: "Iter",
    k: "iterators, lazy evaluation, generator, iteration, map, filter, reduce, functional programming"
  },
  {
    m: "Order",
    k: "comparison, ordering, sorting, less than, greater than, equal, comparators"
  },
  {
    m: "Principal",
    k: "always, identity, principals, user identification, caller, authentication, canister ids, addresses"
  },
  {
    m: "Cycles",
    k: "cycles, payment, computation cost, gas, resource management, cycle balance"
  },
  {
    m: "CertifiedData",
    k: "certification, certified queries, data validation, cryptographic proofs, certified responses"
  },
  {
    m: "Region",
    k: "memory regions, stable memory, large data, memory management, byte-level access, raw memory"
  },
  {
    m: "Runtime",
    k: "runtime info, system information, canister metadata, runtime configuration"
  },
  {
    m: "Time",
    k: "time, timestamps, current time, nanoseconds, time operations, duration"
  },
  {
    m: "Timer",
    k: "timers, scheduled tasks, periodic execution, cron, delayed execution, recurring jobs"
  },
  {
    m: "Random",
    k: "random numbers, randomness, shuffle, dice, rng, random generation, entropy, always"
  },
  {
    m: "ExperimentalCycles",
    k: "experimental cycles, cycle management, advanced cycle operations, cycle transfers"
  }
];

export const useCaseData = {
  generated: "2025-10-28T19:26:53.842Z",
  version: "1.0.0",
  useCases
};
