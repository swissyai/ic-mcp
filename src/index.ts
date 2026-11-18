#!/usr/bin/env node
/**
 * ic-mcp: MCP server for building on the Internet Computer with icp-cli.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { queryTool } from './tools/query.js';
import { actionTool } from './tools/action.js';
import { helpTool } from './tools/help.js';
import { executeTool } from './tools/execute.js';

import { logger, LogLevel } from './utils/logger.js';
import { getVersion } from './utils/version.js';

// Set log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';
logger.setLevel(LogLevel[logLevel.toUpperCase() as keyof typeof LogLevel] || LogLevel.INFO);

/**
 * Create MCP server
 */
const server = new Server(
  {
    name: 'ic-mcp',
    version: getVersion(),
  },
  {
    capabilities: {
      tools: {},
    },
    instructions:
      'Tools for building on the Internet Computer with icp-cli. Official guidance: https://skills.internetcomputer.org/llms.txt. ' +
      'Start with icp/action "preflight". Read skills by section with icp/query. Mainnet and cloud engine deploys return a plan and need confirm: true.',
  }
);

/**
 * Tool names are listed as `icp/query`, `icp/action`, `icp/execute` and
 * `icp/help`. Calls are also accepted with `_` in place of `/`, the form some
 * clients use when a name contains characters they do not allow.
 */
const TOOLS = [
  queryTool,
  actionTool,
  executeTool,
  helpTool,
];

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info('Listing tools');

  return {
    tools: TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema, { $refStrategy: 'none' }),
    })),
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { arguments: args } = request.params;
  const name = request.params.name.replace(/^icp_/, 'icp/');

  logger.info(`Tool call: ${name}`, { args });

  try {
    switch (name) {
      case 'icp/query': {
        const validated = queryTool.inputSchema.parse(args);
        return await queryTool.execute(validated);
      }

      case 'icp/action': {
        const validated = actionTool.inputSchema.parse(args);
        return await actionTool.execute(validated);
      }

      case 'icp/execute': {
        const validated = executeTool.inputSchema.parse(args);
        return await executeTool.execute(validated);
      }

      case 'icp/help': {
        const validated = helpTool.inputSchema.parse(args);
        return await helpTool.execute(validated);
      }

      default:
        throw new Error(
          `Unknown tool: ${name}. Available: ${TOOLS.map(t => t.name).join(', ')}`
        );
    }
  } catch (error: any) {
    logger.error(`Error executing ${name}:`, error);

    // Return error in MCP format
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: error.message,
              tool: name,
              hint: 'See icp/help for tools and parameters',
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
  logger.info('Starting ic-mcp');
  logger.info(`Tools available: ${TOOLS.map(t => t.name).join(', ')}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('ic-mcp running');
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
