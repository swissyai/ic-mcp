# ICP-MCP

Model Context Protocol server that makes AI coding assistants expert at Internet Computer development.

## Overview

Integrates with Claude Code, Cursor, and Windsurf to provide real-time validation, documentation access, and ICP-specific guidance. Uses actual Motoko and Candid compilers for production-grade validation, not pattern matching approximations.

**Key capabilities:**
- Live validation with moc/didc compilers (Motoko, Candid, Rust, dfx.json)
- Real-time documentation from internetcomputer.org
- Working code examples from dfinity/examples
- Security pattern detection with ICP-specific explanations
- Multi-canister project analysis and testing
- Performance optimization suggestions

**v0.6.0 improvements:**
- Content-based validation caching (10-100x faster repeated checks)
- Parallel multi-canister validation (3-5x faster)
- 18 enhanced patterns with explanations, fix snippets, and documentation references
- HTTPS outcalls validation (transform functions, URL limits, cycle management)

## Quick Start

### Prerequisites

```bash
# Install dfx (provides moc compiler)
sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"

# Install didc for Candid validation
cargo install --git https://github.com/dfinity/candid.git didc

# Verify
dfx --version
didc --version
```

### Install

```bash
npm install -g icp-mcp
```

### Configure Your AI Assistant

**Claude Code** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "icp": {
      "command": "icp-mcp"
    }
  }
}
```

**Cursor** (`.cursor/mcp.json` in your project):
```json
{
  "mcpServers": {
    "icp": {
      "command": "icp-mcp"
    }
  }
}
```

**Windsurf** (similar to Cursor - check Windsurf docs for exact path).

Restart your AI assistant after configuration.

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

## Usage in Your Workflow

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

## Configuration

Optional environment variables:

```bash
# GitHub token for higher rate limits (5000/hr vs 60/hr)
export GITHUB_TOKEN=your_token_here

# Log level (debug, info, warn, error)
export LOG_LEVEL=info
```

## Development

```bash
# Clone and setup
git clone https://github.com/swissyp/icp-mcp.git
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

**Validation approach:**
- Candid: `didc check` (full compiler validation)
- Motoko: `moc` compiler with type-checking (via dfx cache)
- Rust: Pattern-based ic-cdk validation + security checks
- dfx.json: Schema validation + circular dependency detection

**Performance:**
- Content-based caching with SHA-256 hashing (15-min TTL)
- Parallel validation for multi-canister projects
- Cached documentation and examples

## Roadmap

**v0.6.0 (Current)**
- Rich validation diagnostics (18 enhanced patterns)
- HTTPS outcalls validation
- Content-based caching (10-100x speedup)
- Parallel validation (3-5x speedup)
- Integration test suite

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

Issues and pull requests welcome at https://github.com/swissyp/icp-mcp

## Author

swissyp <swissy.crypto@gmail.com>
