# VeriScope AI

Agentic AI system for automated data analysis and decision support, built with LangGraph.
Upload a CSV or Excel file, ask questions in plain English, and get a structured report in which
**every number is computed by an approved tool and verified against its evidence**.

## Why it is different
- **The LLM never computes numbers.** It plans which approved tools to call and writes the narrative. All figures come from deterministic Pandas/NumPy/scikit-learn tools.
- **Claim verification.** A claim-checker node compares each number in the report with the tool results it cites. Unsupported findings are flagged, and the reporter retries with the exact problem as feedback.
- **Honest refusals.** Questions the data cannot answer (a missing column, a period with no rows) return a clear "no data" report instead of an invented answer.
- **Business context (RAG).** Rules and definitions attached to a dataset are retrieved and applied during interpretation, but are never used as evidence.
- **Full traceability.** Each run saves its plan, tool parameters, formulas, row counts, assumptions and per-node timings.

## Architecture
profiler -> retriever -> planner -> executor -> result_checker -> reporter -> claim_checker
^____________________| ^__________|
(retry on failed steps) (retry on unverified claims)

- **Backend:** FastAPI, LangGraph, Pandas, NumPy, scikit-learn (Isolation Forest), Plotly, Groq (llama-3.3-70b-versatile).
- **Frontend:** React + Vite with a light/dark theme, themed Plotly charts, trace viewer, run history, Markdown/JSON/HTML export.
- **Approved tools:** aggregation, column description, time trends, period comparison, outlier detection (IQR), ML anomaly detection, correlation, what-if scenarios, and more. The agent can call only registered tools with validated parameters.

## Evaluation
19 questions on a synthetic sales dataset (5,913 rows), covering aggregation, trends, period comparison, outliers, anomalies, what-if scenarios, and unanswerable questions. Ground truth is recomputed with Pandas.

| Metric | Result |
|---|---|
| Execution success | 100% |
| Tool selection | 100% |
| Calculation correctness | 100% |
| Evidence grounding | 100% |
| Answered without any retry | 89.5% |
| Avg / median / P95 response time | 6.15 s / 5.28 s / 18.97 s |

Notes: the LLM is non-deterministic, so single runs vary slightly. This is a regression benchmark tuned on the same cases, not a held-out test. Latency depends on the Groq free-tier rate limits.

Reproduce: upload `datasets/sales_sample.csv` in the dashboard once, then `python -m evaluation.run_eval`.

## Run locally
```powershell
# backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# create backend/.env with: GROQ_API_KEY=your_key
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev
```
Run tests with `pytest -q` from `backend/` (28 tests).

Docker: `docker-compose.yml` and a frontend Dockerfile are included but have not been tested yet.

## Limitations
- Single-table analysis; no joins across files.
- Outlier tools flag unusual values for review; they do not prove errors.
- What-if scenarios are proportional only and model no demand or price elasticity.

## Team
Minor Project-I, DBS Global University. Mentor: Abhinav Narain.
Team: Neeraj, Charchit Jain, Karan Singh Rathore, Harsh Khendelwal.