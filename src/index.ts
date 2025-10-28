#!/usr/bin/env node
/**
 * IC-MCP Server with Enhanced Discovery and Web Integration
 * Model Context Protocol server for Internet Computer development
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import existing core tools
import { validate, ValidateInputSchema } from './tools/validate.js';
import { getDocs, GetDocsInputSchema } from './tools/get-docs.js';
import { getExample, GetExampleInputSchema } from './tools/get-example.js';
import { dfxGuide, DfxGuideInputSchema } from './tools/dfx-guide.js';
import { template, TemplateInputSchema } from './tools/template.js';
import { migrationGuide, MigrationGuideInputSchema } from './tools/migration-guide.js';
import { executeAnalyzeProject, analyzeProjectSchema } from './tools/analyze-project.js';
import { executeTestDeploy, testDeploySchema } from './tools/test-deploy.js';
import { executeTestCall, testCallSchema } from './tools/test-call.js';
import { executeTestScenario, testScenarioSchema } from './tools/test-scenario.js';
import { executeCheckUpgrade, checkUpgradeSchema } from './tools/check-upgrade.js';
import { executeRefactor, refactorSchema } from './tools/refactor.js';
import { executeSpeed, speedSchema } from './tools/speed.js';

// Import enhanced tools
import { discover, DiscoverInputSchema, discoveryTool } from './tools/motoko-discovery.js';
import { enhancedMotokoCore, EnhancedMotokoCoreInputSchema } from './tools/motoko-core.js';
import { route, RouterInputSchema, routerTool } from './tools/intelligent-router.js';

import { logger, LogLevel } from './utils/logger.js';

// Set log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';
logger.setLevel(LogLevel[logLevel.toUpperCase() as keyof typeof LogLevel] || LogLevel.INFO);

/**
 * Create MCP server
 */
const server = new Server(
  {
    name: 'ic-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Tool definitions with clear descriptions and usage guidance
 */
const TOOLS = [
  // PRIMARY DISCOVERY & NAVIGATION
  {
    ...discoveryTool,
    description: `Primary discovery tool for Motoko core library modules.

ALWAYS USE THIS FIRST when working with Motoko to understand what's available.

When to use:
- User asks "what modules/data structures are available?"
- Starting any Motoko development task
- Need to find specific functionality
- Want to explore by category

Actions:
- list-all: Complete module index (45+ modules)
- search: Find modules by keyword
- category: Browse by category
- get-batch: Fetch multiple modules efficiently

Returns module information with documentation links, GitHub sources, and playground URLs.`,
  },

  {
    ...routerTool,
    description: `Intelligent tool selection assistant.

When to use:
- Unsure which tool to use for a task
- User query is ambiguous
- Need parameter suggestions
- Want to confirm tool choice

Analyzes user intent and recommends the most appropriate tool with confidence scores.`,
  },

  // DOCUMENTATION & REFERENCE
  {
    name: 'icp/motoko-core',
    description: `Motoko core library documentation with batch support.

When to use:
- After discovering modules with icp/discover
- Need detailed documentation for specific modules
- Want to compare multiple modules
- Looking for method signatures and examples

Supports:
- Single module: { module: "Array" }
- Batch fetch: { modules: ["Array", "Map", "List"] }
- Method details: { module: "Map", method: "insert" }

Returns comprehensive documentation with complexity analysis, usage examples, and related modules.`,
    inputSchema: {
      type: 'object',
      properties: {
        modules: {
          type: 'array',
          items: { type: 'string' },
          description: 'Batch fetch multiple modules (efficient)',
        },
        module: {
          type: 'string',
          description: 'Single module name (use modules for batch)',
        },
        method: {
          type: 'string',
          description: 'Specific method to document',
        },
        examples: {
          type: 'boolean',
          description: 'Include usage examples (default: true)',
        },
        includeLinks: {
          type: 'boolean',
          description: 'Include documentation links (default: true)',
        },
      },
    },
  },

  {
    name: 'icp/get-docs',
    description: `Official Internet Computer documentation fetcher.

When to use:
- Need protocol documentation
- Looking for architecture guides
- Want deployment best practices
- Exploring advanced IC features

Fetches from dfinity/portal GitHub repository with caching.`,
    inputSchema: GetDocsInputSchema,
  },

  {
    name: 'icp/base-to-core-migration',
    description: `Migration guide from Motoko base to core library.

When to use:
- Migrating old projects using base library
- Understanding deprecated modules
- Finding replacements for removed functionality
- Learning about breaking changes

Provides module mappings, code examples, and migration strategies.`,
    inputSchema: MigrationGuideInputSchema,
  },

  // CODE GENERATION & VALIDATION
  {
    name: 'icp/template',
    description: `Production-ready project and canister generator.

When to use:
- Starting new ICP project
- Adding canister to existing project
- Need boilerplate with best practices
- Want specific features (timers, upgrades, stable storage)

Template types:
- motoko-canister: Individual Motoko canister
- rust-canister: Individual Rust canister
- full-project: Complete multi-canister project

Returns complete file contents ready to write to disk.`,
    inputSchema: TemplateInputSchema,
  },

  {
    name: 'icp/get-example',
    description: `Official DFINITY example fetcher.

When to use:
- Learning implementation patterns
- Need working reference code
- Bootstrapping from proven examples
- Understanding best practices

Supports Motoko, Rust, and Svelte examples from dfinity/examples repository.`,
    inputSchema: GetExampleInputSchema,
  },

  {
    name: 'icp/validate',
    description: `Comprehensive code validator with security analysis.

When to use:
- Before deployment
- Debugging type errors
- Checking for security issues
- Validating configuration files

Supports:
- Motoko (via moc compiler)
- Rust (ic-cdk patterns)
- Candid interface definitions
- dfx.json configuration

Returns detailed errors with line numbers and fix suggestions.`,
    inputSchema: ValidateInputSchema,
  },

  // DEPLOYMENT & TESTING
  {
    name: 'icp/dfx-guide',
    description: `Safe dfx command generator with best practices.

When to use:
- Need deployment commands
- Managing identities
- Cycles operations
- Building canisters

Operations:
- deploy: Safe deployment with network checks
- canister-call: Method invocation templates
- identity: Identity management
- cycles: Cycle operations
- build: Build commands

Includes safety warnings for mainnet operations.`,
    inputSchema: DfxGuideInputSchema,
  },

  {
    name: 'icp/test-deploy',
    description: `Test deployment orchestrator for local and playground.

When to use:
- Testing multi-canister projects
- Local development workflow
- Pre-mainnet validation
- Dependency order verification

Handles project analysis, dependency resolution, and deployment ordering.`,
    inputSchema: testDeploySchema,
  },

  {
    name: 'icp/test-call',
    description: `Canister method testing with automatic Candid handling.

When to use:
- Testing individual methods
- Debugging state changes
- Verifying method behavior
- Query vs update testing

Supports automatic argument encoding/decoding and result formatting.`,
    inputSchema: testCallSchema,
  },

  {
    name: 'icp/test-scenario',
    description: `Multi-step test scenario executor.

When to use:
- End-to-end testing
- Complex workflows (register -> pay -> deliver)
- Integration testing
- State consistency verification

Supports sequential steps, result validation, and cross-canister calls.`,
    inputSchema: testScenarioSchema,
  },

  // OPTIMIZATION & ANALYSIS
  {
    name: 'icp/speed',
    description: `Performance analyzer for canister optimization.

When to use:
- Canister running slowly
- High cycle consumption
- Memory issues
- Need optimization suggestions

Analysis focus:
- full: Complete analysis
- memory: Memory usage patterns
- cycles: Cycle cost optimization
- latency: Response time improvements

Returns scored issues with specific optimization recommendations.`,
    inputSchema: speedSchema,
  },

  {
    name: 'icp/refactor',
    description: `Automated code refactoring for ICP best practices.

When to use:
- Modernizing old code
- Adding upgrade safety
- Implementing security patterns
- Converting to stable storage

Refactoring types:
- add-upgrade-hooks: Add pre/post upgrade
- add-stable-vars: Convert to stable storage
- add-caller-checks: Add authentication
- modernize: Update to current patterns

Returns refactored code with change summary.`,
    inputSchema: refactorSchema,
  },

  {
    name: 'icp/analyze-project',
    description: `Comprehensive project structure analyzer.

When to use:
- Understanding new codebase
- Planning deployment strategy
- Checking dependencies
- Validating project configuration

Analyzes dfx.json, canister dependencies, source files, and build order.`,
    inputSchema: analyzeProjectSchema,
  },

  {
    name: 'icp/check-upgrade',
    description: `Canister upgrade safety validator.

When to use:
- Before production upgrades
- Checking API compatibility
- Preventing breaking changes
- Validating interface evolution

Compares old and new Candid interfaces using subtyping rules.`,
    inputSchema: checkUpgradeSchema,
  },
];

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Discovery & Navigation
      case 'icp/discover': {
        const validatedArgs = DiscoverInputSchema.parse(args);
        return await discover(validatedArgs);
      }

      case 'icp/router': {
        const validatedArgs = RouterInputSchema.parse(args);
        return await route(validatedArgs);
      }

      // Documentation
      case 'icp/motoko-core': {
        const validatedArgs = EnhancedMotokoCoreInputSchema.parse(args);
        return await enhancedMotokoCore(validatedArgs);
      }

      case 'icp/get-docs': {
        const validatedArgs = GetDocsInputSchema.parse(args);
        return await getDocs(validatedArgs);
      }

      case 'icp/base-to-core-migration': {
        const validatedArgs = MigrationGuideInputSchema.parse(args);
        return await migrationGuide(validatedArgs);
      }

      // Code Generation & Validation
      case 'icp/template': {
        const validatedArgs = TemplateInputSchema.parse(args);
        return await template(validatedArgs);
      }

      case 'icp/get-example': {
        const validatedArgs = GetExampleInputSchema.parse(args);
        return await getExample(validatedArgs);
      }

      case 'icp/validate': {
        const validatedArgs = ValidateInputSchema.parse(args);
        return await validate(validatedArgs);
      }

      // Deployment & Testing
      case 'icp/dfx-guide': {
        const validatedArgs = DfxGuideInputSchema.parse(args);
        return await dfxGuide(validatedArgs);
      }

      case 'icp/test-deploy': {
        const validatedArgs = analyzeProjectSchema.parse(args);
        const result = await executeTestDeploy(validatedArgs);
        return {
          content: [
            {
              type: 'text' as const,
              text: result,
            },
          ],
        };
      }

      case 'icp/test-call': {
        const validatedArgs = testCallSchema.parse(args);
        const result = await executeTestCall(validatedArgs);
        return {
          content: [
            {
              type: 'text' as const,
              text: result,
            },
          ],
        };
      }

      case 'icp/test-scenario': {
        const validatedArgs = testScenarioSchema.parse(args);
        const result = await executeTestScenario(validatedArgs);
        return {
          content: [
            {
              type: 'text' as const,
              text: result,
            },
          ],
        };
      }

      // Optimization & Analysis
      case 'icp/speed': {
        const validatedArgs = speedSchema.parse(args);
        const result = await executeSpeed(validatedArgs);
        return {
          content: [
            {
              type: 'text' as const,
              text: result,
            },
          ],
        };
      }

      case 'icp/refactor': {
        const validatedArgs = refactorSchema.parse(args);
        const result = await executeRefactor(validatedArgs);
        return {
          content: [
            {
              type: 'text' as const,
              text: result,
            },
          ],
        };
      }

      case 'icp/analyze-project': {
        const validatedArgs = analyzeProjectSchema.parse(args);
        const result = await executeAnalyzeProject(validatedArgs);
        return {
          content: [
            {
              type: 'text' as const,
              text: result,
            },
          ],
        };
      }

      case 'icp/check-upgrade': {
        const validatedArgs = checkUpgradeSchema.parse(args);
        const result = await executeCheckUpgrade(validatedArgs);
        return {
          content: [
            {
              type: 'text' as const,
              text: result,
            },
          ],
        };
      }

      default:
        // Helpful error with suggestions
        const similarTools = TOOLS
          .filter(t => t.name.includes(name.split('/')[1]) || name.includes(t.name.split('/')[1]))
          .map(t => t.name);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: `Unknown tool: ${name}`,
                availableTools: TOOLS.map(t => t.name),
                suggestion: similarTools.length > 0
                  ? `Did you mean: ${similarTools[0]}?`
                  : 'Use icp/router to find the right tool',
                tip: 'Use icp/discover to explore available modules',
              }, null, 2),
            },
          ],
          isError: true,
        };
    }
  } catch (error: any) {
    logger.error(`Tool ${name} error:`, error);

    // Enhanced error messages
    const errorResponse: any = {
      error: error.message,
      tool: name,
    };

    // Context-aware error suggestions
    if (error.message.includes('not found')) {
      errorResponse.suggestion = 'Use icp/discover first to see available modules';
      errorResponse.command = 'icp/discover { action: "list-all" }';
    } else if (error.message.includes('required')) {
      const tool = TOOLS.find(t => t.name === name);
      if (tool?.inputSchema && typeof tool.inputSchema === 'object' && 'properties' in tool.inputSchema) {
        errorResponse.parameters = (tool.inputSchema as any).properties;
        errorResponse.required = (tool.inputSchema as any).required;
      }
    } else if (error.message.includes('deprecated')) {
      errorResponse.suggestion = 'Use icp/base-to-core-migration for migration guide';
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('IC-MCP Server v1.0.0 started');
  logger.info('');
  logger.info('Key Features:');
  logger.info('  - Web-enhanced discovery with live documentation');
  logger.info('  - Intelligent tool routing and suggestions');
  logger.info('  - Batch operations for efficiency');
  logger.info('  - Multiple data sources with fallbacks');
  logger.info('  - Direct links to documentation and playground');
  logger.info('');
  logger.info('Quick Start:');
  logger.info('  1. Use icp/discover to explore modules');
  logger.info('  2. Use icp/router if unsure which tool');
  logger.info('  3. Use icp/motoko-core for documentation');
  logger.info('');
  logger.info(`Available tools: ${TOOLS.length}`);

  // Log tools by category for clarity
  const categories = {
    'Discovery': ['icp/discover', 'icp/router'],
    'Documentation': ['icp/motoko-core', 'icp/get-docs', 'icp/base-to-core-migration'],
    'Code Generation': ['icp/template', 'icp/get-example', 'icp/validate'],
    'Testing': ['icp/test-deploy', 'icp/test-call', 'icp/test-scenario', 'icp/dfx-guide'],
    'Analysis': ['icp/analyze-project', 'icp/speed', 'icp/refactor', 'icp/check-upgrade'],
  };

  for (const [category, toolNames] of Object.entries(categories)) {
    logger.info(`  ${category}: ${toolNames.join(', ')}`);
  }
}

main().catch((error) => {
  logger.error('Server error:', error);
  process.exit(1);
});