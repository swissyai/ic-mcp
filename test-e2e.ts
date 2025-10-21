#!/usr/bin/env tsx
/**
 * End-to-end test of ICP-MCP server
 * Tests all three tools with real scenarios
 */

import { spawn } from 'child_process';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function sendRequest(server: any, request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 10000);

    const handler = (data: Buffer) => {
      const lines = data.toString().split('\n');

      for (const line of lines) {
        if (line.trim() && line.startsWith('{')) {
          try {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              clearTimeout(timeout);
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
    server.stdin.write(JSON.stringify(request) + '\n');
  });
}

async function runTests() {
  console.log('🧪 ICP-MCP End-to-End Tests\n');
  console.log('Starting server...\n');

  const server = spawn('npm', ['run', 'dev'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Wait for server to start
  await new Promise<void>((resolve) => {
    server.stderr.on('data', (data) => {
      if (data.toString().includes('ICP-MCP Server started')) {
        console.log('✓ Server started\n');
        resolve();
      }
    });

    setTimeout(() => resolve(), 3000);
  });

  try {
    // Test 1: Initialize
    console.log('Test 1: Server initialization');
    const initResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    });

    if (initResponse.result?.serverInfo?.name === 'icp-mcp') {
      console.log('  ✓ Initialized successfully');
      results.push({ name: 'Initialize', passed: true });
    } else {
      throw new Error('Invalid init response');
    }

    // Test 2: List tools
    console.log('\nTest 2: List tools');
    const listResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    const tools = listResponse.result?.tools || [];
    const expectedTools = ['icp/validate', 'icp/get-docs', 'icp/get-example'];
    const hasAllTools = expectedTools.every((t) => tools.some((tool: any) => tool.name === t));

    if (hasAllTools) {
      console.log(`  ✓ Found all ${expectedTools.length} tools`);
      results.push({ name: 'List tools', passed: true });
    } else {
      throw new Error('Missing tools');
    }

    // Test 3: Validate valid Candid
    console.log('\nTest 3: Validate valid Candid code');
    const validateValidResponse = await sendRequest(server, {
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
    });

    const validResult = JSON.parse(validateValidResponse.result?.content[0]?.text || '{}');
    if (validResult.valid === true) {
      console.log('  ✓ Valid Candid accepted');
      results.push({ name: 'Validate valid Candid', passed: true });
    } else {
      throw new Error('Failed to validate valid Candid');
    }

    // Test 4: Validate invalid Candid
    console.log('\nTest 4: Validate invalid Candid code');
    const validateInvalidResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'icp/validate',
        arguments: {
          code: 'service : { invalid syntax }',
          language: 'candid',
        },
      },
    });

    const invalidResult = JSON.parse(validateInvalidResponse.result?.content[0]?.text || '{}');
    if (invalidResult.valid === false && invalidResult.issues.length > 0) {
      console.log(`  ✓ Invalid Candid rejected (${invalidResult.issues.length} issues found)`);
      results.push({ name: 'Validate invalid Candid', passed: true });
    } else {
      throw new Error('Failed to detect invalid Candid');
    }

    // Test 5: Validate Motoko code
    console.log('\nTest 5: Validate Motoko code');
    const motokoCode = `
      actor HelloWorld {
        public query func greet(name : Text) : async Text {
          return "Hello, " # name # "!";
        };
      }
    `;

    const validateMotokoResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'icp/validate',
        arguments: {
          code: motokoCode,
          language: 'motoko',
        },
      },
    });

    const motokoResult = JSON.parse(validateMotokoResponse.result?.content[0]?.text || '{}');
    if (motokoResult.valid !== undefined) {
      console.log(`  ✓ Motoko validation working (issues: ${motokoResult.issues.length})`);
      results.push({ name: 'Validate Motoko', passed: true });
    } else {
      throw new Error('Motoko validation failed');
    }

    // Test 6: Browse docs directory
    console.log('\nTest 6: Browse documentation directory');
    const browseDocsResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'icp/get-docs',
        arguments: {
          directory: 'docs/building-apps',
        },
      },
    });

    const browseResult = JSON.parse(browseDocsResponse.result?.content[0]?.text || '{}');
    if (browseResult.files && browseResult.files.length > 0) {
      console.log(`  ✓ Found ${browseResult.files.length} documentation files`);
      results.push({ name: 'Browse docs', passed: true });
    } else {
      throw new Error('No docs found');
    }

    // Test 7: List examples
    console.log('\nTest 7: List Motoko examples');
    const listExamplesResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'icp/get-example',
        arguments: {
          language: 'motoko',
          list: true,
        },
      },
    });

    const examplesResult = JSON.parse(listExamplesResponse.result?.content[0]?.text || '{}');
    if (examplesResult.examples && examplesResult.count > 0) {
      console.log(`  ✓ Found ${examplesResult.count} Motoko examples`);
      results.push({ name: 'List examples', passed: true });
    } else {
      throw new Error('No examples found');
    }

    // Test 8: Fetch specific example
    console.log('\nTest 8: Fetch hello_world example');
    const fetchExampleResponse = await sendRequest(server, {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'icp/get-example',
        arguments: {
          language: 'motoko',
          exampleName: 'hello_world',
        },
      },
    });

    const exampleResult = JSON.parse(fetchExampleResponse.result?.content[0]?.text || '{}');
    if (exampleResult.files && Object.keys(exampleResult.files).length > 0) {
      console.log(`  ✓ Fetched example with ${Object.keys(exampleResult.files).length} files`);
      results.push({ name: 'Fetch example', passed: true });
    } else {
      throw new Error('Failed to fetch example');
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));

    const passed = results.filter((r) => r.passed).length;
    const total = results.length;

    results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}${r.error ? `: ${r.error}` : ''}`);
    });

    console.log(`\nTotal: ${passed}/${total} passed`);

    if (passed === total) {
      console.log('\n🎉 All tests passed!');
      server.kill();
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed');
      server.kill();
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Test error:', error.message);
    server.kill();
    process.exit(1);
  }
}

runTests().catch(console.error);
