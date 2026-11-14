import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import ThemeToggle from "./ThemeToggle";
import DatasetPanel from "./DatasetPanel";
import RunCard from "./RunCard";
import ContextPanel from "./ContextPanel";
import { suggest } from "./suggest";

const DOT = { verified: "good", partially_verified: "warn", no_data: "bad", tool_summaries_only: "bad" };
const when = (iso) => {
  try {
    return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function App() {
  const [datasets, setDatasets] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [moreLoading, setMoreLoading] = useState(false);
  const [thread, setThread] = useState([]);
  const [runs, setRuns] = useState([]);
  const [filter, setFilter] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const [sideOpen, setSideOpen] = useState(() => window.innerWidth > 860);
  const fileRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
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
    refresh().then((d) => {
      if (!d.length) return;
      let saved = null;
      try { saved = localStorage.getItem("vs-ds"); } catch {}
      setActiveId(d.find((x) => x.id === saved)?.id ?? d[0].id);
    });
  }, [refresh]);

  useEffect(() => {
    if (!activeId) return;
    try { localStorage.setItem("vs-ds", activeId); } catch {}
    setProfile(null);
    setPreview([]);
    const pending = openAfter.current;
    openAfter.current = null;
    setThread(pending ? [{ key: Date.now(), question: pending.question, run: pending }] : []);
    api.profile(activeId).then(setProfile).catch((e) => flash(e.message));
    api.preview(activeId, 10).then((p) => setPreview(p.rows || [])).catch(() => {});
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread]);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

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

  async function showMore() {
    setMoreLoading(true);
    try {
      const p = await api.preview(activeId, 50);
      setPreview(p.rows || []);
    } catch (e) {
      flash(e.message);
    } finally {
      setMoreLoading(false);
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
  const asked = new Set(thread.map((t) => t.question));
  const ideas = suggest(profile).filter((q) => !asked.has(q));
  const shown = runs.filter((r) => (r.question || "").toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className={"app" + (sideOpen ? "" : " collapsed")}>
      <aside className="side">
        <div className="sec">
          <div className="brand">VeriScope <span>AI</span></div>
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
          <input className="filter" placeholder="Search history..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          {runs.length === 0 && <div className="muted small">No saved runs yet.</div>}
          {runs.length > 0 && shown.length === 0 && <div className="muted small">No matches.</div>}
          {shown.map((r) => (
            <button key={r.run_id} className="item hist" onClick={() => openRun(r.run_id)} title={`${r.headline || ""}\n${when(r.created_at)}`}>
              <span className={"dot " + (DOT[r.status] || "warn")} />
              <span className="clip">{r.question}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="btn ghost sm" onClick={() => setSideOpen((o) => !o)} aria-label="Toggle sidebar">{"\u2630"}</button>
          <span className="title">{meta ? meta.filename : "VeriScope AI"}</span>
          <div className="grow" />
          <span className="hint">Press <kbd>/</kbd> to ask</span>
          {thread.length > 0 && <button className="btn ghost sm" onClick={() => setThread([])}>Clear chat</button>}
          <ThemeToggle />
        </header>

        <div className="feed">
          {!activeId ? (
            <div className="empty card pad fade">
              <h2>Upload a dataset to begin</h2>
              <p className="muted">Ask questions in plain English. Every number in the answer is computed by an approved tool and checked against its evidence.</p>
              <div className="chips" style={{ justifyContent: "center" }}>
                <span className="chip">Verified numbers</span>
                <span className="chip">Approved tools only</span>
                <span className="chip">Full execution trace</span>
                <span className="chip">Light and dark themes</span>
              </div>
            </div>
          ) : (
            <>
              <DatasetPanel meta={meta} profile={profile} preview={preview} onMore={showMore} moreLoading={moreLoading} />
              <ContextPanel datasetId={activeId} />
              {thread.length === 0 && ideas.length > 0 && (
                <div className="card pad fade">
                  <div className="label">Try asking</div>
                  <div className="chips">
                    {ideas.map((s) => <button key={s} className="chip btnchip" onClick={() => ask(s)}>{s}</button>)}
                  </div>
                </div>
              )}
              {thread.map((it, idx) => (
                <RunCard
                  key={it.key}
                  item={it}
                  onAsk={ask}
                  busy={busy}
                  followUps={idx === thread.length - 1 && !it.pending ? ideas.slice(0, 3) : []}
                />
              ))}
            </>
          )}
          <div ref={endRef} />
        </div>

        <form className="askbar" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input
            ref={inputRef}
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