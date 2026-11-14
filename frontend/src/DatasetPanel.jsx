import { useState } from "react";

const nf = (v) =>
  typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v ?? "-";
const day = (v) => String(v ?? "").slice(0, 10);

function summary(c) {
  if (c.kind === "numeric") return `min ${nf(c.min)}  \u00b7  max ${nf(c.max)}  \u00b7  mean ${nf(c.mean)}`;
  if (c.kind === "datetime") return `${day(c.min)} \u2192 ${day(c.max)}`;
  const t = c.top_values;
  if (Array.isArray(t))
    return t
      .slice(0, 4)
      .map((x) => (x && typeof x === "object" ? (x.value ?? x.name ?? Object.values(x)[0]) : x))
      .join(", ");
  if (t && typeof t === "object") return Object.keys(t).slice(0, 4).join(", ");
  return "";
}

export default function DatasetPanel({ meta, profile, preview, onMore, moreLoading }) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState("columns");
  const cols = profile?.columns || [];
  const rows = profile?.rows ?? 0;
  const dt = cols.find((c) => c.kind === "datetime");
  const missing = cols.reduce((s, c) => s + (c.missing || 0), 0);
  const cells = rows * cols.length;
  const keys = preview[0] ? Object.keys(preview[0]) : [];
  const kpis = [
    ["Rows", rows.toLocaleString()],
    ["Columns", cols.length],
    ["Missing cells", cells ? `${missing.toLocaleString()} (${((100 * missing) / cells).toFixed(2)}%)` : "0"],
    ["Date range", dt ? `${day(dt.min)} \u2192 ${day(dt.max)}` : "none"],
  ];

  return (
    <div className="card pad fade">
      <div className="row">
        <b>{meta?.filename || "Dataset"}</b>
        <div className="grow" />
        {open && profile && (
          <div className="seg">
            <button className={view === "columns" ? "on" : ""} onClick={() => setView("columns")}>Columns</button>
            <button className={view === "preview" ? "on" : ""} onClick={() => setView("preview")}>Preview</button>
          </div>
        )}
        <button className="btn ghost sm" onClick={() => setOpen((o) => !o)}>{open ? "Collapse" : "Expand"}</button>
      </div>

      {open && !profile && <p className="muted">Loading profile...</p>}

      {open && profile && (
        <>
          <div className="kpis">
            {kpis.map(([l, v]) => (
              <div key={l} className="kpi"><div className="l">{l}</div><div className="v">{v}</div></div>
            ))}
          </div>

          {view === "columns" ? (
            <div className="tblwrap">
              <table className="tbl">
                <thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Summary</th></tr></thead>
                <tbody>
                  {cols.map((c) => {
                    const pct = rows ? (100 * (c.missing || 0)) / rows : 0;
                    return (
                      <tr key={c.name}>
                        <td><b>{c.name}</b></td>
                        <td><span className={"chip k-" + c.kind}>{c.kind}</span></td>
                        <td>
                          <span className="miss"><i style={{ width: Math.min(100, pct) + "%" }} /></span>
                          {c.missing || 0} <span className="muted">({pct.toFixed(1)}%)</span>
                        </td>
                        <td className="muted">{summary(c)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="tblwrap">
                <table className="tbl">
                  <thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>{keys.map((k) => <td key={k}>{String(r[k] ?? "")}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <span className="muted small">Showing {preview.length} rows</span>
                {preview.length < 50 && preview.length < rows && (
                  <button className="btn ghost sm" onClick={onMore} disabled={moreLoading}>
                    {moreLoading ? "Loading..." : "Show 50 rows"}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}