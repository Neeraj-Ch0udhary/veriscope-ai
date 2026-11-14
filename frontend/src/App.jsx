import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import ThemeToggle from "./ThemeToggle";
import DatasetPanel from "./DatasetPanel";
import RunCard from "./RunCard";
import { suggest } from "./suggest";

const DOT = { verified: "good", partially_verified: "warn", no_data: "bad", tool_summaries_only: "bad" };

export default function App() {
  const [datasets, setDatasets] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [thread, setThread] = useState([]);
  const [runs, setRuns] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef(null);
  const endRef = useRef(null);
  const openAfter = useRef(null);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 6000); };

  const refresh = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([api.datasets(), api.runs()]);
      setDatasets(d);
      setRuns(r);
      return d;
    } catch (e) {
      flash("Backend not reachable: " + e.message);
      return [];
    }
  }, []);

  useEffect(() => {
    refresh().then((d) => { if (d.length) setActiveId(d[0].id); });
  }, [refresh]);

  useEffect(() => {
    if (!activeId) return;
    setProfile(null);
    setPreview([]);
    setThread(openAfter.current ? [{ key: Date.now(), question: openAfter.current.question, run: openAfter.current }] : []);
    openAfter.current = null;
    api.profile(activeId).then(setProfile).catch((e) => flash(e.message));
    api.preview(activeId, 10).then((p) => setPreview(p.rows || [])).catch(() => {});
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread]);

  async function onUpload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const d = await api.upload(file);
      await refresh();
      setActiveId(d.id ?? d.dataset_id);
    } catch (e) {
      flash(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function ask(q) {
    q = (q ?? question).trim();
    if (!q || !activeId || busy) return;
    setQuestion("");
    setBusy(true);
    const key = Date.now();
    setThread((t) => [...t, { key, question: q, pending: true }]);
    try {
      const run = await api.ask(activeId, q);
      setThread((t) => t.map((x) => (x.key === key ? { key, question: q, run } : x)));
      refresh();
    } catch (e) {
      setThread((t) => t.map((x) => (x.key === key ? { key, question: q, error: e.message } : x)));
    } finally {
      setBusy(false);
    }
  }

  async function openRun(id) {
    try {
      const run = await api.run(id);
      if (run.dataset_id === activeId) {
        setThread((t) => [...t, { key: Date.now(), question: run.question, run }]);
      } else {
        openAfter.current = run;
        setActiveId(run.dataset_id);
      }
    } catch (e) {
      flash(e.message);
    }
  }

  const meta = datasets.find((d) => d.id === activeId);
  const ideas = suggest(profile);

  return (
    <div className="app">
      <aside className="side">
        <div className="sec row">
          <div className="brand">VeriScope <span>AI</span></div>
          <div className="grow" />
          <ThemeToggle />
        </div>

        <div className="sec">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => onUpload(e.target.files[0])} />
          <div
            className="drop"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onUpload(e.dataTransfer.files[0]); }}
          >
            {uploading ? "Uploading..." : "Drop CSV / Excel here or click to upload"}
          </div>
        </div>

        <div className="sec">
          <div className="label">Datasets</div>
          {datasets.length === 0 && <div className="muted small">No datasets yet.</div>}
          {datasets.map((d) => (
            <button key={d.id} className={"item" + (d.id === activeId ? " on" : "")} onClick={() => setActiveId(d.id)}>
              {d.filename} <span className="muted small">#{String(d.id).slice(0, 4)}</span>
            </button>
          ))}
        </div>

        <div className="sec grow scroll">
          <div className="label">History</div>
          {runs.length === 0 && <div className="muted small">No saved runs yet.</div>}
          {runs.map((r) => (
            <button key={r.run_id} className="item hist" onClick={() => openRun(r.run_id)} title={r.headline}>
              <span className={"dot " + (DOT[r.status] || "warn")} />
              <span className="clip">{r.question}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="feed">
          {!activeId ? (
            <div className="empty card pad">
              <h2>Upload a dataset to begin</h2>
              <p className="muted">Ask questions in plain English. Every number in the answer is computed by an approved tool and checked against its evidence.</p>
            </div>
          ) : (
            <>
              <DatasetPanel meta={meta} profile={profile} preview={preview} />
              {thread.length === 0 && ideas.length > 0 && (
                <div className="card pad">
                  <div className="label">Try asking</div>
                  <div className="chips">
                    {ideas.map((s) => <button key={s} className="chip btnchip" onClick={() => ask(s)}>{s}</button>)}
                  </div>
                </div>
              )}
              {thread.map((it) => <RunCard key={it.key} item={it} />)}
            </>
          )}
          <div ref={endRef} />
        </div>

        <form className="askbar" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={activeId ? "Ask a question about this dataset..." : "Upload a dataset first"}
            disabled={!activeId || busy}
            maxLength={500}
          />
          <button className="btn" type="submit" disabled={!activeId || busy || question.trim().length < 3}>
            {busy ? "Working..." : "Ask"}
          </button>
        </form>
      </main>

      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}
    </div>
  );
}
