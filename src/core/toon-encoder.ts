/**
 * TOON (Token-Oriented Object Notation) encoder for ICP-MCP
 * Reduces token usage by 45-50% for structured data
 */

import { encode as toTOON } from '@byjohann/toon';
import { logger } from '../utils/logger.js';

export type DataFormat = 'toon' | 'json' | 'markdown';

export class DataEncoder {
  /**
   * Encode data in the specified format with TOON as default
   */
  static encode(data: any, format: DataFormat = 'toon'): string {
    // Try TOON first if compatible
    if (format === 'toon' && this.isTOONCompatible(data)) {
      try {
        return toTOON(data, {
          indent: 2,
          lengthMarker: "#",  // Helps LLM validate structure
        });
      } catch (error) {
        logger.warn('TOON encoding failed, falling back to JSON:', error);
        return JSON.stringify(data, null, 2);
      }
    }

    // JSON format
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // Markdown format for human readability
    if (format === 'markdown') {
      return this.toMarkdown(data);
    }

    // Default to TOON if possible, otherwise JSON
    if (this.isTOONCompatible(data)) {
      try {
        return toTOON(data, { indent: 2, lengthMarker: "#" });
      } catch {
        return JSON.stringify(data, null, 2);
      }
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Check if data structure is suitable for TOON encoding
   */
  static isTOONCompatible(data: any): boolean {
    // Null or undefined
    if (data == null) return false;

    // Arrays with uniform objects are ideal for TOON
    if (Array.isArray(data)) {
      if (data.length === 0) return false;
      if (data.length < 3) return false;  // Not worth TOON for small arrays

      return this.hasUniformStructure(data);
    }

    // Objects with array values benefit from TOON
    if (typeof data === 'object' && !Array.isArray(data)) {
      const values = Object.values(data);
      return values.some(v =>
        Array.isArray(v) && v.length >= 3 && this.hasUniformStructure(v)
      );
    }

    return false;
  }

  /**
   * Check if array has uniform structure (same keys in all objects)
   */
  private static hasUniformStructure(arr: any[]): boolean {
    if (!arr.length || typeof arr[0] !== 'object') return false;

    const firstKeys = Object.keys(arr[0]).sort().join(',');

    return arr.every(item => {
      if (typeof item !== 'object' || item === null) return false;
      const keys = Object.keys(item).sort().join(',');
      return keys === firstKeys;
    });
  }

  /**
   * Convert data to markdown format
   */
  private static toMarkdown(data: any): string {
    if (Array.isArray(data)) {
      return this.arrayToMarkdown(data);
    }

    if (typeof data === 'object' && data !== null) {
      return this.objectToMarkdown(data);
    }

    return String(data);
  }

  /**
   * Convert array to markdown list
   */
  private static arrayToMarkdown(arr: any[]): string {
    const lines: string[] = [];

    for (const item of arr) {
      if (typeof item === 'object' && item !== null) {
        // For objects, show key fields
        const name = item.name || item.title || item.id || 'Item';
        const desc = item.description || item.desc || '';
        lines.push(`- **${name}**: ${desc}`);

        // Add additional properties as sub-items
        for (const [key, value] of Object.entries(item)) {
          if (!['name', 'title', 'id', 'description', 'desc'].includes(key)) {
            lines.push(`  - ${key}: ${value}`);
          }
        }
      } else {
        lines.push(`- ${item}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert object to markdown sections
   */
  private static objectToMarkdown(obj: any): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const heading = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
      lines.push(`## ${heading}\n`);

      if (Array.isArray(value)) {
        lines.push(this.arrayToMarkdown(value));
      } else if (typeof value === 'object' && value !== null) {
        lines.push(this.objectToMarkdown(value));
      } else {
        lines.push(String(value));
      }

      lines.push('');  // Empty line between sections
    }

    return lines.join('\n');
  }

  /**
   * Estimate token count for encoded data
   * Rough estimate: 1 token per 4 characters for English text
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Compare token efficiency between formats
   */
  static compareFormats(data: any): {
    toon: number;
    json: number;
    markdown: number;
    savings: string;
  } {
    const toonText = this.encode(data, 'toon');
    const jsonText = this.encode(data, 'json');
    const markdownText = this.encode(data, 'markdown');

    const toonTokens = this.estimateTokens(toonText);
    const jsonTokens = this.estimateTokens(jsonText);
    const markdownTokens = this.estimateTokens(markdownText);

    const savings = jsonTokens > 0
      ? ((jsonTokens - toonTokens) / jsonTokens * 100).toFixed(1) + '%'
      : '0%';

    return {
      toon: toonTokens,
      json: jsonTokens,
      markdown: markdownTokens,
      savings,
    };
  }
}

/**
 * Helper function for quick TOON encoding with fallback
 */
export function encodeTOON(data: any): string {
  return DataEncoder.encode(data, 'toon');
}

/**
 * Helper to create TOON-optimized data structures
 */
export function optimizeForTOON(data: any): any {
  // If it's an array of objects, ensure consistent keys
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    // Get all unique keys
    const allKeys = new Set<string>();
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => allKeys.add(key));
      }
    });

    // Ensure all objects have all keys (with null for missing)
    return data.map(item => {
      const normalized: any = {};
      allKeys.forEach(key => {
        normalized[key] = item[key] ?? null;
      });
      return normalized;
    });
  }

  return data;
}