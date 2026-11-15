import assert from "node:assert/strict";
import { norm, isSaved, toggleSaved, removeSaved, MAX_SAVED } from "../src/savedLogic.js";

assert.equal(norm("  Which   Category? "), "which category?");
assert.equal(norm(null), "");

let list = [];
let r = toggleSaved(list, { question: "  Why did revenue drop?  " });
assert.equal(r.list.length, 1);
assert.equal(r.list[0].question, "Why did revenue drop?");
list = r.list;
assert.ok(isSaved(list, "why   did REVENUE drop?"));

r = toggleSaved(list, { question: "why did revenue drop?" });
assert.equal(r.list.length, 0);

assert.ok(toggleSaved([], { question: "   " }).error);

list = [];
for (let i = 0; i < MAX_SAVED; i++) list = toggleSaved(list, { question: "q" + i }).list;
assert.equal(list.length, MAX_SAVED);
r = toggleSaved(list, { question: "overflow" });
assert.ok(r.error);
assert.equal(r.list.length, MAX_SAVED);

assert.equal(removeSaved(list, "q0").length, MAX_SAVED - 1);
console.log("saved checks passed");