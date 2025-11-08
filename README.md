# IC-MCP

MCP server for Internet Computer development with module discovery, validation, deployment, refactoring, and test generation.

**Features:** 47 mo:core modules • Real compiler validation • Upgrade safety checks • Test generation • 90-98% token reduction

---

## Install

### Claude Code
```bash
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp
```

### Codex
```bash
codex mcp add ic-mcp -- npx -y ic-mcp
```

### Cursor
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

---

## Usage

### Find modules
```
"What modules handle token balances?"
"Show me HashMap examples"
```
Searches 47 mo:core modules + comprehensive internetcomputer.org documentation.

### Generate tests
```
"Generate tests for this Counter module"
```
Creates mo:test structure, extracts function signatures, minimal/standard/comprehensive coverage.

### Validate code
```
"Validate this Motoko code"
```
Uses moc compiler, not pattern matching. Immediate feedback instead of deploy-wait-error cycle.

### Check upgrade safety
```
"Is this refactor upgrade-safe?"
"Add upgrade hooks to this canister"
```
Analyzes Candid interface changes, prevents state loss from incompatible upgrades.

### Deploy and test
```
"Deploy to local dfx"
"Test the transfer method with 1000 tokens to principal xyz..."
```
Handles dfx commands, Candid encoding, identity management.

---

## Technical

| Tool | Purpose |
|------|---------|
| `icp/query` | Module search, docs, examples (47 mo:core + internetcomputer.org) |
| `icp/action` | Validate, deploy, test, refactor, generate tests |
| `icp/execute` | Sandbox for processing data, persistent workspaces (90-98% token reduction) |
| `icp/help` | Documentation |

**Validation:**
- Motoko: moc compiler with dependency resolution
- Candid: didc validator with subtype checking
- Rust: ic-cdk pattern analysis

**Requirements:** Node.js 18+ • dfx CLI • moc compiler

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
