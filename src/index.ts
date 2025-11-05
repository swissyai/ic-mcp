#!/usr/bin/env node
/**
 * ICP-MCP Server - 3-Tool Architecture
 * Unified, intelligent interface to Internet Computer development
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Import the 3 unified tools
import { queryTool } from './tools/query.js';
import { actionTool } from './tools/action.js';
import { helpTool } from './tools/help.js';

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
  }
);

/**
 * 3-Tool Architecture
 *
 * Query:  Data fetching (list modules, fetch docs, fetch examples)
 * Action: Code operations (validate, test, deploy, refactor, analyze, upgrade)
 * Help:   Meta information (how to use ICP-MCP itself)
 */
const TOOLS = [
  queryTool,
  actionTool,
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
  const { name, arguments: args } = request.params;

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
              hint: 'Use icp/help to learn about available tools and their usage',
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
  logger.info('Starting ICP-MCP Server');
  logger.info(`Tools available: ${TOOLS.map(t => t.name).join(', ')}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('ICP-MCP Server running');
  logger.info('Base cost: 181 tokens (module index & help on-demand)');
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
