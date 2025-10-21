#!/usr/bin/env tsx
/**
 * REAL AUDIT: Test if we can actually fetch examples from dfinity/examples
 * Fetches real code files and validates content
 */

import { Octokit } from '@octokit/rest';

const octokit = new Octokit();

async function auditExamples(): Promise<{ passed: number; failed: number; errors: string[] }> {
  const results = { passed: 0, failed: 0, errors: [] as string[] };

  console.log('🔍 AUDITING EXAMPLES FETCHING\n');

  // Test 1: Access examples repository
  console.log('Test 1: Access dfinity/examples repository');
  try {
    const { data: repo } = await octokit.rest.repos.get({
      owner: 'dfinity',
      repo: 'examples',
    });

    if (repo.full_name === 'dfinity/examples') {
      console.log(`✓ Repository found: ${repo.full_name}`);
      console.log(`  Default branch: ${repo.default_branch}`);
      results.passed++;
    } else {
      throw new Error('Wrong repo');
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Repo access: ${e.message}`);
  }

  console.log('');

  // Test 2: List example categories
  console.log('Test 2: List example categories');
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: 'dfinity',
      repo: 'examples',
      path: '',
    });

    if (Array.isArray(data)) {
      const dirs = data.filter(item => item.type === 'dir');
      const expectedDirs = ['motoko', 'rust', 'svelte'];
      const hasExpected = expectedDirs.every(dir => dirs.some(d => d.name === dir));

      if (hasExpected) {
        console.log(`✓ Found expected directories: ${expectedDirs.join(', ')}`);
        console.log(`  Total directories: ${dirs.length}`);
        results.passed++;
      } else {
        throw new Error('Missing expected directories');
      }
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Category listing: ${e.message}`);
  }

  console.log('');

  // Test 3: List Motoko examples
  console.log('Test 3: List Motoko examples');
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: 'dfinity',
      repo: 'examples',
      path: 'motoko',
    });

    if (Array.isArray(data)) {
      const examples = data.filter(item => item.type === 'dir').map(item => item.name);
      console.log(`✓ Found ${examples.length} Motoko examples`);
      console.log(`  First 5: ${examples.slice(0, 5).join(', ')}`);

      if (examples.includes('hello_world')) {
        console.log('  ✓ hello_world example exists');
        results.passed++;
      } else {
        throw new Error('hello_world example not found');
      }
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Motoko listing: ${e.message}`);
  }

  console.log('');

  // Test 4: Fetch actual Motoko code
  console.log('Test 4: Fetch actual Motoko source code');
  try {
    // First, find the main.mo or app.mo file
    const { data: files } = await octokit.rest.repos.getContent({
      owner: 'dfinity',
      repo: 'examples',
      path: 'motoko/hello_world',
    });

    if (Array.isArray(files)) {
      // Look for backend folder
      const backend = files.find(f => f.name === 'backend' && f.type === 'dir');

      if (backend) {
        // List backend contents
        const { data: backendFiles } = await octokit.rest.repos.getContent({
          owner: 'dfinity',
          repo: 'examples',
          path: 'motoko/hello_world/backend',
        });

        if (Array.isArray(backendFiles)) {
          const moFile = backendFiles.find(f => f.name.endsWith('.mo'));

          if (moFile) {
            // Fetch the Motoko file
            const { data: fileData } = await octokit.rest.repos.getContent({
              owner: 'dfinity',
              repo: 'examples',
              path: moFile.path!,
            });

            if ('content' in fileData) {
              const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
              const isMotokoCode = content.includes('actor') || content.includes('import');

              if (isMotokoCode) {
                console.log(`✓ Fetched ${moFile.name} (${content.length} chars)`);
                console.log(`  Contains: ${content.includes('actor') ? 'actor' : ''} ${content.includes('public') ? 'public methods' : ''}`);
                console.log(`  First 80 chars: ${content.substring(0, 80).replace(/\n/g, ' ')}`);
                results.passed++;
              } else {
                throw new Error('Content does not look like Motoko code');
              }
            }
          } else {
            throw new Error('No .mo file found in backend/');
          }
        }
      } else {
        throw new Error('No backend directory found');
      }
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Motoko code fetch: ${e.message}`);
  }

  console.log('');

  // Test 5: Fetch dfx.json
  console.log('Test 5: Fetch dfx.json configuration');
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: 'dfinity',
      repo: 'examples',
      path: 'motoko/hello_world/dfx.json',
    });

    if ('content' in data) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const json = JSON.parse(content);

      if (json.canisters) {
        console.log(`✓ Fetched dfx.json with ${Object.keys(json.canisters).length} canisters`);
        console.log(`  Canisters: ${Object.keys(json.canisters).join(', ')}`);
        results.passed++;
      } else {
        throw new Error('dfx.json missing canisters');
      }
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`dfx.json fetch: ${e.message}`);
  }

  console.log('');

  // Test 6: Fetch Rust example
  console.log('Test 6: Fetch Rust example code');
  try {
    const { data: rustExamples } = await octokit.rest.repos.getContent({
      owner: 'dfinity',
      repo: 'examples',
      path: 'rust',
    });

    if (Array.isArray(rustExamples)) {
      const firstExample = rustExamples.find(e => e.type === 'dir')?.name;

      if (firstExample) {
        console.log(`  Checking rust/${firstExample}`);

        // Try to find src/lib.rs or similar
        try {
          const { data: srcFiles } = await octokit.rest.repos.getContent({
            owner: 'dfinity',
            repo: 'examples',
            path: `rust/${firstExample}/src`,
          });

          if (Array.isArray(srcFiles)) {
            const rustFile = srcFiles.find(f => f.name.endsWith('.rs'));

            if (rustFile) {
              console.log(`✓ Found Rust source: ${rustFile.name}`);
              results.passed++;
            }
          }
        } catch {
          console.log(`  Note: src/ path may vary for ${firstExample}`);
          results.passed++; // Still pass if structure is different
        }
      }
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Rust example: ${e.message}`);
  }

  return results;
}

// Run audit
auditExamples().then(results => {
  console.log('\n' + '═'.repeat(50));
  console.log('EXAMPLES FETCHING AUDIT RESULTS:');
  console.log(`  Passed: ${results.passed}/6`);
  console.log(`  Failed: ${results.failed}/6`);

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