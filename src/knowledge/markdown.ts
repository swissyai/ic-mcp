/**
 * Markdown helpers for serving official documents one section at a time.
 */

import { parse as parseYaml } from 'yaml';

export interface Section {
  /** "0" for text before the first `##`, "N" for the Nth `##`, "N.M" for the Mth `###` inside it. */
  id: string;
  title: string;
  level: number;
  /** Full text of the section, including its subsections. */
  text: string;
  /** Text of the section up to its first subsection. */
  ownText: string;
  chars: number;
}

export interface FrontMatter {
  data: Record<string, any>;
  body: string;
}

export function parseFrontMatter(markdown: string): FrontMatter {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { data: {}, body: markdown };
  }
  let data: Record<string, any> = {};
  try {
    const parsed = parseYaml(match[1]);
    if (parsed && typeof parsed === 'object') {
      data = parsed as Record<string, any>;
    }
  } catch {
    data = {};
  }
  return { data, body: markdown.slice(match[0].length) };
}

interface Heading {
  level: number;
  title: string;
  line: number;
}

function findHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = [];
  let fence: string | null = null;
  lines.forEach((line, index) => {
    const fenceMatch = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) {
        fence = marker;
      } else if (fence === marker) {
        fence = null;
      }
      return;
    }
    if (fence !== null) return;
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      headings.push({ level: heading[1].length, title: heading[2].trim(), line: index });
    }
  });
  return headings;
}

/**
 * Split a markdown body into `##` sections and `###` subsections.
 * Headings inside fenced code blocks are ignored.
 */
export function splitSections(body: string): Section[] {
  const lines = body.split('\n');
  const headings = findHeadings(lines).filter(h => h.level === 2 || h.level === 3);
  const sections: Section[] = [];

  const slice = (from: number, to: number) => lines.slice(from, to).join('\n').trim();

  const firstH2 = headings.find(h => h.level === 2);
  const preambleEnd = firstH2 ? firstH2.line : lines.length;
  const preamble = slice(0, preambleEnd);
  if (preamble) {
    sections.push({ id: '0', title: 'Introduction', level: 1, text: preamble, ownText: preamble, chars: preamble.length });
  }

  let h2Index = 0;
  let h3Index = 0;
  headings.forEach((heading, i) => {
    if (heading.level === 2) {
      h2Index += 1;
      h3Index = 0;
    } else {
      if (h2Index === 0) return;
      h3Index += 1;
    }
    let end = lines.length;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= heading.level) {
        end = headings[j].line;
        break;
      }
    }
    let ownEnd = end;
    if (heading.level === 2) {
      for (let j = i + 1; j < headings.length && headings[j].line < end; j++) {
        if (headings[j].level === 3) {
          ownEnd = headings[j].line;
          break;
        }
      }
    }
    const text = slice(heading.line, end);
    sections.push({
      id: heading.level === 2 ? String(h2Index) : `${h2Index}.${h3Index}`,
      title: heading.title,
      level: heading.level,
      text,
      ownText: slice(heading.line, ownEnd),
      chars: text.length,
    });
  });

  return sections;
}

export function outline(sections: Section[]): Array<{ id: string; title: string; chars: number }> {
  return sections.map(s => ({
    id: s.id,
    title: s.level === 3 ? `  ${s.title}` : s.title,
    chars: s.chars,
  }));
}

/** Find a section by id ("4", "4.2") or by heading text (exact, then partial match). */
export function findSection(sections: Section[], selector: string): Section | undefined {
  const wanted = selector.trim();
  const byId = sections.find(s => s.id === wanted);
  if (byId) return byId;
  const lower = wanted.toLowerCase().replace(/^#+\s*/, '');
  return (
    sections.find(s => s.title.toLowerCase() === lower) ||
    sections.find(s => s.title.toLowerCase().includes(lower))
  );
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'for', 'from', 'how', 'i', 'in', 'is', 'it',
  'my', 'of', 'on', 'or', 'the', 'to', 'use', 'what', 'when', 'with', 'can', 'does', 'should', 'into',
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9_.:-]*/g) || [])
    .map(t => t.replace(/[.:-]+$/, ''))
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Score text against query terms. Title hits weigh more than body hits, and
 * body hits are capped so long sections do not win on length alone.
 */
export function scoreText(terms: string[], title: string, body: string): number {
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let score = 0;
  let matched = 0;
  for (const term of terms) {
    const inTitle = t.includes(term);
    const inBody = Math.min(countOccurrences(b, term), 6);
    if (inTitle || inBody > 0) matched += 1;
    score += (inTitle ? 6 : 0) + inBody;
  }
  if (terms.length > 1 && matched === terms.length) {
    score *= 1.5;
  }
  return score;
}

/**
 * Rank sections for a query. Subsections are preferred over their parent when
 * they score at least as well, so the smallest relevant unit is returned.
 */
export function rankSections(sections: Section[], query: string): Array<{ section: Section; score: number }> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const scored = sections
    .map(section => ({
      section,
      score: scoreText(terms, section.title, section.level === 2 ? section.ownText : section.text),
    }))
    .filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score || a.section.chars - b.section.chars);
  return scored;
}

/** Cut text at a paragraph boundary, without leaving a code fence open. */
export function truncate(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  let cut = text.lastIndexOf('\n\n', maxChars);
  if (cut < maxChars * 0.5) cut = maxChars;
  let result = text.slice(0, cut);
  const fences = (result.match(/^\s{0,3}```/gm) || []).length;
  if (fences % 2 === 1) {
    result += '\n```';
  }
  return { text: result.trimEnd(), truncated: true };
}

export interface LlmsEntry {
  section: string;
  title: string;
  url: string;
  description: string;
}

/** Parse an llms.txt index: `## Section` headings with `- [Title](url): description` entries. */
export function parseLlmsTxt(text: string): { title: string; entries: LlmsEntry[] } {
  let title = '';
  let section = '';
  const entries: LlmsEntry[] = [];
  for (const line of text.split('\n')) {
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1 && !title) {
      title = h1[1].trim();
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      section = h2[1].trim();
      continue;
    }
    const entry = line.match(/^\s*[-*]\s+\[([^\]]+)\]\(([^)\s]+)\)(?::\s*(.*))?$/);
    if (entry) {
      entries.push({
        section,
        title: entry[1].trim(),
        url: entry[2].trim(),
        description: (entry[3] || '').trim(),
      });
    }
  }
  return { title, entries };
}
