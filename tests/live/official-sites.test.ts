/**
 * Checks against the live official sites. Run with IC_MCP_LIVE=1.
 */

import { describe, it, expect } from 'vitest';
import { REFS } from '../../src/data/references.js';
import { fetchDocument, DocFetchError } from '../../src/fetchers/official.js';
import { query, QueryInputSchema } from '../../src/tools/query.js';
import { RECIPES } from '../../src/converters/dfx-to-icp.js';

const live = Boolean(process.env.IC_MCP_LIVE);

describe.skipIf(!live)('official sites', () => {
  const pages = Object.entries(REFS).filter(([name]) => name !== 'icpMcp' && name !== 'icpMcpConnector');

  it.each(pages)('%s resolves to its own page', async (_name, url) => {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    expect(response.status).toBe(200);
    const requested = new URL(url);
    const final = new URL(response.url);
    expect(final.hostname).toBe(requested.hostname);
    expect(final.pathname.replace(/\/$/, '')).toBe(requested.pathname.replace(/\/$/, ''));
  }, 20000);

  it('serves the ICP MCP page and a connector endpoint that requires sign-in', async () => {
    const page = await fetch(REFS.icpMcp, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    expect(page.status).toBe(200);
    expect(new URL(page.url).pathname).toMatch(/icp-mcp/);
    const connector = await fetch(REFS.icpMcpConnector, { signal: AbortSignal.timeout(15000) });
    expect(connector.status).toBe(401);
  }, 20000);

  it('rejects a legacy docs URL that redirects to the home page', async () => {
    await expect(fetchDocument('https://internetcomputer.org/docs/motoko/core/List', 'markdown')).rejects.toBeInstanceOf(DocFetchError);
  }, 20000);

  it('documents List from the official API reference', async () => {
    const result = await query(QueryInputSchema.parse({ operation: 'document', modules: ['List'], format: 'json' }));
    const data = JSON.parse(result.content[0].text);
    expect(data.modules[0].content).toContain('func add<T>(self : List<T>');
  }, 30000);

  it('finds the skills this server relies on', async () => {
    const result = await query(QueryInputSchema.parse({ operation: 'list-skills', format: 'json' }));
    const names = JSON.parse(result.content[0].text).skills.map((s: any) => s.name);
    for (const name of ['icp-cli', 'writing-motoko', 'mops-cli', 'cloud-engine-canisters', 'deploy-to-cloud-engine']) {
      expect(names).toContain(name);
    }
  }, 30000);

  it('uses recipe versions that are published', async () => {
    const response = await fetch('https://api.github.com/repos/dfinity/icp-cli-recipes/releases?per_page=100', {
      signal: AbortSignal.timeout(15000),
    });
    const tags = (await response.json()).map((r: any) => r.tag_name);
    for (const recipe of Object.values(RECIPES)) {
      const [, name, version] = recipe.match(/^@dfinity\/(.+)@(v[\d.]+)$/)!;
      expect(tags).toContain(`${name}-${version}`);
    }
  }, 20000);
});
