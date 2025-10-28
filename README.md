# IC-MCP

MCP server for ICP that gives Claude Code, Cursor, and Codex real-time validation and documentation.

## Install

```bash
# Claude Code users - just run this:
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp
```

For Cursor/Codex setup or if you need the compilers, see [Full Setup](#full-setup).

## What It Does

Ask your AI assistant to:

```bash
# Validate code as you write
"Check this Motoko code: [paste code]"

# Get working examples
"Show me a token canister example"

# Deploy and test
"Deploy this project locally"
"Call the transfer method with (principal 'xxx', 100)"

# Analyze projects
"What's the dependency order for these canisters?"

# Optimize performance
"Find memory leaks in this canister"
```

## Example Workflows

```bash
# Build a DEX canister with validation
"Create a swap canister with atomic transactions"  # Generates Motoko, validates with moc
"Deploy and test a swap"                          # Deploys locally, executes test swap

# Debug performance issues
"Why is this canister using so many cycles?"      # Finds unbounded loops, large stable vars
"Refactor for better performance"                 # Applies optimizations, pagination

# Safe upgrades
"Check if this upgrade breaks clients"            # Compares Candid interfaces
"Add backward compatibility"                      # Generates compatibility layer
```

## Full Setup

### Prerequisites

IC-MCP validates code using real compilers. You'll need these installed:

```bash
# 1. Rust (for Candid compiler)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. dfx (for Motoko compiler)
sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"

# 3. didc (Candid validator)
cargo install --git https://github.com/dfinity/candid.git didc

# Verify
dfx --version && didc --version
```

### Add to Your Editor

**Claude Code:**
```bash
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp
```

**Other Editors (Cursor, Codex, etc):**
```json
// Add to your editor's MCP config:
{
  "mcpServers": {
    "icp": {
      "command": "ic-mcp"
    }
  }
}
```

Restart your editor after configuration.

### Optional: GitHub Token

For fetching docs and examples without rate limits:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

Get one at https://github.com/settings/tokens (needs `public_repo` scope).

## Tools

### Core Development

| Tool | Purpose | Example Use |
|------|---------|-------------|
| `icp/validate` | Validate Candid, Motoko, Rust, dfx.json | Iterative development with instant feedback |
| `icp/analyze-project` | Analyze multi-canister projects | Understand dependencies, build order, validate all canisters |
| `icp/get-docs` | Fetch internetcomputer.org documentation | Get current docs without leaving your editor |
| `icp/get-example` | Fetch working examples from dfinity/examples | See real implementations of patterns |
| `icp/template` | Generate canister boilerplate | Scaffold new Motoko/Rust canisters with best practices |

### Testing & Deployment

| Tool | Purpose | Example Use |
|------|---------|-------------|
| `icp/test-deploy` | Deploy to local/playground networks | Test multi-canister deployments with dependency ordering |
| `icp/test-call` | Execute canister methods | Call and test canister functions with Candid encoding |
| `icp/test-scenario` | Multi-step test orchestration | Run complex test flows with state validation |
| `icp/dfx-guide` | Generate safe dfx commands | Get command templates with safety checks |

### Quality & Optimization

| Tool | Purpose | Example Use |
|------|---------|-------------|
| `icp/check-upgrade` | Validate upgrade compatibility | Detect breaking Candid interface changes |
| `icp/refactor` | Apply ICP-specific transformations | Add upgrade hooks, stable vars, caller checks |
| `icp/speed` | Performance analysis | Find memory, cycle, and latency bottlenecks |

### Motoko Documentation

| Tool | Purpose | Example Use |
|------|---------|-------------|
| `icp/motoko-core` | Instant docs for Motoko core library | Query Array, Map, List module methods and examples |
| `icp/base-to-core-migration` | Migration guide from base to core | Find replacements for deprecated base library imports |


## Features

- **Live validation**: Real compilers (moc/didc), not regex patterns
- **Multi-canister analysis**: Dependency graphs, build order, circular reference detection
- **Performance analysis**: Memory usage, cycle costs, latency bottlenecks
- **Upgrade safety**: Candid interface compatibility checking
- **Caching**: Content-based caching for 10-100x speedup on repeated validations
- **HTTPS outcalls**: Transform function detection, URL length limits, cycle management
- **Security patterns**: Caller validation, trap safety, overflow checks


## Known Limitations

**Canister imports in standalone validation:**

Code with `canister:` imports cannot be validated in isolation with `icp/validate`:

```motoko
import Token "canister:token";  // Requires project context
```

**Workaround:** Use `icp/analyze-project` which resolves canister dependencies from dfx.json and validates all canisters with proper import context.

**Standard library imports work normally:**
```motoko
import Map "mo:core/Map";  // Works in icp/validate
```

## Development

```bash
git clone https://github.com/swissyai/icp-mcp.git
cd icp-mcp
npm install
npm test
npm run build
```

## Roadmap

**v0.8.0 (Current)**
- Migrated to Motoko core library
- Full validation diagnostics with fix suggestions
- HTTPS outcalls validation
- Content-based caching
- Parallel multi-canister validation

**Next**
- Auto-fix for common errors
- CI/CD integration
- Additional language support

## License

MIT

## Contributing

Issues and pull requests welcome at https://github.com/swissyai/icp-mcp

## Author

[@swissyai](https://x.com/swissyai)
