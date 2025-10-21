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

```bash
# Required: didc for Candid validation
cargo install --git https://github.com/dfinity/candid.git didc

# Verify installation
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
- Candid (via didc CLI)
- Motoko (pattern-based validation)
- Rust (coming soon)
- dfx.json (JSON schema)

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

**v0.2 (Week 2):**
- Rust validation (ic-cdk patterns)
- dfx command guide tool
- Code templates tool

**v0.3:**
- Motoko compiler integration (moc)
- Security pattern detection
- Upgrade safety checker

## License

MIT

## Author

swissyp <swissy.crypto@gmail.com>

## Contributing

Issues and PRs welcome at https://github.com/swissyp/icp-mcp
