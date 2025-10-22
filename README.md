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

Analyzes entire ICP project structure, dependencies, and optionally validates all canisters.

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
- Dependency graph and build order
- Circular dependency detection
- Optional validation of all canister code
- Project-level issues and warnings

**Use cases:**
- Understand multi-canister project architecture
- Detect dependency issues before deployment
- Validate entire project at once
- Get project overview and statistics

## Usage Pattern

The typical workflow for building ICP dapps:

```
1. AI queries relevant docs
   → icp/get-docs

2. AI reviews working examples
   → icp/get-example

3. AI generates code

4. AI validates iteratively
   → icp/validate (Candid)
   → icp/validate (Motoko)
   ↻ Fix issues, validate again

5. User reviews and deploys
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
├── tools/                # MCP tool implementations
│   ├── validate.ts       # Code validation
│   ├── get-docs.ts       # Documentation fetcher
│   └── get-example.ts    # Examples fetcher
├── validators/           # Language validators
│   ├── candid.ts         # didc integration
│   └── motoko.ts         # Pattern matching
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

**v0.4 - Complete! ✅** (Current)
- ✅ Project-level analysis tool
- ✅ Dependency graph analysis
- ✅ Multi-canister validation support
- ✅ Circular dependency detection
- ✅ Topological build order calculation

**v0.3 - Complete! ✅**
- ✅ Motoko compiler integration (moc)
- ✅ Full type-checking with error codes
- ✅ Import validation via dfx cache

**v0.2 - Complete! ✅**
- ✅ Rust validation (ic-cdk patterns)
- ✅ dfx.json validation
- ✅ dfx command guide tool
- ✅ Code templates tool

**Future:**
- Enhanced security pattern detection
- Canister upgrade safety checker
- Integration tests
- Performance metrics

## License

MIT

## Author

swissyp <swissy.crypto@gmail.com>

## Contributing

Issues and PRs welcome at https://github.com/swissyp/icp-mcp
