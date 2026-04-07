import * as b from "./b.js";

export function getAName() {
    return "module-a";
}

export function readB() {
    return b.getBName();
}
