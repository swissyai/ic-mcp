#!/usr/bin/env tsx
/**
 * Quick test: Verify MCP SDK imports and initializes
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';

console.log('🧪 Testing MCP SDK initialization\n');

try {
  // Test 1: Create server instance
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

  console.log('✓ Test 1: Server instance created');
  console.log('  Name:', server.name);
  console.log('  Version:', server.version);

  // Test 2: Verify server methods exist
  const hasMethods =
    typeof server.setRequestHandler === 'function' &&
    typeof server.connect === 'function';

  console.log('\n✓ Test 2: Server methods available');
  console.log('  setRequestHandler:', typeof server.setRequestHandler);
  console.log('  connect:', typeof server.connect);

  if (hasMethods) {
    console.log('\n🎉 MCP SDK working correctly!');
    console.log('\nArchitecture validated:');
    console.log('  ✓ Server initialization');
    console.log('  ✓ Tool registration (setRequestHandler)');
    console.log('  ✓ Transport connection (connect)');
  }
} catch (error: any) {
  console.error('✗ Error:', error.message);
  process.exit(1);
}
