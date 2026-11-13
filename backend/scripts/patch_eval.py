from pathlib import Path


def patch(path, old, new):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, f"{path}: pattern not found exactly once: {old[:60]}"
    p.write_text(s.replace(old, new), encoding="utf-8")


F = "evaluation/run_eval.py"
patch(F,
      '            res = evaluate(case, out, df)\n            res["error"] = ""\n',
      '            res = evaluate(case, out, df)\n            res["error"] = ""\n'
      '            nodes = [t["node"] for t in out["trace"]]\n'
      '            res["retries"] = max(0, nodes.count("planner") - 1) + max(0, nodes.count("reporter") - 1)\n'
      '            res["llm_seconds"] = round(sum(t["ms"] for t in out["trace"]\n'
      '                                           if t["node"] in ("planner", "reporter")) / 1000, 2)\n')
patch(F,
      "{res['seconds']}s  {res['error']}\")",
      "{res['seconds']}s  llm={res.get('llm_seconds', '-')}s  retries={res.get('retries', '-')}  {res['error']}\")")
patch(F,
      '        "grounding_pct": pct(rows, "grounded"),\n',
      '        "grounding_pct": pct(rows, "grounded"),\n'
      '        "first_pass_pct": round(100 * sum(1 for r in rows if r.get("retries", 1) == 0) / len(rows), 1),\n')
patch(F,
      "        f\"| Evidence grounding | {summary['grounding_pct']}% |\",\n",
      "        f\"| Evidence grounding | {summary['grounding_pct']}% |\",\n"
      "        f\"| Answered without any retry | {summary['first_pass_pct']}% |\",\n")
print("eval patched")