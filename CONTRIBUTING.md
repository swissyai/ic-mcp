# Contributing to IC-MCP

Thanks for your interest in contributing to IC-MCP. This project aims to provide a well-patterned, simple MCP server for Internet Computer development.

## Get in Touch

- **Quick questions or ideas?** DM [@swissyai](https://x.com/swissyai) on Twitter
- **Bug reports or feature requests?** [Open an issue](https://github.com/swissyai/ic-mcp/issues/new)

## How to Contribute

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes and test thoroughly
4. Submit a pull request with a clear description of changes

## Development Setup

```bash
git clone https://github.com/swissyai/ic-mcp.git
cd ic-mcp
npm install
npm run build
npm test
```

## Testing

Run the test suite before submitting:

```bash
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
```

## Project Structure

- `src/tools/` - MCP tool implementations (query, action, execute, help)
- `src/data/` - Module definitions and ICP examples
- `src/utils/` - Validation, compilation, TOON encoding utilities
- `tests/` - Unit and integration tests

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation if needed
- Ensure all tests pass before submitting

## License

By contributing to IC-MCP, you agree that your contributions will be licensed under the MIT License.
