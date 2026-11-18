/**
 * Action tool: toolchain and project operations.
 *
 * `action` is an operation id (e.g. "deploy") or a short phrase that maps to
 * one; `context` carries that operation's parameters, validated by its schema.
 * Free text never selects mainnet or a cloud engine: those need explicit
 * context.environment or context.engine, and confirmation.
 */

import { z } from 'zod';
import { DataEncoder } from '../core/toon-encoder.js';
import { logger } from '../utils/logger.js';
import { validate, ValidateInputSchema } from './validate.js';
import { executeRefactor, refactorSchema } from './refactor.js';
import { executeAnalyzeProject, analyzeProjectSchema } from './analyze-project.js';
import { executeCheckUpgrade, checkUpgradeSchema } from './check-upgrade.js';
import { executeGenerateTests, generateTestsSchema } from './generate-tests.js';
import {
  DeployContextSchema,
  NetworkContextSchema,
  CallContextSchema,
  NewProjectContextSchema,
  StatusContextSchema,
  executeDeploy,
  executeNetwork,
  executeCall,
  executeNewProject,
  executeStatus,
} from './icp-ops.js';
import { PreflightContextSchema, executePreflight } from './preflight.js';
import { convertDfxJson, convertProject } from '../converters/dfx-to-icp.js';
import { lintEngineRules } from '../validators/engine-rules.js';
import { InvalidArgumentError } from '../executors/icp-executor.js';
import { REFS } from '../data/references.js';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

export const ActionInputSchema = z.object({
  action: z
    .string()
    .describe('Operation id, e.g. "preflight", "deploy", "validate"; or a short phrase such as "start the local network"'),
  context: z.record(z.any()).optional().describe('Parameters of the operation. icp/help section="action" lists them per operation.'),
  format: z.enum(['toon', 'json', 'markdown']).optional().default('toon'),
});

export type ActionInput = z.infer<typeof ActionInputSchema>;

export const ConvertContextSchema = z.object({
  projectPath: z.string().optional().describe('Project directory with dfx.json'),
  dfxJson: z.string().optional().describe('dfx.json text to convert without reading a project'),
  write: z.boolean().optional().describe('Write icp.yaml, mops.toml and .icp/data/mappings/ic.ids.json (default false: preview)'),
  overwrite: z.boolean().optional().describe('Replace an existing icp.yaml'),
  assetRecipe: z.enum(['static-site', 'asset-canister']).optional().describe('Frontend recipe (default static-site)'),
});

export const LintEngineContextSchema = z.object({
  code: z.string().optional().describe('Source to lint'),
  language: z.enum(['motoko', 'rust']).optional().describe('Language of code (default motoko)'),
  projectPath: z.string().optional().describe('Lint every .mo and .rs file under this directory instead'),
});

interface OperationSpec {
  schema: z.ZodTypeAny;
  summary: string;
  run: (context: any) => Promise<any>;
  example: Record<string, any>;
}

async function lintEngine(context: z.infer<typeof LintEngineContextSchema>) {
  if (context.code) {
    const issues = lintEngineRules(context.code, context.language || 'motoko');
    return { operation: 'lint-engine', valid: !issues.some(i => i.severity === 'error'), issues, references: [REFS.cloudEngineCanisters] };
  }
  if (!context.projectPath) {
    return { operation: 'lint-engine', error: 'Provide code or projectPath.' };
  }
  const root = resolve(context.projectPath);
  const findings: any[] = [];
  let files = 0;
  const walk = async (dir: string, depth: number) => {
    if (depth > 6 || files > 500 || !existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['node_modules', 'target', 'dist'].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (/\.(mo|rs)$/.test(entry.name)) {
        files += 1;
        const issues = lintEngineRules(await readFile(full, 'utf-8'), entry.name.endsWith('.rs') ? 'rust' : 'motoko');
        for (const issue of issues) findings.push({ file: full.slice(root.length + 1), ...issue });
      }
    }
  };
  await walk(root, 0);
  return {
    operation: 'lint-engine',
    filesChecked: files,
    valid: !findings.some(f => f.severity === 'error'),
    issues: findings,
    references: [REFS.cloudEngineCanisters],
  };
}

async function convert(context: z.infer<typeof ConvertContextSchema>) {
  if (context.dfxJson) {
    const result = convertDfxJson(JSON.parse(context.dfxJson), {}, { assetRecipe: context.assetRecipe });
    return {
      operation: 'convert-dfx',
      icpYaml: result.icpYaml,
      ...(result.mopsToml ? { mopsToml: result.mopsToml.text } : {}),
      ...(result.idMappings ? { idMappings: result.idMappings } : {}),
      notes: result.notes,
      warnings: result.warnings,
      skipped: result.skipped,
    };
  }
  const projectPath = resolve(context.projectPath || process.cwd());
  const result = await convertProject(projectPath, {
    write: context.write,
    overwrite: context.overwrite,
    assetRecipe: context.assetRecipe,
  });
  return {
    operation: 'convert-dfx',
    projectPath,
    written: result.written,
    files: result.files,
    icpYaml: result.icpYaml,
    ...(result.mopsToml && result.mopsToml.mode !== 'unchanged' ? { mopsToml: result.mopsToml.text } : {}),
    ...(result.idMappings ? { idMappings: result.idMappings } : {}),
    notes: result.notes,
    warnings: result.warnings,
    skipped: result.skipped,
    next: result.written
      ? 'dfx.json was left in place. Check the result with action "analyze", then "deploy" to the local network.'
      : 'Preview only. Repeat with write: true to create the files.',
  };
}

export const OPERATIONS: Record<string, OperationSpec> = {
  preflight: {
    schema: PreflightContextSchema,
    summary: 'Toolchain versions, identity, project, local network, optional read-only mainnet checks, and the next step.',
    run: executePreflight,
    example: { projectPath: './my-app', target: 'local' },
  },
  'new-project': {
    schema: NewProjectContextSchema,
    summary: 'icp new <name> --subfolder <template> --silent.',
    run: executeNewProject,
    example: { name: 'my-app', template: 'hello-world', define: { backend_type: 'motoko' } },
  },
  'network-start': {
    schema: NetworkContextSchema,
    summary: "Start the project's local network in the background (icp network start -d). Never wipes state.",
    run: ctx => executeNetwork('start', ctx),
    example: { projectPath: './my-app' },
  },
  'network-stop': {
    schema: NetworkContextSchema,
    summary: "Stop the project's local network.",
    run: ctx => executeNetwork('stop', ctx),
    example: { projectPath: './my-app' },
  },
  'network-status': {
    schema: NetworkContextSchema,
    summary: 'Whether the local network runs, and its gateway URL.',
    run: ctx => executeNetwork('status', ctx),
    example: { projectPath: './my-app' },
  },
  deploy: {
    schema: DeployContextSchema,
    summary: 'icp deploy. Local by default; mainnet (environment "ic"), engine or reinstall return a plan and need confirm: true.',
    run: executeDeploy,
    example: { projectPath: './my-app' },
  },
  call: {
    schema: CallContextSchema,
    summary: 'icp canister call. Update calls outside the local network need confirm: true.',
    run: executeCall,
    example: { projectPath: './my-app', canister: 'backend', method: 'greet', args: '("World")', query: true },
  },
  status: {
    schema: StatusContextSchema,
    summary: 'icp canister status --json for one or all canisters of an environment.',
    run: executeStatus,
    example: { projectPath: './my-app', environment: 'local' },
  },
  'convert-dfx': {
    schema: ConvertContextSchema,
    summary: 'Convert dfx.json to icp.yaml (and mops.toml for Motoko). Preview unless write: true; never deletes dfx.json.',
    run: convert,
    example: { projectPath: './legacy-app', write: false },
  },
  validate: {
    schema: ValidateInputSchema,
    summary: 'Validate Candid (didc), Motoko (mops, project toolchain or latest moc), Rust, icp.yaml, dfx.json.',
    run: validate,
    example: { code: 'actor { public query func hi() : async Text { "hi" } }', language: 'motoko' },
  },
  'lint-engine': {
    schema: LintEngineContextSchema,
    summary: 'Cloud engine call rules: no attached cycles, bounded-wait cross-subnet calls, proxy for chain-key services.',
    run: lintEngine,
    example: { projectPath: './my-app' },
  },
  analyze: {
    schema: analyzeProjectSchema,
    summary: 'Project structure from icp.yaml (or dfx.json), problems, and compiler checks.',
    run: executeAnalyzeProject,
    example: { projectPath: './my-app' },
  },
  'check-upgrade': {
    schema: checkUpgradeSchema,
    summary: 'Compare two Candid interfaces for breaking changes.',
    run: executeCheckUpgrade,
    example: { oldCandid: 'service : { greet : (text) -> (text) }', newCandid: 'service : { greet : (text) -> (text); count : () -> (nat) }' },
  },
  'generate-tests': {
    schema: generateTestsSchema,
    summary: 'mo:test scaffolding for Motoko functions.',
    run: executeGenerateTests,
    example: { code: 'public func double(x : Nat) : Nat { x * 2 };', moduleName: 'Math' },
  },
  refactor: {
    schema: refactorSchema,
    summary: 'Expose the caller in update methods (add-caller-checks).',
    run: executeRefactor,
    example: { code: 'actor { public shared func reset() : async () {} }', language: 'motoko', refactoring: 'add-caller-checks' },
  },
};

const ALIASES: Record<string, string> = {
  test: 'call',
  doctor: 'preflight',
  convert: 'convert-dfx',
  'start-network': 'network-start',
  'stop-network': 'network-stop',
  new: 'new-project',
};

const PHRASES: Array<[RegExp, string]> = [
  [/\b(preflight|doctor)\b|\bcheck\b.*\b(setup|environment|toolchain|install)/, 'preflight'],
  [/\bconvert\b.*\bdfx\b|\bdfx\.json\b.*\b(icp\.yaml|migrat)/, 'convert-dfx'],
  [/\b(engine|opencloud)\b.*\b(lint|rules?)\b|\blint\b.*\bengine\b/, 'lint-engine'],
  [/\b(start|launch|run|boot)\b.*\b(network|replica)\b/, 'network-start'],
  [/\bstop\b.*\b(network|replica)\b/, 'network-stop'],
  [/\b(network|replica)\b.*\b(status|running)\b/, 'network-status'],
  [/\b(new|create|scaffold)\b.*\b(project|app)\b/, 'new-project'],
  [/\b(generate|create|write)\b.*\btests?\b/, 'generate-tests'],
  [/\b(upgrade|compatib|breaking)/, 'check-upgrade'],
  [/\b(validate|verify|lint|compile|check)\b.*\b(code|candid|motoko|rust|icp\.yaml|dfx)/, 'validate'],
  [/\b(refactor|caller check)/, 'refactor'],
  [/\b(analy[sz]e|inspect|review)\b.*\b(project|structure|dependencies)/, 'analyze'],
  [/\b(test|call|invoke)\b.*\b(method|function|canister)\b/, 'call'],
  [/\bcanister\b.*\bstatus\b/, 'status'],
  [/\b(deploy|ship|publish)\b/, 'deploy'],
];

export function resolveOperation(action: string, context?: Record<string, any>): { operation: string | null; matchedBy: string } {
  const fromContext = typeof context?.operation === 'string' ? context.operation.trim().toLowerCase() : '';
  if (fromContext && (OPERATIONS[fromContext] || ALIASES[fromContext])) {
    return { operation: OPERATIONS[fromContext] ? fromContext : ALIASES[fromContext], matchedBy: 'context.operation' };
  }
  const normalized = action.trim().toLowerCase();
  if (OPERATIONS[normalized]) return { operation: normalized, matchedBy: 'id' };
  if (ALIASES[normalized]) return { operation: ALIASES[normalized], matchedBy: 'alias' };
  for (const [pattern, operation] of PHRASES) {
    if (pattern.test(normalized)) return { operation, matchedBy: 'phrase' };
  }
  return { operation: null, matchedBy: 'none' };
}

/** Fill a few parameters from simple phrases ("method greet"). Mainnet and engines are never inferred. */
function contextFromPhrase(
  operation: string,
  action: string,
  context: Record<string, any>
): { ok: true; context: Record<string, any> } | { ok: false; error: string } {
  const text = action.toLowerCase();
  const merged = { ...context };
  delete merged.operation;
  if ((operation === 'deploy' || operation === 'call') && !merged.environment && !merged.engine && !merged.network) {
    if (/\b(mainnet|production)\b|\bto ic\b/.test(text)) {
      return { ok: false, error: 'The request mentions mainnet. Set context.environment = "ic" explicitly; the tool will show a plan to confirm.' };
    }
    if (/\b(engine|opencloud)\b/.test(text)) {
      return { ok: false, error: 'The request mentions a cloud engine. Set context.engine to the engine name; the tool will show a plan to confirm.' };
    }
  }
  if (operation === 'call' && !merged.method) {
    const method = action.match(/\b(?:method|function)\s+([A-Za-z_]\w*)/i);
    if (method) merged.method = method[1];
  }
  if (operation === 'validate' && !merged.language) {
    for (const language of ['candid', 'motoko', 'rust']) {
      if (text.includes(language)) merged.language = language;
    }
    if (/icp\.yaml/.test(text)) merged.language = 'icp-yaml';
    if (/dfx\.json/.test(text)) merged.language = 'dfx-json';
  }
  return { ok: true, context: merged };
}

function encode(result: any, format: ActionInput['format'], operation: string, matchedBy: string) {
  if (result && Array.isArray(result.content)) {
    return { ...result, metadata: { action: operation, matchedBy } };
  }
  const text = typeof result === 'string' ? result : DataEncoder.encode(result, format);
  const failed = result && typeof result === 'object' && (result.status === 'failed' || result.status === 'blocked' || result.error);
  return {
    content: [{ type: 'text' as const, text }],
    ...(failed ? { isError: true } : {}),
    metadata: { action: operation, matchedBy, format },
  };
}

export async function action(input: ActionInput) {
  logger.info(`Action: "${input.action}"`);
  const { operation, matchedBy } = resolveOperation(input.action, input.context);

  if (!operation) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: `Unknown action "${input.action}".`,
              operations: Object.fromEntries(Object.entries(OPERATIONS).map(([id, spec]) => [id, spec.summary])),
              hint: 'Pass an operation id as action, with its parameters in context. icp/help section="action" has the parameters.',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const spec = OPERATIONS[operation];
  const prepared = contextFromPhrase(operation, input.action, input.context || {});
  if (!prepared.ok) {
    return encode({ operation, error: prepared.error }, input.format, operation, matchedBy);
  }
  const parsed = spec.schema.safeParse(prepared.context);
  if (!parsed.success) {
    return encode(
      {
        operation,
        error: 'Invalid or missing parameters.',
        issues: parsed.error.issues.map(i => `${i.path.join('.') || 'context'}: ${i.message}`),
        example: { action: operation, context: spec.example },
      },
      input.format,
      operation,
      matchedBy
    );
  }

  try {
    const result = await spec.run(parsed.data);
    return encode(result, input.format, operation, matchedBy);
  } catch (error: any) {
    logger.error('Action execution error:', error);
    const invalid = error instanceof InvalidArgumentError;
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ operation, error: invalid ? error.message : `Action failed: ${error.message}` }, null, 2) }],
      isError: true,
      metadata: { action: operation, matchedBy },
    };
  }
}

export const actionTool = {
  name: 'icp/action',
  description:
    'Local ICP operations with icp-cli and mops: preflight, new-project, network-start/stop/status, deploy, call, status, ' +
    'convert-dfx, validate, lint-engine, analyze, check-upgrade, generate-tests, refactor. ' +
    'Pass the operation id as action and its parameters in context. Deploys and update calls on mainnet or a cloud engine ' +
    'return a plan first and run only with context.confirm = true. Details: icp/help section="action".',
  inputSchema: ActionInputSchema,
  execute: action,
};
