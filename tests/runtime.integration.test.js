import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { bundle } from "../dist/bundler.js";

function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
}

test("bundle supports node builtin requires and moved output path", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tripack-runtime-"));
    const entryPath = path.join(tmpDir, "src", "index.js");
    const outFile = path.join(tmpDir, "dist", "bundle.js");

    writeFile(
        entryPath,
        "const path = require('node:path');\nconsole.log('builtin', path.basename('x/y/file.txt'));\n",
    );

    try {
        await bundle({ entry: entryPath, outFile, verbose: false });

        const bundleCode = fs.readFileSync(outFile, "utf8");
        const escapedTmpDir = tmpDir.replace(/\\/g, "\\\\");

        // Runtime IDs should no longer leak absolute source paths into the bundle.
        assert.equal(bundleCode.includes(tmpDir), false);
        assert.equal(bundleCode.includes(escapedTmpDir), false);

        const firstRun = execFileSync(process.execPath, [outFile], {
            encoding: "utf8",
        });
        assert.match(firstRun, /builtin file\.txt/);

        const movedPath = path.join(tmpDir, "moved", "bundle.js");
        fs.mkdirSync(path.dirname(movedPath), { recursive: true });
        fs.copyFileSync(outFile, movedPath);

        const movedRun = execFileSync(process.execPath, [movedPath], {
            encoding: "utf8",
        });
        assert.match(movedRun, /builtin file\.txt/);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
