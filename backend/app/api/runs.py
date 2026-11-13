import json

from fastapi import APIRouter

from app.api.view import view as render_view
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["runs"])


@router.get("/runs")
def list_runs(limit: int = 50):
    d = settings.upload_dir.parent / "runs"
    if not d.exists():
        return []
    files = sorted(d.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]
    out = []
    for p in files:
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        rep = r.get("report", {})
        out.append({
            "run_id": r.get("run_id"), "question": r.get("question"),
            "dataset_id": r.get("dataset_id"), "created_at": r.get("created_at"),
            "headline": rep.get("headline", ""),
            "status": rep.get("verification", {}).get("status", ""),
        })
    return out


@router.get("/runs/{run_id}/download")
def download(run_id: str):
    resp = render_view(run_id)
    resp.headers["Content-Disposition"] = f'attachment; filename="veriscope-report-{run_id}.html"'
    return resp