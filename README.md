# IC-MCP

MCP server for Internet Computer development that provides real-time validation, documentation, and testing tools to Claude, Cursor, and other AI assistants.

## Quick Install

```bash
# For Claude Desktop
npx @claudeai/mcp add ic-mcp

# Or manual install
npm install -g ic-mcp
```

## What It Does

IC-MCP gives your AI assistant deep knowledge of Internet Computer development:

- **Explore Motoko modules** - "What data structures are available in Motoko?"
- **Write validated code** - "Create a token canister with transfer function"
- **Test locally** - "Deploy this and call the transfer method"
- **Optimize performance** - "Why is this canister using so many cycles?"
- **Check upgrade safety** - "Will this upgrade break existing clients?"

## Example Conversations

### Building a DEX

```
You: "Create a swap canister for token trading"
AI: [Generates complete Motoko canister with atomic swaps, validates with compiler]

You: "Deploy it and test a swap"
AI: [Deploys locally, executes test swap, shows results]

You: "Add liquidity pool management"
AI: [Extends canister, validates compatibility, tests new methods]
```

### Debugging Performance

```
You: "This canister is slow, help me optimize it"
AI: [Analyzes code, finds unbounded loops and large stable variables]

You: "Fix the performance issues"
AI: [Refactors with pagination, optimized data structures, shows cycle savings]
```

### Learning Motoko

```
You: "How do I work with arrays in Motoko?"
AI: [Shows Array and VarArray modules, explains differences, provides examples]

You: "Show me the difference between Map and pure/Map"
AI: [Compares mutable vs immutable, with performance tradeoffs and use cases]
```

## Core Capabilities

### Module Discovery
- Browse all 45+ Motoko standard library modules
- Search by functionality ("find all queue implementations")
- Get documentation with examples and complexity analysis

### Code Generation
- Production-ready canister templates
- Official DFINITY examples
- Best practices and security patterns built-in

### Validation & Testing
- Real-time Motoko and Rust validation
- Candid interface checking
- Local deployment and method testing
- Multi-step scenario testing

### Optimization
- Performance bottleneck detection
- Cycle cost analysis
- Memory usage optimization
- Automated refactoring suggestions

### Deployment Safety
- Upgrade compatibility checking
- Breaking change detection
- Safe dfx command generation

## Prerequisites

For full functionality, install the IC development tools:

```bash
# Install DFX (includes Motoko compiler)
sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"

# Verify installation
dfx --version
```

## Configuration

### Claude Desktop

Add to your Claude configuration:

```json
{
  "mcpServers": {
    "ic-mcp": {
      "command": "npx",
      "args": ["ic-mcp"]
    }
  }
}
```

### Cursor/Other Editors

```json
{
  "mcpServers": {
    "ic-mcp": {
      "command": "ic-mcp",
      "args": [],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin"
      }
    }
  }
}
```

## Practical Examples

### Start a New Project

```
"Create a social media canister with posts and comments"
"Add user authentication with Internet Identity"
"Deploy and test the post creation"
```

### Migrate Legacy Code

```
"I have old code using base library, help me migrate"
"Update HashMap to the new Map module"
"Check if my upgrade is safe"
```

### Optimize Existing Canisters

```
"Analyze my canister for performance issues"
"Find memory leaks in stable variables"
"Reduce cycle consumption"
```

## Available Tools

The AI assistant has access to these specialized tools:

- **icp/discover** - Find and explore Motoko modules
- **icp/motoko-core** - Get detailed module documentation
- **icp/validate** - Check code for errors
- **icp/template** - Generate project scaffolding
- **icp/test-deploy** - Deploy canisters locally
- **icp/test-call** - Execute canister methods
- **icp/speed** - Analyze performance
- **icp/check-upgrade** - Validate upgrade safety

## Troubleshooting

### "Module not found"
The tool will suggest corrections for typos and point you to similar modules.

### "Validation failed"
Make sure DFX is installed: `dfx --version`

### "Deployment error"
Check that local replica is running: `dfx start --clean`

## Author

Created by [@swissyai](https://x.com/swissyai)

## Support

- Issues: [github.com/swissyai/ic-mcp/issues](https://github.com/swissyai/ic-mcp/issues)
- Documentation: [internetcomputer.org/docs](https://internetcomputer.org/docs)

## License

MIT