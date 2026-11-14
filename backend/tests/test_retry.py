from app.agent.nodes import AgentNodes


def test_declined_plan_does_not_retry():
    n = AgentNodes(None, None)
    out = n.result_checker({"results": [], "plan": {"steps": [], "reasoning": "No customer age column."}})
    assert out["feedback"] == ""


def test_empty_plan_without_reason_still_retries():
    n = AgentNodes(None, None)
    out = n.result_checker({"results": [], "plan": {"steps": [], "reasoning": ""}})
    assert out["feedback"] != ""