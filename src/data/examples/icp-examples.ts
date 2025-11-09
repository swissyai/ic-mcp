/**
 * ICP Examples Index
 *
 * Curated examples from the Internet Computer ecosystem
 * Source: https://github.com/swissyai/ic-mcp-examples
 * Reference docs: https://github.com/dfinity/examples
 *
 * IMPORTANT DISCLAIMERS:
 * - These examples may become outdated over time
 * - For the most up-to-date examples, visit https://icp.ninja/
 * - Not affiliated with DFINITY Foundation or ICP.ninja
 *
 * What this provides:
 * - Structured metadata (categories, descriptions, technologies)
 * - Direct links to full source code (sourceUrl)
 * - Language detection (Motoko, Rust, Frontend-only)
 * - Technology tags (Internet Identity, Bitcoin, vetKeys, etc.)
 *
 * AI agents use this for:
 * - Discovery: "Show me Bitcoin integration examples"
 * - Learning: "How do I use vetKeys for encryption?"
 * - Patterns: "What's the architecture for multi-canister apps?"
 *
 * Categories:
 * - AI: AI and machine learning applications
 * - DeFi: Decentralized finance
 * - Chain Fusion: Multi-chain integration
 * - NFT: Non-fungible tokens
 * - Games: Gaming applications
 * - Data Storage: File and data storage
 * - Productivity: Productivity tools
 * - Tooling: Developer tools and utilities
 */

export interface ICPExample {
  id: string;
  title: string;
  category: 'AI' | 'DeFi' | 'Chain Fusion' | 'NFT' | 'Games' | 'Data Storage' | 'Productivity' | 'Tooling';
  description: string;
  language: 'motoko' | 'rust' | 'frontend-only';
  githubPath: string;
  hasFrontend: boolean;
  technologies: string[];
  priority: number;
  docUrl: string;
  githubUrl: string;
  sourceUrl: string; // Full source code repository URL
}

export const icpExamples: ICPExample[] = [{
    id: "llm-chatbot",
    title: "Llm Chatbot",
    category: "AI",
    description: "Deploy an AI chatbot that users can talk to and ask questions.",
    language: "motoko",
    githubPath: "motoko/llm_chatbot",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/llm_chatbot",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/llm-chatbot",
  },
  {
    id: "basic-solana",
    title: "Basic Solana",
    category: "Chain Fusion",
    description: "Integrate Solana into your ICP project.",
    language: "rust",
    githubPath: "rust/basic_solana",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/basic_solana",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/basic-solana",
  },
  {
    id: "oisy-signer-demo",
    title: "Oisy Signer Demo",
    category: "DeFi",
    description: "Connect to an OISY Wallet from a frontend and self-transfer ICP and ckUSDC.",
    language: "frontend-only",
    githubPath: "hosting/oisy-signer-demo",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/hosting/oisy-signer-demo",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/oisy-signer-demo",
  },
  {
    id: "encrypted-notes",
    title: "Encrypted Notes",
    category: "Data Storage",
    description: "Deploy an app for managing encrypted notes.",
    language: "motoko",
    githubPath: "motoko/encrypted-notes-dapp-vetkd",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/encrypted-notes-dapp-vetkd",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/encrypted-notes",
  },
  {
    id: "encrypted-notes-rust",
    title: "Encrypted Notes Rust",
    category: "Data Storage",
    description: "Deploy an app for managing encrypted notes.",
    language: "rust",
    githubPath: "rust/encrypted-notes-dapp-vetkd",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/encrypted-notes-dapp-vetkd",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/encrypted-notes-rust",
  },
  {
    id: "bitcoin-wallet",
    title: "Bitcoin Wallet",
    category: "Chain Fusion",
    description: "Deploy a Bitcoin wallet that can send and receive Bitcoin.",
    language: "rust",
    githubPath: "rust/basic_bitcoin",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/basic_bitcoin",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/bitcoin-wallet",
  },
  {
    id: "filevault",
    title: "Filevault",
    category: "Data Storage",
    description: "Upload files and store them directly onchain. Authenticate with Internet Identity.",
    language: "motoko",
    githubPath: "motoko/filevault",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/filevault",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/filevault",
  },
  {
    id: "inter-canister-calls",
    title: "Inter Canister Calls",
    category: "Productivity",
    description: "Learn how to call one canister from another.",
    language: "rust",
    githubPath: "rust/inter-canister-calls",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/inter-canister-calls",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/inter-canister-calls",
  },
  {
    id: "canister-logs",
    title: "Canister Logs",
    category: "Tooling",
    description: "A simple example that can write and read canister logs.",
    language: "motoko",
    githubPath: "motoko/canister_logs",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/canister_logs",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/canister-logs",
  },
  {
    id: "canister-logs-rust",
    title: "Canister Logs Rust",
    category: "Tooling",
    description: "A simple example that can write and read canister logs.",
    language: "rust",
    githubPath: "rust/canister_logs",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/canister_logs",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/canister-logs-rust",
  },
  {
    id: "http-post-rust",
    title: "Http Post Rust",
    category: "Tooling",
    description: "Use HTTPS outcalls to post data to the web.",
    language: "rust",
    githubPath: "rust/send_http_post",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/send_http_post",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/http-post-rust",
  },
  {
    id: "http-post",
    title: "Http Post",
    category: "Tooling",
    description: "Use HTTPS outcalls to post data to the web.",
    language: "motoko",
    githubPath: "motoko/send_http_post",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/send_http_post",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/http-post",
  },
  {
    id: "http-get-rust",
    title: "Http Get Rust",
    category: "Tooling",
    description: "Use HTTPS outcalls to fetch data from the web.",
    language: "rust",
    githubPath: "rust/send_http_get",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/send_http_get",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/http-get-rust",
  },
  {
    id: "http-get",
    title: "Http Get",
    category: "Tooling",
    description: "Use HTTPS outcalls to fetch data from the web.",
    language: "motoko",
    githubPath: "motoko/send_http_get",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/send_http_get",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/http-get",
  },
  {
    id: "receive-icp",
    title: "Receive Icp",
    category: "DeFi",
    description: "Deploy a canister that can receive (test) ICP",
    language: "rust",
    githubPath: "rust/receiving-icp",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/receiving-icp",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/receive-icp",
  },
  {
    id: "nft-creator",
    title: "Nft Creator",
    category: "NFT",
    description: "Create your own NFT collection.",
    language: "motoko",
    githubPath: "motoko/nft-creator",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/nft-creator",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/nft-creator",
  },
  {
    id: "tokenmania-rust",
    title: "Tokenmania Rust",
    category: "DeFi",
    description: "Deploy a custom token and import it into the Network Nervous System (NNS) dapp.",
    language: "rust",
    githubPath: "rust/tokenmania",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/tokenmania",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/tokenmania-rust",
  },
  {
    id: "tokenmania",
    title: "Tokenmania",
    category: "DeFi",
    description: "Deploy a custom token and import it into the Network Nervous System (NNS) dapp.",
    language: "motoko",
    githubPath: "motoko/tokenmania",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/tokenmania",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/tokenmania",
  },
  {
    id: "superheroes",
    title: "Superheroes",
    category: "Data Storage",
    description: "A CRUD application for managing superheroes with names and superpowers.",
    language: "motoko",
    githubPath: "motoko/superheroes",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/superheroes",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/superheroes",
  },
  {
    id: "speedups-with-simd",
    title: "Speedups With Simd",
    category: "Tooling",
    description: "Use SIMD to accelerate your canister.",
    language: "rust",
    githubPath: "rust/simd",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/simd",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/speedups-with-simd",
  },
  {
    id: "threshold-schnorr",
    title: "Threshold Schnorr",
    category: "DeFi",
    description: "Use threshold Schnorr to sign transactions or arbitrary data.",
    language: "motoko",
    githubPath: "motoko/threshold-schnorr",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/threshold-schnorr",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/threshold-schnorr",
  },
  {
    id: "threshold-ecdsa-rust",
    title: "Threshold Ecdsa Rust",
    category: "DeFi",
    description: "Use threshold ECDSA to sign transactions or arbitrary data.",
    language: "rust",
    githubPath: "rust/threshold-ecdsa",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/threshold-ecdsa",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/threshold-ecdsa-rust",
  },
  {
    id: "threshold-ecdsa",
    title: "Threshold Ecdsa",
    category: "DeFi",
    description: "Use threshold ECDSA to sign transactions or arbitrary data.",
    language: "motoko",
    githubPath: "motoko/threshold-ecdsa",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/threshold-ecdsa",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/threshold-ecdsa",
  },
  {
    id: "query-stats-rust",
    title: "Query Stats Rust",
    category: "Tooling",
    description: "Figure out how much work your canister did in queries.",
    language: "rust",
    githubPath: "rust/query_stats",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/query_stats",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/query-stats-rust",
  },
  {
    id: "query-stats",
    title: "Query Stats",
    category: "Tooling",
    description: "Figure out how much work your canister did in queries.",
    language: "motoko",
    githubPath: "motoko/query_stats",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/query_stats",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/query-stats",
  },
  {
    id: "evm-block-explorer-rust",
    title: "Evm Block Explorer Rust",
    category: "Chain Fusion",
    description: "Query information about the latest block from an EVM chain without using a bridge or oracle.",
    language: "rust",
    githubPath: "rust/evm_block_explorer",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/evm_block_explorer",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/evm-block-explorer-rust",
  },
  {
    id: "evm-block-explorer",
    title: "Evm Block Explorer",
    category: "Chain Fusion",
    description: "Query information about the latest block from an EVM chain without using a bridge or oracle.",
    language: "motoko",
    githubPath: "motoko/evm_block_explorer",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 1,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/evm_block_explorer",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/evm-block-explorer",
  },
  {
    id: "my-crypto-blog",
    title: "My Crypto Blog",
    category: "Productivity",
    description: "Start developing on ICP with a simple frontend-only project.",
    language: "frontend-only",
    githubPath: "hosting/static-website",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/hosting/static-website",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/my-crypto-blog",
  },
  {
    id: "guards",
    title: "Guards",
    category: "Tooling",
    description: "Run checks before accepting an incoming request.",
    language: "rust",
    githubPath: "rust/guards",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/guards",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/guards",
  },
  {
    id: "performance-counters",
    title: "Performance Counters",
    category: "Tooling",
    description: "Analyze the performance of your canister.",
    language: "rust",
    githubPath: "rust/performance_counters",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 3,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/performance_counters",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/performance-counters",
  },
  {
    id: "flying-ninja-rust",
    title: "Flying Ninja Rust",
    category: "Games",
    description: "Deploy and customize a side-scroller game that uses onchain randomness to generate obstacles.",
    language: "rust",
    githubPath: "rust/flying_ninja",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/flying_ninja",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/flying-ninja-rust",
  },
  {
    id: "flying-ninja",
    title: "Flying Ninja",
    category: "Games",
    description: "Deploy and customize a side-scroller game that uses onchain randomness to generate obstacles.",
    language: "motoko",
    githubPath: "motoko/flying_ninja",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/flying_ninja",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/flying-ninja",
  },
  {
    id: "daily-planner-rust",
    title: "Daily Planner Rust",
    category: "Productivity",
    description: "Track daily tasks and activities. Incorporate off-chain data into your planner using HTTPS outcalls.",
    language: "rust",
    githubPath: "rust/daily_planner",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/daily_planner",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/daily-planner-rust",
  },
  {
    id: "photo-gallery",
    title: "Photo Gallery",
    category: "Productivity",
    description: "Upload photos, store them onchain, and share them with friends and family.",
    language: "rust",
    githubPath: "rust/photo_gallery",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/rust/photo_gallery",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/photo-gallery",
  },
  {
    id: "daily-planner",
    title: "Daily Planner",
    category: "Productivity",
    description: "Track daily tasks and activities. Incorporate off-chain data into your planner using HTTPS outcalls.",
    language: "motoko",
    githubPath: "motoko/daily_planner",
    hasFrontend: true, // TODO: Verify from extracted data
    technologies: [], // TODO: Add from extracted data
    priority: 2,
    docUrl: "https://internetcomputer.org/docs/tutorials/developer-liftoff",
    githubUrl: "https://github.com/dfinity/examples/tree/master/motoko/daily_planner",
    sourceUrl: "https://raw.githubusercontent.com/swissyai/ic-mcp-examples/main/daily-planner",
  }
];
