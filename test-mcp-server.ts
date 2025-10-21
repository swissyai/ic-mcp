#!/usr/bin/env node
/**
 * Minimal MCP server to test SDK functionality
 * Tests: Server init, tool registration, tool execution
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool input schemas
const PingInputSchema = z.object({
  message: z.string().optional(),
});

const ValidateCandidInputSchema = z.object({
  code: z.string(),
});

/**
 * Create MCP server instance
 */
const server = new Server(
  {
    name: 'icp-mcp-test',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Tool: test/ping - Simple echo test
 */
async function handlePing(args: z.infer<typeof PingInputSchema>) {
  const message = args.message || 'pong';
  return {
    content: [
      {
        type: 'text' as const,
        text: `Echo: ${message}`,
      },
    ],
  };
}

/**
 * Tool: test/validate-candid - Test Candid validation
 */
async function handleValidateCandid(args: z.infer<typeof ValidateCandidInputSchema>) {
  // Simulate validation result
  const isValid = args.code.includes('service :');

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          valid: isValid,
          issues: isValid ? [] : [
            {
              severity: 'error',
              message: 'Missing service declaration',
              suggestion: 'Start with "service : { ... }"',
            },
          ],
        }, null, 2),
      },
    ],
  };
}

/**
 * Register tool handlers
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'test/ping',
        description: 'Simple echo test to verify MCP server is working',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Optional message to echo back',
            },
          },
        },
      },
      {
        name: 'test/validate-candid',
        description: 'Test Candid validation (simulated)',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Candid code to validate',
            },
          },
          required: ['code'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'test/ping': {
      const validatedArgs = PingInputSchema.parse(args);
      return await handlePing(validatedArgs);
    }
    case 'test/validate-candid': {
      const validatedArgs = ValidateCandidInputSchema.parse(args);
      return await handleValidateCandid(validatedArgs);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('ICP-MCP Test Server running');
  console.error('Available tools:');
  console.error('  - test/ping');
  console.error('  - test/validate-candid');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
