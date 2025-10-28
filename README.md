# IC-MCP

MCP server that gives Claude Code, Cursor, and Codex real-time ICP validation and documentation.

## Quick Start (Claude Code CLI)

Add IC-MCP to Claude Code in one command:

```bash
# Project-specific (current project only)
claude mcp add --transport stdio ic-mcp -- npx -y ic-mcp

# Global (all projects)
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp
```

That's it! IC-MCP is now available in Claude Code. Skip to [Usage](#usage) to start using it.

---

Uses actual Motoko and Candid compilers (moc/didc) for production-grade validation, not pattern matching approximations.

**Context Usage:** ~3k tokens (adds 14 specialized ICP development tools to your AI assistant)

## Install

### Prerequisites

**Rust** (required for didc):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**dfx** (provides moc compiler):
```bash
sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
```

**didc** (Candid validation):
```bash
cargo install --git https://github.com/dfinity/candid.git didc
```

**Verify:**
```bash
dfx --version
didc --version
```

### Install IC-MCP

```bash
npm install -g ic-mcp
```

### Configure Your AI Assistant

**Claude Code (CLI):**

Use the built-in MCP manager:
```bash
# Add globally (recommended - available in all projects)
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp

# Or add to current project only
claude mcp add --transport stdio ic-mcp -- npx -y ic-mcp

# Verify connection
claude mcp list
```

**Claude Desktop App:**

Configuration file location (create if it doesn't exist):
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "icp": {
      "command": "ic-mcp"
    }
  }
}
```

**Cursor:**

Create `.cursor/mcp.json` in your project root:
```json
{
  "mcpServers": {
    "icp": {
      "command": "ic-mcp"
    }
  }
}
```

**Codex:**

Similar configuration to Cursor. Check Codex documentation for MCP config path.

**After configuration:** Restart your AI assistant.

### Recommended: GitHub Token

Documentation and example fetching uses GitHub API. Rate limits:
- **Without token:** 60 requests/hour (quickly exhausted with doc browsing)
- **With token:** 5000 requests/hour

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

Generate token at https://github.com/settings/tokens (requires `public_repo` scope)

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

## Usage

### Development Flow

```
1. Start new canister
   → Ask: "Create a Motoko canister with stable storage and upgrade hooks"
   → Tool: icp/template

2. Write code iteratively
   → Ask: "Validate this code" (paste your Motoko/Rust/Candid)
   → Tool: icp/validate
   → Get: Compiler errors, security warnings, fix suggestions

3. Analyze project structure
   → Ask: "Analyze this ICP project"
   → Tool: icp/analyze-project
   → Get: Dependencies, build order, canister details

4. Need examples or docs
   → Ask: "Show me HTTPS outcalls examples"
   → Tools: icp/get-example, icp/get-docs
   → Get: Working code and official documentation

5. Test locally
   → Ask: "Deploy this to local network and test the transfer function"
   → Tools: icp/test-deploy → icp/test-call
   → Get: Deployed canister IDs, test results

6. Optimize before mainnet
   → Ask: "Check performance and validate upgrade safety"
   → Tools: icp/speed, icp/check-upgrade
   → Get: Performance score, upgrade compatibility report
```

### Example Interactions

**Validate code:**
```
You: "Validate this Motoko code: actor { public func greet() : async Text { 'Hello' } }"
Assistant: Uses icp/validate
Returns: Type error at line 1 - Text literals use double quotes, with fix suggestion
```

**Multi-canister analysis:**
```
You: "Analyze this project and show me the build order"
Assistant: Uses icp/analyze-project
Returns: Canister list, dependency graph, topological build order, validation results
```

**Get current docs:**
```
You: "How do HTTPS outcalls work on ICP?"
Assistant: Uses icp/get-docs
Returns: Latest documentation from internetcomputer.org
```

## Features

**Live Validation:**
- Candid: `didc check` (full compiler validation)
- Motoko: `moc` compiler with type-checking (via dfx cache)
- Rust: Pattern-based ic-cdk validation + security checks
- dfx.json: Schema validation + circular dependency detection

**Rich Diagnostics:**
- ICP-specific explanations for every issue
- Code snippets showing how to fix
- Official documentation references
- Working examples demonstrating correct patterns
- 18 enhanced security and validation patterns

**Performance:**
- Content-based validation caching (10-100x faster repeated checks)
- Parallel multi-canister validation (3-5x faster)
- SHA-256 hash-based cache keys
- 15-minute cache TTL

**HTTPS Outcalls Validation:**
- Missing transform function detection (consensus safety)
- URL length validation (RFC-3986 limits)
- Response size constraints
- HTTP method restrictions
- Explicit cycles payment checks

## Configuration

**Optional: Log Level**

```bash
export LOG_LEVEL=info  # debug, info, warn, error
```

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
# Clone and setup
git clone https://github.com/swissyai/icp-mcp.git
cd icp-mcp
npm install

# Build
npm run build

# Test
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:integration  # Integration tests only

# Run in development
npm run dev
```

## Architecture

```
src/
├── index.ts              # MCP server entry point
├── tools/                # 12 MCP tool implementations
├── validators/           # Language validators (candid, motoko, rust, dfx.json)
├── analyzers/            # Project and dependency analysis
├── executors/            # dfx CLI wrapper
├── fetchers/             # GitHub API client for docs/examples
└── utils/                # Caching, logging
```

## Roadmap

**v0.6.0 (Current)**
- Rich validation diagnostics (18 enhanced patterns)
- HTTPS outcalls validation (transform functions, URL limits, cycle management)
- Content-based caching (10-100x speedup on repeated validations)
- Parallel multi-canister validation (3-5x speedup)
- Integration test suite (15 tests passing)

**v0.5.0**
- Testing suite (deploy, call, scenario)
- Upgrade safety checker
- Security pattern detection
- Smart refactoring tools
- Performance analysis

**Future**
- Auto-fix suggestions (ESLint-like)
- CI/CD integration examples
- Additional language support

## License

MIT

## Contributing

Issues and pull requests welcome at https://github.com/swissyai/icp-mcp

## Author

[@swissyai](https://x.com/swissyai)
