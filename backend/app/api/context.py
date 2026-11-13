from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.rag import store
from app.services import dataset_service as svc

router = APIRouter(prefix="/api/datasets", tags=["context"])
MAX_BYTES = 200 * 1024


@router.post("/{dataset_id}/context")
async def upload_context(dataset_id: str, file: UploadFile = File(...)):
    svc.get_meta(dataset_id)
    if not (file.filename or "").lower().endswith((".txt", ".md")):
        raise HTTPException(400, "Upload a .txt or .md file.")
    raw = await file.read()
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(400, "File is empty or larger than 200 KB.")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    try:
        n = store.add_context(dataset_id, text)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {"dataset_id": dataset_id, "chunks": n}


@router.get("/{dataset_id}/context")
def list_context(dataset_id: str):
    svc.get_meta(dataset_id)
    return {"chunks": store.list_chunks(dataset_id)}


@router.get("/{dataset_id}/context/search")
def search_context(dataset_id: str, q: str = Query(min_length=2, max_length=300)):
    svc.get_meta(dataset_id)
    return {"query": q, "hits": store.query(dataset_id, q)}