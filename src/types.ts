// ─────────────────────────────────────────────────────────────────────────────
// types.ts — Core type definitions for tripack
// ─────────────────────────────────────────────────────────────────────────────

/** A resolved module in the dependency graph */
export interface Module {
    /** Absolute resolved file path — used as the unique module ID */
    id: string;
    /** Raw source code */
    code: string;
    /** Source code after ESM → CJS transformation */
    transformed: string;
    /** Absolute paths of direct dependencies */
    dependencies: string[];
    /** Map from the raw import specifier to the resolved absolute path */
    dependencyMap: Record<string, string>;
    /** All exported binding names */
    exports: string[];
    /** Exports that are actually imported by other modules (for tree-shaking) */
    usedExports: Set<string>;
}

/** A single import declaration parsed from source */
export interface ImportRecord {
    /** The raw module specifier string: './utils', 'lodash', etc. */
    source: string;
    specifiers: ImportSpecifier[];
    /** Start offset in the source string */
    start: number;
    /** End offset in the source string */
    end: number;
}

export interface ImportSpecifier {
    /** Local binding name in this module */
    local: string;
    /** The name being imported: 'default', '*', or a named export */
    imported: string;
}

/** A single export declaration parsed from source */
export interface ExportRecord {
    kind: 'default' | 'named-declaration' | 'named-specifiers' | 'reexport-named' | 'reexport-all';
    /** Exported names (empty for reexport-all) */
    names: string[];
    /** Local binding names parallel to `names` */
    localNames: string[];
    /** Source module for re-exports */
    reexportSource?: string;
    /** Whether the export includes an inline declaration (const/function/class) */
    hasDeclaration: boolean;
    /** Start of the declaration keyword, if hasDeclaration is true */
    declarationStart?: number;
    /** 'const'|'let'|'var'|'function'|'class' */
    declarationKind?: string;
    start: number;
    end: number;
}

/** Output of the AST parser for one module */
export interface ParseResult {
    imports: ImportRecord[];
    exports: ExportRecord[];
    /** require() calls found (CJS interop) */
    requires: RequireRecord[];
}

export interface RequireRecord {
    source: string;
    start: number;
    end: number;
}

/** Final options passed to the bundler */
export interface BundleOptions {
    /** Entry point (absolute path) */
    entry: string;
    /** Output file path */
    outFile: string;
    /** Remove dead code by analysing used exports */
    treeShake?: boolean;
    /** Print detailed logs */
    verbose?: boolean;
}

/** Stats returned after a successful build */
export interface BuildResult {
    /** Absolute path to the output file */
    outFile: string;
    /** Number of modules bundled */
    moduleCount: number;
    /** Raw size of the bundle in bytes */
    size: number;
    /** Wall-clock time in milliseconds */
    elapsed: number;
    /** Bytes eliminated by tree-shaking */
    treeShakenBytes?: number;
}