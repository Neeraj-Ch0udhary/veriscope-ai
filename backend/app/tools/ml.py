import pandas as pd

from app.tools.base import ToolError, ToolResult, num, numeric_col, tool


@tool(
    "ml_anomalies",
    "Machine-learning anomaly detection (Isolation Forest) across several numeric columns at once; "
    "finds records that are unusual in combination. Use for questions about unusual records or anomalies. "
    "columns is an optional comma-separated list of numeric columns (default: all numeric columns).",
    {
        "columns": {"type": "str"},
        "contamination_pct": {"type": "int", "default": 1, "min": 1, "max": 10},
    },
)
def ml_anomalies(df, columns, contamination_pct):
    from sklearn.ensemble import IsolationForest

    if isinstance(columns, list):
        columns = ",".join(str(c) for c in columns)
    if columns:
        cols = [c.strip() for c in str(columns).split(",") if c.strip()]
    else:
        cols = [c for c in df.columns
                if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])]
    cols = cols[:8]
    if not cols:
        raise ToolError("No numeric columns available for anomaly detection.")
    for c in cols:
        numeric_col(df, c)

    d = df[cols].dropna()
    if len(d) < 30:
        raise ToolError("Need at least 30 complete rows for anomaly detection.")

    model = IsolationForest(n_estimators=200, contamination=contamination_pct / 100, random_state=42)
    flags = model.fit_predict(d) == -1
    scores = -model.score_samples(d)
    flagged = d[flags].copy()
    flagged["_score"] = scores[flags]
    flagged = flagged.sort_values("_score", ascending=False)

    examples = [
        {"row_index": int(i), "anomaly_score": num(r["_score"]), **{c: num(r[c]) for c in cols}}
        for i, r in flagged.head(10).iterrows()
    ]
    count = int(flags.sum())
    summary = (f"Isolation Forest flagged {count} of {len(d)} rows as unusual across {', '.join(cols)}. "
               f"By design it flags about {contamination_pct}% of rows, so treat these as candidates to review, "
               f"not confirmed errors.")
    data = {"flagged_count": count, "total_rows": int(len(d)),
            "contamination_pct": int(contamination_pct), "features": cols, "examples": examples}
    evidence = {
        "columns_used": cols,
        "formula": (f"IsolationForest(n_estimators=200, contamination={contamination_pct}%, random_state=42); "
                    "anomaly_score = -score_samples (higher means more unusual)"),
        "rows_used": int(len(d)),
    }
    return ToolResult("ml_anomalies", summary, data, evidence)