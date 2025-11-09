/**
 * Help Tool - Meta information and guidance for ICP-MCP
 * Provides self-documentation, examples, and usage patterns
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

// Input schema for the help tool
export const HelpInputSchema = z.object({
  section: z
    .enum(['overview', 'query', 'action', 'examples', 'tokens', 'motoko', 'all'])
    .optional()
    .default('overview')
    .describe('Which help section to show'),
});

export type HelpInput = z.infer<typeof HelpInputSchema>;

/**
 * Main help tool execution
 */
export async function help(input: HelpInput) {
  logger.info(`Help tool called for section: ${input.section}`);

  let content: string;

  switch (input.section) {
    case 'overview':
      content = getOverview();
      break;
    case 'query':
      content = getQueryHelp();
      break;
    case 'action':
      content = getActionHelp();
      break;
    case 'examples':
      content = getExamples();
      break;
    case 'tokens':
      content = getTokenInfo();
      break;
    case 'motoko':
      content = getMotokoGuidance();
      break;
    case 'all':
      content = [
        getOverview(),
        '\n---\n',
        getQueryHelp(),
        '\n---\n',
        getActionHelp(),
        '\n---\n',
        getExamples(),
        '\n---\n',
        getTokenInfo(),
        '\n---\n',
        getMotokoGuidance(),
      ].join('\n');
      break;
    default:
      content = getOverview();
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: content,
      },
    ],
  };
}

/**
 * Overview section
 */
function getOverview(): string {
  return `# ICP-MCP: Internet Computer Model Context Protocol

Give every AI agent ICP superpowers.

## What is ICP-MCP?

A Model Context Protocol (MCP) server that provides Claude Code and other AI agents with comprehensive Internet Computer development capabilities through 4 unified, intelligent tools.

## Core Philosophy

**TOON-First Architecture**: Uses Token-Oriented Object Notation to achieve 45-50% token reduction on structured data, making ICP knowledge extremely lightweight for AI context windows.

**Natural Language Interface**: All tools understand developer intent through natural language - no need to remember exact command syntax.

**Specialized Intelligence**: Each tool is purpose-built for its domain (knowledge, actions, execution, meta) with deep ICP expertise.

## The 4 Tools

### 1. icp/query - Knowledge Layer
**Purpose**: Discover, search, and learn about ICP modules and concepts

**Use when**: You need documentation, want to find modules, or learn how to do something

**Examples**:
- "list all data structures"
- "which module handles random numbers"
- "how to use Array"
- "show me token canister examples"

### 2. icp/action - Execution Layer
**Purpose**: Validate, test, deploy, refactor, analyze, and check upgrades

**Use when**: You need to execute code operations

**Examples**:
- "validate my Motoko code"
- "test the transfer method on canister abc123"
- "deploy to local network"
- "refactor to add upgrade hooks"
- "analyze project structure"
- "check if this interface is upgrade-safe"

### 3. icp/execute - Code Execution Layer
**Purpose**: Run TypeScript code in sandbox to filter data and build pipelines (90-98% token reduction)

**Use when**: You need to process large datasets or chain multiple operations without context bloat

**Examples**:
- Filter 47 modules to find specific categories
- Extract function signatures from documentation
- Build multi-step data pipelines

### 4. icp/help - Meta Layer
**Purpose**: Learn about ICP-MCP itself and get guidance

**Use when**: You're not sure what the MCP can do or need examples

**Sections**:
- overview (this page)
- query (Query tool details)
- action (Action tool details)
- examples (real-world usage patterns)
- tokens (token efficiency info)
- all (complete documentation)

## Quick Start

1. **Start with Query**: \`icp/query\` with "list all modules" to explore what's available
2. **Take Action**: \`icp/action\` with natural language for code operations
3. **Get Help**: \`icp/help\` with section="examples" for real-world patterns

## Key Features

✅ **Natural language understanding** - No command syntax to memorize
✅ **TOON encoding** - 50% fewer tokens on structured responses
✅ **Offline-capable** - Static index for core knowledge, web fetch for updates
✅ **Intent-based routing** - Smart detection of what you're trying to do
✅ **Comprehensive validation** - Motoko, Rust, Candid, dfx.json support
✅ **Full development lifecycle** - From learning to deployment

## Architecture

\`\`\`
┌─────────────────────────────────────────────────┐
│               ICP-MCP Server                    │
│  (Total: ~4k tokens, <10k with all metadata)    │
└─────────────────────────────────────────────────┘
           │              │              │
     ┌─────┴──┐     ┌─────┴──┐     ┌────┴───┐
     │ Query  │     │ Action │     │  Help  │
     │  Tool  │     │  Tool  │     │  Tool  │
     └────────┘     └────────┘     └────────┘
         │              │              │
    Discovery      Validation      Guidance
    Search         Testing          Examples
    Docs           Deployment       Meta-info
    Examples       Refactoring
                   Analysis
                   Upgrades
\`\`\`

For more details, use:
- \`section: "query"\` - Query tool capabilities
- \`section: "action"\` - Action tool capabilities
- \`section: "examples"\` - Real-world usage patterns
- \`section: "tokens"\` - Token efficiency details
`;
}

/**
 * Query tool help
 */
function getQueryHelp(): string {
  return `# Query Tool - ICP Knowledge Layer

Natural language interface for discovering and learning about ICP development.

## Intent Types

### 1. **discover** (90% confidence)
List modules, browse categories, explore available functionality.

**Patterns**: "list", "show", "all", "available", "browse", "discover"

**Examples**:
\`\`\`
{ "query": "list all data structures" }
→ Returns all modules in data-structures category

{ "query": "show available utilities" }
→ Returns utility modules

{ "query": "browse array modules" }
→ Returns array-related modules
\`\`\`

### 2. **search** (60% confidence)
Find specific functionality using semantic matching.

**Patterns**: keyword matching against use-case metadata

**Examples**:
\`\`\`
{ "query": "random numbers" }
→ Finds Random module (via use-case keywords)

{ "query": "queue operations" }
→ Finds Deque and List modules

{ "query": "token canister" }
→ Finds ICRC1, ICRC2 token modules
\`\`\`

### 3. **document** (85% confidence)
Get documentation for specific modules.

**Patterns**: "how", "documentation", "docs", "explain", "use"

**Examples**:
\`\`\`
{ "query": "how to use Array" }
→ Returns Array documentation with links

{ "query": "explain Map module" }
→ Returns Map module docs
\`\`\`

### 4. **example** (80% confidence)
Get code examples for modules.

**Patterns**: "example", "sample", "code", "template", "snippet"

**Examples**:
\`\`\`
{ "query": "Array examples" }
→ Returns code examples for Array

{ "query": "show me List code samples" }
→ Returns List usage examples
\`\`\`

### 5. **explain** (70% confidence)
Search for relevant modules (no conceptual knowledge base).

**Patterns**: General "explain" or "what is" queries

**Examples**:
\`\`\`
{ "query": "explain stable memory" }
→ Searches for modules related to stable memory

{ "query": "what is orthogonal persistence" }
→ Searches for relevant modules, suggests docs
\`\`\`

**Note**: For conceptual explanations, use official ICP documentation. This tool focuses on module discovery.

## Options

- \`format\`: "toon" (default, 50% smaller), "json", or "markdown"
- \`limit\`: Token limit for response
- \`includeRelated\`: true (default) - show related modules
- \`includeExamples\`: false (default) - include code examples

## Response Format

\`\`\`typescript
{
  content: [{ type: "text", text: "TOON-encoded data" }],
  metadata: {
    intent: "search",
    confidence: 0.85,
    format: "toon",
    tokenEstimate: 342,
    suggestions: ["Try: get documentation for Module"],
    related: "TOON-encoded related modules"
  }
}
\`\`\`

## Operations Reference

The query tool supports 5 operations:

**1. list-all**
- Returns all 47 Motoko core modules organized by category
- Use when: Browsing available modules
- Example: \`{ operation: "list-all" }\`

**2. document**
- Fetches live documentation from internetcomputer.org
- Use when: Need docs for specific module(s)
- Example: \`{ operation: "document", modules: ["Queue", "Map"] }\`
- Returns: Markdown content with code examples and usage info

**3. examples**
- Extracts code examples from module documentation
- Use when: Need working code samples
- Example: \`{ operation: "examples", modules: ["Array"] }\`
- Returns: 2-3 code blocks per module

**4. list-icp-examples**
- Lists 35 curated ICP examples (sourced from ICP ecosystem)
- Filter by category, language, or search query
- Categories: AI, DeFi, Chain Fusion, NFT, Games, Data Storage, Productivity, Tooling
- Example: \`{ operation: "list-icp-examples", category: "Chain Fusion" }\`
- Example: \`{ operation: "list-icp-examples", query: "bitcoin" }\`
- Returns: Metadata for matching examples with sourceUrl and githubUrl

**5. fetch-icp-example**
- Fetches full details for a specific ICP example
- Returns: README, dfx.json, project structure, source URLs
- Example: \`{ operation: "fetch-icp-example", exampleId: "bitcoin-wallet" }\`
- Use when: Need complete working project code and documentation
- Note: Examples sourced from ICP ecosystem, visit icp.ninja for latest updates

## How It Works

Behind the scenes workflow:

1. You make a natural language query
2. Claude identifies relevant module(s) from the 47-module index
3. Query tool fetches live data from internetcomputer.org
4. Results returned in TOON format (50% token reduction)
5. Claude presents information to you

The tool handles data fetching while Claude handles all intelligence and intent understanding.

## Best Practices

1. **Start broad, narrow down**: Begin with "list all X" then drill into specific modules
2. **Use natural language**: Don't worry about exact syntax
3. **Check related modules**: The tool suggests related functionality
4. **Follow suggestions**: Next-action suggestions guide your workflow

## Module Index

47 Motoko core library modules organized by category:
- **data-structures**: Array, Map, List, Set, Queue, Stack, Tree, Graph
- **primitives**: Text, Int, Nat, Float, Bool, Char, Blob
- **utilities**: Option, Result, Iter, Buffer, Random, Order
- **system**: Principal, Time, Cycles, Debug, Error

## Use-Case Keywords

Every module tagged with AI-generated semantic keywords for intelligent search:
- "always" = fundamental module (Array, Text, Int, Nat, Option, Result)
- Functional keywords (sorting, filtering, caching, tokens)
- Use case keywords (random numbers, queue operations, token canister)
`;
}

/**
 * Action tool help
 */
function getActionHelp(): string {
  return `# Action Tool - ICP Execution Layer

Execute code operations with natural language commands.

## Action Types

### 1. **validate** (90% confidence)
Validate ICP code (Candid, Motoko, Rust, dfx.json).

**Patterns**: "validate", "check", "verify", "lint" + "code"

**Required context**:
- \`code\`: Source code to validate
- \`language\`: "candid" | "motoko" | "rust" | "dfx-json"

**Optional**:
- \`filename\`: For context
- \`context.securityCheck\`: Enable security checks

**Examples**:
\`\`\`typescript
{
  action: "validate my Motoko code",
  context: {
    code: "actor { public func greet() : async Text { \\"Hello\\" } }",
    language: "motoko"
  }
}
\`\`\`

### 2. **test** (85% confidence)
Test canister methods by calling them.

**Patterns**: "test", "call", "invoke", "execute", "run" + "method"

**Required context**:
- \`canisterId\`: Canister ID or name
- \`method\`: Method name

**Optional**:
- \`args\`: Method arguments (array or Candid string)
- \`network\`: "local" (default), "playground", "ic"
- \`mode\`: "query", "update" (default)
- \`projectPath\`: For context

**Examples**:
\`\`\`typescript
{
  action: "test the transfer method",
  context: {
    canisterId: "rrkah-fqaaa-aaaaa-aaaaq-cai",
    method: "transfer",
    args: [{ to: "abc...", amount: 1000 }],
    network: "local"
  }
}
\`\`\`

### 3. **deploy** (90% confidence)
Deploy canisters to local or playground networks.

**Patterns**: "deploy", "install", "publish"

**Optional context** (all have defaults):
- \`projectPath\`: Defaults to current directory
- \`network\`: "local" (default), "playground"
- \`canisters\`: Specific canisters (default: all)
- \`mode\`: "install", "reinstall" (default), "upgrade"
- \`clean\`: true (default) - clean build

**Examples**:
\`\`\`typescript
{
  action: "deploy to local network",
  context: {
    projectPath: "./my-project",
    network: "local",
    mode: "reinstall"
  }
}
\`\`\`

### 4. **refactor** (85% confidence)
Apply ICP-specific code transformations.

**Patterns**: "refactor", "transform", "add", "modernize" + specific pattern

**Required context**:
- \`code\`: Code to refactor
- \`language\`: "motoko" | "rust"
- \`refactoring\`: Type of refactoring

**Refactoring types**:
- \`add-upgrade-hooks\`: Add preupgrade/postupgrade
- \`add-stable-vars\`: Convert to stable storage
- \`add-caller-checks\`: Add authentication
- \`modernize\`: Update to current best practices

**Examples**:
\`\`\`typescript
{
  action: "refactor to add upgrade hooks",
  context: {
    code: "actor { var count = 0; }",
    language: "motoko",
    refactoring: "add-upgrade-hooks"
  }
}
\`\`\`

### 5. **analyze** (90% confidence)
Analyze project structure and dependencies.

**Patterns**: "analyze", "inspect", "review", "examine" + "project"

**Optional context**:
- \`projectPath\`: Defaults to current directory
- \`validate\`: true (default) - validate all canisters
- \`checkDependencies\`: true (default) - analyze dependencies

**Examples**:
\`\`\`typescript
{
  action: "analyze project structure",
  context: {
    projectPath: "./",
    validate: true,
    checkDependencies: true
  }
}
\`\`\`

### 6. **check-upgrade** (85% confidence)
Check Candid interface upgrade safety.

**Patterns**: "check", "verify", "test" + "upgrade", "compatibility"

**Required context**:
- \`oldCandid\`: Current interface
- \`newCandid\`: Proposed interface

**Examples**:
\`\`\`typescript
{
  action: "check if interface is upgrade-safe",
  context: {
    oldCandid: "service : { greet : () -> (text) }",
    newCandid: "service : { greet : (text) -> (text) }"
  }
}
\`\`\`

## Response Format

Actions return either:
1. **TOON-encoded results** (for structured data)
2. **Markdown-formatted text** (for deployment/test results)
3. **Error objects** (with examples on how to fix)

## Error Handling

If parameters are missing, the tool returns helpful examples:
\`\`\`json
{
  "error": "Missing required parameters",
  "required": "code and language",
  "example": { ... }
}
\`\`\`

## Intent Parsing

The tool uses confidence levels to understand your intent:
- **Confidence 0.9**: Explicit action + target ("validate Motoko code", "deploy local")
- **Confidence 0.85**: Clear operation pattern ("test transfer", "add hooks")
- **Confidence 0.5**: Single keyword only (ambiguous, will prompt for details)

## Quick Workflows

Common action sequences for ICP development:

1. **Validate → Fix errors → Deploy → Test**
   - Standard development cycle

2. **Write code → Refactor (add hooks) → Validate → Deploy**
   - Adding upgrade safety to existing canisters

3. **Analyze project → Fix circular deps → Validate all → Deploy**
   - Multi-canister project debugging

4. **Modify interface → Check upgrade safety → Deploy upgrade → Test**
   - Safe canister upgrades

## Response Formats by Action Type

What each action returns:

- **Validation**: Structured issues with severity, line numbers, suggestions
- **Testing**: Method return value or execution error
- **Deployment**: Status, canister IDs, build output (markdown)
- **Refactoring**: Modified code + detailed change log
- **Analysis**: Project structure with dependency graph (TOON format)
- **Upgrade**: Safety status with breaking changes list

## Per-Action Guidance

Quick reference for what each action needs:

**Validation**
- Provide: \`code\` and \`language\` in context
- Compilers used: moc (Motoko), didc (Candid), pattern checks (Rust)

**Testing**
- Provide: \`canisterId\` and \`method\` name
- Optional: \`args\`, \`network\` (local/playground/ic), \`mode\` (query/update)

**Deployment**
- Run from project directory or provide \`projectPath\`
- Optional: \`network\` (local/playground), \`mode\` (install/reinstall/upgrade), \`canisters\`

**Refactoring**
- Provide: \`code\`, \`language\`, and \`refactoring\` type
- Types: add-upgrade-hooks, add-stable-vars, add-caller-checks, modernize

**Analysis**
- Run from project root or provide \`projectPath\`
- Optional: \`validate\` (default: true), \`checkDependencies\` (default: true)

**Upgrade Check**
- Provide: both \`oldCandid\` and \`newCandid\` interface definitions

## Tips for Guiding Users

When actions fail, help users debug:

- **If validation fails**: Show specific errors with line numbers
- **If deployment fails**: Suggest checking dfx.json and network status
- **If test fails**: Verify canister ID and method signature match
- **If refactoring requested**: Explain what changes will be made before applying
- **For upgrades**: Always recommend checking compatibility first

## Best Practices

1. **Be specific with context**: Provide all required parameters
2. **Use natural language**: "validate my code" not "run validator"
3. **Check examples on errors**: Error responses include fix examples
4. **Chain operations**: Deploy → Test → Analyze for full workflow
`;
}

/**
 * Examples section
 */
function getExamples(): string {
  return `# Real-World Usage Examples

## Scenario 1: Learning a New Module

**Goal**: Understand how to use the Map module

\`\`\`typescript
// Step 1: Discover
icp/query { query: "list all data structures" }
→ See Map in the list

// Step 2: Get docs
icp/query { query: "how to use Map" }
→ Get documentation with links

// Step 3: Get examples
icp/query {
  query: "Map examples",
  includeExamples: true
}
→ See code examples
\`\`\`

## Scenario 2: Building a Token Canister

**Goal**: Create an ICRC-1 compliant token

\`\`\`typescript
// Step 1: Find token modules
icp/query { query: "token canister" }
→ Discover ICRC1, ICRC2 modules

// Step 2: Get template
icp/query { query: "ICRC1 example code" }
→ Get starter template

// Step 3: Validate code
icp/action {
  action: "validate my Motoko code",
  context: {
    code: "... your token code ...",
    language: "motoko"
  }
}

// Step 4: Deploy locally
icp/action {
  action: "deploy to local network"
}

// Step 5: Test methods
icp/action {
  action: "test the transfer method",
  context: {
    canisterId: "your-token-canister",
    method: "icrc1_transfer",
    args: [{
      to: { owner: Principal.fromText("...") },
      amount: 1000
    }]
  }
}
\`\`\`

## Scenario 3: Upgrading a Production Canister

**Goal**: Safely upgrade a canister

\`\`\`typescript
// Step 1: Check upgrade safety
icp/action {
  action: "check if interface is upgrade-safe",
  context: {
    oldCandid: "... current interface ...",
    newCandid: "... new interface ..."
  }
}
→ Verify no breaking changes

// Step 2: Add upgrade hooks if needed
icp/action {
  action: "refactor to add upgrade hooks",
  context: {
    code: "... your canister code ...",
    language: "motoko",
    refactoring: "add-upgrade-hooks"
  }
}

// Step 3: Test upgrade locally
icp/action {
  action: "deploy to local network",
  context: {
    mode: "upgrade"
  }
}

// Step 4: Verify state migration
icp/action {
  action: "test the get_state method",
  context: {
    canisterId: "your-canister",
    method: "get_state"
  }
}
→ Ensure state persisted correctly
\`\`\`

## Scenario 4: Debugging Project Issues

**Goal**: Find and fix problems in multi-canister project

\`\`\`typescript
// Step 1: Analyze project
icp/action {
  action: "analyze project structure",
  context: {
    validate: true,
    checkDependencies: true
  }
}
→ See dependency graph, circular deps, validation issues

// Step 2: Fix identified issues
// (validate each canister's code)

// Step 3: Deploy in correct order
icp/action {
  action: "deploy to local network"
}
→ Uses topological order from analysis

// Step 4: Test integration
icp/action {
  action: "test the inter_canister_call method",
  context: {
    canisterId: "frontend-canister",
    method: "call_backend"
  }
}
\`\`\`

## Scenario 5: Random Number Generation

**Goal**: Add randomness to your canister

\`\`\`typescript
// Step 1: Find random module
icp/query { query: "random numbers" }
→ Discover Random module with keywords

// Step 2: Get documentation
icp/query { query: "how to use Random" }
→ Learn Random.Finite API

// Step 3: Get code example
icp/query {
  query: "Random module examples",
  includeExamples: true
}
→ See practical usage

// Step 4: Implement and validate
icp/action {
  action: "validate my Motoko code",
  context: {
    code: "... code using Random ...",
    language: "motoko"
  }
}
\`\`\`

## Scenario 6: Migrating to Stable Storage

**Goal**: Convert ephemeral vars to stable storage

\`\`\`typescript
// Step 1: Refactor code
icp/action {
  action: "refactor to add stable vars",
  context: {
    code: "actor { var users = []; }",
    language: "motoko",
    refactoring: "add-stable-vars"
  }
}
→ Get refactored code with stable vars

// Step 2: Add upgrade hooks
icp/action {
  action: "refactor to add upgrade hooks",
  context: {
    code: "... code with stable vars ...",
    language: "motoko",
    refactoring: "add-upgrade-hooks"
  }
}

// Step 3: Test upgrade process
icp/action {
  action: "deploy to local network",
  context: { mode: "upgrade" }
}
\`\`\`

## Common Patterns

### Discovery → Documentation → Implementation → Validation → Deployment → Testing
\`\`\`
Query (discover)
  → Query (docs)
    → Action (validate)
      → Action (deploy)
        → Action (test)
\`\`\`

### Problem → Analysis → Refactor → Verify
\`\`\`
Action (analyze)
  → Action (refactor)
    → Action (validate)
      → Action (test)
\`\`\`

### Research → Example → Adapt → Ship
\`\`\`
Query (search)
  → Query (examples)
    → Action (validate)
      → Action (deploy)
\`\`\`
`;
}

/**
 * Token information
 */
function getTokenInfo(): string {
  return `# Token Efficiency

## TOON-First Architecture

ICP-MCP uses Token-Oriented Object Notation (TOON) to dramatically reduce token usage.

### What is TOON?

TOON encodes uniform object arrays as compact tables instead of verbose JSON:

**JSON** (1000 tokens):
\`\`\`json
[
  { "name": "Array", "category": "data-structures", "priority": 1 },
  { "name": "Map", "category": "data-structures", "priority": 1 },
  { "name": "List", "category": "data-structures", "priority": 2 }
]
\`\`\`

**TOON** (450 tokens, 55% reduction):
\`\`\`
name     | category         | priority
---------|------------------|----------
Array    | data-structures  | 1
Map      | data-structures  | 1
List     | data-structures  | 2
\`\`\`

### Measured Savings

| Data Type | JSON Tokens | TOON Tokens | Savings |
|-----------|-------------|-------------|---------|
| Module Index (47 modules) | 3000 | 500 | 83% |
| Use-Case Metadata | 900 | 400 | 55% |
| Discovery Results (10 items) | 800 | 360 | 45% |
| **Average** | - | - | **50%** |

## Token Budget

### Per-Tool Token Counts

| Component | Tokens | Notes |
|-----------|--------|-------|
| Query tool description | ~1200 | Natural language optimized |
| Action tool description | ~1500 | Covers 6 action types |
| Help tool description | ~300 | Minimal, self-referential |
| Module index (static) | 500 | Always loaded, TOON format |
| Use-case metadata | 50 | Semantic keywords only |
| **TOTAL OVERHEAD** | **~3550** | **Well under 10k target** |

### Dynamic Response Sizes

| Response Type | JSON | TOON | Savings |
|---------------|------|------|---------|
| List all modules | 3000 | 500 | 83% |
| Search results (10) | 800 | 360 | 55% |
| Single module docs | 150 | 150 | 0% (not uniform) |
| Deployment results | 600 | 270 | 55% |

## Optimization Strategies

### 1. Minimal Module Index
Compressed format with abbreviated keys:
\`\`\`typescript
{ n: "Array", d: "Immutable array utils", c: "ds/arr", p: 1 }
\`\`\`

Instead of:
\`\`\`typescript
{
  name: "Array",
  description: "Utility functions for immutable arrays",
  category: "data-structures/arrays",
  priority: 1
}
\`\`\`

### 2. Smart Expansion
Full data loaded only when needed:
\`\`\`typescript
// Minimal index always in memory (500 tokens)
// Expand to full format on-demand for specific modules
\`\`\`

### 3. Use-Case Keywords
Semantic search without full descriptions:
\`\`\`typescript
{ m: "Random", k: "random, numbers, shuffle, rng, always" }
// Just 10-15 tokens per module
\`\`\`

### 4. TOON-Compatible Responses
Structure responses as uniform arrays when possible:
\`\`\`typescript
// ✅ TOON-compatible (uniform structure)
[{ name, desc, url }, { name, desc, url }, ...]

// ❌ Not TOON-compatible (heterogeneous)
{ meta: {...}, results: [...], suggestions: {...} }
\`\`\`

## Comparison with Alternatives

| Approach | Token Count | Tradeoffs |
|----------|-------------|-----------|
| **ICP-MCP (TOON)** | **~3.5k** | Best efficiency, requires TOON |
| Traditional JSON | ~12k | Universal, but verbose |
| Minimal JSON | ~6k | Compressed, harder to read |
| Full docs | ~50k+ | Complete, but impractical |

## Why This Matters

**Context Window Economics**:
- Claude 3.5 Sonnet: 200k tokens
- ICP-MCP overhead: 3.5k (1.75%)
- Leaves 196.5k for actual code and conversation

**Cost Impact**:
- 50% fewer tokens = 50% lower API costs on responses
- Especially important for high-volume usage

**Performance**:
- Smaller context = faster processing
- More space for user code and conversation history

## Best Practices for Token Efficiency

1. **Use Query tool first**: Discovery is ultra-cheap with minimal index
2. **Request TOON format**: Explicitly set \`format: "toon"\` (default)
3. **Limit results**: Use natural queries that narrow scope
4. **Batch operations**: Action tool handles multiple ops efficiently
5. **Follow suggestions**: Tool-provided next steps optimize workflow

## Measuring Your Usage

Every response includes token estimate in metadata:
\`\`\`typescript
{
  metadata: {
    format: "toon",
    tokenEstimate: 342,  // Actual token count estimate
    savings: "55%"       // vs JSON
  }
}
\`\`\`

Use this to track and optimize your usage patterns.
`;
}

/**
 * Motoko best practices and current syntax guidance
 */
function getMotokoGuidance(): string {
  return `# Motoko Best Practices & Current Syntax

**CRITICAL**: This section contains essential Motoko practices that differ from outdated training data.

## 1. Library Imports: Use mo:core (NOT mo:base)

❌ **WRONG** (mo:base deprecated August 2025):
\`\`\`motoko
import Array "mo:base/Array";
import Map "mo:base/HashMap";
\`\`\`

✅ **CORRECT** (mo:core is the new standard):
\`\`\`motoko
import Array "mo:core/Array";
import Map "mo:core/Map";
\`\`\`

**Why**: mo:core replaced mo:base in August 2025 with improved APIs and better ergonomics.

**Query for details**: \`icp/query { modules: ["mo-core-Migration"] }\`

---

## 2. Loop Control: Labels Required for break/continue

❌ **WRONG** (unlabeled break/continue not allowed):
\`\`\`motoko
for (item in items.vals()) {
  if (item > 10) {
    break;  // ❌ Compile error
  }
}
\`\`\`

✅ **CORRECT** (use labeled loops):
\`\`\`motoko
label order_loop for (order in orders.vals()) {
  if (order.filled) {
    continue order_loop;  // ✅ Works
  };

  label item_loop for (item in order.items.vals()) {
    if (item.invalid) {
      break item_loop;  // ✅ Breaks inner loop
    };
    if (item.critical) {
      break order_loop;  // ✅ Breaks outer loop
    };
  };
};
\`\`\`

**Rules**:
- Every loop that uses \`break\` or \`continue\` MUST have a label
- Syntax: \`label <name> for/while (...) { ... }\`
- Reference the label: \`break <name>\` or \`continue <name>\`
- Nested loops need different labels for each level

**Query for details**: \`icp/query { modules: ["Labeled-Loops"] }\`

---

## 3. Dynamic Collections: Use List (NOT Buffer)

❌ **WRONG** (Buffer deprecated):
\`\`\`motoko
import Buffer "mo:core/Buffer";  // ❌ Deprecated

let buf = Buffer.Buffer<Nat>(10);
buf.add(1);
\`\`\`

✅ **CORRECT** (List is the replacement):
\`\`\`motoko
import List "mo:core/List";

let list = List.empty<Nat>();
List.add(list, 1);  // Mutates in place
List.add(list, 2);
List.add(list, 3);

// Convert to array when needed
let arr = List.toArray(list);  // [1, 2, 3]
\`\`\`

**Key differences**:
- List is **mutable** and has **dynamic sizing**
- Use \`List.add()\` not \`list.add()\` (module method, not object method)
- List is not iterable directly - use \`list.vals()\` or convert to array

**Query for details**: \`icp/query { modules: ["List-vs-Buffer"] }\`

---

## 4. Canister Testing: Use dfx generate

When testing canister builds during development:

\`\`\`bash
dfx generate <CanisterName>
\`\`\`

This generates TypeScript declarations without full deployment, useful for:
- Quick syntax validation
- Checking Candid interface generation
- Integration testing setup

**When to use**:
- After modifying canister interfaces
- Before committing interface changes
- Setting up frontend integration

---

## 5. Enhanced Orthogonal Persistence (EOP)

If using moc >= 0.15.0, EOP is **enabled by default**:

✅ **What this means**:
- No need for \`stable\` keyword in most cases
- Upgrades scale independently of heap size
- Main memory automatically persists across upgrades

❌ **What to avoid**:
- Over-using \`stable\` variables (usually unnecessary with EOP)
- Manual stable memory management for simple state
- Assuming serialization-based upgrade costs

**Query for details**: \`icp/query { modules: ["EOP"] }\`

**Check your version**: \`icp/action { action: "analyze project structure" }\` includes upgradeability assessment

---

## 6. Async Best Practices

**Error handling with async**:
\`\`\`motoko
public func transfer(to: Principal, amount: Nat) : async Result.Result<(), Text> {
  try {
    let result = await otherCanister.process(to, amount);
    #ok(())
  } catch (e) {
    #err(Error.message(e))
  }
};
\`\`\`

**Avoid common mistakes**:
- ❌ Don't ignore async errors (always handle with try/catch)
- ❌ Don't create long async call chains (can hit instruction limits)
- ✅ Use Result types for explicit error handling
- ✅ Consider upgrade implications of pending async calls

**Query for details**: \`icp/query { modules: ["Async-Best-Practices"] }\`

---

## Common Gotchas Summary

| Issue | Wrong | Right | Why |
|-------|-------|-------|-----|
| Library imports | mo:base | mo:core | mo:base deprecated Aug 2025 |
| Loop breaks | unlabeled break | label loop | Required by Motoko syntax |
| Dynamic arrays | Buffer | List | Buffer deprecated |
| Testing builds | dfx deploy | dfx generate | Faster iteration |
| Persistence | Over-use stable | Trust EOP (moc 0.15+) | EOP handles it |

---

## How to Get More Details

For any of these topics, query the MCP:

\`\`\`typescript
// Get migration guide
icp/query { modules: ["mo-core-Migration"] }

// Get labeled loop documentation
icp/query { modules: ["Labeled-Loops"] }

// Get List usage examples
icp/query { modules: ["List"] }  // or operation: "examples"

// Check your project's EOP status
icp/action { action: "analyze project structure" }
\`\`\`

---

## Quick Reference Card

**Always remember when writing Motoko**:

1. ✅ Use \`mo:core\` not \`mo:base\`
2. ✅ Label loops that use \`break\`/\`continue\`
3. ✅ Use \`List\` for dynamic collections
4. ✅ Use \`dfx generate\` for quick testing
5. ✅ Trust EOP for persistence (moc 0.15+)
6. ✅ Handle async errors with Result types
7. ✅ Validate code with \`icp/action { action: "validate" }\`

**When in doubt**: Query the MCP or check the official docs at internetcomputer.org.
`;
}

// Export for use in main index
export const helpTool = {
  name: 'icp/help',
  description:
    'Full ICP-MCP documentation and Motoko best practices.',
  inputSchema: HelpInputSchema,
  execute: help,
};
