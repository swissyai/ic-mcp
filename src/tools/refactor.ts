/**
 * Code refactorings for canisters.
 *
 * Only caller checks are applied. Requests to insert upgrade hooks or `stable`
 * declarations are answered with the current persistence model instead:
 * Motoko actors persist state under enhanced orthogonal persistence and change
 * state shape through the mops migration chain; Rust canisters keep data that
 * must survive upgrades in stable structures.
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { REFS } from '../data/references.js';

export const refactorSchema = z.object({
  code: z.string().describe('Code to refactor'),
  language: z.enum(['motoko', 'rust']).describe('Language'),
  refactoring: z
    .enum(['add-caller-checks', 'modernize', 'add-upgrade-hooks', 'add-stable-vars'])
    .describe('add-caller-checks (or modernize, its alias). add-upgrade-hooks and add-stable-vars are no longer applied.'),
});

export type RefactorInput = z.infer<typeof refactorSchema>;

interface RefactoringChange {
  type: string;
  description: string;
  linesAdded: number;
  linesModified: number;
}

function addMotokoCallerChecks(code: string): { refactored: string; changes: RefactoringChange[] } {
  const matches = Array.from(code.matchAll(/public\s+shared\s+func\s+(\w+)/g));
  if (matches.length === 0) {
    return {
      refactored: code,
      changes: [{ type: 'no-op', description: 'No `public shared func` without a caller pattern found', linesAdded: 0, linesModified: 0 }],
    };
  }
  let refactored = code;
  for (const match of matches) {
    refactored = refactored.replace(match[0], `public shared ({ caller }) func ${match[1]}`);
  }
  return {
    refactored,
    changes: [
      {
        type: 'modified',
        description: `Exposed \`caller\` in ${matches.length} function(s). Add the check itself, e.g. \`if (caller != owner) { Runtime.trap("caller is not the owner") };\``,
        linesAdded: 0,
        linesModified: matches.length,
      },
    ],
  };
}

function addRustCallerChecks(code: string): { refactored: string; changes: RefactoringChange[] } {
  const matches = Array.from(code.matchAll(/#\[update\]\s*(?:async\s+)?fn\s+(\w+)/g));
  if (matches.length === 0) {
    return {
      refactored: code,
      changes: [{ type: 'no-op', description: 'No update functions found', linesAdded: 0, linesModified: 0 }],
    };
  }
  const changes: RefactoringChange[] = [];
  let refactored = code;
  if (!/use ic_cdk::(api::)?(msg_)?caller/.test(code)) {
    refactored = `use ic_cdk::api::msg_caller;\n${refactored.startsWith('use ') ? '' : '\n'}${refactored}`;
    changes.push({ type: 'added', description: 'Added `use ic_cdk::api::msg_caller;`', linesAdded: 1, linesModified: 0 });
  }
  changes.push({
    type: 'info',
    description: `Found ${matches.length} update function(s): check \`msg_caller()\` at the start of each privileged one`,
    linesAdded: 0,
    linesModified: 0,
  });
  return { refactored, changes };
}

function removedRefactoring(input: RefactorInput): string {
  const lines = [`# ${input.refactoring} is not applied`, ''];
  if (input.language === 'motoko') {
    lines.push(
      'Motoko actors persist their state under enhanced orthogonal persistence: `stable` declarations and `system func preupgrade/postupgrade` are not needed and the writing-motoko skill rules them out.',
      'When the shape of actor state changes, add a migration to the mops-managed migration chain.',
      '',
      `- ${REFS.writingMotoko}`,
      `- ${REFS.migratingMotokoActors}`
    );
  } else {
    lines.push(
      'Heap state in Rust (`thread_local!`, statics) is wiped on upgrade. Keep data that must survive upgrades in ic-stable-structures (StableBTreeMap with MemoryManager); serializing large state in #[pre_upgrade] can trap.',
      '',
      `- ${REFS.stableMemory}`
    );
  }
  return lines.join('\n');
}

export async function executeRefactor(input: RefactorInput): Promise<string> {
  logger.info(`Refactoring ${input.language} code: ${input.refactoring}`);

  if (input.refactoring === 'add-upgrade-hooks' || input.refactoring === 'add-stable-vars') {
    return removedRefactoring(input);
  }

  const result = input.language === 'motoko' ? addMotokoCallerChecks(input.code) : addRustCallerChecks(input.code);
  const lines: string[] = [];
  if (result.changes.some(c => c.type !== 'no-op' && c.type !== 'info')) {
    lines.push('# Refactored Code\n', `\`\`\`${input.language}`, result.refactored, '```\n', '**Changes:**');
  } else {
    lines.push('No code changes.');
  }
  for (const change of result.changes) {
    if (change.type !== 'no-op' || lines.length === 1) lines.push(`- ${change.description}`);
  }
  return lines.join('\n');
}
