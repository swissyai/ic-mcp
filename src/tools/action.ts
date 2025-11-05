/**
 * Action Tool - Unified interface for ICP code operations
 * Handles validation, testing, deployment, refactoring, analysis, and upgrade checks
 */

import { z } from 'zod';
import { DataEncoder } from '../core/toon-encoder.js';
import { logger } from '../utils/logger.js';

// Import existing specialized tools
import { validate, ValidateInputSchema } from './validate.js';
import { executeTestCall, testCallSchema } from './test-call.js';
import { executeTestDeploy, testDeploySchema } from './test-deploy.js';
import { executeRefactor, refactorSchema } from './refactor.js';
import { executeAnalyzeProject, analyzeProjectSchema } from './analyze-project.js';
import { executeCheckUpgrade, checkUpgradeSchema } from './check-upgrade.js';
import { executeGenerateTests, generateTestsSchema } from './generate-tests.js';

// Input schema for the action tool
export const ActionInputSchema = z.object({
  action: z.string().describe('Natural language description of the action to perform'),
  context: z.record(z.any()).optional().describe('Additional context (code, paths, parameters)'),
  format: z.enum(['toon', 'json', 'markdown']).optional().default('toon'),
});

export type ActionInput = z.infer<typeof ActionInputSchema>;

// Action intent types
type ActionType =
  | 'validate'       // Code validation (Candid, Motoko, Rust, dfx.json)
  | 'test'           // Test canister methods
  | 'deploy'         // Deploy to local/playground
  | 'refactor'       // Code refactoring
  | 'analyze'        // Project analysis
  | 'check-upgrade'  // Upgrade safety check
  | 'generate-tests' // Generate unit test scaffolding
  | 'unknown';

interface ParsedAction {
  type: ActionType;
  confidence: number;
  params: any;
}

/**
 * Main action tool execution
 */
export async function action(input: ActionInput) {
  logger.info(`Action tool called with: "${input.action}"`);

  // Parse the natural language action
  const parsed = parseActionIntent(input.action, input.context);
  logger.debug(`Parsed action: ${parsed.type} (confidence: ${parsed.confidence})`);

  if (parsed.type === 'unknown') {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Could not determine action intent',
            suggestions: [
              'Try: "validate my Motoko code"',
              'Try: "test the transfer method"',
              'Try: "deploy to local network"',
              'Try: "refactor to add upgrade hooks"',
              'Try: "analyze project structure"',
              'Try: "check if interface is upgrade-safe"',
            ],
          }, null, 2),
        },
      ],
    };
  }

  // Execute the appropriate action
  let result: any;

  try {
    switch (parsed.type) {
      case 'validate':
        result = await handleValidate(parsed.params, input.context);
        break;
      case 'test':
        result = await handleTest(parsed.params, input.context);
        break;
      case 'deploy':
        result = await handleDeploy(parsed.params, input.context);
        break;
      case 'refactor':
        result = await handleRefactor(parsed.params, input.context);
        break;
      case 'analyze':
        result = await handleAnalyze(parsed.params, input.context);
        break;
      case 'check-upgrade':
        result = await handleCheckUpgrade(parsed.params, input.context);
        break;
      case 'generate-tests':
        result = await handleGenerateTests(parsed.params, input.context);
        break;
      default:
        throw new Error(`Unsupported action type: ${parsed.type}`);
    }

    // Check if result is already formatted (from specialized tools that return strings)
    if (typeof result === 'string') {
      return {
        content: [
          {
            type: 'text' as const,
            text: result,
          },
        ],
        metadata: {
          action: parsed.type,
          confidence: parsed.confidence,
        },
      };
    }

    // Encode the result with TOON by default
    const encoded = DataEncoder.encode(result, input.format);

    return {
      content: [
        {
          type: 'text' as const,
          text: encoded,
        },
      ],
      metadata: {
        action: parsed.type,
        confidence: parsed.confidence,
        format: input.format,
        tokenEstimate: DataEncoder.estimateTokens(encoded),
      },
    };
  } catch (error: any) {
    logger.error('Action execution error:', error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: `Action failed: ${error.message}`,
            action: parsed.type,
            details: error.stack,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Parse natural language action to determine intent
 *
 * Confidence scoring rationale:
 * - 0.9: Explicit action keywords with target (validate + language, deploy, analyze + project)
 * - 0.85: Clear operations with standard patterns (test + method, refactor + specific type, upgrade check)
 * - 0.5: Fallback guesses based on single keywords - user should be more specific
 *
 * High confidence (0.85+) means we can proceed directly
 * Low confidence (<0.7) should return helpful error with examples
 */
function parseActionIntent(action: string, context?: any): ParsedAction {
  const a = action.toLowerCase();

  // Validate patterns (0.9: explicit validation with language)
  if (/\b(validate|check|verify|lint)\b.*\b(code|candid|motoko|rust|dfx)/i.test(a)) {
    return {
      type: 'validate',
      confidence: 0.9,
      params: extractValidateParams(a, context),
    };
  }

  // Test patterns (0.85: standard testing operation with context)
  if (/\b(test|call|invoke|execute|run)\b.*\b(method|function|canister)/i.test(a)) {
    return {
      type: 'test',
      confidence: 0.85,
      params: extractTestParams(a, context),
    };
  }

  // Deploy patterns (0.9: unambiguous deployment action)
  if (/\b(deploy|install|publish)\b/i.test(a)) {
    return {
      type: 'deploy',
      confidence: 0.9,
      params: extractDeployParams(a, context),
    };
  }

  // Refactor patterns (0.85: clear transformation with specific target)
  if (/\b(refactor|transform|add|modernize)\b.*\b(upgrade|stable|hooks|caller)/i.test(a)) {
    return {
      type: 'refactor',
      confidence: 0.85,
      params: extractRefactorParams(a, context),
    };
  }

  // Analyze patterns (0.9: explicit analysis command)
  if (/\b(analyze|inspect|review|examine)\b.*\b(project|structure|dependencies)/i.test(a)) {
    return {
      type: 'analyze',
      confidence: 0.9,
      params: extractAnalyzeParams(a, context),
    };
  }

  // Check upgrade patterns (0.85: standard safety check)
  if (/\b(check|verify|test)\b.*\b(upgrade|compatibility|interface|breaking)/i.test(a)) {
    return {
      type: 'check-upgrade',
      confidence: 0.85,
      params: extractUpgradeParams(a, context),
    };
  }

  // Generate tests patterns (0.9: clear test generation intent)
  if (/\b(generate|create|write|add)\b.*\b(test|unit test|test coverage|test file)/i.test(a)) {
    return {
      type: 'generate-tests',
      confidence: 0.9,
      params: extractGenerateTestsParams(a, context),
    };
  }

  // Fallback: weak guesses (0.5: single keyword, very ambiguous)
  if (/validate|lint|syntax/i.test(a)) {
    return { type: 'validate', confidence: 0.5, params: {} };
  }
  if (/test|call/i.test(a)) {
    return { type: 'test', confidence: 0.5, params: {} };
  }
  if (/deploy/i.test(a)) {
    return { type: 'deploy', confidence: 0.5, params: {} };
  }

  return { type: 'unknown', confidence: 0, params: {} };
}

/**
 * Extract validation parameters
 */
function extractValidateParams(action: string, context?: any): any {
  const params: any = {};

  // Extract language
  if (/candid/i.test(action)) params.language = 'candid';
  else if (/motoko/i.test(action)) params.language = 'motoko';
  else if (/rust/i.test(action)) params.language = 'rust';
  else if (/dfx\.json|dfx-json/i.test(action)) params.language = 'dfx-json';

  // Get code from context
  if (context?.code) params.code = context.code;
  if (context?.filename) params.filename = context.filename;
  if (context?.context) params.context = context.context;

  return params;
}

/**
 * Extract test parameters
 */
function extractTestParams(action: string, context?: any): any {
  const params: any = {};

  // Extract method name
  const methodMatch = action.match(/\b(method|function)\s+(\w+)/i);
  if (methodMatch) params.method = methodMatch[2];

  // Extract canister ID
  const canisterMatch = action.match(/canister[:\s]+(\w+)/i);
  if (canisterMatch) params.canisterId = canisterMatch[1];

  // Network
  if (/\blocal\b/i.test(action)) params.network = 'local';
  else if (/\bplayground\b/i.test(action)) params.network = 'playground';
  else if (/\bmainnet\b|\bic\b/i.test(action)) params.network = 'ic';

  // Mode
  if (/\bquery\b/i.test(action)) params.mode = 'query';
  else if (/\bupdate\b/i.test(action)) params.mode = 'update';

  // Get parameters from context
  if (context?.canisterId) params.canisterId = context.canisterId;
  if (context?.method) params.method = context.method;
  if (context?.args) params.args = context.args;
  if (context?.network) params.network = context.network;
  if (context?.mode) params.mode = context.mode;
  if (context?.projectPath) params.projectPath = context.projectPath;

  return params;
}

/**
 * Extract deployment parameters
 */
function extractDeployParams(action: string, context?: any): any {
  const params: any = {};

  // Network
  if (/\blocal\b/i.test(action)) params.network = 'local';
  else if (/\bplayground\b/i.test(action)) params.network = 'playground';

  // Mode
  if (/\binstall\b/i.test(action)) params.mode = 'install';
  else if (/\breinstall\b/i.test(action)) params.mode = 'reinstall';
  else if (/\bupgrade\b/i.test(action)) params.mode = 'upgrade';

  // Clean build
  if (/\bclean\b/i.test(action)) params.clean = true;

  // Get parameters from context
  if (context?.projectPath) params.projectPath = context.projectPath;
  if (context?.network) params.network = context.network;
  if (context?.canisters) params.canisters = context.canisters;
  if (context?.mode) params.mode = context.mode;
  if (context?.clean !== undefined) params.clean = context.clean;

  return params;
}

/**
 * Extract refactoring parameters
 */
function extractRefactorParams(action: string, context?: any): any {
  const params: any = {};

  // Refactoring type
  if (/upgrade\s+hooks?/i.test(action)) params.refactoring = 'add-upgrade-hooks';
  else if (/stable\s+(var|variable|storage)/i.test(action)) params.refactoring = 'add-stable-vars';
  else if (/caller\s+check/i.test(action)) params.refactoring = 'add-caller-checks';
  else if (/modernize/i.test(action)) params.refactoring = 'modernize';

  // Language
  if (/motoko/i.test(action)) params.language = 'motoko';
  else if (/rust/i.test(action)) params.language = 'rust';

  // Get parameters from context
  if (context?.code) params.code = context.code;
  if (context?.language) params.language = context.language;
  if (context?.refactoring) params.refactoring = context.refactoring;

  return params;
}

/**
 * Extract analysis parameters
 */
function extractAnalyzeParams(action: string, context?: any): any {
  const params: any = {};

  // Flags
  if (/validate/i.test(action)) params.validate = true;
  if (/dependencies/i.test(action)) params.checkDependencies = true;

  // Get parameters from context
  if (context?.projectPath) params.projectPath = context.projectPath;
  if (context?.validate !== undefined) params.validate = context.validate;
  if (context?.checkDependencies !== undefined) params.checkDependencies = context.checkDependencies;

  return params;
}

/**
 * Extract upgrade check parameters
 */
function extractUpgradeParams(_action: string, context?: any): any {
  const params: any = {};

  // Get Candid interfaces from context
  if (context?.oldCandid) params.oldCandid = context.oldCandid;
  if (context?.newCandid) params.newCandid = context.newCandid;
  if (context?.old) params.oldCandid = context.old;
  if (context?.new) params.newCandid = context.new;

  return params;
}

/**
 * Extract test generation parameters
 */
function extractGenerateTestsParams(action: string, context?: any): any {
  const params: any = {};

  // Extract module name
  const moduleMatch = action.match(/\b(module|for)\s+(\w+)/i);
  if (moduleMatch) params.moduleName = moduleMatch[2];

  // Extract function name
  const functionMatch = action.match(/\bfunction\s+(\w+)/i);
  if (functionMatch) params.functionName = functionMatch[1];

  // Extract coverage level
  if (/\b(minimal|basic)\b/i.test(action)) params.coverage = 'minimal';
  else if (/\b(comprehensive|complete|full|extensive)\b/i.test(action))
    params.coverage = 'comprehensive';
  else params.coverage = 'standard';

  // Get parameters from context
  if (context?.code) params.code = context.code;
  if (context?.moduleName) params.moduleName = context.moduleName;
  if (context?.functionName) params.functionName = context.functionName;
  if (context?.coverage) params.coverage = context.coverage;

  return params;
}

/**
 * Handle validation action
 */
async function handleValidate(params: any, _context?: any) {
  // Validate required parameters
  const validated = ValidateInputSchema.safeParse(params);

  if (!validated.success) {
    return {
      error: 'Missing required parameters for validation',
      required: 'code and language',
      example: {
        action: 'validate my Motoko code',
        context: {
          code: 'actor { public func greet() : async Text { "Hello" } }',
          language: 'motoko',
        },
      },
    };
  }

  return await validate(validated.data);
}

/**
 * Handle test action
 */
async function handleTest(params: any, _context?: any) {
  // Validate required parameters
  const validated = testCallSchema.safeParse(params);

  if (!validated.success) {
    return {
      error: 'Missing required parameters for test',
      required: 'canisterId and method',
      example: {
        action: 'test the greet method',
        context: {
          canisterId: 'rrkah-fqaaa-aaaaa-aaaaq-cai',
          method: 'greet',
          args: ['World'],
        },
      },
    };
  }

  return await executeTestCall(validated.data);
}

/**
 * Handle deploy action
 */
async function handleDeploy(params: any, _context?: any) {
  // Validate parameters (all optional with defaults)
  const validated = testDeploySchema.safeParse(params);

  if (!validated.success) {
    return {
      error: 'Invalid deployment parameters',
      details: validated.error.issues,
    };
  }

  return await executeTestDeploy(validated.data);
}

/**
 * Handle refactor action
 */
async function handleRefactor(params: any, _context?: any) {
  // Validate required parameters
  const validated = refactorSchema.safeParse(params);

  if (!validated.success) {
    return {
      error: 'Missing required parameters for refactoring',
      required: 'code, language, and refactoring type',
      example: {
        action: 'refactor to add upgrade hooks',
        context: {
          code: 'actor { var count = 0; }',
          language: 'motoko',
          refactoring: 'add-upgrade-hooks',
        },
      },
    };
  }

  return await executeRefactor(validated.data);
}

/**
 * Handle analyze action
 */
async function handleAnalyze(params: any, _context?: any) {
  // Validate parameters (all optional with defaults)
  const validated = analyzeProjectSchema.safeParse(params);

  if (!validated.success) {
    return {
      error: 'Invalid analysis parameters',
      details: validated.error.issues,
    };
  }

  return await executeAnalyzeProject(validated.data);
}

/**
 * Handle upgrade check action
 */
async function handleCheckUpgrade(params: any, _context?: any) {
  // Validate required parameters
  const validated = checkUpgradeSchema.safeParse(params);

  if (!validated.success) {
    return {
      error: 'Missing required parameters for upgrade check',
      required: 'oldCandid and newCandid',
      example: {
        action: 'check if interface is upgrade-safe',
        context: {
          oldCandid: 'service : { greet : () -> (text) }',
          newCandid: 'service : { greet : (text) -> (text) }',
        },
      },
    };
  }

  return await executeCheckUpgrade(validated.data);
}

/**
 * Handle test generation action
 */
async function handleGenerateTests(params: any, _context?: any) {
  // Validate required parameters
  const validated = generateTestsSchema.safeParse(params);

  if (!validated.success) {
    return {
      error: 'Missing required parameters for test generation',
      required: 'code (Motoko source)',
      example: {
        action: 'generate tests for my Array module',
        context: {
          code: 'public func find<T>(arr : [T], predicate : T -> Bool) : ?T { ... }',
          moduleName: 'Array',
          coverage: 'standard',
        },
      },
    };
  }

  return await executeGenerateTests(validated.data);
}

// Export for use in main index
export const actionTool = {
  name: 'icp/action',
  description:
    'Execute ICP development operations: validate code (Motoko/Rust/Candid/dfx.json), test canister methods, deploy to local/playground networks, refactor code (add upgrade hooks, stable vars, auth), analyze project structure, check Candid interface upgrade safety, and generate unit test scaffolding following mo:test patterns. Use icp/help section=\'action\' for detailed examples, workflows, and best practices.',
  inputSchema: ActionInputSchema,
  execute: action,
};
