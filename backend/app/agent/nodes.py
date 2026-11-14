import re
import time

import app.tools.analysis  # noqa: F401  (registers approved tools)
from app.agent.prompts import PLANNER_SYSTEM, REPORTER_SYSTEM, planner_prompt, reporter_prompt
from app.core.llm import LLMError
from app.services.profiler import build_profile
from app.tools.base import ToolError, coerce_types, run_tool

MAX_STEPS = 5
MAX_PLAN_ATTEMPTS = 2
MAX_REPORT_ATTEMPTS = 2
NUM = re.compile(r"-?\d[\d,]*\.?\d*")
SPELLED = re.compile(r"\b(?:ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|lakh|crore|percent)\b", re.I)


def _trace(node: str, start: float, **info) -> list:
    return [{"node": node, "ms": round((time.perf_counter() - start) * 1000, 1), **info}]


def _collect(obj, out: list) -> None:
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        out.append(abs(float(obj)))
    elif isinstance(obj, dict):
        for v in obj.values():
            _collect(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _collect(v, out)


def numbers_in_text(text: str) -> list[float]:
    vals = []
    for m in NUM.finditer(text):
        raw = m.group().replace(",", "").rstrip(".")
        try:
            v = abs(float(raw))
        except ValueError:
            continue
        is_pct = text[m.end():m.end() + 1] == "%"
        has_dec = "." in raw
        if not is_pct and not has_dec and (v <= 20 or 1900 <= v <= 2100):
            continue  # counting words and years are not data claims
        vals.append(v)
    return vals


def _supported(v: float, pool: list[float]) -> bool:
    return any(abs(v - p) <= max(0.051, 0.001 * p) for p in pool)


def _normalize_report(d) -> dict:
    d = d if isinstance(d, dict) else {}
    findings = []
    for f in d.get("findings") or []:
        if isinstance(f, dict) and isinstance(f.get("text"), str):
            ids = f.get("evidence_ids")
            findings.append({"text": f["text"],
                             "evidence_ids": [str(i) for i in ids] if isinstance(ids, list) else []})

    def strs(x):
        return [s for s in x if isinstance(s, str)] if isinstance(x, list) else []

    return {
        "headline": d["headline"] if isinstance(d.get("headline"), str) else "",
        "findings": findings,
        "recommendations": strs(d.get("recommendations")),
        "limitations": strs(d.get("limitations")),
    }


class AgentNodes:
    def __init__(self, llm, load_df):
        self.llm = llm
        self.load_df = load_df

    def profiler(self, state):
        t = time.perf_counter()
        p = build_profile(self.load_df(state["dataset_id"]))
        lines = [f"Rows: {p['rows']}"]
        for c in p["columns"]:
            d = f"- {c['name']} ({c['kind']}), missing {c['missing']}"
            if c["kind"] == "numeric":
                d += f", min {c.get('min')}, max {c.get('max')}, mean {c.get('mean')}"
            elif c["kind"] == "datetime":
                d += f", from {c.get('min')} to {c.get('max')}"
            elif c.get("top_values"):
                d += ", example values: " + ", ".join(v["value"][:30] for v in c["top_values"])
            lines.append(d)
        return {"schema_text": "\n".join(lines), "plan_attempts": 0, "report_attempts": 0,
                "feedback": "", "claim_issues": [], "trace": _trace("profiler", t, columns=len(p["columns"]))}

    def planner(self, state):
        t = time.perf_counter()
        attempts = state.get("plan_attempts", 0) + 1
        err = None
        try:
            data = self.llm.generate_json(
                PLANNER_SYSTEM,
                planner_prompt(state["question"], state["schema_text"], state.get("feedback", "")))
        except LLMError as exc:
            data, err = {}, str(exc)
        if not isinstance(data, dict):
            data = {}
        raw_steps = data.get("steps") if isinstance(data.get("steps"), list) else []
        steps = [s for s in raw_steps if isinstance(s, dict)][:MAX_STEPS]
        upd = {
            "plan": {"reasoning": str(data.get("reasoning", ""))[:1000], "steps": steps},
            "plan_attempts": attempts,
            "trace": _trace("planner", t, attempt=attempts, steps=[s.get("tool") for s in steps],
                            **({"error": err} if err else {})),
        }
        if err:
            upd["feedback"] = f"LLM error: {err}"
        return upd

    def executor(self, state):
        t = time.perf_counter()
        df = coerce_types(self.load_df(state["dataset_id"]))
        results = []
        for i, step in enumerate(state["plan"]["steps"], 1):
            sid, name = f"s{i}", str(step.get("tool", ""))
            params = step.get("params") if isinstance(step.get("params"), dict) else {}
            base = {"id": sid, "tool": name, "params": params}
            try:
                results.append({**base, "ok": True, "result": run_tool(name, df, params)})
            except ToolError as exc:
                results.append({**base, "ok": False, "error": str(exc)})
            except Exception as exc:  # never crash the run on a tool bug
                results.append({**base, "ok": False, "error": f"Internal error: {type(exc).__name__}"})
        ok = sum(r["ok"] for r in results)
        return {"results": results, "trace": _trace("executor", t, ok=ok, failed=len(results) - ok)}

    def result_checker(self, state):
        t = time.perf_counter()
        results = state.get("results", [])
        errors = [f"{r['id']} ({r['tool']}): {r['error']}" for r in results if not r["ok"]]
        plan = state.get("plan", {})
        if not results and not plan.get("steps") and str(plan.get("reasoning", "")).strip():
            fb = ""  # planner deliberately declined (not answerable with this data): do not retry
        elif not results:
            fb = "The plan had no executable steps. Produce 1 to 5 valid tool steps."
        elif errors:
            fb = "These steps failed, fix them: " + "; ".join(errors)
        else:
            fb = ""
        return {"feedback": fb, "trace": _trace("result_checker", t, passed=not fb)}

    def reporter(self, state):
        t = time.perf_counter()
        attempts = state.get("report_attempts", 0) + 1
        ok = [r for r in state.get("results", []) if r["ok"]]
        if not ok:
            lim = ["No valid analysis could be run for this question with the available data."]
            if state.get("plan", {}).get("reasoning"):
                lim.append(state["plan"]["reasoning"])
            if state.get("feedback"):
                lim.append(state["feedback"])
            report = {"headline": "The question could not be answered.", "findings": [],
                      "recommendations": [], "limitations": lim,
                      "verification": {"status": "no_data", "issues": []}}
            return {"report": report, "report_attempts": attempts, "trace": _trace("reporter", t, mode="no_data")}
        try:
            report = _normalize_report(self.llm.generate_json(
                REPORTER_SYSTEM, reporter_prompt(state["question"], ok, state.get("claim_issues", []), state.get("context_hits", []))))
            return {"report": report, "report_attempts": attempts,
                    "trace": _trace("reporter", t, attempt=attempts, findings=len(report["findings"]))}
        except LLMError as exc:
            report = {
                "headline": "The AI model was unavailable, so only computed tool results are shown.",
                "findings": [{"text": r["result"]["summary"], "evidence_ids": [r["id"]], "verified": True} for r in ok],
                "recommendations": [], "limitations": [f"LLM error: {exc}"],
                "verification": {"status": "tool_summaries_only", "issues": []},
            }
            return {"report": report, "report_attempts": attempts,
                    "trace": _trace("reporter", t, mode="fallback", error=str(exc))}

    def claim_checker(self, state):
        t = time.perf_counter()
        report = dict(state["report"])
        if report.get("verification", {}).get("status") in ("no_data", "tool_summaries_only"):
            return {"claim_issues": [], "trace": _trace("claim_checker", t, skipped=True)}

        by_id = {r["id"]: r for r in state["results"] if r["ok"]}
        issues, findings = [], []
        if not report["findings"]:
            issues.append("The answer contained no findings.")
        for i, f in enumerate(report["findings"], 1):
            f = dict(f)
            ids = [e for e in f["evidence_ids"] if e in by_id]
            if not ids:
                issues.append(f"Finding {i} cites no valid evidence id (valid ids: {list(by_id)}).")
                f["verified"] = False
            else:
                pool: list[float] = []
                for e in ids:
                    _collect(by_id[e]["result"]["data"], pool)
                    _collect(by_id[e]["result"]["evidence"], pool)
                bad = [v for v in numbers_in_text(f["text"]) if not _supported(v, pool)]
                words = SPELLED.findall(f["text"])
                f["verified"] = not bad and not words
                if words:
                    issues.append(f"Finding {i} uses spelled-out numbers "
                                  f"({sorted(set(w.lower() for w in words))}); write numbers as digits.")
                if bad:
                    f["unverified_numbers"] = bad
                    ctx_pool = [n for h in state.get("context_hits", []) for n in numbers_in_text(h.get("text", ""))]
                    from_ctx = [v for v in bad if _supported(v, ctx_pool)]
                    if from_ctx:
                        issues.append(f"Finding {i} uses {from_ctx}, which comes only from the business context. Remove the number and describe the rule in words instead.")
                    else:
                        issues.append(f"Finding {i} contains numbers not found in cited results: {bad}.")
            findings.append(f)

        all_pool: list[float] = []
        for r in by_id.values():
            _collect(r["result"]["data"], all_pool)
            _collect(r["result"]["evidence"], all_pool)
        bad_head = [v for v in numbers_in_text(report["headline"]) if not _supported(v, all_pool)]
        if SPELLED.search(report["headline"]):
            issues.append("Headline uses spelled-out numbers; write numbers as digits.")
        if bad_head:
            issues.append(f"Headline contains numbers not found in any result: {bad_head}.")

        report["findings"] = findings
        report["verification"] = {"status": "verified" if not issues else "partially_verified", "issues": issues}
        return {"report": report, "claim_issues": issues,
                "trace": _trace("claim_checker", t, issues=len(issues))}