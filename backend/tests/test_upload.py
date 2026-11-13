import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def tmp_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", tmp_path)


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_upload_csv_ok():
    files = {"file": ("sales.csv", b"month,revenue\nJan,100\nFeb,200\n", "text/csv")}
    r = client.post("/api/datasets/upload", files=files)
    assert r.status_code == 200
    body = r.json()
    assert body["rows"] == 2
    assert [c["name"] for c in body["columns"]] == ["month", "revenue"]
    prev = client.get(f"/api/datasets/{body['id']}/preview").json()
    assert prev["rows"][1]["revenue"] == 200


def test_reject_bad_extension():
    files = {"file": ("virus.exe", b"abc", "application/octet-stream")}
    assert client.post("/api/datasets/upload", files=files).status_code == 400


def test_reject_empty_file():
    files = {"file": ("empty.csv", b"", "text/csv")}
    assert client.post("/api/datasets/upload", files=files).status_code == 400


def test_invalid_id_rejected():
    assert client.get("/api/datasets/../etc").status_code in (400, 404)
