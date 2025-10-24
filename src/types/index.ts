/**
 * Core type definitions for ICP MCP
 */

export type Language = 'candid' | 'motoko' | 'rust' | 'dfx-json';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  // Core fields
  severity: IssueSeverity;
  line?: number;
  column?: number;
  message: string;
  code?: string;

  // Rich diagnostics (always provided when available)
  // These help users understand WHY issues matter on ICP specifically
  explanation?: string;     // ICP-specific context and implications
  suggestedFix?: string;   // Code snippet showing the fix
  references?: string[];   // URLs to official documentation
  example?: string;        // Complete working example demonstrating the pattern

  // Deprecated (keep for backward compatibility)
  suggestion?: string;     // Use suggestedFix instead
  docUrl?: string;        // Use references[0] instead
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  suggestions?: string[];
}

export interface DocContent {
  topic: string;
  section?: string;
  content: string;
  url: string;
  metadata: {
    title: string;
    description?: string;
    lastUpdated?: string;
  };
}

export interface ExampleFile {
  name: string;
  description: string;
  language: string;
  path: string;
  files: Record<string, string>;
  readme?: string;
  dfxConfig?: any;
  url: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface DfxCommand {
  command: string;
  explanation: string;
  safetyChecks: string[];
  prerequisites?: string[];
  alternatives?: string[];
  nextSteps: string[];
  docUrl?: string;
}

export type DfxOperation = 'deploy' | 'canister-call' | 'identity' | 'cycles' | 'build';
export type Network = 'local' | 'ic' | 'playground';
