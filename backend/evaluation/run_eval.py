import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import app.tools  # noqa: F401  (registers approved tools)
from app.agent.graph import build_graph
from app.agent.nodes import _collect, _supported
from app.agent.runner import run_agent
from app.core.llm import get_llm
from app.services import dataset_service as svc
from app.tools.base import coerce_types
from evaluation.cases import CASES

REPORT_DIR = Path(__file__).resolve().parents[2] / "reports"
PAUSE_SECONDS = 4


def find_dataset(arg):
    if arg:
        return arg
    for m in svc.list_datasets():
        if m["filename"] == "sales_sample.csv":
            return m["id"]
    sys.exit("Upload datasets/sales_sample.csv in the dashboard first, or pass the dataset id.")


def evaluate(case, out, df):
    rep = out["report"]
    ver = rep.get("verification", {})
    status = ver.get("status", "")
    findings = rep.get("findings", [])
    used = sorted({e["tool"] for e in out["evidence"]})

    if case.get("refusal"):
        text = (rep.get("headline", "") + " " + " ".join(rep.get("limitations", []))).lower()
        safe = status == "no_data" or bool(re.search(case["refusal"], text))
        return {"executed": True, "tool_ok": True, "correct": safe,
                "grounded": status in ("no_data", "verified"), "tools": used, "status": status}

    pool = []
    for e in out["evidence"]:
        _collect(e["data"], pool)
        _collect(e["evidence"], pool)
    truth = [abs(float(v)) for v in case["truth"](df)]
    return {
        "executed": status in ("verified", "partially_verified") and bool(out["evidence"]) and not out["failed_steps"],
        "tool_ok": bool(set(used) & set(case["tools"])),
        "correct": all(_supported(v, pool) for v in truth),
        "grounded": status == "verified" and bool(findings) and all(f.get("verified") for f in findings),
        "tools": used, "status": status,
    }


def pct(rows, key):
    return round(100 * sum(1 for r in rows if r[key]) / len(rows), 1)


def main():
    dataset_id = find_dataset(sys.argv[1] if len(sys.argv) > 1 else None)
    df = coerce_types(svc.load_dataframe(dataset_id))
    graph = build_graph(get_llm(), svc.load_dataframe)

    rows = []
    for i, case in enumerate(CASES):
        if i:
            time.sleep(PAUSE_SECONDS)
        start = time.perf_counter()
        try:
            out = run_agent(graph, dataset_id, case["question"])
            res = evaluate(case, out, df)
            res["error"] = ""
            nodes = [t["node"] for t in out["trace"]]
            res["retries"] = max(0, nodes.count("planner") - 1) + max(0, nodes.count("reporter") - 1)
            res["llm_seconds"] = round(sum(t["ms"] for t in out["trace"]
                                           if t["node"] in ("planner", "reporter")) / 1000, 2)
            nodes = [t["node"] for t in out["trace"]]
            res["retries"] = max(0, nodes.count("planner") - 1) + max(0, nodes.count("reporter") - 1)
            res["llm_seconds"] = round(sum(t["ms"] for t in out["trace"]
                                           if t["node"] in ("planner", "reporter")) / 1000, 2)
        except Exception as exc:
            res = {"executed": False, "tool_ok": False, "correct": False, "grounded": False,
                   "tools": [], "status": "error", "error": f"{type(exc).__name__}: {exc}"}
        res["id"] = case["id"]
        res["seconds"] = round(time.perf_counter() - start, 2)
        rows.append(res)
        flags = " ".join(f"{k}={'Y' if res[k] else 'N'}" for k in ("executed", "tool_ok", "correct", "grounded"))
        print(f"[{i + 1}/{len(CASES)}] {case['id']:<16} {flags}  {res['seconds']}s  llm={res.get('llm_seconds', '-')}s  retries={res.get('retries', '-')}  {res['error']}")

    times = sorted(r["seconds"] for r in rows)
    p95 = times[min(len(times) - 1, int(0.95 * len(times)))]
    summary = {
        "cases": len(rows),
        "execution_success_pct": pct(rows, "executed"),
        "tool_selection_pct": pct(rows, "tool_ok"),
        "calculation_correctness_pct": pct(rows, "correct"),
        "grounding_pct": pct(rows, "grounded"),
        "first_pass_pct": round(100 * sum(1 for r in rows if r.get("retries", 1) == 0) / len(rows), 1),
        "avg_seconds": round(sum(times) / len(times), 2),
        "p95_seconds": p95,
    }

    REPORT_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    md = [
        "# VeriScope AI - evaluation report", "",
        f"Run: {stamp} | Model: {get_llm().model} | Dataset rows: {len(df):,}", "",
        "| Metric | Result |", "|---|---|",
        f"| Questions evaluated | {summary['cases']} |",
        f"| Execution success | {summary['execution_success_pct']}% |",
        f"| Tool selection accuracy | {summary['tool_selection_pct']}% |",
        f"| Calculation correctness | {summary['calculation_correctness_pct']}% |",
        f"| Evidence grounding | {summary['grounding_pct']}% |",
        f"| Answered without any retry | {summary['first_pass_pct']}% |",
        f"| Avg response time | {summary['avg_seconds']} s |",
        f"| P95 response time | {summary['p95_seconds']} s |", "",
        "Calculation correctness: ground truth is computed with plain pandas, independent of the agent's tools, "
        "and must appear in the evidence. Grounding: every finding passed the claim checker.", "",
        "| Case | Executed | Tool | Correct | Grounded | Tools used | Seconds |", "|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        y = lambda v: "pass" if v else "FAIL"
        md.append(f"| {r['id']} | {y(r['executed'])} | {y(r['tool_ok'])} | {y(r['correct'])} | "
                  f"{y(r['grounded'])} | {', '.join(r['tools']) or '-'} | {r['seconds']} |")
    (REPORT_DIR / "eval_report.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    (REPORT_DIR / "eval_results.json").write_text(
        json.dumps({"summary": summary, "cases": rows}, indent=2), encoding="utf-8")

    print("\n" + json.dumps(summary, indent=2))
    print(f"\nSaved: {REPORT_DIR / 'eval_report.md'}")


if __name__ == "__main__":
    main()