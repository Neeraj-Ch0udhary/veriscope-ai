"""Predefined evaluation questions with ground truth computed by plain pandas
(independent of the agent's tools). Truth values must appear in the agent's evidence."""

PROFIT_REFUSAL = (
    r"(no|not|n't|without|cannot|unavailable|missing|lack)[^.]{0,80}(profit|cost|margin)"
    r"|(profit|cost|margin)[^.]{0,80}(not|unavailable|missing|absent|no )"
)


def _key(df):
    return df["order_date"].dt.strftime("%Y-%m")


def t_march(df):
    k = _key(df)
    a = df.loc[k == "2025-02", "revenue"].sum()
    b = df.loc[k == "2025-03", "revenue"].sum()
    return [a, b, b - a, (b - a) / a * 100]


def t_top_category(df):
    g = df.groupby("category")["revenue"].sum()
    return [g.max(), g.min()]


def t_trend(df):
    m = df.groupby(df["order_date"].dt.to_period("M"))["revenue"].sum()
    return [m.max(), m.min()]


def t_corr(df):
    return [df["units"].corr(df["revenue"])]


def t_outliers(df):
    s = df["revenue"].dropna()
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    return [int(((s < lo) | (s > hi)).sum()), hi, lo]


def t_ml(df):
    return [len(df[["units", "unit_price", "revenue"]].dropna())]


def t_share(df):
    g = df.groupby("category")["revenue"].sum()
    return [g.max() / g.sum() * 100]


def t_describe(df):
    return [df["revenue"].mean(), df["revenue"].median()]


CASES = [
    {"id": "period_drop", "question": "Why did revenue drop in March 2025 compared to February?",
     "tools": ["compare_periods"], "truth": t_march},
    {"id": "top_category", "question": "Which category has the highest total revenue?",
     "tools": ["group_aggregate"], "truth": t_top_category},
    {"id": "monthly_trend", "question": "How did monthly revenue change across 2025?",
     "tools": ["time_trend"], "truth": t_trend},
    {"id": "correlation", "question": "How are units and revenue related?",
     "tools": ["correlation"], "truth": t_corr},
    {"id": "outliers", "question": "Does the revenue column have outliers?",
     "tools": ["detect_outliers"], "truth": t_outliers},
    {"id": "ml_anomalies", "question": "Which orders look anomalous across units, unit price and revenue?",
     "tools": ["ml_anomalies"], "truth": t_ml},
    {"id": "category_share", "question": "What share of total revenue does each category contribute?",
     "tools": ["group_aggregate"], "truth": t_share},
    {"id": "describe", "question": "What are the average and median revenue per order?",
     "tools": ["describe_column"], "truth": t_describe},
    {"id": "unanswerable", "question": "What was the profit margin in March 2025?",
     "tools": [], "truth": None, "refusal": PROFIT_REFUSAL},
]

from evaluation.cases_extra import EXTRA  # noqa: E402

CASES = CASES + EXTRA


from evaluation.cases_extra import EXTRA  # noqa: E402

CASES = CASES + EXTRA
