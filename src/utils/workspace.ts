/**
 * Persistent Workspace Manager
 *
 * Implements Anthropic's "Code Execution with MCP" persistent workspace pattern:
 * - Thread-safe workspace storage
 * - Automatic garbage collection
 * - Size limits and monitoring
 * - Workspace isolation
 * - Serializable state management
 *
 * Design principles:
 * 1. Workspaces are isolated by ID
 * 2. Automatic cleanup after TTL (default 1 hour)
 * 3. Maximum workspace size (10MB per workspace)
 * 4. Thread-safe for concurrent access
 * 5. Only serializable data (no functions, circular refs)
 */

import { logger } from './logger.js';

/**
 * Serializable workspace data
 * Only JSON-serializable types allowed
 */
export type WorkspaceData = {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | WorkspaceData
    | Array<string | number | boolean | null | WorkspaceData>;
};

/**
 * Workspace metadata
 */
interface WorkspaceMetadata {
  id: string;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  sizeBytes: number;
}

/**
 * Workspace entry with data and metadata
 */
interface WorkspaceEntry {
  data: WorkspaceData;
  metadata: WorkspaceMetadata;
}

/**
 * Workspace configuration
 */
export interface WorkspaceConfig {
  /** Maximum age of workspace in milliseconds (default: 1 hour) */
  maxAge?: number;
  /** Maximum workspace size in bytes (default: 10MB) */
  maxSize?: number;
  /** Garbage collection interval in milliseconds (default: 5 minutes) */
  gcInterval?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<WorkspaceConfig> = {
  maxAge: 60 * 60 * 1000, // 1 hour
  maxSize: 10 * 1024 * 1024, // 10MB
  gcInterval: 5 * 60 * 1000, // 5 minutes
};

/**
 * Persistent Workspace Manager
 * Thread-safe, garbage-collected workspace storage
 */
export class WorkspaceManager {
  private workspaces: Map<string, WorkspaceEntry>;
  private config: Required<WorkspaceConfig>;
  private gcTimer: NodeJS.Timeout | null;

  constructor(config: WorkspaceConfig = {}) {
    this.workspaces = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.gcTimer = null;

    // Start garbage collection
    this.startGarbageCollection();

    logger.info('WorkspaceManager initialized', {
      maxAge: `${this.config.maxAge / 1000}s`,
      maxSize: `${this.config.maxSize / 1024 / 1024}MB`,
      gcInterval: `${this.config.gcInterval / 1000}s`,
    });
  }

  /**
   * Get or create workspace
   * Thread-safe access with automatic metadata tracking
   */
  get(workspaceId: string): WorkspaceData {
    const now = Date.now();

    // Get existing or create new
    let entry = this.workspaces.get(workspaceId);

    if (!entry) {
      // Create new workspace
      entry = {
        data: {},
        metadata: {
          id: workspaceId,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 0,
          sizeBytes: 0,
        },
      };
      this.workspaces.set(workspaceId, entry);
      logger.debug(`Created workspace: ${workspaceId}`);
    }

    // Update access metadata
    entry.metadata.lastAccessedAt = now;
    entry.metadata.accessCount++;

    return entry.data;
  }

  /**
   * Save workspace data
   * Validates size limits and serializability
   */
  save(workspaceId: string, data: WorkspaceData): void {
    // Validate serializability
    try {
      const serialized = JSON.stringify(data);
      const sizeBytes = Buffer.byteLength(serialized, 'utf8');

      // Check size limit
      if (sizeBytes > this.config.maxSize) {
        throw new Error(
          `Workspace ${workspaceId} exceeds size limit: ${sizeBytes} bytes > ${this.config.maxSize} bytes`
        );
      }

      // Get or create entry
      let entry = this.workspaces.get(workspaceId);
      const now = Date.now();

      if (!entry) {
        entry = {
          data,
          metadata: {
            id: workspaceId,
            createdAt: now,
            lastAccessedAt: now,
            accessCount: 1,
            sizeBytes,
          },
        };
      } else {
        entry.data = data;
        entry.metadata.lastAccessedAt = now;
        entry.metadata.sizeBytes = sizeBytes;
      }

      this.workspaces.set(workspaceId, entry);

      logger.debug(`Saved workspace: ${workspaceId}`, {
        size: `${sizeBytes} bytes`,
        keys: Object.keys(data).length,
      });
    } catch (error: any) {
      if (error.message.includes('circular structure')) {
        throw new Error(
          `Workspace ${workspaceId} contains non-serializable data (circular reference or functions)`
        );
      }
      throw error;
    }
  }

  /**
   * Delete workspace
   */
  delete(workspaceId: string): boolean {
    const deleted = this.workspaces.delete(workspaceId);
    if (deleted) {
      logger.debug(`Deleted workspace: ${workspaceId}`);
    }
    return deleted;
  }

  /**
   * Get workspace metadata
   */
  getMetadata(workspaceId: string): WorkspaceMetadata | null {
    const entry = this.workspaces.get(workspaceId);
    return entry ? { ...entry.metadata } : null;
  }

  /**
   * List all workspaces
   */
  list(): WorkspaceMetadata[] {
    return Array.from(this.workspaces.values()).map(entry => ({ ...entry.metadata }));
  }

  /**
   * Get total memory usage
   */
  getTotalSize(): number {
    return Array.from(this.workspaces.values()).reduce(
      (total, entry) => total + entry.metadata.sizeBytes,
      0
    );
  }

  /**
   * Clear all workspaces
   */
  clear(): void {
    const count = this.workspaces.size;
    this.workspaces.clear();
    logger.info(`Cleared all workspaces (${count} total)`);
  }

  /**
   * Start automatic garbage collection
   */
  private startGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }

    this.gcTimer = setInterval(() => {
      this.runGarbageCollection();
    }, this.config.gcInterval);

    // Don't prevent process exit
    this.gcTimer.unref();
  }

  /**
   * Run garbage collection
   * Removes expired workspaces based on TTL
   */
  private runGarbageCollection(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, entry] of this.workspaces.entries()) {
      const age = now - entry.metadata.lastAccessedAt;
      if (age > this.config.maxAge) {
        expired.push(id);
      }
    }

    if (expired.length > 0) {
      expired.forEach(id => this.workspaces.delete(id));
      logger.info(`Garbage collected ${expired.length} expired workspace(s)`, {
        expired,
      });
    }
  }

  /**
   * Cleanup and stop garbage collection
   */
  destroy(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    this.clear();
    logger.info('WorkspaceManager destroyed');
  }
}

/**
 * Global workspace manager singleton
 */
let globalWorkspaceManager: WorkspaceManager | null = null;

/**
 * Get global workspace manager
 */
export function getWorkspaceManager(): WorkspaceManager {
  if (!globalWorkspaceManager) {
    globalWorkspaceManager = new WorkspaceManager();
  }
  return globalWorkspaceManager;
}

/**
 * Cleanup on process exit
 */
process.on('exit', () => {
  if (globalWorkspaceManager) {
    globalWorkspaceManager.destroy();
  }
});
