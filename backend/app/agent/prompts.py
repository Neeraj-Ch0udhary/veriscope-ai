import json

from app.tools.base import REGISTRY

PLANNER_SYSTEM = (
    "You are the planning module of a data analysis agent. You never compute numbers yourself. "
    "You choose from a fixed list of approved tools. Respond with JSON only: "
    '{"reasoning": "short text", "steps": [{"tool": "tool_name", "params": {}}]}. '
    "Rules: 1 to 5 steps; only listed tools; use exact column names from the schema; "
    "date periods are written YYYY or YYYY-MM; to explain a change between two periods use "
    "compare_periods with group_by set to a relevant category column (one step per category column); "
    "if the question cannot be answered with this data, return empty steps and explain in reasoning."
)

REPORTER_SYSTEM = (
    "You write the answer for a data analysis agent. Use only facts and numbers that appear in the "
    "tool results provided. Never invent, estimate or compute new numbers (do not add, subtract or "
    "average values yourself). Always write every number as digits with commas, for example 1,646,309.54 and 21.0%. Never spell numbers out as words (no 'thousand', 'million', 'percent', 'twenty') and never use abbreviations like k, M, lakh or crore. "
    "Each finding must list in evidence_ids the step ids (like s1) that contain its numbers. "
    "Correlation is not causation: say 'associated with', never 'caused by', unless the data is a direct "
    "breakdown of the change. Recommendations must not contain numbers. If business context is provided, apply its rules and definitions when interpreting results, but do not repeat numbers that appear only in the context. Values flagged by the IQR rule are unusual, not proven errors (skewed columns produce many); distinguish them from extreme values and recommend review. When a value rose or fell, do not also put a minus sign on it (write 'fell by 345,052.78', not 'fell by -345,052.78'). "
    'Respond with JSON only: {"headline": "text", "findings": [{"text": "text", "evidence_ids": ["s1"]}], '
    '"recommendations": ["text"], "limitations": ["text"]}. Give 2 to 5 findings.'
)


def tool_specs() -> str:
    lines = []
    for name, spec in REGISTRY.items():
        ps = []
        for key, rule in spec["params"].items():
            kind = rule["type"]
            if kind == "enum":
                kind = "one of " + "|".join(rule["values"])
            elif kind == "column":
                kind = "existing column name"
            ps.append(f"{key} ({kind}, {'required' if rule.get('required') else 'optional'})")
        lines.append(f"- {name}: {spec['description']} Params: " + "; ".join(ps))
    return "\n".join(lines)


def planner_prompt(question: str, schema_text: str, feedback: str) -> str:
    p = f"Dataset schema:\n{schema_text}\n\nApproved tools:\n{tool_specs()}\n\nQuestion: {question}\n"
    if feedback:
        p += f"\nYour previous plan had problems. Fix them:\n{feedback}\n"
    return p


def reporter_prompt(question: str, results: list, issues: list, context: list | None = None) -> str:
    blocks = []
    for r in results:
        res = r["result"]
        data = json.dumps(res["data"], default=str)
        if len(data) > 8000:
            data = data[:8000] + "...(truncated)"
        blocks.append(
            f"[{r['id']}] tool={r['tool']} params={json.dumps(r['params'], default=str)}\n"
            f"summary: {res['summary']}\nformula: {res['evidence'].get('formula')}\ndata: {data}"
        )
    p = f"Question: {question}\n\nTool results:\n" + "\n\n".join(blocks) + "\n"
    if context:
        p += ("\nBusiness context (rules and definitions; not data results, never cite as evidence): "
              + " | ".join(c['text'] for c in context) + "\n")
    if issues:
        p += ("\nYour previous answer failed verification:\n- " + "\n- ".join(issues) +
              "\nFix it using only numbers that appear in the cited results.\n")
    return p