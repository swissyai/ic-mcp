/**
 * Internet Computer Documentation Index
 *
 * Comprehensive index of ICP documentation for semantic search and discovery.
 * Enables querying any topic from internetcomputer.org with intelligent routing.
 *
 * Categories:
 * - concepts: Core ICP concepts (canisters, cycles, consensus)
 * - guides: Developer guides and tutorials
 * - references: API specs, language references
 * - tools: dfx, didc, and other CLI tools
 * - advanced: Chain Fusion, SNS, Internet Identity
 * - best-practices: Security, upgrades, optimization
 */

/**
 * Doc entry with rich metadata for semantic matching
 */
export interface DocEntry {
  id: string; // Unique identifier
  title: string; // Human-readable title
  category: string; // Main category
  subcategory?: string; // Optional subcategory
  url: string; // Full or relative URL
  keywords: string[]; // Search keywords
  aliases?: string[]; // Alternative names/terms
  relatedTo?: string[]; // Related doc IDs
  priority: 1 | 2 | 3; // Search priority (1=highest)
  lastVerified?: string; // Last verification date (YYYY-MM-DD)
}

/**
 * CORE CONCEPTS
 * Fundamental ICP blockchain concepts
 */
export const CONCEPTS: DocEntry[] = [
  {
    id: 'concepts.canisters',
    title: 'Canisters (Smart Contracts)',
    category: 'concepts',
    subcategory: 'core',
    url: '/docs/concepts/canisters-code',
    keywords: ['canister', 'smart contract', 'wasm', 'actor', 'module'],
    aliases: ['smart contract', 'actor'],
    priority: 1,
  },
  {
    id: 'concepts.cycles',
    title: 'Cycles (Computation Fees)',
    category: 'concepts',
    subcategory: 'core',
    url: '/docs/concepts/tokens-cycles',
    keywords: ['cycles', 'gas', 'fees', 'cost', 'computation'],
    aliases: ['gas', 'fees'],
    priority: 1,
  },
  {
    id: 'concepts.principals',
    title: 'Principals (Identity)',
    category: 'concepts',
    subcategory: 'identity',
    url: '/docs/concepts/trust-in-canisters#principals',
    keywords: ['principal', 'identity', 'caller', 'authentication', 'user id'],
    priority: 1,
  },
  {
    id: 'concepts.consensus',
    title: 'Consensus Mechanism',
    category: 'concepts',
    subcategory: 'blockchain',
    url: '/docs/concepts/consensus',
    keywords: ['consensus', 'finality', 'threshold signatures', 'bft'],
    priority: 2,
  },
  {
    id: 'concepts.subnets',
    title: 'Subnets',
    category: 'concepts',
    subcategory: 'blockchain',
    url: '/docs/concepts/nodes-subnets',
    keywords: ['subnet', 'node', 'blockchain', 'replication', 'sharding'],
    priority: 2,
  },
  {
    id: 'concepts.http-outcalls',
    title: 'HTTP Outcalls (HTTPS Requests)',
    category: 'concepts',
    subcategory: 'integration',
    url: '/docs/building-apps/network-features/https-outcalls',
    keywords: ['http outcall', 'https request', 'external api', 'web2', 'oracle'],
    aliases: ['https outcalls', 'http requests'],
    priority: 1,
  },
];

/**
 * DEVELOPER GUIDES
 * Step-by-step guides and tutorials
 */
export const GUIDES: DocEntry[] = [
  {
    id: 'guides.quickstart',
    title: 'Quickstart Guide',
    category: 'guides',
    subcategory: 'getting-started',
    url: '/docs/developer-docs/getting-started/deploy/local',
    keywords: ['quickstart', 'getting started', 'first canister', 'hello world', 'tutorial'],
    priority: 1,
  },
  {
    id: 'guides.deploy-mainnet',
    title: 'Deploy to Mainnet',
    category: 'guides',
    subcategory: 'deployment',
    url: '/docs/developer-docs/getting-started/deploy/mainnet',
    keywords: ['deploy', 'mainnet', 'production', 'ic', 'network'],
    priority: 1,
  },
  {
    id: 'guides.frontend-setup',
    title: 'Frontend Setup',
    category: 'guides',
    subcategory: 'frontend',
    url: '/docs/developer-docs/web-apps/browser-js/js-frameworks',
    keywords: ['frontend', 'react', 'vue', 'svelte', 'javascript', 'agent-js'],
    priority: 2,
  },
  {
    id: 'guides.ic-agent-js',
    title: 'JavaScript Agent Library',
    category: 'guides',
    subcategory: 'frontend',
    url: '/docs/developer-docs/web-apps/browser-js/js-request',
    keywords: ['agent-js', 'javascript', 'frontend', 'browser', 'api calls'],
    aliases: ['@dfinity/agent'],
    priority: 2,
  },
  {
    id: 'guides.inter-canister-calls',
    title: 'Inter-Canister Calls',
    category: 'guides',
    subcategory: 'development',
    url: '/docs/developer-docs/backend/motoko/inter-canister-calls',
    keywords: ['inter-canister', 'cross-canister', 'call', 'await', 'async'],
    priority: 1,
  },
];

/**
 * LANGUAGE REFERENCES
 * Motoko and Rust language documentation
 */
export const REFERENCES: DocEntry[] = [
  {
    id: 'ref.motoko-syntax',
    title: 'Motoko Language Syntax',
    category: 'references',
    subcategory: 'motoko',
    url: '/docs/motoko/main/language-manual',
    keywords: ['motoko', 'syntax', 'language', 'grammar', 'reference'],
    priority: 2,
  },
  {
    id: 'ref.candid-spec',
    title: 'Candid Interface Description Language',
    category: 'references',
    subcategory: 'candid',
    url: '/docs/developer-docs/backend/candid/',
    keywords: ['candid', 'interface', 'idl', 'types', 'serialization'],
    priority: 1,
  },
  {
    id: 'ref.rust-cdk',
    title: 'Rust CDK Documentation',
    category: 'references',
    subcategory: 'rust',
    url: '/docs/developer-docs/backend/rust/',
    keywords: ['rust', 'cdk', 'ic-cdk', 'cargo', 'canister development kit'],
    aliases: ['ic-cdk'],
    priority: 1,
  },
  {
    id: 'ref.system-api',
    title: 'System API Reference',
    category: 'references',
    subcategory: 'api',
    url: '/docs/current/references/ic-interface-spec',
    keywords: ['system api', 'ic api', 'low-level', 'canister api', 'ic0'],
    priority: 2,
  },
];

/**
 * TOOLS & CLI
 * dfx, didc, ic-repl, and other tooling
 */
export const TOOLS: DocEntry[] = [
  {
    id: 'tools.dfx-cli',
    title: 'dfx CLI Reference',
    category: 'tools',
    subcategory: 'dfx',
    url: '/docs/developer-docs/developer-tools/cli-tools/cli-reference/',
    keywords: ['dfx', 'cli', 'command line', 'deploy', 'build', 'start'],
    priority: 1,
  },
  {
    id: 'tools.dfx-json',
    title: 'dfx.json Configuration',
    category: 'tools',
    subcategory: 'dfx',
    url: '/docs/developer-docs/developer-tools/cli-tools/dfx-json-reference',
    keywords: ['dfx.json', 'configuration', 'project config', 'canisters config'],
    priority: 1,
  },
  {
    id: 'tools.didc',
    title: 'didc - Candid CLI Tool',
    category: 'tools',
    subcategory: 'candid',
    url: '/docs/developer-docs/backend/candid/candid-howto#using-the-candid-ui-canister-and-didc',
    keywords: ['didc', 'candid', 'cli', 'validation', 'encoding'],
    priority: 2,
  },
  {
    id: 'tools.pocket-ic',
    title: 'PocketIC Testing Library',
    category: 'tools',
    subcategory: 'testing',
    url: '/docs/developer-docs/developer-tools/off-chain/pocket-ic',
    keywords: ['pocketic', 'testing', 'local', 'integration tests', 'test harness'],
    aliases: ['pocket-ic'],
    priority: 2,
  },
];

/**
 * ADVANCED FEATURES
 * Chain Fusion, SNS, Internet Identity, etc.
 */
export const ADVANCED: DocEntry[] = [
  {
    id: 'advanced.chain-fusion',
    title: 'Chain Fusion (Multi-Chain)',
    category: 'advanced',
    subcategory: 'integration',
    url: '/docs/building-apps/multi-chain/',
    keywords: ['chain fusion', 'multi-chain', 'bitcoin', 'ethereum', 'cross-chain', 'evm'],
    priority: 1,
  },
  {
    id: 'advanced.threshold-ecdsa',
    title: 'Threshold ECDSA',
    category: 'advanced',
    subcategory: 'crypto',
    url: '/docs/building-apps/network-features/threshold-ecdsa',
    keywords: ['threshold ecdsa', 'tecdsa', 'bitcoin', 'ethereum', 'signing', 'cryptography'],
    priority: 2,
  },
  {
    id: 'advanced.internet-identity',
    title: 'Internet Identity',
    category: 'advanced',
    subcategory: 'identity',
    url: '/docs/building-apps/integrations/internet-identity',
    keywords: ['internet identity', 'ii', 'authentication', 'webauthn', 'login', 'passkey'],
    aliases: ['ii', 'webauthn'],
    priority: 1,
  },
  {
    id: 'advanced.sns',
    title: 'SNS (Decentralized Governance)',
    category: 'advanced',
    subcategory: 'governance',
    url: '/docs/developer-docs/daos/sns/',
    keywords: ['sns', 'service nervous system', 'dao', 'governance', 'tokenization'],
    priority: 2,
  },
  {
    id: 'advanced.nns',
    title: 'NNS (Network Nervous System)',
    category: 'advanced',
    subcategory: 'governance',
    url: '/docs/concepts/governance',
    keywords: ['nns', 'network nervous system', 'governance', 'neuron', 'voting'],
    priority: 2,
  },
];

/**
 * BEST PRACTICES
 * Security, performance, upgrades
 */
export const BEST_PRACTICES: DocEntry[] = [
  {
    id: 'practices.security',
    title: 'Security Best Practices',
    category: 'best-practices',
    subcategory: 'security',
    url: '/docs/developer-docs/security/security-best-practices/overview',
    keywords: ['security', 'best practices', 'vulnerabilities', 'audit', 'safety'],
    priority: 1,
  },
  {
    id: 'practices.canister-upgrades',
    title: 'Canister Upgrade Guide',
    category: 'best-practices',
    subcategory: 'maintenance',
    url: '/docs/developer-docs/backend/motoko/upgrades',
    keywords: ['upgrade', 'migration', 'stable memory', 'state preservation'],
    priority: 1,
  },
  {
    id: 'practices.cycles-management',
    title: 'Cycles Management',
    category: 'best-practices',
    subcategory: 'operations',
    url: '/docs/developer-docs/gas-cost',
    keywords: ['cycles', 'cost', 'optimization', 'freeze threshold', 'top up'],
    priority: 2,
  },
];

/**
 * All documentation entries combined
 */
export const ALL_DOCS: DocEntry[] = [
  ...CONCEPTS,
  ...GUIDES,
  ...REFERENCES,
  ...TOOLS,
  ...ADVANCED,
  ...BEST_PRACTICES,
];

/**
 * Search docs by keyword or phrase
 * Returns ranked results based on keyword matching and priority
 */
export function searchDocs(
  query: string,
  options: {
    categories?: string[];
    limit?: number;
    minScore?: number;
  } = {}
): DocEntry[] {
  const { categories, limit = 10, minScore = 0.3 } = options;

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);

  // Score each doc
  const scored = ALL_DOCS.map(doc => {
    // Filter by category if specified
    if (categories && !categories.includes(doc.category)) {
      return { doc, score: 0 };
    }

    let score = 0;

    // Exact title match (highest score)
    if (doc.title.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Keyword matches
    for (const keyword of doc.keywords) {
      if (keyword.toLowerCase().includes(queryLower)) {
        score += 5;
      }
      // Partial keyword match
      for (const word of queryWords) {
        if (keyword.toLowerCase().includes(word)) {
          score += 2;
        }
      }
    }

    // Alias matches
    if (doc.aliases) {
      for (const alias of doc.aliases) {
        if (alias.toLowerCase().includes(queryLower)) {
          score += 8;
        }
      }
    }

    // ID match
    if (doc.id.toLowerCase().includes(queryLower)) {
      score += 3;
    }

    // Priority boost
    score *= doc.priority === 1 ? 1.5 : doc.priority === 2 ? 1.2 : 1.0;

    return { doc, score };
  });

  // Filter and sort
  return scored
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc }) => doc);
}

/**
 * Get doc by ID
 */
export function getDocById(id: string): DocEntry | undefined {
  return ALL_DOCS.find(doc => doc.id === id);
}

/**
 * Get docs by category
 */
export function getDocsByCategory(category: string): DocEntry[] {
  return ALL_DOCS.filter(doc => doc.category === category);
}

/**
 * Get all categories
 */
export function getAllCategories(): string[] {
  return [...new Set(ALL_DOCS.map(doc => doc.category))];
}
