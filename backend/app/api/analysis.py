from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import app.tools.analysis  # noqa: F401  (registers the approved tools)
from app.services import dataset_service as svc
from app.services.profiler import build_profile
from app.tools.base import REGISTRY, ToolError, coerce_types, run_tool

router = APIRouter(prefix="/api", tags=["analysis"])


class ToolRequest(BaseModel):
    dataset_id: str
    tool: str
    params: dict = Field(default_factory=dict)


@router.get("/datasets/{dataset_id}/profile")
def profile(dataset_id: str):
    return build_profile(svc.load_dataframe(dataset_id))


@router.get("/tools")
def list_tools():
    return [{"name": n, "description": s["description"], "params": s["params"]}
            for n, s in REGISTRY.items()]


@router.post("/tools/run")
def run(req: ToolRequest):
    df = coerce_types(svc.load_dataframe(req.dataset_id))
    try:
        return run_tool(req.tool, df, req.params)
    except ToolError as exc:
        raise HTTPException(400, str(exc))