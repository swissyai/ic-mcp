# IC-MCP

MCP server for ICP that gives Claude Code, Cursor, and other AI assistants real-time validation, discovery, and deployment tools with code execution for 90-98% token reduction.

## Quick Start

**Claude Code**
```bash
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp
```

**Codex**
```bash
codex mcp add ic-mcp -- npx -y ic-mcp
```

**Cursor**
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

## Usage

**Find modules without leaving editor**
```
"What modules handle token balances?"
"Show me HashMap examples"
```
Searches 44 base library modules, fetches live docs from internetcomputer.org.

**Generate test scaffolding**
```
"Generate tests for this Counter module"
```
Creates mo:test structure, extracts function signatures, minimal/standard/comprehensive coverage.

**Catch errors before deployment**
```
"Validate this Motoko code"
```
Uses moc compiler, not pattern matching. Immediate feedback instead of deploy-wait-error cycle.

**Check upgrade safety**
```
"Is this refactor upgrade-safe?"
"Add upgrade hooks to this canister"
```
Analyzes Candid interface changes, prevents state loss from incompatible upgrades.

**Deploy and test**
```
"Deploy to local dfx"
"Test the transfer method with 1000 tokens to principal xyz..."
```
Handles dfx commands, Candid encoding, identity management.

## Technical

**Tools**
- `icp/query` - Module search, documentation, examples (44 modules indexed)
- `icp/action` - Validate, deploy, test, refactor, generate tests
- `icp/execute` - Run code in sandbox for data filtering (90-98% token reduction)
- `icp/help` - Documentation

**Validation**
- Motoko: moc compiler with dependency resolution
- Candid: didc validator with subtype checking
- Rust: ic-cdk pattern analysis

**Requirements**
- Node.js 18+
- dfx CLI (for deployment)
- moc compiler (for Motoko validation)

## Development

```bash
git clone https://github.com/swissyai/ic-mcp.git
cd ic-mcp
npm install
npm run build
npm test
```

## Links

- [Internet Computer](https://internetcomputer.org)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [GitHub Repository](https://github.com/swissyai/ic-mcp)

MIT License
