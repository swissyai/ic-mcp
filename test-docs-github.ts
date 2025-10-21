#!/usr/bin/env tsx
/**
 * Updated approach: Fetch ICP docs directly from GitHub (markdown)
 * Much better than HTML scraping!
 */

import { Octokit } from '@octokit/rest';

const octokit = new Octokit();

interface DocFile {
  path: string;
  name: string;
  content: string;
  topic: string;
}

/**
 * Fetch documentation markdown from dfinity/portal GitHub repo
 */
async function fetchDocsFromGitHub(path: string): Promise<DocFile[]> {
  try {
    // Fetch directory contents
    const { data } = await octokit.rest.repos.getContent({
      owner: 'dfinity',
      repo: 'portal',
      path,
    });

    const files: DocFile[] = [];

    if (Array.isArray(data)) {
      // Filter for markdown files
      const mdFiles = data.filter(
        (file) => file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.mdx'))
      );

      // Fetch content for each file
      for (const file of mdFiles.slice(0, 5)) {
        // Limit to 5 for testing
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner: 'dfinity',
          repo: 'portal',
          path: file.path,
        });

        if ('content' in fileData) {
          const content = Buffer.from(fileData.content, 'base64').toString('utf-8');

          files.push({
            path: file.path,
            name: file.name,
            content,
            topic: path.split('/').pop() || 'unknown',
          });
        }
      }
    }

    return files;
  } catch (error: any) {
    throw new Error(`Failed to fetch docs from GitHub: ${error.message}`);
  }
}

/**
 * Browse the docs structure to find available topics
 */
async function browseDocsStructure(basePath: string = 'docs'): Promise<string[]> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: 'dfinity',
      repo: 'portal',
      path: basePath,
    });

    if (Array.isArray(data)) {
      return data.filter((item) => item.type === 'dir').map((item) => item.name);
    }

    return [];
  } catch (error: any) {
    throw new Error(`Failed to browse docs structure: ${error.message}`);
  }
}

/**
 * Test the GitHub docs fetcher
 */
async function runTests() {
  console.log('🧪 Testing GitHub Docs Fetcher\n');

  // Test 1: Browse available doc categories
  console.log('Test 1: Browse docs structure');
  try {
    const categories = await browseDocsStructure('docs');
    console.log('Found categories:', categories.slice(0, 10));
    console.log('Total categories:', categories.length);
    console.log('✓ Test 1 passed\n');
  } catch (error: any) {
    console.error('✗ Test 1 failed:', error.message, '\n');
  }

  // Test 2: Fetch Motoko docs
  console.log('Test 2: Fetch Motoko documentation');
  try {
    // Try different possible paths
    const possiblePaths = [
      'docs/motoko',
      'docs/languages/motoko',
      'docs/current/motoko',
      'docs/developer-docs/smart-contracts/write/motoko',
    ];

    let docs: DocFile[] = [];
    let workingPath = '';

    for (const path of possiblePaths) {
      try {
        docs = await fetchDocsFromGitHub(path);
        if (docs.length > 0) {
          workingPath = path;
          break;
        }
      } catch (e) {
        // Try next path
        continue;
      }
    }

    if (docs.length > 0) {
      console.log('Working path:', workingPath);
      console.log('Files found:', docs.length);
      console.log('\nFile list:');
      docs.forEach((doc) => {
        console.log(`  - ${doc.name} (${doc.content.length} chars)`);
      });

      console.log('\n📄 First file preview (first 300 chars):\n');
      console.log(docs[0].content.substring(0, 300));
      console.log('...\n');
      console.log('✓ Test 2 passed\n');
    } else {
      console.log('⚠️  No docs found, trying to list subdirectories...\n');

      // List what's actually in the docs folder
      const { data } = await octokit.rest.repos.getContent({
        owner: 'dfinity',
        repo: 'portal',
        path: 'docs',
      });

      if (Array.isArray(data)) {
        console.log('Available paths in docs/:');
        data.slice(0, 20).forEach((item) => {
          console.log(`  ${item.type === 'dir' ? '📁' : '📄'} ${item.name}`);
        });
      }
    }
  } catch (error: any) {
    console.error('✗ Test 2 failed:', error.message, '\n');
  }

  // Test 3: Check rate limits
  console.log('Test 3: Check GitHub API rate limits');
  try {
    const { data } = await octokit.rest.rateLimit.get();
    console.log('Rate limit status:');
    console.log(`  Remaining: ${data.rate.remaining}/${data.rate.limit}`);
    console.log(`  Resets at: ${new Date(data.rate.reset * 1000).toLocaleString()}`);
    console.log('✓ Test 3 passed\n');
  } catch (error: any) {
    console.error('✗ Test 3 failed:', error.message, '\n');
  }

  console.log('🎉 GitHub docs fetcher tests completed!');
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { fetchDocsFromGitHub, browseDocsStructure, DocFile };
