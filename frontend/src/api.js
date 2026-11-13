async function req(path, opts) {
  const r = await fetch(path, opts)
  if (!r.ok) {
    let msg = r.statusText
    try {
      const j = await r.json()
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {}
    throw new Error(msg)
  }
  return r.json()
}

const form = (file) => {
  const f = new FormData()
  f.append('file', file)
  return f
}

export const api = {
  datasets: () => req('/api/datasets'),
  upload: (file) => req('/api/datasets/upload', { method: 'POST', body: form(file) }),
  uploadContext: (id, file) => req(`/api/datasets/${id}/context`, { method: 'POST', body: form(file) }),
  context: (id) => req(`/api/datasets/${id}/context`),
  profile: (id) => req(`/api/datasets/${id}/profile`),
  preview: (id) => req(`/api/datasets/${id}/preview?rows=25`),
  ask: (dataset_id, question) =>
    req('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id, question }),
    }),
  runs: () => req('/api/runs'),
  run: (id) => req(`/api/runs/${id}`),
}