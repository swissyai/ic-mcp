/**
 * Lint for canister code that runs on a cloud engine (CloudEngine subnet).
 *
 * Rules from the cloud-engine-canisters skill
 * (https://skills.internetcomputer.org/skills/cloud-engine-canisters/):
 * 1. Engine canisters hold 0 cycles: never attach cycles to a call
 *    (any non-zero amount fails with IC0504).
 * 2. Cross-subnet calls must be bounded-wait and cycle-free
 *    (`(with timeout = N)` in Motoko, `Call::bounded_wait` in Rust).
 *    Calls between canisters on the same engine are exempt.
 * 4. Threshold signing, vetKD, the exchange-rate canister, the Bitcoin API and
 *    EVM/SOL RPC are reached through the engine's console proxy canister.
 *
 * HTTPS outcalls through the standard wrapper are free on an engine and are
 * not flagged.
 */

import type { ValidationIssue } from '../types/index.js';
import { REFS } from '../data/references.js';

export type EngineLintLanguage = 'motoko' | 'rust';

function lineOf(code: string, index: number): number {
  return code.substring(0, index).split('\n').length;
}

function blankComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
}

const CHAIN_KEY_METHODS = [
  'sign_with_ecdsa',
  'sign_with_schnorr',
  'ecdsa_public_key',
  'schnorr_public_key',
  'vetkd_derive_key',
  'vetkd_public_key',
  'get_exchange_rate',
];

const PROXY_HINT =
  'Route it through the engine\'s console proxy canister (`proxy` method, cycles inside ProxyArgs). Ask the engine owner for the proxy id and read it from the PROXY_CANISTER_ID environment variable.';

function chainKeyIssues(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const pattern = new RegExp(`\\b(${CHAIN_KEY_METHODS.join('|')}|bitcoin_[a-z_]+)\\b`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    issues.push({
      severity: 'warning',
      code: 'ENGINE-PROXY',
      line: lineOf(code, match.index),
      message: `\`${match[1]}\` targets a service on another subnet that charges cycles; an engine canister cannot call it directly.`,
      suggestedFix: PROXY_HINT,
      references: [REFS.cloudEngineCanisters],
    });
  }
  return issues;
}

function motokoIssues(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let match: RegExpExecArray | null;

  const withCycles = /\(\s*with\b[^)]*\bcycles\s*=/g;
  while ((match = withCycles.exec(code)) !== null) {
    issues.push({
      severity: 'error',
      code: 'ENGINE-CYCLES',
      line: lineOf(code, match.index),
      message: 'Engine canisters hold 0 cycles: remove the cycles attribute from this call. Any non-zero amount fails with IC0504.',
      suggestedFix: 'Drop `cycles = ...` entirely (not `cycles = 0`). Keep `(with timeout = N)` for cross-subnet calls.',
      references: [REFS.cloudEngineCanisters],
    });
  }

  const cyclesAdd = /\b(?:ExperimentalCycles|Cycles)\.add\b/g;
  while ((match = cyclesAdd.exec(code)) !== null) {
    issues.push({
      severity: 'error',
      code: 'ENGINE-CYCLES',
      line: lineOf(code, match.index),
      message: 'Attaching cycles with Cycles.add is not possible on an engine: canisters there hold 0 cycles.',
      suggestedFix: 'Remove the Cycles.add call. HTTPS outcalls through Call.httpRequest price themselves (0 on an engine).',
      references: [REFS.cloudEngineCanisters],
    });
  }

  if (/import\s+\w+\s+"mo:ic-vetkeys/.test(code)) {
    issues.push({
      severity: 'warning',
      code: 'ENGINE-PROXY',
      line: lineOf(code, code.search(/import\s+\w+\s+"mo:ic-vetkeys/)),
      message: 'mo:ic-vetkeys calls the management canister directly and attaches cycles, which an engine rejects.',
      suggestedFix: PROXY_HINT,
      references: [REFS.cloudEngineCanisters],
    });
  }

  const actorRefs = new Set<string>();
  for (const m of code.matchAll(/import\s+(\w+)\s+"canister:[^"]+"/g)) actorRefs.add(m[1]);
  for (const m of code.matchAll(/\b(?:let|var)\s+(\w+)\s*(?::[^=;]*)?=\s*actor\s*\(/g)) actorRefs.add(m[1]);
  for (const m of code.matchAll(/\b(?:let|var)\s+(\w+)\s*:\s*actor\s*\{/g)) actorRefs.add(m[1]);

  if (actorRefs.size > 0) {
    const names = [...actorRefs].join('|');
    const call = new RegExp(`\\bawait\\s+(\\(\\s*with\\b[^)]*\\))?\\s*(${names})\\s*\\.\\s*\\w+`, 'g');
    while ((match = call.exec(code)) !== null) {
      const attributes = match[1] || '';
      if (/\btimeout\s*=/.test(attributes)) continue;
      issues.push({
        severity: 'warning',
        code: 'ENGINE-BOUNDED-WAIT',
        line: lineOf(code, match.index),
        message: `Call to \`${match[2]}\` is unbounded-wait. Cross-subnet calls from or to an engine must be bounded-wait, or they are rejected ("Unbounded-wait calls and calls with cycles are not allowed to CloudEngine subnets"). Calls to canisters on the same engine are exempt.`,
        suggestedFix: `await (with timeout = 30) ${match[2]}.method(args)`,
        references: [REFS.cloudEngineCanisters, REFS.multiCanister],
      });
    }
  }

  issues.push(...chainKeyIssues(code));
  return issues;
}

function rustIssues(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let match: RegExpExecArray | null;

  const withCycles = /\.with_cycles\s*\(/g;
  while ((match = withCycles.exec(code)) !== null) {
    issues.push({
      severity: 'error',
      code: 'ENGINE-CYCLES',
      line: lineOf(code, match.index),
      message: 'Engine canisters hold 0 cycles: remove `.with_cycles(...)`. Any non-zero amount fails with IC0504.',
      references: [REFS.cloudEngineCanisters],
    });
  }

  const payment = /\bcall_with_payment(?:128)?\s*\(/g;
  while ((match = payment.exec(code)) !== null) {
    issues.push({
      severity: 'error',
      code: 'ENGINE-CYCLES',
      line: lineOf(code, match.index),
      message: '`call_with_payment` attaches cycles, which an engine canister does not hold. It is also an unbounded-wait call.',
      suggestedFix: 'Call::bounded_wait(canister_id, "method").with_arg(arg).await',
      references: [REFS.cloudEngineCanisters],
    });
  }

  const unbounded = /\bCall::unbounded_wait\s*\(/g;
  while ((match = unbounded.exec(code)) !== null) {
    issues.push({
      severity: 'warning',
      code: 'ENGINE-BOUNDED-WAIT',
      line: lineOf(code, match.index),
      message: 'Unbounded-wait call. Cross-subnet calls from or to an engine must use Call::bounded_wait; same-engine calls are exempt.',
      suggestedFix: 'Call::bounded_wait(canister_id, "method")',
      references: [REFS.cloudEngineCanisters, REFS.multiCanister],
    });
  }

  const legacyCall = /\bic_cdk::(?:api::call::)?call(?:_raw|_raw128)?\s*(?:::<[^>]*>)?\s*\(/g;
  while ((match = legacyCall.exec(code)) !== null) {
    issues.push({
      severity: 'warning',
      code: 'ENGINE-BOUNDED-WAIT',
      line: lineOf(code, match.index),
      message: 'The pre-0.18 ic_cdk call API makes unbounded-wait calls. Cross-subnet calls from or to an engine must be bounded-wait.',
      suggestedFix: 'Call::bounded_wait(canister_id, "method").with_arg(arg).await (ic-cdk >= 0.18)',
      references: [REFS.cloudEngineCanisters],
    });
  }

  if (/\bic_vetkeys\b/.test(code)) {
    issues.push({
      severity: 'warning',
      code: 'ENGINE-PROXY',
      line: lineOf(code, code.search(/\bic_vetkeys\b/)),
      message: 'ic-vetkeys calls the management canister directly and attaches cycles, which an engine rejects.',
      suggestedFix: PROXY_HINT,
      references: [REFS.cloudEngineCanisters],
    });
  }

  issues.push(...chainKeyIssues(code));
  return issues;
}

export function lintEngineRules(code: string, language: EngineLintLanguage): ValidationIssue[] {
  const clean = blankComments(code);
  return language === 'rust' ? rustIssues(clean) : motokoIssues(clean);
}
