import { describe, it, expect } from 'vitest';
import { checkBestPractices } from '../../src/validators/motoko.js';
import { checkMotokoSecurity, checkHttpsOutcalls } from '../../src/validators/security-patterns.js';
import { parseMocErrors } from '../../src/validators/motoko-compiler.js';

const messages = (code: string) => checkBestPractices(code).map(i => i.message);

describe('Motoko source checks follow the writing-motoko skill', () => {
  it('accepts plain break and continue', () => {
    const code = 'actor { public func f(xs : [Nat]) : async () { for (x in xs.values()) { if (x > 3) break; if (x == 1) continue; } } }';
    expect(checkBestPractices(code)).toEqual([]);
  });

  it('flags .vals()', () => {
    expect(messages('let it = items.vals();')[0]).toMatch(/\.values\(\)/);
  });

  it('flags mo:base imports and suggests mo:core', () => {
    const [issue] = checkBestPractices('import Buffer "mo:base/Buffer";');
    expect(issue.message).toMatch(/mo:base is deprecated/);
    expect(issue.suggestedFix).toBe('import List "mo:core/List";');
  });

  it('flags the stable keyword and upgrade hooks instead of recommending them', () => {
    const code = 'actor { stable var n = 0; system func preupgrade() {}; system func postupgrade() {} }';
    const found = messages(code);
    expect(found.some(m => /`stable` keyword is not needed/.test(m))).toBe(true);
    expect(found.filter(m => /system func (pre|post)upgrade/.test(m))).toHaveLength(2);
  });

  it('ignores patterns inside comments', () => {
    expect(checkBestPractices('// items.vals() was replaced\nlet x = 1;')).toEqual([]);
  });
});

describe('security checks no longer push removed patterns', () => {
  it('does not demand cycles on HTTPS outcalls', () => {
    const code = 'let r = await Call.httpRequest({ url = "https://x"; transform = ?t; max_response_bytes = ?1000; method = #get });';
    expect(checkHttpsOutcalls(code).some(i => /cycles/i.test(i.message))).toBe(false);
  });

  it('does not ask for upgrade hooks next to stable variables', () => {
    const issues = checkMotokoSecurity('actor { stable var users : [Text] = []; }');
    expect(issues.some(i => /upgrade hooks/i.test(i.message))).toBe(false);
    expect(JSON.stringify(issues)).not.toContain('preupgrade');
  });
});

describe('parseMocErrors', () => {
  it('parses mops check diagnostics with continuation lines', () => {
    const output = [
      'main.mo:4.41-4.59: warning [M0236], You can use the dot notation `items.add(...)` here',
      'main.mo:5.59-5.63: type error [M0072], field vals does not exist in type:',
      '  List<Nat> = {',
      '                var blockIndex : Nat;',
      '              }',
      '✗ Check failed for canister snippet (exit code: 1)',
    ].join('\n');
    const issues = parseMocErrors(output);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ severity: 'warning', code: 'M0236', line: 4, column: 41 });
    expect(issues[1]).toMatchObject({ severity: 'error', code: 'M0072', line: 5 });
    expect(issues[1].message).toContain('List<Nat>');
  });
});
