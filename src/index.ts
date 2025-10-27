#!/usr/bin/env node
/**
 * ICP-MCP Server
 * Model Context Protocol server for Internet Computer development
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { validate, ValidateInputSchema } from './tools/validate.js';
import { getDocs, GetDocsInputSchema } from './tools/get-docs.js';
import { getExample, GetExampleInputSchema } from './tools/get-example.js';
import { dfxGuide, DfxGuideInputSchema } from './tools/dfx-guide.js';
import { template, TemplateInputSchema } from './tools/template.js';
import { executeAnalyzeProject, analyzeProjectSchema, analyzeProjectTool } from './tools/analyze-project.js';
import { executeTestDeploy, testDeploySchema, testDeployTool } from './tools/test-deploy.js';
import { executeTestCall, testCallSchema, testCallTool } from './tools/test-call.js';
import { executeTestScenario, testScenarioSchema, testScenarioTool } from './tools/test-scenario.js';
import { executeCheckUpgrade, checkUpgradeSchema, checkUpgradeTool } from './tools/check-upgrade.js';
import { executeRefactor, refactorSchema, refactorTool } from './tools/refactor.js';
import { executeSpeed, speedSchema, speedTool } from './tools/speed.js';
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
    version: '0.6.2',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'icp/validate',
        description:
          'Validates ICP canister code with comprehensive error checking and security analysis. Supports Candid (via didc compiler), Motoko (via moc compiler with full type-checking), Rust (ic-cdk pattern validation), and dfx.json configuration files. Returns detailed error messages with line/column numbers, error codes, and actionable suggestions for fixes. Use this for iterative development to catch type errors, security vulnerabilities, and configuration issues before deployment.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The code to validate',
            },
            language: {
              type: 'string',
              enum: ['candid', 'motoko', 'rust', 'dfx-json'],
              description: 'Programming language or configuration type',
            },
            filename: {
              type: 'string',
              description: 'Optional filename for better error context',
            },
            context: {
              type: 'object',
              properties: {
                securityCheck: {
                  type: 'boolean',
                  description: 'Enable enhanced security pattern detection (caller validation, trap safety, overflow checks)',
                },
              },
              description: 'Optional validation settings',
            },
          },
          required: ['code', 'language'],
        },
      },
      {
        name: 'icp/get-docs',
        description:
          'Fetches official Internet Computer documentation from the dfinity/portal GitHub repository. Provides up-to-date documentation in markdown format with 15-minute caching for performance. Can browse directories to discover available docs or fetch specific documentation files by path. Returns current, accurate documentation directly from the source. Use this to access authoritative IC documentation for building dapps, understanding protocols, or learning best practices.',
        inputSchema: {
          type: 'object',
          properties: {
            paths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific documentation file paths to fetch (e.g., ["docs/building-apps/overview.mdx"])',
            },
            directory: {
              type: 'string',
              description: 'Browse a directory to see available docs (e.g., "docs/building-apps")',
            },
            maxLength: {
              type: 'number',
              description: 'Maximum total content length to return (optional limit)',
            },
          },
        },
      },
      {
        name: 'icp/get-example',
        description:
          'Fetches working code examples from the official dfinity/examples repository. Returns complete, production-ready example projects including source code, dfx.json configuration, and README documentation. Can list all available examples for a language or fetch a specific example by name. Examples are maintained by the DFINITY Foundation and demonstrate best practices. Use this to learn implementation patterns, bootstrap new projects, or reference canonical solutions.',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['motoko', 'rust', 'svelte'],
              description: 'Programming language for examples',
            },
            exampleName: {
              type: 'string',
              description: 'Name of the specific example to fetch (e.g., "hello_world", "counter")',
            },
            list: {
              type: 'boolean',
              description: 'Set to true to list all available examples for the specified language',
            },
          },
        },
      },
      {
        name: 'icp/dfx-guide',
        description:
          'Generates safe dfx command-line templates with network-specific safety checks and detailed explanations. Provides ready-to-run commands for common operations including deployment, canister calls, identity management, cycles operations, and builds. Includes prerequisites, warnings about destructive actions (especially on mainnet), and step-by-step guidance. Prevents dangerous operations like force deployments or unintended mainnet transactions. Use this when users need to execute dfx commands but want safety guardrails and best practices.',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['deploy', 'canister-call', 'identity', 'cycles', 'build'],
              description: 'Type of dfx operation to generate template for',
            },
            network: {
              type: 'string',
              enum: ['local', 'ic', 'playground'],
              description: 'Target network (default: local). Mainnet operations include extra safety warnings.',
            },
            canister: {
              type: 'string',
              description: 'Canister name for deploy/call operations',
            },
            method: {
              type: 'string',
              description: 'Method name for canister-call operation',
            },
            args: {
              type: 'string',
              description: 'Method arguments in Candid format (e.g., "(42, \\"text\\")")',
            },
            identityName: {
              type: 'string',
              description: 'Identity name for identity management operations',
            },
          },
          required: ['operation'],
        },
      },
      {
        name: 'icp/template',
        description:
          'Generates production-ready boilerplate code for ICP projects following DFINITY best practices. Creates individual Motoko or Rust canisters with proper structure, or complete full-stack projects with frontend integration. Supports optional features including stable storage variables, pre/post upgrade hooks, periodic timers, and state management patterns. Generated code includes proper imports, type definitions, and security patterns. Returns complete file contents ready to write to disk. Use this to bootstrap new projects or add properly-structured canisters to existing projects.',
        inputSchema: {
          type: 'object',
          properties: {
            templateType: {
              type: 'string',
              enum: ['motoko-canister', 'rust-canister', 'full-project'],
              description: 'Type of template to generate',
            },
            name: {
              type: 'string',
              description: 'Project or canister name (will be used for file names and module names)',
            },
            features: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional features to include: stable-vars, upgrade-hooks, timer, state-management',
            },
          },
          required: ['templateType', 'name'],
        },
      },
      analyzeProjectTool,
      testDeployTool,
      testCallTool,
      testScenarioTool,
      checkUpgradeTool,
      refactorTool,
      speedTool,
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'icp/validate': {
        const validatedArgs = ValidateInputSchema.parse(args);
        return await validate(validatedArgs);
      }

      case 'icp/get-docs': {
        const validatedArgs = GetDocsInputSchema.parse(args);
        return await getDocs(validatedArgs);
      }

      case 'icp/get-example': {
        const validatedArgs = GetExampleInputSchema.parse(args);
        return await getExample(validatedArgs);
      }

      case 'icp/dfx-guide': {
        const validatedArgs = DfxGuideInputSchema.parse(args);
        return await dfxGuide(validatedArgs);
      }

      case 'icp/template': {
        const validatedArgs = TemplateInputSchema.parse(args);
        return await template(validatedArgs);
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

      case 'icp/test-deploy': {
        const validatedArgs = testDeploySchema.parse(args);
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    logger.error(`Tool ${name} error:`, error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: error.message,
              tool: name,
            },
            null,
            2
          ),
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

  logger.info('ICP-MCP Server started');
  logger.info('Available tools (12):');
  logger.info('  Validation:');
  logger.info('    - icp/validate (Code validation with security checks)');
  logger.info('    - icp/analyze-project (Project analysis)');
  logger.info('    - icp/check-upgrade (Upgrade safety)');
  logger.info('  Testing:');
  logger.info('    - icp/test-deploy (Deploy projects)');
  logger.info('    - icp/test-call (Execute methods)');
  logger.info('    - icp/test-scenario (Multi-step tests)');
  logger.info('  Development:');
  logger.info('    - icp/get-docs (Fetch documentation)');
  logger.info('    - icp/get-example (Code examples)');
  logger.info('    - icp/dfx-guide (Command templates)');
  logger.info('    - icp/template (Code scaffolding)');
  logger.info('  Optimization:');
  logger.info('    - icp/refactor (Smart refactoring)');
  logger.info('    - icp/speed (Performance analysis)');
}

main().catch((error) => {
  logger.error('Server error:', error);
  process.exit(1);
});
