# IC-MCP

MCP server for ICP that gives Claude Code, Cursor, and other AI assistants real-time validation, discovery, and deployment tools with code execution for 90-98% token reduction.

## Install

```bash
claude mcp add --scope user --transport stdio ic-mcp -- npx -y ic-mcp
```

## Use

### Discovery

Ask about modules:
```
"What data structures does ICP have?"
"How do I handle random numbers?"
"Show me Map examples"
```

Agent picks relevant modules from the index, we fetch live documentation and code examples from internetcomputer.org.

### Validation

Catch errors before deployment:
```
"Validate this Motoko code: actor { public func greet() : async Text { \"Hello\" } }"
```

Uses moc compiler for Motoko, pattern checks for Rust, interface validation for Candid. Real compilation, not heuristics.

### Deployment

Ship to local or playground networks:
```
"Deploy this to local dfx network"
"Test the transfer method with 1000 tokens"
```

Handles dfx commands, manages identities, tests canister methods with proper Candid encoding.

### Refactoring

Modernize code automatically:
```
"Add upgrade hooks to this canister"
"Convert variables to stable storage"
"Add caller authentication"
```

Supports both Motoko and Rust. Tracks changes, shows exactly what was modified.

### Test Generation

Generate unit test scaffolding for Motoko code:
```
"Generate tests for this Counter module"
"Create comprehensive test coverage for the transfer function"
```

Follows mo:test patterns, extracts function signatures, generates test cases with proper assertions. Three coverage levels: minimal, standard, comprehensive.

## Workflow Example

Building a token canister:
```
"What modules do I need for a token canister?"
  → Agent picks: Map, Principal, Nat

"Show me Map examples"
  → We fetch live docs from internetcomputer.org

[Write implementation]

"Validate this Motoko code"
  → moc compiler checks, catch errors

"Deploy to local dfx network"
  → Automated deployment

"Test the transfer method with 1000 tokens to principal abc..."
  → Execute and verify
```

Five natural language commands from concept to deployed canister.

## Technical

**Architecture**

Four tools (code execution optimized):
- `icp/query` - Fetches module list, documentation, code examples (44 modules indexed, with filtering)
- `icp/action` - Validates, deploys, tests, refactors, generates test scaffolding
- `icp/execute` - Runs code in sandbox to filter data and build pipelines (90-98% token reduction)
- `icp/help` - Self-documentation

Agent handles intelligence (understanding intent, picking modules), we handle data fetching and code operations. Code execution moves data filtering into the sandbox environment, avoiding passing large intermediate results through the model.

**Token Overhead**

| Component | Tokens | When Loaded |
|-----------|--------|-------------|
| Query tool description | 59 | Always (MCP available) |
| Action tool description | 84 | Always (MCP available) |
| Execute tool description | 88 | Always (MCP available) |
| Help tool description | 48 | Always (MCP available) |
| **Base Cost** | **279** | **Always loaded** |
| Module index (TOON) | 568 | Only when using `list-all` or help |
| Help responses | ~3,500 | Only when calling help (cached 5 min) |

**Code Execution Token Savings** (new in v0.10.1):
- Traditional approach: Fetch 3 module docs → **2,250 tokens**
- With filtering: `filter: {mode: 'signatures-only'}` → **75 tokens** (96.7% reduction)
- With code execution: Process in sandbox → **40 tokens** (98.2% reduction)

See [CODE_EXECUTION_EXAMPLES.md](docs/CODE_EXECUTION_EXAMPLES.md) for real-world examples.

**Optimization strategies:**
1. Use `filter` parameter in queries to reduce data size
2. Use `icp/execute` for multi-step pipelines to avoid passing intermediate results through model
3. [TOON encoding](https://github.com/johannschopplich/toon) reduces response sizes by 50-65%

Based on [Anthropic's Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) patterns.

**Query Operations**

Three simple operations with optional filtering:
- `list-all` - Return all 44 modules organized by category
- `document` - Fetch live docs from internetcomputer.org for specified modules
  - Filter modes: `full` (default), `summary` (first paragraph), `signatures-only` (function signatures)
- `examples` - Extract code samples from documentation

**Code Execution**

Run TypeScript in sandbox with access to tools:
```javascript
// Example: Find modules with specific functions
const docs = await queryTool.execute({
  operation: 'document',
  modules: ['Array', 'Buffer'],
  filter: {mode: 'signatures-only'}
});

const hasFilter = docs.modules.filter(m =>
  m.content.includes('filter')
);

return hasFilter; // Only returns filtered results to model
```

Available in sandbox:
- `queryTool.execute(args)` - Call query tool
- `actionTool.execute(args)` - Call action tool
- `helpers.*` - Utilities (extractFunctionSignatures, filterByKeyword, etc.)

**Validation**

Uses actual compilers, not pattern matching:
- Motoko: moc compiler with dependency resolution
- Candid: didc validator with subtype checking
- Rust: ic-cdk pattern analysis

**Module Index**

44 Motoko base library modules compressed (`n`, `d`, `c`, `p`) and expanded on-demand. All modules listed in tool description for agent to reference.

## Configuration

For Claude Desktop or similar clients, add to MCP config:

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

Config location varies by client:
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Cline/Continue: See client documentation

## Development

```bash
git clone https://github.com/swissyai/ic-mcp.git
cd ic-mcp
npm install
npm run build
npm test
```

## Reference

**Capabilities**
- 44 Motoko base library modules indexed
- Live documentation fetching from internetcomputer.org
- Real compiler validation (moc, didc)
- Candid interface compatibility checking
- Upgrade safety analysis
- Code refactoring (Motoko and Rust)
- Unit test generation (mo:test patterns)
- dfx deployment automation
- Method testing with Candid encoding

**Requirements**
- Node.js 18+
- dfx CLI (for deployment features)
- moc compiler (for Motoko validation)

**Links**
- [Internet Computer](https://internetcomputer.org)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [GitHub Repository](https://github.com/swissyai/ic-mcp)

MIT License
