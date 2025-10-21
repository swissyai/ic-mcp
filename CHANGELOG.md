# Changelog

## [0.2.0] - 2025-10-21

### Added
- **Rust validation**: Pattern-based checking for ic-cdk canisters
  - Import validation
  - Method attribute checking (#[query], #[update], etc.)
  - State management patterns (RefCell, thread_local!)
  - Security patterns (caller verification, error handling)
  - Candid export detection
  - Upgrade hooks validation
- **dfx.json validation**: Full configuration checking
  - Structure validation
  - Canister config verification
  - Network config checks
  - Circular dependency detection
- **icp/dfx-guide tool**: Safe command template generation
  - Deploy operations with network-specific safety checks
  - Canister call templates
  - Identity management
  - Cycles operations
  - Build commands
- **icp/template tool**: Code scaffolding
  - Motoko canister templates
  - Rust canister templates
  - Full-stack project templates
  - Configurable features (stable-vars, upgrade-hooks, timers)

### Changed
- Expanded validation to cover all 4 languages (Candid, Motoko, Rust, dfx.json)
- Enhanced error messages with security best practices
- Updated server to expose 5 total tools

## [0.1.0] - 2025-10-21

### Added
- Initial MCP server implementation
- **icp/validate tool**: Candid and Motoko validation
  - didc CLI integration for Candid
  - Pattern-based Motoko validation
  - Detailed error parsing with line/column numbers
- **icp/get-docs tool**: Documentation fetching
  - GitHub API integration with dfinity/portal
  - Directory browsing
  - Markdown content retrieval
  - 15-minute caching
- **icp/get-example tool**: Example code fetching
  - GitHub API integration with dfinity/examples
  - List examples by language
  - Fetch complete example projects
  - Source code + dfx.json + README
- Core architecture:
  - MCP SDK integration
  - Structured logging
  - Response caching
  - Type-safe Zod schemas
- Documentation and testing
