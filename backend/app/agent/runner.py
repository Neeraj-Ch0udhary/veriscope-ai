from app.services.charts import build_charts


def run_agent(graph, dataset_id: str, question: str) -> dict:
    final = graph.invoke({"dataset_id": dataset_id, "question": question})
    results = final.get("results", [])
    evidence = [{"id": r["id"], "tool": r["tool"], "params": r["params"], **r["result"]}
                for r in results if r["ok"]]
    return {
        "question": question,
        "report": final["report"],
        "evidence": evidence,
        "charts": build_charts(evidence),
        "context_hits": final.get("context_hits", []),
        "failed_steps": [{"id": r["id"], "tool": r["tool"], "error": r["error"]}
                         for r in results if not r["ok"]],
        "trace": final.get("trace", []),
    }