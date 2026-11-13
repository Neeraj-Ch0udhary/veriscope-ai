from langgraph.graph import END, START, StateGraph

from app.agent.nodes import MAX_PLAN_ATTEMPTS, MAX_REPORT_ATTEMPTS, AgentNodes
from app.agent.rag_node import retriever
from app.agent.state import AgentState


def route_after_results(state):
    if state.get("feedback") and state.get("plan_attempts", 0) < MAX_PLAN_ATTEMPTS:
        return "planner"
    return "reporter"


def route_after_claims(state):
    if state.get("claim_issues") and state.get("report_attempts", 0) < MAX_REPORT_ATTEMPTS:
        return "reporter"
    return "end"


def build_graph(llm, load_df):
    n = AgentNodes(llm, load_df)
    g = StateGraph(AgentState)
    g.add_node("profiler", n.profiler)
    g.add_node("retriever", retriever)
    g.add_node("planner", n.planner)
    g.add_node("executor", n.executor)
    g.add_node("result_checker", n.result_checker)
    g.add_node("reporter", n.reporter)
    g.add_node("claim_checker", n.claim_checker)
    g.add_edge(START, "profiler")
    g.add_edge("profiler", "retriever")
    g.add_edge("retriever", "planner")
    g.add_edge("planner", "executor")
    g.add_edge("executor", "result_checker")
    g.add_conditional_edges("result_checker", route_after_results, {"planner": "planner", "reporter": "reporter"})
    g.add_edge("reporter", "claim_checker")
    g.add_conditional_edges("claim_checker", route_after_claims, {"reporter": "reporter", "end": END})
    return g.compile()