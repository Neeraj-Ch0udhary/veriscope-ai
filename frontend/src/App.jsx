import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { Drawer, Explorer, ReportCard, Badge, suggestions } from './components'

export default function App() {
  const [datasets, setDatasets] = useState([])
  const [current, setCurrent] = useState(null)
  const [tab, setTab] = useState('analyst')
  const [chats, setChats] = useState({})
  const [question, setQuestion] = useState('')
  const [drawer, setDrawer] = useState(null)
  const [ideas, setIdeas] = useState([])
  const [ctxCount, setCtxCount] = useState(0)
  const [history, setHistory] = useState([])
  const [openRun, setOpenRun] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const endRef = useRef(null)
  const fileRef = useRef(null)
  const ctxRef = useRef(null)

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 4000) }

  const loadDatasets = async (select) => {
    try {
      const list = await api.datasets()
      setDatasets(list)
      if (select) setCurrent(list.find((d) => d.id === select) || list[0] || null)
      else if (!current && list[0]) setCurrent(list[0])
    } catch (e) { flash(e.message) }
  }

  useEffect(() => { loadDatasets() }, [])

  useEffect(() => {
    if (!current) return
    api.profile(current.id).then((p) => setIdeas(suggestions(p))).catch(() => setIdeas([]))
    api.context(current.id).then((c) => setCtxCount(c.chunks.length)).catch(() => setCtxCount(0))
  }, [current?.id])

  useEffect(() => {
    if (tab === 'history') api.runs().then(setHistory).catch((e) => flash(e.message))
  }, [tab])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chats, current?.id])

  const upload = async (file) => {
    if (!file) return
    try {
      const meta = await api.upload(file)
      await loadDatasets(meta.id)
      setTab('explorer')
      flash(`Uploaded ${meta.filename}: ${meta.rows.toLocaleString()} rows`)
    } catch (e) { flash(e.message) }
  }

  const uploadCtx = async (file) => {
    if (!file || !current) return
    try {
      const r = await api.uploadContext(current.id, file)
      setCtxCount(r.chunks)
      flash(`Business context added: ${r.chunks} entries`)
    } catch (e) { flash(e.message) }
  }

  const ask = async (q) => {
    const text = (q ?? question).trim()
    if (!text || !current || busy) return
    const id = current.id
    setQuestion('')
    setBusy(true)
    setTab('analyst')
    setChats((c) => ({ ...c, [id]: [...(c[id] || []), { q: text, loading: true }] }))
    let patch
    try { patch = { run: await api.ask(id, text) } } catch (e) { patch = { error: e.message } }
    setChats((c) => {
      const list = [...(c[id] || [])]
      list[list.length - 1] = { q: text, ...patch }
      return { ...c, [id]: list }
    })
    setBusy(false)
  }

  const msgs = (current && chats[current.id]) || []

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">V</div>
          <div>
            <b>VeriScope AI</b>
            <div className="muted small">Evidence-grounded data analyst</div>
          </div>
        </div>
        <div
          className="drop"
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]) }}
        >
          <b>+ Upload dataset</b>
          <div className="muted small">CSV or Excel, drag and drop</div>
          <input ref={fileRef} type="file" hidden accept=".csv,.xlsx" onChange={(e) => { upload(e.target.files[0]); e.target.value = '' }} />
        </div>
        <div className="eyebrow">Datasets</div>
        <div className="list">
          {datasets.map((d) => (
            <button key={d.id} className={`ds ${current?.id === d.id ? 'active' : ''}`} onClick={() => setCurrent(d)}>
              <b>{d.filename}</b>
              <span className="muted small">{d.rows.toLocaleString()} rows · {d.columns.length} columns</span>
            </button>
          ))}
          {datasets.length === 0 && <div className="muted small">No datasets yet.</div>}
        </div>
        {current && (
          <div className="ctx">
            <div className="eyebrow">Business context (RAG)</div>
            <div className="muted small">
              {ctxCount > 0 ? `${ctxCount} entries loaded` : 'Add a data dictionary or business rules (.md / .txt)'}
            </div>
            <button className="btn" onClick={() => ctxRef.current.click()}>
              {ctxCount > 0 ? 'Replace context' : 'Upload context'}
            </button>
            <input ref={ctxRef} type="file" hidden accept=".md,.txt" onChange={(e) => { uploadCtx(e.target.files[0]); e.target.value = '' }} />
          </div>
        )}
      </aside>

      <main className="main">
        <header className="tabs">
          {[['analyst', 'AI Analyst'], ['explorer', 'Data Explorer'], ['history', 'History']].map(([k, label]) => (
            <button key={k} className={tab === k ? 'tab active' : 'tab'} onClick={() => { setTab(k); setOpenRun(null) }}>{label}</button>
          ))}
          <div className="grow" />
          {current && <span className="muted small">{current.filename}</span>}
        </header>

        <section className="content">
          {!current && tab !== 'history' && (
            <div className="empty">
              <h2>Upload a dataset to begin</h2>
              <p className="muted">Ask questions in plain English. Every number in the answer is computed by code and checked against evidence.</p>
            </div>
          )}

          {current && tab === 'analyst' && (
            <>
              <div className="chat">
                {msgs.length === 0 && (
                  <div className="empty">
                    <h2>Ask anything about {current.filename}</h2>
                    <div className="ideas">
                      {ideas.map((s) => <button key={s} className="idea" onClick={() => ask(s)}>{s}</button>)}
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i}>
                    <div className="q">{m.q}</div>
                    {m.loading && <div className="thinking">Planning, running approved tools, verifying claims...</div>}
                    {m.error && <div className="notice warn">{m.error}</div>}
                    {m.run && <ReportCard run={m.run} onEvidence={setDrawer} />}
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="composer">
                <textarea
                  rows={1}
                  value={question}
                  placeholder="Ask a question about your data..."
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
                />
                <button className="send" disabled={busy || question.trim().length < 3} onClick={() => ask()}>
                  {busy ? '...' : 'Ask'}
                </button>
              </div>
            </>
          )}

          {current && tab === 'explorer' && <Explorer dataset={current} />}

          {tab === 'history' && !openRun && (
            <div>
              <h3>Analysis history</h3>
              {history.length === 0 && <div className="muted">No analyses yet.</div>}
              {history.map((h) => (
                <button key={h.run_id} className="hist" onClick={() => api.run(h.run_id).then(setOpenRun).catch((e) => flash(e.message))}>
                  <div><b>{h.question}</b></div>
                  <div className="muted small">{h.headline}</div>
                  <div className="row">
                    <Badge status={h.status} />
                    <span className="muted small">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {tab === 'history' && openRun && (
            <div>
              <button className="ghost" onClick={() => setOpenRun(null)}>Back to history</button>
              <div className="q">{openRun.question}</div>
              <ReportCard run={openRun} onEvidence={setDrawer} />
            </div>
          )}
        </section>
      </main>

      <Drawer evidence={drawer} onClose={() => setDrawer(null)} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}