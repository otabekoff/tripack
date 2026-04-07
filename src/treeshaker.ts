// ─────────────────────────────────────────────────────────────────────────────
// treeshaker.ts — Dead code elimination via export-usage analysis
//
// Tree-shaking in its full form requires a complete scope analysis and
// side-effect proof, which is complex.  tripack implements the foundational
// algorithm:
//
//   Phase 1 — Mark  : Walk every module's imports.  Each imported name marks
//                      the corresponding export in the source module as "used".
//                      Repeat until no new exports are marked (fixed-point).
//
//   Phase 2 — Sweep : Re-transform modules, wrapping unused named exports in
//                      a special comment so they are clearly elided.
//
// This correctly handles:
//   • Direct named imports:  import { foo } from './math'
//   • Namespace imports:     import * as ns from './math'  (marks ALL exports)
//   • Re-exports:            export { foo } from './math'
//   • Default imports/exports
//
// It does NOT handle intra-module side-effect analysis (that requires a full
// call graph), so exports whose initializers have side effects are kept.
// ─────────────────────────────────────────────────────────────────────────────

import { parse } from './parser.js';
import type { Module } from './types.js';

/**
 * Analyse the dependency graph and populate `mod.usedExports` for every module.
 * Returns the total number of exports marked as dead (unused).
 */
export function treeShake(modules: Module[], entry: Module): number {
    const moduleById = new Map(modules.map(m => [m.id, m]));

    // ── Phase 1: Mark ─────────────────────────────────────────────────────────
    // Always mark the entry module as fully used (its top-level side effects run)
    entry.usedExports = new Set(entry.exports);

    let changed = true;
    while (changed) {
        changed = false;

        for (const mod of modules) {
            const { result: { imports, exports } } = parse(mod.code);

            for (const imp of imports) {
                const resolved = mod.dependencyMap[imp.source];
                if (!resolved) continue;

                const dep = moduleById.get(resolved);
                if (!dep) continue;

                // Namespace import: import * as ns → all exports are used
                if (imp.specifiers.some(s => s.imported === '*')) {
                    for (const name of dep.exports) {
                        if (!dep.usedExports.has(name)) {
                            dep.usedExports.add(name);
                            changed = true;
                        }
                    }
                    continue;
                }

                for (const spec of imp.specifiers) {
                    const importedName = spec.imported; // 'default', or a named export
                    if (!dep.usedExports.has(importedName)) {
                        dep.usedExports.add(importedName);
                        changed = true;
                    }
                }
            }

            // Re-exports also count as "uses" of the source module's exports
            for (const exp of exports) {
                if (!exp.reexportSource) continue;

                const resolved = mod.dependencyMap[exp.reexportSource];
                if (!resolved) continue;

                const dep = moduleById.get(resolved);
                if (!dep) continue;

                if (exp.kind === 'reexport-all') {
                    for (const name of dep.exports) {
                        if (!dep.usedExports.has(name)) {
                            dep.usedExports.add(name);
                            changed = true;
                        }
                    }
                } else {
                    for (const localName of exp.localNames) {
                        if (!dep.usedExports.has(localName)) {
                            dep.usedExports.add(localName);
                            changed = true;
                        }
                    }
                }
            }
        }
    }

    // ── Phase 2: Count dead exports ───────────────────────────────────────────
    let deadCount = 0;
    for (const mod of modules) {
        for (const name of mod.exports) {
            if (!mod.usedExports.has(name)) {
                deadCount++;
            }
        }
    }

    return deadCount;
}

/**
 * Remove unused export assignments from an already-transformed module.
 *
 * After transformation, unused exports look like:
 *   exports.unusedFn = unusedFn;
 *
 * We rewrite them to:
 *   /* treeshaken: unusedFn *\/
 *
 * This keeps line numbers intact for debugging while clearly marking
 * dead code.  A production bundler would also remove the declaration
 * itself (requires scope analysis).
 */
export function sweepUnusedExports(mod: Module): number {
    if (mod.usedExports.size === 0 && mod.exports.length === 0) return 0;

    let sweptBytes = 0;
    let result = mod.transformed;

    for (const name of mod.exports) {
        if (mod.usedExports.has(name)) continue; // still needed

        // Match the export assignment line we generated in transformer.ts
        const pattern = new RegExp(
            `;\nexports\\.${escapeRegex(name)}\\s*=\\s*${escapeRegex(name)}`,
            'g',
        );

        result = result.replace(pattern, (match) => {
            sweptBytes += match.length;
            return `; /* treeshaken: ${name} */`;
        });
    }

    mod.transformed = result;
    return sweptBytes;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}