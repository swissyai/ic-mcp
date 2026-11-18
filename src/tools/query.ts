/**
 * Query tool: current, official ICP guidance served one section at a time.
 *
 * Sources:
 * - skills index and skill files at https://skills.internetcomputer.org/
 * - icp-cli docs index at https://cli.internetcomputer.org/llms.txt
 * - developer docs index at https://docs.internetcomputer.org/llms.txt
 * - the mo:core API reference published with the writing-motoko skill
 */

import { z } from 'zod';
import { DataEncoder } from '../core/toon-encoder.js';
import { MODULES_MINIMAL } from '../data/modules-minimal.js';
import { icpExamples } from '../data/examples/icp-examples.js';
import { logger } from '../utils/logger.js';
import {
  fetchDocument,
  describeFetchError,
  OFFICIAL_URLS,
  skillFileUrl,
  type SourceMeta,
} from '../fetchers/official.js';
import {
  getSkillsCatalog,
  getSkillDocument,
  getPageDocument,
  searchOfficial,
  getCoreApiReference,
  NotFoundError,
  MOTOKO_EXAMPLE_FILES,
  type LoadedDocument,
  type SearchSource,
} from '../knowledge/sources.js';
import { findSection, outline, rankSections, truncate, type Section } from '../knowledge/markdown.js';
import { convertDfxJson } from '../converters/dfx-to-icp.js';

export const QUERY_OPERATIONS = [
  'search',
  'list-skills',
  'skill',
  'page',
  'list-all',
  'document',
  'examples',
  'list-icp-examples',
  'fetch-icp-example',
] as const;

export const QueryInputSchema = z.object({
  operation: z
    .enum(QUERY_OPERATIONS)
    .describe(
      'search: rank official skills and docs pages for a query. list-skills: the official skills index. ' +
        'skill: outline of a skill, or one section of it (section or query). page: outline or one section of a docs page (url). ' +
        'list-all: mo:core modules. document: mo:core module API (modules). examples: Motoko code using a module (modules). ' +
        'list-icp-examples / fetch-icp-example: example projects.'
    ),
  query: z.string().optional().describe('Search text. With skill or page, selects the most relevant section.'),
  name: z.string().optional().describe('Skill name for operation "skill", e.g. "icp-cli"'),
  file: z.string().optional().describe('File inside the skill (default SKILL.md), e.g. "references/examples.md"'),
  section: z.string().optional().describe('Section id from an outline ("4" or "4.2") or heading text'),
  url: z.string().optional().describe('Page URL on cli.internetcomputer.org, docs.internetcomputer.org or skills.internetcomputer.org'),
  sources: z.array(z.enum(['skills', 'cli', 'docs'])).optional().describe('Sources for search (default all)'),
  modules: z.array(z.string()).optional().describe('mo:core module names for document/examples, e.g. ["Map", "List"]'),
  exampleId: z.string().optional().describe('Example id for fetch-icp-example'),
  category: z.string().optional().describe('Example category filter for list-icp-examples'),
  language: z.string().optional().describe('Example language filter for list-icp-examples (motoko, rust, frontend-only)'),
  maxChars: z.number().int().min(500).max(20000).optional().describe('Maximum characters of section text (default 6000)'),
  limit: z.number().int().min(1).max(25).optional().describe('Maximum results for search and examples'),
  refresh: z.boolean().optional().describe('Bypass the cache and fetch again'),
  format: z.enum(['toon', 'json', 'markdown']).optional().default('toon'),
  filter: z
    .object({
      mode: z.enum(['full', 'summary', 'signatures-only']).optional(),
      maxLength: z.number().optional(),
    })
    .optional()
    .describe('Deprecated: use maxChars. filter.maxLength is read as maxChars.'),
});

export type QueryInput = z.infer<typeof QueryInputSchema>;

const DEFAULT_MAX_CHARS = 6000;

function maxCharsOf(input: QueryInput): number {
  const legacy = input.filter?.maxLength;
  const value = input.maxChars ?? (legacy && legacy > 0 ? legacy : undefined) ?? DEFAULT_MAX_CHARS;
  return Math.max(200, Math.min(20000, value));
}

function sourceInfo(meta: SourceMeta) {
  return {
    url: meta.url,
    fetchedAt: meta.fetchedAt,
    stale: meta.stale,
    ...(meta.warning ? { warning: meta.warning } : {}),
  };
}

function failure(operation: string, error: any, extra: Record<string, any> = {}) {
  if (error instanceof NotFoundError) {
    return { operation, error: error.message, ...(error.suggestions.length ? { suggestions: error.suggestions } : {}), ...extra };
  }
  return { operation, ...describeFetchError(error), ...extra };
}

/**
 * Select what to return from a loaded document: an outline, one named section,
 * or the section that best matches a query.
 */
function selectFromDocument(
  doc: LoadedDocument,
  input: QueryInput,
  base: Record<string, any>
): Record<string, any> {
  const maxChars = maxCharsOf(input);
  const sections = doc.sections;
  const sectionList = outline(sections);

  let chosen: Section | undefined;
  let alternatives: Array<{ id: string; title: string; chars: number }> = [];
  let selectedBy: 'section' | 'query' | undefined;

  if (input.section) {
    chosen = findSection(sections, input.section);
    if (!chosen) {
      return {
        ...base,
        error: `No section "${input.section}".`,
        sections: sectionList,
      };
    }
    selectedBy = 'section';
  } else if (input.query) {
    const ranked = rankSections(sections, input.query);
    if (ranked.length === 0) {
      return {
        ...base,
        error: `No section matches "${input.query}".`,
        sections: sectionList,
      };
    }
    chosen = ranked[0].section;
    alternatives = ranked.slice(1, 5).map(r => ({ id: r.section.id, title: r.section.title, chars: r.section.chars }));
    selectedBy = 'query';
  }

  if (!chosen) {
    return {
      ...base,
      totalChars: doc.totalChars,
      sections: sectionList,
      next: 'Request one section with "section" (id or heading), or pass "query" to get the most relevant one.',
    };
  }

  const subsections = sections.filter(s => s.id.startsWith(`${chosen!.id}.`));
  let text = chosen.text;
  let note: string | undefined;
  if (chosen.level === 2 && text.length > maxChars && subsections.length > 0) {
    text = chosen.ownText;
    note = 'Section is longer than maxChars; showing its introduction. Request a subsection by id.';
  }
  const cut = truncate(text, maxChars);
  if (cut.truncated) {
    note = `Truncated to ${maxChars} characters of ${chosen.text.length}. Raise maxChars or request a subsection.`;
  }

  return {
    ...base,
    section: { id: chosen.id, title: chosen.title, chars: chosen.chars, selectedBy },
    ...(note ? { note } : {}),
    ...(chosen.level === 2 && subsections.length > 0
      ? { subsections: subsections.map(s => ({ id: s.id, title: s.title, chars: s.chars })) }
      : {}),
    ...(alternatives.length > 0 ? { otherMatches: alternatives } : {}),
    content: cut.text,
  };
}

async function opSearch(input: QueryInput) {
  if (!input.query) {
    return { operation: 'search', error: 'Provide "query".' };
  }
  const sources = (input.sources as SearchSource[] | undefined) || ['skills', 'cli', 'docs'];
  const { hits, unavailable, stale } = await searchOfficial(input.query, sources, input.limit ?? 8, {
    refresh: input.refresh,
  });
  return {
    operation: 'search',
    query: input.query,
    results: hits.map(h => ({
      source: h.source,
      title: h.title,
      ...(h.name ? { name: h.name } : {}),
      url: h.url,
      description: h.description,
      next: h.next,
    })),
    ...(unavailable.length > 0 ? { unavailable } : {}),
    ...(stale.length > 0 ? { staleSources: stale } : {}),
    ...(hits.length === 0 ? { hint: 'No match. Try fewer or different words, or operation "list-skills".' } : {}),
  };
}

async function opListSkills(input: QueryInput) {
  try {
    const { skills, meta, warnings } = await getSkillsCatalog({ refresh: input.refresh });
    return {
      operation: 'list-skills',
      total: skills.length,
      skills: skills.map(s => ({
        name: s.name,
        category: s.category || '',
        summary: s.summary || s.description.slice(0, 160),
      })),
      source: sourceInfo(meta),
      ...(warnings.length > 0 ? { warnings } : {}),
      next: 'operation "skill" with name for an outline, plus section or query for one section.',
    };
  } catch (error) {
    return failure('list-skills', error);
  }
}

async function opSkill(input: QueryInput) {
  if (!input.name) {
    return { operation: 'skill', error: 'Provide "name". Use operation "list-skills" or "search" to find one.' };
  }
  try {
    const { skill, document, catalogWarnings } = await getSkillDocument(input.name, input.file || 'SKILL.md', {
      refresh: input.refresh,
    });
    const base = {
      operation: 'skill',
      name: skill.name,
      file: input.file || 'SKILL.md',
      ...(input.section || input.query
        ? {}
        : {
            description: skill.description,
            ...(skill.compatibility ? { compatibility: skill.compatibility } : {}),
            files: skill.files,
          }),
      source: sourceInfo(document.meta),
      ...(catalogWarnings.length > 0 ? { warnings: catalogWarnings } : {}),
    };
    return selectFromDocument(document, input, base);
  } catch (error) {
    return failure('skill', error, { name: input.name });
  }
}

async function opPage(input: QueryInput) {
  if (!input.url) {
    return {
      operation: 'page',
      error: 'Provide "url". Use operation "search" to find pages.',
      indexes: [OFFICIAL_URLS.cliLlms, OFFICIAL_URLS.docsLlms],
    };
  }
  try {
    const document = await getPageDocument(input.url, { refresh: input.refresh });
    return selectFromDocument(document, input, {
      operation: 'page',
      title: document.title,
      source: sourceInfo(document.meta),
    });
  } catch (error) {
    return failure('page', error, { url: input.url });
  }
}

function normalizeModuleName(name: string): string {
  return name.trim().replace(/^mo:core\//, '');
}

async function opListAll(input: QueryInput) {
  try {
    const { modules, url, meta } = await getCoreApiReference({ refresh: input.refresh });
    return {
      operation: 'list-all',
      total: modules.size,
      modules: [...modules.values()].map(section => ({
        name: section.title,
        import: `import ${section.title.split('/').pop()} "mo:core/${section.title}";`,
        functions: (section.text.match(/^- `/gm) || []).length,
      })),
      source: sourceInfo({ ...meta, url }),
      note: 'Modules listed in the official mo:core API reference. Use operation "document" with modules for signatures.',
    };
  } catch (error) {
    logger.warn(`mo:core API reference unavailable: ${(error as any)?.message}`);
    return {
      operation: 'list-all',
      offline: true,
      ...describeFetchError(error),
      total: MODULES_MINIMAL.length,
      modules: MODULES_MINIMAL.map(m => ({ name: m.n, description: m.d })),
      note: 'Official API reference unreachable; this is a bundled module list without signatures.',
    };
  }
}

async function opDocument(input: QueryInput) {
  const requested = (input.modules || []).map(normalizeModuleName).filter(Boolean);
  if (requested.length === 0) {
    if (input.query) {
      return { ...(await opSearch(input)), operation: 'document' };
    }
    return {
      operation: 'document',
      error: 'Provide "modules" (mo:core module names) or "query".',
      suggestion: 'operation "list-all" lists modules; operation "search" finds skills and docs pages.',
    };
  }

  let reference: Awaited<ReturnType<typeof getCoreApiReference>>;
  try {
    reference = await getCoreApiReference({ refresh: input.refresh });
  } catch (error) {
    return failure('document', error, { requested });
  }

  const maxChars = maxCharsOf(input);
  const available = [...reference.modules.keys()];
  const results = await Promise.all(
    requested.map(async name => {
      const key = available.find(m => m.toLowerCase() === name.toLowerCase());
      if (key) {
        const cut = truncate(reference.modules.get(key)!.text, maxChars);
        return {
          name: key,
          import: `import ${key.split('/').pop()} "mo:core/${key}";`,
          content: cut.text,
          ...(cut.truncated ? { note: `Truncated to ${maxChars} characters.` } : {}),
        };
      }
      const search = await searchOfficial(name.replace(/[-_]/g, ' '), ['skills', 'docs'], 3, { refresh: input.refresh });
      return {
        name,
        error: `"${name}" is not a module in the official mo:core API reference.`,
        ...(search.hits.length > 0
          ? { related: search.hits.map(h => ({ title: h.title, url: h.url, next: h.next })) }
          : {}),
      };
    })
  );

  const allFailed = results.every(r => 'error' in r);
  return {
    operation: 'document',
    modules: results,
    source: sourceInfo({ ...reference.meta, url: reference.url }),
    ...(allFailed ? { error: 'None of the requested modules were found.', available } : {}),
  };
}

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const pattern = /```(?:motoko|mo)(?:[ \t][^\n]*)?\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

async function opExamples(input: QueryInput) {
  const requested = (input.modules || []).map(normalizeModuleName).filter(Boolean);
  if (requested.length === 0) {
    return { operation: 'examples', error: 'Provide "modules", e.g. ["Map"].' };
  }
  const limit = input.limit ?? 3;
  const documents: LoadedDocument[] = [];
  const unavailable: any[] = [];
  for (const file of MOTOKO_EXAMPLE_FILES) {
    try {
      documents.push((await getSkillDocument('writing-motoko', file, { refresh: input.refresh })).document);
    } catch (error) {
      unavailable.push({ file, ...describeFetchError(error) });
    }
  }
  if (documents.length === 0) {
    return { operation: 'examples', error: 'Example sources are unreachable.', unavailable };
  }

  const modules = requested.map(name => {
    const importPattern = new RegExp(`"mo:core/${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i');
    const examples: Array<{ section: string; url: string; code: string }> = [];
    for (const doc of documents) {
      for (const section of doc.sections) {
        const hasSubsections = section.level === 2 && doc.sections.some(s => s.id.startsWith(`${section.id}.`));
        for (const code of extractCodeBlocks(hasSubsections ? section.ownText : section.text)) {
          if (importPattern.test(code) && examples.length < limit) {
            examples.push({ section: section.title, url: doc.url, code });
          }
        }
      }
    }
    return {
      module: name,
      examples,
      hasExamples: examples.length > 0,
      ...(examples.length === 0
        ? { hint: `No official example imports mo:core/${name}. Use operation "document" for its signatures.` }
        : {}),
    };
  });

  return {
    operation: 'examples',
    modules,
    sources: documents.map(d => sourceInfo(d.meta)),
    ...(unavailable.length > 0 ? { unavailable } : {}),
  };
}

function listICPExamples(category?: string, language?: string, query?: string) {
  let filtered = icpExamples;
  if (category) {
    filtered = filtered.filter(ex => ex.category.toLowerCase() === category.toLowerCase());
  }
  if (language) {
    filtered = filtered.filter(ex => ex.language.toLowerCase() === language.toLowerCase());
  }
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      ex =>
        ex.id.includes(q) ||
        ex.title.toLowerCase().includes(q) ||
        ex.description.toLowerCase().includes(q) ||
        ex.technologies.some(tech => tech.toLowerCase().includes(q))
    );
  }

  const byCategory: Record<string, any[]> = {};
  for (const ex of filtered) {
    (byCategory[ex.category] ||= []).push({
      id: ex.id,
      title: ex.title,
      description: ex.description,
      language: ex.language,
      hasFrontend: ex.hasFrontend,
      githubUrl: ex.githubUrl,
    });
  }

  return {
    operation: 'list-icp-examples',
    total: filtered.length,
    filters: { category, language, query },
    examples: byCategory,
    note: 'Use operation "fetch-icp-example" with exampleId for the README, configuration and file URLs.',
  };
}

function buildSourceFileUrls(example: (typeof icpExamples)[number]): Record<string, string> {
  const base = example.sourceUrl;
  const urls: Record<string, string> = {
    'dfx.json': `${base}/dfx.json`,
    'README.md': `${base}/README.md`,
  };
  if (example.hasFrontend) {
    for (const file of ['frontend/index.html', 'frontend/package.json', 'frontend/vite.config.js', 'frontend/src/main.jsx', 'frontend/src/main.tsx', 'frontend/src/App.jsx', 'frontend/src/App.tsx']) {
      urls[file] = `${base}/${file}`;
    }
  }
  if (example.language === 'motoko') {
    for (const file of ['backend/main.mo', 'backend/app.mo', 'src/main.mo', 'mops.toml']) {
      urls[file] = `${base}/${file}`;
    }
  } else if (example.language === 'rust') {
    for (const file of ['src/lib.rs', 'backend/lib.rs', 'backend/src/lib.rs', 'Cargo.toml', 'backend/Cargo.toml']) {
      urls[file] = `${base}/${file}`;
    }
  }
  return urls;
}

async function fetchICPExample(exampleId: string) {
  const example = icpExamples.find(ex => ex.id === exampleId);
  if (!example) {
    return {
      operation: 'fetch-icp-example',
      error: `Example "${exampleId}" not found`,
      suggestion: 'Use operation "list-icp-examples" to see available examples',
    };
  }

  let readme = '';
  let readmeError: any;
  try {
    readme = (await fetchDocument(`${example.sourceUrl}/README.md`, 'markdown')).text;
  } catch (error) {
    readmeError = describeFetchError(error);
  }

  let dfxConfig: any = null;
  let conversion: any = null;
  try {
    dfxConfig = JSON.parse((await fetchDocument(`${example.sourceUrl}/dfx.json`, 'json')).text);
    const converted = convertDfxJson(dfxConfig);
    conversion = {
      icpYaml: converted.icpYaml,
      ...(converted.mopsCanisters.length > 0 ? { mopsTomlAdditions: converted.mopsTomlSnippet } : {}),
      notes: converted.notes,
      warnings: converted.warnings,
    };
  } catch (error) {
    conversion = { error: describeFetchError(error) };
  }

  return {
    operation: 'fetch-icp-example',
    example: {
      id: example.id,
      title: example.title,
      category: example.category,
      description: example.description,
      language: example.language,
      hasFrontend: example.hasFrontend,
      githubUrl: example.githubUrl,
      sourceUrl: example.sourceUrl,
      readme: readme || undefined,
      ...(readmeError ? { readmeError } : {}),
      dfxJson: dfxConfig,
    },
    icpCli: conversion,
    sourceFiles: buildSourceFileUrls(example),
    note:
      'These examples were written for dfx. icpCli.icpYaml is the converted icp.yaml (review the warnings). ' +
      'For new projects prefer `icp new` templates.',
  };
}

function render(result: Record<string, any>, format: QueryInput['format']): string {
  if (format !== 'json' && typeof result.content === 'string') {
    const { content, ...header } = result;
    return `${DataEncoder.encode(header, format === 'markdown' ? 'markdown' : 'json')}\n\n---\n\n${content}`;
  }
  return DataEncoder.encode(result, format);
}

export async function query(input: QueryInput) {
  logger.info(`Query: ${input.operation}${input.name ? ` ${input.name}` : ''}${input.query ? ` "${input.query}"` : ''}`);

  let result: Record<string, any>;
  switch (input.operation) {
    case 'search':
      result = await opSearch(input);
      break;
    case 'list-skills':
      result = await opListSkills(input);
      break;
    case 'skill':
      result = await opSkill(input);
      break;
    case 'page':
      result = await opPage(input);
      break;
    case 'list-all':
      result = await opListAll(input);
      break;
    case 'document':
      result = await opDocument(input);
      break;
    case 'examples':
      result = await opExamples(input);
      break;
    case 'list-icp-examples':
      result = listICPExamples(input.category, input.language, input.query);
      break;
    case 'fetch-icp-example':
      result = await fetchICPExample(input.exampleId || '');
      break;
  }

  const encoded = render(result, input.format);
  return {
    content: [{ type: 'text' as const, text: encoded }],
    ...(result.error ? { isError: true } : {}),
    metadata: {
      operation: input.operation,
      format: input.format,
      tokenEstimate: DataEncoder.estimateTokens(encoded),
    },
  };
}

export const queryTool = {
  name: 'icp/query',
  description:
    'Official, current ICP guidance from skills.internetcomputer.org, cli.internetcomputer.org and docs.internetcomputer.org, ' +
    'one section at a time. Start with operation "search" or "list-skills", then "skill" or "page" with section or query. ' +
    'Results say when content is cached or stale; fetch failures are errors, never placeholder content. ' +
    'Details: icp/help section="query".',
  inputSchema: QueryInputSchema,
  execute: query,
};

export { skillFileUrl };
