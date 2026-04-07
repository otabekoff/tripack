// ─────────────────────────────────────────────────────────────────────────────
// graph.ts — Dependency graph construction
//
// Performs a depth-first traversal starting at the entry module, resolving
// every import/require along the way.  Cycle detection is included — cycles
// are allowed (like webpack) but logged as warnings.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { parse } from './parser.js';
import { resolve } from './resolver.js';
import type { Module, ParseResult } from './types.js';

export interface GraphResult {
    /** Ordered list of modules (entry first, leaves last — post-order DFS) */
    modules: Module[];
    /** entry Module */
    entry: Module;
    /** Detected circular dependency chains (informational) */
    cycles: string[][];
}

/**
 * Build the complete dependency graph for `entryPath`.
 *
 * Internally uses an iterative DFS with an explicit stack to avoid
 * call-stack overflows on deep dependency trees.
 */
export function buildGraph(entryPath: string, verbose = false): GraphResult {
    const rootDir = path.dirname(entryPath);

    /** All visited modules, keyed by resolved absolute path */
    const moduleMap = new Map<string, Module>();

    /** Track the current DFS path for cycle detection */
    const visitStack: string[] = [];
    const visiting = new Set<string>(); // modules currently on the stack
    const cycles: string[][] = [];

    function visit(filePath: string): Module {
        // ── already processed ──────────────────────────────────────────────────
        if (moduleMap.has(filePath)) return moduleMap.get(filePath)!;

        // ── cycle detection ────────────────────────────────────────────────────
        if (visiting.has(filePath)) {
            const cycleStart = visitStack.indexOf(filePath);
            const cycle = [...visitStack.slice(cycleStart), filePath];
            cycles.push(cycle);
            if (verbose) {
                console.warn(`⚠  Circular dependency detected:\n   ${cycle.join(' → ')}`);
            }
            // Return a placeholder to break the cycle; it will be filled on the
            // way back up the recursion.
            return createPlaceholder(filePath);
        }

        // ── read & parse source ────────────────────────────────────────────────
        let code: string;
        try {
            code = fs.readFileSync(filePath, 'utf8');
        } catch {
            throw new Error(`Cannot read file: ${filePath}`);
        }

        let parseResult: ParseResult;
        try {
            ({ result: parseResult } = parse(code));
        } catch (err: any) {
            throw new Error(`${err.message}\n  in file: ${filePath}`);
        }

        // ── collect all raw specifiers ─────────────────────────────────────────
        const allSpecifiers = [
            ...parseResult.imports.map(i => i.source),
            ...parseResult.requires.map(r => r.source),
            ...parseResult.exports
                .filter(e => e.reexportSource)
                .map(e => e.reexportSource!),
        ];

        // ── create module stub (before recursing, to handle self-cycles) ───────
        const mod: Module = {
            id: filePath,
            code,
            transformed: '', // filled by transformer later
            dependencies: [],
            dependencyMap: {},
            exports: parseResult.exports.flatMap(e => e.names),
            usedExports: new Set(),
        };

        visiting.add(filePath);
        visitStack.push(filePath);
        moduleMap.set(filePath, mod);

        // ── resolve & recurse into dependencies ───────────────────────────────
        for (const spec of allSpecifiers) {
            let resolved: string;
            try {
                resolved = resolve(spec, filePath, rootDir);
            } catch (err: any) {
                throw err; // propagate resolution errors
            }

            // Skip Node builtins (no file to bundle)
            // Use path.isAbsolute for cross-platform behavior (Windows + POSIX).
            if (!path.isAbsolute(resolved)) {
                mod.dependencyMap[spec] = resolved;
                continue;
            }

            mod.dependencyMap[spec] = resolved;
            if (!mod.dependencies.includes(resolved)) {
                mod.dependencies.push(resolved);
            }

            visit(resolved);
        }

        visiting.delete(filePath);
        visitStack.pop();

        if (verbose) {
            console.log(`  parsed  ${path.relative(rootDir, filePath)}  (${mod.dependencies.length} deps)`);
        }

        return mod;
    }

    const entry = visit(entryPath);

    // ── topological sort (post-order DFS) ────────────────────────────────────
    // Webpack executes modules in dependency order — leaves first, entry last.
    const ordered: Module[] = [];
    const seen = new Set<string>();

    function topoVisit(mod: Module): void {
        if (seen.has(mod.id)) return;
        seen.add(mod.id);
        for (const depPath of mod.dependencies) {
            const dep = moduleMap.get(depPath);
            if (dep) topoVisit(dep);
        }
        ordered.push(mod);
    }

    topoVisit(entry);

    return { modules: ordered, entry, cycles };
}

// ── private ───────────────────────────────────────────────────────────────────

function createPlaceholder(filePath: string): Module {
    return {
        id: filePath,
        code: '',
        transformed: '',
        dependencies: [],
        dependencyMap: {},
        exports: [],
        usedExports: new Set(),
    };
}