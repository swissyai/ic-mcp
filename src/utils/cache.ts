/**
 * Simple in-memory cache with TTL
 */

import type { CacheEntry } from '../types/index.js';

const DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes

export class Cache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  set(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton caches for different data types
export const docsCache = new Cache<any>();
export const examplesCache = new Cache<any>();
export const validationCache = new Cache<any>();

// Run cleanup every 5 minutes
setInterval(() => {
  docsCache.cleanup();
  examplesCache.cleanup();
  validationCache.cleanup();
}, 5 * 60 * 1000);
