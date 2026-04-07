// ─────────────────────────────────────────────────────────────────────────────
// resolver.ts — Module path resolution
//
// Mimics Node.js module resolution (LOAD_AS_FILE + LOAD_AS_DIRECTORY) but
// keeps it readable so you can see exactly what's happening at each step.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';

/** Extensions tried in order when no extension is specified */
const EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.json'];

/**
 * Resolve a module specifier to an absolute file path.
 *
 * @param specifier   The raw string from import/require: './foo', '../bar', 'lodash'
 * @param fromFile    Absolute path of the file that contains the import
 * @param rootDir     Project root (for bare specifiers / node_modules resolution)
 */
export function resolve(specifier: string, fromFile: string, rootDir: string): string {
    // ── 1. Relative / absolute specifier ──────────────────────────────────────
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
        const baseDir = path.dirname(fromFile);
        const abs = path.resolve(baseDir, specifier);
        return resolveFile(abs) ?? resolveDirectory(abs) ?? throwNotFound(specifier, fromFile);
    }

    // ── 2. Node.js built-ins (pass through unchanged) ─────────────────────────
    if (isBuiltin(specifier)) {
        return specifier; // we won't bundle builtins; just keep the require()
    }

    // ── 3. Bare specifier → walk up searching for node_modules ────────────────
    return resolveNodeModule(specifier, path.dirname(fromFile)) ?? throwNotFound(specifier, fromFile);
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Try to resolve `filePath` as a file, trying each extension in order.
 *
 * LOAD_AS_FILE algorithm:
 *   1. If X is a file → load X
 *   2. If X.js is a file → load X.js
 *   3. … (for each extension)
 */
function resolveFile(filePath: string): string | undefined {
    // Exact path
    if (isFile(filePath)) return filePath;

    // Try appending known extensions
    for (const ext of EXTENSIONS) {
        const candidate = filePath + ext;
        if (isFile(candidate)) return candidate;
    }

    return undefined;
}

/**
 * Try to resolve `dirPath` as a directory.
 *
 * LOAD_AS_DIRECTORY algorithm:
 *   1. Load package.json "main" field if present
 *   2. Otherwise try index.js / index.ts / etc.
 */
function resolveDirectory(dirPath: string): string | undefined {
    if (!isDirectory(dirPath)) return undefined;

    // Check package.json "main"
    const pkgPath = path.join(dirPath, 'package.json');
    if (isFile(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
            const main = (pkg.module ?? pkg.main) as string | undefined;
            if (main) {
                const mainPath = path.join(dirPath, main);
                const resolved = resolveFile(mainPath) ?? resolveDirectory(mainPath);
                if (resolved) return resolved;
            }
        } catch {
            // ignore malformed package.json
        }
    }

    // Try index files
    for (const ext of EXTENSIONS) {
        const candidate = path.join(dirPath, `index${ext}`);
        if (isFile(candidate)) return candidate;
    }

    return undefined;
}

/**
 * Walk up the directory tree looking for `node_modules/<specifier>`.
 *
 * Supports sub-path imports: 'lodash/fp' → node_modules/lodash/fp
 */
function resolveNodeModule(specifier: string, fromDir: string): string | undefined {
    // Split scope from path: '@scope/pkg/sub' → pkg dir = '@scope/pkg', subpath = 'sub'
    const parts = specifier.split('/');
    const pkgName = specifier.startsWith('@')
        ? parts.slice(0, 2).join('/')
        : (parts[0] ?? specifier);

    if (!pkgName) return undefined;

    const subPath = specifier.startsWith('@') ? parts.slice(2).join('/') : parts.slice(1).join('/');

    let dir = fromDir;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const nmDir = path.join(dir, 'node_modules', pkgName);

        if (isDirectory(nmDir)) {
            if (subPath) {
                // e.g. 'lodash/fp' → node_modules/lodash/fp.(js)
                const full = path.join(nmDir, subPath);
                const resolved = resolveFile(full) ?? resolveDirectory(full);
                if (resolved) return resolved;
            } else {
                const resolved = resolveDirectory(nmDir);
                if (resolved) return resolved;
            }
        }

        const parent = path.dirname(dir);
        if (parent === dir) break; // reached filesystem root
        dir = parent;
    }

    return undefined;
}

// ── Tiny FS helpers ───────────────────────────────────────────────────────────

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function isDirectory(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

// Node.js built-in module names (subset — enough for most projects)
const BUILTINS = new Set([
    'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
    'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https',
    'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys',
    'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm',
    'worker_threads', 'zlib',
    // node: prefix
    'node:fs', 'node:path', 'node:url', 'node:crypto', 'node:stream',
    'node:util', 'node:events', 'node:os', 'node:child_process', 'node:http',
    'node:https', 'node:buffer', 'node:process',
]);

function isBuiltin(specifier: string): boolean {
    return BUILTINS.has(specifier) || specifier.startsWith('node:');
}

function throwNotFound(specifier: string, fromFile: string): never {
    throw new Error(
        `Cannot resolve module '${specifier}'\n` +
        `  imported from: ${fromFile}`,
    );
}