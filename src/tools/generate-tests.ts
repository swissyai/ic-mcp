/**
 * Test generation for Motoko code
 * Generates comprehensive unit tests following mo:test patterns
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

export const generateTestsSchema = z.object({
  code: z.string().describe('Motoko code to generate tests for'),
  moduleName: z.string().optional().describe('Module name (e.g., "Array", "Map")'),
  functionName: z.string().optional().describe('Specific function to test'),
  coverage: z
    .enum(['minimal', 'standard', 'comprehensive'])
    .optional()
    .default('standard')
    .describe('Test coverage level'),
});

export type GenerateTestsInput = z.infer<typeof generateTestsSchema>;

interface FunctionSignature {
  name: string;
  params: string[];
  returnType: string;
  isPublic: boolean;
}

interface TestCase {
  name: string;
  description: string;
  setup?: string;
  assertion: string;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
}

/**
 * Parse Motoko code to extract function signatures
 */
function extractFunctions(code: string): FunctionSignature[] {
  const functions: FunctionSignature[] = [];

  // Match function definitions: public func name(params) : returnType
  const funcRegex = /(?:public\s+)?func\s+(\w+)\s*(?:<[^>]+>)?\s*\((.*?)\)\s*:\s*([^{;]+)/gs;
  let match;

  while ((match = funcRegex.exec(code)) !== null) {
    const [, name, paramsStr, returnType] = match;
    const isPublic = match[0].includes('public');

    // Parse parameters
    const params = paramsStr
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    functions.push({
      name,
      params,
      returnType: returnType.trim(),
      isPublic,
    });
  }

  return functions;
}

/**
 * Extract module name from code
 */
function extractModuleName(code: string, providedName?: string): string {
  if (providedName) return providedName;

  // Try to extract from import or module declaration
  const moduleMatch = code.match(/module\s+(\w+)/);
  if (moduleMatch) return moduleMatch[1];

  const importMatch = code.match(/import\s+(\w+)\s+/);
  if (importMatch) return importMatch[1];

  return 'Module';
}

/**
 * Infer type category for test generation
 */
function inferTypeCategory(type: string): 'collection' | 'option' | 'result' | 'primitive' | 'custom' {
  const cleanType = type.replace(/\s+/g, '');

  if (/\[|\bArray\b|\bList\b|\bMap\b|\bSet\b|\bBuffer\b/i.test(cleanType)) {
    return 'collection';
  }
  if (/\?|Option/i.test(cleanType)) {
    return 'option';
  }
  if (/Result/i.test(cleanType)) {
    return 'result';
  }
  if (/\b(Nat|Int|Bool|Text|Char)\b/i.test(cleanType)) {
    return 'primitive';
  }
  return 'custom';
}

/**
 * Generate test cases for a function based on coverage level
 */
function generateTestCasesForFunction(
  func: FunctionSignature,
  coverage: 'minimal' | 'standard' | 'comprehensive'
): TestSuite[] {
  const suites: TestSuite[] = [];
  const returnCategory = inferTypeCategory(func.returnType);

  // Determine if function takes collection input
  const hasCollectionParam = func.params.some((p) => inferTypeCategory(p) === 'collection');

  if (coverage === 'minimal') {
    // Just basic test
    suites.push({
      name: func.name,
      tests: [
        {
          name: `${func.name} basic`,
          description: `Test ${func.name} with typical input`,
          assertion: `expect.bool(true).isTrue(); // TODO: implement test`,
        },
      ],
    });
    return suites;
  }

  // Standard and comprehensive coverage
  const testCategories: TestSuite[] = [];

  // 1. Empty/null cases (for collections and options)
  if (hasCollectionParam || returnCategory === 'collection') {
    testCategories.push({
      name: 'empty',
      tests: [
        {
          name: `${func.name} empty`,
          description: `Test ${func.name} with empty input`,
          assertion: generateAssertion(func.name, returnCategory, 'empty'),
        },
      ],
    });
  }

  // 2. Singleton cases (for collections)
  if (hasCollectionParam) {
    testCategories.push({
      name: 'singleton',
      tests: [
        {
          name: `${func.name} singleton`,
          description: `Test ${func.name} with single element`,
          assertion: generateAssertion(func.name, returnCategory, 'singleton'),
        },
      ],
    });
  }

  // 3. Normal cases
  testCategories.push({
    name: 'normal cases',
    tests: [
      {
        name: `${func.name}`,
        description: `Test ${func.name} with typical values`,
        assertion: generateAssertion(func.name, returnCategory, 'normal'),
      },
    ],
  });

  // 4. Error/failure cases
  if (returnCategory === 'option' || returnCategory === 'result') {
    testCategories.push({
      name: 'error cases',
      tests: [
        {
          name: `${func.name} fail`,
          description: `Test ${func.name} when operation fails`,
          assertion: generateAssertion(func.name, returnCategory, 'fail'),
        },
      ],
    });
  }

  // 5. Edge cases (comprehensive only)
  if (coverage === 'comprehensive') {
    testCategories.push({
      name: 'edge cases',
      tests: [
        {
          name: `${func.name} boundary`,
          description: `Test ${func.name} at boundary conditions`,
          assertion: generateAssertion(func.name, returnCategory, 'boundary'),
        },
        {
          name: `${func.name} large input`,
          description: `Test ${func.name} with large dataset`,
          setup: 'let largeData = generateLargeData(10_000);',
          assertion: generateAssertion(func.name, returnCategory, 'large'),
        },
      ],
    });

    // 6. Property tests
    if (returnCategory === 'primitive' || returnCategory === 'custom') {
      testCategories.push({
        name: 'properties',
        tests: [
          {
            name: `${func.name} round trip`,
            description: `Test ${func.name} round trip conversion`,
            assertion: `assert (roundTripTest(value) == value);`,
          },
        ],
      });
    }
  }

  return testCategories;
}

/**
 * Generate appropriate assertion based on return type and test scenario
 */
function generateAssertion(_funcName: string, returnCategory: string, scenario: string): string {
  switch (returnCategory) {
    case 'primitive':
      if (scenario === 'empty' || scenario === 'fail') {
        return `expect.nat(result).equal(0); // Adjust based on function`;
      }
      return `expect.nat(result).equal(expected); // TODO: set expected value`;

    case 'option':
      if (scenario === 'fail') {
        return `expect.optional(result, T.natTestable).equal(null);`;
      }
      return `expect.optional(result, T.natTestable).equal(?expected);`;

    case 'result':
      if (scenario === 'fail') {
        return `expect.result(result, T.natTestable, T.textTestable).equal(#err("error message"));`;
      }
      return `expect.result(result, T.natTestable, T.textTestable).equal(#ok(expected));`;

    case 'collection':
      if (scenario === 'empty') {
        return `expect.nat(Array.size(result)).equal(0);`;
      }
      return `expect.array(result, Nat.toText, Nat.equal).equal(expected);`;

    default:
      return `assert (result == expected); // TODO: implement custom comparison`;
  }
}

/**
 * Generate imports section
 */
function generateImports(moduleName: string): string {
  return `// Import module under test
import ${moduleName} "../src/${moduleName}";

// Import test framework
import { suite; test; expect } "mo:test";

// Import supporting modules
import Nat "../src/Nat";
import Text "../src/Text";
import Array "../src/Array";
import Iter "../src/Iter";

// Test helpers
module T {
  public let natTestable = {
    display = Nat.toText;
    equals = Nat.equal;
  };

  public let textTestable = {
    display = func(t : Text) : Text { t };
    equals = Text.equal;
  };
};
`;
}

/**
 * Generate helper functions section
 */
function generateHelpers(coverage: 'minimal' | 'standard' | 'comprehensive'): string {
  if (coverage === 'minimal') return '';

  return `
// Test data generators
func generateLargeData(size : Nat) : [Nat] {
  Array.tabulate<Nat>(size, func(i) { i });
};

func createTestMap(size : Nat) : [(Nat, Text)] {
  Array.tabulate<(Nat, Text)>(size, func(i) { (i, Nat.toText(i)) });
};
`;
}

/**
 * Format a test case as Motoko code
 */
function formatTestCase(testCase: TestCase, indent: string = '    '): string {
  const lines: string[] = [];

  lines.push(`${indent}test(`);
  lines.push(`${indent}  "${testCase.name}",`);
  lines.push(`${indent}  func() {`);

  if (testCase.setup) {
    lines.push(`${indent}    ${testCase.setup}`);
    lines.push('');
  }

  lines.push(`${indent}    // TODO: Add test implementation`);
  lines.push(`${indent}    ${testCase.assertion}`);

  lines.push(`${indent}  },`);
  lines.push(`${indent});`);

  return lines.join('\n');
}

/**
 * Format a test suite as Motoko code
 */
function formatTestSuite(suite: TestSuite): string {
  const lines: string[] = [];

  if (suite.tests.length === 1 && suite.name === suite.tests[0].name) {
    // Flat test (no suite wrapper)
    return formatTestCase(suite.tests[0], '');
  }

  // Suite-based organization
  lines.push(`suite(`);
  lines.push(`  "${suite.name}",`);
  lines.push(`  func() {`);

  for (const testCase of suite.tests) {
    lines.push(formatTestCase(testCase, '    '));
    lines.push('');
  }

  lines.push(`  },`);
  lines.push(`);`);

  return lines.join('\n');
}

/**
 * Generate complete test file
 */
function generateTestFile(
  moduleName: string,
  suites: TestSuite[],
  coverage: 'minimal' | 'standard' | 'comprehensive'
): string {
  const sections: string[] = [];

  // File header
  sections.push(`/**`);
  sections.push(` * Unit tests for ${moduleName} module`);
  sections.push(` * Generated test scaffolding following mo:test patterns`);
  sections.push(` * Coverage level: ${coverage}`);
  sections.push(` */`);
  sections.push('');

  // Imports
  sections.push(generateImports(moduleName));
  sections.push('');

  // Helpers (if needed)
  const helpers = generateHelpers(coverage);
  if (helpers) {
    sections.push(helpers);
    sections.push('');
  }

  // Test suites
  for (const suite of suites) {
    sections.push(formatTestSuite(suite));
    sections.push('');
  }

  // Footer with checklist
  sections.push('');
  sections.push('/**');
  sections.push(' * Test Coverage Checklist:');
  sections.push(' * [ ] Empty/null input cases');
  sections.push(' * [ ] Single element cases');
  sections.push(' * [ ] Multiple elements with typical values');
  sections.push(' * [ ] Edge cases (boundaries, special values)');
  sections.push(' * [ ] Error cases (not found, out of bounds)');
  sections.push(' * [ ] Large input performance tests');
  sections.push(' * [ ] Property tests (equality, round-trips)');
  sections.push(' * [ ] Iterator consumption tests');
  sections.push(' * [ ] Mutation and aliasing tests (for mutable types)');
  sections.push(' */');

  return sections.join('\n');
}

/**
 * Main test generation function
 */
export async function executeGenerateTests(input: GenerateTestsInput): Promise<string> {
  logger.info('Generating Motoko unit tests', {
    moduleName: input.moduleName,
    coverage: input.coverage,
  });

  try {
    const moduleName = extractModuleName(input.code, input.moduleName);
    const functions = extractFunctions(input.code);

    if (functions.length === 0) {
      return formatError(
        'No functions found in the provided code',
        'Make sure the code contains valid Motoko function definitions'
      );
    }

    logger.info(`Found ${functions.length} function(s) to test`, {
      functions: functions.map((f) => f.name),
    });

    // Generate test suites for each function (or specific function if provided)
    const allSuites: TestSuite[] = [];

    for (const func of functions) {
      if (input.functionName && func.name !== input.functionName) {
        continue;
      }

      const funcSuites = generateTestCasesForFunction(func, input.coverage || 'standard');
      allSuites.push(...funcSuites);
    }

    if (allSuites.length === 0) {
      return formatError(
        `Function "${input.functionName}" not found`,
        'Available functions: ' + functions.map((f) => f.name).join(', ')
      );
    }

    // Generate complete test file
    const testFile = generateTestFile(moduleName, allSuites, input.coverage || 'standard');

    // Format result
    return formatResult(moduleName, functions.length, allSuites.length, testFile);
  } catch (error: any) {
    logger.error('Test generation failed', error);
    return formatError('Test generation failed', error.message);
  }
}

/**
 * Format success result
 */
function formatResult(
  moduleName: string,
  functionCount: number,
  suiteCount: number,
  testFile: string
): string {
  const lines: string[] = [];

  lines.push(`# Generated Tests for ${moduleName}`);
  lines.push('');
  lines.push(`**Functions analyzed:** ${functionCount}`);
  lines.push(`**Test suites generated:** ${suiteCount}`);
  lines.push('');
  lines.push('## Test File: `test/${moduleName}.test.mo`');
  lines.push('');
  lines.push('```motoko');
  lines.push(testFile);
  lines.push('```');
  lines.push('');
  lines.push('## Running Tests');
  lines.push('');
  lines.push('```bash');
  lines.push('# Install mo:test if not already installed');
  lines.push('mops add test');
  lines.push('');
  lines.push('# Run all tests');
  lines.push('mops test');
  lines.push('```');
  lines.push('');
  lines.push('## Next Steps');
  lines.push('');
  lines.push('1. Review generated test scaffolding');
  lines.push('2. Replace TODO comments with actual test data');
  lines.push('3. Add any module-specific edge cases');
  lines.push('4. Run tests and iterate');
  lines.push('');
  lines.push('**Note:** Generated tests follow patterns from the Motoko core library testing guide.');

  return lines.join('\n');
}

/**
 * Format error result
 */
function formatError(title: string, message: string): string {
  return JSON.stringify(
    {
      error: title,
      details: message,
      hint: 'Provide valid Motoko code with function definitions',
      example: {
        action: 'generate tests for my module',
        context: {
          code: 'public func add(a : Nat, b : Nat) : Nat { a + b }',
          moduleName: 'Math',
          coverage: 'standard',
        },
      },
    },
    null,
    2
  );
}
