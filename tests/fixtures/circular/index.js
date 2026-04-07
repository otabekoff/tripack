import { readB } from "./a.js";
import { readA } from "./b.js";

console.log(`A sees ${readB()}`);
console.log(`B sees ${readA()}`);
