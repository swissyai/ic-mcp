#!/usr/bin/env tsx
/**
 * REAL AUDIT: Test if GitHub API docs fetching actually works
 * No fake data, real API calls
 */

import { Octokit } from '@octokit/rest';

const octokit = new Octokit();

async function auditGitHubDocs(): Promise<{ passed: number; failed: number; errors: string[] }> {
  const results = { passed: 0, failed: 0, errors: [] as string[] };

  console.log('🔍 AUDITING GITHUB DOCS FETCHING\n');

  // Test 1: Can we access the repo?
  console.log('Test 1: Access dfinity/portal repository');
  try {
    const { data: repo } = await octokit.rest.repos.get({
      owner: 'dfinity',
      repo: 'portal',
    });

    if (repo.full_name === 'dfinity/portal') {
      console.log(`✓ Repository found: ${repo.full_name}`);
      console.log(`  Description: ${repo.description}`);
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

  // Test 2: Can we list docs directory?
  console.log('Test 2: List docs directory');
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: 'dfinity',
      repo: 'portal',
      path: 'docs',
    });

    if (Array.isArray(data)) {
      const dirs = data.filter(item => item.type === 'dir').map(item => item.name);
      console.log(`✓ Found ${dirs.length} directories in docs/`);
      console.log(`  First 5: ${dirs.slice(0, 5).join(', ')}`);
      results.passed++;
    } else {
      throw new Error('docs is not a directory');
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Docs listing: ${e.message}`);
  }

  console.log('');

  // Test 3: Can we fetch an actual markdown file?
  console.log('Test 3: Fetch actual markdown content');
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: 'dfinity',
      repo: 'portal',
      path: 'docs/home.mdx',
    });

    if ('content' in data) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const hasMarkdown = content.includes('---') && content.includes('title:');

      if (hasMarkdown) {
        console.log(`✓ Fetched markdown file (${content.length} chars)`);
        console.log(`  First 100 chars: ${content.substring(0, 100).replace(/\n/g, ' ')}`);
        results.passed++;
      } else {
        throw new Error('Content does not look like markdown');
      }
    } else {
      throw new Error('No content in response');
    }
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Markdown fetch: ${e.message}`);
  }

  console.log('');

  // Test 4: Can we navigate to Motoko docs?
  console.log('Test 4: Navigate to language-specific docs');
  const paths = [
    'docs/building-apps/developing-canisters',
    'docs/references',
    'docs/tutorials',
  ];

  for (const path of paths) {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: 'dfinity',
        repo: 'portal',
        path,
      });

      if (Array.isArray(data)) {
        const mdFiles = data.filter(item =>
          item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.mdx'))
        );
        console.log(`✓ ${path}: ${mdFiles.length} markdown files`);
        results.passed++;
      }
    } catch (e: any) {
      console.log(`✗ ${path}: ${e.message}`);
      results.failed++;
      results.errors.push(`${path}: ${e.message}`);
    }
  }

  console.log('');

  // Test 5: Rate limit check
  console.log('Test 5: Check rate limits');
  try {
    const { data } = await octokit.rest.rateLimit.get();
    console.log(`✓ Rate limit: ${data.rate.remaining}/${data.rate.limit} remaining`);

    if (data.rate.remaining < 10) {
      console.log('  ⚠️  WARNING: Low rate limit remaining');
    }

    results.passed++;
  } catch (e: any) {
    console.log(`✗ FAIL: ${e.message}`);
    results.failed++;
    results.errors.push(`Rate limit: ${e.message}`);
  }

  return results;
}

// Run audit
auditGitHubDocs().then(results => {
  console.log('\n' + '═'.repeat(50));
  console.log('GITHUB DOCS FETCHING AUDIT RESULTS:');
  console.log(`  Passed: ${results.passed}/8`);
  console.log(`  Failed: ${results.failed}/8`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('\nVERDICT:', results.failed === 0 ? '✅ WORKING' : results.failed <= 2 ? '⚠️  MOSTLY WORKING' : '❌ NOT WORKING');

  process.exit(results.failed === 0 ? 0 : 1);
}).catch(e => {
  console.error('CRITICAL ERROR:', e);
  process.exit(1);
});