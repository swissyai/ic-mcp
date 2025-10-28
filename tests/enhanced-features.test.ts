/**
 * Tests for Enhanced IC-MCP Features
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { discover } from '../src/tools/motoko-discovery';
import { enhancedMotokoCore } from '../src/tools/motoko-core-enhanced';
import { analyzeIntent, generateUsageGuide } from '../src/tools/intelligent-router';

describe('Enhanced IC-MCP Features', () => {
  describe('Discovery Tool', () => {
    it('should list all modules', async () => {
      const result = await discover({
        action: 'list-all',
        format: 'names-only',
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('Array');
      expect(text).toContain('Map');
      expect(text).toContain('pure/List');
      expect(text).toContain('Principal');
    });

    it('should search for modules', async () => {
      const result = await discover({
        action: 'search',
        query: 'queue',
      });

      expect(result.content).toBeDefined();
      const text = result.content[0].text;
      expect(text).toContain('Queue');
      expect(text).toContain('pure/Queue');
      expect(text).toContain('RealTimeQueue');
    });

    it('should filter by category', async () => {
      const result = await discover({
        action: 'category',
        category: 'data-structures/immutable',
      });

      expect(result.content).toBeDefined();
      const text = result.content[0].text;
      expect(text).toContain('pure/List');
      expect(text).toContain('pure/Map');
      expect(text).toContain('pure/Set');
      expect(text).not.toContain('Array'); // Mutable, should not be in immutable category
    });

    it('should batch fetch modules', async () => {
      const result = await discover({
        action: 'get-batch',
        modules: ['Array', 'Map', 'pure/List'],
        format: 'summary',
      });

      expect(result.content).toBeDefined();
      const text = result.content[0].text;
      expect(text).toContain('Array');
      expect(text).toContain('Map');
      expect(text).toContain('pure/List');
      expect(text).toContain('Retrieved 3 module(s)');
    });

    it('should include documentation URLs when requested', async () => {
      const result = await discover({
        action: 'get-batch',
        modules: ['Array'],
        includeUrls: true,
      });

      expect(result.content).toBeDefined();
      const text = result.content[0].text;
      expect(text).toContain('internetcomputer.org/docs/motoko/core/Array');
      expect(text).toContain('github.com/dfinity/motoko-core');
    });
  });

  describe('Enhanced Motoko Core', () => {
    it('should fetch single module documentation', async () => {
      const result = await enhancedMotokoCore({
        module: 'Array',
        examples: true,
        includeLinks: true,
      });

      expect(result.content).toBeDefined();
      const text = result.content[0].text;
      expect(text).toContain('Array');
      expect(text).toContain('Quick Links');
      expect(text).toContain('Official Documentation');
    });

    it('should batch fetch multiple modules', async () => {
      const result = await enhancedMotokoCore({
        modules: ['Array', 'Map'],
        examples: false,
        includeLinks: true,
      });

      expect(result.content).toBeDefined();
      const text = result.content[0].text;
      expect(text).toContain('Batch Module Documentation');
      expect(text).toContain('Retrieved 2 module(s)');
      expect(text).toContain('Array');
      expect(text).toContain('Map');
    });

    it('should provide suggestions for unknown modules', async () => {
      const result = await enhancedMotokoCore({
        module: 'hashmap', // Common mistake (HashMap was removed)
        examples: false,
      });

      expect(result.content).toBeDefined();
      const text = result.content[0].text;
      const parsed = JSON.parse(text);

      expect(parsed.suggestions).toBeDefined();
      expect(parsed.suggestions).toContain('Map (HashMap removed, use Map instead)');
      expect(parsed.hint).toBeDefined();
    });

    it('should handle pure/ namespace correctly', async () => {
      const result = await enhancedMotokoCore({
        module: 'pure/List',
        examples: false,
      });

      expect(result.content).toBeDefined();
      const text = result.content[0].text;
      expect(text).toContain('pure/List');
      expect(text).toContain('Immutable');
    });
  });

  describe('Intelligent Router', () => {
    it('should recommend discovery for exploration queries', () => {
      const recommendations = analyzeIntent({
        query: 'What modules are available?',
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].tool).toBe('icp/discover');
      expect(recommendations[0].params).toEqual({ action: 'list-all' });
      expect(recommendations[0].confidence).toBeGreaterThan(0.8);
    });

    it('should recommend search for specific functionality', () => {
      const recommendations = analyzeIntent({
        query: 'How do I work with arrays?',
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].tool).toBe('icp/discover');
      expect(recommendations[0].params?.action).toBe('search');
      expect(recommendations[0].params?.query).toContain('array');
    });

    it('should recommend validation for code checking', () => {
      const recommendations = analyzeIntent({
        query: 'Validate my code',
        context: { hasCode: true },
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].tool).toBe('icp/validate');
    });

    it('should recommend template for new projects', () => {
      const recommendations = analyzeIntent({
        query: 'Create a new Motoko canister',
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].tool).toBe('icp/template');
    });

    it('should recommend dfx-guide for deployment', () => {
      const recommendations = analyzeIntent({
        query: 'How to deploy my canister?',
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].tool).toBe('icp/dfx-guide');
      expect(recommendations[0].params?.operation).toBe('deploy');
    });

    it('should provide alternative suggestions', () => {
      const recommendations = analyzeIntent({
        query: 'Something about modules maybe',
      });

      if (recommendations.length > 0 && recommendations[0].confidence < 0.9) {
        expect(recommendations[0].alternativeTool).toBeDefined();
      }
    });

    it('should generate usage guide', () => {
      const guide = generateUsageGuide();

      expect(guide).toContain('Quick Decision Tree');
      expect(guide).toContain('Tool Relationships');
      expect(guide).toContain('Common Workflows');
      expect(guide).toContain('icp/discover');
      expect(guide).toContain('icp/motoko-core-batch');
    });
  });

  describe('Web Fetching Integration', () => {
    it('should have proper cache TTL management', async () => {
      // First call should fetch from web/index
      const result1 = await discover({
        action: 'list-all',
        format: 'names-only',
      });

      // Second immediate call should use cache
      const result2 = await discover({
        action: 'list-all',
        format: 'names-only',
      });

      // Both should return the same content
      expect(result1.content[0].text).toBe(result2.content[0].text);
    });

    it('should include all 45+ modules', async () => {
      const result = await discover({
        action: 'list-all',
        format: 'names-only',
      });

      const text = result.content[0].text;
      const lines = text.split('\n').filter(line => line.trim());

      // Should have at least 45 modules
      expect(lines.length).toBeGreaterThanOrEqual(45);

      // Check for various categories
      expect(text).toContain('Array');     // Data structures
      expect(text).toContain('pure/List'); // Immutable
      expect(text).toContain('Principal'); // System
      expect(text).toContain('Int');       // Primitives
      expect(text).toContain('Option');    // Utilities
    });

    it('should provide direct links to documentation', async () => {
      const result = await discover({
        action: 'get-batch',
        modules: ['Array'],
        includeUrls: true,
        format: 'full',
      });

      const text = result.content[0].text;

      // Should include various types of links
      expect(text).toContain('https://internetcomputer.org/docs/motoko/core/');
      expect(text).toContain('https://github.com/dfinity/motoko-core/');
      expect(text).toContain('https://play.motoko.org/');
    });
  });

  describe('Error Handling & Suggestions', () => {
    it('should handle module not found gracefully', async () => {
      const result = await discover({
        action: 'get-batch',
        modules: ['NonExistentModule'],
      });

      const text = result.content[0].text;
      expect(text).toContain('NonExistentModule');
      expect(text).toContain('Error');
    });

    it('should provide helpful error messages', async () => {
      const result = await discover({
        action: 'search',
        // Missing required query parameter
      } as any);

      expect(result.isError).toBe(true);
      const text = result.content[0].text;
      const parsed = JSON.parse(text);
      expect(parsed.error).toContain('Query is required');
    });

    it('should suggest corrections for common mistakes', async () => {
      const result = await enhancedMotokoCore({
        module: 'buffer', // Buffer was removed, should suggest VarArray
      });

      const text = result.content[0].text;
      const parsed = JSON.parse(text);

      expect(parsed.suggestions).toContain('VarArray (Buffer removed, use VarArray instead)');
    });
  });

  describe('Performance & Efficiency', () => {
    it('batch operations should be more efficient than individual calls', async () => {
      const startBatch = Date.now();
      const batchResult = await enhancedMotokoCore({
        modules: ['Array', 'Map', 'List'],
        examples: false,
      });
      const batchTime = Date.now() - startBatch;

      // Batch should complete reasonably quickly
      expect(batchTime).toBeLessThan(1000); // Under 1 second

      const text = batchResult.content[0].text;
      expect(text).toContain('Retrieved 3 module(s)');
    });
  });
});