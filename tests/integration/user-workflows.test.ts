/**
 * Integration tests for simplified query tool
 * Tests data fetching operations (Claude handles intelligence)
 */

import { describe, it, expect } from 'vitest';
import { query } from '../../src/tools/query.js';
import { action } from '../../src/tools/action.js';

describe('Simplified Query Tool', () => {
  describe('list-all operation', () => {
    it('should return all modules organized by category', async () => {
      const result = await query({
        operation: 'list-all',
        format: 'json',
      });

      expect(result.content).toBeDefined();
      expect(result.metadata?.operation).toBe('list-all');

      const data = JSON.parse(result.content[0].text || '{}');
      expect(data.total).toBe(44);
      expect(data.categories).toBeDefined();
      expect(Object.keys(data.categories).length).toBeGreaterThan(0);
    });
  });

  describe('document operation', () => {
    it('should fetch documentation for specified modules', async () => {
      const result = await query({
        operation: 'document',
        modules: ['Array', 'Map'],
        format: 'json',
      });

      expect(result.content).toBeDefined();
      expect(result.metadata?.operation).toBe('document');

      const data = JSON.parse(result.content[0].text || '{}');
      expect(data.modules).toBeDefined();
      expect(data.modules.length).toBe(2);
    });

    it('should handle missing modules parameter', async () => {
      const result = await query({
        operation: 'document',
        format: 'json',
      });

      const data = JSON.parse(result.content[0].text || '{}');
      expect(data.error).toBeDefined();
    });

    it('should handle invalid module names', async () => {
      const result = await query({
        operation: 'document',
        modules: ['NonExistentModule'],
        format: 'json',
      });

      const data = JSON.parse(result.content[0].text || '{}');
      expect(data.error).toBeDefined();
    });
  });

  describe('examples operation', () => {
    it('should fetch code examples for specified modules', async () => {
      const result = await query({
        operation: 'examples',
        modules: ['Array'],
        format: 'json',
      });

      expect(result.content).toBeDefined();
      expect(result.metadata?.operation).toBe('examples');

      const data = JSON.parse(result.content[0].text || '{}');
      expect(data.modules).toBeDefined();
      expect(data.modules.length).toBe(1);
      expect(data.modules[0].module).toBe('Array');
    });

    it('should handle missing modules parameter', async () => {
      const result = await query({
        operation: 'examples',
        format: 'json',
      });

      const data = JSON.parse(result.content[0].text || '{}');
      expect(data.error).toBeDefined();
    });
  });

  describe('typical workflow', () => {
    it('should support complete user journey', async () => {
      // Step 1: Claude sees user wants queue operations
      // Claude lists all modules to understand what's available
      const listResult = await query({
        operation: 'list-all',
        format: 'json',
      });

      const modules = JSON.parse(listResult.content[0].text || '{}');
      expect(modules.total).toBe(44);

      // Step 2: Claude identifies Queue module from the list
      // Claude fetches Queue documentation
      const docResult = await query({
        operation: 'document',
        modules: ['Queue'],
        format: 'json',
      });

      const docs = JSON.parse(docResult.content[0].text || '{}');
      expect(docs.modules).toBeDefined();
      expect(docs.modules[0].name).toBe('Queue');

      // Step 3: Claude fetches Queue examples
      const exampleResult = await query({
        operation: 'examples',
        modules: ['Queue'],
        format: 'json',
      });

      const examples = JSON.parse(exampleResult.content[0].text || '{}');
      expect(examples.modules).toBeDefined();
      expect(examples.modules[0].module).toBe('Queue');
    });
  });

  describe('code validation workflow', () => {
    it('should validate Motoko code via action tool', async () => {
      const result = await action({
        action: 'validate my Motoko code',
        context: {
          code: 'actor { public func greet() : async Text { "Hello" } }',
          language: 'motoko',
        },
        format: 'json',
      });

      expect(result.content).toBeDefined();
    });
  });
});
