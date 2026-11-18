/**
 * Query and action workflows against the fake official sites.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { query, QueryInputSchema } from '../../src/tools/query.js';
import { action, ActionInputSchema } from '../../src/tools/action.js';
import { installFakeWeb, type FakeWeb } from '../helpers/fake-web.js';

let web: FakeWeb;
beforeEach(() => {
  web = installFakeWeb();
});
afterEach(() => web.restore());

async function q(args: Record<string, any>) {
  const result = await query(QueryInputSchema.parse({ format: 'json', ...args }));
  return JSON.parse(result.content[0].text || '{}');
}

describe('Query tool', () => {
  it('lists mo:core modules from the official API reference', async () => {
    const data = await q({ operation: 'list-all' });
    expect(data.total).toBe(2);
    expect(data.source.url).toContain('api-reference.md');
  });

  it('documents requested modules', async () => {
    const data = await q({ operation: 'document', modules: ['List', 'Map'] });
    expect(data.modules.map((m: any) => m.name)).toEqual(['List', 'Map']);
  });

  it('supports a search, outline, section journey', async () => {
    const search = await q({ operation: 'search', query: 'motoko null coalesce' });
    const skillHit = search.results.find((r: any) => r.source === 'skills');
    expect(skillHit.name).toBe('writing-motoko');

    const section = await q(skillHit.next);
    expect(section.section.title).toBe('Null Coalesce');
    expect(section.content).toContain('??');
  });
});

describe('Action tool', () => {
  it('resolves an operation id and validates its context', async () => {
    const result = await action(ActionInputSchema.parse({ action: 'call', context: {}, format: 'json' }));
    const data = JSON.parse(result.content[0].text);
    expect(result.isError).toBe(true);
    expect(data.issues.join(' ')).toMatch(/method/);
    expect(data.example.action).toBe('call');
  });

  it('never infers mainnet from free text', async () => {
    const result = await action(ActionInputSchema.parse({ action: 'deploy to mainnet', format: 'json' }));
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toMatch(/environment = "ic"/);
  });

  it('lists operations for an unknown action', async () => {
    const result = await action(ActionInputSchema.parse({ action: 'make coffee' }));
    const data = JSON.parse(result.content[0].text);
    expect(Object.keys(data.operations)).toContain('preflight');
  });

  it('converts dfx.json text', async () => {
    const dfxJson = JSON.stringify({ canisters: { backend: { type: 'motoko', main: 'src/main.mo' } } });
    const result = await action(ActionInputSchema.parse({ action: 'convert-dfx', context: { dfxJson }, format: 'json' }));
    const data = JSON.parse(result.content[0].text);
    expect(data.icpYaml).toContain('@dfinity/motoko@v5.1.0');
    expect(data.mopsToml).toContain('[canisters.backend]');
  });
});
