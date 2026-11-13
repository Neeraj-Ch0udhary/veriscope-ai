# VeriScope AI - evaluation report

Run: 2026-11-13 18:06 UTC | Model: openai/gpt-oss-120b | Dataset rows: 5,913

| Metric | Result |
|---|---|
| Questions evaluated | 29 |
| Execution success | 100.0% |
| Tool selection accuracy | 100.0% |
| Calculation correctness | 100.0% |
| Evidence grounding | 89.7% |
| Answered without any retry | 65.5% |
| Avg response time | 14.0 s |
| P95 response time | 28.56 s |

Calculation correctness: ground truth is computed with plain pandas, independent of the agent's tools, and must appear in the evidence. Grounding: every finding passed the claim checker.

| Case | Executed | Tool | Correct | Grounded | Tools used | Seconds |
|---|---|---|---|---|---|---|
| period_drop | pass | pass | pass | pass | compare_periods | 10.13 |
| top_category | pass | pass | pass | pass | group_aggregate | 14.65 |
| monthly_trend | pass | pass | pass | FAIL | time_trend | 29.29 |
| correlation | pass | pass | pass | pass | correlation | 17.09 |
| outliers | pass | pass | pass | pass | detect_outliers | 15.52 |
| ml_anomalies | pass | pass | pass | pass | ml_anomalies | 17.77 |
| category_share | pass | pass | pass | pass | group_aggregate | 15.53 |
| describe | pass | pass | pass | pass | describe_column | 18.65 |
| unanswerable | pass | pass | pass | pass | - | 12.79 |
| lowest_region | pass | pass | pass | pass | group_aggregate | 8.75 |
| avg_units | pass | pass | pass | pass | describe_column | 8.11 |
| quarterly | pass | pass | pass | pass | time_trend | 12.93 |
| drop_driver | pass | pass | pass | pass | compare_periods | 12.32 |
| price_outliers | pass | pass | pass | pass | detect_outliers | 12.09 |
| what_if | pass | pass | pass | pass | what_if | 15.77 |
| peak_month | pass | pass | pass | FAIL | time_trend | 28.56 |
| missing_column | pass | pass | pass | pass | - | 12.33 |
| no_data_period | pass | pass | pass | pass | - | 12.48 |
| unanswerable_2 | pass | pass | pass | pass | - | 2.31 |
| lowest_region | pass | pass | pass | pass | group_aggregate | 12.97 |
| avg_units | pass | pass | pass | pass | describe_column | 11.34 |
| quarterly | pass | pass | pass | pass | time_trend | 9.07 |
| drop_driver | pass | pass | pass | pass | compare_periods | 16.17 |
| price_outliers | pass | pass | pass | pass | detect_outliers | 6.04 |
| what_if | pass | pass | pass | pass | what_if | 16.74 |
| peak_month | pass | pass | pass | FAIL | time_trend | 27.47 |
| missing_column | pass | pass | pass | pass | - | 11.89 |
| no_data_period | pass | pass | pass | pass | - | 2.6 |
| unanswerable_2 | pass | pass | pass | pass | - | 14.58 |
