# IC-MCP

Real-time ICP validation in your AI assistant using actual Motoko and Candid compilers.

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

## Examples

**Building a DEX:**
```
You: "Create a swap canister with atomic transactions"
AI: Generates Motoko with stable vars, validates with moc compiler
You: "Deploy and test a swap"
AI: Deploys locally, calls swap method, shows results
```

**Debugging production issues:**
```
You: "Why is this canister using so many cycles?"
AI: Analyzes code, finds unbounded loops and large stable vars
You: "How do I fix it?"
AI: Shows refactored code with pagination and efficient data structures
```

**Upgrading safely:**
```
You: "Will this upgrade break existing clients?"
AI: Compares Candid interfaces, finds removed methods
You: "Add backward compatibility"
AI: Adds deprecated methods that proxy to new implementation
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

**Cursor:**
```json
// .cursor/mcp.json in project root
{
  "mcpServers": {
    "icp": {
      "command": "ic-mcp"
    }
  }
}
```

**Claude Desktop:**
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
// %APPDATA%\Claude\claude_desktop_config.json (Windows)
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

## Workflows

### Build → Validate → Deploy → Test

```bash
# 1. Generate boilerplate
"Create a Motoko token canister with stable storage"

# 2. Validate as you write
"Check this code: [paste code]"
# → Get exact compiler errors with line numbers

# 3. Deploy locally
"Deploy this project"
# → Returns canister IDs

# 4. Test methods
"Call transfer with (principal 'xxx', 100)"
# → See decoded results
```

### Debug Existing Projects

```bash
# Understand structure
"Analyze this ICP project"
# → Dependency graph, build order, line counts

# Check for issues
"Validate all canisters"
# → Compiler errors across entire project

# Performance analysis
"Find bottlenecks in this canister"
# → Memory leaks, cycle waste, slow operations
```

### Production Checklist

```bash
# Before upgrading
"Check if this interface breaks existing clients"
# → Candid compatibility report

# Security audit
"Add caller validation to public methods"
# → Automatic refactoring

# Performance optimization
"Analyze cycle usage"
# → Ranked list of expensive operations
```

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
