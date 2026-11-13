REFUSE = (
    r"(no|not|n't|without|cannot|unavailable|missing|absent|lack)[^.]{0,100}(customer|age|column|data|2024|rows)"
    r"|(customer|age|2024)[^.]{0,100}(not|unavailable|missing|absent|no )"
)


def _sum_by(df, col):
    return df.groupby(col)["revenue"].sum()


def t_low_region(df):
    g = _sum_by(df, "region")
    return [g.min(), g.max()]


def t_avg_units(df):
    return [df["units"].mean()]


def t_quarter(df):
    q = df.groupby(df["order_date"].dt.to_period("Q"))["revenue"].sum()
    return [q.max(), q.min()]


def t_cat_drop(df):
    k = df["order_date"].dt.strftime("%Y-%m")
    a = df[k == "2025-02"].groupby("category")["revenue"].sum()
    b = df[k == "2025-03"].groupby("category")["revenue"].sum()
    return [(b - a).min()]


def t_price_outliers(df):
    s = df["unit_price"].dropna()
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    return [int(((s < lo) | (s > hi)).sum()), hi]


def t_whatif(df):
    total = df["revenue"].sum()
    e = df.loc[df["category"] == "Electronics", "revenue"].sum()
    return [total, total + e * 0.1, e * 0.1]


def t_region_trend(df):
    m = df.groupby(df["order_date"].dt.to_period("M"))["revenue"].sum()
    return [m.max(), m.min()]


EXTRA = [
    {"id": "lowest_region", "question": "Which region has the lowest total revenue?",
     "tools": ["group_aggregate"], "truth": t_low_region},
    {"id": "avg_units", "question": "What is the average number of units per order?",
     "tools": ["describe_column"], "truth": t_avg_units},
    {"id": "quarterly", "question": "How did revenue change by quarter in 2025?",
     "tools": ["time_trend"], "truth": t_quarter},
    {"id": "drop_driver", "question": "Which category contributed most to the March 2025 revenue drop versus February?",
     "tools": ["compare_periods"], "truth": t_cat_drop},
    {"id": "price_outliers", "question": "Are there outliers in unit price?",
     "tools": ["detect_outliers"], "truth": t_price_outliers},
    {"id": "what_if", "question": "What happens to total revenue if Electronics revenue increases by 10%?",
     "tools": ["what_if"], "truth": t_whatif},
    {"id": "peak_month", "question": "Which month had the highest revenue and which had the lowest?",
     "tools": ["time_trend"], "truth": t_region_trend},
    {"id": "missing_column", "question": "What is the average customer age?",
     "tools": [], "truth": None, "refusal": REFUSE},
    {"id": "no_data_period", "question": "Compare revenue in March 2024 with February 2024.",
     "tools": [], "truth": None, "refusal": REFUSE},
    {"id": "unanswerable_2", "question": "What is the customer churn rate?",
     "tools": [], "truth": None, "refusal": REFUSE},
]