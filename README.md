# IC-MCP

MCP server for ICP that gives Claude Code, Cursor, and other AI assistants real-time validation, discovery, and deployment tools.

## Install

```bash
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp
```

## Use

### Discovery

Ask about modules:
```
"What data structures does ICP have?"
"How do I handle random numbers?"
"Show me Map examples"
```

Agent picks relevant modules from the index, we fetch live documentation and code examples from internetcomputer.org.

### Validation

Catch errors before deployment:
```
"Validate this Motoko code: actor { public func greet() : async Text { \"Hello\" } }"
```

Uses moc compiler for Motoko, pattern checks for Rust, interface validation for Candid. Real compilation, not heuristics.

### Deployment

Ship to local or playground networks:
```
"Deploy this to local dfx network"
"Test the transfer method with 1000 tokens"
```

Handles dfx commands, manages identities, tests canister methods with proper Candid encoding.

### Refactoring

Modernize code automatically:
```
"Add upgrade hooks to this canister"
"Convert variables to stable storage"
"Add caller authentication"
```

Supports both Motoko and Rust. Tracks changes, shows exactly what was modified.

### Test Generation

Generate unit test scaffolding for Motoko code:
```
"Generate tests for this Counter module"
"Create comprehensive test coverage for the transfer function"
```

Follows mo:test patterns, extracts function signatures, generates test cases with proper assertions. Three coverage levels: minimal, standard, comprehensive.

## Workflow Example

Building a token canister:
```
"What modules do I need for a token canister?"
  → Agent picks: Map, Principal, Nat

"Show me Map examples"
  → We fetch live docs from internetcomputer.org

[Write implementation]

"Validate this Motoko code"
  → moc compiler checks, catch errors

"Deploy to local dfx network"
  → Automated deployment

"Test the transfer method with 1000 tokens to principal abc..."
  → Execute and verify
```

Five natural language commands from concept to deployed canister.

## Technical

**Architecture**

Three tools:
- `icp/query` - Fetches module list, documentation, code examples (44 modules indexed)
- `icp/action` - Validates, deploys, tests, refactors, generates test scaffolding
- `icp/help` - Self-documentation

Agent handles intelligence (understanding intent, picking modules), we handle data fetching and code operations.

**Token Overhead - Practical Usage**

When you add ICP-MCP to your Claude Code config, here's exactly what it costs:

| Component | Tokens | When Loaded |
|-----------|--------|-------------|
| Query tool description | 59 | Always (MCP available) |
| Action tool description | 74 | Always (MCP available) |
| Help tool description | 48 | Always (MCP available) |
| **Base Cost** | **181** | **Always loaded** |
| Module index (TOON) | 568 | Only when using `list-all` or help |
| Help responses | ~3,500 | Only when calling help (cached 5 min) |

**What this means for you:**
- **181 tokens** constant overhead when MCP is configured
- Module index (568 tokens) only loaded when you browse modules or request help
- Help documentation (~3,500 tokens) only loaded on-demand and cached
- [TOON encoding](https://github.com/johannschopplich/toon) reduces response sizes by 50-65%

**Optimization achieved**: 90% reduction from v0.9.3 (1,850 → 181 tokens base cost). Detailed docs moved to on-demand help responses.

**Query Operations**

Three simple operations:
- `list-all` - Return all 44 modules organized by category
- `document` - Fetch live docs from internetcomputer.org for specified modules
- `examples` - Extract code samples from documentation

**Validation**

Uses actual compilers, not pattern matching:
- Motoko: moc compiler with dependency resolution
- Candid: didc validator with subtype checking
- Rust: ic-cdk pattern analysis

**Module Index**

44 Motoko base library modules compressed (`n`, `d`, `c`, `p`) and expanded on-demand. All modules listed in tool description for agent to reference.

## Configuration

For Claude Desktop or similar clients, add to MCP config:

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

Config location varies by client:
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Cline/Continue: See client documentation

## Development

```bash
git clone https://github.com/swissyai/ic-mcp.git
cd ic-mcp
npm install
npm run build
npm test
```

## Reference

**Capabilities**
- 44 Motoko base library modules indexed
- Live documentation fetching from internetcomputer.org
- Real compiler validation (moc, didc)
- Candid interface compatibility checking
- Upgrade safety analysis
- Code refactoring (Motoko and Rust)
- Unit test generation (mo:test patterns)
- dfx deployment automation
- Method testing with Candid encoding

**Requirements**
- Node.js 18+
- dfx CLI (for deployment features)
- moc compiler (for Motoko validation)

**Links**
- [Internet Computer](https://internetcomputer.org)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [GitHub Repository](https://github.com/swissyai/ic-mcp)

MIT License
