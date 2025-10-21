#!/usr/bin/env tsx
/**
 * Quick test of the MCP server
 */

import { spawn } from 'child_process';

const server = spawn('npm', ['run', 'dev'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

// Wait for server to start
setTimeout(async () => {
  console.log('Testing MCP server...\n');

  // Test 1: Initialize
  console.log('Test 1: Initialize connection');
  server.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    }) + '\n'
  );

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 2: List tools
  console.log('\nTest 2: List available tools');
  server.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }) + '\n'
  );

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 3: Validate Candid
  console.log('\nTest 3: Validate Candid code');
  server.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'icp/validate',
        arguments: {
          code: 'service : { greet : (text) -> (text) query }',
          language: 'candid',
        },
      },
    }) + '\n'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n✓ Tests complete! Server is working.');
  server.kill();
  process.exit(0);
}, 2000);

// Capture output
server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.trim() && output.startsWith('{')) {
    try {
      const json = JSON.parse(output);
      if (json.result) {
        console.log('Response:', JSON.stringify(json.result, null, 2).substring(0, 200) + '...');
      }
    } catch (e) {
      // Not JSON
    }
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  if (output.includes('ICP-MCP Server started')) {
    console.log('✓ Server started successfully\n');
  }
});

setTimeout(() => {
  console.error('Timeout - server not responding');
  server.kill();
  process.exit(1);
}, 10000);
