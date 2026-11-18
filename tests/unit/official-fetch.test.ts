import { describe, it, expect, afterEach } from 'vitest';
import { installFakeWeb, type FakeWeb } from '../helpers/fake-web.js';
import {
  fetchDocument,
  getDocument,
  DocFetchError,
  assertAllowedDocUrl,
} from '../../src/fetchers/official.js';

let web: FakeWeb;
afterEach(() => web?.restore());

describe('fetchDocument', () => {
  it('rejects a redirect to the docs home page instead of returning it', async () => {
    web = installFakeWeb();
    const attempt = fetchDocument('https://internetcomputer.org/docs/motoko/core/List', 'markdown');
    await expect(attempt).rejects.toBeInstanceOf(DocFetchError);
    await expect(attempt).rejects.toMatchObject({ code: 'redirected', finalUrl: 'https://docs.internetcomputer.org/' });
  });

  it('rejects HTML when markdown was requested', async () => {
    web = installFakeWeb();
    web.routes['https://docs.internetcomputer.org/guides/x.md'] = { type: 'text/html', body: '<!doctype html><p>x</p>' };
    await expect(fetchDocument('https://docs.internetcomputer.org/guides/x.md', 'markdown')).rejects.toMatchObject({
      code: 'wrong-content',
    });
  });

  it('rejects an HTML body even when the content type claims plain text', async () => {
    web = installFakeWeb();
    web.routes['https://docs.internetcomputer.org/guides/y.md'] = { type: 'text/plain', body: '<html><body>home</body></html>' };
    await expect(fetchDocument('https://docs.internetcomputer.org/guides/y.md', 'markdown')).rejects.toMatchObject({
      code: 'wrong-content',
    });
  });

  it('reports 404 as not-found', async () => {
    web = installFakeWeb();
    await expect(fetchDocument('https://docs.internetcomputer.org/missing.md', 'markdown')).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('returns markdown that is the requested page', async () => {
    web = installFakeWeb();
    const { text } = await fetchDocument('https://cli.internetcomputer.org/llms.txt', 'markdown');
    expect(text).toContain('# ICP CLI Documentation');
  });
});

describe('getDocument cache', () => {
  it('serves a fresh copy from cache without a request', async () => {
    web = installFakeWeb();
    await getDocument('https://cli.internetcomputer.org/llms.txt', 'markdown');
    await getDocument('https://cli.internetcomputer.org/llms.txt', 'markdown');
    expect(web.requests.filter(u => u.endsWith('llms.txt'))).toHaveLength(1);
  });

  it('marks a cached copy stale when a refresh fails', async () => {
    web = installFakeWeb();
    await getDocument('https://cli.internetcomputer.org/llms.txt', 'markdown');
    web.offline = true;
    const { text, meta } = await getDocument('https://cli.internetcomputer.org/llms.txt', 'markdown', { refresh: true });
    expect(text).toContain('ICP CLI');
    expect(meta.stale).toBe(true);
    expect(meta.warning).toMatch(/Could not refresh/);
  });

  it('raises unreachable when there is no cached copy', async () => {
    web = installFakeWeb();
    web.offline = true;
    await expect(getDocument('https://docs.internetcomputer.org/llms.txt', 'markdown')).rejects.toMatchObject({
      code: 'unreachable',
    });
  });
});

describe('assertAllowedDocUrl', () => {
  it('accepts official docs hosts over https', () => {
    expect(assertAllowedDocUrl('https://docs.internetcomputer.org/guides/backends/timers.md').hostname).toBe(
      'docs.internetcomputer.org'
    );
  });

  it('refuses other hosts and plain http', () => {
    expect(() => assertAllowedDocUrl('https://example.com/a.md')).toThrow(DocFetchError);
    expect(() => assertAllowedDocUrl('http://docs.internetcomputer.org/a.md')).toThrow(DocFetchError);
  });
});
