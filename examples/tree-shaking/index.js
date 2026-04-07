// examples/tree-shaking/index.js
// Intentionally imports only a subset of library exports.

import { usedFunction, USED_CONSTANT } from "./library.js";

console.log("=== Tree-shaking demo ===");
console.log(usedFunction());
console.log(`USED_CONSTANT = ${USED_CONSTANT}`);
