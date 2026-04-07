# tripack

A minimal JavaScript bundler written in TypeScript.

tripack is designed to show the core ideas behind tools like webpack, Rollup, and esbuild in a small and readable codebase:

- Parse modules with AST traversal
- Resolve imports/requires to real files
- Build a dependency graph
- Transform ESM syntax to a runtime-compatible format
- Optionally tree-shake unused exports
- Generate a single runnable bundle

## Features

- ESM import/export parsing via `acorn` + `acorn-walk`
- Basic CommonJS interop for `require()` calls
- Relative, absolute, and `node_modules` resolution
- Circular dependency detection (reported, not blocked)
- Bundle runtime with module cache
- Optional export-level tree-shaking
- CLI with build stats and verbose mode

## Requirements

- Node.js 20+
- npm 9+

## Quick Start

```bash
npm install
npm run build
```

Run bundled examples:

```bash
npm run bundle:simple
node examples/simple/dist/bundle.js

npm run bundle:complex
node examples/complex/dist/bundle.js

npm run bundle:treeshake
node examples/tree-shaking/dist/bundle.js
```

## CLI Usage

After building TypeScript:

```bash
node dist/cli.js --entry <input-file> --out <output-file> [--tree-shake] [--verbose]
```

Install globally once published:

```bash
npm install -g tripack
tripack --entry src/index.js --out dist/bundle.js --tree-shake
```

## Project Structure

```text
src/
  cli.ts          # Command-line entry
  bundler.ts      # Orchestrates the full pipeline
  parser.ts       # AST import/export/require extraction
  resolver.ts     # Module path resolution
  graph.ts        # Dependency graph construction
  transformer.ts  # ESM -> runtime-compatible transform
  treeshaker.ts   # Mark-and-sweep export usage analysis
  codegen.ts      # Bundle runtime + module assembly
  types.ts        # Shared type definitions

examples/
  simple/         # Basic import/export usage
  complex/        # Re-exports and multiple modules
  tree-shaking/   # Unused export elimination demo
```

## Build Pipeline

```text
Entry file
  -> parser.ts        extract imports/exports/requires
  -> resolver.ts      resolve module specifiers
  -> graph.ts         build dependency graph
  -> transformer.ts   rewrite modules for runtime
  -> treeshaker.ts    mark/sweep unused exports (optional)
  -> codegen.ts       emit single-file bundle
```

## Publishing

Pre-publish checks:

```bash
npm test
npm pack --dry-run
```

Publish:

```bash
npm publish
```

## Notes and Limitations

- Tree-shaking is export-assignment based and intentionally conservative.
- This project is educational and prioritizes readability over advanced optimization.
- It is not a full replacement for production bundlers.

## License

MIT
