/**
 * Execute tool: run JavaScript that calls the query and action tools and
 * returns only the data needed, so large intermediate results stay out of the
 * model's context.
 *
 * The code runs in a separate Node vm context. That is not a security
 * boundary: it has this server's permissions.
 */

import { z } from 'zod';
import { runInNewContext } from 'vm';
import { DataEncoder } from '../core/toon-encoder.js';
import { logger } from '../utils/logger.js';
import { getWorkspaceManager, type WorkspaceData } from '../utils/workspace.js';

// Import tools that will be available in sandbox
import { query, QueryInputSchema } from './query.js';
import { action, ActionInputSchema } from './action.js';

// Input schema
export const ExecuteInputSchema = z.object({
  code: z.string().describe('JavaScript body of an async function; `return` the result'),
  timeout: z.number().optional().default(5000).describe('Execution timeout in milliseconds (max 30000)'),
  format: z.enum(['toon', 'json', 'markdown']).optional().default('toon'),
  workspace: z.string().optional().describe('Persistent workspace ID for resumable sessions'),
  saveWorkspace: z.boolean().optional().default(false).describe('Save workspace state after execution'),
});

export type ExecuteInput = z.infer<typeof ExecuteInputSchema>;

/**
 * Helper utilities available in sandbox
 */
const sandboxHelpers = {
  /**
   * Extract function signatures from Motoko documentation
   */
  extractFunctionSignatures(markdown: string): string[] {
    const signatures: string[] = [];
    const funcRegex = /(?:public|private)?\s*(?:func|let|var|class|type)\s+\w+[^;\n]*/g;
    const matches = markdown.match(funcRegex);

    if (matches) {
      signatures.push(...matches.map(m => m.trim()));
    }

    const codeBlockRegex = /```motoko\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const codeSignatures = match[1].match(funcRegex);
      if (codeSignatures) {
        signatures.push(...codeSignatures.map(s => s.trim()));
      }
    }

    return [...new Set(signatures)];
  },

  /**
   * Filter array by keyword match
   */
  filterByKeyword(items: any[], keyword: string, field?: string): any[] {
    const lowerKeyword = keyword.toLowerCase();
    return items.filter(item => {
      const searchText = field ? String(item[field]) : JSON.stringify(item);
      return searchText.toLowerCase().includes(lowerKeyword);
    });
  },

  /**
   * Extract code blocks from markdown
   */
  extractCodeBlocks(markdown: string, language?: string): string[] {
    const pattern = language
      ? new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 'g')
      : /```(?:\w+)?\n([\s\S]*?)```/g;

    const blocks: string[] = [];
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      blocks.push(match[1].trim());
    }
    return blocks;
  },

  /**
   * Group array by field value
   */
  groupBy<T>(items: T[], getKey: (item: T) => string): Record<string, T[]> {
    return items.reduce((groups, item) => {
      const key = getKey(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  },

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};

function unwrap(result: { content?: Array<{ text?: string }> }): any {
  const text = result.content?.[0]?.text;
  if (typeof text !== 'string') return result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Execute code with optional persistent workspace
 */
export async function execute(input: ExecuteInput) {
  logger.info('Executing code in sandbox', {
    workspace: input.workspace || 'none',
    saveWorkspace: input.saveWorkspace,
  });
  logger.debug(`Code length: ${input.code.length} chars, timeout: ${input.timeout}ms`);

  // Validate timeout
  const timeout = Math.min(input.timeout, 30000); // Max 30 seconds

  // Get workspace if specified
  const workspaceManager = getWorkspaceManager();
  const workspaceData: WorkspaceData = input.workspace
    ? workspaceManager.get(input.workspace)
    : {};

  try {
    // Create sandbox context with tools, helpers, and workspace
    const sandbox = {
      // Persistent workspace (if provided)
      workspace: workspaceData,

      // Tools available in sandbox
      queryTool: {
        execute: async (args: any) => unwrap(await query(QueryInputSchema.parse({ format: 'json', ...args }))),
      },
      actionTool: {
        execute: async (args: any) => unwrap(await action(ActionInputSchema.parse({ format: 'json', ...args }))),
      },

      // Helper utilities
      helpers: sandboxHelpers,

      // Safe console
      console: {
        log: (...args: any[]) => logger.debug('[Sandbox]', ...args),
        error: (...args: any[]) => logger.warn('[Sandbox Error]', ...args),
      },

      // Promise for async support
      Promise,

      // Common globals needed for code execution
      setTimeout,
      clearTimeout,
      JSON,
      Object,
      Array,
      String,
      Number,
      Boolean,
      Math,
      Date,
      RegExp,
    };

    // Wrap code in async IIFE
    const wrappedCode = `
      (async () => {
        ${input.code}
      })()
    `;

    // Execute with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Script execution timed out')), timeout)
    );

    const executionPromise = runInNewContext(wrappedCode, sandbox, {
      timeout,
      displayErrors: true,
    });

    const result = await Promise.race([executionPromise, timeoutPromise]);

    // Save workspace if requested
    let workspaceMetadata = null;
    if (input.workspace && input.saveWorkspace) {
      try {
        workspaceManager.save(input.workspace, sandbox.workspace);
        workspaceMetadata = workspaceManager.getMetadata(input.workspace);
        logger.info(`Workspace saved: ${input.workspace}`, {
          size: workspaceMetadata?.sizeBytes,
          keys: Object.keys(sandbox.workspace).length,
        });
      } catch (error: any) {
        logger.error(`Failed to save workspace: ${error.message}`);
        // Don't fail execution, just warn
        workspaceMetadata = { error: error.message };
      }
    }

    // Encode result
    const encoded = DataEncoder.encode(
      {
        success: true,
        result,
        executionTime: `<${timeout}ms`,
        workspace: input.workspace
          ? {
              id: input.workspace,
              saved: input.saveWorkspace,
              metadata: workspaceMetadata,
            }
          : undefined,
      },
      input.format
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: encoded,
        },
      ],
      metadata: {
        executed: true,
        timeout,
        workspace: input.workspace,
        tokenEstimate: DataEncoder.estimateTokens(encoded),
      },
    };
  } catch (error: any) {
    logger.error('Sandbox execution error:', error);

    // Check for timeout
    const isTimeout = error.message?.includes('Script execution timed out');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: false,
              error: isTimeout
                ? `Code execution timed out after ${timeout}ms`
                : `Execution error: ${error.message}`,
              hint: isTimeout
                ? 'Reduce complexity or increase timeout parameter'
                : 'Check code syntax and available sandbox APIs',
              availableAPIs: {
                tools: ['queryTool.execute(args)', 'actionTool.execute(args)'],
                helpers: Object.keys(sandboxHelpers),
              },
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

// Export for use in main index
export const executeTool = {
  name: 'icp/execute',
  description:
    'Run JavaScript that calls queryTool.execute / actionTool.execute and returns only what you need. Not a security sandbox. See icp/help section="execute".',
  inputSchema: ExecuteInputSchema,
  execute,
};
