from pathlib import Path


def patch(path, old, new):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, f"{path}: pattern not found exactly once: {old[:60]}"
    p.write_text(s.replace(old, new), encoding="utf-8")


patch("app/rag/store.py", "MAX_DISTANCE = 0.9", "MAX_DISTANCE = 0.7")

patch(
    "app/tools/analysis.py",
    "    out = s[(s < lo) | (s > hi)]\n",
    "    out = s[(s < lo) | (s > hi)]\n"
    "    far_hi, far_lo = q3 + 3 * iqr, q1 - 3 * iqr\n"
    "    extreme = s[(s < far_lo) | (s > far_hi)]\n",
)
patch(
    "app/tools/analysis.py",
    '"outlier_count": int(len(out)), "outlier_pct": num(len(out) / len(s) * 100),',
    '"outlier_count": int(len(out)), "outlier_pct": num(len(out) / len(s) * 100),\n'
    '        "extreme_count": int(len(extreme)), "extreme_upper_bound": num(far_hi),\n'
    '        "extreme_lower_bound": num(far_lo),',
)
patch(
    "app/tools/analysis.py",
    "f\"outside the normal range {data['lower_bound']:,} to {data['upper_bound']:,}.\")",
    "f\"outside the normal range {data['lower_bound']:,} to {data['upper_bound']:,}; \"\n"
    "               f\"{len(extreme)} are extreme (above {data['extreme_upper_bound']:,} \"\n"
    "               f\"or below {data['extreme_lower_bound']:,}).\")",
)
patch(
    "app/agent/prompts.py",
    "Recommendations must not contain numbers. ",
    "Recommendations must not contain numbers. Values flagged by the IQR rule are unusual, not proven errors "
    "(skewed columns produce many); distinguish them from extreme values and recommend review. ",
)
print("patched")