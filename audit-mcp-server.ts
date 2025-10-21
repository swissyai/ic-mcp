#!/usr/bin/env tsx
/**
 * REAL AUDIT: Test if MCP server can actually handle JSON-RPC requests
 * This will spawn the server and send real requests
 */

import { spawn } from 'child_process';
import { join } from 'path';

const SERVER_PATH = join(__dirname, 'test-mcp-server.ts');

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

function sendRequest(server: any, request: JsonRpcRequest): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 5000);

    // Listen for response
    const handler = (data: Buffer) => {
      const lines = data.toString().split('\n');

      for (const line of lines) {
        if (line.trim() && line.startsWith('{')) {
          try {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              clearTimeout(timeoutId);
              server.stdout.off('data', handler);
              resolve(response);
            }
          } catch (e) {
            // Not JSON, ignore
          }
        }
      }
    };

    server.stdout.on('data', handler);

    // Send request
    server.stdin.write(JSON.stringify(request) + '\n');
  });
}

async function auditMCPServer(): Promise<{ passed: number; failed: number; errors: string[] }> {
  const results = { passed: 0, failed: 0, errors: [] as string[] };

  console.log('🔍 AUDITING MCP SERVER COMMUNICATION\n');

  // Test 1: Can we spawn the server?
  console.log('Test 1: Spawn MCP server');

  const server = spawn('npx', ['tsx', SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let serverStarted = false;

  // Wait for server to start
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.log('✗ Server failed to start within 3 seconds');
      resolve();
    }, 3000);

    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('ICP-MCP Test Server running')) {
        serverStarted = true;
        clearTimeout(timeout);
        console.log('✓ Server started successfully');
        results.passed++;
        resolve();
      }
    });
  });

  if (!serverStarted) {
    results.failed++;
    results.errors.push('Server failed to start');
    server.kill();
    return results;
  }

  console.log('');

  // Test 2: Initialize connection
  console.log('Test 2: Initialize MCP connection');
  try {
    const initRequest: JsonRpcRequest = {
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
    };

    const response = await sendRequest(server, initRequest);

    if (response.result) {
      console.log('✓ Initialization successful');
      console.log(`  Server: ${response.result.serverInfo?.name || 'unnamed'}`);
      console.log(`  Version: ${response.result.serverInfo?.version || 'unknown'}`);
      results.passed++;
    } else {
      throw new Error(response.error?.message || 'No result');
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Initialize: ${e.message}`);
  }

  console.log('');

  // Test 3: List tools
  console.log('Test 3: List available tools');
  try {
    const listRequest: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    };

    const response = await sendRequest(server, listRequest);

    if (response.result?.tools) {
      const tools = response.result.tools;
      console.log(`✓ Found ${tools.length} tools`);
      tools.forEach((tool: any) => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });

      if (tools.length >= 2) {
        results.passed++;
      } else {
        throw new Error('Expected at least 2 tools');
      }
    } else {
      throw new Error(response.error?.message || 'No tools in response');
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`List tools: ${e.message}`);
  }

  console.log('');

  // Test 4: Call ping tool
  console.log('Test 4: Call test/ping tool');
  try {
    const callRequest: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'test/ping',
        arguments: {
          message: 'Hello MCP',
        },
      },
    };

    const response = await sendRequest(server, callRequest);

    if (response.result?.content) {
      const content = response.result.content[0]?.text;
      if (content?.includes('Hello MCP')) {
        console.log(`✓ Tool called successfully`);
        console.log(`  Response: ${content}`);
        results.passed++;
      } else {
        throw new Error('Unexpected response content');
      }
    } else {
      throw new Error(response.error?.message || 'No content in response');
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Call ping: ${e.message}`);
  }

  console.log('');

  // Test 5: Call validate-candid tool
  console.log('Test 5: Call test/validate-candid tool');
  try {
    const callRequest: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'test/validate-candid',
        arguments: {
          code: 'service : { greet : (text) -> (text) }',
        },
      },
    };

    const response = await sendRequest(server, callRequest);

    if (response.result?.content) {
      const content = response.result.content[0]?.text;
      if (content) {
        const validation = JSON.parse(content);
        console.log(`✓ Validation tool called`);
        console.log(`  Result: ${validation.valid ? 'valid' : 'invalid'}`);
        results.passed++;
      }
    } else {
      throw new Error(response.error?.message || 'No validation result');
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Call validate: ${e.message}`);
  }

  // Cleanup
  server.kill();

  return results;
}

// Run audit
auditMCPServer().then(results => {
  console.log('\n' + '═'.repeat(50));
  console.log('MCP SERVER COMMUNICATION AUDIT RESULTS:');
  console.log(`  Passed: ${results.passed}/5`);
  console.log(`  Failed: ${results.failed}/5`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('\nVERDICT:', results.failed === 0 ? '✅ WORKING' : results.failed <= 1 ? '⚠️  MOSTLY WORKING' : '❌ NOT WORKING');

  process.exit(results.failed === 0 ? 0 : 1);
}).catch(e => {
  console.error('CRITICAL ERROR:', e);
  process.exit(1);
});