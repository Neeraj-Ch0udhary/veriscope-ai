import { useEffect, useRef, useState } from 'react'
import Plotly from 'plotly.js-dist-min'
import { api } from './api'

const LABEL = {
  verified: 'Verified',
  partially_verified: 'Partially verified',
  no_data: 'No analysis',
  tool_summaries_only: 'Tool results only',
}

export const Badge = ({ status }) => (
  <span className={`badge ${status}`}>{LABEL[status] || status || 'unknown'}</span>
)

export function Chart({ chart }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const layout = { ...chart.figure.layout, autosize: true, height: 340 }
    Plotly.newPlot(el, chart.figure.data, layout, { responsive: true, displaylogo: false })
    return () => Plotly.purge(el)
  }, [chart])
  return <div className="chart" ref={ref} />
}

export function Drawer({ evidence, onClose }) {
  if (!evidence) return null
  const e = evidence.evidence || {}
  const data = JSON.stringify(evidence.data, null, 2)
  return (
    <aside className="drawer">
      <div className="drawer-head">
        <div>
          <div className="eyebrow">Evidence {evidence.id}</div>
          <h3>{evidence.tool}</h3>
        </div>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <p className="muted">{evidence.summary}</p>
      <h4>Formula</h4>
      <code className="block">{e.formula}</code>
      <h4>Parameters</h4>
      <code className="block">{JSON.stringify(evidence.params)}</code>
      <h4>Source</h4>
      <p className="muted">
        Columns: {(e.columns_used || []).join(', ')}
        <br />
        Rows used: {e.rows_used ?? `${e.rows_period_a} / ${e.rows_period_b}`}
        <br />
        Computed in {e.elapsed_ms} ms by Pandas / NumPy (not by the AI).
      </p>
      <h4>Raw result</h4>
      <pre className="block">{data.length > 6000 ? data.slice(0, 6000) + '\n...(truncated)' : data}</pre>
    </aside>
  )
}

export function ReportCard({ run, onEvidence }) {
  const [showTrace, setShowTrace] = useState(false)
  const rep = run.report
  const ver = rep.verification || {}
  const byId = Object.fromEntries((run.evidence || []).map((e) => [e.id, e]))
  const total = (run.trace || []).reduce((a, t) => a + (t.ms || 0), 0)
  return (
    <div className="report">
      <div className="report-top">
        <h2>{rep.headline}</h2>
        <Badge status={ver.status} />
      </div>
      {(rep.findings || []).map((f, i) => (
        <div className="finding" key={i}>
          <span className={f.verified ? 'tick ok' : 'tick warn'}>{f.verified ? '\u2713' : '\u26A0'}</span>
          <div>
            <div>{f.text}</div>
            <div className="chips">
              {(f.evidence_ids || []).map((id) => (
                <button key={id} className="chip" disabled={!byId[id]} onClick={() => onEvidence(byId[id])}>
                  {id} · {byId[id]?.tool}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      {ver.issues?.length > 0 && (
        <div className="notice warn">
          {ver.issues.map((x, i) => <div key={i}>{x}</div>)}
        </div>
      )}
      {(run.charts || []).map((c) => (
        <div className="card" key={c.evidence_id}>
          <Chart chart={c} />
        </div>
      ))}
      {rep.recommendations?.length > 0 && (
        <>
          <h4>Recommendations</h4>
          <ul>{rep.recommendations.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
      {rep.limitations?.length > 0 && (
        <>
          <h4>Limitations</h4>
          <ul className="muted">{rep.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
      {run.context_hits?.length > 0 && (
        <>
          <h4>Business context used</h4>
          <ul className="muted">{run.context_hits.map((h) => <li key={h.id}>{h.text}</li>)}</ul>
        </>
      )}
      {run.failed_steps?.length > 0 && (
        <div className="notice warn">
          {run.failed_steps.map((s) => <div key={s.id}>{s.id} {s.tool}: {s.error}</div>)}
        </div>
      )}
      <div className="actions">
        <a className="btn" href={`/api/runs/${run.run_id}/view`} target="_blank" rel="noreferrer">Open full report</a>
        <a className="btn" href={`/api/runs/${run.run_id}/download`}>Download report</a>
        <button className="ghost" onClick={() => setShowTrace(!showTrace)}>
          {showTrace ? 'Hide' : 'Show'} execution trace ({Math.round(total)} ms)
        </button>
      </div>
      {showTrace && (
        <table className="trace">
          <tbody>
            {run.trace.map((t, i) => {
              const { node, ms, ...rest } = t
              return (
                <tr key={i}>
                  <td>{node}</td>
                  <td>{ms} ms</td>
                  <td><code>{JSON.stringify(rest)}</code></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const fmt = (v) => (v === null || v === undefined ? '' : typeof v === 'number' ? v.toLocaleString() : String(v))

export function Explorer({ dataset }) {
  const [profile, setProfile] = useState(null)
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  useEffect(() => {
    setProfile(null)
    setRows([])
    setErr('')
    Promise.all([api.profile(dataset.id), api.preview(dataset.id)])
      .then(([p, pr]) => { setProfile(p); setRows(pr.rows) })
      .catch((e) => setErr(e.message))
  }, [dataset.id])
  if (err) return <div className="notice warn">{err}</div>
  if (!profile) return <div className="muted">Profiling dataset...</div>
  const score = profile.quality_score
  const color = score >= 85 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444'
  const cols = rows[0] ? Object.keys(rows[0]) : []
  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="ring" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, #1f2a48 0)` }}>
            <span>{score}</span>
          </div>
          <div className="muted">Data quality score</div>
        </div>
        <div className="stat"><b>{profile.rows.toLocaleString()}</b><div className="muted">rows</div></div>
        <div className="stat"><b>{profile.columns_count}</b><div className="muted">columns</div></div>
        <div className="stat"><b>{profile.duplicate_rows}</b><div className="muted">duplicate rows</div></div>
      </div>
      <p className="muted small">Score = {profile.score_formula}</p>
      <h4>Issues found</h4>
      {profile.issues.length === 0 && <div className="muted">No issues detected.</div>}
      {profile.issues.map((i, k) => (
        <div key={k} className={`notice ${i.severity === 'warning' ? 'warn' : ''}`}>{i.message}</div>
      ))}
      <h4>Columns</h4>
      <div className="scroll">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Missing</th><th>Unique</th><th>Summary</th></tr></thead>
          <tbody>
            {profile.columns.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td><span className="chip static">{c.kind}</span></td>
                <td>{c.missing} ({c.missing_pct}%)</td>
                <td>{c.unique}</td>
                <td className="muted">
                  {c.kind === 'numeric' && `min ${fmt(c.min)} · mean ${fmt(c.mean)} · max ${fmt(c.max)}`}
                  {c.kind === 'datetime' && `${String(c.min).slice(0, 10)} to ${String(c.max).slice(0, 10)}`}
                  {c.top_values && c.kind !== 'numeric' && c.top_values.map((v) => v.value).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4>Preview (first 25 rows)</h4>
      <div className="scroll tall">
        <table>
          <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c}>{fmt(r[c])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function suggestions(profile) {
  const cols = profile?.columns || []
  const money = /revenue|sales|amount|total|profit|income|cost|price/i
  const num = cols.filter((c) => c.kind === 'numeric')
    .sort((a, b) => money.test(b.name) - money.test(a.name) || (b.mean || 0) - (a.mean || 0))
  const cat = cols.filter((c) => c.kind === 'categorical')
  const date = cols.find((c) => c.kind === 'datetime')
  const out = ['Are there any unusual orders or data quality problems in this dataset?']
  if (num[0] && cat[0]) out.push(`Which ${cat[0].name} has the highest total ${num[0].name}?`)
  if (num[0] && date) out.push(`How did ${num[0].name} change month over month?`)
  if (num[0] && date) out.push(`Why did ${num[0].name} drop in March 2025 compared to February?`)
  if (num.length >= 2) out.push(`How are ${num[0].name} and ${num[1].name} related?`)
  return out.slice(0, 4)
}