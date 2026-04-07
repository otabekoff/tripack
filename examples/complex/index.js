// examples/complex/index.js
// Imports from multiple modules, including a barrel/re-export file

import { factorial, fibonacci, isPrime, GOLDEN_RATIO } from "./math.js";
import { camelToSnake, truncate } from "./string.js";
import { VERSION, APP_NAME, capitalize } from "./config.js";

console.log(`\n=== ${APP_NAME} v${VERSION} ===\n`);

// Math
console.log(`factorial(10)   = ${factorial(10)}`);
console.log(`fibonacci(15)   = ${fibonacci(15)}`);
console.log(`isPrime(97)     = ${isPrime(97)}`);
console.log(`isPrime(100)    = ${isPrime(100)}`);
console.log(`GOLDEN_RATIO    = ${GOLDEN_RATIO}`);

// String
console.log(`\ncamelToSnake    = ${camelToSnake("helloWorldFoo")}`);
console.log(
    `truncate        = ${truncate("This is a very long string that should be truncated", 30)}`,
);
console.log(`capitalize      = ${capitalize("tripack is awesome")}`);
