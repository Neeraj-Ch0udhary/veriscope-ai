import numpy as np
import pandas as pd

from app.tools.base import AGGS, ToolError, ToolResult, date_col, num, numeric_col, tool


def _agg(series: pd.Series, agg: str) -> float:
    return float(getattr(series, agg)())


@tool(
    "describe_column",
    "Summary statistics for one column (numeric stats or top categories).",
    {"column": {"type": "column", "required": True}},
)
def describe_column(df, column):
    s = df[column]
    n = int(len(s))
    missing = int(s.isna().sum())
    if pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s):
        d = s.describe()
        data = {
            "kind": "numeric", "count": int(d["count"]), "missing": missing,
            "mean": num(d["mean"]), "std": num(d["std"]), "min": num(d["min"]),
            "q1": num(d["25%"]), "median": num(d["50%"]), "q3": num(d["75%"]), "max": num(d["max"]),
        }
        summary = f"{column}: mean {data['mean']:,}, median {data['median']:,}, range {data['min']:,} to {data['max']:,}."
    else:
        vc = s.astype(str).where(s.notna()).value_counts().head(10)
        data = {
            "kind": "categorical", "count": n - missing, "missing": missing,
            "unique": int(s.nunique()),
            "top_values": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
        }
        top = data["top_values"][0]["value"] if data["top_values"] else "n/a"
        summary = f"{column}: {data['unique']} unique values, most common is {top}."
    evidence = {"columns_used": [column], "formula": "pandas describe()", "rows_used": n - missing}
    return ToolResult("describe_column", summary, data, evidence)


@tool(
    "group_aggregate",
    "Aggregate a numeric column by a category column (e.g. total revenue by region).",
    {
        "value_column": {"type": "column", "required": True},
        "group_by": {"type": "column", "required": True},
        "agg": {"type": "enum", "values": AGGS, "default": "sum"},
        "limit": {"type": "int", "default": 20, "min": 1, "max": 100},
    },
)
def group_aggregate(df, value_column, group_by, agg, limit):
    numeric_col(df, value_column)
    g = df.groupby(group_by, dropna=True)[value_column].agg(agg).sort_values(ascending=False)
    if g.empty:
        raise ToolError("No data available for this grouping.")
    total = float(g.sum()) if agg in ("sum", "count") else None
    rows = [
        {"group": str(k), "value": num(v), "share_pct": num(v / total * 100) if total else None}
        for k, v in g.head(limit).items()
    ]
    summary = f"{agg} of {value_column} by {group_by}: highest is {rows[0]['group']} ({rows[0]['value']:,})."
    evidence = {
        "columns_used": [value_column, group_by],
        "formula": f"{agg}({value_column}) grouped by {group_by}",
        "rows_used": int(df[[value_column, group_by]].dropna().shape[0]),
        "groups_total": int(len(g)),
    }
    return ToolResult("group_aggregate", summary, rows, evidence)


@tool(
    "time_trend",
    "Aggregate a numeric column over time (day, week, month, quarter, year) with period-over-period change.",
    {
        "value_column": {"type": "column", "required": True},
        "date_column": {"type": "column", "required": True},
        "freq": {"type": "enum", "values": ["D", "W", "M", "Q", "Y"], "default": "M"},
        "agg": {"type": "enum", "values": AGGS, "default": "sum"},
    },
)
def time_trend(df, value_column, date_column, freq, agg):
    numeric_col(df, value_column)
    date_col(df, date_column)
    d = df[[date_column, value_column]].dropna()
    if d.empty:
        raise ToolError("No rows with both a date and a value.")
    series = d.groupby(d[date_column].dt.to_period(freq))[value_column].agg(agg)
    change = series.pct_change() * 100
    rows = [
        {"period": str(p), "value": num(v), "pct_change": num(change.loc[p])}
        for p, v in series.items()
    ]
    peak, low = series.idxmax(), series.idxmin()
    summary = (f"{agg} of {value_column} by period: peak in {peak} ({num(series[peak]):,}), "
               f"lowest in {low} ({num(series[low]):,}).")
    evidence = {
        "columns_used": [value_column, date_column],
        "formula": f"{agg}({value_column}) per {freq} period; pct_change = (current - previous) / previous * 100",
        "rows_used": int(len(d)),
        "periods": int(len(series)),
    }
    return ToolResult("time_trend", summary, rows, evidence)


@tool(
    "compare_periods",
    "Compare a numeric column between two periods (format YYYY or YYYY-MM), optionally broken down by a category to explain the change.",
    {
        "value_column": {"type": "column", "required": True},
        "date_column": {"type": "column", "required": True},
        "period_a": {"type": "str", "required": True},
        "period_b": {"type": "str", "required": True},
        "agg": {"type": "enum", "values": AGGS, "default": "sum"},
        "group_by": {"type": "column"},
    },
)
def compare_periods(df, value_column, date_column, period_a, period_b, agg, group_by):
    numeric_col(df, value_column)
    date_col(df, date_column)
    key = df[date_column].dt.strftime("%Y-%m").fillna("")

    def pick(p):
        sub = df[key.str.startswith(str(p))]
        if sub.empty:
            raise ToolError(f"No rows found for period '{p}'.")
        return sub

    a, b = pick(period_a), pick(period_b)
    va, vb = _agg(a[value_column], agg), _agg(b[value_column], agg)
    diff = vb - va
    pct = None if va == 0 else diff / va * 100

    breakdown = None
    if group_by:
        ga = a.groupby(group_by)[value_column].agg(agg)
        gb = b.groupby(group_by)[value_column].agg(agg)
        t = pd.DataFrame({"a": ga, "b": gb}).fillna(0)
        t["diff"] = t["b"] - t["a"]
        t["pct"] = np.where(t["a"] == 0, np.nan, t["diff"] / t["a"].replace(0, np.nan) * 100)
        t["share_of_change"] = np.where(diff == 0, np.nan, t["diff"] / diff * 100)
        t = t.sort_values("diff")
        breakdown = [
            {"group": str(i), "period_a": num(r["a"]), "period_b": num(r["b"]),
             "difference": num(r["diff"]), "pct_change": num(r["pct"]),
             "share_of_total_change_pct": num(r["share_of_change"])}
            for i, r in t.iterrows()
        ]

    pct_txt = "n/a" if pct is None else f"{pct:+.1f}%"
    summary = (f"{agg} of {value_column}: {va:,.2f} in {period_a} vs {vb:,.2f} in {period_b} "
               f"({diff:+,.2f}, {pct_txt}).")
    data = {
        "period_a": {"label": str(period_a), "value": num(va)},
        "period_b": {"label": str(period_b), "value": num(vb)},
        "difference": num(diff), "pct_change": num(pct), "breakdown": breakdown,
    }
    evidence = {
        "columns_used": [c for c in [value_column, date_column, group_by] if c],
        "formula": f"({agg}(B) - {agg}(A)) / {agg}(A) * 100, A={period_a}, B={period_b}",
        "rows_period_a": int(len(a)), "rows_period_b": int(len(b)),
    }
    return ToolResult("compare_periods", summary, data, evidence)


@tool(
    "correlation",
    "Pearson correlation between two numeric columns.",
    {
        "column_x": {"type": "column", "required": True},
        "column_y": {"type": "column", "required": True},
    },
)
def correlation(df, column_x, column_y):
    numeric_col(df, column_x)
    numeric_col(df, column_y)
    d = df[[column_x, column_y]].dropna()
    if len(d) < 3:
        raise ToolError("Need at least 3 complete rows to compute correlation.")
    r = d[column_x].corr(d[column_y])
    if r != r:
        raise ToolError("Correlation is undefined (a column may be constant).")
    a = abs(r)
    strength = "very strong" if a >= 0.8 else "strong" if a >= 0.6 else "moderate" if a >= 0.4 else "weak"
    summary = (f"Correlation between {column_x} and {column_y} is {r:.3f} ({strength}, "
               f"{'positive' if r > 0 else 'negative'}). Correlation does not prove causation.")
    evidence = {"columns_used": [column_x, column_y], "formula": "Pearson r", "rows_used": int(len(d))}
    return ToolResult("correlation", summary, {"r": num(r), "strength": strength, "n": int(len(d))}, evidence)


@tool(
    "detect_outliers",
    "Find unusual values in a numeric column using the IQR rule (outside Q1 - 1.5*IQR .. Q3 + 1.5*IQR).",
    {"column": {"type": "column", "required": True}},
)
def detect_outliers(df, column):
    numeric_col(df, column)
    s = df[column].dropna()
    if s.empty:
        raise ToolError("Column has no values.")
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    out = s[(s < lo) | (s > hi)]
    far_hi, far_lo = q3 + 3 * iqr, q1 - 3 * iqr
    extreme = s[(s < far_lo) | (s > far_hi)]
    top = out.reindex(out.sub(s.median()).abs().sort_values(ascending=False).index).head(10)
    data = {
        "lower_bound": num(lo), "upper_bound": num(hi),
        "outlier_count": int(len(out)), "outlier_pct": num(len(out) / len(s) * 100),
        "extreme_count": int(len(extreme)), "extreme_upper_bound": num(far_hi),
        "extreme_lower_bound": num(far_lo),
        "examples": [{"row_index": int(i), "value": num(v)} for i, v in top.items()],
    }
    summary = (f"{len(out)} unusual values in {column} ({data['outlier_pct']}%), "
               f"outside the normal range {data['lower_bound']:,} to {data['upper_bound']:,}; "
               f"{len(extreme)} are extreme (above {data['extreme_upper_bound']:,} "
               f"or below {data['extreme_lower_bound']:,}).")
    evidence = {
        "columns_used": [column],
        "formula": "IQR rule: Q1 - 1.5*IQR and Q3 + 1.5*IQR",
        "rows_used": int(len(s)), "q1": num(q1), "q3": num(q3),
    }
    return ToolResult("detect_outliers", summary, data, evidence)