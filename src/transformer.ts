// ─────────────────────────────────────────────────────────────────────────────
// transformer.ts — ESM → CJS transformation
//
// Takes a module's source code and its parsed import/export records and
// rewrites them to use the tripack runtime API (__require / exports).
//
// magic-string is used for non-destructive, position-accurate replacements
// that can later be combined into a source map.
// ─────────────────────────────────────────────────────────────────────────────

import MagicString from 'magic-string';
import { parse } from './parser.js';
import type { Module, ImportRecord, ExportRecord } from './types.js';

/**
 * Transform a single module's source from ESM to the tripack CJS-style format.
 * Mutates `mod.transformed`.
 */
export function transform(mod: Module): void {
    const { result: { imports, exports, requires } } = parse(mod.code);
    const s = new MagicString(mod.code);

    // Process nodes from the END of the file to the START so that character
    // offsets from the parser remain valid after each replacement.
    type Replacement = { start: number; end: number; text: string };
    const replacements: Replacement[] = [];

    // ── 1. Transform import declarations ─────────────────────────────────────
    for (const imp of imports) {
        replacements.push({
            start: imp.start,
            end: imp.end,
            text: transformImport(imp, mod.dependencyMap),
        });
    }

    // ── 2. Transform export declarations ─────────────────────────────────────
    // Group by start position: multiple ExportRecord entries can share the same
    // AST node (e.g. `export { a, b }` generates two records, one node).
    const exportsByStart = new Map<number, ExportRecord[]>();
    for (const exp of exports) {
        const list = exportsByStart.get(exp.start) ?? [];
        list.push(exp);
        exportsByStart.set(exp.start, list);
    }

    for (const [, group] of exportsByStart) {
        const [first] = group;
        if (!first) continue;

        replacements.push({
            start: first.start,
            end: first.end,
            text: transformExport(group, mod.code, mod.dependencyMap),
        });
    }

    // ── 3. Rewrite require() paths ───────────────────────────────────────────
    for (const req of requires) {
        const resolved = mod.dependencyMap[req.source] ?? req.source;
        replacements.push({
            start: req.start,
            end: req.end,
            text: `__require(${JSON.stringify(resolved)})`,
        });
    }

    // ── Apply all replacements (largest start first = safest order) ───────────
    replacements.sort((a, b) => b.start - a.start);

    // De-duplicate: if two replacements start at the same offset keep only the
    // first (already sorted so that would be the larger one — fine for our use).
    const seen = new Set<number>();
    for (const r of replacements) {
        if (seen.has(r.start)) continue;
        seen.add(r.start);
        s.overwrite(r.start, r.end, r.text);
    }

    mod.transformed = s.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Import transformation helpers
// ─────────────────────────────────────────────────────────────────────────────

function transformImport(imp: ImportRecord, depMap: Record<string, string>): string {
    const resolved = depMap[imp.source] ?? imp.source;
    const requireExpr = `__require(${JSON.stringify(resolved)})`;

    // import './side-effects'
    if (imp.specifiers.length === 0) {
        return requireExpr;
    }

    const lines: string[] = [];
    // Use a unique temp variable name so multiple imports don't clash
    const tmpVar = uniqueVar(imp.source);
    lines.push(`const ${tmpVar} = ${requireExpr}`);

    const defaultSpec = imp.specifiers.find(s => s.imported === 'default');
    const namespaceSpec = imp.specifiers.find(s => s.imported === '*');
    const namedSpecs = imp.specifiers.filter(s => s.imported !== 'default' && s.imported !== '*');

    // import * as ns from './mod'
    if (namespaceSpec) {
        lines.push(`const ${namespaceSpec.local} = ${tmpVar}`);
    }

    // import defaultExport from './mod'
    if (defaultSpec) {
        // Handle both ESM (exports.default) and CJS (module.exports) sources
        lines.push(`const ${defaultSpec.local} = (${tmpVar} && Object.prototype.hasOwnProperty.call(${tmpVar}, 'default')) ? ${tmpVar}.default : ${tmpVar}`);
    }

    // import { foo, bar as baz } from './mod'
    if (namedSpecs.length > 0) {
        const destructure = namedSpecs
            .map(s => (s.imported === s.local ? s.local : `${s.imported}: ${s.local}`))
            .join(', ');
        lines.push(`const { ${destructure} } = ${tmpVar}`);
    }

    return lines.join(';\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Export transformation helpers
// ─────────────────────────────────────────────────────────────────────────────

function transformExport(
    group: ExportRecord[],
    code: string,
    depMap: Record<string, string>,
): string {
    const [first] = group;
    if (!first) {
        return '';
    }

    const declarationStart = first.declarationStart ?? first.start;
    const defaultLocalName = first.localNames[0] ?? '__default';

    switch (first.kind) {
        // ── export default value ────────────────────────────────────────────────
        case 'default': {
            const declCode = code.slice(declarationStart, first.end);

            // export default function foo() {} / export default class Foo {}
            // → function foo() {}; exports.default = foo;
            if (
                (first.declarationKind === 'function' || first.declarationKind === 'class') &&
                defaultLocalName !== '__default'
            ) {
                return `${declCode};\nexports.default = ${defaultLocalName}`;
            }

            // export default expr → exports.default = expr
            // Remove trailing semicolon from the original to avoid doubles
            const expr = declCode.replace(/;\s*$/, '');
            return `exports.default = ${expr}`;
        }

        // ── export const/function/class foo = ... ───────────────────────────────
        case 'named-declaration': {
            const declCode = code.slice(declarationStart, first.end);
            const assignments = first.names
                .map(name => `exports.${name} = ${name}`)
                .join(';\n');
            return `${declCode};\n${assignments}`;
        }

        // ── export { foo, bar as baz } ──────────────────────────────────────────
        case 'named-specifiers': {
            // All group members are from the same AST node, already have names/localNames
            const lines: string[] = [];
            for (const exp of group) {
                for (const [index, name] of exp.names.entries()) {
                    const localName = exp.localNames[index] ?? name;
                    lines.push(`exports.${name} = ${localName}`);
                }
            }
            return lines.join(';\n');
        }

        // ── export { a, b } from './mod' ────────────────────────────────────────
        case 'reexport-named': {
            const source = first.reexportSource;
            if (!source) return '';

            const resolved = depMap[source] ?? source;
            const tmpVar = uniqueVar(source);
            const lines = [`const ${tmpVar} = __require(${JSON.stringify(resolved)})`];
            for (const [index, name] of first.names.entries()) {
                const localName = first.localNames[index] ?? name;
                lines.push(`exports.${name} = ${tmpVar}.${localName}`);
            }
            return lines.join(';\n');
        }

        // ── export * from './mod' ────────────────────────────────────────────────
        case 'reexport-all': {
            const source = first.reexportSource;
            if (!source) return '';

            const resolved = depMap[source] ?? source;
            const tmpVar = uniqueVar(source);
            return [
                `const ${tmpVar} = __require(${JSON.stringify(resolved)})`,
                `Object.keys(${tmpVar}).forEach(function(k) {`,
                `  if (k !== 'default') exports[k] = ${tmpVar}[k];`,
                `})`,
            ].join(';\n');
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Derive a short, unique-enough variable name from a module specifier */
function uniqueVar(specifier: string): string {
    // './some-module/index' → '__mod_somemoduleindex'
    const slug = specifier
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/^_+/, '')
        .slice(0, 20);
    return `__mod_${slug}`;
}