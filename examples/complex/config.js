// examples/complex/config.js
// Demonstrates re-exports — a common real-world pattern

export { factorial, fibonacci } from "./math.js";
export { capitalize, slugify } from "./string.js";

export const VERSION = "0.1.1";
export const APP_NAME = "tripack-demo";
