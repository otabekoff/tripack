// ─────────────────────────────────────────────────────────────────────────────
// parser.ts — AST-based import/export extractor
//
// Uses acorn (the same parser that powers ESLint and Babel's compat layer) to
// produce a concrete syntax tree, then walks it to collect every import, export
// and require() call in the file.
// ─────────────────────────────────────────────────────────────────────────────

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import type {
    ParseResult,
    ImportRecord,
    ImportSpecifier,
    ExportRecord,
    RequireRecord,
} from './types.js';

// acorn's Node type is very loose — we cast to `any` for specific node shapes
type AnyNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Parse `code` and extract all static imports, exports, and require() calls. */
export function parse(code: string): { ast: acorn.Node; result: ParseResult } {
    let ast: acorn.Node;

    try {
        ast = acorn.parse(code, {
            ecmaVersion: 2022,
            sourceType: 'module',
            // Preserve locations so we can do source-accurate replacements
            locations: true,
        });
    } catch (err: any) {
        // Rethrow with a friendlier message
        throw new Error(`Parse error: ${err.message}`);
    }

    const result: ParseResult = {
        imports: [],
        exports: [],
        requires: [],
    };

    walk.simple(ast, {
        // ── import declarations ──────────────────────────────────────────────────
        ImportDeclaration(node: AnyNode) {
            const specifiers: ImportSpecifier[] = node.specifiers.map((s: AnyNode): ImportSpecifier => {
                switch (s.type) {
                    case 'ImportDefaultSpecifier':
                        return { local: s.local.name, imported: 'default' };
                    case 'ImportNamespaceSpecifier':
                        return { local: s.local.name, imported: '*' };
                    default:
                        // ImportSpecifier: import { foo as bar }
                        return {
                            local: s.local.name,
                            imported: s.imported.name,
                        };
                }
            });

            result.imports.push({
                source: node.source.value as string,
                specifiers,
                start: node.start as number,
                end: node.end as number,
            });
        },

        // ── export default ───────────────────────────────────────────────────────
        ExportDefaultDeclaration(node: AnyNode) {
            const decl = node.declaration;
            const hasId = decl.id != null; // function foo(){} / class Foo {}

            result.exports.push({
                kind: 'default',
                names: ['default'],
                localNames: [hasId ? (decl.id.name as string) : '__default'],
                hasDeclaration: true,
                declarationStart: decl.start as number,
                declarationKind: decl.type === 'FunctionDeclaration' ? 'function' : 'class',
                start: node.start as number,
                end: node.end as number,
            });
        },

        // ── export named & re-exports ────────────────────────────────────────────
        ExportNamedDeclaration(node: AnyNode) {
            // Case 1: export { a, b as c } from './mod'  → re-export
            if (node.source) {
                const names: string[] = [];
                const localNames: string[] = [];
                for (const s of node.specifiers) {
                    names.push(s.exported.name as string);
                    localNames.push(s.local.name as string);
                }
                result.exports.push({
                    kind: 'reexport-named',
                    names,
                    localNames,
                    reexportSource: node.source.value as string,
                    hasDeclaration: false,
                    start: node.start as number,
                    end: node.end as number,
                });
                return;
            }

            // Case 2: export const/let/var/function/class foo = ...
            if (node.declaration) {
                const decl = node.declaration;
                const names: string[] = [];

                if (decl.type === 'VariableDeclaration') {
                    for (const declarator of decl.declarations) {
                        // Handle destructuring: export const { a, b } = obj
                        collectPatternNames(declarator.id, names);
                    }
                    result.exports.push({
                        kind: 'named-declaration',
                        names,
                        localNames: [...names],
                        hasDeclaration: true,
                        declarationStart: decl.start as number,
                        declarationKind: decl.kind as string,
                        start: node.start as number,
                        end: node.end as number,
                    });
                } else {
                    // FunctionDeclaration or ClassDeclaration
                    const name = decl.id?.name as string;
                    result.exports.push({
                        kind: 'named-declaration',
                        names: [name],
                        localNames: [name],
                        hasDeclaration: true,
                        declarationStart: decl.start as number,
                        declarationKind: decl.type === 'FunctionDeclaration' ? 'function' : 'class',
                        start: node.start as number,
                        end: node.end as number,
                    });
                }
                return;
            }

            // Case 3: export { foo, bar as baz }
            const names: string[] = [];
            const localNames: string[] = [];
            for (const s of node.specifiers) {
                names.push(s.exported.name as string);
                localNames.push(s.local.name as string);
            }
            result.exports.push({
                kind: 'named-specifiers',
                names,
                localNames,
                hasDeclaration: false,
                start: node.start as number,
                end: node.end as number,
            });
        },

        // ── export * from './mod' ────────────────────────────────────────────────
        ExportAllDeclaration(node: AnyNode) {
            result.exports.push({
                kind: 'reexport-all',
                names: [],
                localNames: [],
                reexportSource: node.source.value as string,
                hasDeclaration: false,
                start: node.start as number,
                end: node.end as number,
            });
        },

        // ── require() calls (CJS interop) ────────────────────────────────────────
        CallExpression(node: AnyNode) {
            if (
                node.callee.type === 'Identifier' &&
                node.callee.name === 'require' &&
                node.arguments.length === 1 &&
                node.arguments[0].type === 'Literal' &&
                typeof node.arguments[0].value === 'string'
            ) {
                const rec: RequireRecord = {
                    source: node.arguments[0].value as string,
                    start: node.start as number,
                    end: node.end as number,
                };
                // Avoid duplicates from nested walks
                if (!result.requires.some(r => r.start === rec.start)) {
                    result.requires.push(rec);
                }
            }
        },
    });

    return { ast, result };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Recursively collect binding names from a destructuring pattern */
function collectPatternNames(node: AnyNode, out: string[]): void {
    if (!node) return;
    switch (node.type) {
        case 'Identifier':
            out.push(node.name as string);
            break;
        case 'ObjectPattern':
            for (const prop of node.properties) {
                collectPatternNames(prop.value ?? prop, out);
            }
            break;
        case 'ArrayPattern':
            for (const el of node.elements) {
                if (el) collectPatternNames(el, out);
            }
            break;
        case 'RestElement':
            collectPatternNames(node.argument, out);
            break;
        case 'AssignmentPattern':
            collectPatternNames(node.left, out);
            break;
    }
}