import math
import time
from dataclasses import asdict, dataclass
from typing import Any

import pandas as pd

AGGS = ["sum", "mean", "median", "min", "max", "count"]
REGISTRY: dict[str, dict] = {}


class ToolError(Exception):
    """Raised for any invalid tool request. Always safe to show to the user."""


@dataclass
class ToolResult:
    tool: str
    summary: str
    data: Any
    evidence: dict


def tool(name: str, description: str, params: dict):
    def deco(fn):
        REGISTRY[name] = {"fn": fn, "description": description, "params": params}
        return fn
    return deco


def num(x):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(x) or math.isinf(x):
        return None
    return round(x, 4)


def coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    """Convert text columns that are really dates into datetime columns."""
    df = df.copy()
    for col in df.columns:
        s = df[col]
        if (pd.api.types.is_numeric_dtype(s) or pd.api.types.is_bool_dtype(s)
                or pd.api.types.is_datetime64_any_dtype(s)):
            continue
        sample = s.dropna().astype(str).head(200)
        if sample.empty:
            continue
        parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
        if parsed.notna().mean() > 0.95:
            df[col] = pd.to_datetime(s, errors="coerce", format="mixed")
    return df


def numeric_col(df: pd.DataFrame, col: str) -> None:
    if col not in df.columns:
        raise ToolError(f"Column '{col}' does not exist.")
    if not pd.api.types.is_numeric_dtype(df[col]) or pd.api.types.is_bool_dtype(df[col]):
        raise ToolError(f"Column '{col}' is not numeric.")


def date_col(df: pd.DataFrame, col: str) -> None:
    if col not in df.columns:
        raise ToolError(f"Column '{col}' does not exist.")
    if not pd.api.types.is_datetime64_any_dtype(df[col]):
        raise ToolError(f"Column '{col}' is not a date column.")


def run_tool(name: str, df: pd.DataFrame, params: dict) -> dict:
    spec = REGISTRY.get(name)
    if spec is None:
        raise ToolError(f"Unknown tool '{name}'. Allowed tools: {sorted(REGISTRY)}")
    extra = set(params) - set(spec["params"])
    if extra:
        raise ToolError(f"Unexpected parameters: {sorted(extra)}")

    clean: dict = {}
    for key, rule in spec["params"].items():
        val = params.get(key, rule.get("default"))
        if val is None:
            if rule.get("required"):
                raise ToolError(f"Missing required parameter '{key}'.")
            clean[key] = None
            continue
        kind = rule["type"]
        if kind == "column" and val not in df.columns:
            raise ToolError(f"Column '{val}' does not exist.")
        if kind == "enum" and val not in rule["values"]:
            raise ToolError(f"'{key}' must be one of {rule['values']}.")
        if kind == "int":
            try:
                val = int(val)
            except (TypeError, ValueError):
                raise ToolError(f"'{key}' must be an integer.")
            val = max(rule.get("min", val), min(rule.get("max", val), val))
        clean[key] = val

    start = time.perf_counter()
    result: ToolResult = spec["fn"](df, **clean)
    result.evidence["elapsed_ms"] = round((time.perf_counter() - start) * 1000, 2)
    return asdict(result)