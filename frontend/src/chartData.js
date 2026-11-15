const DT = {
  i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array,
  i4: Int32Array, u4: Uint32Array, f4: Float32Array, f8: Float64Array,
};
const MAX_ROWS = 50000;

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toArray(v) {
  if (Array.isArray(v)) return v;
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (v && typeof v === "object" && typeof v.bdata === "string" && DT[v.dtype]) {
    const bytes = b64ToBytes(v.bdata);
    const T = DT[v.dtype];
    return Array.from(new T(bytes.buffer, 0, Math.floor(bytes.length / T.BYTES_PER_ELEMENT)));
  }
  return null;
}

function toMatrix(z) {
  if (Array.isArray(z) && Array.isArray(z[0])) return z.map((r) => toArray(r) || r);
  if (z && z.bdata && z.shape) {
    const flat = toArray(z);
    const [r, c] = String(z.shape).split(",").map((s) => parseInt(s, 10));
    if (!flat || !r || !c) return null;
    const rows = [];
    for (let i = 0; i < r; i++) rows.push(flat.slice(i * c, (i + 1) * c));
    return rows;
  }
  return null;
}

const axisTitle = (ax) => {
  const t = ax && ax.title;
  if (!t) return "";
  return typeof t === "string" ? t : t.text || "";
};

export function tableFor(figure) {
  const traces = (figure && figure.data) || [];
  if (!traces.length) return null;
  const lx = axisTitle(figure.layout && figure.layout.xaxis);
  const ly = axisTitle(figure.layout && figure.layout.yaxis);
  const t0 = traces[0];

  if (t0.type === "pie") {
    const labels = toArray(t0.labels);
    const values = toArray(t0.values);
    if (!labels || !values) return null;
    return { columns: ["label", "value"], rows: labels.map((l, i) => [l, values[i]]).slice(0, MAX_ROWS) };
  }

  if (t0.type === "heatmap") {
    const z = toMatrix(t0.z);
    const x = toArray(t0.x);
    const y = toArray(t0.y);
    if (!z || !x || !y) return null;
    const rows = [];
    z.forEach((r, i) => r.forEach((v, j) => rows.push([y[i], x[j], v])));
    return { columns: [ly || "row", lx || "column", "value"], rows: rows.slice(0, MAX_ROWS) };
  }

  const series = [];
  for (const t of traces) {
    const x = toArray(t.x);
    const y = toArray(t.y);
    if (!x || !y || !x.length || x.length !== y.length) return null;
    series.push({ name: t.name || "", x, y });
  }
  if (series.length === 1) {
    const s = series[0];
    return { columns: [lx || "x", ly || s.name || "value"], rows: s.x.map((x, i) => [x, s.y[i]]).slice(0, MAX_ROWS) };
  }
  const first = series[0];
  const same = series.every((s) => s.x.length === first.x.length && s.x.every((v, i) => v === first.x[i]));
  if (same) {
    return {
      columns: [lx || "x", ...series.map((s, i) => s.name || `series ${i + 1}`)],
      rows: first.x.map((x, i) => [x, ...series.map((s) => s.y[i])]).slice(0, MAX_ROWS),
    };
  }
  return {
    columns: ["series", lx || "x", ly || "y"],
    rows: series.flatMap((s, i) => s.x.map((x, k) => [s.name || `series ${i + 1}`, x, s.y[k]])).slice(0, MAX_ROWS),
  };
}

export function switchOptions(figure) {
  const traces = (figure && figure.data) || [];
  if (traces.length !== 1) return [];
  const t = traces[0];
  const lines = t.mode === undefined || String(t.mode).includes("lines");
  if (!(t.type === "bar" || (t.type === "scatter" && lines))) return [];
  if (t.marker && Array.isArray(t.marker.color)) return [];
  const x = toArray(t.x);
  const y = toArray(t.y);
  if (!x || !y || x.length < 2 || x.length !== y.length) return [];
  if (y.some((v) => typeof v !== "number")) return [];
  const opts = ["bar", "line"];
  if (x.length <= 12 && y.every((v) => v >= 0) && y.some((v) => v > 0)) opts.push("pie");
  return opts;
}

export function currentType(figure) {
  const t = ((figure && figure.data) || [])[0] || {};
  if (t.type === "pie") return "pie";
  if (t.type === "bar") return "bar";
  return "line";
}

export function retype(figure, type) {
  const t = figure.data[0];
  const x = toArray(t.x);
  const y = toArray(t.y);
  const base = { name: t.name };
  let tr;
  if (type === "bar") tr = { ...base, type: "bar", x, y };
  else if (type === "line") tr = { ...base, type: "scatter", mode: "lines+markers", x, y };
  else tr = { ...base, type: "pie", labels: x.map(String), values: y, hole: 0.45, textinfo: "label+percent" };
  return { ...figure, data: [tr] };
}

const q = (v) => {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function toCsv(columns, rows) {
  return [columns, ...rows].map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
}

export function fmtCell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(v).replace(/T00:00:00(\.0+)?$/, "");
}