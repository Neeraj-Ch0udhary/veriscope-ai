import pandas as pd

from app.tools.base import ToolError, ToolResult, num, numeric_col, tool


@tool(
    "what_if",
    "What-if scenario: change a numeric column by a percentage (optionally only for one group, e.g. "
    "group_by=category, group_value=Electronics) and report the baseline total versus the scenario total. "
    "Use for questions that start with 'what if' or 'what happens if'. change_pct is a whole number "
    "(10 means +10%, -20 means -20%).",
    {
        "value_column": {"type": "column", "required": True},
        "change_pct": {"type": "int", "required": True, "min": -100, "max": 1000},
        "group_by": {"type": "column"},
        "group_value": {"type": "str"},
    },
)
def what_if(df, value_column, change_pct, group_by, group_value):
    numeric_col(df, value_column)
    s = df[value_column]
    if group_by:
        if group_value is None:
            raise ToolError("group_value is required when group_by is set.")
        mask = df[group_by].astype(str) == str(group_value)
        if not mask.any():
            options = sorted(df[group_by].dropna().astype(str).unique())[:10]
            raise ToolError(f"No rows where {group_by} = '{group_value}'. Available values: {options}")
        scope = f"{group_by} = {group_value}"
    else:
        mask = pd.Series(True, index=df.index)
        scope = "all rows"

    base_total = float(s.sum())
    affected = float(s[mask].sum())
    delta = affected * change_pct / 100
    new_total = base_total + delta
    total_pct = None if base_total == 0 else delta / base_total * 100

    data = {
        "baseline_total": num(base_total), "scenario_total": num(new_total),
        "change_amount": num(delta), "total_change_pct": num(total_pct),
        "change_pct_applied": int(change_pct), "scope": scope,
        "affected_baseline": num(affected), "affected_rows": int(mask.sum()),
    }
    pct_txt = "n/a" if total_pct is None else f"{total_pct:+.2f}%"
    summary = (f"If {value_column} for {scope} changes by {change_pct:+d}%, total {value_column} moves from "
               f"{base_total:,.2f} to {new_total:,.2f} ({delta:+,.2f}, {pct_txt} overall). "
               f"Assumes every other value stays unchanged.")
    evidence = {
        "columns_used": [c for c in [value_column, group_by] if c],
        "formula": f"scenario_total = total + sum({value_column} where {scope}) * {change_pct}/100",
        "rows_used": int(len(df)),
        "assumption": "Simple proportional scenario; no demand or price elasticity is modelled.",
    }
    return ToolResult("what_if", summary, data, evidence)