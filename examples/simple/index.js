// examples/simple/index.js

import greet, { add, subtract, PI } from "./utils.js";

const message = greet("tripack");
console.log(message);
console.log(`add(2, 3)      = ${add(2, 3)}`);
console.log(`subtract(10,4) = ${subtract(10, 4)}`);
console.log(`PI             = ${PI}`);
