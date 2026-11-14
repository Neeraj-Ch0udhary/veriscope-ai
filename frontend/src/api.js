async function j(res) {
  if (!res.ok) {
    let m = res.statusText;
    try { const e = await res.json(); m = e.detail || m; } catch {}
    throw new Error(typeof m === "string" ? m : JSON.stringify(m));
  }
  return res.json();
}

export const api = {
  datasets: () => fetch("/api/datasets").then(j),
  upload: (file) => {
    const f = new FormData();
    f.append("file", file);
    return fetch("/api/datasets/upload", { method: "POST", body: f }).then(j);
  },
  profile: (id) => fetch(`/api/datasets/${id}/profile`).then(j),
  preview: (id, rows = 10) => fetch(`/api/datasets/${id}/preview?rows=${rows}`).then(j),
  ask: (dataset_id, question) =>
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id, question }),
    }).then(j),
  runs: () => fetch("/api/runs").then(j),
  run: (id) => fetch(`/api/runs/${id}`).then(j),
};