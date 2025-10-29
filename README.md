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
- `icp/action` - Validates, deploys, tests, refactors
- `icp/help` - Self-documentation

Agent handles intelligence (understanding intent, picking modules), we handle data fetching and code operations.

**Token Overhead**

[TOON encoding](https://github.com/johannschopplich/toon) reduces structured responses by 50-60%:

| Component | Tokens |
|-----------|--------|
| Query tool | 349 |
| Action tool | 1,269 |
| Help tool | 143 |
| Module index (TOON) | 568 |
| **Total** | **2,329** |

Module list in TOON: 568 tokens vs 1,575 JSON (64% reduction).

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
