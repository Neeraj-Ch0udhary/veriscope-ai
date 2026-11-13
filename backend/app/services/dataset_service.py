import io
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from fastapi import HTTPException

from app.core.config import settings

ID_PATTERN = re.compile(r"^[a-f0-9]{12}$")


def _read_dataframe(content: bytes, ext: str) -> pd.DataFrame:
    try:
        if ext == ".csv":
            try:
                return pd.read_csv(io.BytesIO(content))
            except UnicodeDecodeError:
                return pd.read_csv(io.BytesIO(content), encoding="latin-1")
        return pd.read_excel(io.BytesIO(content), engine="openpyxl")
    except Exception as exc:
        raise HTTPException(400, f"Could not parse file: {exc}")


def _column_info(df: pd.DataFrame) -> list[dict]:
    return [
        {
            "name": str(col),
            "dtype": str(df[col].dtype),
            "nulls": int(df[col].isna().sum()),
            "unique": int(df[col].nunique(dropna=True)),
        }
        for col in df.columns
    ]


def save_dataset(filename: str, content: bytes) -> dict:
    ext = Path(filename).suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            400, f"Unsupported file type '{ext}'. Allowed: {', '.join(settings.allowed_extensions)}"
        )
    if not content:
        raise HTTPException(400, "File is empty.")
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.max_upload_mb} MB limit.")

    df = _read_dataframe(content, ext)
    if df.empty:
        raise HTTPException(400, "File has no data rows.")
    if len(df) > settings.max_rows or df.shape[1] > settings.max_cols:
        raise HTTPException(400, "Dataset too large (rows or columns limit exceeded).")

    dataset_id = uuid.uuid4().hex[:12]
    (settings.upload_dir / f"{dataset_id}{ext}").write_bytes(content)

    meta = {
        "id": dataset_id,
        "filename": filename,
        "extension": ext,
        "rows": int(len(df)),
        "columns": _column_info(df),
        "duplicate_rows": int(df.duplicated().sum()),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    (settings.upload_dir / f"{dataset_id}.json").write_text(json.dumps(meta))
    return meta


def get_meta(dataset_id: str) -> dict:
    if not ID_PATTERN.match(dataset_id):
        raise HTTPException(400, "Invalid dataset id.")
    path = settings.upload_dir / f"{dataset_id}.json"
    if not path.exists():
        raise HTTPException(404, "Dataset not found.")
    return json.loads(path.read_text())


def load_dataframe(dataset_id: str) -> pd.DataFrame:
    meta = get_meta(dataset_id)
    content = (settings.upload_dir / f"{dataset_id}{meta['extension']}").read_bytes()
    return _read_dataframe(content, meta["extension"])


def list_datasets() -> list[dict]:
    items = [json.loads(p.read_text()) for p in settings.upload_dir.glob("*.json")]
    return sorted(items, key=lambda m: m["uploaded_at"], reverse=True)


def preview(dataset_id: str, rows: int = 20) -> list[dict]:
    df = load_dataframe(dataset_id).head(rows)
    return json.loads(df.to_json(orient="records", date_format="iso"))