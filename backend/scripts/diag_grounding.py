import app.tools  # noqa: F401
from app.agent.graph import build_graph
from app.core.llm import get_llm
from app.services import dataset_service as svc
from app.agent.runner import run_agent
from evaluation.cases import CASES

IDS = {"monthly_trend", "ml_anomalies", "peak_month"}
ds = next(m["id"] for m in svc.list_datasets() if m["filename"] == "sales_sample.csv")
graph = build_graph(get_llm(), svc.load_dataframe)
for c in CASES:
    if c["id"] not in IDS:
        continue
    out = run_agent(graph, ds, c["question"])
    ver = out["report"]["verification"]
    print("\n==", c["id"], ver["status"])
    for i in ver["issues"]:
        print("  issue:", i)
    for f in out["report"]["findings"]:
        if not f.get("verified"):
            print("  unverified:", f["text"], f.get("unverified_numbers"))
    print("  trace:", [(t["node"], t["ms"]) for t in out["trace"]])