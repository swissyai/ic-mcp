# IC-MCP

MCP server for ICP that gives Claude Code, Cursor, and other AI assistants real-time validation, natural language discovery, and deployment tools.

## One-Liner

Natural language interface to ICP development with 3 unified tools and 50-60% token reduction through TOON encoding.

## Quick Install

```bash
# For Claude Code
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp

# Or manual global install
npm install -g ic-mcp
```

## Getting Started

### Quick Wins (Try These First)

**Discover what's available:**
```
Ask Claude: "What data structures does ICP have?"
```
IC-MCP returns all data structures (Array, Map, List, Set, etc.) with descriptions.

**Learn about a module:**
```
Ask Claude: "How do I use the Array module in Motoko?"
```
Get documentation, examples, and links to full docs.

**Validate your code:**
```
Ask Claude: "Validate this Motoko code: actor { public func greet() : async Text { \"Hello\" } }"
```
Instant validation with the moc compiler - catch errors before deploying.

### Complete Workflow Example

**Building a Token Canister (5 minutes)**

1. **Discover** what you need:
   ```
   Ask: "What modules do I need for a token canister?"
   ```
   → IC-MCP suggests Map for balances, Nat for amounts, Principal for accounts

2. **Get documentation**:
   ```
   Ask: "Show me how to use HashMap"
   ```
   → Full docs with examples

3. **Write your code** (Claude can help with this)

4. **Validate** before deploying:
   ```
   Ask: "Validate my Motoko canister code"
   ```
   → Catch errors early

5. **Deploy** to local network:
   ```
   Ask: "Deploy this to local dfx network"
   ```
   → IC-MCP runs dfx deploy for you

**That's the full development cycle with natural language.**

## What It Does

IC-MCP gives your AI assistant comprehensive ICP development capabilities through three intelligent tools:

- **icp/query** - Discover modules, search functionality, get documentation and examples
- **icp/action** - Validate code, test methods, deploy canisters, refactor, analyze projects
- **icp/help** - Learn about IC-MCP capabilities and usage patterns

## The 3-Tool Architecture

### icp/query - Knowledge Layer

Natural language interface for discovering and learning about ICP modules.

```typescript
// Discover all data structures
{ query: "list all data structures" }

// Find specific functionality
{ query: "random numbers" }

// Get documentation
{ query: "how to use Array" }

// Get code examples
{ query: "Map examples" }
```

**Intent types**: discover, search, document, example, explain

**Semantic search**: AI-generated use-case keywords enable queries like "token canister" or "queue operations" to find relevant modules.

### icp/action - Execution Layer

Execute code operations with natural language commands.

```typescript
// Validate Motoko code
{
  action: "validate my Motoko code",
  context: {
    code: "actor { public func greet() : async Text { \"Hello\" } }",
    language: "motoko"
  }
}

// Deploy to local network
{
  action: "deploy to local network",
  context: { network: "local", mode: "reinstall" }
}

// Test canister method
{
  action: "test the transfer method",
  context: {
    canisterId: "rrkah-fqaaa-aaaaa-aaaaq-cai",
    method: "transfer",
    args: [{ to: "abc...", amount: 1000 }]
  }
}
```

**Action types**: validate, test, deploy, refactor, analyze, check-upgrade

**Parameter extraction**: Natural language parsing extracts intent and parameters from developer-friendly descriptions.

### icp/help - Meta Layer

Self-documentation and usage guidance.

```typescript
// Get overview
{ section: "overview" }

// Learn about specific tools
{ section: "query" }
{ section: "action" }

// See real-world examples
{ section: "examples" }

// Understand token efficiency
{ section: "tokens" }
```

## Example Workflows

### Building a Token Canister

```typescript
// 1. Find relevant modules
icp/query { query: "token canister" }

// 2. Get starter code
icp/query { query: "ICRC1 example code" }

// 3. Validate implementation
icp/action {
  action: "validate my Motoko code",
  context: { code: "...", language: "motoko" }
}

// 4. Deploy locally
icp/action { action: "deploy to local network" }

// 5. Test transfer functionality
icp/action {
  action: "test the transfer method",
  context: {
    canisterId: "your-canister",
    method: "icrc1_transfer",
    args: [{ to: {...}, amount: 1000 }]
  }
}
```

### Safe Canister Upgrade

```typescript
// 1. Check interface compatibility
icp/action {
  action: "check if interface is upgrade-safe",
  context: {
    oldCandid: "service : { greet : () -> (text) }",
    newCandid: "service : { greet : (text) -> (text) }"
  }
}

// 2. Add upgrade hooks if needed
icp/action {
  action: "refactor to add upgrade hooks",
  context: {
    code: "...",
    language: "motoko",
    refactoring: "add-upgrade-hooks"
  }
}

// 3. Test upgrade process
icp/action {
  action: "deploy to local network",
  context: { mode: "upgrade" }
}
```

## Key Features

**Natural Language Understanding**
- Intent-based routing with confidence scoring
- Parameter extraction from developer descriptions
- No command syntax memorization required

**TOON Encoding**
- 50-60% token reduction on structured responses
- Module index: 568 tokens (TOON) vs 1,575 (JSON)
- Total overhead: 4,073 tokens vs 12,000+ with traditional JSON

**Comprehensive Validation**
- Motoko code validation via moc compiler
- Rust canister pattern checking
- Candid interface validation
- dfx.json configuration validation

**Full Development Lifecycle**
- Module discovery and documentation
- Code generation from templates
- Real-time validation
- Local and playground deployment
- Method testing with automatic Candid handling
- Performance analysis
- Upgrade safety checking

## Token Efficiency

| Component | Tokens | % of Budget |
|-----------|--------|-------------|
| Query tool description | 121 | 3.0% |
| Action tool description | 217 | 5.3% |
| Help tool description | 143 | 3.5% |
| Module index (TOON) | 568 | 13.9% |
| Use-case metadata | 1,449 | 35.6% |
| **Total Overhead** | **4,073** | **40.7%** |

**TOON vs JSON**:
- List all modules (45): 568 tokens (TOON) vs 1,575 (JSON) = 63.9% reduction
- Search results (10): 140 tokens (TOON) vs 364 (JSON) = 61.5% reduction

## Configuration

### Claude Code

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "ic-mcp": {
      "command": "npx",
      "args": ["-y", "ic-mcp"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ic-mcp": {
      "command": "npx",
      "args": ["-y", "ic-mcp"]
    }
  }
}
```

### Cline / Continue

```json
{
  "mcpServers": {
    "ic-mcp": {
      "command": "node",
      "args": ["/path/to/ic-mcp/dist/index.js"]
    }
  }
}
```

## How It Works

### Intent Parsing

Both Query and Action tools parse natural language to determine intent:

```typescript
// Query patterns
/\b(list|show|all)\b/ → discover (90% confidence)
/\b(how|explain|use)\b/ → document (85% confidence)
/\b(example|sample)\b/ → example (80% confidence)

// Action patterns
/\b(validate|check)\b.*\b(code)\b/ → validate (90% confidence)
/\b(test|call)\b.*\b(method)\b/ → test (85% confidence)
/\b(deploy|install)\b/ → deploy (90% confidence)
```

### TOON Encoding

Token-Oriented Object Notation encodes uniform object arrays as compact tables:

**Before (JSON - 1,575 tokens)**:
```json
[
  { "name": "Array", "category": "data-structures", "priority": 1 },
  { "name": "Map", "category": "data-structures", "priority": 1 },
  ...
]
```

**After (TOON - 568 tokens)**:
```
name  | category         | priority
------|------------------|----------
Array | data-structures  | 1
Map   | data-structures  | 1
...
```

### Module Index

45 Motoko base library modules organized by category:

- **Data structures**: Array, Map, List, Set, Queue, Stack, Deque, Trie, Heap, Graph
- **Primitives**: Text, Int, Nat, Float, Bool, Char, Blob, Principal
- **Utilities**: Option, Result, Iter, Buffer, Random, Order, Debug
- **System**: Time, Cycles, ExperimentalCycles, Error, CertifiedData

**Minimal format**: Compressed keys (`n`, `d`, `c`, `p`) expand on-demand to full module data with documentation links.

**Use-case keywords**: AI-generated semantic tags enable intelligent search. Query "random numbers" finds the Random module through keyword matching.

## Development

```bash
# Clone repository
git clone https://github.com/swissyai/ic-mcp.git
cd ic-mcp

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Measure token counts
npx tsx src/utils/measure-tokens.ts
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│            IC-MCP Server (4k tokens)            │
│  Natural Language → TOON-Optimized Responses    │
└─────────────────────────────────────────────────┘
           │              │              │
     ┌─────┴──┐     ┌─────┴──┐     ┌────┴───┐
     │ Query  │     │ Action │     │  Help  │
     └────────┘     └────────┘     └────────┘
         │              │              │
    Discovery      Validation      Guidance
    Search         Testing          Examples
    Docs           Deployment       Meta-info
                   Refactoring
                   Analysis
```

## Contributing

Contributions welcome. Open issues and pull requests on GitHub.

## License

MIT License

## Links

- [Internet Computer](https://internetcomputer.org)
- [Motoko Documentation](https://internetcomputer.org/docs/current/motoko/main/motoko)
- [dfx CLI Reference](https://internetcomputer.org/docs/current/developer-docs/developer-tools/cli-tools/cli-reference/)
- [Model Context Protocol](https://modelcontextprotocol.io)
