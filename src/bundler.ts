// ─────────────────────────────────────────────────────────────────────────────
// bundler.ts — High-level orchestrator
//
// Wires together: graph → transform → tree-shake → codegen → write
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { buildGraph } from './graph.js';
import { transform } from './transformer.js';
import { treeShake, sweepUnusedExports } from './treeshaker.js';
import { generateBundle } from './codegen.js';
import type { BundleOptions, BuildResult } from './types.js';

/**
 * Bundle `options.entry` and write the output to `options.outFile`.
 * Returns build statistics.
 */
export async function bundle(options: BundleOptions): Promise<BuildResult> {
    const t0 = performance.now();
    const { entry, outFile, treeShake: doTreeShake = false, verbose = false } = options;

    const absEntry = path.resolve(entry);

    // ── Step 1: Build dependency graph ───────────────────────────────────────
    if (verbose) console.log('\n📦 Building dependency graph…');
    const { modules, entry: entryMod, cycles } = buildGraph(absEntry, verbose);

    if (verbose) {
        console.log(`   ${modules.length} modules found`);
        if (cycles.length > 0) {
            console.log(`   ⚠  ${cycles.length} circular dependency chain(s) detected`);
        }
    }

    // ── Step 2: Transform ESM → CJS ──────────────────────────────────────────
    if (verbose) console.log('\n🔄 Transforming modules (ESM → CJS)…');
    for (const mod of modules) {
        transform(mod);
    }

    // ── Step 3: Tree-shaking (optional) ──────────────────────────────────────
    let treeShakenBytes = 0;
    if (doTreeShake) {
        if (verbose) console.log('\n🌳 Tree-shaking unused exports…');
        const deadExports = treeShake(modules, entryMod);

        for (const mod of modules) {
            treeShakenBytes += sweepUnusedExports(mod);
        }

        if (verbose) {
            console.log(`   ${deadExports} unused export(s) found`);
            console.log(`   ~${(treeShakenBytes / 1024).toFixed(2)} KB eliminated`);
        }
    }

    // ── Step 4: Generate bundle ───────────────────────────────────────────────
    if (verbose) console.log('\n⚙️  Generating bundle…');
    const bundleCode = generateBundle(modules, entryMod);

    // ── Step 5: Write output ──────────────────────────────────────────────────
    const absOut = path.resolve(outFile);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, bundleCode, 'utf8');

    const elapsed = performance.now() - t0;
    const size = Buffer.byteLength(bundleCode, 'utf8');

    const result: BuildResult = {
        outFile: absOut,
        moduleCount: modules.length,
        size,
        elapsed,
    };

    if (doTreeShake) {
        result.treeShakenBytes = treeShakenBytes;
    }

    return result;
}