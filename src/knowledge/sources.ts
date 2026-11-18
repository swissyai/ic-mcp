/**
 * Access to official ICP material: the skills index and skill files, the
 * icp-cli docs index, the developer docs index, and the mo:core API reference
 * published with the writing-motoko skill.
 */

import {
  getDocument,
  getJson,
  OFFICIAL_URLS,
  skillFileUrl,
  assertAllowedDocUrl,
  DocFetchError,
  type SourceMeta,
} from '../fetchers/official.js';
import {
  parseFrontMatter,
  splitSections,
  parseLlmsTxt,
  tokenize,
  scoreText,
  type Section,
  type LlmsEntry,
} from './markdown.js';

export interface SkillInfo {
  name: string;
  title?: string;
  category?: string;
  summary?: string;
  description: string;
  keywords: string[];
  compatibility?: string;
  files: string[];
  markdownUrl: string;
  pageUrl?: string;
}

interface IndexFile {
  skills: Array<{ name: string; description?: string; files?: string[]; url?: string; type?: string }>;
}

interface CatalogFile {
  skills: Array<{
    name: string;
    title?: string;
    category?: string;
    summary?: string;
    keywords?: string[];
    description?: string;
    compatibility?: string;
    urls?: { html?: string; markdown?: string };
  }>;
}

export class NotFoundError extends Error {
  constructor(message: string, public readonly suggestions: string[] = []) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export async function getSkillsCatalog(options: { refresh?: boolean } = {}): Promise<{
  skills: SkillInfo[];
  meta: SourceMeta;
  warnings: string[];
}> {
  const { value: index, meta } = await getJson<IndexFile>(OFFICIAL_URLS.skillsIndex, options);
  const warnings: string[] = [];
  let catalog: CatalogFile | null = null;
  try {
    const result = await getJson<CatalogFile>(OFFICIAL_URLS.skillsCatalog, options);
    catalog = result.value;
    if (result.meta.stale && result.meta.warning) warnings.push(result.meta.warning);
  } catch (error: any) {
    warnings.push(`Skill summaries unavailable (${error?.message || error}); names and descriptions come from the index only.`);
  }
  if (meta.stale && meta.warning) warnings.push(meta.warning);

  const byName = new Map((catalog?.skills || []).map(s => [s.name, s]));
  const skills: SkillInfo[] = (index.skills || []).map(entry => {
    const extra = byName.get(entry.name);
    return {
      name: entry.name,
      title: extra?.title,
      category: extra?.category,
      summary: extra?.summary,
      description: entry.description || extra?.description || '',
      keywords: extra?.keywords || [],
      compatibility: extra?.compatibility,
      files: entry.files && entry.files.length > 0 ? entry.files : ['SKILL.md'],
      markdownUrl: skillFileUrl(entry.name),
      pageUrl: extra?.urls?.html,
    };
  });
  return { skills, meta, warnings };
}

function suggestNames(names: string[], wanted: string): string[] {
  const terms = tokenize(wanted.replace(/[-_]/g, ' '));
  return names
    .map(name => ({ name, score: terms.filter(t => name.includes(t)).length }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.name);
}

export interface LoadedDocument {
  url: string;
  title: string;
  frontMatter: Record<string, any>;
  sections: Section[];
  totalChars: number;
  meta: SourceMeta;
}

function loadMarkdown(url: string, text: string, meta: SourceMeta): LoadedDocument {
  const { data, body } = parseFrontMatter(text);
  const titleMatch = body.match(/^#\s+(.+)$/m);
  return {
    url,
    title: (data.metadata && data.metadata.title) || data.name || (titleMatch ? titleMatch[1].trim() : url),
    frontMatter: data,
    sections: splitSections(body),
    totalChars: text.length,
    meta,
  };
}

export async function getSkillDocument(
  name: string,
  file: string = 'SKILL.md',
  options: { refresh?: boolean } = {}
): Promise<{ skill: SkillInfo; document: LoadedDocument; catalogWarnings: string[] }> {
  const { skills, warnings } = await getSkillsCatalog(options);
  const skill = skills.find(s => s.name === name.trim());
  if (!skill) {
    throw new NotFoundError(
      `No official skill named "${name}".`,
      suggestNames(skills.map(s => s.name), name)
    );
  }
  const normalizedFile = file.replace(/^\.?\//, '');
  if (!skill.files.includes(normalizedFile)) {
    throw new NotFoundError(`Skill "${name}" has no file "${file}".`, skill.files);
  }
  const url = skillFileUrl(skill.name, normalizedFile);
  const { text, meta } = await getDocument(url, 'markdown', options);
  return { skill, document: loadMarkdown(url, text, meta), catalogWarnings: warnings };
}

export type IndexKind = 'cli' | 'docs';

export async function getIndex(kind: IndexKind, options: { refresh?: boolean } = {}): Promise<{
  title: string;
  entries: LlmsEntry[];
  meta: SourceMeta;
}> {
  const url = kind === 'cli' ? OFFICIAL_URLS.cliLlms : OFFICIAL_URLS.docsLlms;
  const { text, meta } = await getDocument(url, 'markdown', options);
  const parsed = parseLlmsTxt(text);
  return { ...parsed, meta };
}

/**
 * Load a markdown page from an official docs host. A path without an extension
 * gets `.md` appended, since every page is published in that form.
 */
export async function getPageDocument(rawUrl: string, options: { refresh?: boolean } = {}): Promise<LoadedDocument & { requestedUrl: string }> {
  const parsed = assertAllowedDocUrl(rawUrl);
  const lastSegment = parsed.pathname.split('/').pop() || '';
  if (parsed.pathname !== '/' && !lastSegment.includes('.')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') + '.md';
  }
  const url = parsed.toString();
  const { text, meta } = await getDocument(url, 'markdown', options);
  return { ...loadMarkdown(url, text, meta), requestedUrl: rawUrl };
}

export type SearchSource = 'skills' | 'cli' | 'docs';

export interface SearchHit {
  source: SearchSource;
  title: string;
  description: string;
  score: number;
  name?: string;
  url: string;
  next: Record<string, string>;
}

/**
 * Rank skills and index entries against a query. A source that cannot be
 * reached is reported in `unavailable` and the others are still searched.
 */
export async function searchOfficial(
  query: string,
  sources: SearchSource[] = ['skills', 'cli', 'docs'],
  limit: number = 8,
  options: { refresh?: boolean } = {}
): Promise<{ hits: SearchHit[]; unavailable: Array<{ source: SearchSource; error: string }>; stale: SearchSource[] }> {
  const terms = tokenize(query);
  const hits: SearchHit[] = [];
  const unavailable: Array<{ source: SearchSource; error: string }> = [];
  const stale: SearchSource[] = [];

  await Promise.all(
    sources.map(async source => {
      try {
        if (source === 'skills') {
          const { skills, meta } = await getSkillsCatalog(options);
          if (meta.stale) stale.push(source);
          for (const skill of skills) {
            const nameText = `${skill.name.replace(/-/g, ' ')} ${skill.title || ''}`;
            const body = `${skill.summary || ''} ${skill.description} ${skill.keywords.join(' ')}`;
            const score = scoreText(terms, nameText, body) * 1.2;
            if (score > 0) {
              hits.push({
                source,
                name: skill.name,
                title: skill.title || skill.name,
                description: skill.summary || skill.description.slice(0, 200),
                score,
                url: skill.markdownUrl,
                next: { operation: 'skill', name: skill.name, query },
              });
            }
          }
        } else {
          const { entries, meta } = await getIndex(source, options);
          if (meta.stale) stale.push(source);
          for (const entry of entries) {
            const score = scoreText(terms, entry.title, `${entry.section} ${entry.description} ${entry.url}`);
            if (score > 0) {
              hits.push({
                source,
                title: entry.title,
                description: entry.description,
                score,
                url: entry.url,
                next: { operation: 'page', url: entry.url, query },
              });
            }
          }
        }
      } catch (error: any) {
        unavailable.push({ source, error: error?.message || String(error) });
      }
    })
  );

  hits.sort((a, b) => b.score - a.score);
  return {
    hits: hits.slice(0, limit).map(h => ({ ...h, score: Math.round(h.score * 10) / 10 })),
    unavailable,
    stale,
  };
}

/** mo:core API reference, one section per module, from the writing-motoko skill. */
export const CORE_API_REFERENCE_FILE = 'references/api-reference.md';
export const MOTOKO_EXAMPLE_FILES = ['SKILL.md', 'references/examples.md'];

export async function getCoreApiReference(options: { refresh?: boolean } = {}): Promise<{
  modules: Map<string, Section>;
  url: string;
  meta: SourceMeta;
}> {
  const url = skillFileUrl('writing-motoko', CORE_API_REFERENCE_FILE);
  const { text, meta } = await getDocument(url, 'markdown', options);
  const { body } = parseFrontMatter(text);
  const modules = new Map<string, Section>();
  for (const section of splitSections(body)) {
    if (section.level === 2) modules.set(section.title, section);
  }
  return { modules, url, meta };
}

export { DocFetchError };
