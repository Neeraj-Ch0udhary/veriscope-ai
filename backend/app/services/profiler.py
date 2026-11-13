import pandas as pd

from app.tools.base import coerce_types, num


def _kind(s: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(s):
        return "boolean"
    if pd.api.types.is_numeric_dtype(s):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(s):
        return "datetime"
    nn = s.dropna()
    if len(nn) and (s.nunique() <= 50 or s.nunique() / len(nn) < 0.5):
        return "categorical"
    return "text"


def build_profile(df_raw: pd.DataFrame) -> dict:
    df = coerce_types(df_raw)
    n = len(df)
    columns, issues = [], []
    outlier_cells = 0

    for c in df.columns:
        s = df[c]
        kind = _kind(s)
        missing = int(s.isna().sum())
        info = {
            "name": str(c), "kind": kind, "dtype": str(s.dtype),
            "missing": missing, "missing_pct": num(missing / n * 100),
            "unique": int(s.nunique()),
        }
        if kind == "numeric":
            nn = s.dropna()
            if len(nn):
                q1, q3 = nn.quantile(0.25), nn.quantile(0.75)
                iqr = q3 - q1
                out = int(((nn < q1 - 1.5 * iqr) | (nn > q3 + 1.5 * iqr)).sum())
                outlier_cells += out
                info.update(mean=num(nn.mean()), median=num(nn.median()), std=num(nn.std()),
                            min=num(nn.min()), max=num(nn.max()), outliers=out)
                if out:
                    issues.append({"severity": "info", "column": str(c),
                                   "message": f"'{c}' has {out} unusual values (IQR rule)."})
        elif kind == "datetime":
            info.update(min=str(s.min()), max=str(s.max()))
        else:
            vc = s.dropna().astype(str).value_counts().head(5)
            info["top_values"] = [{"value": k, "count": int(v)} for k, v in vc.items()]
        if missing:
            sev = "warning" if missing / n > 0.05 else "info"
            issues.append({"severity": sev, "column": str(c),
                           "message": f"'{c}' has {missing} missing values ({missing / n * 100:.1f}%)."})
        if info["unique"] <= 1:
            issues.append({"severity": "warning", "column": str(c),
                           "message": f"'{c}' has only one distinct value and carries no information."})
        columns.append(info)

    dups = int(df_raw.duplicated().sum())
    if dups:
        issues.append({"severity": "warning", "column": None,
                       "message": f"{dups} duplicate rows found."})

    cells = max(df.size, 1)
    miss_pct = df.isna().sum().sum() / cells * 100
    dup_pct = dups / max(n, 1) * 100
    out_pct = outlier_cells / cells * 100
    score = 100 - min(40, miss_pct * 2) - min(30, dup_pct * 2) - min(20, out_pct * 2)

    return {
        "rows": int(n), "columns_count": int(df.shape[1]),
        "duplicate_rows": dups,
        "quality_score": round(max(score, 0), 1),
        "score_formula": "100 - min(40, 2*missing%) - min(30, 2*duplicate%) - min(20, 2*outlier%)",
        "columns": columns, "issues": issues,
    }