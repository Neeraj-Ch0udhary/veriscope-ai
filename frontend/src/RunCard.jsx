import { useState } from "react";
import Chart from "./Chart";
import { download, toMarkdown } from "./exporters";

const STATUS = {
  verified: ["Verified", "good"],
  partially_verified: ["Partially verified", "warn"],
  no_data: ["No data", "bad"],
  tool_summaries_only: ["Tool summaries only", "bad"],
};

function Trace({ trace }) {
  const total = trace.reduce((s, t) => s + (t.ms || 0), 0) || 1;
  const count = (n) => trace.filter((t) => t.node === n).length;
  const retries = Math.max(0, count("planner") - 1) + Math.max(0, count("reporter") - 1);
  return (
    <div>
      <p className="muted">
        {(total / 1000).toFixed(1)} s total &middot; {trace.length} steps &middot; {retries} retries
      </p>
      {trace.map((t, i) => {
        const { node, ms, ...rest } = t;
        return (
          <div key={i} className="trace-row">
            <div className="trace-head">
              <b>{node}</b>
              <span className="muted">{ms} ms</span>
            </div>
            <div className="bar"><div style={{ width: Math.max(2, (ms / total) * 100) + "%" }} /></div>
            {Object.keys(rest).length > 0 && <code className="small">{JSON.stringify(rest)}</code>}
          </div>
        );
      })}
    </div>
  );
}

export default function RunCard({ item }) {
  const [tab, setTab] = useState("report");

  if (item.pending)
    return (
      <div className="card pad">
        <div className="q">{item.question}</div>
        <div className="pending"><span className="spin" /> Planning, running approved tools and verifying claims. This can take 10-45 s.</div>
      </div>
    );
  if (item.error)
    return (
      <div className="card pad">
        <div className="q">{item.question}</div>
        <div className="alert bad">{item.error}</div>
      </div>
    );

  const run = item.run;
  const rep = run.report || {};
  const ver = rep.verification || {};
  const [label, tone] = STATUS[ver.status] || [ver.status || "Unknown", "warn"];
  const charts = run.charts || [];
  const evidence = run.evidence || [];
  const tabs = [
    ["report", "Report"],
    ["charts", `Charts (${charts.length})`],
    ["evidence", `Evidence (${evidence.length})`],
    ["trace", "Trace"],
  ];

  return (
    <div className="card pad">
      <div className="q">{run.question}</div>
      <div className="row">
        <span className={"badge " + tone}>{label}</span>
        <span className="muted small">run {run.run_id}</span>
        <div className="grow" />
        <button className="btn ghost sm" onClick={() => download(`veriscope-${run.run_id}.md`, toMarkdown(run), "text/markdown")}>Markdown</button>
        <button className="btn ghost sm" onClick={() => download(`veriscope-${run.run_id}.json`, JSON.stringify(run, null, 2), "application/json")}>JSON</button>
        <button className="btn ghost sm" onClick={() => window.open(`/api/runs/${run.run_id}/download`)}>HTML</button>
      </div>

      <div className="tabs">
        {tabs.map(([k, t]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>

      {tab === "report" && (
        <div>
          <h3 className="headline">{rep.headline}</h3>
          {(rep.findings || []).map((f, i) => (
            <div key={i} className={"finding " + (f.verified ? "ok" : "unv")}>
              <span className="mark">{f.verified ? "\u2713" : "!"}</span>
              <div>
                <div>{f.text}</div>
                <div className="chips">
                  {(f.evidence_ids || []).map((id) => <span key={id} className="chip">{id}</span>)}
                </div>
              </div>
            </div>
          ))}
          {(ver.issues || []).length > 0 && (
            <div className="alert warn">{ver.issues.map((x, i) => <div key={i}>{x}</div>)}</div>
          )}
          {(run.failed_steps || []).length > 0 && (
            <div className="alert bad">
              {run.failed_steps.map((s) => <div key={s.id}>{s.tool} failed: {s.error}</div>)}
            </div>
          )}
          {(rep.recommendations || []).length > 0 && (<><h4>Recommendations</h4><ul>{rep.recommendations.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
          {(rep.limitations || []).length > 0 && (<><h4>Limitations</h4><ul>{rep.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
          {(run.context_hits || []).length > 0 && (<><h4>Business context used</h4><ul>{run.context_hits.map((h, i) => <li key={i}>{h.text}</li>)}</ul></>)}
        </div>
      )}

      {tab === "charts" && (
        charts.length === 0 ? <p className="muted">No charts for this answer.</p> :
        <div className="grid2">
          {charts.map((c) => (
            <div key={c.evidence_id} className="subcard">
              <div className="small muted">{c.title} <span className="chip">{c.evidence_id}</span></div>
              <Chart figure={c.figure} />
            </div>
          ))}
        </div>
      )}

      {tab === "evidence" && evidence.map((e) => {
        const ev = e.evidence || {};
        return (
          <div key={e.id} className="subcard">
            <div className="row"><span className="chip">{e.id}</span><b>{e.tool}</b></div>
            {e.summary && <p>{e.summary}</p>}
            {ev.formula && <p className="small"><span className="muted">Formula </span><code>{ev.formula}</code></p>}
            {ev.assumption && <p className="small"><span className="muted">Assumption </span>{ev.assumption}</p>}
            <p className="small muted">
              rows: {String(ev.rows_used ?? `${ev.rows_period_a ?? "-"} / ${ev.rows_period_b ?? "-"}`)}
              {ev.columns_used ? ` | columns: ${ev.columns_used.join(", ")}` : ""}
            </p>
            <code className="small">{JSON.stringify(e.params)}</code>
          </div>
        );
      })}

      {tab === "trace" && <Trace trace={run.trace || []} />}
    </div>
  );
}