import time

from app.rag.store import query


def retriever(state):
    t = time.perf_counter()
    hits, err = [], None
    try:
        hits = query(state["dataset_id"], state["question"])
    except Exception as exc:
        err = f"{type(exc).__name__}: {exc}"
    schema = state["schema_text"]
    if hits:
        schema += ("\n\nBusiness context supplied by the user (definitions and rules; use it to pick the right "
                   "columns and meaning; it is not analysis output):\n"
                   + "\n".join(f"- {h['text']}" for h in hits))
    info = {"hits": len(hits)}
    if err:
        info["error"] = err
    return {"schema_text": schema, "context_hits": hits,
            "trace": [{"node": "retriever", "ms": round((time.perf_counter() - t) * 1000, 1), **info}]}