from pathlib import Path


def patch(path, old, new):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, f"{path}: pattern not found exactly once: {old[:50]}"
    p.write_text(s.replace(old, new), encoding="utf-8")


patch(
    "app/agent/prompts.py",
    "Write numbers in full, never abbreviations like k, M, lakh or crore. ",
    "Always write every number as digits with commas, for example 1,646,309.54 and 21.0%. "
    "Never spell numbers out as words (no 'thousand', 'million', 'percent', 'twenty') and never "
    "use abbreviations like k, M, lakh or crore. ",
)
patch(
    "app/agent/nodes.py",
    'NUM = re.compile(r"-?\\d[\\d,]*\\.?\\d*")',
    'NUM = re.compile(r"-?\\d[\\d,]*\\.?\\d*")\n'
    'SPELLED = re.compile(r"\\b(?:ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|'
    'nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|'
    'lakh|crore|percent)\\b", re.I)',
)
patch(
    "app/agent/nodes.py",
    'f["verified"] = not bad',
    'words = SPELLED.findall(f["text"])\n'
    '                f["verified"] = not bad and not words\n'
    '                if words:\n'
    '                    issues.append(f"Finding {i} uses spelled-out numbers "\n'
    '                                  f"({sorted(set(w.lower() for w in words))}); write numbers as digits.")',
)
patch(
    "app/agent/nodes.py",
    "if bad_head:",
    'if SPELLED.search(report["headline"]):\n'
    '        issues.append("Headline uses spelled-out numbers; write numbers as digits.")\n'
    "    if bad_head:",
)
print("patched")