import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
n = 6000
cats = {"Electronics": (1500, 400), "Clothing": (700, 200), "Groceries": (300, 80), "Furniture": (2200, 600)}

df = pd.DataFrame({
    "order_date": rng.choice(pd.date_range("2025-01-01", "2025-12-31"), n),
    "category": rng.choice(list(cats), n, p=[0.3, 0.3, 0.25, 0.15]),
    "region": rng.choice(["North", "South", "East", "West"], n),
    "units": rng.integers(1, 6, n),
})
df["unit_price"] = df["category"].map(lambda c: round(max(50, rng.normal(*cats[c])), 2))
df["revenue"] = (df["units"] * df["unit_price"]).round(2)

mask = (df["order_date"].dt.month == 3) & (df["category"] == "Electronics")
df = df[~(mask & (rng.random(len(df)) < 0.5))].reset_index(drop=True)

df.loc[rng.choice(df.index, 8, replace=False), "revenue"] *= 12
df.loc[rng.choice(df.index, 60, replace=False), "region"] = np.nan

df.sort_values("order_date").to_csv("../datasets/sales_sample.csv", index=False)
print("Created ../datasets/sales_sample.csv", len(df), "rows")