import json

import plotly.graph_objects as go

RED, GREEN, BLUE = "#ef4444", "#22c55e", "#38bdf8"


def _finish(fig, title):
    fig.update_layout(template="plotly_dark", title=title, paper_bgcolor="rgba(0,0,0,0)",
                      plot_bgcolor="rgba(0,0,0,0)", margin=dict(l=60, r=20, t=60, b=50), showlegend=False)
    return json.loads(fig.to_json())


def _chart_for(ev):
    tool, d, p = ev["tool"], ev["data"], ev["params"]
    vc = p.get("value_column")
    if tool == "compare_periods":
        a, b = d["period_a"], d["period_b"]
        if d.get("breakdown"):
            bd = d["breakdown"]
            vals = [x["difference"] or 0 for x in bd]
            fig = go.Figure(go.Bar(
                x=[x["group"] for x in bd], y=vals,
                marker_color=[RED if v < 0 else GREEN for v in vals],
                text=[f"{v:,.0f}" for v in vals], textposition="outside"))
            fig.update_yaxes(title=f"Change in {vc}")
            return f"Change in {vc} by {p.get('group_by')}: {a['label']} to {b['label']}", fig
        fig = go.Figure(go.Bar(
            x=[a["label"], b["label"]], y=[a["value"], b["value"]],
            marker_color=[BLUE, RED if (d["difference"] or 0) < 0 else GREEN]))
        return f"{vc}: {a['label']} vs {b['label']}", fig
    if tool == "time_trend":
        fig = go.Figure(go.Scatter(x=[r["period"] for r in d], y=[r["value"] for r in d],
                                   mode="lines+markers", line=dict(color=BLUE)))
        return f"{vc} over time", fig
    if tool == "group_aggregate":
        fig = go.Figure(go.Bar(x=[r["group"] for r in d], y=[r["value"] for r in d], marker_color=BLUE))
        return f"{p.get('agg', 'sum')} of {vc} by {p.get('group_by')}", fig
    if tool == "what_if":
        fig = go.Figure(go.Bar(x=["Baseline", "Scenario"], y=[d["baseline_total"], d["scenario_total"]],
                               marker_color=[BLUE, GREEN if d["change_amount"] >= 0 else RED]))
        return f"{vc}: baseline vs scenario", fig
    if tool == "ml_anomalies" and d.get("examples"):
        ex = d["examples"]
        fig = go.Figure(go.Bar(x=[f"row {e['row_index']}" for e in ex],
                               y=[e["anomaly_score"] for e in ex], marker_color=RED))
        fig.update_yaxes(title="Anomaly score (higher = more unusual)")
        return "Most unusual rows (Isolation Forest)", fig
    return None


def build_charts(evidence: list) -> list:
    out = []
    for ev in evidence:
        try:
            made = _chart_for(ev)
            if made:
                title, fig = made
                out.append({"evidence_id": ev["id"], "title": title, "figure": _finish(fig, title)})
        except Exception:
            continue
    return out