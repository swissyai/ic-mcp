/**
 * GitHub API client for fetching ICP documentation and examples
 */

import { Octokit } from '@octokit/rest';
import type { DocContent, ExampleFile } from '../types/index.js';
import { docsCache, examplesCache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // Optional, increases rate limit
});

const PORTAL_REPO = { owner: 'dfinity', repo: 'portal' };
const EXAMPLES_REPO = { owner: 'dfinity', repo: 'examples' };

/**
 * Fetch documentation content from dfinity/portal
 */
export async function fetchDocs(paths: string[]): Promise<DocContent[]> {
  const results: DocContent[] = [];

  for (const path of paths) {
    const cacheKey = `docs:${path}`;
    const cached = docsCache.get(cacheKey);

    if (cached) {
      logger.debug(`Using cached docs: ${path}`);
      results.push(cached);
      continue;
    }

    try {
      const { data } = await octokit.rest.repos.getContent({
        ...PORTAL_REPO,
        path,
      });

      if ('content' in data) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        // Extract frontmatter if present
        const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
        let title = path.split('/').pop() || 'Unknown';
        let description = '';
        let mainContent = content;

        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          mainContent = frontmatterMatch[2];

          const titleMatch = frontmatter.match(/title:\s*(.+)/);
          const descMatch = frontmatter.match(/description:\s*(.+)/);

          if (titleMatch) title = titleMatch[1].trim();
          if (descMatch) description = descMatch[1].trim();
        }

        const doc: DocContent = {
          topic: path.split('/').slice(-2, -1)[0] || 'docs',
          section: path.split('/').pop()?.replace('.mdx', '').replace('.md', ''),
          content: mainContent,
          url: `https://github.com/dfinity/portal/blob/master/${path}`,
          metadata: {
            title,
            description,
          },
        };

        docsCache.set(cacheKey, doc);
        results.push(doc);
      }
    } catch (error: any) {
      logger.error(`Failed to fetch docs from ${path}:`, error.message);
    }
  }

  return results;
}

/**
 * Browse documentation directory structure
 */
export async function browseDocsDirectory(path: string = 'docs'): Promise<string[]> {
  const cacheKey = `docs:dir:${path}`;
  const cached = docsCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const { data } = await octokit.rest.repos.getContent({
      ...PORTAL_REPO,
      path,
    });

    if (Array.isArray(data)) {
      const files = data
        .filter(item => item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.mdx')))
        .map(item => item.path!);

      docsCache.set(cacheKey, files, 60 * 60 * 1000); // Cache for 1 hour
      return files;
    }
  } catch (error: any) {
    logger.error(`Failed to browse docs directory ${path}:`, error.message);
  }

  return [];
}

/**
 * Fetch example from dfinity/examples
 */
export async function fetchExample(examplePath: string): Promise<ExampleFile | null> {
  const cacheKey = `example:${examplePath}`;
  const cached = examplesCache.get(cacheKey);

  if (cached) {
    logger.debug(`Using cached example: ${examplePath}`);
    return cached;
  }

  try {
    // First, get the directory contents
    const { data: contents } = await octokit.rest.repos.getContent({
      ...EXAMPLES_REPO,
      path: examplePath,
    });

    if (!Array.isArray(contents)) {
      return null;
    }

    const files: Record<string, string> = {};
    let readme = '';
    let dfxConfig: any = null;

    // Fetch relevant files
    for (const item of contents) {
      if (item.type === 'file') {
        // Fetch important files
        const shouldFetch =
          item.name === 'README.md' ||
          item.name === 'dfx.json' ||
          item.name.endsWith('.mo') ||
          item.name.endsWith('.rs') ||
          item.name.endsWith('.did');

        if (shouldFetch) {
          try {
            const { data: fileData } = await octokit.rest.repos.getContent({
              ...EXAMPLES_REPO,
              path: item.path!,
            });

            if ('content' in fileData) {
              const content = Buffer.from(fileData.content, 'base64').toString('utf-8');

              if (item.name === 'README.md') {
                readme = content;
              } else if (item.name === 'dfx.json') {
                dfxConfig = JSON.parse(content);
                files[item.name] = content;
              } else {
                files[item.name] = content;
              }
            }
          } catch (e) {
            logger.debug(`Could not fetch ${item.path}`);
          }
        }
      } else if (item.type === 'dir') {
        // Check backend/src directories
        if (item.name === 'backend' || item.name === 'src') {
          try {
            const { data: subContents } = await octokit.rest.repos.getContent({
              ...EXAMPLES_REPO,
              path: item.path!,
            });

            if (Array.isArray(subContents)) {
              for (const subItem of subContents) {
                if (
                  subItem.type === 'file' &&
                  (subItem.name.endsWith('.mo') ||
                    subItem.name.endsWith('.rs') ||
                    subItem.name.endsWith('.did'))
                ) {
                  const { data: fileData } = await octokit.rest.repos.getContent({
                    ...EXAMPLES_REPO,
                    path: subItem.path!,
                  });

                  if ('content' in fileData) {
                    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                    files[`${item.name}/${subItem.name}`] = content;
                  }
                }
              }
            }
          } catch (e) {
            logger.debug(`Could not fetch directory ${item.path}`);
          }
        }
      }
    }

    // Extract description from README
    let description = '';
    if (readme) {
      const descMatch = readme.match(/^#\s+.+?\n\n(.+?)(?:\n\n|$)/s);
      if (descMatch) {
        description = descMatch[1].trim();
      }
    }

    const language = examplePath.split('/')[0] as 'motoko' | 'rust' | 'c';
    const name = examplePath.split('/').pop() || examplePath;

    const example: ExampleFile = {
      name,
      description,
      language,
      path: examplePath,
      files,
      readme,
      dfxConfig,
      url: `https://github.com/dfinity/examples/tree/master/${examplePath}`,
    };

    examplesCache.set(cacheKey, example);
    return example;
  } catch (error: any) {
    logger.error(`Failed to fetch example ${examplePath}:`, error.message);
    return null;
  }
}

/**
 * List examples by language
 */
export async function listExamples(language: 'motoko' | 'rust' | 'svelte'): Promise<string[]> {
  const cacheKey = `examples:list:${language}`;
  const cached = examplesCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const { data } = await octokit.rest.repos.getContent({
      ...EXAMPLES_REPO,
      path: language,
    });

    if (Array.isArray(data)) {
      const examples = data.filter(item => item.type === 'dir').map(item => `${language}/${item.name}`);

      examplesCache.set(cacheKey, examples, 60 * 60 * 1000); // Cache for 1 hour
      return examples;
    }
  } catch (error: any) {
    logger.error(`Failed to list ${language} examples:`, error.message);
  }

  return [];
}
