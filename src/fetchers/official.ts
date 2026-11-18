/**
 * Fetching of official Internet Computer documentation.
 *
 * Every response is checked before it is used as content:
 * - a redirect that lands on a different path (for example the docs home page)
 *   is an error, never content;
 * - a request for a markdown or JSON document that returns HTML is an error;
 * - non-2xx responses are errors.
 *
 * Successful responses are cached in memory with a TTL. When a refresh fails,
 * the last good copy is returned and marked stale; when there is no copy, the
 * error is raised so callers can report the source as unreachable.
 */

import { getUserAgent } from '../utils/version.js';

export const OFFICIAL_URLS = {
  skillsLlms: 'https://skills.internetcomputer.org/llms.txt',
  skillsIndex: 'https://skills.internetcomputer.org/.well-known/agent-skills/index.json',
  skillsCatalog: 'https://skills.internetcomputer.org/api/skills.json',
  skillsSite: 'https://skills.internetcomputer.org/',
  cliLlms: 'https://cli.internetcomputer.org/llms.txt',
  docsLlms: 'https://docs.internetcomputer.org/llms.txt',
  mcpConnector: 'https://mcp.internetcomputer.org/mcp',
  mcpInfo: 'https://mcp.internetcomputer.org/',
} as const;

export function skillFileUrl(name: string, file: string = 'SKILL.md'): string {
  return `https://skills.internetcomputer.org/.well-known/agent-skills/${name}/${file}`;
}

/** Hosts whose documents may be fetched by URL through the query tool. */
export const ALLOWED_DOC_HOSTS = [
  'skills.internetcomputer.org',
  'cli.internetcomputer.org',
  'docs.internetcomputer.org',
];

export type Expect = 'markdown' | 'json';

export type DocFetchErrorCode =
  | 'redirected'
  | 'not-found'
  | 'http-error'
  | 'wrong-content'
  | 'unreachable'
  | 'disallowed-url';

export class DocFetchError extends Error {
  constructor(
    public readonly code: DocFetchErrorCode,
    message: string,
    public readonly url: string,
    public readonly finalUrl?: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'DocFetchError';
  }
}

/** Minimal response shape used here, so tests can supply a fake fetch. */
export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  url: string;
  redirected?: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { redirect: 'follow'; signal: AbortSignal; headers: Record<string, string> }
) => Promise<FetchLikeResponse>;

let fetchImpl: FetchLike = (url, init) => fetch(url, init) as unknown as Promise<FetchLikeResponse>;

/** Replace the HTTP implementation (used by tests). Returns the previous one. */
export function setFetchImplementation(impl: FetchLike): FetchLike {
  const previous = fetchImpl;
  fetchImpl = impl;
  return previous;
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Throws when a URL is not an https URL on one of the official documentation hosts.
 */
export function assertAllowedDocUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new DocFetchError('disallowed-url', `Not a valid URL: ${rawUrl}`, rawUrl);
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_DOC_HOSTS.includes(parsed.hostname)) {
    throw new DocFetchError(
      'disallowed-url',
      `Only https URLs on ${ALLOWED_DOC_HOSTS.join(', ')} can be fetched: ${rawUrl}`,
      rawUrl
    );
  }
  return parsed;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch one document and verify that the response is the requested document.
 */
export async function fetchDocument(
  url: string,
  expect: Expect,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ text: string; finalUrl: string; contentType: string }> {
  const requested = new URL(url);
  let response: FetchLikeResponse;
  try {
    response = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': getUserAgent(),
        Accept: expect === 'json' ? 'application/json' : 'text/markdown, text/plain;q=0.9',
      },
    });
  } catch (error: any) {
    throw new DocFetchError(
      'unreachable',
      `Could not reach ${url}: ${error?.message || String(error)}`,
      url
    );
  }

  const finalUrl = response.url || url;
  const final = new URL(finalUrl);
  const samePage =
    final.hostname === requested.hostname &&
    normalizePath(final.pathname) === normalizePath(requested.pathname);
  if (!samePage) {
    throw new DocFetchError(
      'redirected',
      `Requested ${url} but the server redirected to ${finalUrl}. ` +
        'That is not the requested page, so it is not returned as content.',
      url,
      finalUrl,
      response.status
    );
  }

  if (response.status === 404) {
    throw new DocFetchError('not-found', `Not found (HTTP 404): ${url}`, url, finalUrl, 404);
  }
  if (!response.ok) {
    throw new DocFetchError(
      'http-error',
      `HTTP ${response.status} from ${url}`,
      url,
      finalUrl,
      response.status
    );
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const text = await response.text();
  const looksLikeHtml = /^\s*(<!doctype html|<html)/i.test(text);

  if (contentType.includes('text/html') || looksLikeHtml) {
    throw new DocFetchError(
      'wrong-content',
      `Expected ${expect} from ${url} but received an HTML page. The URL does not point to the requested document.`,
      url,
      finalUrl,
      response.status
    );
  }

  if (expect === 'json') {
    try {
      JSON.parse(text);
    } catch {
      throw new DocFetchError('wrong-content', `Expected JSON from ${url} but the body did not parse`, url, finalUrl);
    }
  }

  return { text, finalUrl, contentType };
}

export interface SourceMeta {
  url: string;
  fetchedAt: string;
  ageSeconds: number;
  ttlSeconds: number;
  stale: boolean;
  warning?: string;
}

interface CacheEntry {
  text: string;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function ttlMs(): number {
  const fromEnv = Number(process.env.IC_MCP_CACHE_TTL_SECONDS);
  if (Number.isFinite(fromEnv) && fromEnv >= 0) {
    return fromEnv * 1000;
  }
  return 60 * 60 * 1000;
}

/** Drop all cached documents (used by tests). */
export function clearDocumentCache(): void {
  cache.clear();
}

/**
 * Return a document from cache or network.
 *
 * - Fresh cached copy: returned without a request unless `refresh` is set.
 * - Expired or missing: fetched. On failure an expired copy is returned with
 *   `stale: true` and a warning; with no copy the error is thrown.
 */
export async function getDocument(
  url: string,
  expect: Expect,
  options: { refresh?: boolean } = {}
): Promise<{ text: string; meta: SourceMeta }> {
  const ttl = ttlMs();
  const now = Date.now();
  const cached = cache.get(url);
  const meta = (entry: CacheEntry, stale: boolean, warning?: string): SourceMeta => ({
    url,
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    ageSeconds: Math.round((Date.now() - entry.fetchedAt) / 1000),
    ttlSeconds: Math.round(ttl / 1000),
    stale,
    ...(warning ? { warning } : {}),
  });

  if (cached && !options.refresh && now - cached.fetchedAt < ttl) {
    return { text: cached.text, meta: meta(cached, false) };
  }

  try {
    const { text } = await fetchDocument(url, expect);
    const entry = { text, fetchedAt: Date.now() };
    cache.set(url, entry);
    return { text, meta: meta(entry, false) };
  } catch (error: any) {
    if (cached) {
      return {
        text: cached.text,
        meta: meta(
          cached,
          true,
          `Could not refresh (${error?.message || error}). Serving the copy fetched at ${new Date(cached.fetchedAt).toISOString()}.`
        ),
      };
    }
    throw error;
  }
}

export async function getJson<T>(url: string, options: { refresh?: boolean } = {}): Promise<{ value: T; meta: SourceMeta }> {
  const { text, meta } = await getDocument(url, 'json', options);
  return { value: JSON.parse(text) as T, meta };
}

/** Error shape returned to tool callers. */
export function describeFetchError(error: any): { error: string; code: string; url?: string; finalUrl?: string } {
  if (error instanceof DocFetchError) {
    return {
      error: error.message,
      code: error.code,
      url: error.url,
      ...(error.finalUrl && error.finalUrl !== error.url ? { finalUrl: error.finalUrl } : {}),
    };
  }
  return { error: error?.message || String(error), code: 'unknown' };
}
