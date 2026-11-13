from pathlib import Path

p = Path("app/agent/nodes.py")
s = p.read_text(encoding="utf-8")
old = (
    '        if SPELLED.search(report["headline"]):\n'
    '        issues.append("Headline uses spelled-out numbers; write numbers as digits.")\n'
    '    if bad_head:'
)
new = (
    '        if SPELLED.search(report["headline"]):\n'
    '            issues.append("Headline uses spelled-out numbers; write numbers as digits.")\n'
    '        if bad_head:'
)
assert s.count(old) == 1, "broken block not found exactly once"
p.write_text(s.replace(old, new), encoding="utf-8")
print("fixed")