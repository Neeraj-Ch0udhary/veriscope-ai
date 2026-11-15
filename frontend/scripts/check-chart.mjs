import assert from "node:assert/strict";
import { toArray, tableFor, switchOptions, currentType, retype, toCsv, fmtCell } from "../src/chartData.js";

const enc = (arr, dtype, Typed) => ({ dtype, bdata: Buffer.from(new Typed(arr).buffer).toString("base64") });
assert.deepEqual(toArray(enc([1.5, 2], "f8", Float64Array)), [1.5, 2]);
assert.deepEqual(toArray(enc([3, 4, 5], "i4", Int32Array)), [3, 4, 5]);
assert.deepEqual(toArray([1, 2]), [1, 2]);
assert.equal(toArray("nope"), null);

const bar = {
  data: [{ type: "bar", x: ["Electronics", "Furniture", "Clothing", "Groceries"], y: [8086154.42, 5967825, 3883976, 1390407] }],
  layout: { xaxis: { title: { text: "category" } }, yaxis: { title: "revenue (sum)" } },
};
let t = tableFor(bar);
assert.deepEqual(t.columns, ["category", "revenue (sum)"]);
assert.equal(t.rows.length, 4);
assert.deepEqual(t.rows[0], ["Electronics", 8086154.42]);

const enc2 = { data: [{ type: "scatter", mode: "lines", x: ["2025-01", "2025-02"], y: enc([10, 20], "f8", Float64Array) }], layout: {} };
t = tableFor(enc2);
assert.deepEqual(t.rows, [["2025-01", 10], ["2025-02", 20]]);
assert.deepEqual(t.columns, ["x", "value"]);

assert.equal(tableFor({ data: [{ type: "histogram", x: [1, 2, 3] }] }), null);
assert.equal(tableFor({ data: [] }), null);

t = tableFor({ data: [{ type: "pie", labels: ["a", "b"], values: [1, 2] }] });
assert.deepEqual(t.rows, [["a", 1], ["b", 2]]);

t = tableFor({ data: [{ type: "heatmap", x: ["u", "v"], y: ["p", "q"], z: [[1, 2], [3, 4]] }], layout: {} });
assert.equal(t.rows.length, 4);
assert.deepEqual(t.rows[1], ["p", "v", 2]);

const wide = tableFor({ data: [{ x: [1, 2], y: [3, 4], name: "A" }, { x: [1, 2], y: [5, 6], name: "B" }], layout: {} });
assert.deepEqual(wide.columns, ["x", "A", "B"]);
assert.deepEqual(wide.rows[0], [1, 3, 5]);

assert.deepEqual(switchOptions(bar), ["bar", "line", "pie"]);
assert.deepEqual(switchOptions({ data: [{ type: "bar", x: ["a", "b"], y: [1, -2] }] }), ["bar", "line"]);
assert.deepEqual(switchOptions({ data: [{ type: "scatter", mode: "markers", x: [1, 2], y: [1, 2] }] }), []);
assert.deepEqual(switchOptions({ data: [{ type: "bar", x: ["a", "b"], y: [1, 2], marker: { color: ["#1", "#2"] } }] }), []);
assert.deepEqual(switchOptions({ data: [{ type: "bar", x: ["a"], y: [1] }] }), []);
assert.deepEqual(switchOptions({ data: [bar.data[0], bar.data[0]] }), []);
assert.ok(switchOptions({ data: [{ type: "scatter", x: [1, 2, 3], y: [1, 2, 3] }] }).includes("line"));

assert.equal(currentType(bar), "bar");
const pie = retype(bar, "pie");
assert.equal(pie.data[0].type, "pie");
assert.deepEqual(pie.data[0].labels, ["Electronics", "Furniture", "Clothing", "Groceries"]);
assert.equal(retype(bar, "line").data[0].mode, "lines+markers");
assert.equal(currentType(retype(bar, "line")), "line");
assert.equal(retype(enc2, "bar").data[0].y[1], 20);

assert.equal(toCsv(["a", "b"], [["x,y", 1], ['q"r', -2]]), 'a,b\r\n"x,y",1\r\n"q""r",-2\r\n');
assert.equal(toCsv(["a"], [["=SUM(A1)"]]), "a\r\n'=SUM(A1)\r\n");
assert.equal(fmtCell(1234567), (1234567).toLocaleString());
assert.equal(fmtCell("2025-01-31T00:00:00"), "2025-01-31");
assert.equal(fmtCell(null), "");
console.log("chart data checks passed");