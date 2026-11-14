from pathlib import Path


def add(path, marker, block):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    if marker in s:
        print(path, "already patched")
        return
    p.write_text(s.rstrip() + "\n\n\n" + block, encoding="utf-8")
    print(path, "patched")


add("app/rag/store.py", "def clear_context", '''def clear_context(dataset_id: str) -> None:
    try:
        _get_client().delete_collection(f"ds_{dataset_id}")
    except Exception:
        pass
''')

add("app/api/context.py", "def clear_context", '''@router.delete("/{dataset_id}/context")
def clear_context(dataset_id: str):
    svc.get_meta(dataset_id)
    store.clear_context(dataset_id)
    return {"dataset_id": dataset_id, "chunks": 0}
''')