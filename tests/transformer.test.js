import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { generateBundle } from "../dist/codegen.js";
import { transform } from "../dist/transformer.js";

test("transform default import interop works for bundled ESM default export", () => {
    const depId = "/virtual/dep.js";
    const entryId = "/virtual/index.js";

    const depModule = {
        id: depId,
        code: "export default function greet(name) { return `hello ${name}`; }",
        transformed: "",
        dependencies: [],
        dependencyMap: {},
        exports: ["default"],
        usedExports: new Set(),
    };

    const entryModule = {
        id: entryId,
        code: "import greet from './dep.js';\nexport const value = greet('world');",
        transformed: "",
        dependencies: [depId],
        dependencyMap: {
            "./dep.js": depId,
        },
        exports: ["value"],
        usedExports: new Set(),
    };

    transform(depModule);
    transform(entryModule);

    assert.match(
        entryModule.transformed,
        /Object\.prototype\.hasOwnProperty\.call/,
    );

    const bundleCode = generateBundle([depModule, entryModule], entryModule);
    const entryExports = vm.runInNewContext(bundleCode, {});

    assert.equal(entryExports.value, "hello world");
});
