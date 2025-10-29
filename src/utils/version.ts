/**
 * Single source of truth for version information
 * Reads directly from package.json to avoid drift
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

let cachedVersion: string | null = null;

/**
 * Get the current version from package.json
 */
export function getVersion(): string {
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    const version: string = packageJson.version || '0.9.1';
    cachedVersion = version;
    return version;
  } catch (error) {
    // Fallback if package.json can't be read
    const fallback = '0.9.1';
    cachedVersion = fallback;
    return fallback;
  }
}

/**
 * Get User-Agent string for HTTP requests
 */
export function getUserAgent(): string {
  return `ic-mcp/${getVersion()}`;
}
