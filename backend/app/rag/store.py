from pathlib import Path

from app.core.config import settings

MAX_HITS = 4
MAX_DISTANCE = 0.7
_client = None


def _path() -> Path:
    return settings.upload_dir.parent / "chroma"


def _get_client():
    global _client
    if _client is None:
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        _path().mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(
            path=str(_path()), settings=ChromaSettings(anonymized_telemetry=False))
    return _client


def chunk_text(text: str, max_chars: int = 600) -> list[str]:
    chunks = []
    for line in text.splitlines():
        if line.strip().startswith("#"):
            continue
        line = line.strip().lstrip("-*").strip()
        if len(line) < 15:
            continue
        while len(line) > max_chars:
            cut = line.rfind(" ", 0, max_chars)
            cut = cut if cut > 0 else max_chars
            chunks.append(line[:cut].strip())
            line = line[cut:].strip()
        if line:
            chunks.append(line)
    return chunks


def add_context(dataset_id: str, text: str) -> int:
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("No usable text found in the file.")
    client = _get_client()
    name = f"ds_{dataset_id}"
    try:
        client.delete_collection(name)
    except Exception:
        pass
    col = client.create_collection(name=name, metadata={"hnsw:space": "cosine"})
    col.add(ids=[f"c{i}" for i in range(len(chunks))], documents=chunks)
    return len(chunks)


def list_chunks(dataset_id: str) -> list[str]:
    if _client is None and not _path().exists():
        return []
    try:
        col = _get_client().get_collection(f"ds_{dataset_id}")
    except Exception:
        return []
    return col.get()["documents"] or []


def query(dataset_id: str, text: str, k: int = MAX_HITS) -> list[dict]:
    if _client is None and not _path().exists():
        return []
    try:
        col = _get_client().get_collection(f"ds_{dataset_id}")
    except Exception:
        return []
    n = col.count()
    if n == 0:
        return []
    res = col.query(query_texts=[text], n_results=min(k, n))
    out = []
    for cid, doc, dist in zip(res["ids"][0], res["documents"][0], res["distances"][0]):
        if dist <= MAX_DISTANCE:
            out.append({"id": cid, "text": doc, "distance": round(float(dist), 3)})
    return out