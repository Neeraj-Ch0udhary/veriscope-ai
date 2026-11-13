import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agent.graph import build_graph
from app.agent.runner import run_agent
from app.core.config import settings
from app.core.llm import LLMError, get_llm
from app.services import dataset_service as svc

router = APIRouter(prefix="/api", tags=["agent"])


class AskRequest(BaseModel):
    dataset_id: str
    question: str = Field(min_length=3, max_length=500)


def _runs_dir():
    d = settings.upload_dir.parent / "runs"
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.get("/llm/ping")
def ping():
    try:
        llm = get_llm()
        out = llm.generate_json("Reply with JSON only.", 'Return {"ok": true}')
    except LLMError as exc:
        raise HTTPException(503, str(exc))
    return {"model": llm.model, "response": out}


@router.post("/ask")
def ask(req: AskRequest):
    svc.get_meta(req.dataset_id)
    try:
        graph = build_graph(get_llm(), svc.load_dataframe)
        out = run_agent(graph, req.dataset_id, req.question)
    except LLMError as exc:
        raise HTTPException(503, str(exc))
    out["run_id"] = uuid.uuid4().hex[:12]
    out["created_at"] = datetime.now(timezone.utc).isoformat()
    out["dataset_id"] = req.dataset_id
    (_runs_dir() / f"{out['run_id']}.json").write_text(json.dumps(out, default=str))
    return out


@router.get("/runs/{run_id}")
def get_run(run_id: str):
    path = _runs_dir() / f"{run_id}.json"
    if not run_id.isalnum() or not path.exists():
        raise HTTPException(404, "Run not found.")
    return json.loads(path.read_text())