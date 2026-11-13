from pathlib import Path

p = Path("app/services/charts.py")
s = p.read_text(encoding="utf-8")
old = '    if tool == "ml_anomalies" and d.get("examples"):\n'
new = (
    '    if tool == "what_if":\n'
    '        fig = go.Figure(go.Bar(x=["Baseline", "Scenario"], y=[d["baseline_total"], d["scenario_total"]],\n'
    '                               marker_color=[BLUE, GREEN if d["change_amount"] >= 0 else RED]))\n'
    '        return f"{vc}: baseline vs scenario", fig\n'
) + old
assert s.count(old) == 1, "pattern not found exactly once"
p.write_text(s.replace(old, new), encoding="utf-8")
print("charts patched")