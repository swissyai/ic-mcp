# ICP-MCP

Model Context Protocol server for Internet Computer development.

## What It Does

Makes AI coding assistants (Claude Code, Cursor, Windsurf) expert at building Internet Computer dapps by providing:

- **Live validation** - Iterative code checking for Candid, Motoko, Rust
- **Current documentation** - Real-time access to internetcomputer.org docs
- **Real examples** - Working code from dfinity/examples
- **Safe guidance** - Command templates with safety checks

## Installation

### Prerequisites

**Required:**
```bash
# dfx (includes moc compiler for Motoko validation)
sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"

# didc for Candid validation
cargo install --git https://github.com/dfinity/candid.git didc

# Verify installations
dfx --version
didc --version
```

### Install ICP-MCP

```bash
npm install -g icp-mcp
```

### Configure MCP Client

Add to your MCP client configuration (e.g., Claude Code):

```json
{
  "mcpServers": {
    "icp": {
      "command": "icp-mcp"
    }
  }
}
```

## Tools

### icp/validate

Validates ICP code with detailed error messages and suggestions.

**Supported languages:**
- **Candid** - Full validation via didc compiler
- **Motoko** - Full type-checking via moc compiler (requires dfx)
  - Supports multi-canister projects with `canister:` imports
  - Validates cross-canister dependencies automatically
- **Rust** - ic-cdk pattern checking (imports, attributes, security patterns)
- **dfx.json** - Schema validation and best practices

**Example:**
```typescript
{
  "code": "service : { greet : (text) -> (text) query }",
  "language": "candid"
}
```

**Returns:**
```json
{
  "valid": true,
  "issues": []
}
```

### icp/get-docs

Fetches documentation from dfinity/portal repository.

**Browse directory:**
```typescript
{
  "directory": "docs/building-apps"
}
```

**Fetch specific files:**
```typescript
{
  "paths": ["docs/building-apps/overview.mdx"]
}
```

### icp/get-example

Fetches code examples from dfinity/examples.

**List examples:**
```typescript
{
  "language": "motoko",
  "list": true
}
```

**Fetch specific example:**
```typescript
{
  "language": "motoko",
  "exampleName": "hello_world"
}
```

**Returns:** Complete example with source code, dfx.json, and README

### icp/dfx-guide

Generates safe dfx command templates with explanations.

**Example:**
```typescript
{
  "operation": "deploy",
  "network": "ic",
  "canister": "backend"
}
```

**Returns:** Command template with safety checks, prerequisites, and next steps

### icp/template

Generates boilerplate code for ICP projects.

**Example:**
```typescript
{
  "templateType": "motoko-canister",
  "name": "my_canister",
  "features": ["stable-vars", "upgrade-hooks"]
}
```

**Returns:** Complete project files ready to deploy

### icp/analyze-project

Analyzes complete ICP project structure from dfx.json, including all canisters, dependencies, and build order.

**Example:**
```typescript
{
  "projectPath": "/path/to/project",  // Optional, defaults to current directory
  "validate": true,                    // Optional, validate all canisters
  "checkDependencies": true            // Optional, analyze dependencies
}
```

**Returns:**
- All canisters with configurations
- Source file locations and line counts
- Dependency graph (explicit + implicit)
- Circular dependency detection
- Topological build order
- Optional validation results
- Project-level issues and warnings

### icp/test-deploy

Builds and deploys canisters to local replica or IC playground for testing.

**Example:**
```typescript
{
  "projectPath": ".",
  "network": "local",                  // local, playground
  "canisters": ["backend"],            // Optional, defaults to all
  "mode": "reinstall",                 // install, reinstall, upgrade
  "clean": true
}
```

**Returns:**
- Deployed canister IDs
- Network information
- Build/deployment times
- Success/failure status

### icp/test-call

Executes canister methods with automatic Candid encoding/decoding.

**Example:**
```typescript
{
  "canisterId": "ryjl3-tyaaa-aaaaa-aaaba-cai",
  "method": "transfer",
  "args": [{"to": "address", "amount": 1000}],
  "network": "local",                  // local, ic, playground
  "callType": "update"                 // query, update
}
```

**Returns:**
- Method result (decoded)
- Execution time
- Success/error status

### icp/test-scenario

Orchestrates multi-step test scenarios with state validation.

**Example:**
```typescript
{
  "projectPath": ".",
  "network": "local",
  "steps": [
    {
      "name": "Register user",
      "canisterId": "backend",
      "method": "register",
      "args": [{"username": "alice"}],
      "saveResult": "userId"
    },
    {
      "name": "Check balance",
      "canisterId": "ledger",
      "method": "balance",
      "args": ["{{userId}}"],          // Use saved result
      "expect": {"result": 0}
    }
  ],
  "continueOnFailure": false
}
```

**Returns:**
- Per-step results
- Pass/fail status
- Actual vs expected values
- Total execution time

### icp/check-upgrade

Validates canister upgrade safety by comparing Candid interfaces.

**Example:**
```typescript
{
  "oldCandid": "service : { balance : (principal) -> (nat) query }",
  "newCandid": "service : { balance : (principal) -> (nat64) query }"
}
```

**Returns:**
- Compatibility status
- Breaking changes detected
- Method signature changes
- Upgrade recommendations

### icp/refactor

Applies ICP-specific code transformations and refactorings.

**Example:**
```typescript
{
  "code": "actor { var counter = 0; }",
  "language": "motoko",
  "refactoring": "add-stable-vars"     // add-upgrade-hooks, add-stable-vars,
                                       // add-caller-checks, modernize
}
```

**Returns:**
- Refactored code
- Change summary
- Modified locations

### icp/speed

Analyzes canister performance for optimization opportunities.

**Example:**
```typescript
{
  "code": "actor { public func process() { ... } }",
  "language": "motoko",
  "focus": "full"                      // full, memory, cycles, latency
}
```

**Returns:**
- Performance score (0-100)
- Detected issues with severity
- Estimated impact
- Optimization suggestions
- Issue locations

## Usage Pattern

**Development workflow:**
```
1. Learn → icp/get-docs, icp/get-example
2. Generate → icp/template
3. Validate → icp/validate (iteratively)
4. Analyze → icp/analyze-project
5. Test → icp/test-deploy → icp/test-call → icp/test-scenario
6. Optimize → icp/speed, icp/refactor
7. Upgrade → icp/check-upgrade
```

## Development

```bash
# Clone repository
git clone https://github.com/swissyp/icp-mcp.git
cd icp-mcp

# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Clean
npm run clean
```

## Project Structure

```
src/
├── index.ts              # MCP server
├── tools/                # 12 MCP tool implementations
│   ├── validate.ts       # Code validation
│   ├── get-docs.ts       # Documentation fetcher
│   ├── get-example.ts    # Examples fetcher
│   ├── dfx-guide.ts      # Command templates
│   ├── template.ts       # Code scaffolding
│   ├── analyze-project.ts # Project analysis
│   ├── test-deploy.ts    # Deployment testing
│   ├── test-call.ts      # Method execution
│   ├── test-scenario.ts  # Multi-step tests
│   ├── check-upgrade.ts  # Upgrade safety
│   ├── refactor.ts       # Code transformations
│   └── speed.ts          # Performance analysis
├── validators/           # Language validators
│   ├── candid.ts         # didc integration
│   ├── motoko-compiler.ts # moc integration
│   ├── rust.ts           # ic-cdk patterns
│   ├── dfx-json.ts       # Config validation
│   ├── upgrade-checker.ts # Candid compatibility
│   └── security-patterns.ts # Security detection
├── analyzers/            # Project analysis
│   ├── project.ts        # Project structure
│   └── dependencies.ts   # Dependency graphs
├── executors/            # External tools
│   └── dfx-executor.ts   # dfx CLI wrapper
├── fetchers/             # Content fetchers
│   └── github.ts         # GitHub API client
└── utils/                # Utilities
    ├── cache.ts          # 15-min cache
    └── logger.ts         # Logging
```

## Configuration

Environment variables:

```bash
# Optional: GitHub token for higher rate limits (5000/hr vs 60/hr)
export GITHUB_TOKEN=your_token_here

# Optional: Log level (debug, info, warn, error)
export LOG_LEVEL=info
```

## Roadmap

**v0.5.0 - Complete! ✅** (Current)
- ✅ Testing suite (deploy, call, scenario)
- ✅ Upgrade safety checker
- ✅ Security pattern detection
- ✅ Smart refactoring tools
- ✅ Performance analysis
- ✅ 12 total tools available

**v0.4.0 - Complete! ✅**
- ✅ Project-level analysis
- ✅ Dependency graph analysis
- ✅ Multi-canister validation
- ✅ Circular dependency detection
- ✅ Topological build order

**v0.3.0 - Complete! ✅**
- ✅ Motoko compiler integration (moc)
- ✅ Full type-checking with error codes
- ✅ Import validation via dfx cache

**v0.2.0 - Complete! ✅**
- ✅ Rust validation (ic-cdk patterns)
- ✅ dfx.json validation
- ✅ dfx command guide
- ✅ Code templates

**Future:**
- Integration test suite
- Auto-fix suggestions (ESLint-like)
- Performance optimizations (parallel validation)
- HTTPS outcalls validation

## License

MIT

## Author

swissyp <swissy.crypto@gmail.com>

## Contributing

Issues and PRs welcome at https://github.com/swissyp/icp-mcp
