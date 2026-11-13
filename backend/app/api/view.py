import html
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from app.core.config import settings

router = APIRouter(prefix="/api", tags=["view"])

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VeriScope AI - report</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<style>
:root{color-scheme:dark}
body{margin:0;background:#0b1020;color:#e5e7eb;font-family:Inter,Segoe UI,system-ui,sans-serif;line-height:1.55}
.wrap{max-width:1000px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:26px;margin:8px 0 6px}
h2{font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin:32px 0 12px}
.muted{color:#94a3b8;font-size:14px}
.card{background:#121a30;border:1px solid #1f2a48;border-radius:14px;padding:16px 18px;margin:10px 0}
.badge{display:inline-block;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:600;background:#334155}
.badge.verified{background:#14532d;color:#86efac}
.badge.partially_verified{background:#713f12;color:#fde68a}
.badge.no_data,.badge.tool_summaries_only{background:#7f1d1d;color:#fecaca}
.chip{display:inline-block;margin:6px 6px 0 0;padding:1px 9px;border-radius:8px;background:#1e293b;color:#7dd3fc;font-size:12px}
.ok{color:#4ade80}.warn{color:#fbbf24}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{padding:8px 10px;border-bottom:1px solid #1f2a48;text-align:left;vertical-align:top}
th{color:#94a3b8;font-weight:600}
code{color:#a5b4fc;word-break:break-word}
</style></head><body><div class="wrap">
__BODY__
</div>
<script>
const charts = __CHARTS__;
charts.forEach(function(c, i){
  Plotly.newPlot('chart' + i, c.figure.data, c.figure.layout, {responsive:true, displaylogo:false});
});
</script></body></html>"""


def _e(x):
    return html.escape(str(x))


def render(run: dict) -> str:
    rep = run["report"]
    ver = rep.get("verification", {})
    status = ver.get("status", "unknown")
    out = [
        "<h1>" + _e(rep.get("headline", "")) + "</h1>",
        '<p class="muted">Question: ' + _e(run["question"]) + "</p>",
        '<span class="badge ' + _e(status) + '">' + _e(status.replace("_", " ")) + "</span>",
        "<h2>Findings</h2>",
    ]
    for f in rep.get("findings", []):
        icon = '<span class="ok">&#10003;</span>' if f.get("verified") else '<span class="warn">&#9888;</span>'
        chips = "".join('<span class="chip">' + _e(i) + "</span>" for i in f.get("evidence_ids", []))
        out.append('<div class="card">' + icon + " " + _e(f["text"]) + "<div>" + chips + "</div></div>")
    if ver.get("issues"):
        out.append('<div class="card warn">' + "<br>".join(_e(i) for i in ver["issues"]) + "</div>")
    for title, key in (("Recommendations", "recommendations"), ("Limitations", "limitations")):
        items = rep.get(key, [])
        if items:
            out.append("<h2>" + title + '</h2><div class="card"><ul>'
                       + "".join("<li>" + _e(x) + "</li>" for x in items) + "</ul></div>")
    charts = run.get("charts", [])
    if charts:
        out.append("<h2>Charts</h2>")
        for i in range(len(charts)):
            out.append('<div class="card"><div id="chart' + str(i) + '" style="height:360px"></div></div>')
    if run.get("context_hits"):
        out.append("<h2>Business context used</h2>")
        out.append('<div class="card"><ul>' + "".join("<li>" + _e(h["text"]) + "</li>" for h in run["context_hits"]) + "</ul></div>")
    rows = ""
    for ev in run.get("evidence", []):
        e = ev.get("evidence", {})
        used = e.get("rows_used")
        if used is None:
            used = str(e.get("rows_period_a", "")) + " / " + str(e.get("rows_period_b", ""))
        rows += ("<tr><td>" + _e(ev["id"]) + "</td><td>" + _e(ev["tool"]) + "</td><td><code>"
                 + _e(e.get("formula", "")) + "</code></td><td>" + _e(used) + "</td><td><code>"
                 + _e(json.dumps(ev["params"])) + "</code></td></tr>")
    out.append("<h2>Evidence</h2><div class=\"card\"><table><tr><th>ID</th><th>Tool</th><th>Formula</th>"
               "<th>Rows</th><th>Parameters</th></tr>" + rows + "</table></div>")
    trows = ""
    for t in run.get("trace", []):
        rest = {k: v for k, v in t.items() if k not in ("node", "ms")}
        trows += ("<tr><td>" + _e(t["node"]) + "</td><td>" + _e(t["ms"]) + " ms</td><td><code>"
                  + _e(json.dumps(rest)) + "</code></td></tr>")
    out.append("<h2>Execution trace</h2><div class=\"card\"><table><tr><th>Node</th><th>Time</th>"
               "<th>Details</th></tr>" + trows + "</table></div>")
    return "".join(out)


@router.get("/runs/{run_id}/view", response_class=HTMLResponse)
def view(run_id: str):
    path = settings.upload_dir.parent / "runs" / f"{run_id}.json"
    if not run_id.isalnum() or not path.exists():
        raise HTTPException(404, "Run not found.")
    run = json.loads(path.read_text(encoding="utf-8"))
    charts_json = json.dumps(run.get("charts", [])).replace("</", "<\\/")
    return PAGE.replace("__BODY__", render(run)).replace("__CHARTS__", charts_json)