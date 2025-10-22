/**
 * icp/speed tool
 * Performance analysis: cycles, memory, bottlenecks
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';

/**
 * Input schema
 */
export const speedSchema = z.object({
  code: z.string().describe('Code to analyze'),
  language: z.enum(['motoko', 'rust']).describe('Language'),
  focus: z.enum(['full', 'memory', 'cycles', 'latency']).optional().describe('Analysis focus'),
});

export type SpeedInput = z.infer<typeof speedSchema>;

/**
 * Tool definition (token-efficient)
 */
export const speedTool: Tool = {
  name: 'icp/speed',
  description: 'Analyze canister performance: memory usage, cycle costs, latency bottlenecks.',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      language: { type: 'string', enum: ['motoko', 'rust'] },
      focus: { type: 'string', enum: ['full', 'memory', 'cycles', 'latency'] },
    },
    required: ['code', 'language'],
  },
};

/**
 * Performance issue
 */
interface PerformanceIssue {
  category: 'memory' | 'cycles' | 'latency';
  severity: 'high' | 'medium' | 'low';
  line?: number;
  issue: string;
  impact: string;
  fix: string;
  estimatedGain?: string;
}

/**
 * Analyze memory patterns
 */
function analyzeMemory(code: string, language: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  // Unbounded collections
  if (language === 'motoko') {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // HashMap/TrieMap without size limit
      if (line.match(/(HashMap|TrieMap|Buffer)\.new/) && !line.includes('capacity')) {
        issues.push({
          category: 'memory',
          severity: 'high',
          line: i + 1,
          issue: 'Unbounded collection detected',
          impact: 'Could cause heap overflow (4GB limit)',
          fix: 'Add pagination or max size limit',
          estimatedGain: '~95% memory reduction',
        });
      }

      // Recursive calls without tail optimization
      if (line.includes('func') && code.includes('await')) {
        const funcName = line.match(/func\s+(\w+)/)?.[1];
        if (funcName && code.includes(`${funcName}(`)) {
          issues.push({
            category: 'memory',
            severity: 'medium',
            line: i + 1,
            issue: 'Potential stack overflow in recursive async',
            impact: 'Stack grows with each recursion',
            fix: 'Use iteration or accumulator pattern',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Analyze cycle costs
 */
function analyzeCycles(code: string, _language: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Inter-canister calls in loops
    if (line.includes('for') || line.includes('while')) {
      const loopStart = i;
      const loopEnd = Math.min(i + 20, lines.length);
      const loopBody = lines.slice(loopStart, loopEnd).join('\n');

      if (loopBody.includes('await') && loopBody.includes('call')) {
        issues.push({
          category: 'cycles',
          severity: 'high',
          line: i + 1,
          issue: 'Inter-canister call inside loop',
          impact: '~1M cycles per call × iterations',
          fix: 'Batch calls or move outside loop',
          estimatedGain: '~90% cycle reduction',
        });
      }
    }

    // Large data serialization
    if (line.includes('encode') || line.includes('serialize')) {
      issues.push({
        category: 'cycles',
        severity: 'medium',
        line: i + 1,
        issue: 'Large data serialization',
        impact: 'Cycles grow with data size',
        fix: 'Use streaming or pagination',
      });
    }
  }

  return issues;
}

/**
 * Analyze latency bottlenecks
 */
function analyzeLatency(code: string, _language: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Sequential awaits that could be parallel
    if (line.includes('await')) {
      const nextLine = lines[i + 1] || '';
      if (nextLine.includes('await')) {
        issues.push({
          category: 'latency',
          severity: 'medium',
          line: i + 1,
          issue: 'Sequential awaits (could be parallel)',
          impact: 'Latency = sum of all calls',
          fix: 'Use Promise.all or parallel await',
          estimatedGain: '~50% latency reduction',
        });
      }
    }

    // N+1 query pattern
    if (line.includes('for') && code.slice(i, i + 200).includes('get(')) {
      issues.push({
        category: 'latency',
        severity: 'high',
        line: i + 1,
        issue: 'N+1 query pattern detected',
        impact: 'O(n) lookups instead of O(1)',
        fix: 'Batch queries or use index',
      });
    }
  }

  return issues;
}

/**
 * Calculate performance score
 */
function calculateScore(issues: PerformanceIssue[]): number {
  const penalties = {
    high: 30,
    medium: 15,
    low: 5,
  };

  const totalPenalty = issues.reduce((sum, issue) => sum + penalties[issue.severity], 0);
  return Math.max(0, 100 - totalPenalty);
}

/**
 * Execute speed analysis
 */
export async function executeSpeed(input: SpeedInput): Promise<string> {
  logger.info(`Analyzing ${input.language} performance`);

  const focus = input.focus || 'full';
  const allIssues: PerformanceIssue[] = [];

  // Run analyses based on focus
  if (focus === 'full' || focus === 'memory') {
    allIssues.push(...analyzeMemory(input.code, input.language));
  }

  if (focus === 'full' || focus === 'cycles') {
    allIssues.push(...analyzeCycles(input.code, input.language));
  }

  if (focus === 'full' || focus === 'latency') {
    allIssues.push(...analyzeLatency(input.code, input.language));
  }

  // Calculate score
  const score = calculateScore(allIssues);

  // Format output (token-efficient)
  const lines: string[] = [];

  // Score and summary
  const scoreEmoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
  lines.push(`${scoreEmoji} **Performance Score: ${score}/100**\n`);

  // Issues by category
  const byCategory = {
    memory: allIssues.filter((i) => i.category === 'memory'),
    cycles: allIssues.filter((i) => i.category === 'cycles'),
    latency: allIssues.filter((i) => i.category === 'latency'),
  };

  for (const [category, issues] of Object.entries(byCategory)) {
    if (issues.length === 0) continue;

    const categoryEmoji = { memory: '💾', cycles: '⚡', latency: '⏱️' }[category];
    lines.push(`## ${categoryEmoji} ${category.charAt(0).toUpperCase() + category.slice(1)}\n`);

    // Show high severity first
    const sorted = issues.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    for (const issue of sorted.slice(0, 3)) {
      // Limit to top 3 per category
      const sevEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[issue.severity];
      lines.push(`**${sevEmoji} Line ${issue.line || '?'}:** ${issue.issue}`);
      lines.push(`- Impact: ${issue.impact}`);
      lines.push(`- Fix: ${issue.fix}`);
      if (issue.estimatedGain) {
        lines.push(`- Gain: ${issue.estimatedGain}`);
      }
      lines.push('');
    }

    if (issues.length > 3) {
      lines.push(`*+${issues.length - 3} more ${category} issues*\n`);
    }
  }

  if (allIssues.length === 0) {
    lines.push('✅ No performance issues detected!');
  }

  return lines.join('\n');
}
