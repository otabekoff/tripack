import * as a from "./a.js";

export function getBName() {
    return "module-b";
}

export function readA() {
    return a.getAName();
}
