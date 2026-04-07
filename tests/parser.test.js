import test from "node:test";
import assert from "node:assert/strict";

import { parse } from "../dist/parser.js";

test("parse extracts import, export, and require records", () => {
    const code = [
        "import defaultValue, { named as alias } from './dep.js';",
        "import * as ns from './ns.js';",
        "import './side.js';",
        "",
        "export const a = 1, b = 2;",
        "const local = 3;",
        "export { local as c };",
        "export { ext as reExt } from './re.js';",
        "export * from './all.js';",
        "export default function greet() { return 'hi'; }",
        "const cfg = require('./cfg.js');",
        "void cfg;",
    ].join("\n");

    const { result } = parse(code);

    assert.equal(result.imports.length, 3);

    const depImport = result.imports.find(
        (record) => record.source === "./dep.js",
    );
    assert.ok(depImport);
    assert.deepEqual(depImport.specifiers, [
        { local: "defaultValue", imported: "default" },
        { local: "alias", imported: "named" },
    ]);

    const namespaceImport = result.imports.find(
        (record) => record.source === "./ns.js",
    );
    assert.ok(namespaceImport);
    assert.deepEqual(namespaceImport.specifiers, [
        { local: "ns", imported: "*" },
    ]);

    const sideEffectImport = result.imports.find(
        (record) => record.source === "./side.js",
    );
    assert.ok(sideEffectImport);
    assert.deepEqual(sideEffectImport.specifiers, []);

    const namedDeclaration = result.exports.find(
        (record) =>
            record.kind === "named-declaration" && record.names.includes("a"),
    );
    assert.ok(namedDeclaration);
    assert.deepEqual(namedDeclaration.names, ["a", "b"]);

    const namedSpecifiers = result.exports.find(
        (record) => record.kind === "named-specifiers",
    );
    assert.ok(namedSpecifiers);
    assert.deepEqual(namedSpecifiers.names, ["c"]);
    assert.deepEqual(namedSpecifiers.localNames, ["local"]);

    const reexportNamed = result.exports.find(
        (record) => record.kind === "reexport-named",
    );
    assert.ok(reexportNamed);
    assert.equal(reexportNamed.reexportSource, "./re.js");
    assert.deepEqual(reexportNamed.names, ["reExt"]);
    assert.deepEqual(reexportNamed.localNames, ["ext"]);

    const reexportAll = result.exports.find(
        (record) => record.kind === "reexport-all",
    );
    assert.ok(reexportAll);
    assert.equal(reexportAll.reexportSource, "./all.js");

    const defaultExport = result.exports.find(
        (record) => record.kind === "default",
    );
    assert.ok(defaultExport);
    assert.deepEqual(defaultExport.localNames, ["greet"]);

    assert.equal(result.requires.length, 1);
    assert.equal(result.requires[0].source, "./cfg.js");
});
