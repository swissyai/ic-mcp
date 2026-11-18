import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { installFakeWeb, type FakeWeb } from '../helpers/fake-web.js';
import { query, QueryInputSchema } from '../../src/tools/query.js';

let web: FakeWeb;
beforeEach(() => {
  web = installFakeWeb();
});
afterEach(() => web.restore());

async function run(args: Record<string, any>) {
  const result = await query(QueryInputSchema.parse({ format: 'json', ...args }));
  return { result, data: JSON.parse(result.content[0].text) };
}

describe('document', () => {
  it('returns the List API from the official reference, not a docs home page', async () => {
    const { data, result } = await run({ operation: 'document', modules: ['List'] });
    expect(result.isError).toBeUndefined();
    expect(data.modules[0].name).toBe('List');
    expect(data.modules[0].content).toContain('func add<T>(self : List<T>, element : T)');
    expect(JSON.stringify(data)).not.toContain('Create AIware');
    expect(data.source.url).toContain('writing-motoko/references/api-reference.md');
    expect(data.source.stale).toBe(false);
  });

  it('accepts mo:core/ prefixes and any case', async () => {
    const { data } = await run({ operation: 'document', modules: ['mo:core/map'] });
    expect(data.modules[0].name).toBe('Map');
  });

  it('reports unknown modules as errors', async () => {
    const { data, result } = await run({ operation: 'document', modules: ['NonExistentModule'] });
    expect(result.isError).toBe(true);
    expect(data.modules[0].error).toMatch(/not a module/);
    expect(data.available).toContain('List');
  });

  it('fails clearly when the reference is unreachable', async () => {
    web.offline = true;
    const { data, result } = await run({ operation: 'document', modules: ['List'] });
    expect(result.isError).toBe(true);
    expect(data.code).toBe('unreachable');
    expect(data.modules).toBeUndefined();
  });

  it('requires modules or a query', async () => {
    const { data } = await run({ operation: 'document' });
    expect(data.error).toBeDefined();
  });
});

describe('skill', () => {
  it('returns an outline without content', async () => {
    const { data } = await run({ operation: 'skill', name: 'icp-cli' });
    expect(data.sections.map((s: any) => s.id)).toEqual(['0', '1', '2', '2.1', '2.2', '3']);
    expect(data.content).toBeUndefined();
    expect(data.files).toContain('references/dfx-migration.md');
  });

  it('returns one section by heading', async () => {
    const { data } = await run({ operation: 'skill', name: 'icp-cli', section: 'Configuration' });
    expect(data.section.id).toBe('3');
    expect(data.content).toContain('Recipes must be pinned');
    expect(data.content).not.toContain('Common Pitfalls');
  });

  it('returns the best section for a query, with other matches', async () => {
    const { data } = await run({ operation: 'skill', name: 'icp-cli', query: 'mainnet identity' });
    expect(data.section.title).toBe('Identities on mainnet');
    expect(data.section.selectedBy).toBe('query');
  });

  it('shows the introduction of a long section and lists its subsections', async () => {
    const { data } = await run({ operation: 'skill', name: 'icp-cli', section: '2', maxChars: 500 });
    expect(data.subsections.map((s: any) => s.id)).toEqual(['2.1', '2.2']);
  });

  it('suggests names for an unknown skill', async () => {
    const { data, result } = await run({ operation: 'skill', name: 'motoko' });
    expect(result.isError).toBe(true);
    expect(data.suggestions).toContain('writing-motoko');
  });

  it('reads skill reference files listed in the index only', async () => {
    const ok = await run({ operation: 'skill', name: 'writing-motoko', file: 'references/examples.md' });
    expect(ok.data.sections.length).toBeGreaterThan(0);
    const bad = await run({ operation: 'skill', name: 'writing-motoko', file: '../../etc/passwd' });
    expect(bad.result.isError).toBe(true);
  });

  it('renders section content as plain markdown in toon format', async () => {
    const result = await query(QueryInputSchema.parse({ operation: 'skill', name: 'icp-cli', section: '3' }));
    expect(result.content[0].text).toContain('\n---\n\n## Configuration\n\nRecipes must be pinned');
  });
});

describe('search and list-skills', () => {
  it('ranks skills and docs pages', async () => {
    const { data } = await run({ operation: 'search', query: 'deploy mainnet' });
    const titles = data.results.map((r: any) => r.title);
    expect(titles).toContain('Deploying to IC Mainnet');
    expect(titles).toContain('ICP CLI');
    const page = data.results.find((r: any) => r.title === 'Deploying to IC Mainnet');
    expect(page.next).toEqual({ operation: 'page', url: page.url, query: 'deploy mainnet' });
  });

  it('reports an unreachable source and searches the rest', async () => {
    web.routes['https://docs.internetcomputer.org/llms.txt'] = { type: 'text/html', body: '<!doctype html>' };
    const { data } = await run({ operation: 'search', query: 'timers' });
    expect(data.unavailable[0].source).toBe('docs');
  });

  it('lists skills with category and summary', async () => {
    const { data } = await run({ operation: 'list-skills' });
    expect(data.total).toBe(3);
    expect(data.skills[2]).toMatchObject({ name: 'cloud-engine-canisters', category: 'CloudEngine' });
  });
});

describe('page', () => {
  it('reads a docs page section and adds .md when missing', async () => {
    const { data } = await run({
      operation: 'page',
      url: 'https://cli.internetcomputer.org/1.8/guides/deploying-to-mainnet',
      query: 'cycles',
    });
    expect(data.section.title).toBe('Get cycles');
    expect(data.source.url).toBe('https://cli.internetcomputer.org/1.8/guides/deploying-to-mainnet.md');
  });

  it('refuses other hosts', async () => {
    const { data, result } = await run({ operation: 'page', url: 'https://example.com/a.md' });
    expect(result.isError).toBe(true);
    expect(data.code).toBe('disallowed-url');
  });
});

describe('list-all and examples', () => {
  it('lists modules from the official reference', async () => {
    const { data } = await run({ operation: 'list-all' });
    expect(data.modules.map((m: any) => m.name)).toEqual(['List', 'Map']);
    expect(data.modules[1].import).toBe('import Map "mo:core/Map";');
  });

  it('falls back to the bundled list, marked offline', async () => {
    web.offline = true;
    const { data } = await run({ operation: 'list-all' });
    expect(data.offline).toBe(true);
    expect(data.total).toBeGreaterThan(40);
  });

  it('returns official code that imports the module', async () => {
    const { data } = await run({ operation: 'examples', modules: ['Map', 'Queue'], limit: 5 });
    expect(data.modules[0].examples.length).toBe(3);
    expect(data.modules[0].examples.map((e: any) => e.section)).toEqual(['Collections', 'Map Examples', 'Complex Key Types']);
    expect(data.modules[0].examples.every((e: any) => e.code.includes('"mo:core/Map"'))).toBe(true);
    expect(data.modules[1].hasExamples).toBe(false);
  });
});

describe('legacy filter option', () => {
  it('reads filter.maxLength as maxChars', async () => {
    const { data } = await run({ operation: 'skill', name: 'icp-cli', section: '1', filter: { maxLength: 200 } });
    expect(data.content.length).toBeLessThanOrEqual(200);
  });
});
