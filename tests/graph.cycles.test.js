import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildGraph } from "../dist/graph.js";

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

test("buildGraph detects cycles and logs warning in verbose mode", () => {
    withTempDir("tripack-cycle-", (tmpDir) => {
        const entryPath = path.join(tmpDir, "src", "index.js");
        const aPath = path.join(tmpDir, "src", "a.js");
        const bPath = path.join(tmpDir, "src", "b.js");

        writeFile(entryPath, "import './a.js';\n");
        writeFile(aPath, "import './b.js';\nexport const a = 1;\n");
        writeFile(bPath, "import './a.js';\nexport const b = 2;\n");

        const warnings = [];
        const originalWarn = console.warn;
        console.warn = (...args) => {
            warnings.push(args.join(" "));
        };

        try {
            const result = buildGraph(entryPath, true);
            assert.ok(result.cycles.length > 0);
        } finally {
            console.warn = originalWarn;
        }

        assert.ok(
            warnings.some((line) => line.includes("Circular dependency detected")),
        );
    });
});
