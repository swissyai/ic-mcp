/**
 * Integration tests for icp/validate tool
 * Tests real validation with didc and moc compilers
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { validate } from '../../src/tools/validate.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('icp/validate integration tests', () => {
  beforeAll(async () => {
    // Verify prerequisites are installed
    try {
      await execAsync('didc --version');
    } catch {
      console.warn('Warning: didc not installed, Candid tests may fail');
    }

    try {
      await execAsync('dfx --version');
    } catch {
      console.warn('Warning: dfx not installed, Motoko tests may fail');
    }
  });

  describe('Candid validation', () => {
    it('should validate correct Candid interface', async () => {
      const result = await validate({
        code: 'service : { greet : (text) -> (text) query }',
        language: 'candid',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(true);
      expect(parsed.issues).toHaveLength(0);
    });

    it('should detect syntax errors in Candid', async () => {
      const result = await validate({
        code: 'service : { invalid syntax here }',
        language: 'candid',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(false);
      expect(parsed.issues.length).toBeGreaterThan(0);
      expect(parsed.issues[0].severity).toBe('error');
    });

    it('should validate complex Candid with records and variants', async () => {
      const code = `
        type User = record {
          id: nat;
          name: text;
          email: opt text;
        };

        type Result = variant {
          Ok: User;
          Err: text;
        };

        service : {
          getUser: (nat) -> (Result) query;
          updateUser: (User) -> (Result);
        }
      `;

      const result = await validate({ code, language: 'candid' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(true);
    });
  });

  describe('Motoko validation', () => {
    it('should validate correct Motoko actor', async () => {
      const code = `
        actor HelloWorld {
          public query func greet(name : Text) : async Text {
            return "Hello, " # name # "!";
          };
        }
      `;

      const result = await validate({ code, language: 'motoko' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(true);
      expect(parsed.issues).toHaveLength(0);
    });

    it('should detect type errors in Motoko', async () => {
      const code = `
        actor Test {
          public func badTypes() : async Text {
            let x : Nat = "not a number";
            return x;
          };
        }
      `;

      const result = await validate({ code, language: 'motoko' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(false);
      expect(parsed.issues.length).toBeGreaterThan(0);
    });

    it('should validate Motoko with stable variables', async () => {
      const code = `
        actor Counter {
          stable var count : Nat = 0;

          public func increment() : async Nat {
            count += 1;
            return count;
          };

          public query func get() : async Nat {
            return count;
          };
        }
      `;

      const result = await validate({ code, language: 'motoko' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(true);
    });
  });

  describe('Rust validation', () => {
    it('should validate correct ic-cdk Rust code', async () => {
      const code = `
        use ic_cdk_macros::*;

        #[query]
        fn greet(name: String) -> String {
            format!("Hello, {}!", name)
        }

        #[update]
        fn set_name(name: String) {
            // implementation
        }
      `;

      const result = await validate({ code, language: 'rust' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(true);
    });

    it('should warn about missing ic-cdk imports', async () => {
      const code = `
        #[query]
        fn greet() -> String {
            "Hello".to_string()
        }
      `;

      const result = await validate({ code, language: 'rust' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.issues.some(i => i.message.includes('import'))).toBe(true);
    });
  });

  describe('Security checks', () => {
    it('should detect missing caller validation when enabled', async () => {
      const code = `
        actor Admin {
          public func deleteAll() : async () {
            // Missing caller check - dangerous!
          };
        }
      `;

      const result = await validate({
        code,
        language: 'motoko',
        context: { securityCheck: true },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.issues.some(i =>
        i.message.toLowerCase().includes('caller') ||
        i.message.toLowerCase().includes('security')
      )).toBe(true);
    });
  });
});
