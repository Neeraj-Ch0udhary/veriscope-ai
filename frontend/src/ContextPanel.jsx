import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

const EXAMPLE =
  "Business rule: a revenue value more than 10 times a typical order is probably a data-entry error and should be flagged as an outlier.";
const MAX = 200 * 1024;
const textOf = (c) => (typeof c === "string" ? c : c?.text ?? c?.content ?? JSON.stringify(c));
const plural = (n) => `${n} chunk${n === 1 ? "" : "s"}`;

export default function ContextPanel({ datasetId }) {
  const [open, setOpen] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!datasetId) return;
    try {
      const r = await api.contextList(datasetId);
      setChunks((r.chunks || []).map(textOf));
    } catch {
      setChunks([]);
    }
  }, [datasetId]);

  useEffect(() => {
    setHits(null);
    setMsg(null);
    setText("");
    load();
  }, [load]);

  // The backend replaces a dataset's context on every upload, so we always send existing + new together.
  async function send(content, done) {
    if (new Blob([content]).size > MAX) {
      setMsg({ tone: "bad", text: "Total context would be larger than 200 KB." });
      return false;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.contextUpload(datasetId, new File([content], "business_rules.txt", { type: "text/plain" }));
      setMsg({ tone: "good", text: done(r.chunks) });
      setHits(null);
      await load();
      return true;
    } catch (e) {
      setMsg({ tone: "bad", text: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addText() {
    const t = text.trim();
    if (t.length < 10) return setMsg({ tone: "bad", text: "Write at least one full sentence." });
    if (await send([...chunks, t].join("\n"), (n) => `Saved. This dataset now has ${plural(n)}.`)) setText("");
  }

  async function addFile(file) {
    try {
      const t = await file.text();
      await send([...chunks, t].join("\n"), (n) => `Added ${file.name}. This dataset now has ${plural(n)}.`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clearAll(skipConfirm) {
    if (skipConfirm !== true && !window.confirm("Remove all business context for this dataset?")) return;
    setBusy(true);
    try {
      await api.contextClear(datasetId);
      setMsg({ tone: "good", text: "Business context cleared." });
      setHits(null);
      await load();
    } catch (e) {
      setMsg({ tone: "bad", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(i) {
    const rest = chunks.filter((_, k) => k !== i);
    if (rest.length === 0) return clearAll(true);
    await send(rest.join("\n"), (n) => `Removed. ${plural(n)} left.`);
  }

  async function test(e) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    try {
      const r = await api.contextSearch(datasetId, q.trim());
      setHits(r.hits || []);
    } catch (er) {
      setMsg({ tone: "bad", text: er.message });
    }
  }

  return (
    <div className="card pad fade">
      <div className="row">
        <b>Business context</b>
        <span className="pill"><b>{chunks.length}</b> chunk{chunks.length === 1 ? "" : "s"}</span>
        <span className="muted small">Rules and definitions the agent applies when interpreting results</span>
        <div className="grow" />
        <button className="btn ghost sm" onClick={() => setOpen((o) => !o)}>{open ? "Collapse" : "Manage"}</button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <textarea
            className="ctx-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste business rules, definitions or notes about this dataset..."
          />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" disabled={busy || text.trim().length < 10} onClick={addText}>
              {busy ? "Working..." : "Add to context"}
            </button>
            <button className="btn ghost sm" disabled={busy} onClick={() => fileRef.current?.click()}>Upload .txt / .md</button>
            <button className="btn ghost sm" disabled={busy} onClick={() => setText(EXAMPLE)}>Insert example</button>
            <input ref={fileRef} type="file" accept=".txt,.md" hidden onChange={(e) => e.target.files[0] && addFile(e.target.files[0])} />
          </div>
          <p className="muted small" style={{ margin: "8px 0 0" }}>
            Each line becomes one chunk. Lines under 15 characters and # headings are ignored. New text is added to what is already stored.
          </p>

          {msg && <div className={"alert " + msg.tone}>{msg.text}</div>}

          <div className="row" style={{ marginTop: 14 }}>
            <h4 style={{ margin: 0 }}>Stored chunks</h4>
            <div className="grow" />
            {chunks.length > 0 && (
              <button className="btn ghost sm" disabled={busy} onClick={() => clearAll()}>Clear all</button>
            )}
          </div>
          {chunks.length === 0 ? (
            <p className="muted small">Nothing yet. Add a rule above, then ask a question that it affects.</p>
          ) : (
            <div className="ctx-list" style={{ marginTop: 8 }}>
              {chunks.map((c, i) => (
                <div key={i} className="ctx-item">
                  <span>{c}</span>
                  <button className="btn ghost sm" disabled={busy} onClick={() => remove(i)} aria-label="Remove chunk">Remove</button>
                </div>
              ))}
            </div>
          )}

          <h4>Test retrieval</h4>
          <form className="row" onSubmit={test}>
            <input
              style={{ flex: 1, minWidth: 200 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type a question to see which chunks the agent would retrieve..."
              maxLength={300}
            />
            <button className="btn ghost sm" type="submit" disabled={q.trim().length < 2}>Search</button>
          </form>
          {hits &&
            (hits.length === 0 ? (
              <p className="muted small">No matching chunks (nothing close enough to the question).</p>
            ) : (
              <div className="ctx-list" style={{ marginTop: 8 }}>
                {hits.map((h, i) => (
                  <div key={i} className="ctx-item">
                    <span>{textOf(h)}</span>
                    {typeof h?.distance === "number" && <span className="chip" title="Cosine distance, lower is closer">dist {h.distance}</span>}
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}