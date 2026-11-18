import { describe, it, expect } from 'vitest';
import { help, HelpInputSchema, HELP_EXAMPLES, HELP_SECTIONS } from '../../src/tools/help.js';
import { QueryInputSchema, QUERY_OPERATIONS } from '../../src/tools/query.js';
import { ActionInputSchema, OPERATIONS, resolveOperation } from '../../src/tools/action.js';
import { ExecuteInputSchema } from '../../src/tools/execute.js';

const SCHEMAS = {
  'icp/query': QueryInputSchema,
  'icp/action': ActionInputSchema,
  'icp/execute': ExecuteInputSchema,
  'icp/help': HelpInputSchema,
} as const;

async function section(name: (typeof HELP_SECTIONS)[number]): Promise<string> {
  const result = await help(HelpInputSchema.parse({ section: name }));
  return result.content[0].text;
}

describe('help examples match the real schemas', () => {
  const all = Object.values(HELP_EXAMPLES).flat();

  it.each(all.map(e => [e.note, e]))('%s', (_note, example) => {
    const parsed = SCHEMAS[example.tool].safeParse(example.args);
    expect(parsed.success, JSON.stringify(parsed.success ? '' : parsed.error.issues)).toBe(true);
    if (example.tool === 'icp/action') {
      const { operation } = resolveOperation(example.args.action, example.args.context);
      expect(operation).not.toBeNull();
      const contextCheck = OPERATIONS[operation!].schema.safeParse(example.args.context || {});
      expect(contextCheck.success, JSON.stringify(contextCheck.success ? '' : contextCheck.error.issues)).toBe(true);
    }
  });

  it('every operation example in the action table parses', () => {
    for (const [id, spec] of Object.entries(OPERATIONS)) {
      expect(spec.schema.safeParse(spec.example).success, id).toBe(true);
    }
  });
});

describe('help text', () => {
  it('renders every section', async () => {
    for (const name of HELP_SECTIONS) {
      expect((await section(name)).length).toBeGreaterThan(100);
    }
  });

  it('documents every query operation and every query parameter', async () => {
    const text = await section('query');
    for (const op of QUERY_OPERATIONS) expect(text).toContain(op);
    for (const key of Object.keys(QueryInputSchema.shape)) expect(text).toContain(`\`${key}\``);
  });

  it('documents every action operation', async () => {
    const text = await section('action');
    for (const id of Object.keys(OPERATIONS)) expect(text).toContain(`### ${id}`);
  });

  it('points to the official skills', async () => {
    expect(await section('overview')).toContain('https://skills.internetcomputer.org/llms.txt');
  });

  it('carries none of the Motoko rules the writing-motoko skill contradicts', async () => {
    const text = await section('all');
    expect(text).not.toMatch(/labels? required/i);
    expect(text).not.toMatch(/label \w+ (for|while)/);
    expect(text).not.toContain('List.add(');
    expect(text).not.toContain('dfx generate');
    expect(text).not.toMatch(/moc >= 0\.15/);
    expect(text).not.toMatch(/Claude 3\.5/);
    expect(text).toContain('Plain `break` and `continue` work');
  });

  it('describes the execute context as no security boundary', async () => {
    expect(await section('execute')).toMatch(/not a security boundary/);
  });
});
