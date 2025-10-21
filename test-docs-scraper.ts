#!/usr/bin/env tsx
/**
 * Quick prototype: ICP docs scraper (HTML → Markdown)
 * Tests the feasibility of fetching and converting docs
 */

import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import fetch from 'node-fetch';

interface DocContent {
  title: string;
  content: string;
  url: string;
  sections: { heading: string; content: string }[];
}

/**
 * Fetch and convert ICP documentation page to Markdown
 */
async function fetchDocs(url: string): Promise<DocContent> {
  try {
    // Fetch the page
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse HTML with cheerio
    const $ = cheerio.load(html);

    // Extract title
    const title = $('h1').first().text().trim() || $('title').text().trim();

    // Remove navigation, sidebar, footer (common bloat)
    $('nav, .sidebar, footer, .toc, .breadcrumbs, header').remove();

    // Find main content area (common selectors for doc sites)
    const mainContent = $('main, article, .content, .docs-content, [role="main"]').first();

    if (mainContent.length === 0) {
      console.warn('Could not find main content area, using body');
    }

    const contentHtml = mainContent.length > 0 ? mainContent.html() : $('body').html();

    // Convert HTML to Markdown
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    // Custom rules for better Candid/Motoko formatting
    turndown.addRule('codeBlocks', {
      filter: ['pre'],
      replacement: (content, node) => {
        const codeEl = $(node).find('code');
        const language = codeEl.attr('class')?.match(/language-(\w+)/)?.[1] || '';
        return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
      },
    });

    const markdown = turndown.turndown(contentHtml || '');

    // Extract sections (h2 headings)
    const sections: { heading: string; content: string }[] = [];
    let currentSection: { heading: string; content: string } | null = null;

    markdown.split('\n').forEach((line) => {
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { heading: line.replace('## ', ''), content: '' };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return {
      title,
      content: markdown,
      url,
      sections,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch docs: ${error.message}`);
  }
}

/**
 * Test the doc scraper
 */
async function runTests() {
  console.log('🧪 Testing ICP Docs Scraper\n');

  // Test 1: Fetch Motoko language guide
  console.log('Test 1: Fetch Motoko language overview');
  try {
    const docs = await fetchDocs('https://internetcomputer.org/docs/motoko/main/motoko');

    console.log('Title:', docs.title);
    console.log('URL:', docs.url);
    console.log('Content length:', docs.content.length, 'chars');
    console.log('Sections found:', docs.sections.length);
    console.log('\nFirst 3 sections:');
    docs.sections.slice(0, 3).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.heading} (${s.content.length} chars)`);
    });

    console.log('\n📄 Content preview (first 500 chars):\n');
    console.log(docs.content.substring(0, 500));
    console.log('...\n');

    console.log('✓ Test 1 passed:', docs.title.length > 0 && docs.content.length > 100);
  } catch (error: any) {
    console.error('✗ Test 1 failed:', error.message);
  }

  // Test 2: Fetch Candid reference
  console.log('\n---\n');
  console.log('Test 2: Fetch Candid reference');
  try {
    const docs = await fetchDocs('https://internetcomputer.org/docs/current/references/candid-ref');

    console.log('Title:', docs.title);
    console.log('Content length:', docs.content.length, 'chars');
    console.log('Sections found:', docs.sections.length);

    console.log('✓ Test 2 passed:', docs.title.includes('Candid') && docs.content.length > 100);
  } catch (error: any) {
    console.error('✗ Test 2 failed:', error.message);
  }

  console.log('\n🎉 Scraping tests completed!');
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { fetchDocs, DocContent };
