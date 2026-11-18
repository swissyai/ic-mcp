import { describe, it, expect } from 'vitest';
import {
  splitSections,
  findSection,
  rankSections,
  truncate,
  parseLlmsTxt,
  parseFrontMatter,
} from '../../src/knowledge/markdown.js';
import { ICP_CLI_SKILL, CLI_LLMS } from '../helpers/fake-web.js';

describe('splitSections', () => {
  const { body, data } = parseFrontMatter(ICP_CLI_SKILL);
  const sections = splitSections(body);

  it('reads front matter', () => {
    expect(data.name).toBe('icp-cli');
    expect(data.metadata.title).toBe('ICP CLI');
  });

  it('numbers ## sections and ### subsections', () => {
    expect(sections.map(s => s.id)).toEqual(['0', '1', '2', '2.1', '2.2', '3']);
    expect(sections.find(s => s.id === '2.1')?.title).toBe('Identities on mainnet');
  });

  it('ignores headings inside code fences', () => {
    expect(sections.some(s => s.title.includes('not a heading'))).toBe(false);
    expect(findSection(sections, '2')?.text).toContain('## also not a heading');
  });

  it('keeps the part before the first subsection as ownText', () => {
    const pitfalls = findSection(sections, 'Common Pitfalls')!;
    expect(pitfalls.ownText).not.toContain('Identities on mainnet');
    expect(pitfalls.text).toContain('Identities on mainnet');
  });

  it('finds sections by id, exact title and partial title', () => {
    expect(findSection(sections, '3')?.title).toBe('Configuration');
    expect(findSection(sections, 'local networks')?.id).toBe('2.2');
    expect(findSection(sections, 'nothing like this')).toBeUndefined();
  });

  it('ranks the most specific matching section first', () => {
    const ranked = rankSections(sections, 'mainnet identity');
    expect(ranked[0].section.id).toBe('2.1');
  });
});

describe('truncate', () => {
  it('closes an open code fence', () => {
    const text = 'intro\n\n```motoko\nlet a = 1;\nlet b = 2;\n' + 'x'.repeat(200) + '\n```\n';
    const cut = truncate(text, 60);
    expect(cut.truncated).toBe(true);
    expect((cut.text.match(/```/g) || []).length % 2).toBe(0);
  });

  it('leaves short text alone', () => {
    expect(truncate('short', 100)).toEqual({ text: 'short', truncated: false });
  });
});

describe('parseLlmsTxt', () => {
  it('reads entries with their section', () => {
    const { title, entries } = parseLlmsTxt(CLI_LLMS);
    expect(title).toBe('ICP CLI Documentation (v1.8)');
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      section: 'Guides',
      title: 'Deploying to IC Mainnet',
      url: 'https://cli.internetcomputer.org/1.8/guides/deploying-to-mainnet.md',
    });
    expect(entries[2].title).toBe('`icp deploy`');
  });
});
