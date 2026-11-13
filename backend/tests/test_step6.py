import numpy as np
import pandas as pd

import app.tools  # noqa: F401
from app.rag.store import chunk_text
from app.services.charts import build_charts
from app.tools.base import REGISTRY, coerce_types, run_tool


def test_ml_tool_registered():
    assert "ml_anomalies" in REGISTRY


def test_ml_anomalies_finds_extreme_row():
    rng = np.random.default_rng(0)
    d = pd.DataFrame({"a": rng.normal(100, 5, 300), "b": rng.normal(50, 2, 300)})
    d.loc[150, ["a", "b"]] = [400, 5]
    r = run_tool("ml_anomalies", d, {"contamination_pct": 1})
    assert r["data"]["examples"][0]["row_index"] == 150
    assert r["data"]["flagged_count"] >= 1


def test_charts_from_evidence():
    raw = pd.DataFrame({
        "date": ["2025-02-10", "2025-02-15", "2025-03-05", "2025-03-20"],
        "category": ["A", "B", "A", "B"],
        "revenue": [100, 100, 40, 80],
    })
    params = {"value_column": "revenue", "date_column": "date", "period_a": "2025-02",
              "period_b": "2025-03", "group_by": "category"}
    res = run_tool("compare_periods", coerce_types(raw), params)
    charts = build_charts([{"id": "s1", "tool": "compare_periods", "params": params, **res}])
    assert len(charts) == 1
    assert charts[0]["figure"]["data"][0]["type"] == "bar"


def test_chunking_drops_short_lines():
    chunks = chunk_text("# Title line here\nrevenue: total order value in INR\nshort\n")
    assert "revenue: total order value in INR" in chunks
    assert all(len(c) >= 15 for c in chunks)

def test_outliers_extreme_count():
    d = pd.DataFrame({"v": [10, 11, 12, 10, 11, 12, 10, 11, 500]})
    r = run_tool("detect_outliers", d, {"column": "v"})
    assert r["data"]["extreme_count"] == 1


def test_what_if_group_scenario():
    d = pd.DataFrame({"category": ["A", "B", "A"], "revenue": [100, 100, 40]})
    r = run_tool("what_if", d, {"value_column": "revenue", "change_pct": 10,
                                "group_by": "category", "group_value": "A"})
    assert r["data"]["baseline_total"] == 240
    assert r["data"]["scenario_total"] == 254
    assert r["data"]["change_amount"] == 14


def test_what_if_unknown_group_rejected():
    import pytest
    from app.tools.base import ToolError
    d = pd.DataFrame({"category": ["A"], "revenue": [100]})
    with pytest.raises(ToolError):
        run_tool("what_if", d, {"value_column": "revenue", "change_pct": 5,
                                "group_by": "category", "group_value": "Z"})
