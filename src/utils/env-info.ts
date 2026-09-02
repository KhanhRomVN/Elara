/**
 * ------------------------------------------------------------------
 * Environment Info
 * ------------------------------------------------------------------
 * Phát hiện runtime environment hiện tại.
 * Phân biệt giữa npm package mode và standalone mode (dev, binary, bundle).
 *
 * Main exports:
 * - getEnvInfo()   : Lấy thông tin environment
 * - envInfo        : Singleton instance
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import path from 'path';

// ─── Functions ──────────────────────────────────────────────────────────

export const getEnvInfo = () => {
  const isBinary = !!(process as any).pkg;
  const isDev =
    process.env.NODE_ENV === 'development' || __filename.endsWith('.ts');

  const isNpmPackage =
    !isDev && !isBinary && __dirname.includes('node_modules');

  return {
    isNpmPackage,
    isStandalone: !isNpmPackage,
    isBinary,
    isDev,
    getMode: () => (isNpmPackage ? 'npm-package' : 'standalone'),
    baseDir: path.resolve(__dirname, isDev ? '../..' : '..'),
  };
};

export const envInfo = getEnvInfo();