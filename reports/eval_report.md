# VeriScope AI - evaluation report

Run: 2026-11-14 10:28 UTC | Model: openai/gpt-oss-120b | Dataset rows: 5,913

| Metric | Result |
|---|---|
| Questions evaluated | 19 |
| Execution success | 100.0% |
| Tool selection accuracy | 100.0% |
| Calculation correctness | 100.0% |
| Evidence grounding | 100.0% |
| Answered without any retry | 89.5% |
| Avg response time | 6.15 s |
| P95 response time | 18.97 s |

Calculation correctness: ground truth is computed with plain pandas, independent of the agent's tools, and must appear in the evidence. Grounding: every finding passed the claim checker.

| Case | Executed | Tool | Correct | Grounded | Tools used | Seconds |
|---|---|---|---|---|---|---|
| period_drop | pass | pass | pass | pass | compare_periods | 5.28 |
| top_category | pass | pass | pass | pass | group_aggregate | 2.74 |
| monthly_trend | pass | pass | pass | pass | time_trend | 2.98 |
| correlation | pass | pass | pass | pass | correlation | 2.47 |
| outliers | pass | pass | pass | pass | detect_outliers | 2.3 |
| ml_anomalies | pass | pass | pass | pass | ml_anomalies | 18.97 |
| category_share | pass | pass | pass | pass | group_aggregate | 10.46 |
| describe | pass | pass | pass | pass | describe_column | 6.49 |
| unanswerable | pass | pass | pass | pass | - | 2.94 |
| lowest_region | pass | pass | pass | pass | group_aggregate | 7.6 |
| avg_units | pass | pass | pass | pass | describe_column | 5.77 |
| quarterly | pass | pass | pass | pass | time_trend | 4.49 |
| drop_driver | pass | pass | pass | pass | compare_periods | 10.31 |
| price_outliers | pass | pass | pass | pass | detect_outliers | 8.79 |
| what_if | pass | pass | pass | pass | what_if | 10.01 |
| peak_month | pass | pass | pass | pass | time_trend | 12.25 |
| missing_column | pass | pass | pass | pass | - | 1.1 |
| no_data_period | pass | pass | pass | pass | - | 0.91 |
| unanswerable_2 | pass | pass | pass | pass | - | 0.9 |
