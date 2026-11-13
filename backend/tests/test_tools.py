import pandas as pd
import pytest

import app.tools.analysis  # noqa: F401
from app.services.profiler import build_profile
from app.tools.base import ToolError, coerce_types, run_tool


@pytest.fixture
def df():
    raw = pd.DataFrame({
        "date": ["2025-02-10", "2025-02-15", "2025-03-05", "2025-03-20"],
        "category": ["A", "B", "A", "B"],
        "revenue": [100, 100, 40, 80],
    })
    return coerce_types(raw)


def test_date_detected(df):
    assert str(df["date"].dtype).startswith("datetime")


def test_compare_periods_exact(df):
    r = run_tool("compare_periods", df, {
        "value_column": "revenue", "date_column": "date",
        "period_a": "2025-02", "period_b": "2025-03", "group_by": "category"})
    assert r["data"]["period_a"]["value"] == 200
    assert r["data"]["period_b"]["value"] == 120
    assert r["data"]["pct_change"] == -40.0
    assert r["data"]["breakdown"][0]["group"] == "A"
    assert r["data"]["breakdown"][0]["difference"] == -60
    assert r["evidence"]["rows_period_a"] == 2


def test_group_aggregate(df):
    r = run_tool("group_aggregate", df, {"value_column": "revenue", "group_by": "category"})
    assert r["data"][0] == {"group": "B", "value": 180.0, "share_pct": 56.25}


def test_time_trend(df):
    r = run_tool("time_trend", df, {"value_column": "revenue", "date_column": "date"})
    assert [x["period"] for x in r["data"]] == ["2025-02", "2025-03"]
    assert r["data"][1]["pct_change"] == -40.0


def test_correlation_perfect():
    d = pd.DataFrame({"x": [1, 2, 3, 4, 5], "y": [2, 4, 6, 8, 10]})
    assert run_tool("correlation", d, {"column_x": "x", "column_y": "y"})["data"]["r"] == 1.0


def test_outliers():
    d = pd.DataFrame({"v": [10, 11, 12, 10, 11, 12, 10, 11, 500]})
    r = run_tool("detect_outliers", d, {"column": "v"})
    assert r["data"]["outlier_count"] == 1
    assert r["data"]["examples"][0]["value"] == 500


def test_bad_inputs(df):
    with pytest.raises(ToolError):
        run_tool("group_aggregate", df, {"value_column": "nope", "group_by": "category"})
    with pytest.raises(ToolError):
        run_tool("delete_everything", df, {})
    with pytest.raises(ToolError):
        run_tool("group_aggregate", df, {"value_column": "revenue", "group_by": "category", "agg": "os.system"})
    with pytest.raises(ToolError):
        run_tool("group_aggregate", df, {"value_column": "category", "group_by": "category"})


def test_profile_finds_issues():
    d = pd.DataFrame({"a": [1, 1, 2, None], "b": ["x", "x", "y", "z"]})
    p = build_profile(d)
    assert p["duplicate_rows"] == 1
    assert any("missing" in i["message"] for i in p["issues"])
    assert 0 <= p["quality_score"] <= 100