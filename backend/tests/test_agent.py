import pandas as pd

from app.agent.graph import build_graph
from app.agent.runner import run_agent

RAW = pd.DataFrame({
    "date": ["2025-02-10", "2025-02-15", "2025-03-05", "2025-03-20"],
    "category": ["A", "B", "A", "B"],
    "revenue": [100, 100, 40, 80],
})

PLAN = {"reasoning": "compare months", "steps": [{"tool": "compare_periods", "params": {
    "value_column": "revenue", "date_column": "date", "period_a": "2025-02",
    "period_b": "2025-03", "group_by": "category"}}]}

GOOD = {"headline": "Revenue fell 40.0% in 2025-03.", "findings": [
    {"text": "Revenue fell 40.0% from 200 in 2025-02 to 120 in 2025-03.", "evidence_ids": ["s1"]},
    {"text": "Category A had the larger drop of 60.", "evidence_ids": ["s1"]}],
    "recommendations": ["Review category A."], "limitations": []}

BAD = {"headline": "Revenue fell sharply.", "findings": [
    {"text": "Revenue fell 45.0% from 200 to 120.", "evidence_ids": ["s1"]}],
    "recommendations": [], "limitations": []}


class FakeLLM:
    def __init__(self, planner, reporter):
        self.planner, self.reporter, self.reporter_calls = list(planner), list(reporter), 0

    def generate_json(self, system, prompt):
        if "planning module" in system:
            return self.planner.pop(0)
        self.reporter_calls += 1
        return self.reporter.pop(0)


def run(llm):
    return run_agent(build_graph(llm, lambda _id: RAW.copy()), "x", "Why did revenue drop in March?")


def test_happy_path_verified():
    out = run(FakeLLM([PLAN], [GOOD]))
    assert out["report"]["verification"]["status"] == "verified"
    assert all(f["verified"] for f in out["report"]["findings"])
    assert out["evidence"][0]["data"]["pct_change"] == -40.0


def test_hallucinated_number_is_caught_and_fixed():
    llm = FakeLLM([PLAN], [BAD, GOOD])
    out = run(llm)
    assert llm.reporter_calls == 2
    assert out["report"]["verification"]["status"] == "verified"


def test_persistent_hallucination_is_flagged():
    out = run(FakeLLM([PLAN], [BAD, BAD]))
    rep = out["report"]
    assert rep["verification"]["status"] == "partially_verified"
    assert rep["findings"][0]["verified"] is False
    assert 45.0 in rep["findings"][0]["unverified_numbers"]


def test_planner_retry_after_bad_tool():
    bad_plan = {"reasoning": "x", "steps": [{"tool": "delete_everything", "params": {}}]}
    out = run(FakeLLM([bad_plan, PLAN], [GOOD]))
    assert [t["node"] for t in out["trace"]].count("planner") == 2
    assert out["report"]["verification"]["status"] == "verified"


def test_unanswerable_question_fails_safely():
    llm = FakeLLM([{"reasoning": "no such column", "steps": []}] * 2, [])
    out = run(llm)
    assert out["report"]["verification"]["status"] == "no_data"
    assert llm.reporter_calls == 0

WORDS = {"headline": "Revenue fell.", "findings": [
    {"text": "Revenue fell by forty percent from 200 to 120.", "evidence_ids": ["s1"]}],
    "recommendations": [], "limitations": []}


def test_spelled_out_numbers_are_flagged():
    out = run(FakeLLM([PLAN], [WORDS, WORDS]))
    assert out["report"]["verification"]["status"] == "partially_verified"
    assert out["report"]["findings"][0]["verified"] is False
