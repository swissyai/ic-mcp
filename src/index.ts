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
import { logger, LogLevel } from './utils/logger.js';

// Set log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';
logger.setLevel(LogLevel[logLevel.toUpperCase() as keyof typeof LogLevel] || LogLevel.INFO);

/**
 * Create MCP server
 */
const server = new Server(
  {
    name: 'icp-mcp',
    version: '0.3.0',
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
          'Validates ICP code (Candid, Motoko, Rust, dfx.json). Provides detailed error messages and suggestions for improvements.',
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
              description: 'Programming language',
            },
            filename: {
              type: 'string',
              description: 'Optional filename for context',
            },
            context: {
              type: 'object',
              properties: {
                isUpgrade: {
                  type: 'boolean',
                  description: 'Whether this is an upgrade context',
                },
                hasStableState: {
                  type: 'boolean',
                  description: 'Whether the canister has stable state',
                },
              },
              description: 'Optional validation context',
            },
          },
          required: ['code', 'language'],
        },
      },
      {
        name: 'icp/get-docs',
        description:
          'Fetches ICP documentation from the official dfinity/portal repository. Returns current, accurate documentation in markdown format.',
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
              description: 'Maximum total content length to return',
            },
          },
        },
      },
      {
        name: 'icp/get-example',
        description:
          'Fetches real code examples from dfinity/examples repository. Includes source code, dfx.json, and README.',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['motoko', 'rust', 'svelte'],
              description: 'Programming language',
            },
            exampleName: {
              type: 'string',
              description: 'Name of the example (e.g., "hello_world")',
            },
            list: {
              type: 'boolean',
              description: 'Set to true to list all available examples for a language',
            },
          },
        },
      },
      {
        name: 'icp/dfx-guide',
        description:
          'Generates dfx command templates with safety checks and explanations. Prevents dangerous operations and provides best practices.',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['deploy', 'canister-call', 'identity', 'cycles', 'build'],
              description: 'Type of dfx operation',
            },
            network: {
              type: 'string',
              enum: ['local', 'ic', 'playground'],
              description: 'Target network (default: local)',
            },
            canister: {
              type: 'string',
              description: 'Canister name',
            },
            method: {
              type: 'string',
              description: 'Method name for canister-call operation',
            },
            args: {
              type: 'string',
              description: 'Method arguments in Candid format',
            },
            identityName: {
              type: 'string',
              description: 'Identity name for identity operations',
            },
          },
          required: ['operation'],
        },
      },
      {
        name: 'icp/template',
        description:
          'Generates boilerplate code for ICP projects. Creates Motoko/Rust canisters or full-stack projects with best practices.',
        inputSchema: {
          type: 'object',
          properties: {
            templateType: {
              type: 'string',
              enum: ['motoko-canister', 'rust-canister', 'full-project'],
              description: 'Type of template',
            },
            name: {
              type: 'string',
              description: 'Project/canister name',
            },
            features: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional features (stable-vars, upgrade-hooks, timer, state-management)',
            },
          },
          required: ['templateType', 'name'],
        },
      },
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
  logger.info('Available tools:');
  logger.info('  - icp/validate (Candid, Motoko, Rust, dfx.json validation)');
  logger.info('  - icp/get-docs (Fetch ICP documentation)');
  logger.info('  - icp/get-example (Fetch code examples)');
  logger.info('  - icp/dfx-guide (Safe dfx command templates)');
  logger.info('  - icp/template (Code scaffolding)');
}

main().catch((error) => {
  logger.error('Server error:', error);
  process.exit(1);
});
