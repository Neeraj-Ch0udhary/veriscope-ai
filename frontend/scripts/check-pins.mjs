import assert from "node:assert/strict";
import { togglePin, removePin, statusInfo, MAX_PINS } from "../src/pinLogic.js";

let list = [];
let r = togglePin(list, { id: "r1:s1" });
assert.equal(r.list.length, 1);
list = r.list;

r = togglePin(list, { id: "r1:s1" });
assert.equal(r.list.length, 0);

for (let i = 0; i < MAX_PINS; i++) list = togglePin(list, { id: "a" + i }).list;
assert.equal(list.length, MAX_PINS);
r = togglePin(list, { id: "overflow" });
assert.ok(r.error);
assert.equal(r.list.length, MAX_PINS);

assert.equal(removePin(list, "a0").length, MAX_PINS - 1);
assert.deepEqual(statusInfo("partially_verified"), ["Partially verified", "warn"]);
assert.deepEqual(statusInfo("anything"), ["Unchecked", "warn"]);
console.log("pin checks passed");