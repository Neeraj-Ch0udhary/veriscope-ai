import operator
from typing import Annotated, TypedDict


class AgentState(TypedDict, total=False):
    dataset_id: str
    question: str
    schema_text: str
    context_hits: list
    plan: dict
    results: list
    feedback: str
    plan_attempts: int
    report_attempts: int
    report: dict
    claim_issues: list
    trace: Annotated[list, operator.add]