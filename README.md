# IC-MCP

MCP server for ICP that gives Claude Code, Cursor, and other AI assistants real-time validation, discovery, and deployment tools.

## Install

```bash
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp
```

## Use

### Discovery

Ask about what exists:
```
"What data structures does ICP have?"
"How do I handle random numbers?"
"Show me Map examples"
```

Returns modules, documentation, and working code. Semantic search understands intent - ask for "token canister" and get relevant modules (Map, Principal, Nat).

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
  → Map for balances, Principal for accounts, Nat for amounts

"Show me Map examples"
  → Documentation and working code

[Write implementation]

"Validate this Motoko code"
  → Compilation check, catch errors

"Deploy to local dfx network"
  → Automated deployment

"Test the transfer method with 1000 tokens to principal abc..."
  → Execute and verify
```

Five natural language commands from concept to deployed canister.

## Technical

**Architecture**

Three tools with natural language interfaces:
- `icp/query` - Discovery, documentation, examples (45 modules indexed)
- `icp/action` - Validation, deployment, testing, refactoring
- `icp/help` - Self-documentation

Intent parsing extracts actions from natural language. Confidence scoring routes requests. Parameter extraction handles developer descriptions.

**Token Efficiency**

[TOON encoding](https://github.com/johannschopplich/toon) reduces structured responses by 50-60%:

| Component | Tokens |
|-----------|--------|
| 3 tool descriptions | 481 |
| Module index | 568 |
| Use-case metadata | 1,449 |
| Semantic search data | 1,575 |
| **Total** | **4,073** |

Equivalent JSON representation: 12,000+ tokens. Module list: 568 vs 1,575 (64% reduction). Search results: 140 vs 364 (62% reduction).

**Validation**

Uses actual compilers, not pattern matching:
- Motoko: moc compiler with dependency resolution
- Candid: didc validator with subtype checking
- Rust: ic-cdk pattern analysis

**Module Index**

45 Motoko base library modules with AI-generated use-case keywords. Compressed storage (`n`, `d`, `c`, `p`) expands on-demand. Semantic search maps queries like "token canister" to relevant modules (Map, Principal, Nat).

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
- 45 Motoko base library modules indexed
- Natural language intent parsing with confidence scoring
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
