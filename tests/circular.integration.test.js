import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { bundle } from "../dist/bundler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("bundler handles circular dependency fixture at runtime", async () => {
    const fixtureEntry = path.join(
        __dirname,
        "fixtures",
        "circular",
        "index.js",
    );
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "tripack-circular-"));
    const outFile = path.join(outDir, "bundle.js");

    try {
        const result = await bundle({
            entry: fixtureEntry,
            outFile,
            verbose: false,
        });

        assert.equal(result.moduleCount, 3);

        const output = execFileSync(process.execPath, [outFile], {
            encoding: "utf8",
        });

        assert.match(output, /A sees module-b/);
        assert.match(output, /B sees module-a/);
    } finally {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
});
