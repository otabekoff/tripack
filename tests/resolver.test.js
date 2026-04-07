import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildGraph } from "../dist/graph.js";
import { resolve } from "../dist/resolver.js";

function withTempDir(prefix, callback) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    try {
        return callback(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
}

test("resolve returns absolute path for relative imports", () => {
    withTempDir("tripack-resolve-", (tmpDir) => {
        const entryPath = path.join(tmpDir, "src", "index.js");
        const depPath = path.join(tmpDir, "src", "dep.js");

        writeFile(entryPath, "import './dep.js';\n");
        writeFile(depPath, "export const value = 1;\n");

        const resolved = resolve("./dep.js", entryPath, tmpDir);

        assert.equal(path.isAbsolute(resolved), true);
        assert.equal(resolved, depPath);
    });
});

test("resolve keeps builtin specifiers unchanged", () => {
    withTempDir("tripack-resolve-", (tmpDir) => {
        const entryPath = path.join(tmpDir, "src", "index.js");
        writeFile(entryPath, "");

        const resolved = resolve("node:path", entryPath, tmpDir);
        assert.equal(resolved, "node:path");
    });
});

test("buildGraph includes absolute dependencies (windows path regression guard)", () => {
    withTempDir("tripack-graph-", (tmpDir) => {
        const entryPath = path.join(tmpDir, "src", "index.js");
        const depPath = path.join(tmpDir, "src", "dep.js");

        writeFile(
            entryPath,
            "import { value } from './dep.js';\nconsole.log(value);\n",
        );
        writeFile(depPath, "export const value = 42;\n");

        const graph = buildGraph(entryPath, false);
        const entryModule = graph.modules.find(
            (moduleRecord) => moduleRecord.id === entryPath,
        );

        assert.ok(entryModule);
        assert.equal(graph.modules.length, 2);
        assert.deepEqual(entryModule.dependencies, [depPath]);
        assert.equal(path.isAbsolute(entryModule.dependencies[0]), true);
    });
});
