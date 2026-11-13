from fastapi import APIRouter, File, Query, UploadFile

from app.services import dataset_service as svc

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()
    return svc.save_dataset(file.filename or "unknown", content)


@router.get("")
def list_all():
    return svc.list_datasets()


@router.get("/{dataset_id}")
def get_one(dataset_id: str):
    return svc.get_meta(dataset_id)


@router.get("/{dataset_id}/preview")
def preview(dataset_id: str, rows: int = Query(20, ge=1, le=200)):
    return {"rows": svc.preview(dataset_id, rows)}