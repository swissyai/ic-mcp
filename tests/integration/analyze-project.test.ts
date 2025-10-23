/**
 * Integration tests for icp/analyze-project tool
 * Tests with real test projects
 */

import { describe, it, expect } from 'vitest';
import { executeAnalyzeProject } from '../../src/tools/analyze-project.js';
import { join } from 'path';

const TEST_PROJECTS_DIR = join(process.cwd(), 'test-projects');

describe('icp/analyze-project integration tests', () => {
  it('should analyze simple counter project', async () => {
    const result = await executeAnalyzeProject({
      projectPath: join(TEST_PROJECTS_DIR, 'counter'),
      validate: false,
      checkDependencies: true,
    });

    expect(result).toContain('Project Analysis');
    expect(result).toContain('Canisters:');
    expect(result).toContain('Dependency Analysis');
  });

  it('should detect circular dependencies', async () => {
    const result = await executeAnalyzeProject({
      projectPath: join(TEST_PROJECTS_DIR, 'circular'),
      validate: false,
      checkDependencies: true,
    });

    expect(result).toContain('CIRCULAR DEPENDENCIES DETECTED');
  });

  it('should validate all canisters when requested', async () => {
    const result = await executeAnalyzeProject({
      projectPath: join(TEST_PROJECTS_DIR, 'counter'),
      validate: true,
      checkDependencies: false,
    });

    expect(result).toContain('Validation Results');
    expect(result).toMatch(/✅|❌/); // Should have status icons
  });

  it('should calculate correct build order', async () => {
    const result = await executeAnalyzeProject({
      projectPath: join(TEST_PROJECTS_DIR, 'dapp'),
      validate: false,
      checkDependencies: true,
    });

    expect(result).toContain('Build Order:');
    // Dependencies should come before dependents
  });

  it('should handle missing dfx.json gracefully', async () => {
    const result = await executeAnalyzeProject({
      projectPath: '/tmp/nonexistent-project',
      validate: false,
      checkDependencies: false,
    });

    expect(result).toContain('Error');
    expect(result).toContain('dfx.json');
  });

  it('should count lines of code correctly', async () => {
    const result = await executeAnalyzeProject({
      projectPath: join(TEST_PROJECTS_DIR, 'counter'),
      validate: false,
      checkDependencies: false,
    });

    // Check for line counts (matches both "Total Lines of Code:" and "**Total Lines of Code:**")
    expect(result).toMatch(/Total Lines of Code:?\*?\*?\s*\d+/);
    expect(result).toMatch(/Lines:\s*\d+/);
  });
});
