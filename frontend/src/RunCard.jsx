import { useEffect, useState } from "react";
import ChartCard from "./ChartCard";
import { useSaved } from "./saved";
import FindingText from "./FindingText";
import { Highlight } from "./format";
import { download, toMarkdown } from "./exporters";

const STATUS = {
  verified: ["Verified", "good"],
  partially_verified: ["Partially verified", "warn"],
  no_data: ["No data", "bad"],
  tool_summaries_only: ["Tool summaries only", "bad"],
};
const LLM = new Set(["planner", "reporter"]);
const nodeClass = (n) => (LLM.has(n) ? "llm" : n === "executor" ? "tool" : "chk");

function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="muted small">
      {s}s{s > 25 ? " - taking longer than usual, the model may be rate limited or retrying" : ""}
    </span>
  );
}

function Trace({ trace }) {
  const total = trace.reduce((s, t) => s + (t.ms || 0), 0) || 1;
  const count = (n) => trace.filter((t) => t.node === n).length;
  const retries = Math.max(0, count("planner") - 1) + Math.max(0, count("reporter") - 1);
  return (
    <div>
      <p className="muted">
        {(total / 1000).toFixed(1)} s total &middot; {trace.length} steps &middot; {retries} retries
      </p>
      <p className="hint">Cyan: LLM calls &middot; Green: tool execution &middot; Grey: checks</p>
      {trace.map((t, i) => {
        const { node, ms, ...rest } = t;
        return (
          <div key={i} className="trace-row">
            <div className="trace-head">
              <b>{node}</b>
              <span className="muted">{ms} ms</span>
            </div>
            <div className="bar"><div className={nodeClass(node)} style={{ width: Math.max(2, (ms / total) * 100) + "%" }} /></div>
            {Object.keys(rest).length > 0 && <code className="small">{JSON.stringify(rest)}</code>}
          </div>
        );
      })}
    </div>
  );
}

export default function RunCard({ item, followUps = [], onAsk, busy }) {
  const [tab, setTab] = useState("report");
  const [focus, setFocus] = useState(null);
  const [copied, setCopied] = useState(false);
  const runId = item.run?.run_id;
  const saved = useSaved();

  useEffect(() => {
    if (tab !== "evidence" || !focus) return;
    document.getElementById(`ev-${runId}-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tab, focus, runId]);

  if (item.pending)
    return (
      <div className="card pad fade">
        <div className="q">{item.question}</div>
        <div className="pending"><span className="spin" /> Planning, running approved tools and verifying claims <Elapsed /></div>
      </div>
    );
  if (item.error)
    return (
      <div className="card pad fade">
        <div className="q">{item.question}</div>
        <div className="alert bad">{item.error}</div>
      </div>
    );

  const run = item.run;
  const rep = run.report || {};
  const ver = rep.verification || {};
  const [label, tone] = STATUS[ver.status] || [ver.status || "Unknown", "warn"];
  const findings = rep.findings || [];
  const okCount = findings.filter((f) => f.verified).length;
  const charts = run.charts || [];
  const evidence = run.evidence || [];
  const trace = run.trace || [];
  const ms = trace.reduce((s, t) => s + (t.ms || 0), 0);
  const cnt = (n) => trace.filter((t) => t.node === n).length;
  const retries = Math.max(0, cnt("planner") - 1) + Math.max(0, cnt("reporter") - 1);
  const tabs = [
    ["report", "Report"],
    ["charts", `Charts (${charts.length})`],
    ["evidence", `Evidence (${evidence.length})`],
    ["trace", "Trace"],
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(toMarkdown(run));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="card pad fade">
      <div className="q">{run.question}</div>
      <div className="row">
        <span className={"badge " + tone}>{label}</span>
        <span className="muted small">run {run.run_id}</span>
        <div className="grow" />
        <button className={"btn ghost sm" + (saved.has(run.question) ? " on" : "")} onClick={() => { const r = saved.toggle({ question: run.question, dataset_id: run.dataset_id }); if (r && r.error) window.alert(r.error); }}>{saved.has(run.question) ? "\u2605 Saved" : "\u2606 Save"}</button>
        <button className="btn ghost sm" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        <button className="btn ghost sm" onClick={() => download(`veriscope-${run.run_id}.md`, toMarkdown(run), "text/markdown")}>Markdown</button>
        <button className="btn ghost sm" onClick={() => download(`veriscope-${run.run_id}.json`, JSON.stringify(run, null, 2), "application/json")}>JSON</button>
        <button className="btn ghost sm" onClick={() => window.open(`/api/runs/${run.run_id}/download`)}>HTML</button>
      </div>
      <div className="strip">
        <span className="pill"><b>{okCount}/{findings.length}</b> findings verified</span>
        <span className="pill"><b>{(ver.issues || []).length}</b> issues</span>
        <span className="pill"><b>{retries}</b> retries</span>
        <span className="pill"><b>{(ms / 1000).toFixed(1)}</b> s</span>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>

      {tab === "report" && (
        <div>
          <h3 className="headline"><Highlight text={rep.headline} /></h3>
          <p className="hint" style={{ margin: "0 0 8px" }}>Hover or tap a highlighted number to see where it came from.</p>
          {findings.map((f, i) => (
            <div key={i} className={"finding " + (f.verified ? "ok" : "unv")}>
              <span className="mark">{f.verified ? "\u2713" : "!"}</span>
              <div>
                <div><FindingText finding={f} evidence={evidence} onOpen={(id) => { setFocus(id); setTab("evidence"); }} /></div>
                <div className="chips">
                  {(f.evidence_ids || []).map((id) => (
                    <button key={id} className="chip btnchip" title="Show evidence" onClick={() => { setFocus(id); setTab("evidence"); }}>{id}</button>
                  ))}
                  {!f.verified && (f.unverified_numbers || []).length > 0 && (
                    <span className="chip warnchip">unverified: {f.unverified_numbers.join(", ")}</span>
                  )}
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
          {followUps.length > 0 && (
            <>
              <h4>Ask next</h4>
              <div className="chips">
                {followUps.map((q) => (
                  <button key={q} className="chip btnchip" disabled={busy} onClick={() => onAsk(q)}>{q}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "charts" && (
        charts.length === 0 ? <p className="muted">No charts for this answer.</p> :
        <div className="grid2">
          {charts.map((c) => <ChartCard key={c.evidence_id} chart={c} run={run} />)}
        </div>
      )}

      {tab === "evidence" && evidence.map((e) => {
        const ev = e.evidence || {};
        return (
          <div key={e.id} id={`ev-${run.run_id}-${e.id}`} className={"subcard" + (focus === e.id ? " hl" : "")}>
            <div className="row"><span className="chip">{e.id}</span><b>{e.tool}</b></div>
            {e.summary && <p>{e.summary}</p>}
            {ev.formula && <p className="small"><span className="muted">Formula </span><code>{ev.formula}</code></p>}
            {ev.assumption && <p className="small"><span className="muted">Assumption </span>{ev.assumption}</p>}
            <p className="small muted">
              rows: {String(ev.rows_used ?? `${ev.rows_period_a ?? "-"} / ${ev.rows_period_b ?? "-"}`)}
              {ev.columns_used ? ` | columns: ${ev.columns_used.join(", ")}` : ""}
            </p>
            <code className="small">{JSON.stringify(e.params)}</code>
            {e.data !== undefined && (
              <details className="raw">
                <summary className="small muted">Raw tool result</summary>
                <pre>{JSON.stringify(e.data, null, 2).slice(0, 4000)}</pre>
              </details>
            )}
          </div>
        );
      })}

      {tab === "trace" && <Trace trace={trace} />}
    </div>
  );
}