/**
 * Intelligent Tool Router
 * Analyzes user intent and recommends appropriate tools
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

// Router input schema
export const RouterInputSchema = z.object({
  query: z.string().describe('User query or request'),
  context: z
    .object({
      hasCode: z.boolean().optional(),
      language: z.string().optional(),
      projectPath: z.string().optional(),
    })
    .optional()
    .describe('Additional context about the request'),
});

export type RouterInput = z.infer<typeof RouterInputSchema>;

interface ToolRecommendation {
  tool: string;
  confidence: number;
  reason: string;
  params?: Record<string, any>;
  alternativeTool?: string;
}

/**
 * Pattern matching for user intents
 */
const INTENT_PATTERNS: Array<{
  patterns: RegExp[];
  tool: string;
  params?: (match: RegExpMatchArray) => Record<string, any>;
  reason: string;
}> = [
  // Discovery intents
  {
    patterns: [
      /what\s+(modules?|data\s+structures?|types?)\s+(are\s+)?available/i,
      /list\s+all\s+(modules?|libraries)/i,
      /show\s+me\s+(all\s+)?the\s+modules?/i,
      /what\s+can\s+i\s+use/i,
      /explore\s+motoko/i,
    ],
    tool: 'icp/discover',
    params: () => ({ action: 'list-all' }),
    reason: 'User wants to discover available modules',
  },
  {
    patterns: [
      /(?:find|search|look for)\s+(?:modules?\s+)?(?:for|about|related to)\s+(.+)/i,
      /how\s+(?:do\s+i|to)\s+work\s+with\s+(.+)/i,
      /(?:modules?\s+)?for\s+(.+)/i,
      /what\s+(?:module|library)\s+(?:handles?|does?)\s+(.+)/i,
    ],
    tool: 'icp/discover',
    params: (match) => ({ action: 'search', query: match[1].trim() }),
    reason: 'User wants to search for specific functionality',
  },

  // Documentation intents
  {
    patterns: [
      /(?:show|get|fetch)\s+(?:me\s+)?(?:the\s+)?docs?\s+(?:for|about|on)\s+(.+)/i,
      /documentation\s+(?:for|about|on)\s+(.+)/i,
      /how\s+does\s+(\w+)\s+(?:module\s+)?work/i,
      /explain\s+(\w+)\s+module/i,
    ],
    tool: 'icp/motoko-core',
    params: (match) => ({ module: match[1].trim() }),
    reason: 'User wants documentation for a specific module',
  },

  // Validation intents
  {
    patterns: [
      /validate\s+(?:this\s+)?(?:my\s+)?code/i,
      /check\s+(?:this\s+)?(?:for\s+)?errors?/i,
      /is\s+this\s+(?:code\s+)?(?:correct|valid)/i,
      /find\s+(?:the\s+)?(?:bugs?|errors?|issues?)/i,
    ],
    tool: 'icp/validate',
    reason: 'User wants to validate code',
  },

  // Template/Scaffolding intents
  {
    patterns: [
      /create\s+(?:a\s+)?(?:new\s+)?(?:motoko|rust)\s+(?:project|canister)/i,
      /bootstrap\s+(?:a\s+)?(?:new\s+)?project/i,
      /scaffold\s+(?:a\s+)?(?:motoko|rust)\s+canister/i,
      /generate\s+(?:a\s+)?template/i,
      /start\s+(?:a\s+)?new\s+(?:project|canister)/i,
    ],
    tool: 'icp/template',
    reason: 'User wants to create a new project or canister',
  },

  // Example intents
  {
    patterns: [
      /(?:show|get|find)\s+(?:me\s+)?(?:an?\s+)?examples?\s+(?:of|for)\s+(.+)/i,
      /examples?\s+(?:of|for)\s+(.+)/i,
      /how\s+to\s+(?:use|implement)\s+(.+)\s+example/i,
      /sample\s+code\s+(?:for\s+)?(.+)/i,
    ],
    tool: 'icp/get-example',
    reason: 'User wants code examples',
  },

  // DFX command intents
  {
    patterns: [
      /(?:how\s+to\s+)?deploy/i,
      /dfx\s+deploy/i,
      /deployment\s+command/i,
      /push\s+to\s+(?:mainnet|ic)/i,
    ],
    tool: 'icp/dfx-guide',
    params: () => ({ operation: 'deploy' }),
    reason: 'User needs help with deployment',
  },

  // Testing intents
  {
    patterns: [
      /test\s+(?:my\s+)?(?:canister|project)/i,
      /run\s+tests?/i,
      /call\s+(?:a\s+)?(?:canister\s+)?method/i,
      /execute\s+(?:a\s+)?function/i,
    ],
    tool: 'icp/test-call',
    reason: 'User wants to test canister functionality',
  },

  // Performance intents
  {
    patterns: [
      /(?:analyze|check)\s+performance/i,
      /optimize\s+(?:my\s+)?code/i,
      /performance\s+(?:analysis|check)/i,
      /(?:why\s+is\s+)?(?:my\s+)?(?:canister|code)\s+slow/i,
      /reduce\s+cycle\s+cost/i,
    ],
    tool: 'icp/speed',
    reason: 'User wants performance analysis',
  },

  // Migration intents
  {
    patterns: [
      /migrate\s+(?:from\s+)?base\s+to\s+core/i,
      /base\s+to\s+core/i,
      /migration\s+guide/i,
      /upgrade\s+from\s+base/i,
    ],
    tool: 'icp/base-to-core-migration',
    reason: 'User needs help migrating from base to core',
  },

  // Project analysis intents
  {
    patterns: [
      /analyze\s+(?:my\s+)?project/i,
      /understand\s+(?:the\s+)?(?:project\s+)?structure/i,
      /what\s+(?:is|are)\s+(?:in\s+)?(?:this\s+)?(?:project|codebase)/i,
      /project\s+dependencies/i,
    ],
    tool: 'icp/analyze-project',
    reason: 'User wants to understand project structure',
  },
];

/**
 * Analyze user query and recommend tools
 */
export function analyzeIntent(input: RouterInput): ToolRecommendation[] {
  const recommendations: ToolRecommendation[] = [];
  const query = input.query.toLowerCase();

  // Check each pattern
  for (const intent of INTENT_PATTERNS) {
    for (const pattern of intent.patterns) {
      const match = query.match(pattern);
      if (match) {
        recommendations.push({
          tool: intent.tool,
          confidence: 0.9,
          reason: intent.reason,
          params: intent.params ? intent.params(match) : undefined,
        });
        break;
      }
    }
  }

  // Keyword-based fallbacks if no pattern matched
  if (recommendations.length === 0) {
    // Module/library keywords
    if (query.includes('module') || query.includes('library') || query.includes('available')) {
      recommendations.push({
        tool: 'icp/discover',
        confidence: 0.7,
        reason: 'Query mentions modules/libraries',
        params: { action: 'list-all' },
      });
    }

    // Data structure keywords
    const dataStructures = ['array', 'list', 'map', 'set', 'queue', 'stack'];
    for (const ds of dataStructures) {
      if (query.includes(ds)) {
        recommendations.push({
          tool: 'icp/discover',
          confidence: 0.8,
          reason: `Query mentions ${ds}`,
          params: { action: 'search', query: ds },
        });
        break;
      }
    }

    // Code validation if context includes code
    if (input.context?.hasCode) {
      recommendations.push({
        tool: 'icp/validate',
        confidence: 0.6,
        reason: 'Context includes code',
        params: { language: input.context.language || 'motoko' },
      });
    }

    // Documentation keywords
    if (query.includes('doc') || query.includes('help') || query.includes('how')) {
      recommendations.push({
        tool: 'icp/get-docs',
        confidence: 0.5,
        reason: 'Query requests documentation',
      });
    }
  }

  // Sort by confidence
  recommendations.sort((a, b) => b.confidence - a.confidence);

  // Add alternative suggestions for lower confidence matches
  for (const rec of recommendations) {
    if (rec.confidence < 0.9) {
      if (rec.tool === 'icp/motoko-core') {
        rec.alternativeTool = 'icp/discover';
      } else if (rec.tool === 'icp/get-docs') {
        rec.alternativeTool = 'icp/discover';
      }
    }
  }

  // Limit to top 3 recommendations
  return recommendations.slice(0, 3);
}

/**
 * Main router handler
 */
export async function route(input: RouterInput) {
  try {
    const recommendations = analyzeIntent(input);

    if (recommendations.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              query: input.query,
              message: 'No specific tool recommendation found',
              suggestion: 'Try using icp/discover to explore available functionality',
              command: '{ action: "list-all" }',
              alternativeTools: [
                'icp/discover - Explore modules',
                'icp/get-docs - Read documentation',
                'icp/template - Create new project',
              ],
            }, null, 2),
          },
        ],
      };
    }

    const output = {
      query: input.query,
      recommendations: recommendations.map(r => ({
        tool: r.tool,
        confidence: `${Math.round(r.confidence * 100)}%`,
        reason: r.reason,
        suggestedParams: r.params,
        alternative: r.alternativeTool,
      })),
      primaryRecommendation: {
        use: recommendations[0].tool,
        with: recommendations[0].params || {},
      },
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('Router error:', error);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

// Export tool definition
export const routerTool = {
  name: 'icp/router',
  description: `Intelligent tool selection assistant that analyzes user intent and recommends appropriate tools.

When to use:
- Unsure which tool to use for a task
- User query is ambiguous or unclear
- Need parameter suggestions for a tool
- Want to confirm the right tool choice

Returns:
- Tool recommendations with confidence scores
- Suggested parameters for each tool
- Alternative tools when confidence is lower
- Primary recommendation ready to use

The router uses pattern matching and keyword analysis to understand user intent and map it to the most appropriate IC-MCP tool.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'User query or request to analyze',
      },
      context: {
        type: 'object',
        properties: {
          hasCode: {
            type: 'boolean',
            description: 'Whether the context includes code',
          },
          language: {
            type: 'string',
            description: 'Programming language if known',
          },
          projectPath: {
            type: 'string',
            description: 'Project path if available',
          },
        },
        description: 'Additional context about the request',
      },
    },
    required: ['query'],
  },
};