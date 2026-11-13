from pathlib import Path


def patch(path, old, new):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, f"{path}: pattern not found exactly once: {old[:60]}"
    p.write_text(s.replace(old, new), encoding="utf-8")


patch("app/rag/store.py",
      '        line = line.strip().lstrip("#-*").strip()\n',
      '        if line.strip().startswith("#"):\n            continue\n        line = line.strip().lstrip("-*").strip()\n')

patch("app/agent/prompts.py",
      "def reporter_prompt(question: str, results: list, issues: list) -> str:",
      "def reporter_prompt(question: str, results: list, issues: list, context: list | None = None) -> str:")
patch("app/agent/prompts.py",
      "    if issues:\n",
      "    if context:\n"
      "        p += (\"\\nBusiness context (rules and definitions; not data results, never cite as evidence): \"\n"
      "              + \" | \".join(c['text'] for c in context) + \"\\n\")\n"
      "    if issues:\n")
patch("app/agent/prompts.py",
      "Recommendations must not contain numbers. ",
      "Recommendations must not contain numbers. If business context is provided, apply its rules and "
      "definitions when interpreting results, but do not repeat numbers that appear only in the context. ")
patch("app/agent/nodes.py",
      'reporter_prompt(state["question"], ok, state.get("claim_issues", []))',
      'reporter_prompt(state["question"], ok, state.get("claim_issues", []), state.get("context_hits", []))')
print("patched")