// examples/tree-shaking/library.js
// A utility library with many exports.
// The entry point only uses TWO of them.
// With --tree-shake, the rest should be eliminated.

export function usedFunction() {
    return "I am used! 🟢";
}

export function unusedFunction1() {
    return "Nobody imports me 🔴";
}

export function unusedFunction2() {
    return "Dead code 🔴";
}

export function unusedFunction3() {
    return "Will be tree-shaken 🔴";
}

export const USED_CONSTANT = 42;

export const UNUSED_CONSTANT_1 = "forgotten";
export const UNUSED_CONSTANT_2 = "also forgotten";

export class UnusedClass {
    constructor() {
        this.name = "UnusedClass 🔴";
    }
}
