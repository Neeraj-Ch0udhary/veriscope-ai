# VeriScope AI

Agentic AI for automated data analysis and decision support, built with LangGraph.
Upload a CSV or Excel file, ask questions in plain English, and get answers where **every number is computed by code and checked against evidence**.

## Why it is different
- The LLM never does the math. It plans which **approved tools** to call; Pandas/NumPy/scikit-learn compute the numbers.
- A **claim checker** compares every number in the written answer with the tool outputs it cites. Unsupported or spelled-out numbers are rejected, and the model gets one chance to rewrite.
- The agent cannot run arbitrary code or shell commands. Tool names, parameters and columns are validated before execution.
- Full **execution trace** per run, and a reproducible **evaluation suite**.

## Architecture

~~~mermaid
flowchart LR
  Q[Question] --> PR[Profiler]
  PR --> RT[Retriever - RAG]
  RT --> PL[Planner - LLM]
  PL --> EX[Executor - approved tools]
  EX --> RC[Result checker]
  RC -- failed steps --> PL
  RC --> RP[Reporter - LLM]
  RP --> CC[Claim checker]
  CC -- unsupported numbers --> RP
  CC --> OUT[Report + charts + evidence + trace]
~~~

## Approved tools
describe_column, group_aggregate, time_trend, compare_periods, correlation, detect_outliers, ml_anomalies (Isolation Forest), what_if (scenario simulator).

## Stack
Python 3.12, FastAPI, LangGraph, Pandas, NumPy, scikit-learn, Plotly, ChromaDB (local embeddings), Groq LLM API, React + Vite, Pytest.

## Run locally
Backend:
    cd backend
    py -3.12 -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    (create backend/.env with GROQ_API_KEY=... and GROQ_MODEL=...)
    uvicorn app.main:app --reload

Frontend:
    cd frontend
    npm install
    npm run dev

Open http://localhost:5173. Sample data: `python backend/scripts/make_sample.py`.

## Evaluation
`python -m evaluation.run_eval` (from `backend/`) runs predefined questions, with ground truth computed by independent plain pandas, and writes `reports/eval_report.md`. It measures execution success, tool selection, calculation correctness, evidence grounding, retries and response time.
Results are on a synthetic dataset; see `reports/eval_report.md` for the latest numbers.

## Limitations
Descriptive analytics and simple scenarios only. No causal inference. The evaluation set is small and synthetic.