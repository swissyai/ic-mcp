# ICP-MCP: Product Requirements Document

**Version:** 1.0
**Created:** October 17, 2025
**Status:** Planning Complete - Ready for Implementation

---

## Executive Summary

Build a Model Context Protocol (MCP) server that enables AI coding assistants (Claude Code, Cursor, Windsurf, etc.) to build Internet Computer projects with expert-level knowledge and validation. The server provides live documentation, real code examples, multi-language validation, and smart guidance without executing commands directly.

**Philosophy:** Knowledge interface, not execution layer. We provide ICP expertise; the agent uses existing tools (bash, file ops) for execution.

---

## 1. Architecture Overview

### Tech Stack
- **Language:** TypeScript + Node.js
- **MCP SDK:** `@modelcontextprotocol/sdk` (official)
- **Package Name:** `@dfinity/icp-mcp` or `icp-mcp`
- **Deployment:** Local npm package (v1.0), remote endpoint (future)

### Project Structure
```
icp-mcp/
├── src/
│   ├── index.ts                    # MCP server initialization
│   ├── tools/                      # MCP tool implementations
│   │   ├── list-topics.ts          # Documentation discovery
│   │   ├── get-docs.ts             # Fetch ICP docs
│   │   ├── get-example.ts          # GitHub examples fetcher
│   │   ├── validate.ts             # Multi-language validator
│   │   ├── dfx-guide.ts            # Command template generator
│   │   └── template.ts             # Code scaffolding
│   ├── validators/                 # Language-specific validators
│   │   ├── candid.ts               # Uses didc CLI
│   │   ├── motoko.ts               # Uses moc or patterns
│   │   ├── rust.ts                 # ic-cdk pattern checks
│   │   └── dfx-json.ts             # JSON schema validation
│   ├── fetchers/                   # Content retrieval
│   │   ├── docs-fetcher.ts         # Scrapes internetcomputer.org
│   │   └── examples-fetcher.ts     # GitHub API wrapper
│   ├── templates/                  # Boilerplate generators
│   │   ├── motoko/
│   │   ├── rust/
│   │   └── dfx-configs/
│   └── utils/
│       ├── cache.ts                # 15-min cache layer
│       └── markdown-converter.ts   # HTML → Markdown
├── tests/
│   ├── integration/
│   └── unit/
├── examples/
│   └── AGENTS.md                   # Example usage for projects
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

---

## 2. MCP Tools Specification

### 2.1 Tool: `icp/list-topics`

**Purpose:** Discover available ICP documentation topics

**Input Schema:**
```typescript
{
  category?: 'all' | 'motoko' | 'rust' | 'candid' | 'dfx' | 'frontend' | 'security'
}
```

**Output:**
```typescript
{
  topics: [
    {
      id: 'motoko-language',
      title: 'Motoko Language Guide',
      category: 'motoko',
      use_cases: ['actor patterns', 'stable memory', 'async programming'],
      sections: ['fundamentals', 'icp-features', 'tooling', 'references'],
      url: 'https://internetcomputer.org/docs/motoko/home'
    },
    // ... more topics
  ]
}
```

**Documentation Categories:**
- **Motoko:** Language syntax, actors, stable memory, async, type system
- **Rust CDK:** ic-cdk usage, security patterns, best practices
- **Candid:** Interface design, type mappings, serialization
- **DFX CLI:** Commands, deployment, identity management, cycles
- **Frontend:** agent-js integration, authentication, wallet connect
- **Cycles:** Management, costs, wallet operations
- **Security:** Best practices, audit checklist, vulnerability patterns
- **Tutorials:** Quickstart, developer journey, examples

**Implementation:** Hardcoded metadata structure (Week 1), dynamic scraping (future)

---

### 2.2 Tool: `icp/get-docs`

**Purpose:** Fetch documentation content from internetcomputer.org

**Input Schema:**
```typescript
{
  topics: string[],        // Topic IDs from list-topics
  sections?: string[],     // Optional specific sections
  format?: 'markdown' | 'text'
}
```

**Output:**
```typescript
{
  docs: [
    {
      topic: 'motoko-language',
      section: 'fundamentals',
      content: '# Motoko Fundamentals\n\n...',
      url: 'https://internetcomputer.org/docs/motoko/...',
      lastFetched: '2025-10-17T12:00:00Z'
    }
  ]
}
```

**Implementation Details:**
- Web scraping with `cheerio` or `jsdom`
- HTML → Markdown conversion with `turndown`
- Smart chunking to respect context limits
- 15-minute cache layer (similar to WebFetch pattern)
- Graceful degradation if pages change structure

**Sources:**
- `internetcomputer.org/docs/motoko/`
- `internetcomputer.org/docs/building-apps/`
- `internetcomputer.org/docs/references/`
- `internetcomputer.org/docs/current/developer-docs/`

---

### 2.3 Tool: `icp/get-example`

**Purpose:** Fetch real code from github.com/dfinity/examples

**Input Schema:**
```typescript
{
  language?: 'motoko' | 'rust' | 'c',
  frontend?: 'svelte' | 'react' | 'vanilla',
  category?: 'basic' | 'defi' | 'nft' | 'dao' | 'all',
  search?: string  // Search by keyword
}
```

**Output:**
```typescript
{
  examples: [
    {
      name: 'hello',
      language: 'motoko',
      path: 'motoko/hello',
      description: 'Simple hello world canister',
      files: {
        'src/hello/main.mo': '// Motoko code...',
        'src/hello_backend/hello.did': 'service : {...}',
        'dfx.json': '{...}'
      },
      readme: '# Hello Example\n\n...',
      url: 'https://github.com/dfinity/examples/tree/master/motoko/hello'
    }
  ]
}
```

**Implementation Details:**
- GitHub REST API via `@octokit/rest`
- Navigate tree structure by language/framework
- Fetch relevant files (source, config, Candid)
- Include README for context
- Cache popular examples

**Example Categories (from dfinity/examples):**
- `motoko/` - Basic examples, actor patterns, upgrades
- `rust/` - basic-bitcoin, CDK examples, security patterns
- `svelte/` - Frontend integration examples
- `native-apps/` - Unity integration, native apps

---

### 2.4 Tool: `icp/validate` (THE KEY TOOL)

**Purpose:** Multi-language code validator with iterative feedback

**Input Schema:**
```typescript
{
  code: string,
  language: 'motoko' | 'rust' | 'candid' | 'dfx-json',
  filename?: string,
  context?: {
    projectType?: string,
    hasStableVars?: boolean
  }
}
```

**Output:**
```typescript
{
  valid: boolean,
  issues: [
    {
      severity: 'error' | 'warning' | 'info',
      line?: number,
      column?: number,
      message: 'Missing #[update] attribute on update method',
      suggestion: 'Add #[update] before the function definition',
      code: 'IC_RUST_001',
      docUrl?: 'https://internetcomputer.org/docs/...'
    }
  ],
  suggestions: [
    'Consider using stable variables for data persistence',
    'Add error handling for this canister call'
  ]
}
```

#### 2.4a Candid Validation
**Tool:** `didc` (Candid CLI)
**Method:** Subprocess call: `didc check <file.did>`

**Validations:**
- Syntax correctness
- Type consistency
- Service interface design
- Principal types usage

**Error Parsing:**
```typescript
// Parse didc output into friendly format
// Example: "error: unknown type Nat64" → structured error
```

#### 2.4b Motoko Validation
**Tool:** `moc --check` (optional) or regex patterns

**Pattern Checks:**
- Actor structure: `actor { ... }`
- Stable variables: `stable var x = ...;`
- Async patterns: `async { ... }` usage
- Shared functions: `shared func` vs `public func`
- Import statements validity

**Common Issues Detected:**
- Missing stable vars before upgrade
- Shared function without shared keyword
- Incorrect async/await usage
- Type mismatches in actor interfaces
- Missing error handling

**Implementation:** Start with regex patterns (Week 1), add moc integration (Week 2)

#### 2.4c Rust Validation
**Tool:** Pattern matching + ic-cdk checks

**Validations:**
- Required imports: `use ic_cdk::*;`
- Attribute macros: `#[update]`, `#[query]`, `#[init]`, `#[pre_upgrade]`, `#[post_upgrade]`
- State management: `RefCell` or `Cell` for shared state
- Security patterns: CallerGuard, journaling
- Candid export: `ic_cdk::export_candid!();`

**Security Checks (from docs):**
- CallerGuard pattern for locks
- Journaling for critical operations
- Proper Drop implementation
- No panics in production code

#### 2.4d dfx.json Validation
**Tool:** JSON schema validation + custom rules

**Schema Checks:**
- Required fields: `canisters`, `version`, `dfx`
- Canister config: `type`, `main`, `candid`
- Network configs: `local`, `ic`, custom
- Build settings: `packtool`, `args`, `env`

**Custom Validations:**
- Consistent canister naming
- Valid file paths
- Proper network configuration
- Cycles settings for mainnet

---

### 2.5 Tool: `icp/dfx-guide`

**Purpose:** Generate dfx command templates with explanations and safety checks

**Input Schema:**
```typescript
{
  operation: 'deploy' | 'identity' | 'canister' | 'cycles' | 'build',
  params: {
    network?: 'local' | 'ic' | 'playground',
    canister?: string,
    method?: string,
    args?: string,
    // ... operation-specific params
  }
}
```

**Output:**
```typescript
{
  command: 'dfx deploy --network ic backend',
  explanation: 'Deploys the backend canister to the mainnet',
  safetyChecks: [
    '⚠️  Deploying to MAINNET - costs cycles',
    '✓ Ensure you have sufficient cycles in your wallet',
    '✓ Review code thoroughly before deploying',
    '✓ Consider testing on playground first'
  ],
  alternatives: [
    'dfx deploy --network playground backend  # Test first',
    'dfx canister install --mode upgrade ...   # If already deployed'
  ],
  nextSteps: [
    'Check deployment: dfx canister status backend --network ic',
    'Get canister ID: dfx canister id backend --network ic'
  ],
  docUrl: 'https://internetcomputer.org/docs/references/cli-reference/dfx-deploy'
}
```

**Operations Supported:**

**Deploy:**
- `dfx deploy [--network <network>] [canister]`
- Network flags, upgrade vs install
- Cycles warnings

**Identity:**
- `dfx identity new <name>`
- `dfx identity use <name>`
- `dfx identity get-principal`
- PEM file management warnings

**Canister:**
- `dfx canister install/upgrade`
- `dfx canister call <canister> <method> '(args)'`
- `dfx canister status <canister>`
- `dfx canister delete <canister>`

**Cycles:**
- `dfx canister deposit-cycles <amount> <canister>`
- `dfx wallet balance`
- Cost estimation guidance

**Build:**
- `dfx build [canister]`
- Declaration generation
- Artifact locations

**Implementation:** Template-based with dynamic parameter injection + safety rule engine

---

### 2.6 Tool: `icp/template`

**Purpose:** Generate boilerplate code for ICP projects

**Input Schema:**
```typescript
{
  templateType: 'motoko-canister' | 'rust-canister' | 'frontend' | 'full-project' | 'candid',
  config: {
    name: string,
    features?: string[],  // ['stable-vars', 'http-outcalls', 'timer']
    frontend?: 'svelte' | 'react' | 'vanilla'
  }
}
```

**Output:**
```typescript
{
  files: {
    'src/backend/main.mo': '// Generated Motoko code...',
    'src/backend/backend.did': 'service : {...}',
    'dfx.json': '{...}',
    'README.md': '# Project Setup\n\n...'
  },
  instructions: [
    '1. Review generated files',
    '2. Customize business logic in src/backend/main.mo',
    '3. Run dfx start --clean',
    '4. Deploy with dfx deploy'
  ]
}
```

**Templates:**

**Motoko Canister:**
```motoko
actor {
  stable var counter : Nat = 0;

  public query func get() : async Nat {
    counter
  };

  public func increment() : async () {
    counter += 1;
  };
}
```

**Rust Canister:**
```rust
use ic_cdk::*;
use std::cell::RefCell;

thread_local! {
    static COUNTER: RefCell<u64> = RefCell::new(0);
}

#[query]
fn get() -> u64 {
    COUNTER.with(|c| *c.borrow())
}

#[update]
fn increment() {
    COUNTER.with(|c| *c.borrow_mut() += 1);
}

ic_cdk::export_candid!();
```

**dfx.json:**
```json
{
  "canisters": {
    "backend": {
      "type": "motoko",
      "main": "src/backend/main.mo",
      "candid": "src/backend/backend.did"
    }
  },
  "defaults": {
    "build": {
      "args": "",
      "packtool": ""
    }
  },
  "networks": {
    "local": {
      "bind": "127.0.0.1:4943",
      "type": "ephemeral"
    }
  },
  "version": 1
}
```

---

## 3. User Workflow Pattern

### Example: "Build a token canister"

```
1. User: "Build a token canister in Motoko"

2. Agent calls: icp/list-topics
   → Identifies: motoko-language, ledger, candid

3. Agent calls: icp/get-docs(['motoko-language', 'ledger'])
   → Receives: Actor patterns, ledger standards

4. Agent calls: icp/get-example({language: 'motoko', search: 'token'})
   → Receives: Token example code from dfinity/examples

5. Agent generates code (main.mo, token.did, dfx.json)

6. Agent calls: icp/validate (Motoko code)
   → Issues: [Missing stable var, incorrect async pattern]

7. Agent fixes issues, calls: icp/validate again
   → Valid: true ✓

8. Agent calls: icp/validate (Candid interface)
   → Valid: true ✓

9. Agent calls: icp/validate (dfx.json)
   → Valid: true ✓

10. Agent calls: icp/dfx-guide({operation: 'deploy', network: 'local'})
    → Returns: Command template + safety checks

11. Agent presents commands to user

12. User executes via bash (Claude Code's Bash tool)
```

**Key Pattern:** Iterative validation loop until all issues resolved, then safe command generation.

---

## 4. Implementation Plan

### Week 1: Core + High Value (MVP)

**Day 1-2: Project Setup**
- [ ] Initialize TypeScript project with MCP SDK
- [ ] Configure tsconfig, package.json
- [ ] Setup basic MCP server structure
- [ ] Add dependencies (cheerio, turndown, octokit, zod)
- [ ] Create project structure (folders)

**Day 3: Documentation Tools**
- [ ] Implement `icp/list-topics` with hardcoded metadata
- [ ] Implement `icp/get-docs` basic scraper
  - Focus on Motoko docs first
  - HTML → Markdown conversion
  - Basic caching

**Day 4: Examples Tool**
- [ ] Implement `icp/get-example`
- [ ] GitHub API integration (@octokit/rest)
- [ ] Navigate dfinity/examples structure
- [ ] Fetch and format example files

**Day 5: Basic Validation**
- [ ] Implement Candid validation (didc integration)
- [ ] Subprocess execution for didc
- [ ] Error parsing and formatting
- [ ] Basic testing

**Day 6-7: Testing & Documentation**
- [ ] Integration tests for Week 1 tools
- [ ] README.md (dev-focused, no fluff)
- [ ] Basic usage examples
- [ ] Test with Claude Code

**Week 1 Deliverable:** Working MCP server with docs, examples, and Candid validation

---

### Week 2: Complete Validation + Polish (v1.0)

**Day 8-9: Motoko Validation**
- [ ] Pattern-based validation (regex)
- [ ] Common antipattern detection
- [ ] Optional: moc --check integration
- [ ] Error message formatting

**Day 10-11: Rust Validation**
- [ ] ic-cdk pattern checking
- [ ] Attribute validation (#[update], #[query])
- [ ] Security pattern detection
- [ ] Best practices checks

**Day 12: dfx.json + dfx-guide**
- [ ] JSON schema validation
- [ ] Custom validation rules
- [ ] Implement `icp/dfx-guide`
- [ ] Command templates for all operations

**Day 13: Templates**
- [ ] Implement `icp/template`
- [ ] Motoko canister templates
- [ ] Rust canister templates
- [ ] dfx.json templates
- [ ] Full project scaffolding

**Day 14: Launch Prep**
- [ ] Complete test coverage
- [ ] AGENTS.md usage example
- [ ] Polish README
- [ ] Prepare npm publish
- [ ] Create announcement materials

**Week 2 Deliverable:** v1.0 launch-ready with all 6 tools

---

## 5. Technical Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.x.x",
    "cheerio": "^1.0.0",
    "turndown": "^7.1.0",
    "@octokit/rest": "^20.0.0",
    "zod": "^3.22.0",
    "node-fetch": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0",
    "prettier": "^3.1.0",
    "eslint": "^8.56.0"
  }
}
```

### External Tools (subprocess calls)
- **didc** - Candid validation CLI (required)
- **moc** - Motoko compiler (optional, for advanced validation)

### Installation Requirements
Users should have:
- Node.js 18+
- didc installed (provide install instructions)
- Optional: moc (via dfx or standalone)

---

## 6. Testing Strategy

### Unit Tests
- Each validator function
- Template generation
- Error parsing
- Cache behavior

### Integration Tests
```typescript
describe('icp/validate', () => {
  it('validates correct Candid file', async () => {
    const result = await validate({
      code: 'service : { get : () -> (nat) query }',
      language: 'candid'
    });
    expect(result.valid).toBe(true);
  });

  it('detects Candid syntax errors', async () => {
    const result = await validate({
      code: 'service : { invalid syntax }',
      language: 'candid'
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
```

### Manual Testing
- Test with Claude Code
- Test with Cursor
- Verify all 6 tools work end-to-end
- Build real canister using only MCP tools

---

## 7. Documentation Requirements

### README.md Structure (Dev-Focused)
```markdown
# ICP-MCP

Model Context Protocol server for Internet Computer development.

## What It Does

Provides ICP expertise to AI coding assistants via 6 tools:
- Documentation lookup
- Real code examples
- Multi-language validation
- Command guidance
- Code templates

## Installation

npm install -g icp-mcp

## Usage

Add to your MCP client config...

## Tools

### icp/list-topics
...

### icp/get-docs
...

[etc]

## Development

npm install
npm test
npm run build
```

**No:** Emojis, marketing fluff, "powerful", "comprehensive"
**Yes:** Direct technical facts, code examples, quick reference

### AGENTS.md Example
Provide example project instructions for AI agents:

```markdown
# ICP Development Instructions

This project uses the ICP-MCP server for Internet Computer development.

## Available Tools

- `icp/list-topics` - Browse documentation
- `icp/get-docs` - Fetch ICP docs
- `icp/get-example` - Get real examples
- `icp/validate` - Validate code (Motoko/Rust/Candid)
- `icp/dfx-guide` - Generate dfx commands
- `icp/template` - Generate boilerplate

## Workflow

1. Always fetch relevant docs before generating code
2. Use examples from dfinity/examples as reference
3. Validate ALL code (Motoko/Rust + Candid + dfx.json) iteratively
4. Use dfx-guide to generate commands, never execute dfx directly
5. Present commands to user for review before execution
```

---

## 8. Launch Strategy

### npm Package
- Package name: `@dfinity/icp-mcp` or `icp-mcp` (check availability)
- Semantic versioning (1.0.0)
- MIT or Apache 2.0 license
- Keywords: mcp, internet-computer, icp, motoko, rust, candid, dfinity

### Announcement Channels
- DFINITY Developer Forum
- ICP Developer Discord
- Twitter/X (tag @dfinity, @ICPSquad)
- Reddit r/dfinity
- GitHub discussions

### Announcement Content
**Title:** "ICP-MCP: Build Internet Computer Projects with AI Assistants"

**Key Points:**
- Complete ICP development companion for AI agents
- Works in Claude Code, Cursor, Windsurf, Codex
- Multi-language validation (Motoko, Rust, Candid)
- Live documentation + real examples
- Safe command guidance without execution
- Open source, community-built

---

## 9. Success Metrics

### Technical Metrics
- ✓ All 6 tools functional
- ✓ Validates 3 languages correctly
- ✓ Fetches live docs from internetcomputer.org
- ✓ Provides working examples from dfinity/examples
- ✓ Clear, actionable error messages
- ✓ Works in 4+ MCP-compatible editors

### Community Metrics (Post-Launch)
- GitHub stars
- npm downloads
- Forum discussions
- Issues/PRs opened
- User testimonials

### Quality Metrics
- Test coverage >80%
- No critical bugs in first week
- Positive user feedback
- Adoption by ICP developers

---

## 10. Future Roadmap (v2.0+)

### Read-Only Canister Integration
- Query canister state from mainnet/testnet
- Inspect canister metadata
- Read public interfaces

### Advanced Analysis
- Upgrade safety checker (stable memory migration)
- Cycles cost estimator
- Gas optimization suggestions
- Security audit automation

### Enhanced Templates
- Full project scaffolding (frontend + backend)
- Framework-specific setups (React, Vue, Svelte)
- Advanced patterns (DAO, NFT, DeFi)

### Remote Deployment
- Host MCP endpoint (like https://mcp.internetcomputer.org)
- Support both local and remote modes
- OAuth for authenticated features

### IDE Plugins
- VS Code extension with inline validation
- IntelliJ plugin
- Vim/Neovim integration

---

## 11. Risk Mitigation

### Risk: Documentation Structure Changes
**Mitigation:**
- Graceful degradation if scraping fails
- Multiple fallback strategies
- Community PRs to update selectors

### Risk: didc/moc Not Installed
**Mitigation:**
- Clear installation instructions
- Detect missing tools, provide helpful errors
- Fallback to regex validation if tools missing

### Risk: GitHub API Rate Limits
**Mitigation:**
- Aggressive caching of examples
- Support GitHub token for higher limits
- Bundle popular examples locally

### Risk: MCP Protocol Changes
**Mitigation:**
- Use official SDK (handles protocol updates)
- Pin SDK version, test before upgrading
- Monitor MCP releases

---

## 12. Open Questions

1. **Package name:** `@dfinity/icp-mcp` vs `icp-mcp`
   - Check npm availability
   - Consider DFINITY organization permissions

2. **License:** MIT vs Apache 2.0
   - Check dfinity/examples license
   - Match ecosystem standards

3. **Motoko validation:** Regex patterns vs moc integration?
   - Start with regex (Week 1)
   - Add moc if needed (Week 2)

4. **Remote endpoint:** Host immediately or defer to v2.0?
   - Decision: Defer to v2.0
   - Focus on npm package first

---

## 13. References

### Official Documentation
- ICP Docs: https://internetcomputer.org/docs/
- Motoko: https://internetcomputer.org/docs/motoko/
- Rust CDK: https://docs.rs/ic-cdk/
- Candid: https://internetcomputer.org/docs/references/candid-ref
- dfx CLI: https://internetcomputer.org/docs/references/cli-reference/

### GitHub Repositories
- dfinity/examples: https://github.com/dfinity/examples
- dfinity/candid: https://github.com/dfinity/candid
- dfinity/cdk-rs: https://github.com/dfinity/cdk-rs
- dfinity/motoko: https://github.com/dfinity/motoko

### MCP Resources
- MCP Spec: https://modelcontextprotocol.io/
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Example Servers: https://github.com/modelcontextprotocol/servers

---

## 14. Decision Log

**2025-10-17:**
- ✓ Chose Option B (comprehensive tools, no execution)
- ✓ 6 tools finalized (list-topics, get-docs, get-example, validate, dfx-guide, template)
- ✓ 2-week implementation plan
- ✓ Phase 1: Core + MVP (Week 1)
- ✓ Phase 2: Complete + Launch (Week 2)
- ✓ TypeScript + MCP SDK confirmed
- ✓ Local npm package for v1.0
- ✓ Validation as key differentiator

---

**END OF PRD**

*This document serves as the complete specification for ICP-MCP v1.0. Implementation begins immediately following approval.*
