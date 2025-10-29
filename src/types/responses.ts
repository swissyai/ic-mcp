/**
 * Unified response types for MCP tools
 * Ensures consistent error handling and type safety
 */

/**
 * Standard MCP response format
 */
export interface MCPResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Successful result with data
 */
export interface SuccessResult<T = any> {
  success: true;
  data: T;
  metadata?: {
    format?: 'toon' | 'json' | 'markdown';
    tokenEstimate?: number;
    confidence?: number;
    intent?: string;
    [key: string]: any;
  };
}

/**
 * Error result with context
 */
export interface ErrorResult {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
    suggestion?: string;
    example?: any;
  };
}

/**
 * Error codes for categorization
 */
export enum ErrorCode {
  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Execution errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  COMPILATION_ERROR = 'COMPILATION_ERROR',
  EXECUTION_FAILED = 'EXECUTION_FAILED',

  // External errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  NOT_FOUND = 'NOT_FOUND',

  // Tool availability
  TOOL_NOT_AVAILABLE = 'TOOL_NOT_AVAILABLE',
  TOOL_ERROR = 'TOOL_ERROR',

  // Unknown
  UNKNOWN = 'UNKNOWN'
}

/**
 * Result type (success or error)
 */
export type Result<T = any> = SuccessResult<T> | ErrorResult;

/**
 * Type guard for success results
 */
export function isSuccess<T>(result: Result<T>): result is SuccessResult<T> {
  return result.success === true;
}

/**
 * Type guard for error results
 */
export function isError(result: Result): result is ErrorResult {
  return result.success === false;
}

/**
 * Create success result
 */
export function success<T>(data: T, metadata?: SuccessResult<T>['metadata']): SuccessResult<T> {
  return {
    success: true,
    data,
    metadata,
  };
}

/**
 * Create error result
 */
export function error(
  code: ErrorCode,
  message: string,
  details?: string,
  suggestion?: string,
  example?: any
): ErrorResult {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      suggestion,
      example,
    },
  };
}

/**
 * Convert result to MCP response format
 */
export function toMCPResponse(result: Result, format: 'toon' | 'json' | 'markdown' = 'toon'): MCPResponse {
  if (isSuccess(result)) {
    // Import encoder dynamically to avoid circular dependency
    const { DataEncoder } = require('../core/toon-encoder.js');
    const encoded = DataEncoder.encode(result.data, format);

    return {
      content: [
        {
          type: 'text' as const,
          text: encoded,
        },
      ],
      metadata: result.metadata,
    };
  } else {
    // Error response
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result.error, null, 2),
        },
      ],
      isError: true,
      metadata: {
        errorCode: result.error.code,
      },
    };
  }
}

/**
 * Query-specific result types
 */
export interface QueryResult {
  action: 'discover' | 'search' | 'document' | 'example' | 'explain-via-search' | 'list-all' | 'category';
  modules?: any[];
  results?: any[];
  query?: string;
  total?: number;
  categories?: Record<string, any[]>;
  category?: string;
  note?: string;
  message?: string;
  suggestions?: string[];
  format?: 'detailed' | 'summary';
}

/**
 * Action-specific result types
 */
export interface ActionResult {
  actionType: 'validate' | 'test' | 'deploy' | 'refactor' | 'analyze' | 'check-upgrade';
  // Result varies by action type, use discriminated unions
  [key: string]: any;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  language: string;
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    column?: number;
    suggestion?: string;
    docUrl?: string;
  }>;
  filename?: string;
}
