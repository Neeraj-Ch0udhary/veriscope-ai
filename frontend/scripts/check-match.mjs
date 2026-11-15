import assert from "node:assert/strict";
import { sameNumber, flagged, findSource, splitText } from "../src/evidenceMatch.js";

const ev = [{
  id: "s1", tool: "group_aggregate",
  data: { rows: [{ category: "Electronics", share_pct: 41.8357 }] },
  evidence: { formula: "sum(revenue) grouped by category", rows_used: 5913 },
}];

assert.ok(sameNumber("41.8357%", 41.8357));
assert.ok(sameNumber("41.84%", 41.8357));
assert.ok(!sameNumber("42%", 41.8357));
assert.ok(sameNumber("1,646,309.54", 1646309.54));
assert.ok(sameNumber("-8,941.25", 8941.25));
assert.ok(!sameNumber("15%", 41.8357));
assert.ok(flagged("15%", [15.0]));
assert.ok(!flagged("20.9592%", [15.0]));

const src = findSource("41.8357%", ev);
assert.equal(src.id, "s1");
assert.equal(src.path, "data.rows[0].share_pct");
assert.equal(src.rows, 5913);
assert.equal(findSource("15%", ev), null);

const nums = splitText("Revenue fell 20.9592% from 2025-02 to 2025-03").filter((p) => p.isNum).map((p) => p.text);
assert.deepEqual(nums, ["20.9592%"]);
console.log("matching checks passed");