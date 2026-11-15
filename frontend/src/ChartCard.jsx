import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Plotly from "plotly.js-dist-min";
import Chart from "./Chart";
import { usePins } from "./pins";
import { currentType, fmtCell, retype, switchOptions, tableFor, toCsv } from "./chartData";
import { download } from "./exporters";

const LABEL = { bar: "Bar", line: "Line", pie: "Pie" };
const slug = (s) =>
  String(s || "chart").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "chart";

function TableView({ table }) {
  const rows = table.rows.slice(0, 200);
  return (
    <div>
      <div className="tblwrap" style={{ maxHeight: 340 }}>
        <table className="tbl">
          <thead>
            <tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => <td key={j} className={typeof v === "number" ? "num" : ""}>{fmtCell(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ margin: "8px 0 0" }}>
        {table.rows.length} {table.rows.length === 1 ? "row" : "rows"}{table.rows.length > 200 ? ", showing the first 200 (the CSV has all of them)" : ""}
      </p>
    </div>
  );
}

export default function ChartCard({ chart, run, expanded = false, initial, onClose }) {
  const [view, setView] = useState((initial && initial.view) || "chart");
  const [type, setType] = useState((initial && initial.type) || null);
  const [zoom, setZoom] = useState(null);
  const gdRef = useRef(null);
  const pins = usePins();

  const options = useMemo(() => switchOptions(chart.figure), [chart.figure]);
  const table = useMemo(() => {
    const t = tableFor(chart.figure);
    if (!t) return t;
    const ev = (run.evidence || []).find((e) => e.id === chart.evidence_id);
    const p = (ev && ev.params) || {};
    const xName = p.group_by || p.date_column || p.column || (ev && /trend|period/i.test(ev.tool || "") ? "period" : null);
    const yName = p.value_column ? (p.agg ? p.value_column + " (" + p.agg + ")" : p.value_column) : null;
    const columns = t.columns.map((c, i) => (i === 0 && c === "x" && xName ? xName : i === 1 && c === "value" && yName ? yName : c));
    return { ...t, columns };
  }, [chart.figure, chart.evidence_id, run.evidence]);
  const single = !!table && table.rows.length === 1;
  const shown = useMemo(
    () => (type && options.includes(type) ? retype(chart.figure, type) : chart.figure),
    [chart.figure, type, options]
  );
  const active = type && options.includes(type) ? type : currentType(chart.figure);

  const pinId = run.run_id + ":" + chart.evidence_id;
  const pinned = pins.has(pinId);

  useEffect(() => {
    if (!zoom) return;
    const h = (e) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [zoom]);

  function pin() {
    const r = pins.toggle({
      id: pinId,
      run_id: run.run_id,
      dataset_id: run.dataset_id,
      evidence_id: chart.evidence_id,
      title: chart.title,
      question: run.question,
      status: (run.report && run.report.verification && run.report.verification.status) || "",
      figure: shown,
    });
    if (r && r.error) window.alert(r.error);
  }

  function csv() {
    download(slug(chart.title) + ".csv", "\ufeff" + toCsv(table.columns, table.rows), "text/csv;charset=utf-8");
  }

  async function png() {
    const gd = gdRef.current;
    if (!gd) return window.alert("The chart is still loading. Try again in a moment.");
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#ffffff";
    try {
      await Plotly.relayout(gd, { paper_bgcolor: bg, plot_bgcolor: bg });
      await Plotly.downloadImage(gd, { format: "png", filename: slug(chart.title), width: 1200, height: 600, scale: 2 });
    } catch {
      window.alert("Could not create the image.");
    } finally {
      try {
        await Plotly.relayout(gd, { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)" });
      } catch {}
    }
  }

  return (
    <div className={expanded ? "" : "subcard"}>
      <div className="row">
        <span className="small muted">{chart.title}</span>
        <span className="chip">{chart.evidence_id}</span>
        <div className="grow" />
        {expanded ? (
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        ) : (
          <>
            <button className={"btn ghost sm" + (pinned ? " on" : "")} onClick={pin}>{pinned ? "Pinned" : "Pin"}</button>
            <button className="btn ghost sm" onClick={() => setZoom({ view, type })}>Expand</button>
          </>
        )}
      </div>

      <div className="ctools">
        {table && (
          <div className="seg" role="group" aria-label="View">
            <button className={view === "chart" ? "on" : ""} onClick={() => setView("chart")}>Chart</button>
            <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>Table</button>
          </div>
        )}
        {view === "chart" && options.length > 0 && (
          <div className="seg" role="group" aria-label="Chart type">
            {options.map((o) => (
              <button key={o} className={active === o ? "on" : ""} onClick={() => setType(o)}>{LABEL[o]}</button>
            ))}
          </div>
        )}
        <div className="grow" />
        {table && <button className="btn ghost sm" onClick={csv}>CSV</button>}
        {view === "chart" && <button className="btn ghost sm" onClick={png}>PNG</button>}
      </div>

      {(view === "chart" && !single) || !table ? (
        <Chart figure={shown} height={expanded ? 520 : 340} onReady={(g) => { gdRef.current = g; }} />
      ) : (
        <>{single && <p className="muted small" style={{ margin: "0 0 8px" }}>Only one data point, so there is nothing to plot. Here is the value.</p>}<TableView table={table} /></>
      )}

      {zoom &&
        createPortal(
          <div className="modal" onClick={() => setZoom(null)}>
            <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
              <ChartCard chart={chart} run={run} expanded initial={zoom} onClose={() => setZoom(null)} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}