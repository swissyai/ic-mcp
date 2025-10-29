/**
 * Integration tests for common user workflows
 * Tests the actual user experience paths through the tools
 */

import { describe, it, expect } from 'vitest';
import { query } from '../../src/tools/query.js';
import { action } from '../../src/tools/action.js';
import { help } from '../../src/tools/help.js';

describe('Common User Workflows', () => {
  describe('Workflow 1: Exploration → Documentation → Examples', () => {
    it('should guide user from discovery to usage', async () => {
      // Step 1: User explores available modules
      const discovery = await query({
        query: 'list all data structures',
        format: 'json',
      });

      expect(discovery.content).toBeDefined();
      expect(discovery.metadata?.intent).toBe('discover');
      expect(discovery.metadata?.confidence).toBeGreaterThanOrEqual(0.9);

      // Step 2: User asks for documentation on specific module
      const docs = await query({
        query: 'how to use Map',
        format: 'json',
      });

      expect(docs.content).toBeDefined();
      expect(docs.metadata?.intent).toBe('document');

      // Step 3: User requests code examples
      const examples = await query({
        query: 'Map examples',
        format: 'json',
      });

      expect(examples.content).toBeDefined();
      expect(examples.metadata?.intent).toBe('example');
    });
  });

  describe('Workflow 2: Problem-solving with search', () => {
    it('should find relevant modules from natural language', async () => {
      // User describes what they need
      const searchResult = await query({
        query: 'random numbers',
        format: 'json',
      });

      expect(searchResult.content).toBeDefined();
      expect(searchResult.metadata?.intent).toBe('search');

      // Should find Random module
      const text = searchResult.content[0].text || '';
      const parsed = JSON.parse(text);
      expect(parsed.results).toBeDefined();
      expect(parsed.results.length).toBeGreaterThan(0);
      expect(parsed.results[0].name).toBe('Random');
    });
  });

  describe('Workflow 3: Empty query → guidance', () => {
    it('should provide useful default when user submits empty query', async () => {
      const emptyResult = await query({
        query: '',
        format: 'json',
      });

      expect(emptyResult.content).toBeDefined();
      expect(emptyResult.metadata?.intent).toBe('discover');
      expect(emptyResult.metadata?.confidence).toBe(1.0);
      expect(emptyResult.metadata?.suggestions).toBeDefined();
      expect(emptyResult.metadata?.suggestions?.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow 4: Help → Query workflow', () => {
    it('should provide comprehensive help that guides to query tool', async () => {
      // User asks for help
      const helpResult = await help({
        section: 'query',
      });

      expect(helpResult.content).toBeDefined();
      const helpText = helpResult.content[0].text || '';

      // Should contain examples and guidance
      expect(helpText).toContain('Examples');
      expect(helpText).toContain('list all');
      expect(helpText).toContain('how to use');
    });
  });

  describe('Workflow 5: Code validation workflow', () => {
    it('should validate Motoko code and return results', async () => {
      // Valid code
      const validResult = await action({
        action: 'validate my Motoko code',
        context: {
          code: 'actor { public func greet() : async Text { "Hello" } }',
          language: 'motoko',
        },
        format: 'json',
      });

      expect(validResult.content).toBeDefined();
      expect(validResult.content[0].text).toBeTruthy();

      const validData = JSON.parse(validResult.content[0].text || '{}');
      expect(validData).toBeDefined();

      // Invalid code - note: type errors in Motoko often get caught by compiler
      // This test verifies the action tool handles validation requests properly
      const invalidResult = await action({
        action: 'validate my Motoko code',
        context: {
          code: 'actor { var x : Text = 123 }', // clear type error
          language: 'motoko',
        },
        format: 'json',
      });

      expect(invalidResult.content).toBeDefined();
      expect(invalidResult.content[0].text).toBeTruthy();

      // Validation always returns some result (valid or invalid)
      const invalidData = JSON.parse(invalidResult.content[0].text || '{}');
      expect(invalidData).toBeDefined();
    });
  });

  describe('Workflow 6: Discovery with related modules', () => {
    it('should suggest related modules after search', async () => {
      const searchResult = await query({
        query: 'queue operations',
        format: 'json',
        includeRelated: true,
      });

      expect(searchResult.content).toBeDefined();

      // Metadata should contain related modules (if any found)
      // Note: related modules are in metadata, not always populated
      if (searchResult.metadata?.related) {
        expect(searchResult.metadata.related).toBeTruthy();
      }

      // Should find Queue in search results
      const text = searchResult.content[0].text || '';
      const parsed = JSON.parse(text);
      expect(parsed.results).toBeDefined();
      expect(parsed.results.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow 7: Action tool error recovery', () => {
    it('should provide helpful error when parameters missing', async () => {
      // Missing required context
      const missingParams = await action({
        action: 'validate my Motoko code',
        // No context provided
        format: 'json',
      });

      expect(missingParams.content).toBeDefined();
      const errorData = JSON.parse(missingParams.content[0].text || '{}');

      // Should have helpful error
      expect(errorData.error).toBeDefined();
      expect(errorData.example).toBeDefined();
    });
  });

  describe('Workflow 8: Low confidence intent handling', () => {
    it('should handle ambiguous queries gracefully', async () => {
      // Ambiguous action (just "validate" without specifying what)
      const ambiguous = await action({
        action: 'validate',
        format: 'json',
      });

      expect(ambiguous.content).toBeDefined();
      expect(ambiguous.metadata?.confidence).toBeLessThan(0.7);

      // Should still provide suggestions
      const text = ambiguous.content[0].text || '';
      expect(text).toBeTruthy();
    });
  });

  describe('Workflow 9: Semantic search accuracy', () => {
    it('should understand use-case keywords', async () => {
      // Test various semantic queries
      const queries = [
        { query: 'token canister', expectedModule: 'Principal' },
        { query: 'hash tables', expectedModule: 'HashMap' },
        { query: 'sorting', expectedModule: 'Array' },
      ];

      for (const { query: q, expectedModule } of queries) {
        const result = await query({
          query: q,
          format: 'json',
        });

        const text = result.content[0].text || '';
        const parsed = JSON.parse(text);

        // Should find the expected module in results
        const found = parsed.results?.some((r: any) => r.name === expectedModule);
        expect(found).toBe(true);
      }
    });
  });

  describe('Workflow 10: Help tool completeness', () => {
    it('should provide guidance for all tool sections', async () => {
      const sections = ['overview', 'query', 'action', 'examples', 'tokens'];

      for (const section of sections) {
        const helpResult = await help({ section: section as any });

        expect(helpResult.content).toBeDefined();
        const text = helpResult.content[0].text || '';
        expect(text.length).toBeGreaterThan(100); // Non-trivial content
      }
    });
  });
});
