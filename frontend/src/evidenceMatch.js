const SPLIT = /(\d{4}-\d{2}(?:-\d{2})?|-?\d(?:[\d,]*\d)?(?:\.\d+)?%?)/g;
const DATE = /^\d{4}-\d{2}/;

export function splitText(text) {
  return String(text ?? "")
    .split(SPLIT)
    .map((t, i) => ({ text: t, isNum: i % 2 === 1 && !DATE.test(t) }))
    .filter((p) => p.text !== "");
}

export function parseToken(tok) {
  const raw = String(tok).replace(/[,%]/g, "");
  const value = parseFloat(raw);
  const dot = raw.indexOf(".");
  return { value, decimals: dot >= 0 ? raw.length - dot - 1 : 0 };
}

function close(a, b) {
  return Math.abs(a - b) <= Math.max(1e-9, 1e-6 * Math.max(Math.abs(a), Math.abs(b)));
}

export function sameNumber(token, x) {
  const { value, decimals } = parseToken(token);
  if (!Number.isFinite(value) || typeof x !== "number" || !Number.isFinite(x)) return false;
  const a = Math.abs(value);
  const b = Math.abs(x);
  if (close(a, b)) return true;
  if (decimals < 1) return false;
  const f = 10 ** decimals;
  return Math.abs(Math.round(b * f) / f - a) < 1e-9;
}

export function flagged(token, list) {
  const { value } = parseToken(token);
  return Number.isFinite(value) && (list || []).some((x) => typeof x === "number" && close(Math.abs(value), Math.abs(x)));
}

export function flatten(obj, base = "", out = [], depth = 0) {
  if (out.length > 5000 || depth > 6) return out;
  if (typeof obj === "number") {
    if (Number.isFinite(obj)) out.push([base, obj]);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${base}[${i}]`, out, depth + 1));
    return out;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) flatten(v, base ? `${base}.${k}` : k, out, depth + 1);
  }
  return out;
}

export function findSource(token, items) {
  for (const e of items || []) {
    for (const scope of ["data", "evidence"]) {
      for (const [path, x] of flatten(e[scope], scope)) {
        if (sameNumber(token, x)) {
          const ev = e.evidence || {};
          const rows = ev.rows_used ?? (ev.rows_period_a != null ? `${ev.rows_period_a} / ${ev.rows_period_b ?? "-"}` : null);
          return { id: e.id, tool: e.tool, path, formula: ev.formula, rows };
        }
      }
    }
  }
  return null;
}